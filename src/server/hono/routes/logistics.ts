import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import {
  getLogisticsOverview,
  getDeliveryRuns,
  getDeliveryRunById,
  createDeliveryRun,
  updateDeliveryRunStatus,
  getFleetVehicles,
  updateVehicleTemp,
} from "../../logistics/store";

export const logisticsRouter = new Hono();

async function getAuthUser(c: any) {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) return null;
  return await verifySession(token);
}

// 1. OVERVIEW
logisticsRouter.get("/overview", async (c) => {
  try {
    const data = await getLogisticsOverview();
    return c.json({ success: true, ...data });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load logistics overview." }, 500);
  }
});

// 2. DELIVERY RUNS
logisticsRouter.get("/runs", async (c) => {
  try {
    const status = c.req.query("status");
    const driver = c.req.query("driver");
    const search = c.req.query("search");

    const runs = await getDeliveryRuns({ status, driver, search });
    return c.json({ success: true, runs });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load delivery runs." }, 500);
  }
});

logisticsRouter.get("/runs/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const run = await getDeliveryRunById(id);
    return c.json({ success: true, run });
  } catch (err: any) {
    return c.json({ error: err.message || "Delivery run not found." }, 404);
  }
});

logisticsRouter.post("/runs", async (c) => {
  try {
    const user = await getAuthUser(c);
    const body = await c.req.json();
    const { vehicleId, driverName, stops, departureTime, notes } = body;

    if (!vehicleId || !stops || !Array.isArray(stops) || stops.length === 0) {
      return c.json({ error: "Vehicle and at least one delivery stop are required." }, 400);
    }

    const driver = driverName || user?.fullName || "Sunday Balogun";

    const run = await createDeliveryRun({
      vehicleId,
      driverName: driver,
      stops,
      departureTime,
      notes,
    });

    return c.json({
      success: true,
      run,
      message: `Delivery run ${run.dispatchNumber} created with ${run.totalUnitsDispatched} units dispatched.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to create delivery run." }, 400);
  }
});

// 3. ADVANCE STATUS / UPDATE TEMPERATURE
logisticsRouter.put("/runs/:id/status", async (c) => {
  try {
    const user = await getAuthUser(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    const { status, currentTemp } = body;

    if (!status) {
      return c.json({ error: "New run status is required." }, 400);
    }

    const performer = user?.fullName || "Logistics Dispatcher";
    const updated = await updateDeliveryRunStatus(
      id,
      status,
      currentTemp !== undefined ? Number(currentTemp) : undefined,
      performer
    );

    return c.json({
      success: true,
      run: updated,
      message: `Delivery run ${updated.dispatchNumber} updated to ${status}.`,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update run status." }, 400);
  }
});

// 4. FLEET
logisticsRouter.get("/fleet", async (c) => {
  try {
    const fleet = await getFleetVehicles();
    return c.json({ success: true, fleet });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to load fleet." }, 500);
  }
});

logisticsRouter.put("/fleet/:id/temperature", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { temp } = body;

    if (temp === undefined) {
      return c.json({ error: "Temperature value in Celsius is required." }, 400);
    }

    const vehicle = await updateVehicleTemp(id, Number(temp));
    return c.json({ success: true, vehicle });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update vehicle temperature." }, 400);
  }
});
