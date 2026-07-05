import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";

const secret = process.env.SESSION_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production");
}

const SESSION_OPTIONS = {
  password: secret || "dev-only-insecure-session-secret-32chars!!",
  cookieName: "admin_session",
};

export async function proxy(req) {
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
