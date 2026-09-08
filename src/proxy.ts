import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, AUTH_COOKIE_NAME } from "./server/auth/session";

export async function proxy(request: NextRequest) {
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

  const isLoginRoute = pathname === "/login";
  const isPinLockRoute = pathname === "/pin-lock";

  // 1. If accessing /login while authenticated, redirect to dashboard
  if (isLoginRoute) {
    if (session) {
      const target =
        session.role === "SUPER_ADMIN"
          ? "/admin"
          : session.role === "EXECUTIVE" || session.departmentCode === "EXECUTIVE_MANAGEMENT"
          ? "/management"
          : session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : session.role === "LOGISTICS_OFFICER"
          ? "/logistics"
          : "/inventory";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 2. Allow /pin-lock to load always (both for 4-digit PIN login and terminal lock)
  if (isPinLockRoute) {
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
          : session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : session.role === "LOGISTICS_OFFICER"
          ? "/logistics"
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
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "STORE_OFFICER"];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : session.role === "LOGISTICS_OFFICER"
          ? "/logistics"
          : "/management";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/production")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "PRODUCTION_SUPERVISOR"];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "LOGISTICS_OFFICER"
          ? "/logistics"
          : session.role === "STORE_MANAGER" || session.role === "STORE_OFFICER"
          ? "/inventory"
          : "/management";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/logistics")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "LOGISTICS_OFFICER", "STORE_MANAGER", "STORE_OFFICER"];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : "/management";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/product-storage")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "STORE_OFFICER", "PRODUCTION_SUPERVISOR", "LOGISTICS_OFFICER"];
    if (!allowed.includes(session.role)) {
      return NextResponse.redirect(new URL("/inventory", request.url));
    }
  }

  if (pathname.startsWith("/returns")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "STORE_OFFICER", "PRODUCTION_SUPERVISOR", "LOGISTICS_OFFICER"];
    if (!allowed.includes(session.role)) {
      return NextResponse.redirect(new URL("/inventory", request.url));
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
