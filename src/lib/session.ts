import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

// 認証方式を変えたら上げる。これと一致しないセッションは無効として扱い、
// 既に発行済みのCookieを持っている人にも再ログインを強制する。
// （v2 = Google OAuth + TOTP の2要素。v1以前＝MFA導入前のセッションを弾く）
export const SESSION_VERSION = 2;

export type SessionData = {
  /** 発行時の認証方式のバージョン */
  v?: number;
  /** 2要素とも通過した状態。これが true のときだけ管理APIを許可する */
  isLoggedIn?: boolean;
  /** ログインに使ったGoogleアカウント（画面表示・監査用） */
  email?: string;
  /** Google認証は通ったがTOTP待ちの状態 */
  pendingMfa?: boolean;
  /** 使用済みTOTPのステップ番号。同じコードの使い回しを防ぐ */
  lastTotpStep?: number;
};

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return "dev-only-insecure-session-secret-32chars!!";
  }
  return secret;
}

export const sessionOptions = {
  password: getSessionSecret(),
  cookieName: "admin_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    // Googleからのリダイレクトで戻ってくる経路ではStrictだとCookieが送られず
    // ログイン直後に未ログイン扱いになるため Lax にする。
    // 更新系APIはPOST/PATCH/DELETE＋JSONなのでLaxでもCSRFは防げる。
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

// ログイン済み判定の唯一の定義。proxyとAPIで判断がずれないよう共有する。
// バージョン不一致（＝MFA導入前に発行されたセッション）は未ログイン扱い。
export function isFullyAuthenticated(session: SessionData): boolean {
  return session.isLoggedIn === true && session.v === SESSION_VERSION;
}

export async function requireAuth(): Promise<IronSession<SessionData> | null> {
  const session = await getSession();
  if (!isFullyAuthenticated(session)) return null;
  return session;
}
