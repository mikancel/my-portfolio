import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/lib/session";

const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production");
}

const SESSION_OPTIONS = {
  password: secret || "dev-only-insecure-session-secret-32chars!!",
  cookieName: "admin_session",
};

export async function proxy(req: NextRequest) {
  const { pathname, hostname } = req.nextUrl;

  // /adminへの直接アクセスをブロック（本番環境のみ）。
  // 空ボディの404だとブラウザが真っ白になるため、存在しないパスへrewriteして
  // サイトのnot-foundページ（404ステータス）を描画させる。
  if (
    process.env.NODE_ENV === "production" &&
    pathname.startsWith("/admin") &&
    hostname !== "admin.mikancel.com"
  ) {
    return NextResponse.rewrite(new URL("/_not-found", req.url));
  }

  const isAdminDomain =
    hostname === "admin.mikancel.com" ||
    (process.env.NODE_ENV === "development" && pathname.startsWith("/admin"));

  if (!isAdminDomain) return NextResponse.next();

  // _next静的ファイルとAPIは通す（APIは各routeで認証）
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ログインページは通す
  if (pathname === "/admin/login" || pathname === "/login") {
    return NextResponse.next();
  }

  try {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(req, res, SESSION_OPTIONS);
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return res;
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
