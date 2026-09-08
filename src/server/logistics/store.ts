import { eventBus } from "../events/eventBus";
import { db, schema } from "../db";
import { eq, desc } from "drizzle-orm";


export interface FleetVehicle {
  id: string;
  plateNumber: string;
  vehicleName: string;
  driverName: string;
  driverPhone: string;
  coolingStatus: "NORMAL_CHILLED" | "WARNING_TEMP" | "DEFROST";
  currentTemp: number; // Celsius (ideal 2.0 - 4.0)
  targetTempRange: string;
  capacityUnits: number;
  status: "AVAILABLE" | "ON_DELIVERY_RUN" | "MAINTENANCE";
  lastInspection: string;
}

export interface DeliveryStop {
  stockistId: string;
  stockistName: string;
  location: string;
  productCode: string;
  productName: string;
  units: number;
  status: "PENDING" | "DELIVERED" | "RETURN_COLLECTED";
}

export interface DeliveryRun {
  id: string;
  dispatchNumber: string;
  vehicleId: string;
  vehicleName: string;
  driverName: string;
  stops: DeliveryStop[];
  totalUnitsDispatched: number;
  departureTime: string;
  estimatedReturn: string;
  status: "SCHEDULED" | "IN_TRANSIT" | "DELIVERED_COLLECTING" | "RETURNED_RECONCILED";
  temperatureLogs: { time: string; tempCelsius: number }[];
  notes?: string;
  createdAt: string;
}

// In-Memory Seed Data
export const INITIAL_FLEET: FleetVehicle[] = [
  {
    id: "veh-01",
    plateNumber: "KSF-821-AA",
    vehicleName: "Van 1 - Toyota HiAce (Refrigerated)",
    driverName: "Sunday Balogun",
    driverPhone: "+234 802 119 4488",
    coolingStatus: "NORMAL_CHILLED",
    currentTemp: 2.8,
    targetTempRange: "2.0°C – 4.0°C",
    capacityUnits: 500,
    status: "ON_DELIVERY_RUN",
    lastInspection: "2026-09-05T06:30:00Z",
  },
  {
    id: "veh-02",
    plateNumber: "EKY-304-XP",
    vehicleName: "Van 2 - Ford Transit (Chilled Box)",
    driverName: "Ibrahim Musa",
    driverPhone: "+234 813 552 9012",
    coolingStatus: "NORMAL_CHILLED",
    currentTemp: 3.2,
    targetTempRange: "2.0°C – 4.0°C",
    capacityUnits: 650,
    status: "AVAILABLE",
    lastInspection: "2026-09-05T07:00:00Z",
  },
  {
    id: "veh-03",
    plateNumber: "BDG-112-QC",
    vehicleName: "Trike 1 - Bajaj Cold Express",
    driverName: "Emmanuel Okon",
    driverPhone: "+234 818 776 2201",
    coolingStatus: "NORMAL_CHILLED",
    currentTemp: 3.5,
    targetTempRange: "2.0°C – 5.0°C",
    capacityUnits: 150,
    status: "AVAILABLE",
    lastInspection: "2026-09-04T17:00:00Z",
  },
];

export const INITIAL_RUNS: DeliveryRun[] = [];

let FLEET_VEHICLES: FleetVehicle[] = [...INITIAL_FLEET];
let DELIVERY_RUNS: DeliveryRun[] = [...INITIAL_RUNS];

// ==========================================
// STORE ENGINE API METHODS
// ==========================================

export async function getDeliveryRuns(params?: {
  status?: string;
  driver?: string;
  search?: string;
}) {
  if (db) {
    try {
      const runs = await db.select().from(schema.deliveryRuns).orderBy(desc(schema.deliveryRuns.departureTime));
      const stops = await db.select().from(schema.deliveryStops);

      let list: DeliveryRun[] = runs.map((r) => {
        const runStops = stops
          .filter((s) => s.runId === r.id)
          .map((s) => ({
            stockistId: s.stockistId,
            stockistName: s.stockistName,
            location: s.location,
            productCode: s.productCode,
            productName: s.productName,
            units: s.units,
            status: s.status as any,
          }));

        return {
          id: r.id,
          dispatchNumber: r.dispatchNumber,
          vehicleId: r.vehicleId || "",
          vehicleName: r.vehicleName,
          driverName: r.driverName,
          stops: runStops,
          totalUnitsDispatched: r.totalUnitsDispatched,
          departureTime: r.departureTime.toISOString(),
          estimatedReturn: r.estimatedReturn ? r.estimatedReturn.toISOString() : "",
          status: r.status as any,
          temperatureLogs: (r.temperatureLogs as any) || [],
          notes: r.notes || undefined,
          createdAt: r.createdAt.toISOString(),
        };
      });

      if (params?.status && params.status !== "ALL") {
        list = list.filter((r) => r.status === params.status);
      }
      if (params?.driver && params.driver !== "ALL") {
        list = list.filter((r) => r.driverName === params.driver);
      }
      if (params?.search) {
        const q = params.search.toLowerCase().trim();
        list = list.filter(
          (r) =>
            r.dispatchNumber.toLowerCase().includes(q) ||
            r.driverName.toLowerCase().includes(q) ||
            r.vehicleName.toLowerCase().includes(q) ||
            r.stops.some((s) => s.stockistName.toLowerCase().includes(q))
        );
      }
      return list;
    } catch (err) {
      console.error("DB error in getDeliveryRuns:", err);
    }
  }

  let list = [...DELIVERY_RUNS];

  if (params?.status && params.status !== "ALL") {
    list = list.filter((r) => r.status === params.status);
  }

  if (params?.driver && params.driver !== "ALL") {
    list = list.filter((r) => r.driverName === params.driver);
  }

  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (r) =>
        r.dispatchNumber.toLowerCase().includes(q) ||
        r.driverName.toLowerCase().includes(q) ||
        r.vehicleName.toLowerCase().includes(q) ||
        r.stops.some((s) => s.stockistName.toLowerCase().includes(q))
    );
  }

  return list;
}

export async function getDeliveryRunById(id: string) {
  const runs = await getDeliveryRuns();
  const run = runs.find((r) => r.id === id);
  if (!run) throw new Error(`Delivery run not found for ID: ${id}`);
  return run;
}

export async function createDeliveryRun(data: {
  vehicleId: string;
  driverName: string;
  stops: {
    stockistId: string;
    stockistName: string;
    location: string;
    productCode: string;
    productName: string;
    units: number;
  }[];
  departureTime?: string;
  notes?: string;
}) {
  const totalUnits = data.stops.reduce((acc, s) => acc + Number(s.units), 0);
  const now = new Date();
  const dispatchNum = `DSP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;

  if (db) {
    try {
      const v = await db.select().from(schema.fleetVehicles).where(eq(schema.fleetVehicles.id, data.vehicleId)).limit(1);
      const vehicleName = v[0]?.vehicleName || "Refrigerated Delivery Van";

      const inserted = await db.insert(schema.deliveryRuns).values({
        dispatchNumber: dispatchNum,
        vehicleId: v[0]?.id,
        vehicleName,
        driverName: data.driverName,
        totalUnitsDispatched: totalUnits,
        departureTime: data.departureTime ? new Date(data.departureTime) : now,
        estimatedReturn: new Date(now.getTime() + 6 * 3600000),
        status: "SCHEDULED",
        temperatureLogs: [{ time: now.toLocaleTimeString().slice(0, 5), tempCelsius: Number(v[0]?.currentTemp || 3.0) }],
        notes: data.notes?.trim(),
      }).returning();

      if (inserted.length > 0) {
        const runId = inserted[0].id;
        for (const stop of data.stops) {
          await db.insert(schema.deliveryStops).values({
            runId,
            stockistId: stop.stockistId,
            stockistName: stop.stockistName,
            location: stop.location,
            productCode: stop.productCode,
            productName: stop.productName,
            units: Number(stop.units),
            status: "PENDING",
          });
        }

        if (v[0]) {
          await db.update(schema.fleetVehicles).set({ status: "ON_DELIVERY_RUN" }).where(eq(schema.fleetVehicles.id, v[0].id));
        }

        const fullRun: DeliveryRun = {
          id: runId,
          dispatchNumber: dispatchNum,
          vehicleId: v[0]?.id || data.vehicleId,
          vehicleName,
          driverName: data.driverName,
          stops: data.stops.map((s) => ({ ...s, status: "PENDING" as const })),
          totalUnitsDispatched: totalUnits,
          departureTime: now.toISOString(),
          estimatedReturn: new Date(now.getTime() + 6 * 3600000).toISOString(),
          status: "SCHEDULED",
          temperatureLogs: [{ time: now.toLocaleTimeString().slice(0, 5), tempCelsius: Number(v[0]?.currentTemp || 3.0) }],
          notes: data.notes,
          createdAt: now.toISOString(),
        };

        await eventBus.publish(
          "LOGISTICS_RUN_DISPATCHED",
          fullRun,
          data.driverName,
          "LOGISTICS"
        );

        return fullRun;
      }
    } catch (err) {
      console.error("DB error in createDeliveryRun:", err);
    }
  }

  const vehicle = FLEET_VEHICLES.find((v) => v.id === data.vehicleId);
  if (!vehicle) throw new Error(`Vehicle ${data.vehicleId} not found.`);

  const newRun: DeliveryRun = {
    id: `run-${Date.now()}`,
    dispatchNumber: dispatchNum,
    vehicleId: vehicle.id,
    vehicleName: vehicle.vehicleName,
    driverName: data.driverName,
    stops: data.stops.map((s) => ({ ...s, status: "PENDING" })),
    totalUnitsDispatched: totalUnits,
    departureTime: data.departureTime || now.toISOString(),
    estimatedReturn: new Date(now.getTime() + 6 * 3600000).toISOString(),
    status: "SCHEDULED",
    temperatureLogs: [{ time: now.toLocaleTimeString().slice(0, 5), tempCelsius: vehicle.currentTemp }],
    notes: data.notes,
    createdAt: now.toISOString(),
  };

  DELIVERY_RUNS.unshift(newRun);
  vehicle.status = "ON_DELIVERY_RUN";

  await eventBus.publish(
    "LOGISTICS_RUN_DISPATCHED",
    newRun,
    data.driverName,
    "LOGISTICS"
  );

  return newRun;
}

export async function updateDeliveryRunStatus(
  id: string,
  newStatus: "SCHEDULED" | "IN_TRANSIT" | "DELIVERED_COLLECTING" | "RETURNED_RECONCILED",
  currentTemp?: number,
  performedBy = "Sunday Balogun (Logistics Officer)"
) {
  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        await db.update(schema.deliveryRuns)
          .set({ status: newStatus })
          .where(eq(schema.deliveryRuns.id, id));
      }
    } catch (e) {
      console.error("DB error in updateDeliveryRunStatus:", e);
    }
  }

  const run = DELIVERY_RUNS.find((r) => r.id === id);
  if (run) {
    run.status = newStatus;

    if (currentTemp !== undefined) {
      run.temperatureLogs.push({
        time: new Date().toLocaleTimeString().slice(0, 5),
        tempCelsius: currentTemp,
      });

      const vehicle = FLEET_VEHICLES.find((v) => v.id === run.vehicleId);
      if (vehicle) {
        vehicle.currentTemp = currentTemp;
        if (currentTemp > 4.5) {
          vehicle.coolingStatus = "WARNING_TEMP";
        } else {
          vehicle.coolingStatus = "NORMAL_CHILLED";
        }
      }
    }

    if (newStatus === "RETURNED_RECONCILED") {
      const vehicle = FLEET_VEHICLES.find((v) => v.id === run.vehicleId);
      if (vehicle) {
        vehicle.status = "AVAILABLE";
      }
    }
  }

  await eventBus.publish(
    "LOGISTICS_DELIVERY_CONFIRMED",
    { runId: id, status: newStatus },
    performedBy,
    "LOGISTICS"
  );

  if (run) return run;

  return {
    id,
    dispatchNumber: id,
    vehicleId: "",
    vehicleName: "Delivery Van",
    driverName: performedBy,
    stops: [],
    totalUnitsDispatched: 0,
    departureTime: new Date().toISOString(),
    status: newStatus,
    temperatureLogs: [],
    createdAt: new Date().toISOString(),
  };
}

export async function getFleetVehicles() {
  if (db) {
    try {
      const rows = await db.select().from(schema.fleetVehicles);
      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          vehicleName: r.vehicleName,
          licensePlate: r.plateNumber,
          driverName: r.driverName,
          driverPhone: r.driverPhone,
          coolingStatus: r.coolingStatus as "NORMAL_CHILLED" | "WARNING_TEMP" | "CRITICAL_FAULT",
          currentTemp: Number(r.currentTemp),
          targetTempRange: r.targetTempRange,
          capacityUnits: r.capacityUnits,
          status: r.status as "AVAILABLE" | "ON_DELIVERY_RUN" | "MAINTENANCE",
          lastInspection: r.lastInspection ? r.lastInspection.toISOString().slice(0, 10) : "",
        }));
      }
    } catch (e) {
      console.error("DB error in getFleetVehicles:", e);
    }
  }
  return FLEET_VEHICLES;
}

export async function updateVehicleTemp(id: string, tempCelsius: number) {
  const vehicle = FLEET_VEHICLES.find((v) => v.id === id);
  if (!vehicle) throw new Error(`Vehicle ${id} not found.`);

  vehicle.currentTemp = tempCelsius;
  if (tempCelsius > 4.5) {
    vehicle.coolingStatus = "WARNING_TEMP";
  } else {
    vehicle.coolingStatus = "NORMAL_CHILLED";
  }

  return vehicle;
}

export async function getLogisticsOverview() {
  const activeRuns = DELIVERY_RUNS.filter(
    (r) => r.status === "IN_TRANSIT" || r.status === "DELIVERED_COLLECTING"
  );
  const unitsInTransit = activeRuns.reduce((acc, r) => acc + r.totalUnitsDispatched, 0);
  const availableVehicles = FLEET_VEHICLES.filter((v) => v.status === "AVAILABLE").length;
  const compliantVehicles = FLEET_VEHICLES.filter(
    (v) => v.currentTemp >= 2.0 && v.currentTemp <= 4.0
  ).length;

  const complianceRate = Number(
    ((compliantVehicles / FLEET_VEHICLES.length) * 100).toFixed(0)
  );

  return {
    activeRunsCount: activeRuns.length,
    totalUnitsInTransit: unitsInTransit,
    availableVehiclesCount: availableVehicles,
    totalFleetCount: FLEET_VEHICLES.length,
    coldChainComplianceRate: complianceRate,
  };
}
