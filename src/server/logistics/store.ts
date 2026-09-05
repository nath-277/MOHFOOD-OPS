// Moh Foods NG (MOH-OPS) - Cold-Chain Logistics & Fleet Dispatch Engine

import { eventBus } from "../events/eventBus";

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

export const INITIAL_RUNS: DeliveryRun[] = [
  {
    id: "run-01",
    dispatchNumber: "DSP-2026-0905-01",
    vehicleId: "veh-01",
    vehicleName: "Van 1 - Toyota HiAce (Refrigerated)",
    driverName: "Sunday Balogun",
    stops: [
      {
        stockistId: "stk-01",
        stockistName: "Hubmart Supermarket",
        location: "Ikeja GRA, Lagos",
        productCode: "REC-PARFAIT-400ML",
        productName: "Moh Yogurt Parfait (400ml Cup)",
        units: 150,
        status: "DELIVERED",
      },
      {
        stockistId: "stk-02",
        stockistName: "Prince Ebeano Supermarket",
        location: "Lekki Phase 1, Lagos",
        productCode: "REC-PARFAIT-400ML",
        productName: "Moh Yogurt Parfait (400ml Cup)",
        units: 120,
        status: "PENDING",
      },
    ],
    totalUnitsDispatched: 270,
    departureTime: "2026-09-05T08:30:00Z",
    estimatedReturn: "2026-09-05T15:00:00Z",
    status: "IN_TRANSIT",
    temperatureLogs: [
      { time: "08:30", tempCelsius: 2.5 },
      { time: "10:15", tempCelsius: 2.8 },
      { time: "12:00", tempCelsius: 3.1 },
    ],
    notes: "Ikeja drop completed at 10:15am. Moving on to Lekki corridor.",
    createdAt: "2026-09-05T08:00:00Z",
  },
  {
    id: "run-02",
    dispatchNumber: "DSP-2026-0904-01",
    vehicleId: "veh-02",
    vehicleName: "Van 2 - Ford Transit (Chilled Box)",
    driverName: "Ibrahim Musa",
    stops: [
      {
        stockistId: "stk-03",
        stockistName: "Justrite Superstore",
        location: "Magodo Shangisha, Lagos",
        productCode: "REC-GREEK-500G",
        productName: "Moh Greek Yogurt (500g Tub)",
        units: 120,
        status: "DELIVERED",
      },
    ],
    totalUnitsDispatched: 120,
    departureTime: "2026-09-04T09:00:00Z",
    estimatedReturn: "2026-09-04T13:30:00Z",
    status: "RETURNED_RECONCILED",
    temperatureLogs: [
      { time: "09:00", tempCelsius: 2.7 },
      { time: "11:00", tempCelsius: 3.0 },
      { time: "13:00", tempCelsius: 2.9 },
    ],
    notes: "Full payment received and handed over to Cashier.",
    createdAt: "2026-09-04T08:30:00Z",
  },
];

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
  const run = DELIVERY_RUNS.find((r) => r.id === id);
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
  const vehicle = FLEET_VEHICLES.find((v) => v.id === data.vehicleId);
  if (!vehicle) throw new Error(`Vehicle ${data.vehicleId} not found.`);

  const totalUnits = data.stops.reduce((acc, s) => acc + Number(s.units), 0);
  const now = new Date();

  const newRun: DeliveryRun = {
    id: `run-${Date.now()}`,
    dispatchNumber: `DSP-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${(DELIVERY_RUNS.length + 1).toString().padStart(2, "0")}`,
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
  const run = DELIVERY_RUNS.find((r) => r.id === id);
  if (!run) throw new Error(`Delivery run ${id} not found.`);

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

  await eventBus.publish(
    "LOGISTICS_DELIVERY_CONFIRMED",
    { runId: id, status: newStatus },
    performedBy,
    "LOGISTICS"
  );

  return run;
}

export async function getFleetVehicles() {
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
