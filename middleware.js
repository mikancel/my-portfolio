import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || "change-this-to-a-long-random-secret-minimum-32chars",
  cookieName: "admin_session",
};

export async function middleware(req) {
  const { pathname, hostname } = req.nextUrl;

  // /adminへの直接アクセスをブロック（本番環境のみ）
  if (
    process.env.NODE_ENV === "production" &&
    pathname.startsWith("/admin") &&
    hostname !== "admin.mikancel.com"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const isAdminDomain =
    hostname === "admin.mikancel.com" ||
    (process.env.NODE_ENV === "development" && pathname.startsWith("/admin"));

  if (!isAdminDomain) return NextResponse.next();

  // _next静的ファイルは通す
  if (pathname.startsWith("/_next") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ログインページは通す
  if (pathname === "/admin/login" || pathname === "/login") {
    return NextResponse.next();
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};