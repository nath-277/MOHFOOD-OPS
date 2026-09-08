import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import {
  getFinishedGoodsBatches,
  getFinishedGoodsBatchById,
  intakeFinishedGoodsBatch,
  transferToDispatchRider,
  getFinishedGoodsTransfers,
  getProductStorageOverview,
} from "../../product-storage/store";

export const productStorageRouter = new Hono();

async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// 1. OVERVIEW
productStorageRouter.get("/overview", async (c) => {
  try {
    const data = await getProductStorageOverview();
    return c.json({ success: true, ...data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load product storage overview." }, 500);
  }
});

// 2. BATCHES
productStorageRouter.get("/batches", async (c) => {
  try {
    const status = c.req.query("status");
    const search = c.req.query("search");
    const batches = await getFinishedGoodsBatches({ status, search });
    return c.json({ success: true, batches });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to fetch finished goods batches." }, 500);
  }
});

productStorageRouter.get("/batches/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const batch = await getFinishedGoodsBatchById(id);
    if (!batch) {
      return c.json({ error: "Batch not found" }, 404);
    }
    return c.json({ success: true, batch });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to fetch batch." }, 500);
  }
});

// 3. INTAKE FROM KITCHEN
productStorageRouter.post("/intake", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    if (!body.productCode || !body.productName || !body.quantity) {
      return c.json({ error: "Product code, name, and quantity are required." }, 400);
    }

    const performer = user?.fullName || body.supervisorName || "Cold Room Officer";

    const batch = await intakeFinishedGoodsBatch({
      productCode: body.productCode,
      productName: body.productName,
      quantity: Number(body.quantity),
      yieldUnit: body.yieldUnit || "cup",
      coldStorageBay: body.coldStorageBay,
      supervisorName: performer,
      currentTemp: body.currentTemp !== undefined ? Number(body.currentTemp) : undefined,
      shelfLifeDays: body.shelfLifeDays ? Number(body.shelfLifeDays) : 14,
      notes: body.notes,
    });

    return c.json({
      success: true,
      batch,
      message: `Batch ${batch.batchNumber} received into ${batch.coldStorageBay}.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to record finished goods intake." }, 400);
  }
});

// 4. DISPATCH HANDOVER TO RIDER
productStorageRouter.post("/dispatch", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();

    if (!body.batchId || !body.quantity || !body.driverName) {
      return c.json({ error: "Batch ID, quantity, and driver name are required." }, 400);
    }

    const performer = user?.fullName || body.performedByName || "Cold Room Dispatcher";

    const result = await transferToDispatchRider({
      batchId: body.batchId,
      quantity: Number(body.quantity),
      driverName: body.driverName,
      vehiclePlate: body.vehiclePlate,
      waybillNumber: body.waybillNumber,
      waybillPhotoUrl: body.waybillPhotoUrl,
      temperature: body.temperature !== undefined ? Number(body.temperature) : undefined,
      performedByName: performer,
      notes: body.notes,
    });

    return c.json({
      success: true,
      transfer: result.transfer,
      remainingUnits: result.remainingUnits,
      message: `Dispatched ${body.quantity} units to driver ${body.driverName}.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to process rider handover." }, 400);
  }
});

// 5. TRANSFERS LOG
productStorageRouter.get("/transfers", async (c) => {
  try {
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
    const transfers = await getFinishedGoodsTransfers(limit);
    return c.json({ success: true, transfers });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to fetch transfers log." }, 500);
  }
});
