import { eventBus } from "../events/eventBus";
import { db, schema, ensureSchemaColumns } from "../db";
import { eq, ne, desc, inArray, or, and, gte, lte, ilike, sql } from "drizzle-orm";
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
import {
  sortItemsByNotebookSequence,
  getItemNotebookRank,
} from "@/lib/stockSequence";

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

export interface VariableItemUsage {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  uom: string;
  recipeUom?: string;
  quantityDispensed?: number;
  dispensedUom?: string;
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
  itemCode?: string;
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
  { id: "item-06", code: "RAW-RSN-01", name: "Seedless Golden Raisins", category: "PERISHABLE_MEASURED", uom: "carton", packagingType: "PACK_ONLY", packUnit: "carton", currentStock: 1, recipeUom: "cups", portionsPerContainer: 40, isVariablePack: true, minStockThreshold: 1, costPerUnit: 18000, storageLocation: "Dry Store Bin 4", isActive: true },
  { id: "item-07", code: "RAW-VAN-01", name: "Pure Vanilla Extract", category: "PERISHABLE_MEASURED", uom: "bottle", packagingType: "PACK_ONLY", packUnit: "bottle", currentStock: 2, recipeUom: "ml", portionsPerContainer: 267, isVariablePack: true, minStockThreshold: 1, costPerUnit: 8500, storageLocation: "Dry Store Locked Cabinet", isActive: true },
  { id: "item-18", code: "RAW-GLC-01", name: "Liquid Food-Grade Glucose", category: "PERISHABLE_MEASURED", uom: "tub", packagingType: "PACK_ONLY", packUnit: "tub", currentStock: 2, recipeUom: "cups", portionsPerContainer: 25, isVariablePack: true, minStockThreshold: 1, costPerUnit: 6500, storageLocation: "Dry Store Shelf 2", isActive: true },

  // 2. Numbered Perishables
  { id: "item-08", code: "RAW-APL-01", name: "Fresh Crisp Green Apples", category: "PERISHABLE_NUMBERED", uom: "pcs", currentStock: 0, minStockThreshold: 300, costPerUnit: 250, storageLocation: "Cold Room B (Fruit Bay)", isActive: true },
  { id: "item-09", code: "RAW-GRP-01", name: "Seedless Purple Grapes", category: "PERISHABLE_NUMBERED", uom: "pack", packagingType: "PACK_ONLY", packUnit: "pack", currentStock: 6, recipeUom: "pcs", portionsPerContainer: 80, isVariablePack: true, minStockThreshold: 2, costPerUnit: 1200, storageLocation: "Cold Room B (Fruit Bay)", isActive: true },
  { id: "item-10", code: "RAW-CCN-01", name: "Fresh Whole Coconuts", category: "PERISHABLE_NUMBERED", uom: "nuts", currentStock: 0, minStockThreshold: 100, costPerUnit: 450, storageLocation: "Fruit Prep Bay", isActive: true },
  { id: "item-11", code: "RAW-CSH-01", name: "Roasted Cashew Nuts", category: "PERISHABLE_NUMBERED", uom: "bottle", packagingType: "PACK_ONLY", packUnit: "bottle", currentStock: 6, recipeUom: "pcs", portionsPerContainer: 200, isVariablePack: true, minStockThreshold: 2, costPerUnit: 2500, storageLocation: "Dry Store Shelf 4", isActive: true },

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
      return sortItemsByNotebookSequence(list);
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

  return sortItemsByNotebookSequence(list);
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
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

export async function calculateMultiRecipeRequirements(
  recipeBatches: Array<{ recipeCode: string; batchQuantity: number }>
) {
  const recipes = await getProductRecipes();
  const items = await getInventoryItems();

  const validatedRecipes: Array<{
    recipe: ProductRecipe;
    batchQuantity: number;
    factor: number;
  }> = [];

  for (const rb of recipeBatches) {
    if (!rb.recipeCode || Number(rb.batchQuantity) <= 0) continue;
    const r = recipes.find((rec) => rec.code === rb.recipeCode);
    if (r) {
      validatedRecipes.push({
        recipe: r,
        batchQuantity: Number(rb.batchQuantity),
        factor: Number(rb.batchQuantity) / r.yieldQuantity,
      });
    }
  }

  if (validatedRecipes.length === 0) {
    throw new Error("Please select at least 1 valid recipe with batch quantity greater than 0.");
  }

  interface AggregatedIng {
    itemCode: string;
    itemName: string;
    unitRequired: number;
    uom: string;
    availableStock: number;
    isSufficient: boolean;
    shortfall: number;
    isVariable: boolean;
    recipeUom?: string;
    containerUom?: string;
    sources: Array<{ recipeCode: string; recipeName: string; quantity: number; uom: string }>;
    sourceBreakdown: string;
  }

  const map = new Map<string, AggregatedIng>();

  for (const vr of validatedRecipes) {
    for (const ing of vr.recipe.ingredients) {
      const needed = Number((ing.quantityRequired * vr.factor).toFixed(3));
      const currentItem = items.find((i) => i.code === ing.itemCode);
      const availableStock = currentItem?.currentStock || 0;
      const isVariable = Boolean(currentItem?.isVariablePack);

      if (!map.has(ing.itemCode)) {
        map.set(ing.itemCode, {
          itemCode: ing.itemCode,
          itemName: ing.itemName,
          unitRequired: 0,
          uom: ing.uom,
          availableStock,
          isSufficient: true,
          shortfall: 0,
          isVariable,
          recipeUom: ing.recipeUom || currentItem?.recipeUom || ing.uom,
          containerUom: currentItem?.uom,
          sources: [],
          sourceBreakdown: "",
        });
      }

      const entry = map.get(ing.itemCode)!;
      entry.unitRequired = Number((entry.unitRequired + needed).toFixed(3));
      entry.sources.push({
        recipeCode: vr.recipe.code,
        recipeName: vr.recipe.name,
        quantity: needed,
        uom: ing.uom,
      });
    }
  }

  const requiredIngredients: AggregatedIng[] = [];
  for (const entry of map.values()) {
    if (entry.isVariable) {
      entry.isSufficient = entry.availableStock > 0;
      entry.shortfall = entry.isSufficient ? 0 : 1;
    } else {
      entry.isSufficient = entry.availableStock >= entry.unitRequired;
      entry.shortfall = entry.isSufficient
        ? 0
        : Number((entry.unitRequired - entry.availableStock).toFixed(3));
    }

    if (entry.sources.length > 1) {
      entry.sourceBreakdown = entry.sources
        .map((s) => `${s.quantity} ${s.uom} (${s.recipeName})`)
        .join(" + ");
    } else if (entry.sources.length === 1) {
      entry.sourceBreakdown = `${entry.sources[0].recipeName}`;
    }

    requiredIngredients.push(entry);
  }

  const allAvailable = requiredIngredients.every((ing) => ing.isSufficient);

  return {
    recipes: validatedRecipes.map((vr) => ({
      code: vr.recipe.code,
      name: vr.recipe.name,
      yieldQuantity: vr.recipe.yieldQuantity,
      yieldUnit: vr.recipe.yieldUnit,
      batchQuantity: vr.batchQuantity,
    })),
    requiredIngredients,
    allAvailable,
  };
}

export async function receiveAdHocIntake(data: {
  itemCode: string;
  quantity: number;
  lotNumber: string;
  supplierName?: string;
  expiryDate?: string;
  unitCost?: number;
  grnNumber?: string;
  waybillUrl?: string;
  performedByName: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  notes?: string;
}) {
  const effectiveSupplier = data.supplierName?.trim() || "Store Intake";

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
          supplierName: effectiveSupplier,
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
          notes: data.notes || (data.supplierName ? `Ad-hoc supplier delivery from ${data.supplierName}. Lot #${data.lotNumber}` : `Ad-hoc raw material inbound. Lot #${data.lotNumber}`),
        }).returning();

        eventBus.publish(
          "INVENTORY_INTAKE_RECORDED",
          {
            itemCode: itemRow.code,
            itemName: itemRow.name,
            quantity: data.quantity,
            uom: itemRow.uom,
            supplier: effectiveSupplier,
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
    supplierName: effectiveSupplier,
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
    notes: data.notes || (data.supplierName ? `Ad-hoc supplier delivery from ${data.supplierName}. Lot #${data.lotNumber}` : `Ad-hoc raw material inbound. Lot #${data.lotNumber}`),
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
      supplier: effectiveSupplier,
      grnNumber: newLot.grnNumber,
      lotNumber: data.lotNumber,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return { success: true, item, lot: newLot, transaction: txn };
}

export interface IntakeRecord {
  id: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  quantity: number;
  unit: string;
  lotId?: string;
  lotNumber?: string;
  grnNumber?: string;
  unitCost?: number;
  expiryDate?: string;
  waybillUrl?: string;
  notes?: string;
  performedByName: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  status: "PERMANENT" | "CANCELLED" | "PENDING_HANDOVER";
  createdAt: string;
}

export async function getRecentIntakes(params?: {
  limit?: number;
  shiftType?: string;
  includeCancelled?: boolean;
}): Promise<IntakeRecord[]> {
  const limit = params?.limit || 50;

  if (db) {
    try {
      const conditions: any[] = [eq(schema.stockTransactions.transactionType, "INBOUND_PURCHASE")];

      if (params?.shiftType && params.shiftType !== "ALL") {
        conditions.push(eq(schema.stockTransactions.shiftType, params.shiftType as any));
      }
      if (!params?.includeCancelled) {
        conditions.push(ne(schema.stockTransactions.status, "CANCELLED"));
      }

      const rows = await db
        .select({
          tx: schema.stockTransactions,
          itemName: schema.items.name,
          itemCode: schema.items.code,
          itemUom: schema.items.uom,
          lotNumber: schema.itemLots.lotNumber,
          unitCost: schema.itemLots.unitCost,
          expiryDate: schema.itemLots.expiryDate,
          waybillUrl: schema.itemLots.waybillUrl,
        })
        .from(schema.stockTransactions)
        .leftJoin(schema.items, eq(schema.stockTransactions.itemId, schema.items.id))
        .leftJoin(schema.itemLots, eq(schema.stockTransactions.lotId, schema.itemLots.id))
        .where(and(...conditions))
        .orderBy(desc(schema.stockTransactions.createdAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.tx.id,
        itemId: r.tx.itemId,
        itemCode: r.itemCode || undefined,
        itemName: r.itemName || r.tx.performedByName || "Raw Material",
        quantity: Math.abs(Number(r.tx.quantity)),
        unit: r.tx.unit || r.itemUom || "units",
        lotId: r.tx.lotId || undefined,
        lotNumber: r.lotNumber || undefined,
        grnNumber: r.tx.referenceId || undefined,
        unitCost: r.unitCost ? Number(r.unitCost) : undefined,
        expiryDate: r.expiryDate ? r.expiryDate.toISOString().slice(0, 10) : undefined,
        waybillUrl: r.waybillUrl || undefined,
        notes: r.tx.notes || undefined,
        performedByName: r.tx.performedByName || "Store Staff",
        shiftType: r.tx.shiftType as any,
        status: (r.tx.status as any) || "PERMANENT",
        createdAt: r.tx.createdAt ? new Date(r.tx.createdAt).toISOString() : new Date().toISOString(),
      }));
    } catch (err) {
      console.error("DB error in getRecentIntakes:", err);
    }
  }

  // Fallback in-memory
  let txns = TRANSACTIONS.filter((t) => t.transactionType === "INBOUND_PURCHASE");
  if (params?.shiftType && params.shiftType !== "ALL") {
    txns = txns.filter((t) => t.shiftType === params.shiftType);
  }
  if (!params?.includeCancelled) {
    txns = txns.filter((t) => t.status !== "CANCELLED");
  }
  txns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return txns.slice(0, limit).map((t) => {
    const item = INVENTORY_ITEMS.find((i) => i.id === t.itemId || i.code === t.itemId);
    const lot = ITEM_LOTS.find((l) => l.grnNumber === t.referenceId || (t.notes && t.notes.includes(l.lotNumber)));
    return {
      id: t.id,
      itemId: t.itemId,
      itemCode: item?.code,
      itemName: item?.name || t.itemName,
      quantity: Math.abs(Number(t.quantity)),
      unit: t.unit,
      lotId: lot?.id,
      lotNumber: lot?.lotNumber,
      grnNumber: t.referenceId,
      unitCost: lot?.unitCost || item?.costPerUnit,
      expiryDate: lot?.expiryDate,
      waybillUrl: lot?.waybillUrl,
      notes: t.notes,
      performedByName: t.performedByName || "Store Staff",
      shiftType: t.shiftType,
      status: (t.status as any) || "PERMANENT",
      createdAt: t.createdAt,
    };
  });
}

export async function updateIntake(data: {
  txId: string;
  quantity?: number;
  unitCost?: number;
  notes?: string;
  expiryDate?: string;
  performedByName: string;
}) {
  const { txId, quantity: newQuantity, unitCost, notes, expiryDate, performedByName } = data;

  if (db) {
    try {
      const foundTx = await db
        .select()
        .from(schema.stockTransactions)
        .where(eq(schema.stockTransactions.id, txId))
        .limit(1);

      if (foundTx.length === 0) {
        throw new Error("Intake record not found.");
      }
      const tx = foundTx[0];
      if (tx.transactionType !== "INBOUND_PURCHASE") {
        throw new Error("Specified transaction is not an inbound intake.");
      }
      if (tx.status === "CANCELLED") {
        throw new Error("Cannot edit an intake that has been cancelled.");
      }

      const oldQuantity = Math.abs(Number(tx.quantity));
      let qtyDiff = 0;
      if (newQuantity !== undefined) {
        if (newQuantity <= 0) {
          throw new Error("Intake quantity must be greater than zero.");
        }
        qtyDiff = Number((newQuantity - oldQuantity).toFixed(3));
      }

      // Check item stock if quantity changed
      const foundItem = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.id, tx.itemId))
        .limit(1);

      if (foundItem.length > 0) {
        const itemRow = foundItem[0];
        const currentStock = Number(itemRow.currentStock);

        if (qtyDiff < 0 && currentStock + qtyDiff < 0) {
          throw new Error(
            `Cannot reduce intake by ${Math.abs(qtyDiff)} ${tx.unit}. Only ${currentStock} ${tx.unit} remains in stock (the rest has already been consumed or dispatched).`
          );
        }

        const newStock = Number((currentStock + qtyDiff).toFixed(3));
        const newCost = unitCost !== undefined ? unitCost.toFixed(2) : itemRow.costPerUnit;

        await db
          .update(schema.items)
          .set({
            currentStock: newStock.toFixed(3),
            costPerUnit: newCost,
            updatedAt: new Date(),
          })
          .where(eq(schema.items.id, itemRow.id));

        // Update in-memory item
        const inMemItem = INVENTORY_ITEMS.find((i) => i.id === itemRow.id || i.code === itemRow.code);
        if (inMemItem) {
          inMemItem.currentStock = newStock;
          if (unitCost !== undefined) inMemItem.costPerUnit = unitCost;
        }
      }

      // Update transaction
      const updateTxData: any = {};
      if (newQuantity !== undefined) {
        updateTxData.quantity = newQuantity.toFixed(3);
      }
      if (notes !== undefined) {
        updateTxData.notes = notes;
      }
      if (Object.keys(updateTxData).length > 0) {
        await db
          .update(schema.stockTransactions)
          .set(updateTxData)
          .where(eq(schema.stockTransactions.id, txId));
      }

      // Update associated itemLots record if lotId exists
      if (tx.lotId) {
        const foundLot = await db
          .select()
          .from(schema.itemLots)
          .where(eq(schema.itemLots.id, tx.lotId))
          .limit(1);

        if (foundLot.length > 0) {
          const lotRow = foundLot[0];
          const updateLotData: any = {};
          if (newQuantity !== undefined) {
            updateLotData.initialQuantity = newQuantity.toFixed(3);
            const updatedRemaining = Math.max(0, Number(lotRow.remainingQuantity) + qtyDiff);
            updateLotData.remainingQuantity = updatedRemaining.toFixed(3);
          }
          if (unitCost !== undefined) {
            updateLotData.unitCost = unitCost.toFixed(2);
          }
          if (expiryDate !== undefined) {
            updateLotData.expiryDate = expiryDate ? new Date(expiryDate) : null;
          }
          if (Object.keys(updateLotData).length > 0) {
            await db
              .update(schema.itemLots)
              .set(updateLotData)
              .where(eq(schema.itemLots.id, tx.lotId));
          }
        }
      }

      eventBus.publish(
        "INVENTORY_INTAKE_RECORDED",
        {
          txId,
          itemId: tx.itemId,
          oldQuantity,
          newQuantity: newQuantity ?? oldQuantity,
          qtyDiff,
          action: "UPDATED",
        },
        performedByName,
        "INVENTORY_STORE"
      );

      return {
        success: true,
        message: "Intake record updated successfully.",
        txId,
      };
    } catch (err: any) {
      if (
        err.message?.includes("Cannot reduce intake") ||
        err.message?.includes("not found") ||
        err.message?.includes("must be greater than zero")
      ) {
        throw err;
      }
      console.error("DB error in updateIntake:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  // In-memory fallback
  const inMemTx = TRANSACTIONS.find((t) => t.id === txId);
  if (!inMemTx || inMemTx.transactionType !== "INBOUND_PURCHASE") {
    throw new Error("Intake record not found.");
  }
  if (inMemTx.status === "CANCELLED") {
    throw new Error("Cannot edit an intake that has been cancelled.");
  }

  const oldQuantity = Math.abs(Number(inMemTx.quantity));
  let qtyDiff = 0;
  if (newQuantity !== undefined) {
    if (newQuantity <= 0) {
      throw new Error("Intake quantity must be greater than zero.");
    }
    qtyDiff = Number((newQuantity - oldQuantity).toFixed(3));
  }

  const inMemItem = INVENTORY_ITEMS.find((i) => i.id === inMemTx.itemId || i.code === inMemTx.itemId);
  if (inMemItem) {
    if (qtyDiff < 0 && inMemItem.currentStock + qtyDiff < 0) {
      throw new Error(
        `Cannot reduce intake by ${Math.abs(qtyDiff)} ${inMemTx.unit}. Only ${inMemItem.currentStock} ${inMemTx.unit} remains in stock.`
      );
    }
    inMemItem.currentStock = Number((inMemItem.currentStock + qtyDiff).toFixed(3));
    if (unitCost !== undefined) inMemItem.costPerUnit = unitCost;
  }

  if (newQuantity !== undefined) {
    inMemTx.quantity = newQuantity;
  }
  if (notes !== undefined) {
    inMemTx.notes = notes;
  }

  const lot = ITEM_LOTS.find((l) => l.grnNumber === inMemTx.referenceId);
  if (lot) {
    if (newQuantity !== undefined) {
      lot.initialQuantity = newQuantity;
      lot.remainingQuantity = Math.max(0, lot.remainingQuantity + qtyDiff);
    }
    if (unitCost !== undefined) lot.unitCost = unitCost;
    if (expiryDate !== undefined) lot.expiryDate = expiryDate;
  }

  return { success: true, message: "Intake record updated successfully.", txId };
}

export async function cancelIntake(data: {
  txId: string;
  performedByName: string;
  reason?: string;
}) {
  const { txId, performedByName, reason } = data;

  if (db) {
    try {
      const foundTx = await db
        .select()
        .from(schema.stockTransactions)
        .where(eq(schema.stockTransactions.id, txId))
        .limit(1);

      if (foundTx.length === 0) {
        throw new Error("Intake record not found.");
      }
      const tx = foundTx[0];
      if (tx.transactionType !== "INBOUND_PURCHASE") {
        throw new Error("Specified transaction is not an inbound intake.");
      }
      if (tx.status === "CANCELLED") {
        throw new Error("This intake has already been cancelled.");
      }

      const qtyToDeduct = Math.abs(Number(tx.quantity));

      const foundItem = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.id, tx.itemId))
        .limit(1);

      if (foundItem.length > 0) {
        const itemRow = foundItem[0];
        const currentStock = Number(itemRow.currentStock);

        if (currentStock < qtyToDeduct) {
          throw new Error(
            `Cannot cancel intake: ${qtyToDeduct} ${tx.unit} was received, but only ${currentStock} ${tx.unit} currently remains in stock (the rest has already been consumed or dispatched).`
          );
        }

        const newStock = Number((currentStock - qtyToDeduct).toFixed(3));
        await db
          .update(schema.items)
          .set({
            currentStock: newStock.toFixed(3),
            updatedAt: new Date(),
          })
          .where(eq(schema.items.id, itemRow.id));

        const inMemItem = INVENTORY_ITEMS.find((i) => i.id === itemRow.id || i.code === itemRow.code);
        if (inMemItem) {
          inMemItem.currentStock = newStock;
        }
      }

      // Mark transaction CANCELLED
      const cancelNote = `[CANCELLED by ${performedByName}${reason ? `: ${reason}` : ""} at ${new Date().toLocaleTimeString()}]: ${tx.notes || ""}`;
      await db
        .update(schema.stockTransactions)
        .set({
          status: "CANCELLED",
          notes: cancelNote,
        })
        .where(eq(schema.stockTransactions.id, tx.id));

      // Mark lot remainingQuantity = 0
      if (tx.lotId) {
        await db
          .update(schema.itemLots)
          .set({
            remainingQuantity: "0.000",
          })
          .where(eq(schema.itemLots.id, tx.lotId));
      }

      eventBus.publish(
        "INVENTORY_INTAKE_RECORDED",
        {
          txId,
          itemId: tx.itemId,
          deductedQuantity: qtyToDeduct,
          action: "CANCELLED",
        },
        performedByName,
        "INVENTORY_STORE"
      );

      return {
        success: true,
        message: `Intake cancelled and ${qtyToDeduct} ${tx.unit} reversed from stock.`,
        txId,
      };
    } catch (err: any) {
      if (
        err.message?.includes("Cannot cancel intake") ||
        err.message?.includes("not found") ||
        err.message?.includes("already been cancelled")
      ) {
        throw err;
      }
      console.error("DB error in cancelIntake:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  // In-memory fallback
  const inMemTx = TRANSACTIONS.find((t) => t.id === txId);
  if (!inMemTx || inMemTx.transactionType !== "INBOUND_PURCHASE") {
    throw new Error("Intake record not found.");
  }
  if (inMemTx.status === "CANCELLED") {
    throw new Error("This intake has already been cancelled.");
  }

  const qtyToDeduct = Math.abs(Number(inMemTx.quantity));
  const inMemItem = INVENTORY_ITEMS.find((i) => i.id === inMemTx.itemId || i.code === inMemTx.itemId);
  if (inMemItem) {
    if (inMemItem.currentStock < qtyToDeduct) {
      throw new Error(
        `Cannot cancel intake: ${qtyToDeduct} ${inMemTx.unit} was received, but only ${inMemItem.currentStock} ${inMemTx.unit} currently remains in stock.`
      );
    }
    inMemItem.currentStock = Number((inMemItem.currentStock - qtyToDeduct).toFixed(3));
  }

  inMemTx.status = "CANCELLED";
  inMemTx.notes = `[CANCELLED by ${performedByName}${reason ? `: ${reason}` : ""}]: ${inMemTx.notes || ""}`;

  const lot = ITEM_LOTS.find((l) => l.grnNumber === inMemTx.referenceId);
  if (lot) {
    lot.remainingQuantity = 0;
  }

  return {
    success: true,
    message: `Intake cancelled and ${qtyToDeduct} ${inMemTx.unit} reversed from stock.`,
    txId,
  };
}

export interface DamageRecord {
  id: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  quantity: number;
  unit: string;
  damageDate: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  reason: string;
  notes?: string;
  performedByName: string;
  referenceId?: string;
  status: "PERMANENT" | "CANCELLED";
  createdAt: string;
}

export async function recordStockDamage(data: {
  itemCode: string;
  quantity: number;
  damageDate?: string;
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT";
  reason: string;
  notes?: string;
  performedByName: string;
  attachmentUrl?: string;
}): Promise<{ success: boolean; message: string; txId: string; referenceId: string }> {
  const {
    itemCode,
    quantity,
    damageDate,
    shiftType = "MORNING_SHIFT",
    reason,
    notes,
    performedByName,
  } = data;

  if (quantity <= 0) {
    throw new Error("Damage quantity must be greater than zero.");
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDate = damageDate?.trim() || todayStr;
  if (targetDate > todayStr) {
    throw new Error("Damage date cannot be in the future.");
  }

  // Construct timestamp aligned to target date and shift
  const txTimestamp =
    shiftType === "NIGHT_SHIFT"
      ? new Date(`${targetDate}T21:00:00.000Z`)
      : new Date(`${targetDate}T12:00:00.000Z`);

  const refId = `DMG-${targetDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const formattedNotes = `[Reason: ${reason}] ${notes || ""}`.trim();

  if (db) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemCode);
      const condition = isUuid ? eq(schema.items.id, itemCode) : eq(schema.items.code, itemCode);

      const foundItem = await db
        .select()
        .from(schema.items)
        .where(condition)
        .limit(1);

      if (foundItem.length === 0) {
        throw new Error(`Item with code ${itemCode} not found in inventory.`);
      }

      const itemRow = foundItem[0];
      const currentStock = Number(itemRow.currentStock);

      if (currentStock < quantity) {
        throw new Error(
          `Cannot record damage: requested ${quantity} ${itemRow.uom}, but only ${currentStock} ${itemRow.uom} currently remains in warehouse stock.`
        );
      }

      const newStock = Number((currentStock - quantity).toFixed(3));

      // 1. Deduct stock from item
      await db
        .update(schema.items)
        .set({
          currentStock: newStock.toFixed(3),
          updatedAt: new Date(),
        })
        .where(eq(schema.items.id, itemRow.id));

      // 2. Insert stock transaction
      const [insertedTx] = await db
        .insert(schema.stockTransactions)
        .values({
          itemId: itemRow.id,
          transactionType: "DISPOSAL_EXPIRED_SPOILT",
          quantity: quantity.toString(),
          unit: itemRow.uom,
          shiftType,
          performedByName,
          recipient: "Disposal / Scrap",
          referenceId: refId,
          notes: formattedNotes,
          status: "PERMANENT",
          createdAt: txTimestamp,
        })
        .returning();

      // Update in-memory item
      const inMemItem = INVENTORY_ITEMS.find((i) => i.id === itemRow.id || i.code === itemRow.code);
      if (inMemItem) {
        inMemItem.currentStock = newStock;
      }

      // Add to in-memory transactions cache for fast query
      TRANSACTIONS.unshift({
        id: insertedTx.id,
        itemId: itemRow.id,
        itemName: itemRow.name,
        transactionType: "DISPOSAL_EXPIRED_SPOILT",
        quantity: quantity,
        unit: itemRow.uom,
        shiftType,
        performedByName,
        recipient: "Disposal / Scrap",
        referenceId: refId,
        notes: formattedNotes,
        status: "PERMANENT",
        createdAt: txTimestamp.toISOString(),
      });

      eventBus.publish(
        "INVENTORY_DAMAGED",
        {
          txId: insertedTx.id,
          itemId: itemRow.id,
          itemCode: itemRow.code,
          itemName: itemRow.name,
          quantity,
          unit: itemRow.uom,
          damageDate: targetDate,
          shiftType,
          reason,
          notes,
        },
        performedByName,
        "INVENTORY_STORE"
      );

      return {
        success: true,
        message: `Damage of ${quantity} ${itemRow.uom} logged for ${targetDate} (${shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} Shift).`,
        txId: insertedTx.id,
        referenceId: refId,
      };
    } catch (err: any) {
      if (
        err.message?.includes("Cannot record damage") ||
        err.message?.includes("not found") ||
        err.message?.includes("must be greater than zero") ||
        err.message?.includes("cannot be in the future")
      ) {
        throw err;
      }
      console.error("DB error in recordStockDamage:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  // In-memory fallback
  const inMemItem = INVENTORY_ITEMS.find((i) => i.code === itemCode || i.id === itemCode);
  if (!inMemItem) {
    throw new Error(`Item with code ${itemCode} not found in inventory.`);
  }

  if (inMemItem.currentStock < quantity) {
    throw new Error(
      `Cannot record damage: requested ${quantity} ${inMemItem.uom}, but only ${inMemItem.currentStock} ${inMemItem.uom} currently remains in warehouse stock.`
    );
  }

  inMemItem.currentStock = Number((inMemItem.currentStock - quantity).toFixed(3));
  const newTxId = crypto.randomUUID();

  TRANSACTIONS.unshift({
    id: newTxId,
    itemId: inMemItem.id,
    itemName: inMemItem.name,
    transactionType: "DISPOSAL_EXPIRED_SPOILT",
    quantity: quantity,
    unit: inMemItem.uom,
    shiftType,
    performedByName,
    recipient: "Disposal / Scrap",
    referenceId: refId,
    notes: formattedNotes,
    status: "PERMANENT",
    createdAt: txTimestamp.toISOString(),
  });

  return {
    success: true,
    message: `Damage of ${quantity} ${inMemItem.uom} logged for ${targetDate} (${shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} Shift).`,
    txId: newTxId,
    referenceId: refId,
  };
}

export async function getRecentDamages(params?: {
  limit?: number;
  date?: string;
  shiftType?: string;
  includeCancelled?: boolean;
}): Promise<DamageRecord[]> {
  const limit = params?.limit || 50;

  if (db) {
    try {
      const conditions: any[] = [
        eq(schema.stockTransactions.transactionType, "DISPOSAL_EXPIRED_SPOILT"),
      ];

      if (params?.shiftType && params.shiftType !== "ALL") {
        conditions.push(eq(schema.stockTransactions.shiftType, params.shiftType as any));
      }
      if (!params?.includeCancelled) {
        conditions.push(ne(schema.stockTransactions.status, "CANCELLED"));
      }

      const rows = await db
        .select({
          tx: schema.stockTransactions,
          itemName: schema.items.name,
          itemCode: schema.items.code,
          itemUom: schema.items.uom,
        })
        .from(schema.stockTransactions)
        .leftJoin(schema.items, eq(schema.stockTransactions.itemId, schema.items.id))
        .where(and(...conditions))
        .orderBy(desc(schema.stockTransactions.createdAt))
        .limit(limit);

      let results: DamageRecord[] = rows.map((r) => {
        const txDate = r.tx.createdAt
          ? new Date(r.tx.createdAt).toISOString().slice(0, 10)
          : "";
        // Extract reason from notes formatted as [Reason: ...] notes
        let reason = "Expired / Spoilt";
        let notesText = r.tx.notes || "";
        const reasonMatch = notesText.match(/^\[Reason:\s*([^\]]+)\]\s*(.*)$/);
        if (reasonMatch) {
          reason = reasonMatch[1].trim();
          notesText = reasonMatch[2].trim();
        }

        return {
          id: r.tx.id,
          itemId: r.tx.itemId,
          itemCode: r.itemCode || undefined,
          itemName: r.itemName || r.tx.performedByName || "Raw Material",
          quantity: Math.abs(Number(r.tx.quantity)),
          unit: r.tx.unit || r.itemUom || "units",
          damageDate: txDate,
          shiftType: r.tx.shiftType as any,
          reason,
          notes: notesText || undefined,
          performedByName: r.tx.performedByName || "Store Staff",
          referenceId: r.tx.referenceId || undefined,
          status: (r.tx.status as any) || "PERMANENT",
          createdAt: r.tx.createdAt ? new Date(r.tx.createdAt).toISOString() : new Date().toISOString(),
        };
      });

      if (params?.date) {
        results = results.filter((r) => r.damageDate === params.date);
      }

      return results;
    } catch (err) {
      console.error("DB error in getRecentDamages:", err);
    }
  }

  // Fallback in-memory
  let txns = TRANSACTIONS.filter((t) => t.transactionType === "DISPOSAL_EXPIRED_SPOILT");
  if (params?.shiftType && params.shiftType !== "ALL") {
    txns = txns.filter((t) => t.shiftType === params.shiftType);
  }
  if (!params?.includeCancelled) {
    txns = txns.filter((t) => t.status !== "CANCELLED");
  }
  if (params?.date) {
    txns = txns.filter((t) => (t.createdAt || "").slice(0, 10) === params.date);
  }
  txns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return txns.slice(0, limit).map((t) => {
    const item = INVENTORY_ITEMS.find((i) => i.id === t.itemId || i.code === t.itemId);
    let reason = "Expired / Spoilt";
    let notesText = t.notes || "";
    const reasonMatch = notesText.match(/^\[Reason:\s*([^\]]+)\]\s*(.*)$/);
    if (reasonMatch) {
      reason = reasonMatch[1].trim();
      notesText = reasonMatch[2].trim();
    }

    return {
      id: t.id,
      itemId: t.itemId,
      itemCode: item?.code,
      itemName: item?.name || t.itemName,
      quantity: Math.abs(Number(t.quantity)),
      unit: t.unit,
      damageDate: (t.createdAt || "").slice(0, 10),
      shiftType: t.shiftType,
      reason,
      notes: notesText || undefined,
      performedByName: t.performedByName || "Store Staff",
      referenceId: t.referenceId,
      status: (t.status as any) || "PERMANENT",
      createdAt: t.createdAt,
    };
  });
}

export async function cancelStockDamage(data: {
  txId: string;
  performedByName: string;
  reason?: string;
}): Promise<{ success: boolean; message: string; txId: string }> {
  const { txId, performedByName, reason } = data;

  if (db) {
    try {
      const foundTx = await db
        .select()
        .from(schema.stockTransactions)
        .where(eq(schema.stockTransactions.id, txId))
        .limit(1);

      if (foundTx.length === 0) {
        throw new Error("Damage record not found.");
      }
      const tx = foundTx[0];
      if (tx.transactionType !== "DISPOSAL_EXPIRED_SPOILT") {
        throw new Error("Specified transaction is not a stock damage entry.");
      }
      if (tx.status === "CANCELLED") {
        throw new Error("This damage entry has already been cancelled.");
      }

      const qtyToRestore = Math.abs(Number(tx.quantity));

      const foundItem = await db
        .select()
        .from(schema.items)
        .where(eq(schema.items.id, tx.itemId))
        .limit(1);

      if (foundItem.length > 0) {
        const itemRow = foundItem[0];
        const newStock = Number((Number(itemRow.currentStock) + qtyToRestore).toFixed(3));

        await db
          .update(schema.items)
          .set({
            currentStock: newStock.toFixed(3),
            updatedAt: new Date(),
          })
          .where(eq(schema.items.id, itemRow.id));

        const inMemItem = INVENTORY_ITEMS.find((i) => i.id === itemRow.id || i.code === itemRow.code);
        if (inMemItem) {
          inMemItem.currentStock = newStock;
        }
      }

      // Mark transaction CANCELLED
      const cancelNote = `[CANCELLED by ${performedByName}${reason ? `: ${reason}` : ""} at ${new Date().toLocaleTimeString()}]: ${tx.notes || ""}`;
      await db
        .update(schema.stockTransactions)
        .set({
          status: "CANCELLED",
          notes: cancelNote,
        })
        .where(eq(schema.stockTransactions.id, tx.id));

      eventBus.publish(
        "INVENTORY_DAMAGED",
        {
          txId,
          itemId: tx.itemId,
          restoredQuantity: qtyToRestore,
          action: "CANCELLED",
        },
        performedByName,
        "INVENTORY_STORE"
      );

      return {
        success: true,
        message: `Damage entry cancelled and ${qtyToRestore} ${tx.unit} restored to warehouse stock.`,
        txId,
      };
    } catch (err: any) {
      if (
        err.message?.includes("not found") ||
        err.message?.includes("already been cancelled")
      ) {
        throw err;
      }
      console.error("DB error in cancelStockDamage:", err);
      if (shouldDisableMocks) throw err;
    }
  }

  // In-memory fallback
  const inMemTx = TRANSACTIONS.find((t) => t.id === txId);
  if (!inMemTx || inMemTx.transactionType !== "DISPOSAL_EXPIRED_SPOILT") {
    throw new Error("Damage record not found.");
  }
  if (inMemTx.status === "CANCELLED") {
    throw new Error("This damage entry has already been cancelled.");
  }

  const qtyToRestore = Math.abs(Number(inMemTx.quantity));
  const inMemItem = INVENTORY_ITEMS.find((i) => i.id === inMemTx.itemId || i.code === inMemTx.itemId);
  if (inMemItem) {
    inMemItem.currentStock = Number((inMemItem.currentStock + qtyToRestore).toFixed(3));
  }

  inMemTx.status = "CANCELLED";
  inMemTx.notes = `[CANCELLED by ${performedByName}${reason ? `: ${reason}` : ""}]: ${inMemTx.notes || ""}`;

  return {
    success: true,
    message: `Damage entry cancelled and ${qtyToRestore} ${inMemTx.unit} restored to warehouse stock.`,
    txId,
  };
}

export interface DispenseCustomIngredient {
  itemCode: string;
  quantity: number;
  itemName?: string;
  uom?: string;
  notes?: string;
}

export async function dispenseBatchToProduction(data: {
  recipeCode?: string;
  batchQuantity?: number;
  recipes?: Array<{ recipeCode: string; batchQuantity: number }>;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  notes?: string;
  customIngredients?: DispenseCustomIngredient[];
}) {
  const allRecipes = await getProductRecipes();
  const recipeBatches: Array<{ recipe: ProductRecipe; batchQuantity: number }> = [];

  if (data.recipes && Array.isArray(data.recipes) && data.recipes.length > 0) {
    for (const rb of data.recipes) {
      const r = allRecipes.find((rec) => rec.code === rb.recipeCode);
      if (r && Number(rb.batchQuantity) > 0) {
        recipeBatches.push({ recipe: r, batchQuantity: Number(rb.batchQuantity) });
      }
    }
  } else if (data.recipeCode && data.batchQuantity) {
    const r = allRecipes.find((rec) => rec.code === data.recipeCode);
    if (r && Number(data.batchQuantity) > 0) {
      recipeBatches.push({ recipe: r, batchQuantity: Number(data.batchQuantity) });
    }
  }

  if (recipeBatches.length === 0) {
    throw new Error("No valid recipes provided for batch dispensing.");
  }

  const isMulti = recipeBatches.length > 1;
  const primaryRecipe = recipeBatches[0].recipe;
  const totalBatchQuantity = recipeBatches.reduce((acc, rb) => acc + rb.batchQuantity, 0);

  const items = await getInventoryItems();
  const recordedTxns: StockTransaction[] = [];
  const allDispensedList: {
    itemCode: string;
    itemName: string;
    unitRequired: number;
    uom: string;
    availableStock: number;
    isSufficient: boolean;
    shortfall: number;
  }[] = [];
  const variableItemsMap = new Map<string, VariableItemUsage>();
  const createdBatchRefs: string[] = [];

  const activeCustom = data.customIngredients && Array.isArray(data.customIngredients)
    ? data.customIngredients.filter((ci) => Number(ci.quantity) > 0)
    : null;

  if (activeCustom) {
    if (activeCustom.length === 0) {
      throw new Error("Cannot dispense batch: at least 1 ingredient must have a quantity greater than 0.");
    }
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
  } else {
    // Validate standard BOM calculation
    const calculation = await calculateMultiRecipeRequirements(
      recipeBatches.map((rb) => ({
        recipeCode: rb.recipe.code,
        batchQuantity: rb.batchQuantity,
      }))
    );
    if (!calculation.allAvailable) {
      const missing = calculation.requiredIngredients
        .filter((i) => !i.isSufficient)
        .map((i) => `${i.itemName} (Shortfall: ${i.shortfall} ${i.uom})`)
        .join(", ");
      throw new Error(`Insufficient stock to dispense batch: ${missing}`);
    }
  }

  // Pre-calculate standard requirements per item across all recipe batches for proportional allocation
  const itemTotalStdNeeded = new Map<string, number>();
  for (const rb of recipeBatches) {
    const factor = rb.batchQuantity / rb.recipe.yieldQuantity;
    for (const ing of rb.recipe.ingredients) {
      const needed = Number((ing.quantityRequired * factor).toFixed(3));
      itemTotalStdNeeded.set(ing.itemCode, Number(((itemTotalStdNeeded.get(ing.itemCode) || 0) + needed).toFixed(3)));
    }
  }

  // Dispense each recipe as its own distinct run
  const nowTs = Date.now().toString().slice(-4);
  for (let rbIdx = 0; rbIdx < recipeBatches.length; rbIdx++) {
    const rb = recipeBatches[rbIdx];
    const cleanCode = rb.recipe.code.replace("REC-", "").replace("PROD-", "");
    const rbRef = `BATCH-${cleanCode}-${nowTs}${recipeBatches.length > 1 ? `-${rbIdx + 1}` : ""}`;
    createdBatchRefs.push(rbRef);

    const recipeFactor = rb.batchQuantity / rb.recipe.yieldQuantity;
    const rbIngredients: Array<{ itemCode: string; itemName: string; quantity: number; uom: string; isVariable: boolean }> = [];

    for (const ing of rb.recipe.ingredients) {
      const item = items.find((i) => i.code === ing.itemCode);
      if (!item) continue;
      const stdQty = Number((ing.quantityRequired * recipeFactor).toFixed(3));

      let allocatedQty = stdQty;
      if (activeCustom) {
        const customItem = activeCustom.find((ci) => ci.itemCode === ing.itemCode);
        const totalStd = itemTotalStdNeeded.get(ing.itemCode) || stdQty;
        if (customItem && totalStd > 0) {
          allocatedQty = Number((Number(customItem.quantity) * (stdQty / totalStd)).toFixed(3));
        }
      }

      rbIngredients.push({
        itemCode: ing.itemCode,
        itemName: item.name,
        quantity: allocatedQty,
        uom: ing.uom || item.uom,
        isVariable: Boolean(item.isVariablePack),
      });
    }

    // If primary recipe and custom ingredients had extra items not in any recipe, append them
    if (rbIdx === 0 && activeCustom) {
      for (const ci of activeCustom) {
        if (!itemTotalStdNeeded.has(ci.itemCode)) {
          const item = items.find((i) => i.code === ci.itemCode);
          if (item) {
            rbIngredients.push({
              itemCode: ci.itemCode,
              itemName: item.name,
              quantity: Number(ci.quantity),
              uom: ci.uom || item.uom,
              isVariable: Boolean(item.isVariablePack),
            });
          }
        }
      }
    }

    // Record transactions for this specific recipe
    for (const ing of rbIngredients) {
      const item = items.find((i) => i.code === ing.itemCode);
      if (!item) continue;

      const isVariable = ing.isVariable;
      let qtyDeducted = ing.quantity;
      let noteText = `Dispensed for ${rb.batchQuantity}x ${rb.recipe.name}.`;
      let txQuantity = -qtyDeducted;

      if (isVariable) {
        if (!variableItemsMap.has(item.code)) {
          variableItemsMap.set(item.code, {
            id: item.id,
            code: item.code,
            name: item.name,
            currentStock: item.currentStock,
            uom: item.uom,
            recipeUom: item.recipeUom || ing.uom,
            quantityDispensed: ing.quantity,
            dispensedUom: ing.uom || item.recipeUom || item.uom,
          });
        } else {
          const existing = variableItemsMap.get(item.code)!;
          existing.quantityDispensed = Number(((existing.quantityDispensed || 0) + ing.quantity).toFixed(3));
        }

        qtyDeducted = 0;
        txQuantity = 0;
        const portionUnit = ing.uom || item.recipeUom || "pcs";
        noteText = `${noteText} [Variable material: ${ing.quantity} ${portionUnit} dished for production. Pending remaining stock confirmation]`;
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
        referenceId: rbRef,
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
              referenceId: rbRef,
              notes: noteText,
              status: "PENDING_HANDOVER",
            });
          }
        } catch (err) {
          console.error("DB error in dispensing recipe item:", err);
        }
      }

      TRANSACTIONS.unshift(txn);
      recordedTxns.push(txn);

      allDispensedList.push({
        itemCode: item.code,
        itemName: item.name,
        unitRequired: isVariable ? ing.quantity : qtyDeducted,
        uom: isVariable && ing.uom ? ing.uom : item.uom,
        availableStock: item.currentStock,
        isSufficient: true,
        shortfall: 0,
      });
    }

    eventBus.publish(
      "INVENTORY_BATCH_DISPENSED",
      {
        recipeCode: rb.recipe.code,
        recipeName: rb.recipe.name,
        batchQuantity: rb.batchQuantity,
        recipient: data.recipient,
        referenceId: rbRef,
        materialsCount: rbIngredients.length,
      },
      data.performedByName,
      "INVENTORY_STORE"
    );
  }

  const variableItemsList = Array.from(variableItemsMap.values());

  return {
    success: true,
    batchReference: createdBatchRefs[0],
    batchReferences: createdBatchRefs,
    recipeName: isMulti ? `${recipeBatches[0].recipe.name} (+${recipeBatches.length - 1} more)` : recipeBatches[0].recipe.name,
    batchQuantity: totalBatchQuantity,
    recipes: recipeBatches.map((rb, idx) => ({
      code: rb.recipe.code,
      name: rb.recipe.name,
      quantity: rb.batchQuantity,
      batchReference: createdBatchRefs[idx],
    })),
    dispensedIngredients: allDispensedList,
    transactions: recordedTxns,
    variableItems: variableItemsList,
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
  recipient?: string;
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
            recipient: data.recipient || "Production Floor",
            referenceId: refCode,
            notes: noteText,
            status: "PENDING_HANDOVER",
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
      recipient: data.recipient || "Production Floor",
      referenceId: refCode,
      notes: noteText,
      status: "PENDING_HANDOVER",
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
  // Exclude cancelled transactions and warehouse damages (DMG-*, handled separately)
  const activeTxns = allTxns.filter(
    (txn) =>
      txn.status !== "CANCELLED" &&
      !txn.notes?.includes("[CANCELLED") &&
      !txn.referenceId?.startsWith("DMG-")
  );
  const allItems = await getInventoryItems();
  const itemMap = new Map(allItems.map((i) => [i.id, i]));
  const itemCodeMap = new Map(allItems.map((i) => [i.code, i]));

  let totalFaultLossValue = 0;
  let totalRestockedValue = 0;
  let faultScrappedCount = 0;
  let excessRestockedCount = 0;

  const reasonCounts: Record<string, number> = {};

  const enrichedReturns = activeTxns.map((txn) => {
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
    totalReturnsCount: activeTxns.length,
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

  const sortedRows = sortItemsByNotebookSequence(rows);

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
      totalItems: sortedRows.length,
      totalOpening: Number(summaryOpening.toFixed(3)),
      totalNewStock: Number(summaryNewStock.toFixed(3)),
      totalUsage: Number(summaryUsage.toFixed(3)),
      totalDamages: Number(summaryDamages.toFixed(3)),
      totalClosing: Number(summaryClosing.toFixed(3)),
      discrepanciesCount,
    },
    rows: sortedRows,
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

  const itemMapById = new Map<string, InventoryItem>();
  const itemMapByCode = new Map<string, InventoryItem>();
  const itemMapByName = new Map<string, InventoryItem>();

  for (const item of allItems) {
    if (item.id) itemMapById.set(item.id, item);
    if (item.code) itemMapByCode.set(item.code.toUpperCase(), item);
    if (item.name) itemMapByName.set(item.name.toLowerCase().trim(), item);
  }

  const isInPeriod = (txn: StockTransaction): boolean => {
    const txnDate = (txn.createdAt || "").slice(0, 10);
    if (!txnDate) return false;
    if (txnDate < startDate || txnDate > endDate) return false;
    if (targetShift === "ALL") return true;
    return txn.shiftType === targetShift;
  };

  const periodTxns = allTxns.filter(isInPeriod);

  // Sort chronologically ascending (oldest first to newest for sequential audit trail)
  periodTxns.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return (a.id || "").localeCompare(b.id || "");
  });

  const formatCategory = (cat?: string): string => {
    if (cat === "PERISHABLE_MEASURED") return "Perishable (Measured)";
    if (cat === "PERISHABLE_NUMBERED") return "Perishable (Numbered)";
    if (cat === "PACKAGING_NON_PERISHABLE") return "Packaging (Non-Perishable)";
    return cat || "General";
  };

  const getMovementDetails = (txnType: string): { label: string; direction: "IN (+)" | "OUT (-)" | "ADJUST (+/-)"; sign: number } => {
    switch (txnType) {
      case "INBOUND_PURCHASE":
        return { label: "Inbound Purchase / Restock", direction: "IN (+)", sign: 1 };
      case "RETURN_EXCESS_RESTOCK":
        return { label: "Unused Excess Return Restock", direction: "IN (+)", sign: 1 };
      case "DISPENSE_PRODUCTION":
        return { label: "Production Recipe Batch Dispense", direction: "OUT (-)", sign: -1 };
      case "DISPENSE_INDIVIDUAL":
        return { label: "Individual Material Requisition", direction: "OUT (-)", sign: -1 };
      case "RETURN_FAULT_SCRAP":
        return { label: "Damaged / Defect Scrap", direction: "OUT (-)", sign: -1 };
      case "RETURN_FAULT_REPLACE":
        return { label: "Defect Replacement", direction: "OUT (-)", sign: -1 };
      case "DISPOSAL_EXPIRED_SPOILT":
        return { label: "Expired / Spoilt Stock Disposal", direction: "OUT (-)", sign: -1 };
      case "RECONCILIATION_ADJUST":
        return { label: "Shift Reconciliation Adjustment", direction: "ADJUST (+/-)", sign: 0 };
      default:
        return { label: txnType || "Inventory Movement", direction: "OUT (-)", sign: -1 };
    }
  };

  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, " ").trim();
    return `"${str}"`;
  };

  const headers = [
    "Transaction ID",
    "Date (YYYY-MM-DD)",
    "Time (HH:MM:SS)",
    "Shift",
    "Reference / Batch ID",
    "Movement Type",
    "Direction",
    "Item SKU",
    "Item Name",
    "Category",
    "Quantity",
    "UoM",
    "Portion / Secondary Details",
    "Unit Cost (NGN)",
    "Total Valuation Impact (NGN)",
    "Performed By (Staff)",
    "Recipient / Destination",
    "Handover Status",
    "Audit & Requisition Notes",
  ];

  const rows = periodTxns.map((t) => {
    const matchedItem =
      (t.itemId && itemMapById.get(t.itemId)) ||
      (t.itemCode && itemMapByCode.get(t.itemCode.toUpperCase())) ||
      (t.itemId && itemMapByCode.get(t.itemId.toUpperCase())) ||
      (t.itemName && itemMapByName.get(t.itemName.toLowerCase().trim())) ||
      null;

    const created = t.createdAt ? new Date(t.createdAt) : new Date();
    const dateStr = !isNaN(created.getTime()) ? created.toISOString().split("T")[0] : "";
    const timeStr = !isNaN(created.getTime()) ? created.toISOString().split("T")[1]?.slice(0, 8) || "" : "";

    const shiftLabel =
      t.shiftType === "MORNING_SHIFT"
        ? "Morning Shift (08:00 - 18:00)"
        : "Night Shift (18:00 - 08:00)";
    const refId = t.referenceId || "N/A";
    const move = getMovementDetails(t.transactionType);

    const itemSku = matchedItem?.code || t.itemCode || t.itemId || "N/A";
    const itemName = matchedItem?.name || t.itemName || "Unknown Item";
    const category = formatCategory(matchedItem?.category);
    const uom = t.unit || matchedItem?.uom || "units";
    const unitCost = Number(matchedItem?.costPerUnit || 0);

    let qtyFormatted: number;
    let valuationImpact: number;

    if (t.transactionType === "RECONCILIATION_ADJUST") {
      const qtyVal = Number(t.quantity) || 0;
      qtyFormatted = Number(qtyVal.toFixed(3));
      valuationImpact = Number((qtyVal * unitCost).toFixed(2));
    } else {
      const rawQty = Math.abs(Number(t.quantity) || 0);
      qtyFormatted = Number(rawQty.toFixed(3));
      valuationImpact = Number((move.sign * rawQty * unitCost).toFixed(2));
    }

    let portionDetails = "-";
    if (matchedItem?.isVariablePack || (t.notes && /portion|dished|gave out|variable/i.test(t.notes))) {
      const match = t.notes?.match(
        /(?:gave out|dished out|dished|dispensed|took|taken|used|variable material:?)\s*(\d+(?:\.\d+)?)\s*(pcs|pieces|cups|ml|g|kg|cl|l)/i
      );
      if (match) {
        portionDetails = `${match[1]} ${match[2]}`;
      } else if (matchedItem?.recipeUom && matchedItem?.portionsPerContainer) {
        portionDetails = `Base pack (${matchedItem.portionsPerContainer} ${matchedItem.recipeUom}/unit)`;
      }
    }

    const staff = cleanStaffName(t.performedByName || "Store Staff");
    const recipient = t.recipient || "-";
    const handoverStatus = getEffectiveDispatchStatus(t.createdAt, t.shiftType, t.status);
    const notes = t.notes || "";

    return [
      escapeCsv(t.id),
      escapeCsv(dateStr),
      escapeCsv(timeStr),
      escapeCsv(shiftLabel),
      escapeCsv(refId),
      escapeCsv(move.label),
      escapeCsv(move.direction),
      escapeCsv(itemSku),
      escapeCsv(itemName),
      escapeCsv(category),
      qtyFormatted,
      escapeCsv(uom),
      escapeCsv(portionDetails),
      unitCost.toFixed(2),
      valuationImpact.toFixed(2),
      escapeCsv(staff),
      escapeCsv(recipient),
      escapeCsv(handoverStatus),
      escapeCsv(notes),
    ].join(",");
  });

  const csvLines: string[] = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows,
  ];

  return csvLines.join("\n");
}


