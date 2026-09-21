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

  const isTerminalLocked = request.cookies.get("moh_terminal_locked")?.value === "true";

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production" ||
    process.env.NEXT_PUBLIC_HIDE_DEMO_ACCOUNTS === "true";

  const isLoginRoute = pathname === "/login";
  const isPinLockRoute = pathname === "/pin-lock";

  // 1. PIN Lock route: Strictly for unlocking active floor sessions
  // Unauthenticated users are restricted to email and password only
  if (isPinLockRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // 2. Terminal Lock Enforcement:
  // If the terminal is locked and session is preserved, prevent direct dashboard access
  // Do NOT intercept /login so users can always choose password login
  if (session && isTerminalLocked) {
    if (!isPinLockRoute && !isLoginRoute) {
      const lockUrl = new URL("/pin-lock", request.url);
      lockUrl.searchParams.set("locked", "true");
      if (pathname !== "/") {
        lockUrl.searchParams.set("returnTo", pathname);
      }
      return NextResponse.redirect(lockUrl);
    }
    return NextResponse.next();
  }

  // 3. If accessing /login while authenticated (and not locked), redirect to dashboard
  if (isLoginRoute) {
    if (session && !isTerminalLocked) {
      const target =
        session.role === "SUPER_ADMIN"
          ? (isProduction ? "/inventory" : "/admin")
          : session.role === "EXECUTIVE" || session.departmentCode === "EXECUTIVE_MANAGEMENT"
          ? (isProduction ? "/inventory" : "/management")
          : session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : session.role === "LOGISTICS_OFFICER"
          ? (isProduction ? "/inventory" : "/logistics")
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
          ? (isProduction ? "/inventory" : "/admin")
          : session.role === "EXECUTIVE" || session.departmentCode === "EXECUTIVE_MANAGEMENT"
          ? (isProduction ? "/inventory" : "/management")
          : session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : session.role === "LOGISTICS_OFFICER"
          ? (isProduction ? "/inventory" : "/logistics")
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

  // 4. Production Scoping: /inventory, /production, and /returns are active in Production
  if (isProduction) {
    const unreadyPrefixes = [
      "/admin",
      "/management",
      "/product-storage",
      "/logistics",
    ];
    if (unreadyPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.redirect(new URL("/inventory", request.url));
    }
  }

  // 5. Role & Department Scoping Guards
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
    const allowed = [
      "SUPER_ADMIN",
      "EXECUTIVE",
      "STORE_MANAGER",
      "ACCOUNTANT",
    ];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : session.role === "LOGISTICS_OFFICER"
          ? "/product-storage"
          : "/management";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/production")) {
    const allowed = [
      "SUPER_ADMIN",
      "EXECUTIVE",
      "PRODUCTION_SUPERVISOR",
      "ACCOUNTANT",
      "STORE_MANAGER",
    ];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "LOGISTICS_OFFICER"
          ? "/product-storage"
          : "/inventory";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/logistics")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "LOGISTICS_OFFICER", "STORE_MANAGER"];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : "/management";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/product-storage")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "PRODUCTION_SUPERVISOR", "LOGISTICS_OFFICER"];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : "/inventory";
      return NextResponse.redirect(new URL(fallback, request.url));
    }
  }

  if (pathname.startsWith("/returns")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "PRODUCTION_SUPERVISOR", "LOGISTICS_OFFICER"];
    if (!allowed.includes(session.role)) {
      const fallback =
        session.role === "PRODUCTION_SUPERVISOR"
          ? "/production"
          : "/inventory";
      return NextResponse.redirect(new URL(fallback, request.url));
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
