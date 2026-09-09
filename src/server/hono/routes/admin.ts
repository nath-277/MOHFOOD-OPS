import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import { eventBus } from "@/server/events/eventBus";
import {
  getAllUsers,
  createStaffAccount,
  updateStaffStatus,
  deleteStaffAccount,
} from "../../auth/store";

export const adminRouter = new Hono();

// Helper to extract authenticated user
async function getAdminUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// 1. GET ALL STAFF
adminRouter.get("/staff", async (c) => {
  try {
    const staff = await getAllUsers(true);
    return c.json({ success: true, staff, users: staff });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to retrieve staff list." }, 500);
  }
});

// 2. CREATE NEW STAFF ACCOUNT
adminRouter.post("/staff", async (c) => {
  try {
    const user = await getAdminUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized. Please log in as an administrator." }, 401);
    }
    if (user.role !== "SUPER_ADMIN" && user.role !== "EXECUTIVE") {
      return c.json({ error: "Access denied. Only Super Admins and Executives can create staff accounts." }, 403);
    }

    const body = await c.req.json();
    const { staffId, fullName, email, password, role, departmentCode, phone, pin } = body;

    if (!staffId || !fullName || !email) {
      return c.json({ error: "Staff ID, Full Name, and Email are required." }, 400);
    }

    const created = await createStaffAccount({
      staffId,
      fullName,
      email,
      password,
      role: role || "STORE_OFFICER",
      departmentCode: departmentCode || "INVENTORY_STORE",
      phone,
      pin,
    });

    eventBus.publish(
      "STAFF_ACCOUNT_CREATED",
      {
        action: "STAFF_CREATED",
        staffId: created.staffId,
        fullName: created.fullName,
        role: created.role,
        email: created.email,
      },
      user.fullName,
      "ADMIN"
    );

    return c.json({
      success: true,
      staff: created,
      message: `Staff account for ${created.fullName} (${created.staffId}) created successfully.`,
    }, 201);
  } catch (err: any) {
    console.error("Failed to create staff account:", err);
    return c.json({ error: err.message || "Failed to create staff account." }, 400);
  }
});

// 3. TOGGLE STAFF STATUS (ACTIVE/INACTIVE)
adminRouter.patch("/staff/:id/status", async (c) => {
  try {
    const user = await getAdminUser(c);
    if (!user) return c.json({ error: "Unauthorized." }, 401);
    if (user.role !== "SUPER_ADMIN" && user.role !== "EXECUTIVE") {
      return c.json({ error: "Access denied." }, 403);
    }

    const id = c.req.param("id");
    const body = await c.req.json();
    await updateStaffStatus(id, Boolean(body.isActive));

    return c.json({ success: true, message: "Staff status updated successfully." });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update staff status." }, 400);
  }
});

// 4. DEACTIVATE STAFF ACCOUNT
adminRouter.delete("/staff/:id", async (c) => {
  try {
    const user = await getAdminUser(c);
    if (!user) return c.json({ error: "Unauthorized." }, 401);
    if (user.role !== "SUPER_ADMIN" && user.role !== "EXECUTIVE") {
      return c.json({ error: "Access denied." }, 403);
    }

    const id = c.req.param("id");
    await deleteStaffAccount(id);

    return c.json({ success: true, message: "Staff account deactivated successfully." });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to deactivate staff account." }, 400);
  }
});

// 5. GET AUDIT LOGS
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
