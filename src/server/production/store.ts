// Moh Foods NG (MOH-OPS) - Production Mixing & Yield Tracking Engine

import { eventBus } from "../events/eventBus";

export type WorkOrderStatus =
  | "SCHEDULED"
  | "MIXING"
  | "PACKAGING"
  | "QUALITY_PASSED"
  | "COMPLETED"
  | "CANCELLED";

export interface WorkOrder {
  id: string;
  orderNumber: string;
  recipeCode: string;
  recipeName: string;
  targetQuantity: number;
  actualYield: number;
  scrapQuantity: number;
  yieldEfficiency: number; // percentage (e.g. 98.6)
  status: WorkOrderStatus;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  mixingTankId: string;
  mixingTankName: string;
  supervisorName: string;
  batchReference?: string;
  scheduledDate: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface EquipmentItem {
  id: string;
  code: string;
  name: string;
  type: "MIXING_TANK" | "PASTEURIZER" | "SEALER" | "BLAST_CHILLER";
  status: "RUNNING" | "IDLE" | "MAINTENANCE" | "CLEANING_CIP";
  currentTemp?: number; // Celsius
  targetTemp?: number;
  assignedOperator: string;
  lastCleaned: string;
}

// In-Memory Seed Data
export const INITIAL_EQUIPMENT: EquipmentItem[] = [
  {
    id: "eq-01",
    code: "EQ-MIX-01",
    name: "Jacketed Mixing Tank #1 (500L)",
    type: "MIXING_TANK",
    status: "RUNNING",
    currentTemp: 18.5,
    targetTemp: 18.0,
    assignedOperator: "David Adeleke (Supervisor)",
    lastCleaned: "2026-09-05T06:00:00Z",
  },
  {
    id: "eq-02",
    code: "EQ-PST-01",
    name: "Industrial Milk Pasteurizer #1",
    type: "PASTEURIZER",
    status: "IDLE",
    currentTemp: 72.0,
    targetTemp: 72.0,
    assignedOperator: "Emmanuel Udoh (Lead Tech)",
    lastCleaned: "2026-09-04T18:00:00Z",
  },
  {
    id: "eq-03",
    code: "EQ-SEAL-01",
    name: "Rotary Cup Sealer & Dome Capper",
    type: "SEALER",
    status: "RUNNING",
    assignedOperator: "Grace Danjuma (Packaging Tech)",
    lastCleaned: "2026-09-05T07:30:00Z",
  },
  {
    id: "eq-04",
    code: "EQ-CHILL-01",
    name: "Rapid Blast Chiller Room (4°C)",
    type: "BLAST_CHILLER",
    status: "RUNNING",
    currentTemp: 3.8,
    targetTemp: 4.0,
    assignedOperator: "David Adeleke (Supervisor)",
    lastCleaned: "2026-09-05T05:00:00Z",
  },
];

export const INITIAL_WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-101",
    orderNumber: "WO-2026-0905-01",
    recipeCode: "REC-PARFAIT-400ML",
    recipeName: "Moh Yogurt Parfait (400ml Cup)",
    targetQuantity: 300,
    actualYield: 295,
    scrapQuantity: 5,
    yieldEfficiency: 98.3,
    status: "COMPLETED",
    shiftType: "MORNING_SHIFT",
    mixingTankId: "eq-01",
    mixingTankName: "Jacketed Mixing Tank #1 (500L)",
    supervisorName: "David Adeleke (Production Supervisor)",
    batchReference: "BATCH-PRF-0902-A",
    scheduledDate: "2026-09-05",
    startedAt: "2026-09-05T08:30:00Z",
    completedAt: "2026-09-05T12:45:00Z",
    notes: "High quality curdling. 5 cracked lids scrapped during capper calibration.",
  },
  {
    id: "wo-102",
    orderNumber: "WO-2026-0905-02",
    recipeCode: "REC-GREEK-500G",
    recipeName: "Moh Greek Yogurt (500g Tub)",
    targetQuantity: 200,
    actualYield: 0,
    scrapQuantity: 0,
    yieldEfficiency: 0,
    status: "MIXING",
    shiftType: "MORNING_SHIFT",
    mixingTankId: "eq-01",
    mixingTankName: "Jacketed Mixing Tank #1 (500L)",
    supervisorName: "David Adeleke (Production Supervisor)",
    batchReference: "BATCH-GRK-0905-B",
    scheduledDate: "2026-09-05",
    startedAt: "2026-09-05T13:00:00Z",
    notes: "Active batch in fermenting stage. Target strain density 10^8 CFU/g.",
  },
  {
    id: "wo-103",
    orderNumber: "WO-2026-0905-03",
    recipeCode: "REC-DRINK-350ML",
    recipeName: "Moh Vanilla Yogurt Drink (350ml Bottle)",
    targetQuantity: 250,
    actualYield: 0,
    scrapQuantity: 0,
    yieldEfficiency: 0,
    status: "SCHEDULED",
    shiftType: "NIGHT_SHIFT",
    mixingTankId: "eq-02",
    mixingTankName: "Industrial Milk Pasteurizer #1",
    supervisorName: "David Adeleke (Production Supervisor)",
    scheduledDate: "2026-09-05",
    notes: "Pre-scheduled for night shift pasteurization and bottling.",
  },
  {
    id: "wo-104",
    orderNumber: "WO-2026-0904-01",
    recipeCode: "REC-COCONUT-250ML",
    recipeName: "Moh Pure Coconut Oil (250ml Glass)",
    targetQuantity: 100,
    actualYield: 99,
    scrapQuantity: 1,
    yieldEfficiency: 99.0,
    status: "COMPLETED",
    shiftType: "NIGHT_SHIFT",
    mixingTankId: "eq-01",
    mixingTankName: "Cold Press Extraction Unit",
    supervisorName: "David Adeleke (Production Supervisor)",
    batchReference: "BATCH-CCN-0904-A",
    scheduledDate: "2026-09-04",
    startedAt: "2026-09-04T19:00:00Z",
    completedAt: "2026-09-04T23:30:00Z",
    notes: "First cold press run, pristine clarity.",
  },
];

let WORK_ORDERS: WorkOrder[] = [...INITIAL_WORK_ORDERS];
let EQUIPMENT: EquipmentItem[] = [...INITIAL_EQUIPMENT];

// ==========================================
// STORE ENGINE API METHODS
// ==========================================

export async function getWorkOrders(params?: {
  status?: string;
  shift?: string;
  search?: string;
}) {
  let list = [...WORK_ORDERS];

  if (params?.status && params.status !== "ALL") {
    list = list.filter((wo) => wo.status === params.status);
  }

  if (params?.shift && params.shift !== "ALL") {
    list = list.filter((wo) => wo.shiftType === params.shift);
  }

  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (wo) =>
        wo.orderNumber.toLowerCase().includes(q) ||
        wo.recipeName.toLowerCase().includes(q) ||
        wo.recipeCode.toLowerCase().includes(q) ||
        (wo.batchReference && wo.batchReference.toLowerCase().includes(q))
    );
  }

  return list;
}

export async function getWorkOrderById(id: string) {
  const wo = WORK_ORDERS.find((w) => w.id === id);
  if (!wo) throw new Error(`Work order not found for ID: ${id}`);
  return wo;
}

export async function createWorkOrder(data: {
  recipeCode: string;
  recipeName: string;
  targetQuantity: number;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  mixingTankId: string;
  mixingTankName: string;
  supervisorName: string;
  batchReference?: string;
  scheduledDate?: string;
  notes?: string;
}) {
  const newOrder: WorkOrder = {
    id: `wo-${Date.now()}`,
    orderNumber: `WO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${(WORK_ORDERS.length + 1).toString().padStart(2, "0")}`,
    recipeCode: data.recipeCode,
    recipeName: data.recipeName,
    targetQuantity: Number(data.targetQuantity),
    actualYield: 0,
    scrapQuantity: 0,
    yieldEfficiency: 0,
    status: "SCHEDULED",
    shiftType: data.shiftType,
    mixingTankId: data.mixingTankId,
    mixingTankName: data.mixingTankName,
    supervisorName: data.supervisorName,
    batchReference: data.batchReference,
    scheduledDate: data.scheduledDate || new Date().toISOString().slice(0, 10),
    notes: data.notes,
  };

  WORK_ORDERS.unshift(newOrder);

  // Publish central event
  await eventBus.publish(
    "PRODUCTION_WORK_ORDER_CREATED",
    newOrder,
    data.supervisorName,
    "PRODUCTION"
  );

  return newOrder;
}

export async function updateWorkOrderStatus(
  id: string,
  newStatus: WorkOrderStatus,
  performedBy: string
) {
  const order = WORK_ORDERS.find((w) => w.id === id);
  if (!order) throw new Error(`Work order ${id} not found.`);

  order.status = newStatus;

  if (newStatus === "MIXING" && !order.startedAt) {
    order.startedAt = new Date().toISOString();
  }

  if (newStatus === "COMPLETED" && !order.completedAt) {
    order.completedAt = new Date().toISOString();
  }

  await eventBus.publish(
    "PRODUCTION_BATCH_STARTED",
    { orderId: id, status: newStatus },
    performedBy,
    "PRODUCTION"
  );

  return order;
}

export async function recordWorkOrderYield(
  id: string,
  actualYield: number,
  scrapQuantity = 0,
  notes?: string,
  performedBy = "David Adeleke (Supervisor)"
) {
  const order = WORK_ORDERS.find((w) => w.id === id);
  if (!order) throw new Error(`Work order ${id} not found.`);

  order.actualYield = Number(actualYield);
  order.scrapQuantity = Number(scrapQuantity);
  order.yieldEfficiency = Number(
    ((order.actualYield / order.targetQuantity) * 100).toFixed(1)
  );
  order.status = "COMPLETED";
  order.completedAt = new Date().toISOString();
  if (notes) {
    order.notes = order.notes ? `${order.notes} | ${notes}` : notes;
  }

  // Publish event alerting finished goods are ready for Logistics dispatch
  await eventBus.publish(
    "PRODUCTION_YIELD_COMPLETED",
    {
      orderNumber: order.orderNumber,
      recipeCode: order.recipeCode,
      recipeName: order.recipeName,
      actualYield: order.actualYield,
      scrapQuantity: order.scrapQuantity,
      yieldEfficiency: order.yieldEfficiency,
    },
    performedBy,
    "PRODUCTION"
  );

  return order;
}

export async function getEquipmentList() {
  return EQUIPMENT;
}

export async function updateEquipmentStatus(
  id: string,
  status: "RUNNING" | "IDLE" | "MAINTENANCE" | "CLEANING_CIP",
  temp?: number
) {
  const eq = EQUIPMENT.find((e) => e.id === id);
  if (!eq) throw new Error(`Equipment ${id} not found.`);

  eq.status = status;
  if (temp !== undefined) {
    eq.currentTemp = temp;
  }

  return eq;
}

export async function getProductionOverview() {
  const completedToday = WORK_ORDERS.filter((w) => w.status === "COMPLETED");
  const totalActual = completedToday.reduce((acc, w) => acc + w.actualYield, 0);
  const totalTarget = completedToday.reduce((acc, w) => acc + w.targetQuantity, 0);
  const activeBatches = WORK_ORDERS.filter(
    (w) => w.status === "MIXING" || w.status === "PACKAGING"
  ).length;

  const avgEfficiency =
    totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 98.5;

  const runningEq = EQUIPMENT.filter((e) => e.status === "RUNNING").length;

  return {
    dailyUnitsProduced: totalActual,
    dailyTargetCapacity: 850,
    activeBatchesCount: activeBatches,
    averageYieldEfficiency: avgEfficiency,
    equipmentRunningCount: runningEq,
    totalEquipmentCount: EQUIPMENT.length,
  };
}
