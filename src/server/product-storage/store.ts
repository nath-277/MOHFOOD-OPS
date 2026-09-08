// Moh Foods NG (MOH-OPS) - Finished Goods Cold Room & Product Storage Store

import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { eventBus } from "../events/eventBus";

export interface FinishedGoodsBatch {
  id: string;
  batchNumber: string;
  productCode: string;
  productName: string;
  quantityReceived: number;
  quantityRemaining: number;
  yieldUnit: string;
  productionDate: string;
  expiryDate?: string;
  coldStorageBay: string;
  currentTemp: number;
  supervisorName: string;
  status: "IN_CHILLER" | "PARTIALLY_DISPATCHED" | "DEPLETED" | "EXPIRED";
  createdAt: string;
  updatedAt: string;
}

export interface FinishedGoodsTransfer {
  id: string;
  batchId?: string;
  batchNumber: string;
  transferType: "INTAKE_FROM_PRODUCTION" | "DISPATCH_TO_RIDER" | "RETURN_COLLECTED_SPOILT";
  productCode: string;
  productName: string;
  quantity: number;
  driverName?: string;
  vehiclePlate?: string;
  waybillNumber?: string;
  waybillPhotoUrl?: string;
  temperatureAtTransfer?: number;
  performedByName: string;
  notes?: string;
  createdAt: string;
}

// In-Memory Fallbacks
let MEMORY_BATCHES: FinishedGoodsBatch[] = [];
let MEMORY_TRANSFERS: FinishedGoodsTransfer[] = [];

export async function getFinishedGoodsBatches(params?: {
  status?: string;
  search?: string;
}): Promise<FinishedGoodsBatch[]> {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.finishedGoodsBatches)
        .orderBy(desc(schema.finishedGoodsBatches.createdAt));

      if (rows.length > 0) {
        let list: FinishedGoodsBatch[] = rows.map((r) => ({
          id: r.id,
          batchNumber: r.batchNumber,
          productCode: r.productCode,
          productName: r.productName,
          quantityReceived: r.quantityReceived,
          quantityRemaining: r.quantityRemaining,
          yieldUnit: r.yieldUnit,
          productionDate: r.productionDate.toISOString(),
          expiryDate: r.expiryDate ? r.expiryDate.toISOString() : undefined,
          coldStorageBay: r.coldStorageBay,
          currentTemp: Number(r.currentTemp),
          supervisorName: r.supervisorName,
          status: r.status as FinishedGoodsBatch["status"],
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));

        if (params?.status && params.status !== "ALL") {
          list = list.filter((b) => b.status === params.status);
        }

        if (params?.search) {
          const q = params.search.toLowerCase().trim();
          list = list.filter(
            (b) =>
              b.batchNumber.toLowerCase().includes(q) ||
              b.productName.toLowerCase().includes(q) ||
              b.productCode.toLowerCase().includes(q) ||
              b.coldStorageBay.toLowerCase().includes(q)
          );
        }

        return list;
      }
    } catch (e) {
      console.error("DB error in getFinishedGoodsBatches:", e);
    }
  }

  let list = [...MEMORY_BATCHES];
  if (params?.status && params.status !== "ALL") {
    list = list.filter((b) => b.status === params.status);
  }
  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (b) =>
        b.batchNumber.toLowerCase().includes(q) ||
        b.productName.toLowerCase().includes(q) ||
        b.productCode.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getFinishedGoodsBatchById(id: string): Promise<FinishedGoodsBatch | null> {
  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
      if (isUuid) {
        const rows = await db
          .select()
          .from(schema.finishedGoodsBatches)
          .where(eq(schema.finishedGoodsBatches.id, id))
          .limit(1);

        if (rows[0]) {
          const r = rows[0];
          return {
            id: r.id,
            batchNumber: r.batchNumber,
            productCode: r.productCode,
            productName: r.productName,
            quantityReceived: r.quantityReceived,
            quantityRemaining: r.quantityRemaining,
            yieldUnit: r.yieldUnit,
            productionDate: r.productionDate.toISOString(),
            expiryDate: r.expiryDate ? r.expiryDate.toISOString() : undefined,
            coldStorageBay: r.coldStorageBay,
            currentTemp: Number(r.currentTemp),
            supervisorName: r.supervisorName,
            status: r.status as FinishedGoodsBatch["status"],
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          };
        }
      }
    } catch (e) {
      console.error("DB error in getFinishedGoodsBatchById:", e);
    }
  }

  return MEMORY_BATCHES.find((b) => b.id === id) || null;
}

export async function intakeFinishedGoodsBatch(data: {
  productCode: string;
  productName: string;
  quantity: number;
  yieldUnit?: string;
  coldStorageBay?: string;
  supervisorName: string;
  currentTemp?: number;
  shelfLifeDays?: number;
  notes?: string;
}) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const prefix = data.productCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const batchNumber = `BATCH-${prefix}-${dateStr}-${randomSuffix}`;

  const shelfLife = data.shelfLifeDays || 14; // Default 14 days cold shelf life
  const expiryDate = new Date(now.getTime() + shelfLife * 86400000);
  const bay = data.coldStorageBay || "Cold Room C (Finished Goods)";
  const temp = data.currentTemp !== undefined ? data.currentTemp : 3.2;
  const unit = data.yieldUnit || "cup";

  if (db) {
    try {
      const inserted = await db
        .insert(schema.finishedGoodsBatches)
        .values({
          batchNumber,
          productCode: data.productCode,
          productName: data.productName,
          quantityReceived: Number(data.quantity),
          quantityRemaining: Number(data.quantity),
          yieldUnit: unit,
          productionDate: now,
          expiryDate,
          coldStorageBay: bay,
          currentTemp: temp.toString(),
          supervisorName: data.supervisorName,
          status: "IN_CHILLER",
        })
        .returning();

      if (inserted[0]) {
        const r = inserted[0];
        // Record intake audit transfer
        await db.insert(schema.finishedGoodsTransfers).values({
          batchId: r.id,
          batchNumber: r.batchNumber,
          transferType: "INTAKE_FROM_PRODUCTION",
          productCode: r.productCode,
          productName: r.productName,
          quantity: r.quantityReceived,
          performedByName: data.supervisorName,
          temperatureAtTransfer: temp.toString(),
          notes: data.notes || `Production yield intake from kitchen into ${bay}`,
        });

        const newBatch: FinishedGoodsBatch = {
          id: r.id,
          batchNumber: r.batchNumber,
          productCode: r.productCode,
          productName: r.productName,
          quantityReceived: r.quantityReceived,
          quantityRemaining: r.quantityRemaining,
          yieldUnit: r.yieldUnit,
          productionDate: r.productionDate.toISOString(),
          expiryDate: r.expiryDate ? r.expiryDate.toISOString() : undefined,
          coldStorageBay: r.coldStorageBay,
          currentTemp: Number(r.currentTemp),
          supervisorName: r.supervisorName,
          status: r.status as FinishedGoodsBatch["status"],
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };

        await eventBus.publish(
          "PRODUCT_STORAGE_INTAKE_RECORDED",
          newBatch,
          data.supervisorName,
          "PRODUCT_STORAGE"
        );

        return newBatch;
      }
    } catch (e) {
      console.error("DB error in intakeFinishedGoodsBatch:", e);
    }
  }

  const memoryBatch: FinishedGoodsBatch = {
    id: `fgb-${Date.now()}`,
    batchNumber,
    productCode: data.productCode,
    productName: data.productName,
    quantityReceived: Number(data.quantity),
    quantityRemaining: Number(data.quantity),
    yieldUnit: unit,
    productionDate: now.toISOString(),
    expiryDate: expiryDate.toISOString(),
    coldStorageBay: bay,
    currentTemp: temp,
    supervisorName: data.supervisorName,
    status: "IN_CHILLER",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  MEMORY_BATCHES.unshift(memoryBatch);

  MEMORY_TRANSFERS.unshift({
    id: `fgt-${Date.now()}`,
    batchId: memoryBatch.id,
    batchNumber,
    transferType: "INTAKE_FROM_PRODUCTION",
    productCode: data.productCode,
    productName: data.productName,
    quantity: Number(data.quantity),
    performedByName: data.supervisorName,
    temperatureAtTransfer: temp,
    notes: data.notes,
    createdAt: now.toISOString(),
  });

  await eventBus.publish(
    "PRODUCT_STORAGE_INTAKE_RECORDED",
    memoryBatch,
    data.supervisorName,
    "PRODUCT_STORAGE"
  );

  return memoryBatch;
}

export async function transferToDispatchRider(data: {
  batchId: string;
  quantity: number;
  driverName: string;
  vehiclePlate?: string;
  waybillNumber?: string;
  waybillPhotoUrl?: string;
  temperature?: number;
  performedByName: string;
  notes?: string;
}) {
  const qtyToTransfer = Number(data.quantity);
  if (qtyToTransfer <= 0) {
    throw new Error("Transfer quantity must be greater than zero.");
  }

  const now = new Date();
  const temp = data.temperature !== undefined ? data.temperature : 3.4;

  if (db) {
    try {
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(data.batchId);
      if (isUuid) {
        const batchRows = await db
          .select()
          .from(schema.finishedGoodsBatches)
          .where(eq(schema.finishedGoodsBatches.id, data.batchId))
          .limit(1);

        if (batchRows.length === 0) {
          throw new Error(`Finished goods batch not found for ID ${data.batchId}`);
        }

        const batch = batchRows[0];
        if (batch.quantityRemaining < qtyToTransfer) {
          throw new Error(
            `Insufficient units in batch ${batch.batchNumber}. Available: ${batch.quantityRemaining}, Requested: ${qtyToTransfer}`
          );
        }

        const newRemaining = batch.quantityRemaining - qtyToTransfer;
        const newStatus = newRemaining === 0 ? "DEPLETED" : batch.status;

        await db
          .update(schema.finishedGoodsBatches)
          .set({
            quantityRemaining: newRemaining,
            status: newStatus,
            updatedAt: now,
          })
          .where(eq(schema.finishedGoodsBatches.id, batch.id));

        const waybillNo =
          data.waybillNumber ||
          `WB-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

        const insertedTransfer = await db
          .insert(schema.finishedGoodsTransfers)
          .values({
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            transferType: "DISPATCH_TO_RIDER",
            productCode: batch.productCode,
            productName: batch.productName,
            quantity: qtyToTransfer,
            driverName: data.driverName,
            vehiclePlate: data.vehiclePlate || "Fleet Van",
            waybillNumber: waybillNo,
            waybillPhotoUrl: data.waybillPhotoUrl || null,
            temperatureAtTransfer: temp.toString(),
            performedByName: data.performedByName,
            notes: data.notes || `Dispatched to rider ${data.driverName}`,
          })
          .returning();

        const transferResult: FinishedGoodsTransfer = {
          id: insertedTransfer[0]?.id || `fgt-${Date.now()}`,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          transferType: "DISPATCH_TO_RIDER",
          productCode: batch.productCode,
          productName: batch.productName,
          quantity: qtyToTransfer,
          driverName: data.driverName,
          vehiclePlate: data.vehiclePlate,
          waybillNumber: waybillNo,
          waybillPhotoUrl: data.waybillPhotoUrl,
          temperatureAtTransfer: temp,
          performedByName: data.performedByName,
          notes: data.notes,
          createdAt: now.toISOString(),
        };

        await eventBus.publish(
          "PRODUCT_STORAGE_DISPATCH_HANDOVER",
          transferResult,
          data.performedByName,
          "PRODUCT_STORAGE"
        );

        return {
          success: true,
          transfer: transferResult,
          remainingUnits: newRemaining,
        };
      }
    } catch (e: any) {
      console.error("DB error in transferToDispatchRider:", e);
      throw e;
    }
  }

  const batch = MEMORY_BATCHES.find((b) => b.id === data.batchId);
  if (!batch) {
    throw new Error(`Finished goods batch not found: ${data.batchId}`);
  }

  if (batch.quantityRemaining < qtyToTransfer) {
    throw new Error(
      `Insufficient units. Available: ${batch.quantityRemaining}, Requested: ${qtyToTransfer}`
    );
  }

  batch.quantityRemaining -= qtyToTransfer;
  if (batch.quantityRemaining === 0) {
    batch.status = "DEPLETED";
  }
  batch.updatedAt = now.toISOString();

  const waybillNo =
    data.waybillNumber ||
    `WB-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

  const transferResult: FinishedGoodsTransfer = {
    id: `fgt-${Date.now()}`,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    transferType: "DISPATCH_TO_RIDER",
    productCode: batch.productCode,
    productName: batch.productName,
    quantity: qtyToTransfer,
    driverName: data.driverName,
    vehiclePlate: data.vehiclePlate,
    waybillNumber: waybillNo,
    waybillPhotoUrl: data.waybillPhotoUrl,
    temperatureAtTransfer: temp,
    performedByName: data.performedByName,
    notes: data.notes,
    createdAt: now.toISOString(),
  };

  MEMORY_TRANSFERS.unshift(transferResult);

  await eventBus.publish(
    "PRODUCT_STORAGE_DISPATCH_HANDOVER",
    transferResult,
    data.performedByName,
    "PRODUCT_STORAGE"
  );

  return {
    success: true,
    transfer: transferResult,
    remainingUnits: batch.quantityRemaining,
  };
}

export async function getFinishedGoodsTransfers(limit = 50): Promise<FinishedGoodsTransfer[]> {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.finishedGoodsTransfers)
        .orderBy(desc(schema.finishedGoodsTransfers.createdAt))
        .limit(limit);

      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          batchId: r.batchId || undefined,
          batchNumber: r.batchNumber,
          transferType: r.transferType as FinishedGoodsTransfer["transferType"],
          productCode: r.productCode,
          productName: r.productName,
          quantity: r.quantity,
          driverName: r.driverName || undefined,
          vehiclePlate: r.vehiclePlate || undefined,
          waybillNumber: r.waybillNumber || undefined,
          waybillPhotoUrl: r.waybillPhotoUrl || undefined,
          temperatureAtTransfer: r.temperatureAtTransfer ? Number(r.temperatureAtTransfer) : undefined,
          performedByName: r.performedByName,
          notes: r.notes || undefined,
          createdAt: r.createdAt.toISOString(),
        }));
      }
    } catch (e) {
      console.error("DB error in getFinishedGoodsTransfers:", e);
    }
  }

  return MEMORY_TRANSFERS.slice(0, limit);
}

export async function getProductStorageOverview() {
  const batches = await getFinishedGoodsBatches();
  const transfers = await getFinishedGoodsTransfers(100);

  const activeBatches = batches.filter((b) => b.quantityRemaining > 0);
  const totalUnitsInStorage = activeBatches.reduce((acc, b) => acc + b.quantityRemaining, 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const dispatchedToday = transfers
    .filter(
      (t) =>
        t.transferType === "DISPATCH_TO_RIDER" &&
        t.createdAt.slice(0, 10) === todayStr
    )
    .reduce((acc, t) => acc + t.quantity, 0);

  return {
    totalUnitsInStorage,
    activeBatchesCount: activeBatches.length,
    dispatchedUnitsToday: dispatchedToday,
    storageColdRoomTemp: 3.2, // Chilled cold room C target
    targetTempRange: "2.0°C – 4.0°C",
    totalTransfersCount: transfers.length,
  };
}
