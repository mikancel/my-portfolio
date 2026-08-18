import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  isLoggedIn?: boolean;
  /** ログインに使ったGoogleアカウント（画面表示・監査用） */
  email?: string;
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

export async function requireAuth(): Promise<IronSession<SessionData> | null> {
  const session = await getSession();
  if (!session.isLoggedIn) return null;
  return session;
}
