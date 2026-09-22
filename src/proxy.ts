import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, signSession, AUTH_COOKIE_NAME } from "./server/auth/session";

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "EXECUTIVE",
  "STORE_MANAGER",
  "PRODUCTION_SUPERVISOR",
  "LOGISTICS_OFFICER",
  "ACCOUNTANT",
  "STAFF",
] as const;

function isLegacyStoreOfficerToken(token: string): boolean {
  try {
    const [dataB64] = token.split(".");
    if (!dataB64) return false;
    const json = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf-8"));
    return json.role === "STORE_OFFICER";
  } catch {
    return false;
  }
}

function getAuthorizedDashboard(role: string, departmentCode: string, isProduction: boolean): string {
  switch (role) {
    case "SUPER_ADMIN":
      return isProduction ? "/inventory" : "/admin";
    case "EXECUTIVE":
      return isProduction ? "/inventory" : "/management";
    case "PRODUCTION_SUPERVISOR":
      return "/production";
    case "LOGISTICS_OFFICER":
      return isProduction ? "/inventory" : "/logistics";
    case "STORE_MANAGER":
    case "ACCOUNTANT":
    case "STAFF":
      return "/inventory";
    default:
      if (departmentCode === "EXECUTIVE_MANAGEMENT") {
        return isProduction ? "/inventory" : "/management";
      }
      if (departmentCode === "PRODUCTION") {
        return "/production";
      }
      return "/inventory";
  }
}

function withRefreshedCookie(response: NextResponse, refreshedToken: string | null): NextResponse {
  if (refreshedToken) {
    response.cookies.set(AUTH_COOKIE_NAME, refreshedToken, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}

function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(AUTH_COOKIE_NAME);
  response.cookies.delete("moh_terminal_locked");
  return response;
}

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

  // Seamlessly detect if the token still had the retired STORE_OFFICER role in raw cookie
  let refreshedToken: string | null = null;
  if (token && session && isLegacyStoreOfficerToken(token)) {
    refreshedToken = await signSession(session);
  }

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
    return withRefreshedCookie(NextResponse.next(), refreshedToken);
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
      return withRefreshedCookie(NextResponse.redirect(lockUrl), refreshedToken);
    }
    return withRefreshedCookie(NextResponse.next(), refreshedToken);
  }

  // 3. Login Route Handling
  if (isLoginRoute) {
    // If the user visits /login with ?logout=true, ?force=true, ?expired=true, or ?clear=true:
    // Clear cookies and allow them to view login screen cleanly
    if (
      request.nextUrl.searchParams.has("logout") ||
      request.nextUrl.searchParams.has("force") ||
      request.nextUrl.searchParams.has("expired") ||
      request.nextUrl.searchParams.has("clear")
    ) {
      return clearAuthCookies(NextResponse.next());
    }

    if (session && !isTerminalLocked) {
      const target = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      return withRefreshedCookie(NextResponse.redirect(new URL(target, request.url)), refreshedToken);
    }
    return NextResponse.next();
  }

  // 4. Root route (/) -> redirect to dashboard or login
  if (pathname === "/") {
    if (session) {
      const target = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      return withRefreshedCookie(NextResponse.redirect(new URL(target, request.url)), refreshedToken);
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Protected Dashboard Routes: Require session
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return clearAuthCookies(NextResponse.redirect(loginUrl));
  }

  // 6. Role Validation Guard: If session has an unrecognized role, invalidate to prevent loops
  if (!ALLOWED_ROLES.includes(session.role as any)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("expired", "true");
    return clearAuthCookies(NextResponse.redirect(loginUrl));
  }

  // 7. Production Scoping: /inventory, /production, and /returns are active in Production
  if (isProduction) {
    const unreadyPrefixes = [
      "/admin",
      "/management",
      "/product-storage",
      "/logistics",
    ];
    if (unreadyPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return withRefreshedCookie(NextResponse.redirect(new URL("/inventory", request.url)), refreshedToken);
    }
  }

  // 8. Role & Department Scoping Guards (with safe fallbacks to prevent circular loops)
  if (pathname.startsWith("/admin")) {
    if (session.role !== "SUPER_ADMIN") {
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      const safeTarget = fallback.startsWith("/admin") ? "/inventory" : fallback;
      return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
    }
  }

  if (pathname.startsWith("/management")) {
    if (session.role !== "SUPER_ADMIN" && session.role !== "EXECUTIVE") {
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      const safeTarget = fallback.startsWith("/management") ? "/inventory" : fallback;
      return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
    }
  }

  if (pathname.startsWith("/inventory")) {
    const allowed = [
      "SUPER_ADMIN",
      "EXECUTIVE",
      "STORE_MANAGER",
      "ACCOUNTANT",
      "STAFF",
    ];
    if (!allowed.includes(session.role)) {
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      if (fallback.startsWith("/inventory") || fallback === pathname) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("expired", "true");
        return clearAuthCookies(NextResponse.redirect(loginUrl));
      }
      return withRefreshedCookie(NextResponse.redirect(new URL(fallback, request.url)), refreshedToken);
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
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      const safeTarget = fallback.startsWith("/production") ? "/inventory" : fallback;
      return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
    }
  }

  if (pathname.startsWith("/logistics")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "LOGISTICS_OFFICER", "STORE_MANAGER"];
    if (!allowed.includes(session.role)) {
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      const safeTarget = fallback.startsWith("/logistics") ? "/inventory" : fallback;
      return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
    }
  }

  if (pathname.startsWith("/product-storage")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "PRODUCTION_SUPERVISOR", "LOGISTICS_OFFICER"];
    if (!allowed.includes(session.role)) {
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      const safeTarget = fallback.startsWith("/product-storage") ? "/inventory" : fallback;
      return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
    }
  }

  if (pathname.startsWith("/returns")) {
    const allowed = ["SUPER_ADMIN", "EXECUTIVE", "STORE_MANAGER", "PRODUCTION_SUPERVISOR", "LOGISTICS_OFFICER"];
    if (!allowed.includes(session.role)) {
      const fallback = getAuthorizedDashboard(session.role, session.departmentCode, isProduction);
      const safeTarget = fallback.startsWith("/returns") ? "/inventory" : fallback;
      return withRefreshedCookie(NextResponse.redirect(new URL(safeTarget, request.url)), refreshedToken);
    }
  }

  return withRefreshedCookie(NextResponse.next(), refreshedToken);
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
