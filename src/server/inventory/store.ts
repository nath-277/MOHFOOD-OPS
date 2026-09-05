// Moh Foods NG (MOH-OPS) - Inventory Store Management Engine

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
  isActive: boolean;
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
    | "RETURN_FAULT_REPLACE"
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

const ITEM_LOTS: ItemLot[] = [
  {
    id: "lot-01",
    itemId: "item-01",
    itemName: "Fresh Whole Cow Milk",
    lotNumber: "LOT-2026-0901-MLK",
    supplierName: "Dan Dairy Farms Ltd (Ogun State)",
    arrivalDate: "2026-09-01T08:30:00Z",
    expiryDate: "2026-09-15T00:00:00Z",
    initialQuantity: 500.000,
    remainingQuantity: 450.500,
    unitCost: 1400,
    grnNumber: "GRN-2026-0891",
  },
  {
    id: "lot-02",
    itemId: "item-12",
    itemName: "Parfait Cups & Dome Lids (400ml)",
    lotNumber: "LOT-2026-0820-CUP",
    supplierName: "PolyPack Industries Lagos",
    arrivalDate: "2026-08-20T11:00:00Z",
    initialQuantity: 5000,
    remainingQuantity: 4800,
    unitCost: 120,
    grnNumber: "GRN-2026-0844",
  },
];

const TRANSACTIONS: StockTransaction[] = [
  {
    id: "txn-01",
    itemId: "item-01",
    itemName: "Fresh Whole Cow Milk",
    transactionType: "INBOUND_PURCHASE",
    quantity: 500.000,
    unit: "kg",
    shiftType: "MORNING_SHIFT",
    performedByName: "Blessing Okon (Store Officer)",
    referenceId: "GRN-2026-0891",
    notes: "Ad-hoc supplier intake from Dan Dairy Farms Ltd.",
    createdAt: "2026-09-01T08:45:00Z",
  },
  {
    id: "txn-02",
    itemId: "item-01",
    itemName: "Fresh Whole Cow Milk",
    transactionType: "DISPENSE_PRODUCTION",
    quantity: -45.000,
    unit: "kg",
    shiftType: "MORNING_SHIFT",
    performedByName: "Blessing Okon (Store Officer)",
    recipient: "David Adeleke (Production Supervisor)",
    referenceId: "BATCH-PRF-0902-A",
    notes: "Dispensed for 300x Moh Parfait morning run.",
    createdAt: "2026-09-02T06:30:00Z",
  },
  {
    id: "txn-03",
    itemId: "item-12",
    itemName: "Parfait Cups & Dome Lids (400ml)",
    transactionType: "RETURN_FAULT_REPLACE",
    quantity: -5,
    unit: "sets",
    shiftType: "MORNING_SHIFT",
    performedByName: "Blessing Okon (Store Officer)",
    recipient: "David Adeleke (Production Supervisor)",
    referenceId: "BATCH-PRF-0902-A",
    notes: "Replaced 5 cracked dome lids damaged from manufacturer box.",
    createdAt: "2026-09-02T09:15:00Z",
  },
  {
    id: "txn-04",
    itemId: "item-04",
    itemName: "Rolled Oats Flakes",
    transactionType: "RETURN_EXCESS_RESTOCK",
    quantity: 2.500,
    unit: "kg",
    shiftType: "MORNING_SHIFT",
    performedByName: "Blessing Okon (Store Officer)",
    recipient: "David Adeleke (Production Supervisor)",
    referenceId: "BATCH-PRF-0902-A",
    notes: "Excess oats returned unmixed from morning shift, inspected and restocked.",
    createdAt: "2026-09-02T13:45:00Z",
  },
];

// ==========================================
// STORE ENGINE API METHODS
// ==========================================

export async function getInventoryItems(params?: {
  category?: string;
  search?: string;
}) {
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
}) {
  const codeTrimmed = data.code.trim().toUpperCase();
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
    imageUrl: data.imageUrl || undefined,
    isActive: true,
  };

  INVENTORY_ITEMS.unshift(newItem);
  return newItem;
}

export async function updateInventoryItem(id: string, data: Partial<InventoryItem>) {
  const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id);
  if (idx === -1) throw new Error(`Item not found: ${id}`);

  const item = INVENTORY_ITEMS[idx];
  INVENTORY_ITEMS[idx] = {
    ...item,
    ...data,
    code: data.code ? data.code.trim().toUpperCase() : item.code,
  };
  return INVENTORY_ITEMS[idx];
}

export async function deleteInventoryItem(id: string) {
  const idx = INVENTORY_ITEMS.findIndex((i) => i.id === id || i.code === id);
  if (idx === -1) throw new Error(`Item not found: ${id}`);
  const removed = INVENTORY_ITEMS.splice(idx, 1)[0];
  return removed;
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

  return { success: true, item, lot: newLot, transaction: txn };
}

export async function dispenseBatchToProduction(data: {
  recipeCode: string;
  batchQuantity: number;
  performedByName: string;
  recipient: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  notes?: string;
}) {
  const calculation = await calculateRecipeRequirements(data.recipeCode, data.batchQuantity);

  if (!calculation.allAvailable) {
    const missing = calculation.requiredIngredients
      .filter((i) => !i.isSufficient)
      .map((i) => `${i.itemName} (Shortfall: ${i.shortfall} ${i.uom})`)
      .join(", ");
    throw new Error(`Insufficient stock to dispense batch: ${missing}`);
  }

  const batchRef = `BATCH-${data.recipeCode.replace("REC-", "")}-${Date.now().toString().slice(-4)}`;
  const recordedTxns: StockTransaction[] = [];

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

    TRANSACTIONS.unshift(txn);
    recordedTxns.push(txn);
  }

  return {
    success: true,
    batchReference: batchRef,
    recipeName: calculation.recipe.name,
    batchQuantity: data.batchQuantity,
    dispensedIngredients: calculation.requiredIngredients,
    transactions: recordedTxns,
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
}) {
  const item = INVENTORY_ITEMS.find((i) => i.code === data.itemCode);
  if (!item) throw new Error(`Item not found for code: ${data.itemCode}`);

  if (item.currentStock < data.quantity) {
    throw new Error(
      `Insufficient available store stock to issue replacement for ${data.quantity} ${item.uom} of ${item.name}.`
    );
  }

  // Deduct the replacement items from available store stock
  item.currentStock = Number((item.currentStock - data.quantity).toFixed(3));

  const txn: StockTransaction = {
    id: `txn-${Date.now()}`,
    itemId: item.id,
    itemName: item.name,
    transactionType: "RETURN_FAULT_REPLACE",
    quantity: -data.quantity,
    unit: item.uom,
    shiftType: data.shiftType,
    performedByName: data.performedByName,
    recipient: data.recipient,
    referenceId: data.referenceBatch || "FAULT-REPLACE",
    notes: `Fault replacement issued. Reason: ${data.faultReason}. Defective stock written off as scrap.`,
    createdAt: new Date().toISOString(),
  };

  TRANSACTIONS.unshift(txn);

  return {
    success: true,
    item,
    replacementQuantity: data.quantity,
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

  TRANSACTIONS.unshift(txn);

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

export async function getStockTransactions(limit = 25) {
  return TRANSACTIONS.slice(0, limit);
}
