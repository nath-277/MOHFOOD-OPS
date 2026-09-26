import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "@/server/auth/session";
import { getUserNotificationState, updateUserNotificationState } from "@/server/notifications/store";

export const notificationsRouter = new Hono();

async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

notificationsRouter.get("/state", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userKey = user.staffId || user.userId || user.email || "anonymous";
  const state = await getUserNotificationState(userKey);
  return c.json({ success: true, state });
});

notificationsRouter.post("/state", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userKey = user.staffId || user.userId || user.email || "anonymous";
  const body = await c.req.json().catch(() => ({}));
  const state = await updateUserNotificationState(userKey, body);
  return c.json({ success: true, state });
});
