import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, AUTH_COOKIE_NAME } from "./server/auth/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets, next internals, and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  const isAuthRoute = pathname === "/login" || pathname === "/pin-lock";

  // 1. If accessing login/pin-lock while authenticated, redirect to dashboard
  if (isAuthRoute) {
    if (session) {
      const target =
        session.role === "SUPER_ADMIN"
          ? "/admin"
          : session.role === "EXECUTIVE" || session.departmentCode === "EXECUTIVE_MANAGEMENT"
          ? "/management"
          : "/inventory";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 2. Root route (/) -> redirect to dashboard or login
  if (pathname === "/") {
    if (session) {
      const target =
        session.role === "SUPER_ADMIN"
          ? "/admin"
          : session.role === "EXECUTIVE"
          ? "/management"
          : "/inventory";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Protected Dashboard Routes
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Role & Department Scoping Guards
  if (pathname.startsWith("/admin")) {
    if (session.role !== "SUPER_ADMIN") {
      const fallback = session.role === "EXECUTIVE" ? "/management" : "/inventory";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/management")) {
    if (session.role !== "SUPER_ADMIN" && session.role !== "EXECUTIVE") {
      return NextResponse.redirect(new URL("/inventory", request.url));
    }
  }

  if (pathname.startsWith("/inventory")) {
    const allowed = ["SUPER_ADMIN", "STORE_MANAGER", "STORE_OFFICER"];
    if (!allowed.includes(session.role)) {
      return NextResponse.redirect(new URL("/management", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
