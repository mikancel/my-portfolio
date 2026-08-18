import {
  exchangeCodeForUser,
  isAllowedEmail,
  STATE_COOKIE,
} from "@/lib/googleAuth";
import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { serverError } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// ログインページへ理由付きで戻す（画面側で日本語メッセージにする）
function back(req: Request, reason: string): Response {
  const url = new URL("/admin/login", new URL(req.url).origin);
  url.searchParams.set("error", reason);
  return Response.redirect(url.toString(), 302);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

const CLEAR_STATE = `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function GET(req: NextRequest) {
  try {
    const { ok } = rateLimit(`oauth:${clientIp(req)}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (!ok) return back(req, "rate_limited");

    const params = new URL(req.url).searchParams;
    if (params.get("error")) return back(req, "cancelled");

    const code = params.get("code");
    const state = params.get("state");
    const expectedState = readCookie(req, STATE_COOKIE);

    // stateが一致しない＝別サイトから仕込まれた可能性があるので中断する
    if (!code || !state || !expectedState || state !== expectedState) {
      return back(req, "invalid_state");
    }

    const user = await exchangeCodeForUser(req, code);
    if (!user) return back(req, "exchange_failed");
    if (!user.emailVerified) return back(req, "unverified");
    if (!isAllowedEmail(user.email)) return back(req, "forbidden");

    // ここではまだログイン成立とせず、TOTP入力へ回す（2要素目）。
    // isLoggedIn は /api/auth/mfa を通過して初めて true になる。
    const dest = new URL("/admin/mfa", new URL(req.url).origin);
    const res = NextResponse.redirect(dest, 302);
    res.headers.append("Set-Cookie", CLEAR_STATE);

    // リダイレクト応答にCookieを確実に載せるため、
    // cookies()経由ではなく req/res を直接渡す形式で保存する
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.isLoggedIn = false;
    session.pendingMfa = true;
    session.email = user.email;
    await session.save();

    return res;
  } catch (e) {
    return serverError("GET /api/auth/google/callback", e);
  }
}
