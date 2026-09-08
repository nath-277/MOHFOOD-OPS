// Moh Foods NG (MOH-OPS) - Production Mixing & Yield Tracking Engine

import { eventBus } from "../events/eventBus";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";

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

  return {
    dailyUnitsProduced: totalActual,
    dailyTargetCapacity: 850,
    activeBatchesCount: activeBatches,
    averageYieldEfficiency: avgEfficiency,
    equipmentRunningCount: runningEq,
    totalEquipmentCount: EQUIPMENT.length,
  };
}
