// Google OAuth の入口ガードの回帰テスト。
// 「state検証をすり抜ける」「許可外アカウントで入れる」が最悪の事故なのでそこを固定する。
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/googleAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/googleAuth")>();
  return { ...actual, exchangeCodeForUser: vi.fn() };
});

import { NextRequest } from "next/server";
import { exchangeCodeForUser, isAllowedEmail } from "@/lib/googleAuth";
import * as callback from "@/app/api/auth/google/callback/route";

const exchangeMock = vi.mocked(exchangeCodeForUser);

const STATE = "11111111-2222-3333-4444-555555555555";

// IPを変えないとレート制限に引っかかるのでテストごとにずらす
let ipCounter = 0;
const callbackReq = (
  query: Record<string, string>,
  cookieState: string | null
) => {
  ipCounter += 1;
  const url = new URL("https://admin.mikancel.com/api/auth/google/callback");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {
    "x-forwarded-for": `10.1.0.${ipCounter}`,
  };
  if (cookieState) headers.cookie = `google_oauth_state=${cookieState}`;
  return new NextRequest(url, { headers });
};

const errorOf = (res: Response) =>
  new URL(res.headers.get("location")!).searchParams.get("error");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = "owner@example.com";
  exchangeMock.mockResolvedValue({
    email: "owner@example.com",
    emailVerified: true,
  });
});

describe("GET /api/auth/google/callback", () => {
  it("stateが一致してもGoogleだけでは完了せず、TOTP入力へ回される", async () => {
    const res = await callback.GET(callbackReq({ code: "c", state: STATE }, STATE));
    expect(res.status).toBe(302);
    // Google認証だけで /admin/blog に入れてはいけない
    expect(res.headers.get("location")).toContain("/admin/mfa");
    expect(res.headers.get("location")).not.toContain("/admin/blog");
    expect(res.headers.get("set-cookie")).toContain("admin_session=");
  });

  it("stateが違えば拒否する（CSRF対策）", async () => {
    const res = await callback.GET(
      callbackReq({ code: "c", state: STATE }, "different-state")
    );
    expect(errorOf(res)).toBe("invalid_state");
    expect(exchangeMock).not.toHaveBeenCalled();
  });

  it("stateのCookieが無ければ拒否する", async () => {
    const res = await callback.GET(callbackReq({ code: "c", state: STATE }, null));
    expect(errorOf(res)).toBe("invalid_state");
    expect(exchangeMock).not.toHaveBeenCalled();
  });

  it("codeが無ければ拒否する", async () => {
    const res = await callback.GET(callbackReq({ state: STATE }, STATE));
    expect(errorOf(res)).toBe("invalid_state");
  });

  it("許可外のアカウントはログインさせない", async () => {
    exchangeMock.mockResolvedValue({
      email: "stranger@example.com",
      emailVerified: true,
    });
    const res = await callback.GET(callbackReq({ code: "c", state: STATE }, STATE));
    expect(errorOf(res)).toBe("forbidden");
    expect(res.headers.get("set-cookie") || "").not.toContain("admin_session=");
  });

  it("メール未確認のアカウントはログインさせない", async () => {
    exchangeMock.mockResolvedValue({
      email: "owner@example.com",
      emailVerified: false,
    });
    const res = await callback.GET(callbackReq({ code: "c", state: STATE }, STATE));
    expect(errorOf(res)).toBe("unverified");
  });

  it("Google側でキャンセルされた場合はその旨を返す", async () => {
    const res = await callback.GET(
      callbackReq({ error: "access_denied", state: STATE }, STATE)
    );
    expect(errorOf(res)).toBe("cancelled");
  });
});

describe("isAllowedEmail", () => {
  it("ADMIN_EMAIL 未設定なら誰も許可しない（設定漏れで全開放しない）", () => {
    delete process.env.ADMIN_EMAIL;
    expect(isAllowedEmail("owner@example.com")).toBe(false);
  });

  it("大文字小文字を区別しない", () => {
    process.env.ADMIN_EMAIL = "Owner@Example.com";
    expect(isAllowedEmail("owner@example.com")).toBe(true);
  });

  it("カンマ区切りで複数指定できる", () => {
    process.env.ADMIN_EMAIL = "a@example.com, b@example.com";
    expect(isAllowedEmail("b@example.com")).toBe(true);
    expect(isAllowedEmail("c@example.com")).toBe(false);
  });
});
