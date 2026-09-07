import { Hono } from "hono";
import { eventBus } from "@/server/events/eventBus";

export const adminRouter = new Hono();

// GET /api/admin/audit-logs
adminRouter.get("/audit-logs", async (c) => {
  try {
    const department = c.req.query("department");
    const search = c.req.query("search")?.toLowerCase().trim();
    const type = c.req.query("type");
    const limit = parseInt(c.req.query("limit") || "100", 10);

    let events = eventBus.getRecentEvents(
      limit * 2,
      department && department !== "ALL" ? department : undefined
    );

    if (type && type !== "ALL") {
      events = events.filter((e) => e.type === type);
    }

    if (search) {
      events = events.filter((e) => {
        const performer = (e.performerName || "").toLowerCase();
        const dept = (e.departmentCode || "").toLowerCase();
        const evtType = (e.type || "").toLowerCase();
        const payloadStr = JSON.stringify(e.payload || {}).toLowerCase();
        return (
          performer.includes(search) ||
          dept.includes(search) ||
          evtType.includes(search) ||
          payloadStr.includes(search)
        );
      });
    }

    const slicedEvents = events.slice(0, limit);

    return c.json({
      success: true,
      totalCount: slicedEvents.length,
      events: slicedEvents,
    });
  } catch (err: any) {
    console.error("Error fetching audit logs:", err);
    return c.json(
      {
        success: false,
        error: "Failed to retrieve audit logs.",
        message: err?.message,
      },
      500
    );
  }
});
