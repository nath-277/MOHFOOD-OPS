import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import { eventBus } from "@/server/events/eventBus";
import {
  getAllUsers,
  createStaffAccount,
  updateStaffAccount,
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
      role: role || "STORE_MANAGER",
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

// 3. EDIT STAFF ACCOUNT
adminRouter.put("/staff/:id", async (c) => {
  try {
    const user = await getAdminUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized. Please log in as an administrator." }, 401);
    }
    if (user.role !== "SUPER_ADMIN" && user.role !== "EXECUTIVE") {
      return c.json({ error: "Access denied. Only Super Admins and Executives can edit staff accounts." }, 403);
    }

    const id = c.req.param("id");
    const body = await c.req.json();

    const updated = await updateStaffAccount(id, body);

    eventBus.publish(
      "STAFF_ACCOUNT_UPDATED",
      {
        action: "STAFF_UPDATED",
        staffId: updated.staffId,
        fullName: updated.fullName,
        role: updated.role,
        email: updated.email,
        updatedFields: Object.keys(body),
      },
      user.fullName,
      "ADMIN"
    );

    return c.json({
      success: true,
      staff: updated,
      message: `Staff account for ${updated.fullName} (${updated.staffId}) updated successfully.`,
    });
  } catch (err: any) {
    console.error("Failed to update staff account:", err);
    return c.json({ error: err.message || "Failed to update staff account." }, 400);
  }
});

// 4. TOGGLE STAFF STATUS (ACTIVE/INACTIVE)
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

// 5. DELETE STAFF ACCOUNT (PERMANENT REMOVAL OR SOFT DEACTIVATION)
adminRouter.delete("/staff/:id", async (c) => {
  try {
    const user = await getAdminUser(c);
    if (!user) return c.json({ error: "Unauthorized." }, 401);
    if (user.role !== "SUPER_ADMIN" && user.role !== "EXECUTIVE") {
      return c.json({ error: "Access denied." }, 403);
    }

    const id = c.req.param("id");
    const isPermanent = c.req.query("permanent") !== "false"; // Defaults to true for admin delete

    await deleteStaffAccount(id, { permanent: isPermanent });

    eventBus.publish(
      "STAFF_ACCOUNT_DELETED",
      {
        action: isPermanent ? "STAFF_PERMANENTLY_DELETED" : "STAFF_DEACTIVATED",
        userId: id,
      },
      user.fullName,
      "ADMIN"
    );

    return c.json({
      success: true,
      message: isPermanent ? "Staff account permanently deleted." : "Staff account deactivated successfully.",
    });
  } catch (err: any) {
    console.error("Failed to delete staff account:", err);
    return c.json({ error: err.message || "Failed to delete staff account." }, 400);
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
