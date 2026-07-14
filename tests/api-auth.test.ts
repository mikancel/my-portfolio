// APIルートの認可（authz）回帰テスト。
// 「?all=1 が未認証で下書きを返す」「未認証で書き込みできる」といった
// 過去に修正した穴が再発していないことを機械的に保証する。
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/session", () => ({
  requireAuth: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getAllPosts: vi.fn(async () => []),
  getAllTags: vi.fn(async () => []),
  createPost: vi.fn(async () => ({ id: 1 })),
  upsertTag: vi.fn(async (name: string) => ({ id: 1, name, slug: name })),
  getPostById: vi.fn(async () => null),
  updatePost: vi.fn(async () => ({ id: 1 })),
  deletePost: vi.fn(async () => {}),
  saveChallenge: vi.fn(async () => {}),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/r2", () => ({
  getPresignedUploadUrl: vi.fn(async (key: string) => ({
    url: "https://signed.example/put",
    publicUrl: `https://pic.mikancel.com/${key}`,
  })),
}));

vi.mock("@/lib/markdown", () => ({
  markdownToHtml: vi.fn(async () => "<p>ok</p>"),
  extractToc: vi.fn(() => []),
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(async () => ({ challenge: "c" })),
}));

import { requireAuth } from "@/lib/session";
import { getPresignedUploadUrl } from "@/lib/r2";
import * as blogRoute from "@/app/api/blog/route";
import * as blogIdRoute from "@/app/api/blog/[id]/route";
import * as renderRoute from "@/app/api/blog/render/route";
import * as uploadRoute from "@/app/api/upload/route";
import * as registerRoute from "@/app/api/auth/register/route";

const requireAuthMock = vi.mocked(requireAuth);
const presignMock = vi.mocked(getPresignedUploadUrl);

const loggedIn = () =>
  requireAuthMock.mockResolvedValue({ isLoggedIn: true } as never);
const loggedOut = () => requireAuthMock.mockResolvedValue(null);

const jsonReq = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const idCtx = { params: Promise.resolve({ id: "1" }) };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/blog", () => {
  it("公開一覧は未認証でも200", async () => {
    loggedOut();
    const res = await blogRoute.GET(new Request("http://t/api/blog"));
    expect(res.status).toBe(200);
  });

  it("?all=1（下書き込み）は未認証だと401", async () => {
    loggedOut();
    const res = await blogRoute.GET(new Request("http://t/api/blog?all=1"));
    expect(res.status).toBe(401);
  });

  it("?all=1 は認証済みなら200", async () => {
    loggedIn();
    const res = await blogRoute.GET(new Request("http://t/api/blog?all=1"));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/blog（記事作成）", () => {
  it("未認証は401", async () => {
    loggedOut();
    const res = await blogRoute.POST(
      jsonReq("http://t/api/blog", "POST", { title: "x" })
    );
    expect(res.status).toBe(401);
  });

  it("認証済みは201", async () => {
    loggedIn();
    const res = await blogRoute.POST(
      jsonReq("http://t/api/blog", "POST", { title: "x", content: "" })
    );
    expect(res.status).toBe(201);
  });
});

describe("/api/blog/[id]", () => {
  it("?all=1（下書き閲覧）は未認証だと401", async () => {
    loggedOut();
    const res = await blogIdRoute.GET(
      new Request("http://t/api/blog/1?all=1"),
      idCtx
    );
    expect(res.status).toBe(401);
  });

  it("PATCH は未認証だと401", async () => {
    loggedOut();
    const res = await blogIdRoute.PATCH(
      jsonReq("http://t/api/blog/1", "PATCH", { published: true }),
      idCtx
    );
    expect(res.status).toBe(401);
  });

  it("DELETE は未認証だと401", async () => {
    loggedOut();
    const res = await blogIdRoute.DELETE(
      new Request("http://t/api/blog/1", { method: "DELETE" }),
      idCtx
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/blog/render", () => {
  it("未認証は401", async () => {
    loggedOut();
    const res = await renderRoute.POST(
      jsonReq("http://t/api/blog/render", "POST", { content: "# hi" })
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/upload", () => {
  it("未認証は401", async () => {
    loggedOut();
    const res = await uploadRoute.POST(
      jsonReq("http://t/api/upload", "POST", {
        filename: "a.png",
        contentType: "image/png",
      })
    );
    expect(res.status).toBe(401);
  });

  it("不正な拡張子は400", async () => {
    loggedIn();
    const res = await uploadRoute.POST(
      jsonReq("http://t/api/upload", "POST", {
        filename: "evil.png/../../x",
        contentType: "image/png",
      })
    );
    expect(res.status).toBe(400);
  });

  it("画像・動画以外のContent-Typeは400", async () => {
    loggedIn();
    const res = await uploadRoute.POST(
      jsonReq("http://t/api/upload", "POST", {
        filename: "a.html",
        contentType: "text/html",
      })
    );
    expect(res.status).toBe(400);
  });

  it("キーは UUID.拡張子 のフラット形式（ディレクトリなし）", async () => {
    loggedIn();
    const res = await uploadRoute.POST(
      jsonReq("http://t/api/upload", "POST", {
        filename: "photo.PNG",
        contentType: "image/png",
      })
    );
    expect(res.status).toBe(200);
    const key = presignMock.mock.calls[0][0];
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/
    );
  });
});

describe("POST /api/auth/register（パスキー登録トークン）", () => {
  // レート制限バケットはIP単位・モジュールレベルで永続するので、テストごとにIPを変える
  const registerReq = (ip: string, token: string) =>
    new Request("http://t/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ token }),
    });

  beforeEach(() => {
    process.env.REGISTRATION_TOKEN = "correct-horse-battery-staple";
  });

  it("誤ったトークンは403", async () => {
    const res = await registerRoute.POST(registerReq("10.0.0.1", "wrong"));
    expect(res.status).toBe(403);
  });

  it("正しいトークンは登録オプションを返す", async () => {
    const res = await registerRoute.POST(
      registerReq("10.0.0.2", "correct-horse-battery-staple")
    );
    expect(res.status).toBe(200);
  });

  it("REGISTRATION_TOKEN 未設定なら常に403（登録を無効化）", async () => {
    delete process.env.REGISTRATION_TOKEN;
    const res = await registerRoute.POST(registerReq("10.0.0.3", "anything"));
    expect(res.status).toBe(403);
  });

  it("同一IPからの連続試行は6回目で429（総当たり対策）", async () => {
    const ip = "10.0.0.4";
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await registerRoute.POST(registerReq(ip, "wrong"));
      codes.push(res.status);
    }
    expect(codes.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(codes[5]).toBe(429);
  });
});
