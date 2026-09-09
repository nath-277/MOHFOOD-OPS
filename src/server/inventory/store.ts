import { eventBus } from "../events/eventBus";
import { db, schema } from "../db";
import { eq, desc, inArray } from "drizzle-orm";

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
  isActive: boolean;
}

export function normalizeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/api/storage/")) return url;
  if (url.includes("/inventory-items/")) {
    const key = "inventory-items/" + url.split("/inventory-items/")[1];
    return `/api/storage/${key}`;
  }
  if (url.includes("/uploads/")) {
    const key = "uploads/" + url.split("/uploads/")[1];
    return `/api/storage/${key}`;
  }
  return url;
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
  createdAt: string;
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
  }[];
}

// Initial Seed Data for Moh Foods Factory Floor
const INVENTORY_ITEMS: InventoryItem[] = [
  // 1. Measured Perishables
  { id: "item-01", code: "RAW-MLK-01", name: "Fresh Whole Cow Milk", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 450.500, minStockThreshold: 50.000, costPerUnit: 1400, storageLocation: "Cold Room A (4°C)", isActive: true },
  { id: "item-02", code: "RAW-MLK-02", name: "Full Cream Powdered Milk", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 180.000, minStockThreshold: 30.000, costPerUnit: 3500, storageLocation: "Dry Store Shelf 1", isActive: true },
  { id: "item-03", code: "RAW-SGR-01", name: "Granulated White Sugar", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 120.000, minStockThreshold: 25.000, costPerUnit: 1800, storageLocation: "Dry Store Shelf 2", isActive: true },
  { id: "item-04", code: "RAW-OAT-01", name: "Rolled Oats Flakes", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 88.250, minStockThreshold: 20.000, costPerUnit: 2200, storageLocation: "Dry Store Shelf 3", isActive: true },
  { id: "item-05", code: "RAW-GRN-01", name: "Honey Crunchy Granola", category: "PERISHABLE_MEASURED", uom: "kg", currentStock: 95.000, minStockThreshold: 25.000, costPerUnit: 3800, storageLocation: "Dry Store Shelf 3", isActive: true },
  { id: "item-06", code: "RAW-RSN-01", name: "Seedless Golden Raisins", category: "PERISHABLE_MEASURED", uom: "cups", currentStock: 35.000, minStockThreshold: 10.000, costPerUnit: 900, storageLocation: "Dry Store Bin 4", isActive: true },
  { id: "item-07", code: "RAW-VAN-01", name: "Pure Vanilla Extract", category: "PERISHABLE_MEASURED", uom: "L", currentStock: 15.000, minStockThreshold: 5.000, costPerUnit: 8500, storageLocation: "Dry Store Locked Cabinet", isActive: true },

  // 2. Numbered Perishables
  { id: "item-08", code: "RAW-APL-01", name: "Fresh Crisp Green Apples", category: "PERISHABLE_NUMBERED", uom: "pcs", currentStock: 1420, minStockThreshold: 300, costPerUnit: 250, storageLocation: "Cold Room B (Fruit Bay)", isActive: true },
  { id: "item-09", code: "RAW-GRP-01", name: "Seedless Purple Grapes", category: "PERISHABLE_NUMBERED", uom: "pcs", currentStock: 3200, minStockThreshold: 500, costPerUnit: 60, storageLocation: "Cold Room B (Fruit Bay)", isActive: true },
  { id: "item-10", code: "RAW-CCN-01", name: "Fresh Whole Coconuts", category: "PERISHABLE_NUMBERED", uom: "nuts", currentStock: 385, minStockThreshold: 100, costPerUnit: 450, storageLocation: "Fruit Prep Bay", isActive: true },
  { id: "item-11", code: "RAW-CSH-01", name: "Roasted Cashew Nuts", category: "PERISHABLE_NUMBERED", uom: "packs", currentStock: 650, minStockThreshold: 150, costPerUnit: 600, storageLocation: "Dry Store Shelf 4", isActive: true },

  // 3. Packaging & Non-Perishables
  { id: "item-12", code: "PKG-CUP-400", name: "Parfait Cups & Dome Lids (400ml)", category: "PACKAGING_NON_PERISHABLE", uom: "sets", currentStock: 4800, minStockThreshold: 1000, costPerUnit: 120, storageLocation: "Packaging Bay A", isActive: true },
  { id: "item-13", code: "PKG-GYC-500", name: "Greek Yogurt Cups & Lids (500ml)", category: "PACKAGING_NON_PERISHABLE", uom: "sets", currentStock: 2100, minStockThreshold: 500, costPerUnit: 160, storageLocation: "Packaging Bay A", isActive: true },
  { id: "item-14", code: "PKG-BOT-350", name: "Vanilla Yogurt Bottles & Caps (350ml)", category: "PACKAGING_NON_PERISHABLE", uom: "sets", currentStock: 1650, minStockThreshold: 400, costPerUnit: 140, storageLocation: "Packaging Bay B", isActive: true },
  { id: "item-15", code: "PKG-FOL-01", name: "Aluminium Foil Rolls (Wide)", category: "PACKAGING_NON_PERISHABLE", uom: "rolls", currentStock: 24, minStockThreshold: 5, costPerUnit: 4500, storageLocation: "Packaging Bay B", isActive: true },
  { id: "item-16", code: "PKG-SEAL-01", name: "Tamper-Proof Shrink Seals", category: "PACKAGING_NON_PERISHABLE", uom: "units", currentStock: 9500, minStockThreshold: 2000, costPerUnit: 25, storageLocation: "Packaging Bay C", isActive: true },
  { id: "item-17", code: "PKG-LBL-PRF", name: "Moh Parfait NAFDAC Labels", category: "PACKAGING_NON_PERISHABLE", uom: "units", currentStock: 8200, minStockThreshold: 1500, costPerUnit: 35, storageLocation: "Packaging Bay C", isActive: true },
];

const PRODUCT_RECIPES: ProductRecipe[] = [
  {
    id: "rec-01",
    code: "REC-PARFAIT-400ML",
    name: "Moh Yogurt Parfait (400ml Cup)",
    yieldQuantity: 1,
    yieldUnit: "cup",
    ingredients: [
      { itemCode: "RAW-MLK-01", itemName: "Fresh Whole Cow Milk", quantityRequired: 0.150, uom: "kg" },
      { itemCode: "RAW-GRN-01", itemName: "Honey Crunchy Granola", quantityRequired: 0.040, uom: "kg" },
      { itemCode: "RAW-APL-01", itemName: "Fresh Crisp Green Apples", quantityRequired: 0.250, uom: "pcs" }, // 1 apple = 4 parfaits
      { itemCode: "RAW-GRP-01", itemName: "Seedless Purple Grapes", quantityRequired: 1.000, uom: "pcs" },
      { itemCode: "RAW-RSN-01", itemName: "Seedless Golden Raisins", quantityRequired: 0.050, uom: "cups" },
      { itemCode: "RAW-CSH-01", itemName: "Roasted Cashew Nuts", quantityRequired: 0.050, uom: "packs" },
      { itemCode: "PKG-CUP-400", itemName: "Parfait Cups & Dome Lids (400ml)", quantityRequired: 1.000, uom: "sets" },
      { itemCode: "PKG-SEAL-01", itemName: "Tamper-Proof Shrink Seals", quantityRequired: 1.000, uom: "units" },
      { itemCode: "PKG-LBL-PRF", itemName: "Moh Parfait NAFDAC Labels", quantityRequired: 1.000, uom: "units" },
    ],
  },
  {
    id: "rec-02",
    code: "REC-GREEK-500ML",
    name: "Moh Greek Yogurt (500ml Tub)",
    yieldQuantity: 1,
    yieldUnit: "tub",
    ingredients: [
      { itemCode: "RAW-MLK-01", itemName: "Fresh Whole Cow Milk", quantityRequired: 0.500, uom: "kg" },
      { itemCode: "RAW-SGR-01", itemName: "Granulated White Sugar", quantityRequired: 0.030, uom: "kg" },
      { itemCode: "PKG-GYC-500", itemName: "Greek Yogurt Cups & Lids (500ml)", quantityRequired: 1.000, uom: "sets" },
      { itemCode: "PKG-SEAL-01", itemName: "Tamper-Proof Shrink Seals", quantityRequired: 1.000, uom: "units" },
    ],
  },
  {
    id: "rec-03",
    code: "REC-VANILLA-350ML",
    name: "Moh Vanilla Yogurt Drink (350ml Bottle)",
    yieldQuantity: 1,
    yieldUnit: "bottle",
    ingredients: [
      { itemCode: "RAW-MLK-01", itemName: "Fresh Whole Cow Milk", quantityRequired: 0.350, uom: "kg" },
      { itemCode: "RAW-SGR-01", itemName: "Granulated White Sugar", quantityRequired: 0.025, uom: "kg" },
      { itemCode: "RAW-VAN-01", itemName: "Pure Vanilla Extract", quantityRequired: 0.005, uom: "L" },
      { itemCode: "PKG-BOT-350", itemName: "Vanilla Yogurt Bottles & Caps (350ml)", quantityRequired: 1.000, uom: "sets" },
    ],
  },
];

const ITEM_LOTS: ItemLot[] = [];

const TRANSACTIONS: StockTransaction[] = [];

// ==========================================
// STORE ENGINE API METHODS
// ==========================================

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
        imageUrl: normalizeImageUrl(i.imageUrl),
        packagingType: i.packagingType || "DIRECT",
        packUnit: i.packUnit || undefined,
        unitsPerPack: i.unitsPerPack ? Number(i.unitsPerPack) : undefined,
        cartonUnit: i.cartonUnit || undefined,
        packsPerCarton: i.packsPerCarton ? Number(i.packsPerCarton) : undefined,
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
    }
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

export async function getProductRecipes() {
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
          imageUrl: normalizeImageUrl(row.imageUrl),
          packagingType: row.packagingType || "DIRECT",
          packUnit: row.packUnit || undefined,
          unitsPerPack: row.unitsPerPack ? Number(row.unitsPerPack) : undefined,
          cartonUnit: row.cartonUnit || undefined,
          packsPerCarton: row.packsPerCarton ? Number(row.packsPerCarton) : undefined,
          isActive: row.isActive,
        };
        INVENTORY_ITEMS.unshift(itemObj);
        return itemObj;
      }
    } catch (err: any) {
      if (err.message && err.message.includes("already exists")) throw err;
      console.error("DB error in createInventoryItem:", err);
    }
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
      if (data.imageUrl !== undefined) updatePayload.imageUrl = normalizeImageUrl(data.imageUrl) || null;
      if (data.packagingType !== undefined) updatePayload.packagingType = data.packagingType;
      if (data.packUnit !== undefined) updatePayload.packUnit = data.packUnit ? data.packUnit.trim() : null;
      if (data.unitsPerPack !== undefined) updatePayload.unitsPerPack = data.unitsPerPack ? Number(data.unitsPerPack).toFixed(3) : null;
      if (data.cartonUnit !== undefined) updatePayload.cartonUnit = data.cartonUnit ? data.cartonUnit.trim() : null;
      if (data.packsPerCarton !== undefined) updatePayload.packsPerCarton = data.packsPerCarton ? Number(data.packsPerCarton).toFixed(3) : null;
      if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

      await db.update(schema.items).set(updatePayload).where(eq(schema.items.id, id));
    } catch (err) {
      console.error("DB error in updateInventoryItem:", err);
    }
  }

  const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id);
  if (idx !== -1) {
    const item = INVENTORY_ITEMS[idx];
    INVENTORY_ITEMS[idx] = {
      ...item,
      ...data,
      imageUrl: data.imageUrl !== undefined ? normalizeImageUrl(data.imageUrl) : item.imageUrl,
      code: data.code ? data.code.trim().toUpperCase() : item.code,
    };
    return INVENTORY_ITEMS[idx];
  }
  return { id, ...data } as any;
}

export async function deleteInventoryItem(id: string) {
  if (db) {
    try {
      await db.update(schema.items).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.items.id, id));
    } catch (err) {
      console.error("DB error in deleteInventoryItem:", err);
    }
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
  }[];
}) {
  const codeTrimmed = data.code.trim().toUpperCase();
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
  const idx = PRODUCT_RECIPES.findIndex((r) => r.id === id || r.code === id);
  if (idx === -1) throw new Error(`Recipe not found: ${id}`);

  PRODUCT_RECIPES[idx] = {
    ...PRODUCT_RECIPES[idx],
    ...data,
    code: data.code ? data.code.trim().toUpperCase() : PRODUCT_RECIPES[idx].code,
  };
  return PRODUCT_RECIPES[idx];
}

export async function deleteProductRecipe(id: string) {
  const idx = PRODUCT_RECIPES.findIndex((r) => r.id === id || r.code === id);
  if (idx === -1) throw new Error(`Recipe not found: ${id}`);
  const removed = PRODUCT_RECIPES.splice(idx, 1)[0];
  return removed;
}

export async function calculateRecipeRequirements(recipeCode: string, batchQuantity: number) {
  const recipe = PRODUCT_RECIPES.find((r) => r.code === recipeCode);
  if (!recipe) throw new Error(`Recipe not found for code: ${recipeCode}`);

  const factor = batchQuantity / recipe.yieldQuantity;

  const requiredIngredients = recipe.ingredients.map((ing) => {
    const totalRequired = Number((ing.quantityRequired * factor).toFixed(3));
    const currentItem = INVENTORY_ITEMS.find((i) => i.code === ing.itemCode);
    const availableStock = currentItem?.currentStock || 0;
    const isSufficient = availableStock >= totalRequired;

    return {
      itemCode: ing.itemCode,
      itemName: ing.itemName,
      unitRequired: totalRequired,
      uom: ing.uom,
      availableStock,
      isSufficient,
      shortfall: isSufficient ? 0 : Number((totalRequired - availableStock).toFixed(3)),
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
    }
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
  const recipe = PRODUCT_RECIPES.find((r) => r.code === data.recipeCode);
  if (!recipe) throw new Error(`Recipe not found for code: ${data.recipeCode}`);

  const batchRef = `BATCH-${data.recipeCode.replace("REC-", "").replace("PROD-", "")}-${Date.now().toString().slice(-4)}`;
  const recordedTxns: StockTransaction[] = [];

  if (data.customIngredients && Array.isArray(data.customIngredients)) {
    // Custom ingredient list provided (user may have modified quantities or excluded/removed items)
    const activeCustom = data.customIngredients.filter((ci) => Number(ci.quantity) > 0);

    if (activeCustom.length === 0) {
      throw new Error("Cannot dispense batch: at least 1 ingredient must have a quantity greater than 0.");
    }

    // Validate sufficient stock for all included items
    const shortfalls: string[] = [];
    for (const ci of activeCustom) {
      const item = INVENTORY_ITEMS.find((i) => i.code === ci.itemCode);
      if (!item) {
        shortfalls.push(`Unknown item SKU: ${ci.itemCode}`);
        continue;
      }
      const qtyRequired = Number(ci.quantity);
      if (item.currentStock < qtyRequired) {
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

    for (const ci of activeCustom) {
      const item = INVENTORY_ITEMS.find((i) => i.code === ci.itemCode)!;
      const qtyDeducted = Number(ci.quantity);

      item.currentStock = Number((item.currentStock - qtyDeducted).toFixed(3));

      const standardRecipeIng = recipe.ingredients.find((ri) => ri.itemCode === ci.itemCode);
      const isCustomAmount = standardRecipeIng
        ? Number((standardRecipeIng.quantityRequired * (data.batchQuantity / recipe.yieldQuantity)).toFixed(3)) !== qtyDeducted
        : true;

      const txn: StockTransaction = {
        id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        itemId: item.id,
        itemName: item.name,
        transactionType: "DISPENSE_PRODUCTION",
        quantity: -qtyDeducted,
        unit: item.uom,
        shiftType: data.shiftType,
        performedByName: data.performedByName,
        recipient: data.recipient,
        referenceId: batchRef,
        notes:
          ci.notes ||
          data.notes ||
          `Dispensed for ${data.batchQuantity}x ${recipe.name}${isCustomAmount ? " (Custom quantity)" : ""}.`,
        createdAt: new Date().toISOString(),
      };

      if (db) {
        try {
          const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
          if (found.length > 0) {
            await db.update(schema.items).set({
              currentStock: item.currentStock.toFixed(3),
              updatedAt: new Date(),
            }).where(eq(schema.items.id, found[0].id));

            await db.insert(schema.stockTransactions).values({
              itemId: found[0].id,
              transactionType: "DISPENSE_PRODUCTION",
              quantity: (-qtyDeducted).toFixed(3),
              unit: item.uom,
              shiftType: data.shiftType,
              performedByName: data.performedByName,
              recipient: data.recipient,
              referenceId: batchRef,
              notes: ci.notes || data.notes || `Dispensed for ${data.batchQuantity}x ${recipe.name}${isCustomAmount ? " (Custom quantity)" : ""}.`,
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
        unitRequired: qtyDeducted,
        uom: item.uom,
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

  for (const ing of calculation.requiredIngredients) {
    const item = INVENTORY_ITEMS.find((i) => i.code === ing.itemCode);
    if (!item) continue;

    // Deduct stock
    item.currentStock = Number((item.currentStock - ing.unitRequired).toFixed(3));

    const txn: StockTransaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      itemId: item.id,
      itemName: item.name,
      transactionType: "DISPENSE_PRODUCTION",
      quantity: -ing.unitRequired,
      unit: item.uom,
      shiftType: data.shiftType,
      performedByName: data.performedByName,
      recipient: data.recipient,
      referenceId: batchRef,
      notes: data.notes || `Dispensed for ${data.batchQuantity}x ${calculation.recipe.name}.`,
      createdAt: new Date().toISOString(),
    };

    if (db) {
      try {
        const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
        if (found.length > 0) {
          await db.update(schema.items).set({
            currentStock: item.currentStock.toFixed(3),
            updatedAt: new Date(),
          }).where(eq(schema.items.id, found[0].id));

          await db.insert(schema.stockTransactions).values({
            itemId: found[0].id,
            transactionType: "DISPENSE_PRODUCTION",
            quantity: (-ing.unitRequired).toFixed(3),
            unit: item.uom,
            shiftType: data.shiftType,
            performedByName: data.performedByName,
            recipient: data.recipient,
            referenceId: batchRef,
            notes: data.notes || `Dispensed for ${data.batchQuantity}x ${calculation.recipe.name}.`,
          });
        }
      } catch (err) {
        console.error("DB error in standard dispense:", err);
      }
    }

    TRANSACTIONS.unshift(txn);
    recordedTxns.push(txn);
  }

  eventBus.publish(
    "INVENTORY_BATCH_DISPENSED",
    {
      recipeCode: calculation.recipe.code,
      recipeName: calculation.recipe.name,
      batchQuantity: data.batchQuantity,
      recipient: data.recipient,
      referenceId: batchRef,
      materialsCount: recordedTxns.length,
    },
    data.performedByName,
    "INVENTORY_STORE"
  );

  return {
    success: true,
    batchReference: batchRef,
    recipeName: calculation.recipe.name,
    batchQuantity: data.batchQuantity,
    dispensedIngredients: calculation.requiredIngredients,
    transactions: recordedTxns,
  };
}

export async function dispenseIndividualItem(data: {
  itemCode: string;
  quantity: number;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  purpose?: string;
  notes?: string;
}) {
  const item = INVENTORY_ITEMS.find((i) => i.code === data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  if (item.currentStock < data.quantity) {
    throw new Error(
      `Insufficient available store stock to dispense ${data.quantity} ${item.uom} of ${item.name} (Current balance: ${item.currentStock} ${item.uom}).`
    );
  }

  // Deduct stock
  item.currentStock = Number((item.currentStock - data.quantity).toFixed(3));

  const refCode = `IND-${Date.now().toString(36).toUpperCase()}`;
  const txn: StockTransaction = {
    id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "DISPENSE_INDIVIDUAL",
    quantity: -data.quantity,
    unit: item.uom,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: refCode,
    notes: data.notes || data.purpose || `Individual material dispense to ${data.recipient}`,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
      if (found.length > 0) {
        await db.update(schema.items).set({
          currentStock: item.currentStock.toFixed(3),
          updatedAt: new Date(),
        }).where(eq(schema.items.id, found[0].id));

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: "DISPENSE_PRODUCTION",
          quantity: (-data.quantity).toFixed(3),
          unit: item.uom,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          recipient: data.recipient,
          referenceId: refCode,
          notes: data.notes || data.purpose || `Individual material dispense to ${data.recipient}`,
        });
      }
    } catch (err) {
      console.error("DB error in dispenseIndividualItem:", err);
    }
  }

  TRANSACTIONS.unshift(txn);

  eventBus.publish(
    "INVENTORY_INDIVIDUAL_DISPENSED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: item.uom,
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
    referenceId: refCode,
    transaction: txn,
  };
}

export async function processFaultReturnAndReplace(data: {
  itemCode: string;
  quantity: number;
  faultReason: string;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  referenceBatch?: string;
  issueReplacement?: boolean;
}) {
  const item = INVENTORY_ITEMS.find((i) => i.code === data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  const shouldReplace = data.issueReplacement !== false;

  if (shouldReplace && item.currentStock < data.quantity) {
    throw new Error(
      `Insufficient available store stock to issue replacement for ${data.quantity} ${item.uom} of ${item.name}. (Available: ${item.currentStock} ${item.uom})`
    );
  }

  if (shouldReplace) {
    // Deduct the replacement items from available store stock
    item.currentStock = Number((item.currentStock - data.quantity).toFixed(3));
  }

  const txn: StockTransaction = {
    id: `txn-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: shouldReplace ? "RETURN_FAULT_REPLACE" : "RETURN_FAULT_SCRAP",
    quantity: shouldReplace ? -data.quantity : 0,
    unit: item.uom,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: data.referenceBatch || (shouldReplace ? "FAULT-REPLACE" : "FAULT-SCRAP-ONLY"),
    notes: shouldReplace
      ? `Fault replacement issued to ${data.recipient}. Reason: ${data.faultReason}. Replacement deducted from store stock; defective units scrapped.`
      : `Fault defect logged. Reason: ${data.faultReason}. No replacement issued (store balance untouched); defective units scrapped.`,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
      if (found.length > 0) {
        if (shouldReplace) {
          await db.update(schema.items).set({
            currentStock: item.currentStock.toFixed(3),
            updatedAt: new Date(),
          }).where(eq(schema.items.id, found[0].id));
        }

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: shouldReplace ? "RETURN_FAULT_REPLACE" : "DISPOSAL_EXPIRED_SPOILT",
          quantity: (shouldReplace ? -data.quantity : 0).toFixed(3),
          unit: item.uom,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          recipient: data.recipient,
          referenceId: data.referenceBatch || (shouldReplace ? "FAULT-REPLACE" : "FAULT-SCRAP-ONLY"),
          notes: txn.notes,
        });
      }
    } catch (err) {
      console.error("DB error in processFaultReturnAndReplace:", err);
    }
  }

  TRANSACTIONS.unshift(txn);

  eventBus.publish(
    "INVENTORY_FAULT_SCRAPPED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: item.uom,
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
    transaction: txn,
  };
}

export async function processExcessRestock(data: {
  itemCode: string;
  quantity: number;
  conditionNotes: string;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  referenceBatch?: string;
}) {
  const item = INVENTORY_ITEMS.find((i) => i.code === data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  // Increment stock back into available store inventory
  item.currentStock = Number((item.currentStock + data.quantity).toFixed(3));

  const txn: StockTransaction = {
    id: `txn-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "RETURN_EXCESS_RESTOCK",
    quantity: data.quantity,
    unit: item.uom,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: data.referenceBatch || "EXCESS-RESTOCK",
    notes: `Unused ingredient returned from shift run. Condition: ${data.conditionNotes}. Verified & Restocked.`,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
      if (found.length > 0) {
        await db.update(schema.items).set({
          currentStock: item.currentStock.toFixed(3),
          updatedAt: new Date(),
        }).where(eq(schema.items.id, found[0].id));

        await db.insert(schema.stockTransactions).values({
          itemId: found[0].id,
          transactionType: "RETURN_EXCESS_RESTOCK",
          quantity: data.quantity.toFixed(3),
          unit: item.uom,
          shiftType: data.shiftType,
          performedByName: data.performedByName,
          recipient: data.recipient,
          referenceId: data.referenceBatch || "EXCESS-RESTOCK",
          notes: txn.notes,
        });
      }
    } catch (err) {
      console.error("DB error in processExcessRestock:", err);
    }
  }

  TRANSACTIONS.unshift(txn);

  eventBus.publish(
    "INVENTORY_EXCESS_RESTOCKED",
    {
      itemCode: item.code,
      itemName: item.name,
      quantity: data.quantity,
      uom: item.uom,
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
    transaction: txn,
  };
}

export async function reconcileShiftStock(data: {
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  counts: { itemCode: string; physicalCount: number; discrepancyNote?: string }[];
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

  for (const entry of data.counts) {
    const item = INVENTORY_ITEMS.find((i) => i.code === entry.itemCode);
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
        createdAt: new Date().toISOString(),
      };

      if (db) {
        try {
          const found = await db.select().from(schema.items).where(eq(schema.items.code, item.code)).limit(1);
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
            });
          }
        } catch (err) {
          console.error("DB error in shift reconciliation:", err);
        }
      }

      TRANSACTIONS.unshift(txn);
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
  };
}

export async function getStockTransactions(params?: {
  limit?: number;
  type?: string;
  category?: string;
  search?: string;
}) {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.stockTransactions)
        .orderBy(desc(schema.stockTransactions.createdAt));

      const allItems = await db.select().from(schema.items);
      const itemMap = new Map(allItems.map((i) => [i.id, i.name]));

      let list: StockTransaction[] = rows.map((t) => ({
        id: t.id,
        itemId: t.itemId,
        itemName: itemMap.get(t.itemId) || t.performedByName || "Material",
        transactionType: t.transactionType as any,
        quantity: Number(t.quantity),
        unit: t.unit,
        shiftType: t.shiftType as any,
        performedByName: t.performedByName || "Store Staff",
        recipient: t.recipient || undefined,
        referenceId: t.referenceId || undefined,
        notes: t.notes || undefined,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
      }));

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

      const limit = params?.limit || 100;
      return list.slice(0, limit);
    } catch (err) {
      console.error("DB error in getStockTransactions:", err);
    }
  }

  let list = [...TRANSACTIONS];

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

  const limit = params?.limit || 100;
  return list.slice(0, limit);
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
