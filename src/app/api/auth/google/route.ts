import crypto from "crypto";
import { buildAuthUrl, STATE_COOKIE } from "@/lib/googleAuth";
import { serverError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// ログイン開始。stateを発行してCookieに残し、Googleへ送る。
export async function GET(req: Request) {
  try {
    const state = crypto.randomUUID();
    const url = buildAuthUrl(req, state);

    const res = Response.redirect(url, 302);
    // Response.redirect はヘッダを後付けできないので作り直す
    const headers = new Headers(res.headers);
    headers.append(
      "Set-Cookie",
      [
        `${STATE_COOKIE}=${state}`,
        "Path=/",
        "HttpOnly",
        // Googleからの戻りは別サイトからの遷移になるため Strict では送られない
        "SameSite=Lax",
        "Max-Age=600",
        process.env.NODE_ENV === "production" ? "Secure" : "",
      ]
        .filter(Boolean)
        .join("; ")
    );
    return new Response(null, { status: 302, headers });
  } catch (e) {
    return serverError("GET /api/auth/google", e);
  }
}
