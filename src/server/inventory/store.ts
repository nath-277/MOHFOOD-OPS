import { eventBus } from "../events/eventBus";
import { db, schema, ensureSchemaColumns } from "../db";
import { eq, desc, inArray, or, and, gte, lte, ilike, sql } from "drizzle-orm";
import {
  markContainerDepletedCalculation,
} from "@/lib/packaging";
import { getDefaultStoreManagerName } from "../auth/store";
import { cleanStaffName } from "../../lib/printUtils";
import {
  isDispatchEditable,
  getShiftHandoverCutoff,
  formatCutoffTime,
  getEffectiveDispatchStatus,
} from "@/lib/shiftTiming";

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  category: "PERISHABLE_MEASURED" | "PERISHABLE_NUMBERED" | "PACKAGING_NON_PERISHABLE";
  uom: string;
  currentStock: number;
  minStockThreshold: number;
  costPerUnit: number;
  storageLocation: string;
  imageUrl?: string;
  packagingType?: "DIRECT" | "PACK_ONLY" | "CARTON_AND_PACK" | string;
  packUnit?: string;
  unitsPerPack?: number;
  cartonUnit?: string;
  packsPerCarton?: number;
  isVariablePack?: boolean;
  inUseQuantity?: number;
  inUseUnit?: string;
  recipeUom?: string;
  portionsPerContainer?: number;
  inUseRemainingPortions?: number;
  isActive: boolean;
}

export const R2_PUBLIC_BASE_URL = "https://pub-33d7a20b6cc243fab0cc96a243366c93.r2.dev";

export function normalizeImageUrl(url?: string | null, updatedAt?: string | Date | null): string | undefined {
  if (!url) return undefined;
  let normalized = url.trim();

  // If already full URL, ensure correct domain
  if (!normalized.startsWith("http")) {
    if (normalized.includes("/inventory-items/")) {
      const key = "inventory-items/" + normalized.split("/inventory-items/")[1];
      normalized = `${R2_PUBLIC_BASE_URL}/${key}`;
    } else if (normalized.includes("/uploads/")) {
      const key = "uploads/" + normalized.split("/uploads/")[1];
      normalized = `${R2_PUBLIC_BASE_URL}/${key}`;
    } else if (normalized.startsWith("/api/storage/")) {
      const key = normalized.replace(/^\/api\/storage\//, "");
      normalized = `${R2_PUBLIC_BASE_URL}/${key}`;
    } else if (normalized.startsWith("inventory-items/")) {
      normalized = `${R2_PUBLIC_BASE_URL}/${normalized}`;
    } else if (normalized.startsWith("uploads/")) {
      normalized = `${R2_PUBLIC_BASE_URL}/${normalized}`;
    }
  }

  // Handle legacy non-timestamped parfait cup image
  if (normalized.includes("parfait-cup.jpg") && !normalized.includes("parfait-cup-")) {
    normalized = normalized.replace("parfait-cup.jpg", "parfait-cup-1726140897499.jpg");
  }

  // If item has an updatedAt timestamp and URL has no query string, append ?v=timestamp to bust any edge/browser cache
  if (updatedAt && !normalized.includes("?")) {
    const ts = new Date(updatedAt).getTime();
    if (!isNaN(ts) && ts > 0) {
      normalized = `${normalized}?v=${ts}`;
    }
  }

  return normalized;
}

export interface ItemLot {
  id: string;
  itemId: string;
  itemName: string;
  lotNumber: string;
  supplierName: string;
  arrivalDate: string;
  expiryDate?: string;
  initialQuantity: number;
  remainingQuantity: number;
  unitCost: number;
  grnNumber: string;
  waybillUrl?: string;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  itemName: string;
  transactionType:
    | "INBOUND_PURCHASE"
    | "DISPENSE_PRODUCTION"
    | "DISPENSE_INDIVIDUAL"
    | "RETURN_FAULT_REPLACE"
    | "RETURN_FAULT_SCRAP"
    | "RETURN_EXCESS_RESTOCK"
    | "DISPOSAL_EXPIRED_SPOILT"
    | "RECONCILIATION_ADJUST";
  quantity: number;
  unit: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  performedByName: string;
  recipient?: string;
  referenceId?: string;
  notes?: string;
  status?: "PENDING_HANDOVER" | "PERMANENT" | "CANCELLED";
  createdAt: string;
}

export interface ShiftRecordDiscrepancy {
  itemCode: string;
  itemName: string;
  expectedStock: number;
  physicalCount: number;
  variance: number;
  uom: string;
  note?: string;
}

export interface ShiftRecord {
  id: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  shiftDate: string;
  status: "OPEN" | "CLOSED" | "RECONCILED";
  openedByName: string;
  closedByName?: string;
  handoverOfficerName?: string;
  totalVariances: number;
  totalItemsChecked: number;
  discrepancies?: ShiftRecordDiscrepancy[];
  allResults?: ShiftRecordDiscrepancy[];
  notes?: string;
  createdAt: string;
  closedAt?: string;
  stats?: {
    dispensedCount: number;
    intakeCount: number;
    returnsCount: number;
  };
}

export interface ProductRecipe {
  id: string;
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  yieldQuantity: number;
  yieldUnit: string;
  ingredients: {
    itemCode: string;
    itemName: string;
    quantityRequired: number;
    uom: string;
    recipeUom?: string;
  }[];
}

// Initial Seed Data for Moh Foods Factory Floor (zeroed for production)
const INVENTORY_ITEMS: InventoryItem[] = [
  // 1. Measured Perishables & Multi-use bulk ingredients
  { id: "item-01", code: "RAW-MLK-01", name: "Fresh Whole Cow Milk", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 0, minStockThreshold: 50.000, costPerUnit: 1400, storageLocation: "Cold Room A (4°C)", isActive: true },
  { id: "item-02", code: "RAW-MLK-02", name: "Full Cream Powdered Milk", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 0, minStockThreshold: 30.000, costPerUnit: 3500, storageLocation: "Dry Store Shelf 1", isActive: true },
  { id: "item-03", code: "RAW-SGR-01", name: "Granulated White Sugar", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 0, minStockThreshold: 25.000, costPerUnit: 1800, storageLocation: "Dry Store Shelf 2", isActive: true },
  { id: "item-04", code: "RAW-OAT-01", name: "Rolled Oats Flakes", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 0, minStockThreshold: 20.000, costPerUnit: 2200, storageLocation: "Dry Store Shelf 3", isActive: true },
  { id: "item-05", code: "RAW-GRN-01", name: "Honey Crunchy Granola", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 0, minStockThreshold: 25.000, costPerUnit: 3800, storageLocation: "Dry Store Shelf 3", isActive: true },
  { id: "item-06", code: "RAW-RSN-01", name: "Seedless Golden Raisins", category: "PERISHABLE_MEASURED", uom: "carton", packagingType: "PACK_ONLY", packUnit: "carton", currentStock: 1, recipeUom: "cups", isVariablePack: true, minStockThreshold: 1, costPerUnit: 18000, storageLocation: "Dry Store Bin 4", isActive: true },
  { id: "item-07", code: "RAW-VAN-01", name: "Pure Vanilla Extract", category: "PERISHABLE_MEASURED", uom: "bottle", packagingType: "PACK_ONLY", packUnit: "bottle", currentStock: 2, recipeUom: "ml", isVariablePack: true, minStockThreshold: 1, costPerUnit: 8500, storageLocation: "Dry Store Locked Cabinet", isActive: true },
  { id: "item-18", code: "RAW-GLC-01", name: "Liquid Food-Grade Glucose", category: "PERISHABLE_MEASURED", uom: "tub", packagingType: "PACK_ONLY", packUnit: "tub", currentStock: 2, recipeUom: "cups", isVariablePack: true, minStockThreshold: 1, costPerUnit: 6500, storageLocation: "Dry Store Shelf 2", isActive: true },

  // 2. Numbered Perishables
  { id: "item-08", code: "RAW-APL-01", name: "Fresh Crisp Green Apples", category: "PERISHABLE_NUMBERED", uom: "pcs", currentStock: 0, minStockThreshold: 300, costPerUnit: 250, storageLocation: "Cold Room B (Fruit Bay)", isActive: true },
  { id: "item-09", code: "RAW-GRP-01", name: "Seedless Purple Grapes", category: "PERISHABLE_NUMBERED", uom: "pack", packagingType: "PACK_ONLY", packUnit: "pack", currentStock: 6, recipeUom: "pcs", isVariablePack: true, minStockThreshold: 2, costPerUnit: 1200, storageLocation: "Cold Room B (Fruit Bay)", isActive: true },
  { id: "item-10", code: "RAW-CCN-01", name: "Fresh Whole Coconuts", category: "PERISHABLE_NUMBERED", uom: "nuts", currentStock: 0, minStockThreshold: 100, costPerUnit: 450, storageLocation: "Fruit Prep Bay", isActive: true },
  { id: "item-11", code: "RAW-CSH-01", name: "Roasted Cashew Nuts", category: "PERISHABLE_NUMBERED", uom: "bottle", packagingType: "PACK_ONLY", packUnit: "bottle", currentStock: 6, recipeUom: "pcs", isVariablePack: true, minStockThreshold: 2, costPerUnit: 2500, storageLocation: "Dry Store Shelf 4", isActive: true },

  // 3. Packaging & Non-Perishables
  { id: "item-12", code: "PKG-CUP-400", name: "Parfait Cups & Dome Lids (400ml)", category: "PACKAGING_NON_PERISHABLE", uom: "sets", currentStock: 0, minStockThreshold: 1000, costPerUnit: 120, storageLocation: "Packaging Bay A", imageUrl: "https://pub-33d7a20b6cc243fab0cc96a243366c93.r2.dev/inventory-items/parfait-cup-1726140897499.jpg", isActive: true },
  { id: "item-13", code: "PKG-GYC-500", name: "Greek Yogurt Cups & Lids (500ml)", category: "PACKAGING_NON_PERISHABLE", uom: "sets", currentStock: 0, minStockThreshold: 500, costPerUnit: 160, storageLocation: "Packaging Bay A", isActive: true },
  { id: "item-14", code: "PKG-BOT-350", name: "Vanilla Yogurt Bottles & Caps (350ml)", category: "PACKAGING_NON_PERISHABLE", uom: "sets", currentStock: 0, minStockThreshold: 400, costPerUnit: 140, storageLocation: "Packaging Bay B", isActive: true },
  { id: "item-15", code: "PKG-FOL-01", name: "Aluminium Foil Rolls (Wide)", category: "PACKAGING_NON_PERISHABLE", uom: "rolls", currentStock: 0, minStockThreshold: 5, costPerUnit: 4500, storageLocation: "Packaging Bay B", isActive: true },
  { id: "item-16", code: "PKG-SEAL-01", name: "Tamper-Proof Shrink Seals", category: "PACKAGING_NON_PERISHABLE", uom: "units", currentStock: 0, minStockThreshold: 2000, costPerUnit: 25, storageLocation: "Packaging Bay C", isActive: true },
  { id: "item-17", code: "PKG-LBL-PRF", name: "Moh Parfait NAFDAC Labels", category: "PACKAGING_NON_PERISHABLE", uom: "units", currentStock: 0, minStockThreshold: 1500, costPerUnit: 35, storageLocation: "Packaging Bay C", isActive: true },
];

const PRODUCT_RECIPES: ProductRecipe[] = [];

const ITEM_LOTS: ItemLot[] = [];

const TRANSACTIONS: StockTransaction[] = [];

const SHIFT_RECORDS: ShiftRecord[] = [];

// ==========================================
// STORE ENGINE API METHODS
// ==========================================

export const shouldDisableMocks =
  Boolean(db) || process.env.NODE_ENV === "production" || Boolean(process.env.DATABASE_URL);

export async function getItemByCode(codeOrId: string): Promise<InventoryItem | null> {
  const clean = codeOrId.trim();
  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      const condition = isUuid
        ? eq(schema.items.id, clean)
        : eq(schema.items.code, clean.toUpperCase());
      const rows = await db.select().from(schema.items).where(and(condition, eq(schema.items.isActive, true))).limit(1);
      if (rows.length > 0) {
        const i = rows[0];
        return {
          id: i.id,
          code: i.code,
          name: i.name,
          category: i.category as any,
          uom: i.uom,
          currentStock: Number(i.currentStock),
          minStockThreshold: Number(i.minStockThreshold),
          costPerUnit: Number(i.costPerUnit || 0),
          storageLocation: i.storageLocation || "Central Store",
          imageUrl: normalizeImageUrl(i.imageUrl, i.updatedAt),
          packagingType: i.packagingType || "DIRECT",
          packUnit: i.packUnit || undefined,
          unitsPerPack: i.unitsPerPack ? Number(i.unitsPerPack) : undefined,
          cartonUnit: i.cartonUnit || undefined,
          packsPerCarton: i.packsPerCarton ? Number(i.packsPerCarton) : undefined,
          isVariablePack: Boolean(i.isVariablePack),
          inUseQuantity: Number(i.inUseQuantity || 0),
          inUseUnit: i.inUseUnit || undefined,
          recipeUom: i.recipeUom || undefined,
          portionsPerContainer: i.portionsPerContainer ? Number(i.portionsPerContainer) : undefined,
          inUseRemainingPortions: Number(i.inUseRemainingPortions || 0),
          isActive: i.isActive,
        };
      }
    } catch (err) {
      console.error(`DB error in getItemByCode for "${codeOrId}":`, err);
    }
    if (shouldDisableMocks) return null;
  }

  if (shouldDisableMocks) return null;
  return INVENTORY_ITEMS.find((i) => i.code.toUpperCase() === clean.toUpperCase() || i.id === clean) || null;
}

export async function getInventoryItems(params?: {
  category?: string;
  search?: string;
}) {
  if (db) {
    try {
      const rows = await db.select().from(schema.items).where(eq(schema.items.isActive, true));
      let list: InventoryItem[] = rows.map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        category: i.category as any,
        uom: i.uom,
        currentStock: Number(i.currentStock),
        minStockThreshold: Number(i.minStockThreshold),
        costPerUnit: Number(i.costPerUnit || 0),
        storageLocation: i.storageLocation || "Central Store",
        imageUrl: normalizeImageUrl(i.imageUrl, i.updatedAt),
        packagingType: i.packagingType || "DIRECT",
        packUnit: i.packUnit || undefined,
        unitsPerPack: i.unitsPerPack ? Number(i.unitsPerPack) : undefined,
        cartonUnit: i.cartonUnit || undefined,
        packsPerCarton: i.packsPerCarton ? Number(i.packsPerCarton) : undefined,
        isVariablePack: Boolean(i.isVariablePack),
        inUseQuantity: Number(i.inUseQuantity || 0),
        inUseUnit: i.inUseUnit || undefined,
        recipeUom: i.recipeUom || undefined,
        portionsPerContainer: i.portionsPerContainer ? Number(i.portionsPerContainer) : undefined,
        inUseRemainingPortions: Number(i.inUseRemainingPortions || 0),
        isActive: i.isActive,
      }));
      if (params?.category && params.category !== "ALL") {
        list = list.filter((i) => i.category === params.category);
      }
      if (params?.search) {
        const q = params.search.toLowerCase().trim();
        list = list.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            i.code.toLowerCase().includes(q) ||
            i.storageLocation.toLowerCase().includes(q)
        );
      }
      return list;
    } catch (err) {
      console.error("Failed to query inventory items from DB:", err);
      return [];
    }
  }

  if (shouldDisableMocks) {
    return [];
  }

  let list = [...INVENTORY_ITEMS];

  if (params?.category && params.category !== "ALL") {
    list = list.filter((i) => i.category === params.category);
  }

  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        i.storageLocation.toLowerCase().includes(q)
    );
  }

  return list;
}

export async function getProductRecipes(): Promise<ProductRecipe[]> {
  if (db) {
    try {
      const dbRecipes = await db.select().from(schema.productRecipes).orderBy(desc(schema.productRecipes.createdAt));
      if (dbRecipes.length > 0) {
        const fullList: ProductRecipe[] = [];
        for (const r of dbRecipes) {
          const ings = await db
            .select({
              itemId: schema.recipeIngredients.itemId,
              quantityRequired: schema.recipeIngredients.quantityRequired,
              uom: schema.recipeIngredients.uom,
              recipeUom: schema.recipeIngredients.recipeUom,
              itemCode: schema.items.code,
              itemName: schema.items.name,
            })
            .from(schema.recipeIngredients)
            .innerJoin(schema.items, eq(schema.recipeIngredients.itemId, schema.items.id))
            .where(eq(schema.recipeIngredients.recipeId, r.id));

          fullList.push({
            id: r.id,
            code: r.code,
            name: r.name,
            description: r.description || undefined,
            imageUrl: r.imageUrl || undefined,
            yieldQuantity: r.yieldQuantity,
            yieldUnit: r.yieldUnit,
            ingredients: ings.map((ing) => ({
              itemCode: ing.itemCode,
              itemName: ing.itemName,
              quantityRequired: Number(ing.quantityRequired),
              uom: ing.uom,
              recipeUom: ing.recipeUom || ing.uom,
            })),
          });
        }
        return fullList;
      }
      return [];
    } catch (err) {
      console.error("DB error in getProductRecipes:", err);
      return [];
    }
  }
  if (shouldDisableMocks) {
    return [];
  }
  return PRODUCT_RECIPES;
}

export async function createInventoryItem(data: {
  code: string;
  name: string;
  category: "PERISHABLE_MEASURED" | "PERISHABLE_NUMBERED" | "PACKAGING_NON_PERISHABLE";
  uom: string;
  currentStock: number;
  minStockThreshold: number;
  costPerUnit?: number;
  storageLocation?: string;
  imageUrl?: string;
  packagingType?: "DIRECT" | "PACK_ONLY" | "CARTON_AND_PACK";
  packUnit?: string;
  unitsPerPack?: number | string;
  cartonUnit?: string;
  packsPerCarton?: number | string;
  isVariablePack?: boolean;
  inUseQuantity?: number | string;
  inUseUnit?: string;
  recipeUom?: string;
  portionsPerContainer?: number | string;
  inUseRemainingPortions?: number | string;
}) {
  const codeTrimmed = data.code.trim().toUpperCase();

  if (db) {
    try {
      const existing = await db.select().from(schema.items).where(eq(schema.items.code, codeTrimmed)).limit(1);
      if (existing.length > 0) {
        throw new Error(`Item code ${codeTrimmed} already exists.`);
      }
      const inserted = await db.insert(schema.items).values({
        code: codeTrimmed,
        name: data.name.trim(),
        category: data.category,
        uom: data.uom.trim(),
        currentStock: (Number(data.currentStock) || 0).toFixed(3),
        minStockThreshold: (Number(data.minStockThreshold) || 10).toFixed(3),
        costPerUnit: (Number(data.costPerUnit) || 0).toFixed(2),
        storageLocation: data.storageLocation?.trim() || "Central Store",
        imageUrl: normalizeImageUrl(data.imageUrl) || null,
        packagingType: data.packagingType || "DIRECT",
        packUnit: data.packUnit?.trim() || null,
        unitsPerPack: data.unitsPerPack ? Number(data.unitsPerPack).toFixed(3) : null,
        cartonUnit: data.cartonUnit?.trim() || null,
        packsPerCarton: data.packsPerCarton ? Number(data.packsPerCarton).toFixed(3) : null,
        isVariablePack: Boolean(data.isVariablePack),
        inUseQuantity: (Number(data.inUseQuantity) || 0).toFixed(3),
        inUseUnit: data.inUseUnit?.trim() || null,
        recipeUom: data.recipeUom?.trim() || null,
        portionsPerContainer: data.portionsPerContainer ? Number(data.portionsPerContainer).toFixed(3) : null,
        inUseRemainingPortions: (Number(data.inUseRemainingPortions) || 0).toFixed(3),
        isActive: true,
      }).returning();

      if (inserted.length > 0) {
        const row = inserted[0];
        const itemObj: InventoryItem = {
          id: row.id,
          code: row.code,
          name: row.name,
          category: row.category as any,
          uom: row.uom,
          currentStock: Number(row.currentStock),
          minStockThreshold: Number(row.minStockThreshold),
          costPerUnit: Number(row.costPerUnit || 0),
          storageLocation: row.storageLocation || "Central Store",
          imageUrl: normalizeImageUrl(row.imageUrl, row.updatedAt),
          packagingType: row.packagingType || "DIRECT",
          packUnit: row.packUnit || undefined,
          unitsPerPack: row.unitsPerPack ? Number(row.unitsPerPack) : undefined,
          cartonUnit: row.cartonUnit || undefined,
          packsPerCarton: row.packsPerCarton ? Number(row.packsPerCarton) : undefined,
          isVariablePack: Boolean(row.isVariablePack),
          inUseQuantity: Number(row.inUseQuantity || 0),
          inUseUnit: row.inUseUnit || undefined,
          recipeUom: row.recipeUom || undefined,
          portionsPerContainer: row.portionsPerContainer ? Number(row.portionsPerContainer) : undefined,
          inUseRemainingPortions: Number(row.inUseRemainingPortions || 0),
          isActive: row.isActive,
        };
        INVENTORY_ITEMS.unshift(itemObj);
        return itemObj;
      }
    } catch (err: any) {
      if (err.message && err.message.includes("already exists")) throw err;
      console.error("DB error in createInventoryItem:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  if (shouldDisableMocks) {
    throw new Error("Cannot create inventory item: Database connection is unavailable.");
  }

  if (INVENTORY_ITEMS.some((i) => i.code === codeTrimmed)) {
    throw new Error(`Item code ${codeTrimmed} already exists.`);
  }

  const newItem: InventoryItem = {
    id: `item-${Date.now()}`,
    code: codeTrimmed,
    name: data.name.trim(),
    category: data.category,
    uom: data.uom.trim(),
    currentStock: Number(data.currentStock) || 0,
    minStockThreshold: Number(data.minStockThreshold) || 10,
    costPerUnit: Number(data.costPerUnit) || 0,
    storageLocation: data.storageLocation?.trim() || "Central Store",
    imageUrl: normalizeImageUrl(data.imageUrl),
    packagingType: data.packagingType || "DIRECT",
    packUnit: data.packUnit?.trim() || undefined,
    unitsPerPack: data.unitsPerPack ? Number(data.unitsPerPack) : undefined,
    cartonUnit: data.cartonUnit?.trim() || undefined,
    packsPerCarton: data.packsPerCarton ? Number(data.packsPerCarton) : undefined,
    isVariablePack: Boolean(data.isVariablePack),
    inUseQuantity: Number(data.inUseQuantity || 0),
    inUseUnit: data.inUseUnit?.trim() || undefined,
    isActive: true,
  };

  INVENTORY_ITEMS.unshift(newItem);
  return newItem;
}

export async function updateInventoryItem(id: string, data: Partial<InventoryItem>) {
  if (db) {
    try {
      const updatePayload: any = { updatedAt: new Date() };
      if (data.name) updatePayload.name = data.name.trim();
      if (data.category) updatePayload.category = data.category;
      if (data.uom) updatePayload.uom = data.uom.trim();
      if (data.currentStock !== undefined) updatePayload.currentStock = Number(data.currentStock).toFixed(3);
      if (data.minStockThreshold !== undefined) updatePayload.minStockThreshold = Number(data.minStockThreshold).toFixed(3);
      if (data.costPerUnit !== undefined) updatePayload.costPerUnit = Number(data.costPerUnit).toFixed(2);
      if (data.storageLocation) updatePayload.storageLocation = data.storageLocation.trim();
      if (data.imageUrl !== undefined) updatePayload.imageUrl = normalizeImageUrl(data.imageUrl, updatePayload.updatedAt) || null;
      if (data.packagingType !== undefined) updatePayload.packagingType = data.packagingType;
      if (data.packUnit !== undefined) updatePayload.packUnit = data.packUnit ? data.packUnit.trim() : null;
      if (data.unitsPerPack !== undefined) updatePayload.unitsPerPack = data.unitsPerPack ? Number(data.unitsPerPack).toFixed(3) : null;
      if (data.cartonUnit !== undefined) updatePayload.cartonUnit = data.cartonUnit ? data.cartonUnit.trim() : null;
      if (data.packsPerCarton !== undefined) updatePayload.packsPerCarton = data.packsPerCarton ? Number(data.packsPerCarton).toFixed(3) : null;
      if (data.isVariablePack !== undefined) updatePayload.isVariablePack = Boolean(data.isVariablePack);
      if (data.inUseQuantity !== undefined) updatePayload.inUseQuantity = Number(data.inUseQuantity).toFixed(3);
      if (data.inUseUnit !== undefined) updatePayload.inUseUnit = data.inUseUnit ? data.inUseUnit.trim() : null;
      if (data.recipeUom !== undefined) updatePayload.recipeUom = data.recipeUom ? data.recipeUom.trim() : null;
      if (data.portionsPerContainer !== undefined) updatePayload.portionsPerContainer = data.portionsPerContainer ? Number(data.portionsPerContainer).toFixed(3) : null;
      if (data.inUseRemainingPortions !== undefined) updatePayload.inUseRemainingPortions = Number(data.inUseRemainingPortions).toFixed(3);
      if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const targetCode = (data.code || id).trim().toUpperCase();

      let existingRow: any = null;
      if (isUuid) {
        const rows = await db.select().from(schema.items).where(eq(schema.items.id, id)).limit(1);
        if (rows.length > 0) existingRow = rows[0];
      }
      if (!existingRow) {
        const rows = await db.select().from(schema.items).where(eq(schema.items.code, targetCode)).limit(1);
        if (rows.length > 0) existingRow = rows[0];
      }

      if (existingRow) {
        const updatedRows = await db.update(schema.items).set(updatePayload).where(eq(schema.items.id, existingRow.id)).returning();
        if (updatedRows.length > 0) {
          const row = updatedRows[0];
          const itemObj: InventoryItem = {
            id: row.id,
            code: row.code,
            name: row.name,
            category: row.category as any,
            uom: row.uom,
            currentStock: Number(row.currentStock),
            minStockThreshold: Number(row.minStockThreshold),
            costPerUnit: Number(row.costPerUnit || 0),
            storageLocation: row.storageLocation || "Central Store",
            imageUrl: normalizeImageUrl(row.imageUrl, row.updatedAt),
            packagingType: row.packagingType || "DIRECT",
            packUnit: row.packUnit || undefined,
            unitsPerPack: row.unitsPerPack ? Number(row.unitsPerPack) : undefined,
            cartonUnit: row.cartonUnit || undefined,
            packsPerCarton: row.packsPerCarton ? Number(row.packsPerCarton) : undefined,
            isVariablePack: Boolean(row.isVariablePack),
            inUseQuantity: Number(row.inUseQuantity || 0),
            inUseUnit: row.inUseUnit || undefined,
            recipeUom: row.recipeUom || undefined,
            portionsPerContainer: row.portionsPerContainer ? Number(row.portionsPerContainer) : undefined,
            inUseRemainingPortions: Number(row.inUseRemainingPortions || 0),
            isActive: row.isActive,
          };
          const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id || i.id === row.id || i.code === row.code);
          if (idx !== -1) {
            INVENTORY_ITEMS[idx] = itemObj;
          } else {
            INVENTORY_ITEMS.unshift(itemObj);
          }
          return itemObj;
        }
      } else {
        if (!shouldDisableMocks) {
          const seedItem = INVENTORY_ITEMS.find((i) => i.id === id || i.code === targetCode);
          if (seedItem) {
            const merged = { ...seedItem, ...data };
            const inserted = await db.insert(schema.items).values({
              code: merged.code,
              name: merged.name,
              category: merged.category,
              uom: merged.uom,
              currentStock: Number(merged.currentStock || 0).toFixed(3),
              minStockThreshold: Number(merged.minStockThreshold || 10).toFixed(3),
              costPerUnit: Number(merged.costPerUnit || 0).toFixed(2),
              storageLocation: merged.storageLocation || "Central Store",
              imageUrl: normalizeImageUrl(merged.imageUrl) || null,
              packagingType: merged.packagingType || "DIRECT",
              packUnit: merged.packUnit || null,
              unitsPerPack: merged.unitsPerPack ? Number(merged.unitsPerPack).toFixed(3) : null,
              cartonUnit: merged.cartonUnit || null,
              packsPerCarton: merged.packsPerCarton ? Number(merged.packsPerCarton).toFixed(3) : null,
              isVariablePack: Boolean(merged.isVariablePack),
              inUseQuantity: Number(merged.inUseQuantity || 0).toFixed(3),
              inUseUnit: merged.inUseUnit || null,
              isActive: merged.isActive ?? true,
            }).returning();
            if (inserted.length > 0) {
              const row = inserted[0];
              const itemObj: InventoryItem = {
                id: row.id,
                code: row.code,
                name: row.name,
                category: row.category as any,
                uom: row.uom,
                currentStock: Number(row.currentStock),
                minStockThreshold: Number(row.minStockThreshold),
                costPerUnit: Number(row.costPerUnit || 0),
                storageLocation: row.storageLocation || "Central Store",
                imageUrl: normalizeImageUrl(row.imageUrl, row.updatedAt),
                packagingType: row.packagingType || "DIRECT",
                packUnit: row.packUnit || undefined,
                unitsPerPack: row.unitsPerPack ? Number(row.unitsPerPack) : undefined,
                cartonUnit: row.cartonUnit || undefined,
                packsPerCarton: row.packsPerCarton ? Number(row.packsPerCarton) : undefined,
                isVariablePack: Boolean(row.isVariablePack),
                inUseQuantity: Number(row.inUseQuantity || 0),
                inUseUnit: row.inUseUnit || undefined,
                isActive: row.isActive,
              };
              const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id);
              if (idx !== -1) {
                INVENTORY_ITEMS[idx] = itemObj;
              } else {
                INVENTORY_ITEMS.unshift(itemObj);
              }
              return itemObj;
            }
          }
        }
      }
    } catch (err) {
      console.error("DB error in updateInventoryItem:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  if (shouldDisableMocks) {
    throw new Error(`Item not found for update: ${id}`);
  }

  const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id);
  if (idx !== -1) {
    const item = INVENTORY_ITEMS[idx];
    INVENTORY_ITEMS[idx] = {
      ...item,
      ...data,
      imageUrl: data.imageUrl !== undefined ? normalizeImageUrl(data.imageUrl) : item.imageUrl,
      code: data.code ? data.code.trim().toUpperCase() : item.code,
      inUseQuantity: data.inUseQuantity !== undefined ? Number(data.inUseQuantity) : item.inUseQuantity,
      inUseUnit: data.inUseUnit !== undefined ? data.inUseUnit : item.inUseUnit,
      recipeUom: data.recipeUom !== undefined ? data.recipeUom : item.recipeUom,
      portionsPerContainer: data.portionsPerContainer !== undefined ? (data.portionsPerContainer ? Number(data.portionsPerContainer) : undefined) : item.portionsPerContainer,
      inUseRemainingPortions: data.inUseRemainingPortions !== undefined ? Number(data.inUseRemainingPortions) : item.inUseRemainingPortions,
    };
    return INVENTORY_ITEMS[idx];
  }
  return { id, ...data } as any;
}

export async function deleteInventoryItem(id: string) {
  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const condition = isUuid
        ? eq(schema.items.id, id)
        : eq(schema.items.code, id.toUpperCase());
      const res = await db.update(schema.items).set({ isActive: false, updatedAt: new Date() }).where(condition).returning();
      if (res.length > 0) {
        const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id || i.id === res[0].id || i.code === res[0].code);
        if (idx !== -1) INVENTORY_ITEMS.splice(idx, 1);
        return res[0];
      }
    } catch (err) {
      console.error("DB error in deleteInventoryItem:", err);
      if (shouldDisableMocks) throw err;
    }
  }
  if (shouldDisableMocks) {
    return { id, success: false };
  }
  const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id);
  if (idx !== -1) {
    return INVENTORY_ITEMS.splice(idx, 1)[0];
  }
  return { id } as any;
}

export async function createProductRecipe(data: {
  code: string;
  name: string;
  description?: string;
  imageUrl?: string;
  yieldQuantity: number;
  yieldUnit: string;
  ingredients: {
    itemCode: string;
    itemName: string;
    quantityRequired: number;
    uom: string;
    recipeUom?: string;
  }[];
}) {
  const codeTrimmed = data.code.trim().toUpperCase();

  if (db) {
    try {
      const existing = await db
        .select()
        .from(schema.productRecipes)
        .where(eq(schema.productRecipes.code, codeTrimmed))
        .limit(1);

      if (existing.length > 0) {
        throw new Error(`Recipe code ${codeTrimmed} already exists.`);
      }

      let inserted: any = null;
      try {
        const [res] = await db
          .insert(schema.productRecipes)
          .values({
            code: codeTrimmed,
            name: data.name.trim(),
            description: data.description?.trim() || null,
            imageUrl: data.imageUrl || null,
            yieldQuantity: Number(data.yieldQuantity) || 1,
            yieldUnit: data.yieldUnit.trim() || "unit",
          })
          .returning();
        inserted = res;
      } catch (insertErr: any) {
        if (insertErr.message && (insertErr.message.includes("image_url") || insertErr.message.includes("does not exist"))) {
          await ensureSchemaColumns();
          const [retryRes] = await db
            .insert(schema.productRecipes)
            .values({
              code: codeTrimmed,
              name: data.name.trim(),
              description: data.description?.trim() || null,
              imageUrl: data.imageUrl || null,
              yieldQuantity: Number(data.yieldQuantity) || 1,
              yieldUnit: data.yieldUnit.trim() || "unit",
            })
            .returning();
          inserted = retryRes;
        } else {
          throw insertErr;
        }
      }

      if (data.ingredients && data.ingredients.length > 0) {
        for (const ing of data.ingredients) {
          const foundItem = await db
            .select()
            .from(schema.items)
            .where(eq(schema.items.code, ing.itemCode))
            .limit(1);

          if (foundItem.length > 0) {
            await db.insert(schema.recipeIngredients).values({
              recipeId: inserted.id,
              itemId: foundItem[0].id,
              quantityRequired: Number(ing.quantityRequired).toFixed(3),
              uom: ing.uom || foundItem[0].uom,
              recipeUom: ing.recipeUom || ing.uom || foundItem[0].recipeUom || foundItem[0].uom,
            });
          }
        }
      }

      const created: ProductRecipe = {
        id: inserted.id,
        code: inserted.code,
        name: inserted.name,
        description: inserted.description || undefined,
        imageUrl: inserted.imageUrl || undefined,
        yieldQuantity: inserted.yieldQuantity,
        yieldUnit: inserted.yieldUnit,
        ingredients: data.ingredients || [],
      };

      PRODUCT_RECIPES.unshift(created);
      return created;
    } catch (err: any) {
      if (err.message && err.message.includes("already exists")) {
        throw err;
      }
      console.error("DB error in createProductRecipe:", err);
      throw err;
    }
  }

  if (PRODUCT_RECIPES.some((r) => r.code === codeTrimmed)) {
    throw new Error(`Recipe code ${codeTrimmed} already exists.`);
  }

  const newRecipe: ProductRecipe = {
    id: `rec-${Date.now()}`,
    code: codeTrimmed,
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    imageUrl: data.imageUrl || undefined,
    yieldQuantity: Number(data.yieldQuantity) || 1,
    yieldUnit: data.yieldUnit.trim() || "unit",
    ingredients: data.ingredients || [],
  };

  PRODUCT_RECIPES.unshift(newRecipe);
  return newRecipe;
}

export async function updateProductRecipe(id: string, data: Partial<ProductRecipe>) {
  const codeTrimmed = data.code ? data.code.trim().toUpperCase() : undefined;

  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const recipeCondition = isUuid
        ? or(eq(schema.productRecipes.id, id), eq(schema.productRecipes.code, id))
        : eq(schema.productRecipes.code, id);

      const existing = await db
        .select()
        .from(schema.productRecipes)
        .where(recipeCondition)
        .limit(1);

      if (existing.length > 0) {
        const recipeDbId = existing[0].id;
        const updateValues: Record<string, any> = {};
        if (codeTrimmed) updateValues.code = codeTrimmed;
        if (data.name) updateValues.name = data.name.trim();
        if (data.description !== undefined) updateValues.description = data.description?.trim() || null;
        if (data.imageUrl !== undefined) updateValues.imageUrl = data.imageUrl || null;
        if (data.yieldQuantity !== undefined) updateValues.yieldQuantity = Number(data.yieldQuantity) || 1;
        if (data.yieldUnit !== undefined) updateValues.yieldUnit = data.yieldUnit.trim() || "unit";

        if (Object.keys(updateValues).length > 0) {
          try {
            await db
              .update(schema.productRecipes)
              .set(updateValues)
              .where(eq(schema.productRecipes.id, recipeDbId));
          } catch (updateErr: any) {
            if (updateErr.message && (updateErr.message.includes("image_url") || updateErr.message.includes("does not exist"))) {
              await ensureSchemaColumns();
              await db
                .update(schema.productRecipes)
                .set(updateValues)
                .where(eq(schema.productRecipes.id, recipeDbId));
            } else {
              throw updateErr;
            }
          }
        }

        if (data.ingredients && Array.isArray(data.ingredients)) {
          await db.delete(schema.recipeIngredients).where(eq(schema.recipeIngredients.recipeId, recipeDbId));
          for (const ing of data.ingredients) {
            const foundItem = await db
              .select()
              .from(schema.items)
              .where(eq(schema.items.code, ing.itemCode))
              .limit(1);

            if (foundItem.length > 0) {
              await db.insert(schema.recipeIngredients).values({
                recipeId: recipeDbId,
                itemId: foundItem[0].id,
                quantityRequired: Number(ing.quantityRequired).toFixed(3),
                uom: ing.uom || foundItem[0].uom,
                recipeUom: ing.recipeUom || ing.uom || foundItem[0].recipeUom || foundItem[0].uom,
              });
            }
          }
        }

        const allRecipes = await getProductRecipes();
        const found = allRecipes.find((r) => r.id === recipeDbId || (codeTrimmed && r.code === codeTrimmed));
        if (found) {
          const idx = PRODUCT_RECIPES.findIndex((r) => r.id === recipeDbId || r.code === codeTrimmed);
          if (idx !== -1) {
            PRODUCT_RECIPES[idx] = found;
          }
          return found;
        }
      }
    } catch (err) {
      console.error("DB error in updateProductRecipe:", err);
      throw err;
    }
  }

  const idx = PRODUCT_RECIPES.findIndex((r) => r.id === id || r.code === id);
  if (idx !== -1) {
    PRODUCT_RECIPES[idx] = {
      ...PRODUCT_RECIPES[idx],
      ...data,
      code: codeTrimmed || PRODUCT_RECIPES[idx].code,
    };
    return PRODUCT_RECIPES[idx];
  }

  throw new Error(`Recipe not found: ${id}`);
}

export async function deleteProductRecipe(id: string) {
  let deletedItem: ProductRecipe | null = null;
  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const recipeCondition = isUuid
        ? or(eq(schema.productRecipes.id, id), eq(schema.productRecipes.code, id))
        : eq(schema.productRecipes.code, id);

      const existing = await db
        .select()
        .from(schema.productRecipes)
        .where(recipeCondition)
        .limit(1);

      if (existing.length > 0) {
        const recipeDbId = existing[0].id;
        deletedItem = {
          id: existing[0].id,
          code: existing[0].code,
          name: existing[0].name,
          description: existing[0].description || undefined,
          imageUrl: existing[0].imageUrl || undefined,
          yieldQuantity: existing[0].yieldQuantity,
          yieldUnit: existing[0].yieldUnit,
          ingredients: [],
        };
        await db.delete(schema.recipeIngredients).where(eq(schema.recipeIngredients.recipeId, recipeDbId));
        await db.delete(schema.productRecipes).where(eq(schema.productRecipes.id, recipeDbId));
      }
    } catch (err) {
      console.error("DB error in deleteProductRecipe:", err);
      throw err;
    }
  }

  const idx = PRODUCT_RECIPES.findIndex((r) => r.id === id || r.code === id);
  if (idx !== -1) {
    return PRODUCT_RECIPES.splice(idx, 1)[0];
  }

  return deletedItem || ({ id, success: true } as any);
}

export async function calculateRecipeRequirements(recipeCode: string, batchQuantity: number) {
  const recipes = await getProductRecipes();
  const recipe = recipes.find((r) => r.code === recipeCode);
  if (!recipe) throw new Error(`Recipe not found for code: ${recipeCode}`);

  const factor = batchQuantity / recipe.yieldQuantity;
  const items = await getInventoryItems();

  const requiredIngredients = recipe.ingredients.map((ing) => {
    const totalRequired = Number((ing.quantityRequired * factor).toFixed(3));
    const currentItem = items.find((i) => i.code === ing.itemCode);
    const availableStock = currentItem?.currentStock || 0;
    const isVariable = Boolean(currentItem?.isVariablePack);

    if (isVariable && currentItem) {
      const isSufficient = availableStock > 0;
      return {
        itemCode: ing.itemCode,
        itemName: ing.itemName,
        unitRequired: totalRequired,
        uom: ing.uom,
        availableStock,
        isSufficient,
        shortfall: isSufficient ? 0 : 1,
        isVariable: true,
        recipeUom: ing.recipeUom || currentItem.recipeUom || ing.uom,
        containerUom: currentItem.uom,
      };
    }

    const isSufficient = availableStock >= totalRequired;
    return {
      itemCode: ing.itemCode,
      itemName: ing.itemName,
      unitRequired: totalRequired,
      uom: ing.uom,
      availableStock,
      isSufficient,
      shortfall: isSufficient ? 0 : Number((totalRequired - availableStock).toFixed(3)),
      isVariable: false,
    };
  });

  const allAvailable = requiredIngredients.every((ing) => ing.isSufficient);

  return {
    recipe,
    batchQuantity,
    requiredIngredients,
    allAvailable,
  };
}

export async function receiveAdHocIntake(data: {
  itemCode: string;
  quantity: number;
  lotNumber: string;
  supplierName: string;
  expiryDate?: string;
  unitCost?: number;
  grnNumber?: string;
  waybillUrl?: string;
  performedByName: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  notes?: string;
}) {
  if (db) {
    try {
      const found = await db.select().from(schema.items).where(eq(schema.items.code, data.itemCode)).limit(1);
      if (found.length > 0) {
        const itemRow = found[0];
        const updatedStock = (Number(itemRow.currentStock) + data.quantity).toFixed(3);
        await db.update(schema.items).set({
          currentStock: updatedStock,
          costPerUnit: (data.unitCost || Number(itemRow.costPerUnit || 0)).toFixed(2),
          updatedAt: new Date(),
        }).where(eq(schema.items.id, itemRow.id));

        const grn = data.grnNumber || `GRN-${Date.now().toString().slice(-4)}`;
        const insertedLot = await db.insert(schema.itemLots).values({
          itemId: itemRow.id,
          lotNumber: data.lotNumber,
          supplierName: data.supplierName,
          initialQuantity: data.quantity.toFixed(3),
          remainingQuantity: data.quantity.toFixed(3),
          unitCost: (data.unitCost || Number(itemRow.costPerUnit || 0)).toFixed(2),
          grnNumber: grn,
          waybillUrl: data.waybillUrl,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        }).returning();

        const insertedTxn = await db.insert(schema.stockTransactions).values({
          itemId: itemRow.id,
          lotId: insertedLot[0]?.id,
          transactionType: "INBOUND_PURCHASE",
          quantity: data.quantity.toFixed(3),
          unit: itemRow.uom,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          referenceId: grn,
          notes: data.notes || `Ad-hoc supplier delivery from ${data.supplierName}. Lot #${data.lotNumber}`,
        }).returning();

        eventBus.publish(
          "INVENTORY_INTAKE_RECORDED",
          {
            itemCode: itemRow.code,
            itemName: itemRow.name,
            quantity: data.quantity,
            uom: itemRow.uom,
            supplier: data.supplierName,
            grnNumber: grn,
            lotNumber: data.lotNumber,
          },
          data.performedByName,
          "INVENTORY_STORE"
        );

        return {
          success: true,
          item: {
            id: itemRow.id,
            code: itemRow.code,
            name: itemRow.name,
            category: itemRow.category as any,
            uom: itemRow.uom,
            currentStock: Number(updatedStock),
            minStockThreshold: Number(itemRow.minStockThreshold),
            costPerUnit: data.unitCost || Number(itemRow.costPerUnit || 0),
            storageLocation: itemRow.storageLocation || "Central Store",
            isActive: itemRow.isActive,
          },
          lot: insertedLot[0],
          transaction: insertedTxn[0],
        };
      }
    } catch (err) {
      console.error("DB error in receiveAdHocIntake:", err);
      if (shouldDisableMocks) throw err;
    }
    if (shouldDisableMocks) {
      throw new Error(`Item not found with code: ${data.itemCode}`);
    }
  }

  if (shouldDisableMocks) {
    throw new Error(`Item not found with code: ${data.itemCode}`);
  }

  const item = INVENTORY_ITEMS.find((i) => i.code === data.itemCode);
  if (!item) throw new Error(`Item not found with code: ${data.itemCode}`);

  // Increment stock
  item.currentStock = Number((item.currentStock + data.quantity).toFixed(3));

  // Record Lot
  const newLot: ItemLot = {
    id: `lot-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    lotNumber: data.lotNumber,
    supplierName: data.supplierName,
    arrivalDate: new Date().toISOString(),
    expiryDate: data.expiryDate,
    initialQuantity: data.quantity,
    remainingQuantity: data.quantity,
    unitCost: data.unitCost || item.costPerUnit,
    grnNumber: data.grnNumber || `GRN-${Date.now().toString().slice(-4)}`,
    waybillUrl: data.waybillUrl,
  };
  ITEM_LOTS.unshift(newLot);

  // Record transaction
  const txn: StockTransaction = {
    id: `txn-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "INBOUND_PURCHASE",
    quantity: data.quantity,
    unit: item.uom,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    referenceId: newLot.grnNumber,
    notes: data.notes || `Ad-hoc supplier delivery from ${data.supplierName}. Lot #${data.lotNumber}`,
    createdAt: new Date().toISOString(),
  };
  TRANSACTIONS.unshift(txn);

  eventBus.publish(
    "INVENTORY_INTAKE_RECORDED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: item.uom,
      supplier: data.supplierName,
      grnNumber: newLot.grnNumber,
      lotNumber: data.lotNumber,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return { success: true, item, lot: newLot, transaction: txn };
}

export interface DispenseCustomIngredient {
  itemCode: string;
  quantity: number;
  itemName?: string;
  uom?: string;
  notes?: string;
}

export async function dispenseBatchToProduction(data: {
  recipeCode: string;
  batchQuantity: number;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  notes?: string;
  customIngredients?: DispenseCustomIngredient[];
}) {
  const recipes = await getProductRecipes();
  const recipe = recipes.find((r) => r.code === data.recipeCode);
  if (!recipe) throw new Error(`Recipe not found for code: ${data.recipeCode}`);

  const batchRef = `BATCH-${data.recipeCode.replace("REC-", "").replace("PROD-", "")}-${Date.now().toString().slice(-4)}`;
  const recordedTxns: StockTransaction[] = [];
  const items = await getInventoryItems();

  if (data.customIngredients && Array.isArray(data.customIngredients)) {
    // Custom ingredient list provided (user may have modified quantities or excluded/removed items)
    const activeCustom = data.customIngredients.filter((ci) => Number(ci.quantity) > 0);

    if (activeCustom.length === 0) {
      throw new Error("Cannot dispense batch: at least 1 ingredient must have a quantity greater than 0.");
    }
    // Validate sufficient stock for all included items
    const shortfalls: string[] = [];
    for (const ci of activeCustom) {
      const item = items.find((i) => i.code === ci.itemCode);
      if (!item) {
        shortfalls.push(`Unknown item SKU: ${ci.itemCode}`);
        continue;
      }
      const qtyRequired = Number(ci.quantity);
      if (item.isVariablePack) {
        if (item.currentStock <= 0) {
          shortfalls.push(`${item.name} (Out of stock: 0 ${item.uom} available in storage)`);
        }
      } else if (item.currentStock < qtyRequired) {
        shortfalls.push(
          `${item.name} (Required: ${qtyRequired} ${item.uom}, Available: ${item.currentStock} ${item.uom})`
        );
      }
    }

    if (shortfalls.length > 0) {
      throw new Error(`Insufficient stock to dispense batch: ${shortfalls.join("; ")}`);
    }

    // Deduct stock and record individual transactions
    const dispensedList: {
      itemCode: string;
      itemName: string;
      unitRequired: number;
      uom: string;
      availableStock: number;
      isSufficient: boolean;
      shortfall: number;
    }[] = [];
    const variableItemsUsed: any[] = [];

    for (const ci of activeCustom) {
      const item = items.find((i) => i.code === ci.itemCode)!;
      const isVariable = Boolean(item.isVariablePack);
      const standardRecipeIng = recipe.ingredients.find((ri) => ri.itemCode === ci.itemCode);
      const isCustomAmount = standardRecipeIng
        ? Number((standardRecipeIng.quantityRequired * (data.batchQuantity / recipe.yieldQuantity)).toFixed(3)) !== Number(ci.quantity)
        : true;

      let qtyDeducted = Number(ci.quantity);
      let noteText = ci.notes || data.notes || `Dispensed for ${data.batchQuantity}x ${recipe.name}${isCustomAmount ? " (Custom quantity)" : ""}.`;
      let txQuantity = -qtyDeducted;

      if (isVariable) {
        variableItemsUsed.push({
          id: item.id,
          code: item.code,
          name: item.name,
          currentStock: item.currentStock,
          uom: item.uom,
          recipeUom: item.recipeUom || ci.uom,
          quantityDispensed: Number(ci.quantity),
          dispensedUom: ci.uom || item.recipeUom || item.uom,
        });

        // For variable products, don't deduct stock automatically.
        // A dedicated physical count modal after dispatch will capture actual remaining stock in storage UoM.
        qtyDeducted = 0;
        txQuantity = 0;
        const portionUnit = ci.uom || item.recipeUom || "pcs";
        noteText = `${noteText} [Variable material: ${ci.quantity} ${portionUnit} dished for production. Pending remaining stock confirmation]`;
      } else {
        item.currentStock = Number((item.currentStock - qtyDeducted).toFixed(3));
        const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code);
        if (inMem) inMem.currentStock = item.currentStock;
      }

      const txn: StockTransaction = {
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        itemId: item.id,
        itemName: item.name,
        transactionType: "DISPENSE_PRODUCTION",
        quantity: txQuantity,
        unit: isVariable && ci.uom ? ci.uom : item.uom,
        shiftType: data.shiftType,
        performedByName: data.performedByName,
        recipient: data.recipient,
        referenceId: batchRef,
        notes: noteText,
        status: "PENDING_HANDOVER",
        createdAt: new Date().toISOString(),
      };

      if (db) {
        try {
          const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
          if (found.length > 0) {
            if (!isVariable) {
              await db.update(schema.items).set({
                currentStock: item.currentStock.toFixed(3),
                updatedAt: new Date(),
              }).where(eq(schema.items.id, found[0].id));
            }

            await db.insert(schema.stockTransactions).values({
              itemId: found[0].id,
              transactionType: "DISPENSE_PRODUCTION",
              quantity: txQuantity.toFixed(3),
              unit: isVariable && ci.uom ? ci.uom : item.uom,
              shiftType: data.shiftType,
              performedByName: data.performedByName,
              recipient: data.recipient,
              referenceId: batchRef,
              notes: noteText,
              status: "PENDING_HANDOVER",
            });
          }
        } catch (err) {
          console.error("DB error in dispensing item:", err);
        }
      }

      TRANSACTIONS.unshift(txn);
      recordedTxns.push(txn);

      dispensedList.push({
        itemCode: item.code,
        itemName: item.name,
        unitRequired: isVariable ? Number(ci.quantity) : qtyDeducted,
        uom: isVariable && ci.uom ? ci.uom : item.uom,
        availableStock: item.currentStock,
        isSufficient: true,
        shortfall: 0,
      });
    }

    eventBus.publish(
      "INVENTORY_BATCH_DISPENSED",
      {
        recipeCode: recipe.code,
        recipeName: recipe.name,
        batchQuantity: data.batchQuantity,
        recipient: data.recipient,
        referenceId: batchRef,
        materialsCount: activeCustom.length,
      },
      data.performedByName,
      "INVENTORY_STORE"
    );

    return {
      success: true,
      batchReference: batchRef,
      recipeName: recipe.name,
      batchQuantity: data.batchQuantity,
      dispensedIngredients: dispensedList,
      transactions: recordedTxns,
      variableItems: variableItemsUsed,
    };
  }

  // Fallback: standard BOM calculation
  const calculation = await calculateRecipeRequirements(data.recipeCode, data.batchQuantity);

  if (!calculation.allAvailable) {
    const missing = calculation.requiredIngredients
      .filter((i) => !i.isSufficient)
      .map((i) => `${i.itemName} (Shortfall: ${i.shortfall} ${i.uom})`)
      .join(", ");
    throw new Error(`Insufficient stock to dispense batch: ${missing}`);
  }

  const dispensedList: {
    itemCode: string;
    itemName: string;
    unitRequired: number;
    uom: string;
    availableStock: number;
    isSufficient: boolean;
    shortfall: number;
  }[] = [];
  const variableItemsUsed: any[] = [];

  for (const ing of calculation.requiredIngredients) {
    const item = items.find((i) => i.code === ing.itemCode);
    if (!item) continue;

    const isVariable = Boolean(item.isVariablePack);
    let qtyDeducted = ing.unitRequired;
    let noteText = data.notes || `Dispensed for ${data.batchQuantity}x ${calculation.recipe.name}.`;
    let txQuantity = -qtyDeducted;

    if (isVariable) {
      variableItemsUsed.push({
        id: item.id,
        code: item.code,
        name: item.name,
        currentStock: item.currentStock,
        uom: item.uom,
        recipeUom: item.recipeUom || ing.uom,
        quantityDispensed: Number(ing.unitRequired),
        dispensedUom: ing.uom || item.recipeUom || item.uom,
      });

      qtyDeducted = 0;
      txQuantity = 0;
      const portionUnit = ing.uom || item.recipeUom || "pcs";
      noteText = `${noteText} [Variable material: ${ing.unitRequired} ${portionUnit} dished for production. Pending remaining stock confirmation]`;
    } else {
      item.currentStock = Number((item.currentStock - qtyDeducted).toFixed(3));
      const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code);
      if (inMem) inMem.currentStock = item.currentStock;
    }

    const txn: StockTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      itemId: item.id,
      itemName: item.name,
      transactionType: "DISPENSE_PRODUCTION",
      quantity: txQuantity,
      unit: isVariable && ing.uom ? ing.uom : item.uom,
      shiftType: data.shiftType,
      performedByName: data.performedByName,
      recipient: data.recipient,
      referenceId: batchRef,
      notes: noteText,
      status: "PENDING_HANDOVER",
      createdAt: new Date().toISOString(),
    };

    if (db) {
      try {
        const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
        if (found.length > 0) {
          if (!isVariable) {
            await db.update(schema.items).set({
              currentStock: item.currentStock.toFixed(3),
              updatedAt: new Date(),
            }).where(eq(schema.items.id, found[0].id));
          }

          await db.insert(schema.stockTransactions).values({
            itemId: found[0].id,
            transactionType: "DISPENSE_PRODUCTION",
            quantity: txQuantity.toFixed(3),
            unit: isVariable && ing.uom ? ing.uom : item.uom,
            shiftType: data.shiftType,
            performedByName: data.performedByName,
            recipient: data.recipient,
            referenceId: batchRef,
            notes: noteText,
            status: "PENDING_HANDOVER",
          });
        }
      } catch (err) {
        console.error("DB error in dispensing item:", err);
      }
    }

    TRANSACTIONS.unshift(txn);
    recordedTxns.push(txn);

    dispensedList.push({
      itemCode: item.code,
      itemName: item.name,
      unitRequired: isVariable ? Number(ing.unitRequired) : qtyDeducted,
      uom: isVariable && ing.uom ? ing.uom : item.uom,
      availableStock: item.currentStock,
      isSufficient: true,
      shortfall: 0,
    });
  }

  eventBus.publish(
    "INVENTORY_BATCH_DISPENSED",
    {
      recipeCode: calculation.recipe.code,
      recipeName: calculation.recipe.name,
      batchQuantity: data.batchQuantity,
      recipient: data.recipient,
      referenceId: batchRef,
      materialsCount: calculation.requiredIngredients.length,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    batchReference: batchRef,
    recipeName: calculation.recipe.name,
    batchQuantity: data.batchQuantity,
    dispensedIngredients: dispensedList,
    transactions: recordedTxns,
    variableItems: variableItemsUsed,
  };
}

/**
 * Event-Driven Depletion: Allows floor operators to immediately mark an active container empty
 * (e.g. Raisins, Glucose syrup scraped clean or finished ahead of theoretical math).
 * Optionally pops and activates the next sealed container from store stock.
 */
export async function markItemContainerDepleted(data: {
  itemCodeOrId: string;
  openNextContainer?: boolean;
  reason?: string;
  performedByName: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
}) {
  const items = await getInventoryItems();
  const clean = data.itemCodeOrId.trim();
  const item = items.find((i) => i.id === clean || i.code.toUpperCase() === clean.toUpperCase());
  if (!item) throw new Error(`Item not found: ${data.itemCodeOrId}`);

  const res = markContainerDepletedCalculation({
    item,
    openNextContainer: Boolean(data.openNextContainer),
    reason: data.reason || "Marked empty on production floor",
  });

  item.currentStock = res.sealedAfter;
  item.inUseQuantity = res.inUseQuantityAfter;
  item.inUseRemainingPortions = res.inUseRemainingPortionsAfter;

  const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code);
  if (inMem) {
    inMem.currentStock = item.currentStock;
    inMem.inUseQuantity = item.inUseQuantity;
    inMem.inUseRemainingPortions = item.inUseRemainingPortions;
  }

  if (db) {
    try {
      const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
      if (found.length > 0) {
        await db.update(schema.items).set({
          currentStock: item.currentStock.toFixed(3),
          inUseQuantity: Number(item.inUseQuantity || 0).toFixed(3),
          inUseRemainingPortions: Number(item.inUseRemainingPortions || 0).toFixed(3),
          updatedAt: new Date(),
        }).where(eq(schema.items.id, found[0].id));

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: "RECONCILIATION_ADJUST",
          quantity: (-res.sealedDeducted).toFixed(3),
          unit: item.uom,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          referenceId: `DEPLETE-${Date.now().toString().slice(-4)}`,
          notes: res.noteText,
          status: "PERMANENT",
        });
      }
    } catch (err) {
      console.error("DB error in markItemContainerDepleted:", err);
    }
  }

  const txn: StockTransaction = {
    id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "RECONCILIATION_ADJUST",
    quantity: -res.sealedDeducted,
    unit: item.uom,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    notes: res.noteText,
    status: "PERMANENT",
    createdAt: new Date().toISOString(),
  };

  TRANSACTIONS.unshift(txn);

  eventBus.publish(
    "ITEM_CONTAINER_DEPLETED",
    {
      itemCode: item.code,
      itemName: item.name,
      sealedStockRemaining: item.currentStock,
      inUseQuantity: item.inUseQuantity,
      openNext: data.openNextContainer,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    item,
    transaction: txn,
    message: res.noteText,
  };
}

export interface FloorLevelUpdateRequest {
  itemCode: string;
  newStock?: number;
  previousStock?: number;
  dispatchQuantity?: number;
  dispatchUom?: string;
  storageUom?: string;
  sealedContainersTaken?: number;
  inUseQuantity?: number;
  inUseRemainingPortions?: number;
  notes?: string;
  referenceId?: string;
}

/**
 * Updates variable item stock based on direct physical count reported by floor operators
 * following batch dispatch (e.g. 10 bottles in stock -> gave out 400 pcs -> remaining 8.5 bottles left).
 */
export async function updateVariableFloorLevels(data: {
  updates: FloorLevelUpdateRequest[];
  performedByName: string;
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT";
}) {
  const items = await getInventoryItems();
  const updatedItems: InventoryItem[] = [];
  const recordedTxns: StockTransaction[] = [];

  for (const update of data.updates) {
    const cleanCode = (update.itemCode || "").trim().toUpperCase();
    const item = items.find((i) => i.code.toUpperCase() === cleanCode || i.id === update.itemCode);
    if (!item) continue;

    const oldStock = item.currentStock;
    let newStock = oldStock;

    if (update.newStock !== undefined) {
      newStock = Math.max(0, Number(Number(update.newStock).toFixed(3)));
    } else if (update.sealedContainersTaken !== undefined) {
      newStock = Math.max(0, Number((oldStock - update.sealedContainersTaken).toFixed(3)));
    }

    const diff = Number((newStock - oldStock).toFixed(3));
    item.currentStock = newStock;
    item.inUseQuantity = 0;
    item.inUseRemainingPortions = 0;

    const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code || i.id === item.id);
    if (inMem) {
      inMem.currentStock = item.currentStock;
      inMem.inUseQuantity = 0;
      inMem.inUseRemainingPortions = 0;
    }

    const noteText = update.notes || `Post-dispatch stock confirmation: ${oldStock} -> ${newStock} ${item.uom}.`;
    const refCode = update.referenceId || `FLOOR-${Date.now().toString().slice(-4)}`;

    if (db) {
      try {
        const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
        if (found.length > 0) {
          await db.update(schema.items).set({
            currentStock: item.currentStock.toFixed(3),
            inUseQuantity: "0.000",
            inUseRemainingPortions: "0.000",
            updatedAt: new Date(),
          }).where(eq(schema.items.id, found[0].id));

          await db.insert(schema.stockTransactions).values({
            itemId: found[0].id,
            transactionType: "DISPENSE_PRODUCTION",
            quantity: diff.toFixed(3),
            unit: item.uom,
            shiftType: data.shiftType || "MORNING_SHIFT",
            performedByName: data.performedByName,
            recipient: "Production Floor",
            referenceId: refCode,
            notes: noteText,
            status: "PERMANENT",
          });
        }
      } catch (err) {
        console.error("DB error in updateVariableFloorLevels:", err);
      }
    }

    const txn: StockTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      itemId: item.id,
      itemName: item.name,
      transactionType: "DISPENSE_PRODUCTION",
      quantity: diff,
      unit: item.uom,
      shiftType: data.shiftType || "MORNING_SHIFT",
      performedByName: data.performedByName,
      recipient: "Production Floor",
      referenceId: refCode,
      notes: noteText,
      status: "PERMANENT",
      createdAt: new Date().toISOString(),
    };

    TRANSACTIONS.unshift(txn);
    recordedTxns.push(txn);
    updatedItems.push(item);
  }

  eventBus.publish(
    "INVENTORY_FLOOR_UPDATED",
    {
      updatedCount: updatedItems.length,
      performedByName: data.performedByName,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    updatedItems,
    transactions: recordedTxns,
  };
}

export async function dispenseIndividualItem(data: {
  itemCode: string;
  quantity: number;
  dispensedUom?: string;
  isVariableDispatch?: boolean;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  referenceId?: string;
  purpose?: string;
  notes?: string;
}) {
  const item = await getItemByCode(data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  const isVariable = Boolean(item.isVariablePack);
  const isVariableDispatch = Boolean(data.isVariableDispatch || (isVariable && data.dispensedUom && data.dispensedUom !== item.uom));
  const activeUnit = data.dispensedUom || (isVariableDispatch ? (item.recipeUom || item.uom) : item.uom);

  if (isVariableDispatch) {
    if (item.currentStock <= 0) {
      throw new Error(`Insufficient stock: ${item.name} is currently out of stock in storage (0 ${item.uom} available).`);
    }
  } else if (item.currentStock < data.quantity) {
    throw new Error(
      `Insufficient available store stock to dispense ${data.quantity} ${item.uom} of ${item.name} (Current balance: ${item.currentStock} ${item.uom}).`
    );
  }

  const refCode = data.referenceId || `IND-${Date.now().toString(36).toUpperCase()}`;
  let noteText = data.notes || data.purpose || `Individual material dispense to ${data.recipient}`;

  let newStock = item.currentStock;
  let txQuantity = -data.quantity;

  if (isVariableDispatch) {
    // For variable materials dished in recipe UoM (e.g. 5 cups), do not deduct storage containers.
    // Floor confirmation modal will prompt for remaining storage stock.
    noteText = `${noteText} [Variable Material: ${data.quantity} ${activeUnit} dished out. Pending remaining stock confirmation]`;
    txQuantity = 0;
  } else {
    newStock = Number((item.currentStock - data.quantity).toFixed(3));
    item.currentStock = newStock;
    item.inUseQuantity = 0;
    item.inUseRemainingPortions = 0;
  }

  const txn: StockTransaction = {
    id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "DISPENSE_INDIVIDUAL",
    quantity: txQuantity,
    unit: activeUnit,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: refCode,
    notes: noteText,
    status: "PENDING_HANDOVER",
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
      const condition = isUuid ? eq(schema.items.id, item.id) : eq(schema.items.code, item.code);
      const found = await db.select().from(schema.items).where(condition).limit(1);
      if (found.length > 0) {
        if (!isVariableDispatch) {
          await db.update(schema.items).set({
            currentStock: newStock.toFixed(3),
            inUseQuantity: "0.000",
            inUseRemainingPortions: "0.000",
            updatedAt: new Date(),
          }).where(eq(schema.items.id, found[0].id));
        }

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: "DISPENSE_PRODUCTION",
          quantity: txQuantity.toFixed(3),
          unit: activeUnit,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          recipient: data.recipient,
          referenceId: refCode,
          notes: noteText,
          status: "PENDING_HANDOVER",
        });
      }
    } catch (err) {
      console.error("DB error in dispenseIndividualItem:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code || i.id === item.id);
  if (inMem) {
    inMem.currentStock = newStock;
    inMem.inUseQuantity = 0;
    inMem.inUseRemainingPortions = 0;
  }

  if (!shouldDisableMocks) {
    TRANSACTIONS.unshift(txn);
  }

  eventBus.publish(
    "INVENTORY_INDIVIDUAL_DISPENSED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: activeUnit,
      recipient: data.recipient,
      purpose: data.purpose || "Direct material dispense",
      referenceId: refCode,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    item,
    quantity: data.quantity,
    dispensedUom: activeUnit,
    isVariable: isVariableDispatch,
    referenceId: refCode,
    transaction: txn,
  };
}

export async function cancelDispatch(referenceId: string, performedByName: string) {
  const cleanRef = referenceId.trim();
  // Find transactions associated with this dispatch reference
  let targetTxns = TRANSACTIONS.filter((t) => t.referenceId?.toLowerCase() === cleanRef.toLowerCase());

  if (db) {
    try {
      const dbTxns = await db
        .select()
        .from(schema.stockTransactions)
        .where(ilike(schema.stockTransactions.referenceId, cleanRef));

      if (dbTxns.length === 0 && targetTxns.length === 0) {
        throw new Error(`No active dispatch records found matching reference ID: ${referenceId}`);
      }

      if (dbTxns.length > 0) {
        // Reverse inventory impact
        for (const tx of dbTxns) {
          if (tx.status?.toUpperCase() === "PERMANENT") {
            throw new Error("This dispatch has already been permanently reconciled and handed over with the shift. It cannot be cancelled.");
          }
          if (tx.status?.toUpperCase() === "CANCELLED") {
            throw new Error("This dispatch is already cancelled.");
          }
          if (!isDispatchEditable(tx.createdAt, tx.shiftType as any, tx.status)) {
            const cutoff = getShiftHandoverCutoff(tx.createdAt, tx.shiftType as any);
            throw new Error(`Cancellation window closed: Shift dispatches are locked 2 hours after shift ends (locked at ${formatCutoffTime(cutoff)}).`);
          }

          const qty = Number(tx.quantity);
          const foundItem = await db.select().from(schema.items).where(eq(schema.items.id, tx.itemId)).limit(1);
          if (foundItem.length > 0) {
            const curItem = foundItem[0];
            const isVariable = Boolean(curItem.isVariablePack);

            let newStock = Number(curItem.currentStock);
            let newInUse = Number(curItem.inUseQuantity || 0);

            if (isVariable) {
              if ((tx.referenceId?.startsWith("IND-") || (tx.transactionType as string) === "DISPENSE_INDIVIDUAL") && qty < 0) {
                // Return to sealed stock, remove from in-use
                newStock = Number((newStock + Math.abs(qty)).toFixed(3));
                newInUse = Math.max(0, Number((newInUse - Math.abs(qty)).toFixed(3)));
              }
              // If batch recipe dispense, qty was 0 so no stock adjustment needed
            } else if (qty < 0) {
              newStock = Number((newStock + Math.abs(qty)).toFixed(3));
            }

            await db.update(schema.items).set({
              currentStock: newStock.toFixed(3),
              inUseQuantity: newInUse.toFixed(3),
              updatedAt: new Date(),
            }).where(eq(schema.items.id, curItem.id));

            // Also update in-memory
            const inMem = INVENTORY_ITEMS.find((i) => i.id === curItem.id || i.code === curItem.code);
            if (inMem) {
              inMem.currentStock = newStock;
              inMem.inUseQuantity = newInUse;
            }
          }
        }

        // Mark DB transactions as CANCELLED
        await db
          .update(schema.stockTransactions)
          .set({
            status: "CANCELLED",
            notes: `[CANCELLED by ${performedByName} at ${new Date().toLocaleTimeString()}]: ${dbTxns[0]?.notes || ""}`,
          })
          .where(ilike(schema.stockTransactions.referenceId, cleanRef));
      }
    } catch (err: any) {
      if (err.message?.includes("cannot be cancelled") || err.message?.includes("already cancelled") || err.message?.includes("No active dispatch records found")) {
        throw err;
      }
      console.error("DB error during cancelDispatch:", err);
    }
  }

  // Update in-memory transactions
  targetTxns.forEach((tx) => {
    tx.status = "CANCELLED";
    tx.notes = `[CANCELLED by ${performedByName}]: ${tx.notes || ""}`;

    const inMemItem = INVENTORY_ITEMS.find((i) => i.id === tx.itemId || i.code === tx.itemId);
    if (inMemItem) {
      const isVariable = Boolean(inMemItem.isVariablePack);
      const qty = tx.quantity;
      if (isVariable) {
        if ((tx.referenceId?.startsWith("IND-") || (tx.transactionType as string) === "DISPENSE_INDIVIDUAL") && qty < 0) {
          inMemItem.currentStock = Number((inMemItem.currentStock + Math.abs(qty)).toFixed(3));
          inMemItem.inUseQuantity = Math.max(0, Number(((inMemItem.inUseQuantity || 0) - Math.abs(qty)).toFixed(3)));
        }
      } else if (qty < 0) {
        inMemItem.currentStock = Number((inMemItem.currentStock + Math.abs(qty)).toFixed(3));
      }
    }
  });

  eventBus.publish(
    "INVENTORY_DISPATCH_CANCELLED",
    {
      referenceId,
      cancelledBy: performedByName,
      timestamp: new Date().toISOString(),
    },
    performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    message: `Dispatch ${referenceId} has been successfully cancelled and materials returned to store balance.`,
    referenceId,
  };
}

export async function updatePendingDispatch(data: {
  referenceId: string;
  items: {
    txId: string;
    quantity: number;
  }[];
  recipient?: string;
  notes?: string;
  performedByName: string;
}) {
  const { referenceId, items: itemUpdates, recipient, notes, performedByName } = data;

  let dbTxns: any[] = [];
  if (db) {
    try {
      dbTxns = await db
        .select()
        .from(schema.stockTransactions)
        .where(eq(schema.stockTransactions.referenceId, referenceId));
    } catch (err) {
      console.error("DB error fetching transactions for updatePendingDispatch:", err);
    }
  }

  const inMemTxns = TRANSACTIONS.filter((t) => t.referenceId === referenceId);
  const allTxns = dbTxns.length > 0 ? dbTxns : inMemTxns;

  if (allTxns.length === 0) {
    throw new Error(`Dispatch reference "${referenceId}" not found.`);
  }

  for (const tx of allTxns) {
    if (tx.status === "PERMANENT") {
      throw new Error("This dispatch has already been permanently reconciled with the shift and cannot be modified.");
    }
    if (tx.status === "CANCELLED") {
      throw new Error("This dispatch has been cancelled and cannot be modified.");
    }
    if (!isDispatchEditable(tx.createdAt, tx.shiftType as any, tx.status)) {
      const cutoff = getShiftHandoverCutoff(tx.createdAt, tx.shiftType as any);
      throw new Error(`Modification window closed: Shift dispatches are locked 2 hours after shift ends (locked at ${formatCutoffTime(cutoff)}).`);
    }
  }

  for (const update of itemUpdates) {
    const tx = allTxns.find((t) => t.id === update.txId);
    if (!tx) continue;

    const oldDispensedQty = Math.abs(Number(tx.quantity));
    const newDispensedQty = Math.max(0, Number(update.quantity));
    const delta = Number((newDispensedQty - oldDispensedQty).toFixed(3));

    if (db) {
      try {
        const foundItems = await db.select().from(schema.items).where(eq(schema.items.id, tx.itemId)).limit(1);
        if (foundItems.length > 0) {
          const curItem = foundItems[0];
          const isVariable = Boolean(curItem.isVariablePack);

          if (!isVariable || Number(tx.quantity) !== 0) {
            if (delta > 0 && Number(curItem.currentStock) < delta) {
              throw new Error(
                `Insufficient store balance for ${curItem.name}. Need ${delta} ${curItem.uom} more, but store only has ${curItem.currentStock} ${curItem.uom}.`
              );
            }
            const updatedStock = Number((Number(curItem.currentStock) - delta).toFixed(3));
            await db
              .update(schema.items)
              .set({
                currentStock: updatedStock.toFixed(3),
                updatedAt: new Date(),
              })
              .where(eq(schema.items.id, curItem.id));

            const inMem = INVENTORY_ITEMS.find((i) => i.id === curItem.id || i.code === curItem.code);
            if (inMem) inMem.currentStock = updatedStock;
          }

          const newTxQty = Number(tx.quantity) === 0 ? 0 : -newDispensedQty;
          const updatedNote = notes
            ? `${tx.notes || ""} • [Modified to ${newDispensedQty} ${tx.unit} by ${performedByName}]`
            : tx.notes;

          await db
            .update(schema.stockTransactions)
            .set({
              quantity: newTxQty.toFixed(3),
              recipient: recipient?.trim() || tx.recipient,
              notes: updatedNote,
            })
            .where(eq(schema.stockTransactions.id, tx.id));
        }
      } catch (err: any) {
        if (err.message?.includes("Insufficient store balance")) throw err;
        console.error("DB error updating dispatch transaction:", err);
      }
    }

    const inMemTx = TRANSACTIONS.find((t) => t.id === update.txId);
    if (inMemTx) {
      const inMemItem = INVENTORY_ITEMS.find((i) => i.id === inMemTx.itemId || i.code === inMemTx.itemId);
      if (inMemItem) {
        const isVariable = Boolean(inMemItem.isVariablePack);
        if (!isVariable || inMemTx.quantity !== 0) {
          if (delta > 0 && inMemItem.currentStock < delta) {
            throw new Error(`Insufficient store balance for ${inMemItem.name}.`);
          }
          inMemItem.currentStock = Number((inMemItem.currentStock - delta).toFixed(3));
        }
      }
      inMemTx.quantity = inMemTx.quantity === 0 ? 0 : -newDispensedQty;
      if (recipient) inMemTx.recipient = recipient.trim();
      if (notes) inMemTx.notes = `${inMemTx.notes || ""} • [Modified to ${newDispensedQty} ${inMemTx.unit} by ${performedByName}]`;
    }
  }

  if (recipient) {
    if (db) {
      try {
        await db
          .update(schema.stockTransactions)
          .set({ recipient: recipient.trim() })
          .where(eq(schema.stockTransactions.referenceId, referenceId));
      } catch (err) {
        console.error("DB error updating recipient:", err);
      }
    }
    inMemTxns.forEach((t) => {
      t.recipient = recipient.trim();
    });
  }

  eventBus.publish(
    "INVENTORY_DISPATCH_UPDATED",
    {
      referenceId,
      itemCount: itemUpdates.length,
      performedByName,
      timestamp: new Date().toISOString(),
    },
    performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    message: `Dispatch ${referenceId} has been successfully updated.`,
    referenceId,
  };
}

export async function processFaultReturnAndReplace(data: {
  itemCode: string;
  quantity: number;
  unit?: string;
  faultReason: string;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  referenceBatch?: string;
  issueReplacement?: boolean;
}) {
  const item = await getItemByCode(data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  const isVariable = Boolean(item.isVariablePack);
  const activeUnit = data.unit || (isVariable && item.recipeUom ? item.recipeUom : item.uom);
  const shouldReplace = data.issueReplacement !== false;

  if (shouldReplace) {
    if (isVariable) {
      if (item.currentStock <= 0) {
        throw new Error(
          `Insufficient available store stock to issue replacement for ${item.name}. (Available: 0 ${item.uom})`
        );
      }
      // For variable items, store container stock is updated directly via post-return modal
    } else {
      if (item.currentStock < data.quantity) {
        throw new Error(
          `Insufficient available store stock to issue replacement for ${data.quantity} ${item.uom} of ${item.name}. (Available: ${item.currentStock} ${item.uom})`
        );
      }
      // Deduct the replacement items from available store stock
      item.currentStock = Number((item.currentStock - data.quantity).toFixed(3));
    }
  }

  const txn: StockTransaction = {
    id: `txn-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: shouldReplace ? "RETURN_FAULT_REPLACE" : "RETURN_FAULT_SCRAP",
    quantity: shouldReplace ? -data.quantity : 0,
    unit: activeUnit,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: data.referenceBatch || (shouldReplace ? "FAULT-REPLACE" : "FAULT-SCRAP-ONLY"),
    notes: shouldReplace
      ? `Fault replacement issued to ${data.recipient}. Reason: ${data.faultReason}. Defective units scrapped.`
      : `Fault defect logged. Reason: ${data.faultReason}. No replacement issued; defective units scrapped.`,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
      const condition = isUuid ? eq(schema.items.id, item.id) : eq(schema.items.code, item.code);
      const found = await db.select().from(schema.items).where(condition).limit(1);
      if (found.length > 0) {
        if (shouldReplace && !isVariable) {
          await db.update(schema.items).set({
            currentStock: item.currentStock.toFixed(3),
            updatedAt: new Date(),
          }).where(eq(schema.items.id, found[0].id));
        }

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: shouldReplace ? "RETURN_FAULT_REPLACE" : "DISPOSAL_EXPIRED_SPOILT",
          quantity: (shouldReplace ? -data.quantity : 0).toFixed(3),
          unit: activeUnit,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          recipient: data.recipient,
          referenceId: data.referenceBatch || (shouldReplace ? "FAULT-REPLACE" : "FAULT-SCRAP-ONLY"),
          notes: txn.notes,
        });
      }
    } catch (err) {
      console.error("DB error in processFaultReturnAndReplace:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code || i.id === item.id);
  if (inMem && shouldReplace && !isVariable) {
    inMem.currentStock = item.currentStock;
  }

  if (!shouldDisableMocks) {
    TRANSACTIONS.unshift(txn);
  }

  eventBus.publish(
    "INVENTORY_FAULT_SCRAPPED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: activeUnit,
      faultReason: data.faultReason,
      replacementIssued: shouldReplace,
      recipient: data.recipient,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    item,
    replacementIssued: shouldReplace,
    replacementQuantity: shouldReplace ? data.quantity : 0,
    isVariable,
    variableItem: isVariable
      ? {
          code: item.code,
          name: item.name,
          currentStock: item.currentStock,
          uom: item.uom,
          recipeUom: item.recipeUom || undefined,
          quantityDispensed: data.quantity,
          dispensedUom: activeUnit,
        }
      : undefined,
    transaction: txn,
  };
}

export async function processExcessRestock(data: {
  itemCode: string;
  quantity: number;
  unit?: string;
  conditionNotes: string;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  referenceBatch?: string;
}) {
  const item = await getItemByCode(data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  const isVariable = Boolean(item.isVariablePack);
  const activeUnit = data.unit || (isVariable && item.recipeUom ? item.recipeUom : item.uom);

  if (!isVariable) {
    // Increment stock back into available store inventory for standard items
    item.currentStock = Number((item.currentStock + data.quantity).toFixed(3));
  }

  const txn: StockTransaction = {
    id: `txn-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "RETURN_EXCESS_RESTOCK",
    quantity: data.quantity,
    unit: activeUnit,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: data.referenceBatch || "EXCESS-RESTOCK",
    notes: `Unused ingredient returned from shift run. Condition: ${data.conditionNotes}. Verified & Restocked.`,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
      const condition = isUuid ? eq(schema.items.id, item.id) : eq(schema.items.code, item.code);
      const found = await db.select().from(schema.items).where(condition).limit(1);
      if (found.length > 0) {
        if (!isVariable) {
          await db.update(schema.items).set({
            currentStock: item.currentStock.toFixed(3),
            updatedAt: new Date(),
          }).where(eq(schema.items.id, found[0].id));
        }

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: "RETURN_EXCESS_RESTOCK",
          quantity: data.quantity.toFixed(3),
          unit: activeUnit,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          recipient: data.recipient,
          referenceId: data.referenceBatch || "EXCESS-RESTOCK",
          notes: txn.notes,
        });
      }
    } catch (err) {
      console.error("DB error in processExcessRestock:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code || i.id === item.id);
  if (inMem && !isVariable) {
    inMem.currentStock = item.currentStock;
  }

  if (!shouldDisableMocks) {
    TRANSACTIONS.unshift(txn);
  }

  eventBus.publish(
    "INVENTORY_EXCESS_RESTOCKED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: activeUnit,
      conditionNotes: data.conditionNotes,
      recipient: data.recipient,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    item,
    restockedQuantity: data.quantity,
    isVariable,
    variableItem: isVariable
      ? {
          code: item.code,
          name: item.name,
          currentStock: item.currentStock,
          uom: item.uom,
          recipeUom: item.recipeUom || undefined,
          quantityDispensed: data.quantity,
          dispensedUom: activeUnit,
        }
      : undefined,
    transaction: txn,
  };
}

export async function reconcileShiftStock(data: {
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  counts?: { itemCode: string; physicalCount: number; discrepancyNote?: string }[];
  performedByName: string;
  handoverOfficerName: string;
  notes?: string;
}) {
  const results: {
    itemCode: string;
    itemName: string;
    expectedStock: number;
    physicalCount: number;
    variance: number;
    uom: string;
    note?: string;
  }[] = [];

  let totalVariancesCount = 0;
  const allItems = await getInventoryItems();
  const safeCounts = data.counts || [];

  for (const entry of safeCounts) {
    const item = allItems.find((i) => i.code === entry.itemCode);
    if (!item) continue;

    const expectedStock = item.currentStock;
    const physical = entry.physicalCount;
    const variance = Number((physical - expectedStock).toFixed(3));

    if (variance !== 0) {
      totalVariancesCount++;
      // Adjust system stock to reflect physical reality
      item.currentStock = physical;

      // Record adjustment transaction
      const txn: StockTransaction = {
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        itemId: item.id,
        itemName: item.name,
        transactionType: "RECONCILIATION_ADJUST",
        quantity: variance,
        unit: item.uom,
        shiftType: data.shiftType,
        performedByName: data.performedByName,
        recipient: data.handoverOfficerName,
        referenceId: "SHIFT-RECONCILE",
        notes: `Shift variance adjustment (${variance > 0 ? "+" : ""}${variance} ${item.uom}). Reason: ${
          entry.discrepancyNote || "Shift closing physical count reconciliation."
        }`,
        status: "PERMANENT",
        createdAt: new Date().toISOString(),
      };

      if (db) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
          const condition = isUuid ? eq(schema.items.id, item.id) : eq(schema.items.code, item.code);
          const found = await db.select().from(schema.items).where(condition).limit(1);
          if (found.length > 0) {
            await db.update(schema.items).set({
              currentStock: physical.toFixed(3),
              updatedAt: new Date(),
            }).where(eq(schema.items.id, found[0].id));

            await db.insert(schema.stockTransactions).values({
              itemId: found[0].id,
              transactionType: "RECONCILIATION_ADJUST",
              quantity: variance.toFixed(3),
              unit: item.uom,
              shiftType: data.shiftType,
              performedByName: data.performedByName,
              recipient: data.handoverOfficerName,
              referenceId: "SHIFT-RECONCILE",
              notes: txn.notes,
              status: "PERMANENT",
            });
          }
        } catch (err) {
          console.error("DB error in shift reconciliation:", err);
        }
      }

      const inMem = INVENTORY_ITEMS.find((i) => i.code === item.code || i.id === item.id);
      if (inMem) inMem.currentStock = physical;

      if (!shouldDisableMocks) {
        TRANSACTIONS.unshift(txn);
      }
    }

    results.push({
      itemCode: item.code,
      itemName: item.name,
      expectedStock,
      physicalCount: physical,
      variance,
      uom: item.uom,
      note: entry.discrepancyNote,
    });
  }

  const reconciledShift: ShiftRecord = {
    id: `shift-rec-${Date.now()}`,
    shiftType: data.shiftType,
    shiftDate: new Date().toISOString().split("T")[0],
    status: "RECONCILED",
    openedByName: data.performedByName,
    closedByName: data.performedByName,
    handoverOfficerName: data.handoverOfficerName,
    totalVariances: totalVariancesCount,
    totalItemsChecked: results.length,
    discrepancies: results.filter((r) => r.variance !== 0),
    allResults: results,
    notes: data.notes || `Shift handover reconciliation. Handed over to ${data.handoverOfficerName}.`,
    createdAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    stats: {
      dispensedCount: TRANSACTIONS.filter((t) => t.shiftType === data.shiftType && t.transactionType.includes("DISPENSE")).length,
      intakeCount: TRANSACTIONS.filter((t) => t.shiftType === data.shiftType && t.transactionType === "INBOUND_PURCHASE").length,
      returnsCount: TRANSACTIONS.filter((t) => t.shiftType === data.shiftType && t.transactionType.includes("RETURN")).length,
    },
  };

  const openIdx = SHIFT_RECORDS.findIndex((s) => s.status === "OPEN" && s.shiftType === data.shiftType);
  if (openIdx >= 0) {
    SHIFT_RECORDS[openIdx] = {
      ...SHIFT_RECORDS[openIdx],
      ...reconciledShift,
      id: SHIFT_RECORDS[openIdx].id,
      createdAt: SHIFT_RECORDS[openIdx].createdAt,
    };
  } else {
    SHIFT_RECORDS.unshift(reconciledShift);
  }

  if (db) {
    try {
      await db.insert(schema.shiftRecords).values({
        shiftType: data.shiftType,
        shiftDate: reconciledShift.shiftDate,
        status: "RECONCILED",
        totalVariances: totalVariancesCount,
        notes: reconciledShift.notes,
        closedAt: new Date(),
      });

      // Lock all pending handover dispatches for this shift to PERMANENT
      await db
        .update(schema.stockTransactions)
        .set({ status: "PERMANENT" })
        .where(
          and(
            eq(schema.stockTransactions.shiftType, data.shiftType),
            eq(schema.stockTransactions.status, "PENDING_HANDOVER")
          )
        );
    } catch (err) {
      console.error("DB error in recording reconciled shift or locking transactions:", err);
    }
  }

  // Update in-memory transactions status to PERMANENT
  TRANSACTIONS.forEach((t) => {
    if (t.shiftType === data.shiftType && t.status === "PENDING_HANDOVER") {
      t.status = "PERMANENT";
    }
  });

  eventBus.publish(
    "SHIFT_HANDOVER_RECONCILED",
    {
      shiftType: data.shiftType,
      closedBy: data.performedByName,
      handedOverTo: data.handoverOfficerName,
      totalVariancesCount,
      notes: data.notes,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    shiftType: data.shiftType,
    reconciliationTimestamp: new Date().toISOString(),
    closedBy: data.performedByName,
    handedOverTo: data.handoverOfficerName,
    totalItemsChecked: results.length,
    totalVariancesCount,
    discrepancies: results.filter((r) => r.variance !== 0),
    allResults: results,
    shiftRecord: reconciledShift,
  };
}

export async function getShifts(params?: {
  shiftType?: string;
  limit?: number;
}) {
  if (db) {
    try {
      const rows = await db
        .select({
          shift: schema.shiftRecords,
          openedByUser: {
            id: schema.users.id,
            fullName: schema.users.fullName,
          },
        })
        .from(schema.shiftRecords)
        .leftJoin(schema.users, eq(schema.shiftRecords.openedBy, schema.users.id))
        .orderBy(desc(schema.shiftRecords.createdAt));

      const defaultStoreMgr = await getDefaultStoreManagerName();

      let list: ShiftRecord[] = rows.map(({ shift: s, openedByUser }) => ({
        id: s.id,
        shiftType: s.shiftType as any,
        shiftDate: s.shiftDate,
        status: s.status as any,
        openedByName: openedByUser?.fullName ? cleanStaffName(openedByUser.fullName) : defaultStoreMgr,
        totalVariances: s.totalVariances || 0,
        totalItemsChecked: 0,
        notes: s.notes || undefined,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
        closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : undefined,
        stats: {
          dispensedCount: 0,
          intakeCount: 0,
          returnsCount: 0,
        },
      }));

      if (params?.shiftType && params.shiftType !== "ALL") {
        list = list.filter((s) => s.shiftType === params.shiftType);
      }
      return list.slice(0, params?.limit || 50);
    } catch (err) {
      console.error("DB error in getShifts:", err);
      return [];
    }
  }

  if (shouldDisableMocks) {
    return [];
  }

  let list = [...SHIFT_RECORDS];
  if (params?.shiftType && params.shiftType !== "ALL") {
    list = list.filter((s) => s.shiftType === params.shiftType);
  }
  return list.slice(0, params?.limit || 50);
}

export async function getActiveShiftInfo(preferredShift?: "MORNING_SHIFT" | "NIGHT_SHIFT") {
  const currentHour = new Date().getHours();
  const defaultType = preferredShift || (currentHour >= 8 && currentHour < 18 ? "MORNING_SHIFT" : "NIGHT_SHIFT");

  let openShift: ShiftRecord | undefined;
  if (db) {
    try {
      const openRows = await db
        .select()
        .from(schema.shiftRecords)
        .where(and(eq(schema.shiftRecords.status, "OPEN"), eq(schema.shiftRecords.shiftType, defaultType)))
        .orderBy(desc(schema.shiftRecords.createdAt))
        .limit(1);

      if (openRows.length > 0) {
        const s = openRows[0];
        openShift = {
          id: s.id,
          shiftType: s.shiftType as any,
          shiftDate: s.shiftDate,
          status: s.status as any,
          openedByName: "Store Staff",
          totalVariances: s.totalVariances || 0,
          totalItemsChecked: 0,
          notes: s.notes || undefined,
          createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : undefined,
          stats: { dispensedCount: 0, intakeCount: 0, returnsCount: 0 },
        };
      }
    } catch (err) {
      console.error("DB error in getActiveShiftInfo:", err);
    }
  }

  if (!openShift) {
    openShift = SHIFT_RECORDS.find((s) => s.status === "OPEN" && s.shiftType === defaultType);
  }

  if (!openShift) {
    openShift = {
      id: `shift-active-${Date.now()}`,
      shiftType: defaultType,
      shiftDate: new Date().toISOString().split("T")[0],
      status: "OPEN",
      openedByName: (await getDefaultStoreManagerName()) || "Store Manager",
      totalVariances: 0,
      totalItemsChecked: 0,
      notes: "Active shift operating on floor.",
      createdAt: new Date().toISOString(),
      stats: {
        dispensedCount: 0,
        intakeCount: 0,
        returnsCount: 0,
      },
    };
  }

  const allTxns = await getStockTransactions({ limit: 500 });
  const shiftTxns = allTxns.filter((t) => t.shiftType === defaultType);
  const dispensedCount = shiftTxns.filter((t) => t.transactionType.includes("DISPENSE")).length;
  const intakeCount = shiftTxns.filter((t) => t.transactionType === "INBOUND_PURCHASE").length;
  const returnsCount = shiftTxns.filter((t) => t.transactionType.includes("RETURN")).length;
  const totalVariances = shiftTxns.filter((t) => t.transactionType === "RECONCILIATION_ADJUST").length;

  return {
    activeShiftRecord: openShift,
    activeShiftStats: {
      dispensedCount,
      intakeCount,
      returnsCount,
      totalVariances,
    },
  };
}

export async function openShiftRecord(data: {
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  officerName: string;
  notes?: string;
}) {
  const newShift: ShiftRecord = {
    id: `shift-${Date.now()}`,
    shiftType: data.shiftType,
    shiftDate: new Date().toISOString().split("T")[0],
    status: "OPEN",
    openedByName: data.officerName || "Store Officer",
    totalVariances: 0,
    totalItemsChecked: 0,
    notes: data.notes || `Opened ${data.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} shift.`,
    createdAt: new Date().toISOString(),
    stats: {
      dispensedCount: 0,
      intakeCount: 0,
      returnsCount: 0,
    },
  };

  SHIFT_RECORDS.unshift(newShift);

  if (db) {
    try {
      await db.insert(schema.shiftRecords).values({
        shiftType: data.shiftType,
        shiftDate: newShift.shiftDate,
        status: "OPEN",
        notes: newShift.notes,
      });
    } catch (err) {
      console.error("DB error in openShiftRecord:", err);
    }
  }

  eventBus.publish(
    "SHIFT_OPENED",
    {
      shiftType: data.shiftType,
      openedBy: data.officerName,
      shiftDate: newShift.shiftDate,
    },
    data.officerName,
    "INVENTORY_STORE"
  );

  return newShift;
}

export async function getShiftById(id: string) {
  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUuid) {
        const rows = await db.select().from(schema.shiftRecords).where(eq(schema.shiftRecords.id, id)).limit(1);
        if (rows.length > 0) {
          const s = rows[0];
          const allTxns = await getStockTransactions({ limit: 500 });
          const transactions = allTxns.filter((t) => t.shiftType === s.shiftType);
          return {
            id: s.id,
            shiftType: s.shiftType as any,
            shiftDate: s.shiftDate,
            status: s.status as any,
            openedByName: "Store Staff",
            totalVariances: s.totalVariances || 0,
            totalItemsChecked: 0,
            notes: s.notes || undefined,
            createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
            closedAt: s.closedAt ? new Date(s.closedAt).toISOString() : undefined,
            transactions,
          };
        }
      }
    } catch (err) {
      console.error("DB error in getShiftById:", err);
    }
  }

  if (shouldDisableMocks) return null;

  const shift = SHIFT_RECORDS.find((s) => s.id === id);
  if (!shift) return null;

  const transactions = TRANSACTIONS.filter((t) => t.shiftType === shift.shiftType);

  return {
    ...shift,
    transactions,
  };
}

export async function getStockTransactions(params?: {
  limit?: number;
  offset?: number;
  type?: string;
  category?: string;
  search?: string;
  itemId?: string;
  startDate?: string;
  endDate?: string;
}) {
  if (db) {
    try {
      const conditions: any[] = [];

      if (params?.itemId && params.itemId !== "ALL") {
        const cleanId = params.itemId.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
        if (isUuid) {
          conditions.push(eq(schema.stockTransactions.itemId, cleanId));
        } else {
          const itemByCode = await db
            .select({ id: schema.items.id })
            .from(schema.items)
            .where(eq(schema.items.code, cleanId))
            .limit(1);
          if (itemByCode.length > 0) {
            conditions.push(eq(schema.stockTransactions.itemId, itemByCode[0].id));
          }
        }
      }

      if (params?.type && params.type !== "ALL") {
        conditions.push(eq(schema.stockTransactions.transactionType, params.type as any));
      }

      if (params?.category === "returns") {
        conditions.push(
          inArray(schema.stockTransactions.transactionType, [
            "RETURN_FAULT_REPLACE",
            "RETURN_EXCESS_RESTOCK",
            "DISPOSAL_EXPIRED_SPOILT",
          ])
        );
      }

      if (params?.startDate) {
        const start = new Date(params.startDate);
        if (!isNaN(start.getTime())) {
          conditions.push(gte(schema.stockTransactions.createdAt, start));
        }
      }

      if (params?.endDate) {
        const end = new Date(params.endDate);
        if (!isNaN(end.getTime())) {
          if (params.endDate.length === 10) {
            end.setHours(23, 59, 59, 999);
          }
          conditions.push(lte(schema.stockTransactions.createdAt, end));
        }
      }

      if (params?.search && params.search.trim()) {
        const q = `%${params.search.trim()}%`;
        conditions.push(
          or(
            ilike(schema.stockTransactions.performedByName, q),
            ilike(schema.stockTransactions.recipient, q),
            ilike(schema.stockTransactions.referenceId, q),
            ilike(schema.stockTransactions.notes, q)
          )
        );
      }

      const limit = params?.limit !== undefined ? Math.max(1, Number(params.limit)) : 100;
      const offset = params?.offset !== undefined ? Math.max(0, Number(params.offset)) : 0;
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          tx: schema.stockTransactions,
          itemName: schema.items.name,
          itemCode: schema.items.code,
        })
        .from(schema.stockTransactions)
        .leftJoin(schema.items, eq(schema.stockTransactions.itemId, schema.items.id))
        .where(whereClause)
        .orderBy(desc(schema.stockTransactions.createdAt))
        .limit(limit)
        .offset(offset);

      const list: StockTransaction[] = rows.map(({ tx, itemName, itemCode }) => ({
        id: tx.id,
        itemId: tx.itemId,
        itemName: itemName || tx.performedByName || "Material",
        itemCode: itemCode || undefined,
        transactionType: tx.transactionType as any,
        quantity: Number(tx.quantity),
        unit: tx.unit,
        shiftType: tx.shiftType as any,
        performedByName: tx.performedByName || "Store Staff",
        recipient: tx.recipient || undefined,
        referenceId: tx.referenceId || undefined,
        notes: tx.notes || undefined,
        status: (tx.status as any) || "PERMANENT",
        createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
      }));

      return list;
    } catch (err) {
      console.error("DB error in getStockTransactions:", err);
      return [];
    }
  }

  if (shouldDisableMocks) {
    return [];
  }

  let list = [...TRANSACTIONS];

  if (params?.itemId && params.itemId !== "ALL") {
    list = list.filter((t) => t.itemId === params.itemId || (t as any).itemCode === params.itemId);
  }

  if (params?.type && params.type !== "ALL") {
    list = list.filter((t) => t.transactionType === params.type);
  }

  if (params?.category === "returns") {
    list = list.filter(
      (t) =>
        t.transactionType === "RETURN_FAULT_REPLACE" ||
        t.transactionType === "RETURN_EXCESS_RESTOCK" ||
        t.transactionType === "DISPOSAL_EXPIRED_SPOILT"
    );
  }

  if (params?.startDate) {
    const start = new Date(params.startDate).getTime();
    if (!isNaN(start)) {
      list = list.filter((t) => new Date(t.createdAt).getTime() >= start);
    }
  }

  if (params?.endDate) {
    const end = new Date(params.endDate);
    if (!isNaN(end.getTime())) {
      if (params.endDate.length === 10) end.setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.createdAt).getTime() <= end.getTime());
    }
  }

  if (params?.search) {
    const q = params.search.toLowerCase().trim();
    list = list.filter(
      (t) =>
        t.itemName.toLowerCase().includes(q) ||
        (t.referenceId && t.referenceId.toLowerCase().includes(q)) ||
        (t.performedByName && t.performedByName.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q))
    );
  }

  const offset = params?.offset || 0;
  const limit = params?.limit || 100;
  return list.slice(offset, offset + limit);
}

export async function getReturnsAudit() {
  const allTxns = await getStockTransactions({ limit: 500, category: "returns" });
  const allItems = await getInventoryItems();
  const itemMap = new Map(allItems.map((i) => [i.id, i]));
  const itemCodeMap = new Map(allItems.map((i) => [i.code, i]));

  let totalFaultLossValue = 0;
  let totalRestockedValue = 0;
  let faultScrappedCount = 0;
  let excessRestockedCount = 0;

  const reasonCounts: Record<string, number> = {};

  const enrichedReturns = allTxns.map((txn) => {
    const item = itemMap.get(txn.itemId) || itemCodeMap.get(txn.itemId);
    const unitCost = item?.costPerUnit || 0;
    const valueImpact = Math.abs(txn.quantity) * unitCost;

    if (txn.transactionType === "RETURN_FAULT_REPLACE" || txn.transactionType === "DISPOSAL_EXPIRED_SPOILT") {
      totalFaultLossValue += valueImpact;
      faultScrappedCount++;
    } else if (txn.transactionType === "RETURN_EXCESS_RESTOCK") {
      totalRestockedValue += valueImpact;
      excessRestockedCount++;
    }

    // Categorize reason
    const noteLower = (txn.notes || "").toLowerCase();
    let rootCause = "General Scrap / Unspecified";
    if (noteLower.includes("cracked") || noteLower.includes("broken") || noteLower.includes("damaged")) {
      rootCause = "Packaging / Physical Damage";
    } else if (noteLower.includes("expired") || noteLower.includes("spoilt") || noteLower.includes("sour")) {
      rootCause = "Shelf Expiry / Spoilage";
    } else if (noteLower.includes("excess") || noteLower.includes("unused") || noteLower.includes("unmixed")) {
      rootCause = "Excess Unused Restock";
    } else if (noteLower.includes("contamination") || noteLower.includes("defect") || noteLower.includes("mixing")) {
      rootCause = "Batch / Factory Defect";
    }

    reasonCounts[rootCause] = (reasonCounts[rootCause] || 0) + 1;

    return {
      ...txn,
      unitCost,
      valueImpact,
      rootCause,
    };
  });

  return {
    totalReturnsCount: allTxns.length,
    faultScrappedCount,
    excessRestockedCount,
    totalFaultLossValue,
    totalRestockedValue,
    reasonBreakdown: reasonCounts,
    returns: enrichedReturns,
  };
}

// ==========================================
// 10. DAILY SHIFT STOCK SHEET REPORT
// ==========================================

export interface DailyShiftReportRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  packagingType?: string;
  isVariablePack?: boolean;
  inUseQuantity?: number;
  inUseUnit?: string;
  recipeUom?: string;
  openingStock: number;
  newStock: number;
  totalStock: number;
  usage: number;
  damages: number;
  reconcileAdjust: number;
  closingStock: number;
  usageSecondary?: string;
  physicalCount?: number;
  variance?: number;
  discrepancyNote?: string;
}

export interface DailyShiftReport {
  date: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT" | "ALL";
  officerOnDuty?: string;
  handoverOfficer?: string;
  status: "OPEN" | "RECONCILED" | "PENDING";
  certifiedAt?: string;
  notes?: string;
  requisitionApproval?: {
    status: "PENDING_APPROVAL" | "APPROVED";
    approvedBy?: string;
    approvedAt?: string;
    notes?: string;
  };
  summary: {
    totalItems: number;
    totalOpening: number;
    totalNewStock: number;
    totalUsage: number;
    totalDamages: number;
    totalClosing: number;
    discrepanciesCount: number;
  };
  rows: DailyShiftReportRow[];
}

export async function getDailyShiftStockReport(params?: {
  date?: string;
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT" | "ALL";
}): Promise<DailyShiftReport> {
  const targetDate = params?.date || new Date().toISOString().split("T")[0];
  const targetShift = params?.shiftType || "ALL";

  const allItems = await getInventoryItems();
  const allTxns = await getStockTransactions({ limit: 5000 });
  const allShifts = await getShifts({ limit: 100 });

  // Find relevant shift record for audit metadata
  let matchedShift: ShiftRecord | undefined;
  if (targetShift !== "ALL") {
    matchedShift = allShifts.find((s) => s.shiftDate === targetDate && s.shiftType === targetShift);
  } else {
    matchedShift = allShifts.find((s) => s.shiftDate === targetDate);
  }

  let requisitionApproval: DailyShiftReport["requisitionApproval"] = undefined;
  if (db) {
    try {
      const conds = [eq(schema.requisitionApprovals.shiftDate, targetDate)];
      if (targetShift !== "ALL") {
        conds.push(eq(schema.requisitionApprovals.shiftType, targetShift));
      }
      const appRows = await db
        .select()
        .from(schema.requisitionApprovals)
        .where(and(...conds))
        .orderBy(desc(schema.requisitionApprovals.createdAt))
        .limit(1);

      if (appRows.length > 0 && appRows[0].status === "APPROVED") {
        requisitionApproval = {
          status: "APPROVED",
          approvedBy: appRows[0].approvedBy || undefined,
          approvedAt: appRows[0].approvedAt ? appRows[0].approvedAt.toISOString() : undefined,
          notes: appRows[0].notes || undefined,
        };
      }
    } catch (e) {
      console.warn("DB error loading requisition approvals for daily report:", e);
    }
  }

  const helperMatchesItem = (item: InventoryItem, txn: StockTransaction): boolean => {
    if (txn.itemId && (txn.itemId === item.id || txn.itemId === item.code)) return true;
    if (txn.itemName && txn.itemName.toLowerCase() === item.name.toLowerCase()) return true;
    return false;
  };

  // Helper to compute net stock delta for a transaction
  const getTxnDelta = (txn: StockTransaction): number => {
    if (txn.status === "CANCELLED") return 0;
    const qty = Number(txn.quantity) || 0;
    if (txn.transactionType === "INBOUND_PURCHASE" || txn.transactionType === "RETURN_EXCESS_RESTOCK") {
      return Math.abs(qty);
    }
    if (txn.transactionType === "DISPENSE_PRODUCTION" || txn.transactionType === "DISPENSE_INDIVIDUAL") {
      return -Math.abs(qty);
    }
    if (
      txn.transactionType === "RETURN_FAULT_SCRAP" ||
      txn.transactionType === "RETURN_FAULT_REPLACE" ||
      txn.transactionType === "DISPOSAL_EXPIRED_SPOILT"
    ) {
      return -Math.abs(qty);
    }
    if (txn.transactionType === "RECONCILIATION_ADJUST") {
      return qty;
    }
    return 0;
  };

  // Helper to test if a transaction is AFTER the target period
  const isAfterPeriod = (txn: StockTransaction): boolean => {
    const txnDate = (txn.createdAt || "").slice(0, 10);
    if (!txnDate) return false;

    if (txnDate > targetDate) return true;
    if (txnDate < targetDate) return false;

    // Same date
    if (targetShift === "MORNING_SHIFT" && txn.shiftType === "NIGHT_SHIFT") {
      return true;
    }
    return false;
  };

  // Helper to test if a transaction is IN the target period
  const isInPeriod = (txn: StockTransaction): boolean => {
    if (txn.status === "CANCELLED") return false;
    const txnDate = (txn.createdAt || "").slice(0, 10);
    if (txnDate !== targetDate) return false;

    if (targetShift === "ALL") return true;
    return txn.shiftType === targetShift;
  };

  const rows: DailyShiftReportRow[] = [];
  let summaryOpening = 0;
  let summaryNewStock = 0;
  let summaryUsage = 0;
  let summaryDamages = 0;
  let summaryClosing = 0;
  let discrepanciesCount = 0;

  for (const item of allItems) {
    const itemTxns = allTxns.filter((t) => helperMatchesItem(item, t));

    // Calculate Closing Stock at end of target period by unwinding subsequent transactions from live stock
    const afterTxns = itemTxns.filter(isAfterPeriod);
    const deltaAfter = afterTxns.reduce((acc, t) => acc + getTxnDelta(t), 0);
    const closingStock = Number((item.currentStock - deltaAfter).toFixed(3));

    // Calculate period movements
    const periodTxns = itemTxns.filter(isInPeriod);

    let newStock = 0;
    let usage = 0;
    let damages = 0;
    let reconcileAdjust = 0;
    const secondaryTotals: Record<string, number> = {};
    const processedSecondaryRefIds = new Set<string>();

    for (const txn of periodTxns) {
      const q = Math.abs(Number(txn.quantity) || 0);

      if (txn.transactionType === "INBOUND_PURCHASE" || txn.transactionType === "RETURN_EXCESS_RESTOCK") {
        newStock += q;
      } else if (txn.transactionType === "DISPENSE_PRODUCTION" || txn.transactionType === "DISPENSE_INDIVIDUAL") {
        usage += q;
        if (item.isVariablePack) {
          const refKey = txn.referenceId ? `${item.code}-${txn.referenceId}` : null;
          if (!refKey || !processedSecondaryRefIds.has(refKey)) {
            let portionQty = 0;
            let portionUnit = (item.recipeUom || "pcs").toLowerCase();

            // 1. First check if specific action verbs exist in notes (e.g. "Gave out 400 pcs", "dished 400 pcs", "dispensed 400 pcs")
            const actionMatch = txn.notes
              ? txn.notes.match(
                  /(?:gave out|dished out|dished|dispensed|took|taken|used|variable material:?)\s*(\d+(?:\.\d+)?)\s*(pcs|pieces|cups|ml|g|kg|cl|l)/i
                )
              : null;

            if (actionMatch && Number(actionMatch[1]) > 0) {
              portionQty = Number(actionMatch[1]);
              portionUnit = actionMatch[2].toLowerCase();
            } else if (q > 0 && txn.unit && txn.unit.toLowerCase() !== item.uom.toLowerCase()) {
              portionQty = q;
              portionUnit = txn.unit.toLowerCase();
            }

            if (portionUnit === "pieces") portionUnit = "pcs";

            if (portionQty > 0) {
              secondaryTotals[portionUnit] = (secondaryTotals[portionUnit] || 0) + portionQty;
              if (refKey) {
                processedSecondaryRefIds.add(refKey);
              }
            }
          }
        }
      } else if (
        txn.transactionType === "RETURN_FAULT_SCRAP" ||
        txn.transactionType === "RETURN_FAULT_REPLACE" ||
        txn.transactionType === "DISPOSAL_EXPIRED_SPOILT"
      ) {
        damages += q;
      } else if (txn.transactionType === "RECONCILIATION_ADJUST") {
        reconcileAdjust += Number(txn.quantity) || 0;
      }
    }

    const secondaryUsageNotes: string[] = Object.entries(secondaryTotals).map(
      ([unit, total]) => `${Number(total.toFixed(2))} ${unit}`
    );

    newStock = Number(newStock.toFixed(3));
    usage = Number(usage.toFixed(3));
    damages = Number(damages.toFixed(3));
    reconcileAdjust = Number(reconcileAdjust.toFixed(3));

    // Opening Stock = Closing Stock - (New Stock - Usage - Damages + ReconcileAdjust)
    // Ensures: Opening Stock + New Stock - Usage - Damages + ReconcileAdjust === Closing Stock
    const netPeriodChange = newStock - usage - damages + reconcileAdjust;
    const openingStock = Number((closingStock - netPeriodChange).toFixed(3));
    const totalStock = Number((openingStock + newStock).toFixed(3));

    // Check if shift reconciliation has physical count data for this item
    let physicalCount: number | undefined = undefined;
    let variance: number | undefined = undefined;
    let discrepancyNote: string | undefined = undefined;

    if (matchedShift) {
      const recordedResult =
        matchedShift.allResults?.find((r) => r.itemCode === item.code) ||
        matchedShift.discrepancies?.find((r) => r.itemCode === item.code);
      if (recordedResult) {
        physicalCount = recordedResult.physicalCount;
        variance = recordedResult.variance;
        discrepancyNote = recordedResult.note;
        if (variance !== 0) {
          discrepanciesCount++;
        }
      }
    }

    summaryOpening += openingStock;
    summaryNewStock += newStock;
    summaryUsage += usage;
    summaryDamages += damages;
    summaryClosing += closingStock;

    rows.push({
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      category: item.category,
      uom: item.uom,
      packagingType: item.packagingType,
      isVariablePack: item.isVariablePack,
      inUseQuantity: item.inUseQuantity,
      inUseUnit: item.inUseUnit,
      recipeUom: item.recipeUom,
      openingStock,
      newStock,
      totalStock,
      usage,
      damages,
      reconcileAdjust,
      closingStock,
      usageSecondary: secondaryUsageNotes.length > 0 ? secondaryUsageNotes.join(", ") : undefined,
      physicalCount,
      variance,
      discrepancyNote,
    });
  }

  const status: "OPEN" | "RECONCILED" | "PENDING" = matchedShift
    ? (matchedShift.status as any)
    : targetDate === new Date().toISOString().split("T")[0]
    ? "OPEN"
    : "PENDING";

  let resolvedOfficer = matchedShift?.openedByName || matchedShift?.closedByName;
  if (!resolvedOfficer || resolvedOfficer === "Store Officer" || resolvedOfficer === "Store Staff") {
    const shiftTxnWithPerformer = allTxns.find(
      (t) =>
        t.performedByName &&
        (t.createdAt || "").slice(0, 10) === targetDate &&
        (targetShift === "ALL" || t.shiftType === targetShift)
    );
    if (shiftTxnWithPerformer) {
      resolvedOfficer = shiftTxnWithPerformer.performedByName;
    }
  }
  if (!resolvedOfficer || resolvedOfficer === "Store Officer" || resolvedOfficer === "Store Staff") {
    resolvedOfficer = await getDefaultStoreManagerName();
  }

  const officerOnDuty = cleanStaffName(resolvedOfficer, "Store Manager");

  return {
    date: targetDate,
    shiftType: targetShift,
    officerOnDuty,
    handoverOfficer: matchedShift?.handoverOfficerName || undefined,
    status,
    certifiedAt: matchedShift?.closedAt || undefined,
    notes: matchedShift?.notes || undefined,
    requisitionApproval,
    summary: {
      totalItems: rows.length,
      totalOpening: Number(summaryOpening.toFixed(3)),
      totalNewStock: Number(summaryNewStock.toFixed(3)),
      totalUsage: Number(summaryUsage.toFixed(3)),
      totalDamages: Number(summaryDamages.toFixed(3)),
      totalClosing: Number(summaryClosing.toFixed(3)),
      discrepanciesCount,
    },
    rows,
  };
}

export async function generatePeriodStatementCSV(params: {
  startDate: string;
  endDate: string;
  shiftType?: "ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT";
}): Promise<string> {
  const startDate = params.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const endDate = params.endDate || new Date().toISOString().split("T")[0];
  const targetShift = params.shiftType || "ALL";

  const allItems = await getInventoryItems();
  const allTxns = await getStockTransactions({ limit: 10000 });

  const helperMatchesItem = (item: InventoryItem, txn: StockTransaction): boolean => {
    if (txn.itemId && (txn.itemId === item.id || txn.itemId === item.code)) return true;
    if (txn.itemName && txn.itemName.toLowerCase() === item.name.toLowerCase()) return true;
    return false;
  };

  const getTxnDelta = (txn: StockTransaction): number => {
    if (txn.status === "CANCELLED") return 0;
    const qty = Number(txn.quantity) || 0;
    if (txn.transactionType === "INBOUND_PURCHASE" || txn.transactionType === "RETURN_EXCESS_RESTOCK") {
      return Math.abs(qty);
    }
    if (txn.transactionType === "DISPENSE_PRODUCTION" || txn.transactionType === "DISPENSE_INDIVIDUAL") {
      return -Math.abs(qty);
    }
    if (
      txn.transactionType === "RETURN_FAULT_SCRAP" ||
      txn.transactionType === "RETURN_FAULT_REPLACE" ||
      txn.transactionType === "DISPOSAL_EXPIRED_SPOILT"
    ) {
      return -Math.abs(qty);
    }
    if (txn.transactionType === "RECONCILIATION_ADJUST") {
      return qty;
    }
    return 0;
  };

  const isAfterPeriod = (txn: StockTransaction): boolean => {
    const txnDate = (txn.createdAt || "").slice(0, 10);
    if (!txnDate) return false;
    if (txnDate > endDate) return true;
    if (txnDate < endDate) return false;
    if (targetShift === "MORNING_SHIFT" && txn.shiftType === "NIGHT_SHIFT") {
      return true;
    }
    return false;
  };

  const isInPeriod = (txn: StockTransaction): boolean => {
    if (txn.status === "CANCELLED") return false;
    const txnDate = (txn.createdAt || "").slice(0, 10);
    if (txnDate < startDate || txnDate > endDate) return false;
    if (targetShift === "ALL") return true;
    return txn.shiftType === targetShift;
  };

  const summaryRows = [];
  const periodFilteredTxns = allTxns.filter(isInPeriod);

  for (const item of allItems) {
    const itemTxns = allTxns.filter((t) => helperMatchesItem(item, t));

    // Calculate closing stock at endDate
    const afterTxns = itemTxns.filter(isAfterPeriod);
    const deltaAfter = afterTxns.reduce((acc, t) => acc + getTxnDelta(t), 0);
    const closingStock = Number((item.currentStock - deltaAfter).toFixed(3));

    // Calculate period movements
    const periodTxns = itemTxns.filter(isInPeriod);
    let newStock = 0;
    let usage = 0;
    let damages = 0;
    let reconcileAdjust = 0;
    const secondaryTotals: Record<string, number> = {};
    const processedSecondaryRefIds = new Set<string>();

    for (const txn of periodTxns) {
      const q = Math.abs(Number(txn.quantity) || 0);
      if (txn.transactionType === "INBOUND_PURCHASE" || txn.transactionType === "RETURN_EXCESS_RESTOCK") {
        newStock += q;
      } else if (txn.transactionType === "DISPENSE_PRODUCTION" || txn.transactionType === "DISPENSE_INDIVIDUAL") {
        usage += q;
        if (item.isVariablePack) {
          const refKey = txn.referenceId ? `${item.code}-${txn.referenceId}` : null;
          if (!refKey || !processedSecondaryRefIds.has(refKey)) {
            let portionQty = 0;
            let portionUnit = (item.recipeUom || "pcs").toLowerCase();
            const actionMatch = txn.notes
              ? txn.notes.match(/(?:gave out|dished out|dished|dispensed|took|taken|used|variable material:?)\s*(\d+(?:\.\d+)?)\s*(pcs|pieces|cups|ml|g|kg|cl|l)/i)
              : null;
            if (actionMatch && Number(actionMatch[1]) > 0) {
              portionQty = Number(actionMatch[1]);
              portionUnit = actionMatch[2].toLowerCase();
            } else if (q > 0 && txn.unit && txn.unit.toLowerCase() !== item.uom.toLowerCase()) {
              portionQty = q;
              portionUnit = txn.unit.toLowerCase();
            }
            if (portionUnit === "pieces") portionUnit = "pcs";
            if (portionQty > 0) {
              secondaryTotals[portionUnit] = (secondaryTotals[portionUnit] || 0) + portionQty;
              if (refKey) processedSecondaryRefIds.add(refKey);
            }
          }
        }
      } else if (
        txn.transactionType === "RETURN_FAULT_SCRAP" ||
        txn.transactionType === "RETURN_FAULT_REPLACE" ||
        txn.transactionType === "DISPOSAL_EXPIRED_SPOILT"
      ) {
        damages += q;
      } else if (txn.transactionType === "RECONCILIATION_ADJUST") {
        reconcileAdjust += Number(txn.quantity) || 0;
      }
    }

    const secondaryUsageNotes = Object.entries(secondaryTotals)
      .map(([unit, total]) => `${Number(total.toFixed(2))} ${unit}`)
      .join("; ");

    newStock = Number(newStock.toFixed(3));
    usage = Number(usage.toFixed(3));
    damages = Number(damages.toFixed(3));
    reconcileAdjust = Number(reconcileAdjust.toFixed(3));

    const netPeriodChange = newStock - usage - damages + reconcileAdjust;
    const openingStock = Number((closingStock - netPeriodChange).toFixed(3));
    const totalStock = Number((openingStock + newStock).toFixed(3));

    summaryRows.push({
      code: item.code,
      name: item.name,
      category: item.category,
      uom: item.uom,
      openingStock,
      newStock,
      totalStock,
      usage,
      secondaryUsageNotes,
      damages,
      reconcileAdjust,
      closingStock,
      liveStock: item.currentStock,
    });
  }

  // Build CSV lines
  const csvLines: string[] = [
    `"MOH FOOD AND CONFECTIONERIES — OFFICIAL STOCK PERIOD STATEMENT"`,
    `"Statement Period:","${startDate} to ${endDate}"`,
    `"Shift Scope:","${targetShift === "ALL" ? "All Shifts (24 Hours)" : targetShift === "MORNING_SHIFT" ? "Morning Shift (08:00 - 18:00)" : "Night Shift (18:00 - 08:00)"}"`,
    `"Generated At:","${new Date().toISOString()}"`,
    `"Total Catalog Items:","${allItems.length}"`,
    `"Total Transactions Recorded:","${periodFilteredTxns.length}"`,
    `""`,
    `"=== SECTION 1: CONSOLIDATED STOCK BALANCE SUMMARY ==="`,
    [
      "Item Code",
      "Item Name",
      "Category",
      "UoM",
      "Opening Stock",
      "Period Additions (Inbound)",
      "Total Available",
      "Usage (Dispensed)",
      "Secondary Usage (Portions)",
      "Damages & Wastage",
      "Reconcile Adjustments",
      "Period Closing Stock",
      "Current Live Stock",
    ].map((h) => `"${h}"`).join(","),
    ...summaryRows.map((r) =>
      [
        `"${r.code}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.category}"`,
        `"${r.uom}"`,
        r.openingStock,
        r.newStock,
        r.totalStock,
        r.usage,
        `"${(r.secondaryUsageNotes || "").replace(/"/g, '""')}"`,
        r.damages,
        r.reconcileAdjust,
        r.closingStock,
        r.liveStock,
      ].join(",")
    ),
    `""`,
    `"=== SECTION 2: COMPLETE TRANSACTION MOVEMENTS AUDIT LOG ==="`,
    [
      "Timestamp",
      "Reference ID",
      "Item Code",
      "Item Name",
      "Transaction Type",
      "Shift",
      "Quantity",
      "Unit",
      "Performed By",
      "Recipient / Partner",
      "Notes",
    ].map((h) => `"${h}"`).join(","),
    ...periodFilteredTxns.map((t) =>
      [
        `"${t.createdAt || ""}"`,
        `"${t.referenceId || ""}"`,
        `"${t.itemId || ""}"`,
        `"${(t.itemName || "").replace(/"/g, '""')}"`,
        `"${t.transactionType || ""}"`,
        `"${t.shiftType || ""}"`,
        t.quantity,
        `"${t.unit || ""}"`,
        `"${(t.performedByName || "").replace(/"/g, '""')}"`,
        `"${(t.recipient || "").replace(/"/g, '""')}"`,
        `"${(t.notes || "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ];

  return csvLines.join("\n");
}

