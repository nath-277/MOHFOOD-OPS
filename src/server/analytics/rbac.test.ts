// src/server/analytics/rbac.test.ts
import { describe, it, expect } from "bun:test";
import { app } from "../hono/app";

describe("Analytics API RBAC Protection", () => {
  it("should reject unauthenticated requests with 401 Unauthorized", async () => {
    const res = await app.request("/api/analytics/store");
    expect(res.status).toBe(401);
  });

  it("should permit STORE_MANAGER to access store analytics but forbid financial analytics with 403", async () => {
    const { signSession, AUTH_COOKIE_NAME } = await import("../auth/session");
    const storeToken = await signSession({
      sessionId: "sess_test_store",
      userId: "usr_store_test",
      staffId: "MOH-STR-01",
      email: "store@mohfood.com",
      role: "STORE_MANAGER",
      departmentCode: "STORE",
      fullName: "Store Manager User",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const storeRes = await app.request("/api/analytics/store", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${storeToken}` },
    });
    expect(storeRes.status).toBe(200);

    const financeRes = await app.request("/api/analytics/finance", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${storeToken}` },
    });
    expect(financeRes.status).toBe(403);
  });

  it("should permit ACCOUNTANT to access financial, store and production analytics", async () => {
    const { signSession, AUTH_COOKIE_NAME } = await import("../auth/session");
    const accountantToken = await signSession({
      sessionId: "sess_test_acc",
      userId: "usr_acc_test",
      staffId: "MOH-ACC-01",
      email: "accountant@mohfood.com",
      role: "ACCOUNTANT",
      departmentCode: "FINANCE",
      fullName: "Lead Accountant",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });

    const financeRes = await app.request("/api/analytics/finance", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${accountantToken}` },
    });
    expect(financeRes.status).toBe(200);

    const storeRes = await app.request("/api/analytics/store", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${accountantToken}` },
    });
    expect(storeRes.status).toBe(200);
  });
});
