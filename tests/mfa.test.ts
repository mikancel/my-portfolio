// 2要素目(TOTP)のガード。ここが緩むとGoogleログインだけで管理画面に入れてしまう。
import { describe, it, expect, vi, beforeEach } from "vitest";

const sessionState: Record<string, unknown> = {};
const saveMock = vi.fn();

// vi.mock はファイル先頭に巻き上げられるため、外側の変数を参照できない。
// バージョンは実装から直接読む（ハードコードするとずれても気づけない）。
vi.mock("@/lib/session", async (importOriginal) => ({
  SESSION_VERSION: (
    await importOriginal<typeof import("@/lib/session")>()
  ).SESSION_VERSION,
  getSession: vi.fn(async () => ({
    get pendingMfa() {
      return sessionState.pendingMfa;
    },
    set pendingMfa(v) {
      sessionState.pendingMfa = v;
    },
    get isLoggedIn() {
      return sessionState.isLoggedIn;
    },
    set isLoggedIn(v) {
      sessionState.isLoggedIn = v;
    },
    get email() {
      return sessionState.email;
    },
    set email(v) {
      sessionState.email = v;
    },
    get lastTotpStep() {
      return sessionState.lastTotpStep;
    },
    set lastTotpStep(v) {
      sessionState.lastTotpStep = v;
    },
    get v() {
      return sessionState.v;
    },
    set v(value) {
      sessionState.v = value;
    },
    save: saveMock,
  })),
}));

import * as mfaRoute from "@/app/api/auth/mfa/route";
// モック側と同じ値を参照する（vi.importActual はモックを迂回して実装を読む）
const { SESSION_VERSION } =
  await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
import { base32Encode, verifyTotp } from "@/lib/totp";
import crypto from "crypto";

const SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

// 現在時刻に対する正しいコードを、実装と同じ手順で作る
function currentCode(now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto
    .createHmac("sha1", Buffer.from("12345678901234567890", "ascii"))
    .update(buf)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

let ip = 0;
const post = (code: string) => {
  ip += 1;
  return mfaRoute.POST(
    new Request("http://admin.test/api/auth/mfa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.9.0.${ip}`,
      },
      body: JSON.stringify({ code }),
    })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(sessionState)) delete sessionState[k];
  sessionState.pendingMfa = true;
  sessionState.email = "owner@example.com";
  process.env.ADMIN_TOTP_SECRET = SECRET;
});

describe("POST /api/auth/mfa", () => {
  it("正しいコードでログインが成立し、セッションに現行バージョンが入る", async () => {
    const res = await post(currentCode());
    expect(res.status).toBe(200);
    expect(sessionState.isLoggedIn).toBe(true);
    expect(sessionState.pendingMfa).toBe(false);
    // これが無いと古い判定のまま通ってしまう
    expect(sessionState.v).toBe(SESSION_VERSION);
    expect(saveMock).toHaveBeenCalled();
  });

  it("誤ったコードでは成立しない", async () => {
    const res = await post("000000");
    expect(res.status).toBe(401);
    expect(sessionState.isLoggedIn).toBeUndefined();
  });

  it("Google認証を通っていなければコードを試せない", async () => {
    sessionState.pendingMfa = false;
    const res = await post(currentCode());
    expect(res.status).toBe(401);
    expect(sessionState.isLoggedIn).toBeUndefined();
  });

  it("同じコードは使い回せない（リプレイ拒否）", async () => {
    const code = currentCode();
    expect((await post(code)).status).toBe(200);

    // 別セッション扱いに戻しても、使用済みステップは記録されている
    sessionState.pendingMfa = true;
    sessionState.isLoggedIn = false;
    const res = await post(code);
    expect(res.status).toBe(401);
    expect(sessionState.isLoggedIn).toBe(false);
  });

  it("ADMIN_TOTP_SECRET 未設定なら通さない（設定漏れで素通りさせない）", async () => {
    delete process.env.ADMIN_TOTP_SECRET;
    const res = await post(currentCode());
    expect(res.status).toBe(500);
    expect(sessionState.isLoggedIn).toBeUndefined();
  });

  it("総当たりを防ぐため6回目で429になる", async () => {
    const fixedIp = "10.9.9.9";
    const attempt = () =>
      mfaRoute.POST(
        new Request("http://admin.test/api/auth/mfa", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": fixedIp,
          },
          body: JSON.stringify({ code: "000000" }),
        })
      );
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await attempt()).status);
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[5]).toBe(429);
  });
});

describe("verifyTotp の整合性", () => {
  it("テストが生成するコードは実装でも受理される", () => {
    expect(verifyTotp(currentCode(), SECRET)).not.toBeNull();
  });
});
