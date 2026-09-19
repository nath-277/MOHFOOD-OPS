import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import {
  getProductionOverview,
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrderStatus,
  recordWorkOrderYield,
  getEquipmentList,
  updateEquipmentStatus,
  WorkOrderStatus,
  getProductionShiftLogs,
  createProductionShiftLog,
  getShiftRequisitions,
  approveShiftRequisition,
} from "../../production/store";

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

    const orders = await getWorkOrders({ status, shift, search });
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
      recipeCode,
      recipeName,
      targetQuantity,
      shiftType = "MORNING_SHIFT",
      mixingTankId,
      mixingTankName,
      batchReference,
      notes,
    } = body;

    if (!recipeCode || !targetQuantity || Number(targetQuantity) <= 0) {
      return c.json({ error: "Recipe and target quantity (> 0) are required." }, 400);
    }

    const supervisor = user?.fullName || "David Adeleke (Supervisor)";

    const order = await createWorkOrder({
      recipeCode,
      recipeName: recipeName || recipeCode,
      targetQuantity: Number(targetQuantity),
      shiftType,
      mixingTankId: mixingTankId || "eq-01",
      mixingTankName: mixingTankName || "Jacketed Mixing Tank #1 (500L)",
      supervisorName: supervisor,
      batchReference,
      notes,
    });

    return c.json({
      success: true,
      workOrder: order,
      message: `Work Order ${order.orderNumber} scheduled for ${order.targetQuantity} units.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create work order." }, 400);
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

    const performer = user?.fullName || "David Adeleke (Supervisor)";
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
    const shift = (c.req.query("shift") as any) || "MORNING_SHIFT";

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

    const supervisor = user?.fullName || "David Adeleke (Production Supervisor)";

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
      powerStatus,
      equipmentNotes,
      outputSummary,
      incidents,
      handoverNotes,
    } = body;

    const supervisor = user?.fullName || "David Adeleke (Production Supervisor)";

    const log = await createProductionShiftLog({
      shiftDate,
      shiftType,
      supervisorId: user?.userId,
      supervisorName: supervisor,
      status,
      powerStatus,
      equipmentNotes,
      outputSummary,
      incidents,
      handoverNotes,
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

