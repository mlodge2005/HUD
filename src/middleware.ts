import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require auth (and redirect to login if not authenticated)
const authPaths = ["/hud", "/admin", "/settings"];
const changePasswordPath = "/change-password";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const res = NextResponse.next();

  // Check cookie for session (we can't call getSessionFromCookie in edge - it uses Node APIs)
  // So we only do path-based redirects here; auth is enforced in server components and API
  const hasCookie = request.cookies.has("hud_session");

  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout")) {
    return res;
  }
  if (pathname === changePasswordPath) {
    return res;
  }
  if (pathname === "/login") {
    return res;
  }
  if (authPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!hasCookie) {
      const login = new URL("/login", request.url);
      login.searchParams.set("from", pathname);
      return NextResponse.redirect(login);
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: ["/hud", "/hud/:path*", "/admin", "/admin/:path*", "/settings", "/settings/:path*", "/login", "/change-password"],
};
