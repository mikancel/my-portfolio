// MFA導入前に発行されたセッションが生き残ると、Cookieの有効期限が切れるまで
// 2要素目を素通りできてしまう（実際に発生した）。バージョン不一致は未ログイン扱いにする。
import { describe, it, expect } from "vitest";
import {
  isFullyAuthenticated,
  SESSION_VERSION,
  type SessionData,
} from "@/lib/session";

describe("isFullyAuthenticated", () => {
  it("現行バージョンでログイン済みなら通す", () => {
    expect(
      isFullyAuthenticated({ isLoggedIn: true, v: SESSION_VERSION })
    ).toBe(true);
  });

  it("MFA導入前のセッション（vなし）は無効", () => {
    expect(isFullyAuthenticated({ isLoggedIn: true })).toBe(false);
  });

  it("古いバージョンのセッションは無効", () => {
    expect(isFullyAuthenticated({ isLoggedIn: true, v: 1 })).toBe(false);
  });

  it("TOTP待ちの状態ではまだ通さない", () => {
    expect(
      isFullyAuthenticated({ pendingMfa: true, email: "a@example.com" })
    ).toBe(false);
  });

  it("空のセッションは無効", () => {
    expect(isFullyAuthenticated({} as SessionData)).toBe(false);
  });

  it("isLoggedIn が false ならバージョンが合っていても無効", () => {
    expect(
      isFullyAuthenticated({ isLoggedIn: false, v: SESSION_VERSION })
    ).toBe(false);
  });
});
