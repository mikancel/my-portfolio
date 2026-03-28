import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || "change-this-to-a-long-random-secret-minimum-32chars",
  cookieName: "admin_session",
};

// admin.mikancel.com 配下を保護
export async function middleware(req) {
  const { pathname, hostname } = req.nextUrl;

  // admin ドメインかどうか確認
  const isAdminDomain =
    hostname === "admin.mikancel.com" ||
    (process.env.NODE_ENV === "development" && pathname.startsWith("/admin"));

  if (!isAdminDomain) return NextResponse.next();

  // ログイン・API系は通す
  const publicPaths = ["/admin/login", "/api/auth/"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // セッション確認
  try {
    const res = NextResponse.next();
    const session = await getIronSession(req, res, SESSION_OPTIONS);
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    return res;
  } catch {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/blog/:path*", "/api/upload"],
};
