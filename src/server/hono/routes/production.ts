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
