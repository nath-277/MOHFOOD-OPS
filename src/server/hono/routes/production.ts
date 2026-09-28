import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import {
  getProductionOverview,
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  createWorkOrdersBatch,
  updateWorkOrder,
  deleteWorkOrder,
  updateWorkOrderStatus,
  recordWorkOrderYield,
  getEquipmentList,
  updateEquipmentStatus,
  WorkOrderStatus,
  getProductionShiftLogs,
  createProductionShiftLog,
  getShiftRequisitions,
  approveShiftRequisition,
  getProductionSettings,
  updateProductionSettings,
} from "../../production/store";
import { getDefaultSupervisorName } from "../../auth/store";
import { cleanStaffName } from "../../../lib/printUtils";

export const productionRouter = new Hono();

async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// 1. OVERVIEW
productionRouter.get("/overview", async (c) => {
  try {
    const data = await getProductionOverview();
    return c.json({ success: true, ...data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load production overview." }, 500);
  }
});

// 2. WORK ORDERS
productionRouter.get("/work-orders", async (c) => {
  try {
    const status = c.req.query("status");
    const shift = c.req.query("shift");
    const search = c.req.query("search");
    const recipeCode = c.req.query("recipeCode");
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    const orders = await getWorkOrders({ status, shift, search, recipeCode, startDate, endDate });
    return c.json({ success: true, workOrders: orders });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load work orders." }, 500);
  }
});

productionRouter.get("/work-orders/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const order = await getWorkOrderById(id);
    return c.json({ success: true, workOrder: order });
  } catch (err: any) {
    return c.json({ error: err.message || "Work order not found." }, 404);
  }
});

productionRouter.post("/work-orders", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const {
      recipes,
      recipeCode,
      recipeName,
      targetQuantity,
      shiftType = "MORNING_SHIFT",
      mixingTankId,
      mixingTankName,
      batchReference,
      scheduledDate,
      notes,
    } = body;

    const supervisor = user?.fullName ? cleanStaffName(user.fullName) : await getDefaultSupervisorName();
    const targetDate = scheduledDate || new Date().toISOString().slice(0, 10);
    const tankId = mixingTankId || "eq-01";
    const tankName = mixingTankName || "Production Floor";

    // Handle Multi-Recipe Scheduling
    if (recipes && Array.isArray(recipes) && recipes.length > 0) {
      const validRecipes = recipes.filter(
        (r: any) => r.recipeCode && Number(r.targetQuantity) > 0
      );
      if (validRecipes.length === 0) {
        return c.json({ error: "At least one valid recipe and target quantity (> 0) required." }, 400);
      }

      const createdOrders = await createWorkOrdersBatch({
        recipes: validRecipes.map((r: any) => ({
          recipeCode: r.recipeCode,
          recipeName: r.recipeName || r.recipeCode,
          targetQuantity: Number(r.targetQuantity),
        })),
        shiftType,
        mixingTankId: tankId,
        mixingTankName: tankName,
        supervisorName: supervisor,
        batchReference,
        scheduledDate: targetDate,
        notes,
      });

      return c.json({
        success: true,
        workOrders: createdOrders,
        workOrder: createdOrders[0],
        count: createdOrders.length,
        message: `Successfully scheduled ${createdOrders.length} recipe work orders.`,
      });
    }

    // Single Recipe Scheduling fallback
    if (!recipeCode || !targetQuantity || Number(targetQuantity) <= 0) {
      return c.json({ error: "Recipe and target quantity (> 0) are required." }, 400);
    }

    const order = await createWorkOrder({
      recipeCode,
      recipeName: recipeName || recipeCode,
      targetQuantity: Number(targetQuantity),
      shiftType,
      mixingTankId: tankId,
      mixingTankName: tankName,
      supervisorName: supervisor,
      batchReference,
      scheduledDate: targetDate,
      notes,
    });

    return c.json({
      success: true,
      workOrder: order,
      workOrders: [order],
      count: 1,
      message: `Work Order ${order.orderNumber} scheduled for ${order.targetQuantity} units.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create work order." }, 400);
  }
});

productionRouter.put("/work-orders/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const performer = user?.fullName ? cleanStaffName(user.fullName) : await getDefaultSupervisorName();

    const updated = await updateWorkOrder(id, body, performer);
    return c.json({
      success: true,
      workOrder: updated,
      message: "Work order updated successfully.",
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update work order." }, 400);
  }
});

productionRouter.delete("/work-orders/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const performer = user?.fullName ? cleanStaffName(user.fullName) : await getDefaultSupervisorName();

    await deleteWorkOrder(id, performer);
    return c.json({
      success: true,
      message: "Work order deleted successfully.",
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to delete work order." }, 400);
  }
});

// 3. ADVANCE STAGE
productionRouter.put("/work-orders/:id/status", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { status } = body;

    if (!status) {
      return c.json({ error: "New status is required." }, 400);
    }

    const performer = user?.fullName || "Production Operator";
    const updated = await updateWorkOrderStatus(id, status as WorkOrderStatus, performer);

    return c.json({
      success: true,
      workOrder: updated,
      message: `Work order moved to ${status}.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update status." }, 400);
  }
});

// 4. RECORD ACTUAL YIELD & SCRAP
productionRouter.put("/work-orders/:id/yield", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { actualYield, scrapQuantity = 0, notes } = body;

    if (actualYield === undefined || Number(actualYield) < 0) {
      return c.json({ error: "Actual yield must be a positive number." }, 400);
    }

    const performer = user?.fullName ? cleanStaffName(user.fullName) : await getDefaultSupervisorName();
    const updated = await recordWorkOrderYield(
      id,
      Number(actualYield),
      Number(scrapQuantity),
      notes,
      performer
    );

    return c.json({
      success: true,
      workOrder: updated,
      message: `Yield recorded: ${updated.actualYield} units finished (${updated.yieldEfficiency}% efficiency).`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record yield." }, 400);
  }
});

// 5. EQUIPMENT
productionRouter.get("/equipment", async (c) => {
  try {
    const equipment = await getEquipmentList();
    return c.json({ success: true, equipment });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load equipment." }, 500);
  }
});

productionRouter.put("/equipment/:id/status", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { status, temp } = body;

    const updated = await updateEquipmentStatus(id, status, temp);
    return c.json({ success: true, equipment: updated });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update equipment." }, 400);
  }
});

// 6. STORE REQUISITIONS FOR SUPERVISOR VETTING
productionRouter.get("/requisitions", async (c) => {
  try {
    const date = c.req.query("date") || new Date().toISOString().split("T")[0];
    const shift = (c.req.query("shift") as any) || "ALL";

    const requisitions = await getShiftRequisitions(date, shift);
    return c.json({ success: true, requisitions });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load requisitions." }, 500);
  }
});

productionRouter.post("/requisitions/:refId/approve", async (c) => {
  try {
    const refId = decodeURIComponent(c.req.param("refId"));
    const user = await getAuthUser(c);
    const body = await c.req.json().catch(() => ({}));
    const { shiftDate, shiftType = "MORNING_SHIFT", notes } = body;

    const supervisor = user?.fullName ? cleanStaffName(user.fullName) : await getDefaultSupervisorName();

    const result = await approveShiftRequisition({
      referenceId: refId,
      shiftDate: shiftDate || new Date().toISOString().split("T")[0],
      shiftType,
      supervisorName: supervisor,
      notes,
    });

    return c.json({
      success: true,
      approval: result.approval,
      message: `Requisition ${refId} vetted and approved digitally by ${supervisor}.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to approve requisition." }, 400);
  }
});

// 7. SHIFT OPERATIONS LOGS
productionRouter.get("/shift-logs", async (c) => {
  try {
    const date = c.req.query("date");
    const shift = c.req.query("shift");

    const logs = await getProductionShiftLogs({ date, shift });
    return c.json({ success: true, logs });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load shift logs." }, 500);
  }
});

productionRouter.post("/shift-logs", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const {
      shiftDate = new Date().toISOString().split("T")[0],
      shiftType = "MORNING_SHIFT",
      status = "OPTIMAL",
      notes,
      powerStatus,
      equipmentNotes,
      outputSummary,
      incidents,
      handoverNotes,
    } = body;

    const supervisor = user?.fullName ? cleanStaffName(user.fullName) : await getDefaultSupervisorName();

    const log = await createProductionShiftLog({
      shiftDate,
      shiftType,
      supervisorId: user?.userId,
      supervisorName: supervisor,
      status,
      notes: notes || handoverNotes || "",
      powerStatus,
      equipmentNotes,
      outputSummary,
      incidents,
      handoverNotes: notes || handoverNotes || "",
    });

    return c.json({
      success: true,
      log,
      message: `Shift operations log for ${shiftDate} (${shiftType}) recorded successfully.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record shift log." }, 400);
  }
});

// 8. PRODUCTION SETTINGS (CUSTOMIZABLE DAILY EXPECTED OUTPUT)
productionRouter.get("/settings", async (c) => {
  try {
    const settings = await getProductionSettings();
    return c.json({ success: true, settings });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load production settings." }, 500);
  }
});

productionRouter.patch("/settings", async (c) => {
  try {
    const user = await getAuthUser(c);
    // Allow SUPER_ADMIN, EXECUTIVE (CEO), and ACCOUNTANT to customize
    if (user && user.role !== "SUPER_ADMIN" && user.role !== "EXECUTIVE" && user.role !== "ACCOUNTANT") {
      return c.json({ error: "Only CEO, Accountant, and Admin can customize production targets." }, 403);
    }
    const body = await c.req.json();
    const { dailyTargetCapacity } = body;
    if (!dailyTargetCapacity || Number(dailyTargetCapacity) <= 0) {
      return c.json({ error: "Daily target capacity must be a positive number." }, 400);
    }
    const settings = await updateProductionSettings({
      dailyTargetCapacity: Number(dailyTargetCapacity),
      updatedBy: user?.fullName || "CEO / Admin",
    });
    return c.json({
      success: true,
      settings,
      message: `Daily expected output target updated to ${settings.dailyTargetCapacity} units.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update production settings." }, 400);
  }
});

