// Moh Foods NG (MOH-OPS) - Production Mixing & Yield Tracking Engine

import { eventBus } from "../events/eventBus";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { getStockTransactions } from "../inventory/store";

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

// In-Memory Seed Data (Equipment assets)
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

export const INITIAL_WORK_ORDERS: WorkOrder[] = [];

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
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.productionWorkOrders)
        .orderBy(desc(schema.productionWorkOrders.createdAt));

      if (rows.length > 0) {
        let list: WorkOrder[] = rows.map((r) => ({
          id: r.id,
          orderNumber: r.orderNumber,
          recipeCode: r.recipeCode,
          recipeName: r.recipeName,
          targetQuantity: r.targetQuantity,
          actualYield: r.actualYield || 0,
          scrapQuantity: r.scrapQuantity || 0,
          yieldEfficiency: r.yieldEfficiency ? Number(r.yieldEfficiency) : 0,
          status: r.status as WorkOrderStatus,
          shiftType: r.shiftType as "MORNING_SHIFT" | "NIGHT_SHIFT",
          mixingTankId: "eq-01",
          mixingTankName: r.mixingTankName,
          supervisorName: r.supervisorName,
          scheduledDate: r.scheduledDate,
          completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
          notes: r.notes || undefined,
        }));

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
              wo.recipeCode.toLowerCase().includes(q)
          );
        }
        return list;
      }
    } catch (e) {
      console.error("DB error in getWorkOrders:", e);
    }
  }

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
  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        const rows = await db
          .select()
          .from(schema.productionWorkOrders)
          .where(eq(schema.productionWorkOrders.id, id));
        if (rows[0]) {
          const r = rows[0];
          return {
            id: r.id,
            orderNumber: r.orderNumber,
            recipeCode: r.recipeCode,
            recipeName: r.recipeName,
            targetQuantity: r.targetQuantity,
            actualYield: r.actualYield || 0,
            scrapQuantity: r.scrapQuantity || 0,
            yieldEfficiency: r.yieldEfficiency ? Number(r.yieldEfficiency) : 0,
            status: r.status as WorkOrderStatus,
            shiftType: r.shiftType as "MORNING_SHIFT" | "NIGHT_SHIFT",
            mixingTankId: "eq-01",
            mixingTankName: r.mixingTankName,
            supervisorName: r.supervisorName,
            scheduledDate: r.scheduledDate,
            completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
            notes: r.notes || undefined,
          };
        }
      }
    } catch (e) {
      console.error("DB error in getWorkOrderById:", e);
    }
  }

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
  const orderNum = `WO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;

  if (db) {
    try {
      const inserted = await db
        .insert(schema.productionWorkOrders)
        .values({
          orderNumber: orderNum,
          recipeCode: data.recipeCode,
          recipeName: data.recipeName,
          targetQuantity: Number(data.targetQuantity),
          actualYield: 0,
          scrapQuantity: 0,
          yieldEfficiency: "0",
          shiftType: data.shiftType,
          scheduledDate: data.scheduledDate || new Date().toISOString().slice(0, 10),
          supervisorName: data.supervisorName,
          mixingTankName: data.mixingTankName,
          status: "SCHEDULED",
          notes: data.notes || null,
        })
        .returning();

      if (inserted[0]) {
        const r = inserted[0];
        const newOrder: WorkOrder = {
          id: r.id,
          orderNumber: r.orderNumber,
          recipeCode: r.recipeCode,
          recipeName: r.recipeName,
          targetQuantity: r.targetQuantity,
          actualYield: 0,
          scrapQuantity: 0,
          yieldEfficiency: 0,
          status: "SCHEDULED",
          shiftType: r.shiftType as "MORNING_SHIFT" | "NIGHT_SHIFT",
          mixingTankId: data.mixingTankId,
          mixingTankName: r.mixingTankName,
          supervisorName: r.supervisorName,
          batchReference: data.batchReference,
          scheduledDate: r.scheduledDate,
          notes: data.notes,
        };

        await eventBus.publish(
          "PRODUCTION_WORK_ORDER_CREATED",
          newOrder,
          data.supervisorName,
          "PRODUCTION"
        );

        return newOrder;
      }
    } catch (e) {
      console.error("DB error in createWorkOrder:", e);
    }
  }

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

  await eventBus.publish(
    "PRODUCTION_WORK_ORDER_CREATED",
    newOrder,
    data.supervisorName,
    "PRODUCTION"
  );

  return newOrder;
}

export async function updateWorkOrder(
  id: string,
  data: {
    recipeCode?: string;
    recipeName?: string;
    targetQuantity?: number;
    shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT";
    scheduledDate?: string;
    notes?: string;
  },
  performedBy: string
) {
  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        await db
          .update(schema.productionWorkOrders)
          .set({
            ...(data.recipeCode ? { recipeCode: data.recipeCode } : {}),
            ...(data.recipeName ? { recipeName: data.recipeName } : {}),
            ...(data.targetQuantity !== undefined ? { targetQuantity: Number(data.targetQuantity) } : {}),
            ...(data.shiftType ? { shiftType: data.shiftType } : {}),
            ...(data.scheduledDate ? { scheduledDate: data.scheduledDate } : {}),
            ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
          })
          .where(eq(schema.productionWorkOrders.id, id));
      }
    } catch (e) {
      console.error("DB error in updateWorkOrder:", e);
    }
  }

  const order = WORK_ORDERS.find((w) => w.id === id);
  if (order) {
    if (data.recipeCode) order.recipeCode = data.recipeCode;
    if (data.recipeName) order.recipeName = data.recipeName;
    if (data.targetQuantity !== undefined) order.targetQuantity = Number(data.targetQuantity);
    if (data.shiftType) order.shiftType = data.shiftType;
    if (data.scheduledDate) order.scheduledDate = data.scheduledDate;
    if (data.notes !== undefined) order.notes = data.notes;
  }

  return order || { id, ...data };
}

export async function deleteWorkOrder(id: string, performedBy: string) {
  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        await db
          .delete(schema.productionWorkOrders)
          .where(eq(schema.productionWorkOrders.id, id));
      }
    } catch (e) {
      console.error("DB error in deleteWorkOrder:", e);
    }
  }

  const idx = WORK_ORDERS.findIndex((w) => w.id === id);
  if (idx >= 0) {
    WORK_ORDERS.splice(idx, 1);
  }

  return { success: true, id };
}

export async function updateWorkOrderStatus(
  id: string,
  newStatus: WorkOrderStatus,
  performedBy: string
) {
  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        await db
          .update(schema.productionWorkOrders)
          .set({
            status: newStatus,
            ...(newStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
          })
          .where(eq(schema.productionWorkOrders.id, id));
      }
    } catch (e) {
      console.error("DB error in updateWorkOrderStatus:", e);
    }
  }

  const order = WORK_ORDERS.find((w) => w.id === id);
  if (order) {
    order.status = newStatus;

    if (newStatus === "MIXING" && !order.startedAt) {
      order.startedAt = new Date().toISOString();
    }

    if (newStatus === "COMPLETED" && !order.completedAt) {
      order.completedAt = new Date().toISOString();
    }
  }

  await eventBus.publish(
    "PRODUCTION_BATCH_STARTED",
    { orderId: id, status: newStatus },
    performedBy,
    "PRODUCTION"
  );

  return order || { id, status: newStatus };
}

export async function recordWorkOrderYield(
  id: string,
  actualYield: number,
  scrapQuantity = 0,
  notes?: string,
  performedBy = "David Adeleke (Supervisor)"
) {
  const order = WORK_ORDERS.find((w) => w.id === id);
  const targetQty = order ? order.targetQuantity : 100;
  const yieldEfficiency = Number(((Number(actualYield) / targetQty) * 100).toFixed(1));

  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        await db
          .update(schema.productionWorkOrders)
          .set({
            actualYield: Number(actualYield),
            scrapQuantity: Number(scrapQuantity),
            yieldEfficiency: yieldEfficiency.toString(),
            status: "COMPLETED",
            completedAt: new Date(),
            notes: notes || null,
          })
          .where(eq(schema.productionWorkOrders.id, id));
      }
    } catch (e) {
      console.error("DB error in recordWorkOrderYield:", e);
    }
  }

  if (order) {
    order.actualYield = Number(actualYield);
    order.scrapQuantity = Number(scrapQuantity);
    order.yieldEfficiency = yieldEfficiency;
    order.status = "COMPLETED";
    order.completedAt = new Date().toISOString();
    if (notes) {
      order.notes = order.notes ? `${order.notes} | ${notes}` : notes;
    }
  }

  await eventBus.publish(
    "PRODUCTION_YIELD_COMPLETED",
    {
      orderNumber: order?.orderNumber || id,
      recipeCode: order?.recipeCode || "RECIPE",
      recipeName: order?.recipeName || "Finished Product",
      actualYield: Number(actualYield),
      scrapQuantity: Number(scrapQuantity),
      yieldEfficiency,
    },
    performedBy,
    "PRODUCTION"
  );

  return order || { id, actualYield, scrapQuantity, yieldEfficiency, status: "COMPLETED" };
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
  let list = WORK_ORDERS;
  if (db) {
    try {
      const rows = await db.select().from(schema.productionWorkOrders);
      if (rows.length > 0) {
        list = rows.map((r) => ({
          id: r.id,
          orderNumber: r.orderNumber,
          recipeCode: r.recipeCode,
          recipeName: r.recipeName,
          targetQuantity: r.targetQuantity,
          actualYield: r.actualYield || 0,
          scrapQuantity: r.scrapQuantity || 0,
          yieldEfficiency: r.yieldEfficiency ? Number(r.yieldEfficiency) : 0,
          status: r.status as WorkOrderStatus,
          shiftType: r.shiftType as "MORNING_SHIFT" | "NIGHT_SHIFT",
          mixingTankId: "eq-01",
          mixingTankName: r.mixingTankName,
          supervisorName: r.supervisorName,
          scheduledDate: r.scheduledDate,
          completedAt: r.completedAt ? r.completedAt.toISOString() : undefined,
          notes: r.notes || undefined,
        }));
      }
    } catch (e) {
      console.error("DB error in getProductionOverview:", e);
    }
  }

  const completedToday = list.filter((w) => w.status === "COMPLETED");
  const totalActual = completedToday.reduce((acc, w) => acc + w.actualYield, 0);
  const totalTarget = completedToday.reduce((acc, w) => acc + w.targetQuantity, 0);
  const activeBatches = list.filter(
    (w) => w.status === "MIXING" || w.status === "PACKAGING"
  ).length;

  const avgEfficiency =
    totalTarget > 0 ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 100;

  const runningEq = EQUIPMENT.filter((e) => e.status === "RUNNING").length;
  const settings = await getProductionSettings();

  return {
    dailyUnitsProduced: totalActual,
    dailyTargetCapacity: settings.dailyTargetCapacity,
    activeBatchesCount: activeBatches,
    averageYieldEfficiency: avgEfficiency,
    equipmentRunningCount: runningEq,
    totalEquipmentCount: EQUIPMENT.length,
  };
}

// In-Memory Production Settings
let PRODUCTION_SETTINGS = {
  dailyTargetCapacity: 400,
  updatedAt: new Date().toISOString(),
  updatedBy: "System",
};

export async function getProductionSettings() {
  if (db) {
    try {
      const rows = await db.select().from(schema.productionSettings).limit(1);
      if (rows.length > 0) {
        return {
          dailyTargetCapacity: Number(rows[0].dailyTargetCapacity) || 400,
          updatedAt: rows[0].updatedAt.toISOString(),
          updatedBy: rows[0].updatedBy || "System",
        };
      }
    } catch (e) {
      console.warn("DB error in getProductionSettings, using fallback:", e);
    }
  }
  return { ...PRODUCTION_SETTINGS };
}

export async function updateProductionSettings(data: {
  dailyTargetCapacity: number;
  updatedBy?: string;
}) {
  const target = Math.max(1, Math.round(Number(data.dailyTargetCapacity) || 400));
  const updatedBy = data.updatedBy || "Admin";
  const now = new Date();

  PRODUCTION_SETTINGS = {
    dailyTargetCapacity: target,
    updatedAt: now.toISOString(),
    updatedBy,
  };

  if (db) {
    try {
      await db
        .insert(schema.productionSettings)
        .values({
          id: "default",
          dailyTargetCapacity: target,
          updatedAt: now,
          updatedBy,
        })
        .onConflictDoUpdate({
          target: schema.productionSettings.id,
          set: {
            dailyTargetCapacity: target,
            updatedAt: now,
            updatedBy,
          },
        });
    } catch (e) {
      console.warn("DB error updating productionSettings:", e);
    }
  }

  return { ...PRODUCTION_SETTINGS };
}

// ==========================================
// 5. FACTORY SHIFT OPERATIONS LOGS
// ==========================================
export interface ProductionShiftLog {
  id: string;
  shiftDate: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  supervisorId?: string;
  supervisorName: string;
  status: "OPTIMAL" | "MINOR_INCIDENTS" | "DOWNTIME_DELAY" | "CRITICAL_ALERT";
  notes?: string; // Unified single comprehensive shift description
  powerStatus?: string;
  equipmentNotes?: string;
  outputSummary?: string;
  incidents?: string;
  handoverNotes?: string;
  createdAt: string;
}

export interface RequisitionItem {
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface RequisitionFormRecord {
  id: string;
  referenceId: string;
  shiftDate: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  productName?: string;
  preparedBy: string;
  issuedBy: string;
  status: "PENDING_APPROVAL" | "APPROVED";
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  items: RequisitionItem[];
  createdAt: string;
}

// In-Memory Seed Shift Logs
const INITIAL_SHIFT_LOGS: ProductionShiftLog[] = [
  {
    id: "log-seed-01",
    shiftDate: new Date().toISOString().split("T")[0],
    shiftType: "MORNING_SHIFT",
    supervisorName: "David Adeleke (Production Supervisor)",
    status: "OPTIMAL",
    powerStatus: "Public Grid power uninterrupted. Generator on standby at 95% fuel.",
    equipmentNotes: "Mixing Tank #1 completed 3 batch cycles. Rotary Cup Sealer cleaned and lubricated.",
    outputSummary: "Produced 450 units Strawberry Parfait (400ml) & 200 units Greek Yogurt (500ml).",
    incidents: "Nil. All CCP temperatures remained strictly within 2°C – 4°C chilled safety window.",
    handoverNotes: "Ensure Night shift supervisor runs CIP cycle on Mixing Tank #2 before batching vanilla yogurt.",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "log-seed-02",
    shiftDate: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    shiftType: "NIGHT_SHIFT",
    supervisorName: "David Adeleke (Production Supervisor)",
    status: "MINOR_INCIDENTS",
    powerStatus: "Generator active for 2 hours during scheduled plant grid maintenance.",
    equipmentNotes: "Rotary Sealer sensor adjusted after 3 defective seal warnings.",
    outputSummary: "Packaged 350 units Vanilla Yogurt (350ml). Passed QC viscosity checks.",
    incidents: "3 broken seals scrapped and logged with store as damaged packaging.",
    handoverNotes: "Cold room C has sufficient bay space for morning shift finished goods intake.",
    createdAt: new Date(Date.now() - 86400000 - 3600000 * 2).toISOString(),
  },
];

let SHIFT_LOGS: ProductionShiftLog[] = [...INITIAL_SHIFT_LOGS];

// In-Memory Approvals Map: key = referenceId
const REQUISITION_APPROVALS: Record<
  string,
  {
    referenceId?: string;
    status: "PENDING_APPROVAL" | "APPROVED";
    approvedBy?: string;
    approvedAt?: string;
    notes?: string;
  }
> = {};

export async function getProductionShiftLogs(filters?: {
  date?: string;
  shift?: string;
}): Promise<ProductionShiftLog[]> {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.productionShiftLogs)
        .orderBy(desc(schema.productionShiftLogs.createdAt));

      if (rows.length > 0) {
        let list: ProductionShiftLog[] = rows.map((r) => ({
          id: r.id,
          shiftDate: r.shiftDate,
          shiftType: r.shiftType as "MORNING_SHIFT" | "NIGHT_SHIFT",
          supervisorId: r.supervisorId || undefined,
          supervisorName: r.supervisorName,
          status: r.status as any,
          powerStatus: r.powerStatus || undefined,
          equipmentNotes: r.equipmentNotes || undefined,
          outputSummary: r.outputSummary || undefined,
          incidents: r.incidents || undefined,
          handoverNotes: r.handoverNotes || undefined,
          createdAt: r.createdAt.toISOString(),
        }));

        if (filters?.date) {
          list = list.filter((l) => l.shiftDate === filters.date);
        }
        if (filters?.shift && filters.shift !== "ALL") {
          list = list.filter((l) => l.shiftType === filters.shift);
        }
        return list;
      }
    } catch (e) {
      console.warn("DB query failed for shift logs, using in-memory store:", e);
    }
  }

  let list = [...SHIFT_LOGS];
  if (filters?.date) {
    list = list.filter((l) => l.shiftDate === filters.date);
  }
  if (filters?.shift && filters.shift !== "ALL") {
    list = list.filter((l) => l.shiftType === filters.shift);
  }
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createProductionShiftLog(
  data: Omit<ProductionShiftLog, "id" | "createdAt">
): Promise<ProductionShiftLog> {
  const noteText = data.notes || data.handoverNotes || "";
  const newLog: ProductionShiftLog = {
    ...data,
    notes: noteText,
    handoverNotes: noteText,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const inserted = await db
        .insert(schema.productionShiftLogs)
        .values({
          shiftDate: data.shiftDate,
          shiftType: data.shiftType,
          supervisorId: data.supervisorId,
          supervisorName: data.supervisorName,
          status: data.status,
          powerStatus: data.powerStatus,
          equipmentNotes: data.equipmentNotes,
          outputSummary: data.outputSummary,
          incidents: data.incidents,
          handoverNotes: noteText,
          notes: noteText,
        })
        .returning();

      if (inserted.length > 0) {
        newLog.id = inserted[0].id;
        newLog.createdAt = inserted[0].createdAt.toISOString();
      }
    } catch (e) {
      console.warn("DB insert failed for shift log, saved to in-memory:", e);
    }
  }

  SHIFT_LOGS.unshift(newLog);

  eventBus.publish(
    "PRODUCTION_SHIFT_LOG_CREATED",
    {
      logId: newLog.id,
      shiftDate: newLog.shiftDate,
      shiftType: newLog.shiftType,
      supervisorName: newLog.supervisorName,
      status: newLog.status,
    },
    newLog.supervisorName,
    "PRODUCTION"
  );

  return newLog;
}

// ==========================================
// 6. STORE REQUISITION VETTING & APPROVALS
// ==========================================
export async function getShiftRequisitions(
  dateOrParams?: string | { date?: string; shift?: "MORNING_SHIFT" | "NIGHT_SHIFT" | "ALL" },
  shiftParam?: "MORNING_SHIFT" | "NIGHT_SHIFT" | "ALL"
): Promise<RequisitionFormRecord[]> {
  const date =
    typeof dateOrParams === "string"
      ? dateOrParams
      : dateOrParams?.date || new Date().toISOString().split("T")[0];
  const rawShift =
    typeof dateOrParams === "object" && dateOrParams?.shift
      ? dateOrParams.shift
      : shiftParam || "ALL";
  const shift = rawShift === "ALL" ? undefined : rawShift;

  const txns = await getStockTransactions({ limit: 5000 });

  // Filter transactions for this date & shift that were dispensed for production
  const relevantTxns = txns.filter((t) => {
    const isDispense =
      t.transactionType === "DISPENSE_PRODUCTION" ||
      t.transactionType === "DISPENSE_INDIVIDUAL" ||
      t.transactionType?.includes("DISPENSE");

    const matchShift = !shift || t.shiftType === shift;

    // Support both UTC startswith and local date comparison
    let matchDate = true;
    if (date) {
      const createdDateUtc = (t.createdAt || "").slice(0, 10);
      const createdDateLocal = t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-CA") : "";
      matchDate = createdDateUtc === date || createdDateLocal === date;
    }

    return isDispense && matchShift && matchDate;
  });

  // Check DB for any approvals on these references
  const approvalsFromDb: Record<
    string,
    { status: "PENDING_APPROVAL" | "APPROVED"; approvedBy?: string; approvedAt?: string; notes?: string }
  > = { ...REQUISITION_APPROVALS };

  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.requisitionApprovals)
        .where(eq(schema.requisitionApprovals.shiftDate, date));

      for (const r of rows) {
        approvalsFromDb[r.referenceId] = {
          status: r.status as any,
          approvedBy: r.approvedBy || undefined,
          approvedAt: r.approvedAt ? r.approvedAt.toISOString() : undefined,
          notes: r.notes || undefined,
        };
      }
    } catch (e) {
      console.warn("DB query for requisition approvals failed, using cache:", e);
    }
  }

  // Group by referenceId (e.g. BATCH-PRF-...)
  const groups: Record<string, typeof relevantTxns> = {};
  for (const t of relevantTxns) {
    const ref = t.referenceId || `REQ-${date}-${t.shiftType === "NIGHT_SHIFT" ? "NGHT" : "MORN"}`;
    if (!groups[ref]) groups[ref] = [];
    groups[ref].push(t);
  }

  // If no transactions found for this date/shift, return empty array
  if (Object.keys(groups).length === 0) {
    return [];
  }

  return Object.entries(groups).map(([refId, items]) => {
    const first = items[0];
    let recipeName = "Factory Shift Production Run";
    const match = first.notes?.match(/Dispensed for (\d+x?)\s+([^.]+)/i);
    if (match) {
      recipeName = `${match[2]} (${match[1]} batch)`;
    } else if (first.notes) {
      recipeName = first.notes.replace(/^Dispensed for\s+/i, "").split(".")[0];
    }

    const approval = approvalsFromDb[refId] || { status: "PENDING_APPROVAL" };

    return {
      id: refId,
      referenceId: refId,
      shiftDate: first.createdAt ? first.createdAt.slice(0, 10) : date,
      shiftType: first.shiftType || "MORNING_SHIFT",
      productName: recipeName,
      preparedBy: "David Adeleke",
      issuedBy: first.performedByName || "Ibrahim Musa",
      status: approval.status,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      approvalNotes: approval.notes,
      items: items.map((i) => {
        let qty = Math.abs(Number(i.quantity));
        let unit = i.unit;
        let notes = i.notes;

        // Check if notes contains culinary dished amount (e.g. 400 pcs)
        const dishedMatch = i.notes?.match(/(?:dished|dispensed|variable material:?)\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/i) ||
                            i.notes?.match(/^(\d+(?:\.\d+)?)\s*(pcs|pieces|cups|ml|g|kg)$/i);
        if (dishedMatch && Number(dishedMatch[1]) > 0) {
          qty = Number(dishedMatch[1]);
          unit = dishedMatch[2];
          if (Math.abs(Number(i.quantity)) > 0 && i.unit !== unit) {
            notes = `dished for floor run (drawn from ${Math.abs(Number(i.quantity))} ${i.unit})`;
          }
        }

        return {
          itemName: i.itemName,
          itemCode: i.itemId,
          quantity: qty,
          unit,
          notes,
        };
      }),
      createdAt: first.createdAt,
    };
  });
}

export async function approveShiftRequisition(
  dataOrRefId:
    | string
    | {
        referenceId: string;
        shiftDate: string;
        shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
        supervisorName?: string;
        approvedBy?: string;
        notes?: string;
      },
  maybeData?: {
    shiftDate?: string;
    shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT";
    approvedBy?: string;
    supervisorName?: string;
    notes?: string;
  }
): Promise<{ success: boolean; approval: any }> {
  let referenceId = "";
  let shiftDate = new Date().toISOString().split("T")[0];
  let shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT" = "MORNING_SHIFT";
  let supervisorName = "David Adeleke (Production Supervisor)";
  let notes: string | undefined = undefined;

  if (typeof dataOrRefId === "string") {
    referenceId = dataOrRefId;
    if (maybeData) {
      if (maybeData.shiftDate) shiftDate = maybeData.shiftDate;
      if (maybeData.shiftType) shiftType = maybeData.shiftType;
      if (maybeData.approvedBy) supervisorName = maybeData.approvedBy;
      if (maybeData.supervisorName) supervisorName = maybeData.supervisorName;
      if (maybeData.notes) notes = maybeData.notes;
    }
  } else {
    referenceId = dataOrRefId.referenceId;
    shiftDate = dataOrRefId.shiftDate;
    shiftType = dataOrRefId.shiftType;
    supervisorName = dataOrRefId.supervisorName || dataOrRefId.approvedBy || supervisorName;
    notes = dataOrRefId.notes;
  }

  const approvalRecord = {
    referenceId,
    status: "APPROVED" as const,
    approvedBy: supervisorName,
    approvedAt: new Date().toISOString(),
    notes: notes || undefined,
  };

  REQUISITION_APPROVALS[referenceId] = approvalRecord;

  if (db) {
    try {
      await db
        .insert(schema.requisitionApprovals)
        .values({
          referenceId,
          shiftDate,
          shiftType,
          status: "APPROVED",
          approvedBy: supervisorName,
          notes,
          approvedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.requisitionApprovals.referenceId,
          set: {
            status: "APPROVED",
            approvedBy: supervisorName,
            notes,
            approvedAt: new Date(),
          },
        });
    } catch (e) {
      console.warn("DB insert for requisition approval failed, saved in memory:", e);
    }
  }

  eventBus.publish(
    "REQUISITION_APPROVED_BY_SUPERVISOR",
    {
      referenceId,
      shiftDate,
      shiftType,
      supervisorName,
      notes,
    },
    supervisorName,
    "PRODUCTION"
  );

  return { success: true, approval: approvalRecord };
}

export async function getRequisitionApprovalByRef(referenceId: string) {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.requisitionApprovals)
        .where(eq(schema.requisitionApprovals.referenceId, referenceId))
        .limit(1);

      if (rows.length > 0) {
        return {
          referenceId: rows[0].referenceId,
          status: rows[0].status as "PENDING_APPROVAL" | "APPROVED",
          approvedBy: rows[0].approvedBy || undefined,
          approvedAt: rows[0].approvedAt ? rows[0].approvedAt.toISOString() : undefined,
          notes: rows[0].notes || undefined,
        };
      }
    } catch (e) {
      console.warn("DB lookup for requisition approval failed, falling back to memory:", e);
    }
  }

  return REQUISITION_APPROVALS[referenceId] || { status: "PENDING_APPROVAL" as const };
}

