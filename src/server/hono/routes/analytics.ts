import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { verifySession, AUTH_COOKIE_NAME } from "../../auth/session";
import {
  getStoreAnalyticsData,
  getProductionAnalyticsData,
  getFinancialAnalyticsData,
  getExecutiveAnalyticsData,
} from "../../analytics/store";
import { ShiftFilter } from "@/types/analytics";

export const analyticsRouter = new Hono();

async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

function parsePeriodParams(c: any) {
  const startDate = c.req.query("startDate") || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const endDate = c.req.query("endDate") || new Date().toISOString().slice(0, 10);
  const shiftType = (c.req.query("shiftType") || "ALL") as ShiftFilter;
  return { startDate, endDate, shiftType };
}

// 1. STORE ANALYTICS
analyticsRouter.get("/store", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized. Session required." }, 401);
  }

  const allowed = ["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT", "STORE_MANAGER", "PRODUCTION_SUPERVISOR"];
  if (!allowed.includes(user.role)) {
    return c.json({ error: "Insufficient permissions to view store analytics." }, 403);
  }

  try {
    const period = parsePeriodParams(c);
    const data = await getStoreAnalyticsData(period);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load store analytics." }, 500);
  }
});

// 2. PRODUCTION ANALYTICS
analyticsRouter.get("/production", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized. Session required." }, 401);
  }

  const allowed = ["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT", "PRODUCTION_SUPERVISOR", "STORE_MANAGER"];
  if (!allowed.includes(user.role)) {
    return c.json({ error: "Insufficient permissions to view production analytics." }, 403);
  }

  try {
    const period = parsePeriodParams(c);
    const data = await getProductionAnalyticsData(period);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load production analytics." }, 500);
  }
});

// 3. FINANCIAL ANALYTICS
analyticsRouter.get("/finance", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized. Session required." }, 401);
  }

  const allowed = ["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT"];
  if (!allowed.includes(user.role)) {
    return c.json({ error: "Insufficient permissions to view financial analytics." }, 403);
  }

  try {
    const period = parsePeriodParams(c);
    const data = await getFinancialAnalyticsData(period);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load financial analytics." }, 500);
  }
});

// 4. EXECUTIVE ANALYTICS
analyticsRouter.get("/executive", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized. Session required." }, 401);
  }

  const allowed = ["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT"];
  if (!allowed.includes(user.role)) {
    return c.json({ error: "Insufficient permissions to view executive analytics." }, 403);
  }

  try {
    const period = parsePeriodParams(c);
    const data = await getExecutiveAnalyticsData(period);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load executive analytics." }, 500);
  }
});
