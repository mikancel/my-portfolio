// Google OAuth 2.0 認可コードフロー。
// サーバー側にclient_secretを置ける「機密クライアント」なので、
// state（CSRF対策）＋ サーバー間でのトークン交換 で完結させる。
// 追加ライブラリは使わず、既存の iron-session にセッションを載せる。

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const STATE_COOKIE = "google_oauth_state";

export function getClientId(): string {
  const v = process.env.GOOGLE_CLIENT_ID;
  if (!v) throw new Error("GOOGLE_CLIENT_ID is not set");
  return v;
}

function getClientSecret(): string {
  const v = process.env.GOOGLE_CLIENT_SECRET;
  if (!v) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return v;
}

// リダイレクトURIはGoogle側の登録値と完全一致が必要。
// admin.mikancel.com と localhost の両方で動くよう、リクエストのoriginから組み立てる。
export function getRedirectUri(req: Request): string {
  return new URL("/api/auth/google/callback", new URL(req.url).origin).toString();
}

export function buildAuthUrl(req: Request, state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    // 管理者本人の1アカウントしか使わないので、毎回アカウント選択を出す
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params}`;
}

type GoogleUser = { email: string; emailVerified: boolean };

export async function exchangeCodeForUser(
  req: Request,
  code: string
): Promise<GoogleUser | null> {
  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(req),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!tokenRes.ok) return null;

  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;

  // id_token を自前で検証するより、userinfo を引く方が誤りが少ない。
  // どちらもGoogleとのTLS直通信なので、改ざんの余地はない。
  const userRes = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${access_token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!userRes.ok) return null;

  const info = (await userRes.json()) as {
    email?: string;
    email_verified?: boolean;
  };
  if (!info.email) return null;

  return { email: info.email, emailVerified: info.email_verified === true };
}

// 管理者として許可するアドレス。カンマ区切りで複数指定できる。
export function isAllowedEmail(email: string): boolean {
  const allowed = (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // 未設定なら誰も入れない（設定漏れで全員入れる事故を防ぐ）
  if (!allowed.length) return false;
  return allowed.includes(email.toLowerCase());
}
