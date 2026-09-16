export type PackagingType = "DIRECT" | "PACK_ONLY" | "CARTON_AND_PACK";

export interface PackagingConfig {
  packagingType?: PackagingType | string | null;
  uom: string; // Base / stock unit: e.g. "bottle", "carton", "kg", "pack"
  packUnit?: string | null; // e.g. "bottle", "pack", "bag", "tub"
  unitsPerPack?: number | string | null; // Base units in 1 pack
  cartonUnit?: string | null; // e.g. "carton", "box", "crate"
  packsPerCarton?: number | string | null; // Packs in 1 master carton
  isVariablePack?: boolean | null; // true for items with variable yield / multi-use containers
  inUseQuantity?: number | string | null; // Containers currently opened / in-use on floor
  inUseUnit?: string | null;
  recipeUom?: string | null; // Culinary/Recipe portion unit: e.g. "pcs", "cups", "g", "ml"
  portionsPerContainer?: number | string | null; // Estimated benchmark portions/yield per container
  inUseRemainingPortions?: number | string | null; // Portions remaining in active floor container
}

export interface FormattedPackaging {
  type: PackagingType;
  primary: string;
  secondary?: string;
  detailed: string;
  cartons?: number;
  packs?: number;
  baseUnits: number;
  wholeCartons?: number;
  remainderPacks?: number;
  remainderUnits?: number;
  isVariablePack?: boolean;
  inUseQuantity?: number;
  inUseRemainingPortions?: number;
  inUsePercent?: number;
}

export interface UnitOption {
  type: "CARTON" | "PACK" | "BASE";
  label: string;
  multiplier: number; // in base units
}

/**
 * Returns clean numeric multipliers for packaging calculations.
 */
export function getPackagingMultipliers(item: PackagingConfig) {
  const unitsPerPack = Math.max(1, Number(item.unitsPerPack) || 1);
  const packsPerCarton = Math.max(1, Number(item.packsPerCarton) || 1);
  const unitsPerCarton = unitsPerPack * packsPerCarton;

  return {
    unitsPerPack,
    packsPerCarton,
    unitsPerCarton,
  };
}

/**
 * Returns available units of measure for intake and dispensing based on item packaging type.
 */
export function getAvailableUnits(item: PackagingConfig): UnitOption[] {
  const mode = item.packagingType || "DIRECT";
  const { unitsPerPack, unitsPerCarton } = getPackagingMultipliers(item);

  const baseOption: UnitOption = {
    type: "BASE",
    label: item.uom || "units",
    multiplier: 1,
  };

  if (mode === "CARTON_AND_PACK") {
    return [
      {
        type: "CARTON",
        label: item.cartonUnit ? `${item.cartonUnit}s` : "Cartons",
        multiplier: unitsPerCarton,
      },
      {
        type: "PACK",
        label: item.packUnit ? `${item.packUnit}s` : "Packs",
        multiplier: unitsPerPack,
      },
      baseOption,
    ];
  }

  if (mode === "PACK_ONLY") {
    return [
      {
        type: "PACK",
        label: item.packUnit ? `${item.packUnit}s` : "Packs",
        multiplier: unitsPerPack,
      },
      baseOption,
    ];
  }

  return [baseOption];
}

/**
 * Converts quantity from any unit (Carton, Pack, Base) into base units.
 */
export function toBaseUnits(
  amount: number,
  unitType: "CARTON" | "PACK" | "BASE",
  item: PackagingConfig
): number {
  if (amount <= 0 || isNaN(amount)) return 0;
  const { unitsPerPack, unitsPerCarton } = getPackagingMultipliers(item);

  if (unitType === "CARTON") return amount * unitsPerCarton;
  if (unitType === "PACK") return amount * unitsPerPack;
  return amount;
}

/**
 * Converts quantity from base units into a target unit (Carton, Pack, Base).
 */
export function fromBaseUnits(
  baseUnits: number,
  unitType: "CARTON" | "PACK" | "BASE",
  item: PackagingConfig
): number {
  if (baseUnits <= 0 || isNaN(baseUnits)) return 0;
  const { unitsPerPack, unitsPerCarton } = getPackagingMultipliers(item);

  if (unitType === "CARTON") return baseUnits / unitsPerCarton;
  if (unitType === "PACK") return baseUnits / unitsPerPack;
  return baseUnits;
}

/**
 * Formats stock balance or transaction amounts into human-friendly warehouse package strings.
 * Examples:
 * - Parfait cups (6500 pcs, 50 pk/ctn, 20 pc/pk): "6.5 cartons", sub: "6,500 cups (325 packs)"
 * - Grapes (1200 pcs, 80 pc/pk): "15 packs", sub: "1,200 pcs"
 * - Apples (1420 pcs, DIRECT): "1,420 pcs"
 */
export function formatPackagingDisplay(
  quantity: number,
  item: PackagingConfig
): FormattedPackaging {
  const numQty = Number(quantity) || 0;
  const isVariable = Boolean(item.isVariablePack);

  if (isVariable) {
    const unitLabel = item.packUnit || item.cartonUnit || item.uom || "pack";
    const inUse = item.inUseQuantity !== undefined && item.inUseQuantity !== null
      ? Number(item.inUseQuantity)
      : 0;
    const remainingPortions = item.inUseRemainingPortions !== undefined && item.inUseRemainingPortions !== null
      ? Number(item.inUseRemainingPortions)
      : 0;
    const benchmark = getBenchmarkPortionsPerContainer(item);
    const inUsePercent = benchmark > 0 && remainingPortions > 0
      ? Math.min(100, Math.round((remainingPortions / benchmark) * 100))
      : (inUse > 0 ? 100 : 0);

    const formattedQty = numQty % 1 === 0 ? numQty.toString() : numQty.toFixed(1);
    const primary = `${formattedQty} ${unitLabel}${numQty === 1 ? "" : "s"}`;
    
    let secondary = "No active container on floor";
    if (inUse > 0) {
      if (remainingPortions > 0 && item.recipeUom) {
        secondary = `${inUse} in use (${inUsePercent}% • ~${remainingPortions.toFixed(remainingPortions % 1 === 0 ? 0 : 1)} ${item.recipeUom})`;
      } else {
        secondary = `${inUse} container in use on floor`;
      }
    }
    const detailed = `${primary} • ${secondary}`;

    return {
      type: "PACK_ONLY",
      primary,
      secondary,
      detailed,
      packs: numQty,
      baseUnits: numQty,
      isVariablePack: true,
      inUseQuantity: inUse,
      inUseRemainingPortions: remainingPortions,
      inUsePercent,
    };
  }

  const mode = item.packagingType || "DIRECT";
  const { unitsPerPack, packsPerCarton, unitsPerCarton } = getPackagingMultipliers(item);

  if (mode === "CARTON_AND_PACK" && unitsPerCarton > 1) {
    const cartons = numQty / unitsPerCarton;
    const totalPacks = Math.round(numQty / unitsPerPack);
    const wholeCartons = Math.floor(cartons);
    const remUnits = numQty % unitsPerCarton;
    const remPacks = Math.round(remUnits / unitsPerPack);

    const cartonLabel = item.cartonUnit || "carton";
    const packLabel = item.packUnit || "pack";

    const formattedCartonNum = cartons % 1 === 0 ? cartons.toString() : cartons.toFixed(1);
    const primary = `${formattedCartonNum} ${cartonLabel}${cartons === 1 ? "" : "s"}`;

    let detailed = primary;
    if (remPacks > 0 && wholeCartons > 0) {
      detailed = `${wholeCartons} ${cartonLabel}${wholeCartons === 1 ? "" : "s"}, ${remPacks} ${packLabel}${remPacks === 1 ? "" : "s"} (${numQty.toLocaleString()} ${item.uom})`;
    } else {
      detailed = `${primary} (${numQty.toLocaleString()} ${item.uom})`;
    }

    const secondary = `${totalPacks.toLocaleString()} ${packLabel}${totalPacks === 1 ? "" : "s"} • ${numQty.toLocaleString()} ${item.uom}`;

    return {
      type: "CARTON_AND_PACK",
      primary,
      secondary,
      detailed,
      cartons,
      packs: totalPacks,
      baseUnits: numQty,
      wholeCartons,
      remainderPacks: remPacks,
      remainderUnits: remUnits,
    };
  }

  if (mode === "PACK_ONLY" && unitsPerPack > 1) {
    const packs = numQty / unitsPerPack;
    const packLabel = item.packUnit || "pack";
    const formattedPackNum = packs % 1 === 0 ? packs.toString() : packs.toFixed(1);
    const primary = `${formattedPackNum} ${packLabel}${packs === 1 ? "" : "s"}`;
    const isVariable = Boolean(item.isVariablePack);
    const secondary = isVariable
      ? `approx. ~${numQty.toLocaleString()} ${item.uom}`
      : `${numQty.toLocaleString()} ${item.uom}`;
    const detailed = `${primary} (${secondary})`;

    return {
      type: "PACK_ONLY",
      primary,
      secondary,
      detailed,
      packs,
      baseUnits: numQty,
      isVariablePack: isVariable,
    };
  }

  // DIRECT
  const isFractional = item.uom === "kg" || item.uom === "L";
  const primary = `${numQty.toLocaleString(undefined, {
    minimumFractionDigits: isFractional ? 1 : 0,
    maximumFractionDigits: 2,
  })} ${item.uom}`;

  return {
    type: "DIRECT",
    primary,
    detailed: primary,
    baseUnits: numQty,
    isVariablePack: Boolean(item.isVariablePack),
  };
}

export interface PackageCostInfo {
  packagePrice: number;
  packageUnitLabel: string;
  baseCost: number;
  baseUnitLabel: string;
  isPackaged: boolean;
}

/**
 * Calculates the purchase package cost from a base unit cost.
 * e.g. 50kg bag of milk with base cost ₦1,000/kg -> ₦50,000 / bag
 */
export function calculatePackageCost(
  baseCost: number,
  item: PackagingConfig
): PackageCostInfo {
  const mode = item.packagingType || "DIRECT";
  const numBaseCost = Number(baseCost) || 0;
  const { unitsPerPack, unitsPerCarton } = getPackagingMultipliers(item);

  if (mode === "CARTON_AND_PACK" && unitsPerCarton > 1) {
    return {
      packagePrice: numBaseCost * unitsPerCarton,
      packageUnitLabel: item.cartonUnit || "carton",
      baseCost: numBaseCost,
      baseUnitLabel: item.uom,
      isPackaged: true,
    };
  }

  if (mode === "PACK_ONLY" && unitsPerPack > 1) {
    return {
      packagePrice: numBaseCost * unitsPerPack,
      packageUnitLabel: item.packUnit || "pack",
      baseCost: numBaseCost,
      baseUnitLabel: item.uom,
      isPackaged: true,
    };
  }

  return {
    packagePrice: numBaseCost,
    packageUnitLabel: item.uom,
    baseCost: numBaseCost,
    baseUnitLabel: item.uom,
    isPackaged: false,
  };
}

/**
 * Converts a user-entered cost in a chosen unit (CARTON, PACK, or BASE) into base unit cost for DB storage.
 */
export function calculateBaseCostFromPackage(
  cost: number,
  unitType: "CARTON" | "PACK" | "BASE",
  item: PackagingConfig
): number {
  const numCost = Number(cost) || 0;
  if (numCost <= 0) return 0;
  const { unitsPerPack, unitsPerCarton } = getPackagingMultipliers(item);

  if (unitType === "CARTON") {
    return numCost / unitsPerCarton;
  }
  if (unitType === "PACK") {
    return numCost / unitsPerPack;
  }
  return numCost;
}

/**
 * Returns estimated benchmark portions/yield per container.
 * Uses item.portionsPerContainer if configured, or industry benchmarks for Moh Foods items.
 */
export function getBenchmarkPortionsPerContainer(item: PackagingConfig & { code?: string }): number {
  if (item.portionsPerContainer && Number(item.portionsPerContainer) > 0) {
    return Number(item.portionsPerContainer);
  }

  const code = (item.code || "").toUpperCase();
  const uom = (item.uom || "").toLowerCase();
  const packUnit = (item.packUnit || "").toLowerCase();

  // Known item code heuristics
  if (code.includes("CSH") || code.includes("CASHEW")) return 267; // ~267 pcs per bottle
  if (code.includes("RSN") || code.includes("RAISIN")) return 40;  // ~40 cups per carton
  if (code.includes("GLC") || code.includes("GLUCOSE")) return 50; // ~50 cups per tub (or 25kg)
  if (code.includes("VAN") || code.includes("VANILLA")) return 500; // ~500 ml per bottle
  if (code.includes("GRP") || code.includes("GRAPE")) return 80;   // ~80 pcs per pack
  if (code.includes("CCN") || code.includes("COCONUT")) return 1;  // 1 nut

  if (item.unitsPerPack && Number(item.unitsPerPack) > 1) {
    return Number(item.unitsPerPack);
  }

  return 1;
}

export interface DualUomConversion {
  containerEquivalent: number;
  benchmark: number;
  recipeUom: string;
  containerUom: string;
  displayText: string;
}

/**
 * Converts a recipe portion quantity (e.g. 400 pcs) into warehouse container units (e.g. 1.50 bottles)
 * based on estimated benchmark yield.
 */
export function convertRecipeToContainerQuantity(
  recipeQuantity: number,
  item: PackagingConfig & { code?: string }
): DualUomConversion {
  const benchmark = getBenchmarkPortionsPerContainer(item);
  const recipeUom = item.recipeUom || (item.isVariablePack ? "pcs" : item.uom);
  const containerUom = item.packUnit || item.cartonUnit || item.uom;
  const containerEquivalent = benchmark > 0 ? Number((recipeQuantity / benchmark).toFixed(3)) : recipeQuantity;
  const displayText = `~${containerEquivalent.toFixed(2)} ${containerUom}${containerEquivalent === 1 ? "" : "s"} (Benchmark: ~${benchmark} ${recipeUom}/${containerUom})`;

  return {
    containerEquivalent,
    benchmark,
    recipeUom,
    containerUom,
    displayText,
  };
}

export interface ContainerDrawdownResult {
  sealedBefore: number;
  sealedAfter: number;
  sealedDeducted: number;
  inUseQuantityBefore: number;
  inUseQuantityAfter: number;
  inUseRemainingPortionsBefore: number;
  inUseRemainingPortionsAfter: number;
  inUsePercentAfter: number;
  containerConsumption: number;
  isNewContainerOpened: boolean;
  notes: string;
}

/**
 * Calculates stock depletion across sealed warehouse containers and active in-use floor containers.
 * Handles both:
 * - Direct container consumption (e.g. 1.5 bottles given out by store)
 * - Culinary portion consumption (e.g. 400 pcs or 2.5 cups converted via benchmark)
 */
export function calculateActiveContainerDrawdown({
  item,
  containerConsumption,
  customNotes,
}: {
  item: PackagingConfig & { currentStock: number | string; code?: string; name?: string };
  containerConsumption: number; // e.g. 1.5 bottles
  customNotes?: string;
}): ContainerDrawdownResult {
  const benchmark = getBenchmarkPortionsPerContainer(item);
  const containerUom = item.packUnit || item.cartonUnit || item.uom || "container";
  const recipeUom = item.recipeUom || (item.isVariablePack ? "pcs" : item.uom);

  const sealedBefore = Math.max(0, Number(item.currentStock) || 0);
  const inUseQtyBefore = Math.max(0, Number(item.inUseQuantity) || 0);
  const inUsePortionsBefore = Math.max(0, Number(item.inUseRemainingPortions) || 0);

  // Equivalent containers already open in-use on floor
  const openPortionsInContainers = benchmark > 0 && inUseQtyBefore > 0
    ? (inUsePortionsBefore / benchmark)
    : 0;

  const totalContainersAvailable = sealedBefore + openPortionsInContainers;
  const safeConsumption = Math.max(0, Number(containerConsumption) || 0);

  // Remaining total containers after consumption
  const totalRemainingContainers = Math.max(0, totalContainersAvailable - safeConsumption);

  // Sealed whole containers remaining in store
  const sealedAfter = Math.floor(totalRemainingContainers);
  const sealedDeducted = Math.max(0, sealedBefore - sealedAfter);

  // Remainder on floor
  const fractional = Number((totalRemainingContainers - sealedAfter).toFixed(4));

  let inUseQuantityAfter = 0;
  let inUseRemainingPortionsAfter = 0;
  let inUsePercentAfter = 0;

  if (fractional > 0.0001) {
    inUseQuantityAfter = 1;
    inUseRemainingPortionsAfter = Number((fractional * benchmark).toFixed(2));
    inUsePercentAfter = Math.min(100, Math.round(fractional * 100));
  }

  const isNewContainerOpened = sealedDeducted > 0;

  // Build descriptive operational notes
  let notes = "";
  const portionsConsumed = safeConsumption * benchmark;
  const portionsStr = portionsConsumed % 1 === 0 ? portionsConsumed.toString() : portionsConsumed.toFixed(1);

  if (sealedDeducted > 0) {
    notes = `Dispensed ${safeConsumption} ${containerUom}${safeConsumption === 1 ? "" : "s"} (~${portionsStr} ${recipeUom}). Deducted ${sealedDeducted} sealed container(s) from store. Floor in-use container active (${inUsePercentAfter}% • ~${inUseRemainingPortionsAfter} ${recipeUom} remaining).`;
  } else {
    notes = `Drawn ${safeConsumption} ${containerUom}${safeConsumption === 1 ? "" : "s"} (~${portionsStr} ${recipeUom}) from active floor container. ${inUseQuantityAfter > 0 ? `${inUseRemainingPortionsAfter} ${recipeUom} remaining in container.` : "Container fully emptied."} Sealed stock intact at ${sealedAfter} ${containerUom}${sealedAfter === 1 ? "" : "s"}.`;
  }

  if (customNotes) {
    notes = `${customNotes} • ${notes}`;
  }

  return {
    sealedBefore,
    sealedAfter,
    sealedDeducted,
    inUseQuantityBefore: inUseQtyBefore,
    inUseQuantityAfter,
    inUseRemainingPortionsBefore: inUsePortionsBefore,
    inUseRemainingPortionsAfter,
    inUsePercentAfter,
    containerConsumption: safeConsumption,
    isNewContainerOpened,
    notes,
  };
}

/**
 * Event-Driven Depletion: Allows floor operators to immediately mark an active container empty
 * (e.g. Raisins, Glucose syrup scraped clean or finished ahead of theoretical math).
 * Optionally pops and activates the next sealed container from store stock.
 */
export function markContainerDepletedCalculation({
  item,
  openNextContainer = false,
  reason = "Marked empty on production floor",
}: {
  item: PackagingConfig & { currentStock: number | string; code?: string; name?: string };
  openNextContainer?: boolean;
  reason?: string;
}) {
  const benchmark = getBenchmarkPortionsPerContainer(item);
  const containerUom = item.packUnit || item.cartonUnit || item.uom || "container";
  const recipeUom = item.recipeUom || (item.isVariablePack ? "pcs" : item.uom);

  const sealedBefore = Math.max(0, Number(item.currentStock) || 0);
  const inUsePortionsBefore = Math.max(0, Number(item.inUseRemainingPortions) || 0);

  let sealedAfter = sealedBefore;
  let inUseQuantityAfter = 0;
  let inUseRemainingPortionsAfter = 0;
  let noteText = `Active container of ${item.name || item.code || "item"} (${inUsePortionsBefore} ${recipeUom} remaining) marked depleted/empty on floor. Reason: ${reason}.`;

  if (openNextContainer && sealedBefore > 0) {
    sealedAfter = sealedBefore - 1;
    inUseQuantityAfter = 1;
    inUseRemainingPortionsAfter = benchmark;
    noteText = `${noteText} Opened fresh sealed container from store (${benchmark} ${recipeUom} ready on floor). Sealed stock: ${sealedAfter} ${containerUom}${sealedAfter === 1 ? "" : "s"}.`;
  }

  return {
    sealedBefore,
    sealedAfter,
    sealedDeducted: sealedBefore - sealedAfter,
    inUseQuantityAfter,
    inUseRemainingPortionsAfter,
    noteText,
  };
}
