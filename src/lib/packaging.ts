export type PackagingType = "DIRECT" | "PACK_ONLY" | "CARTON_AND_PACK";

export interface PackagingConfig {
  packagingType?: PackagingType | string | null;
  uom: string; // Base unit: e.g. "pcs", "cups", "kg", "g"
  packUnit?: string | null; // e.g. "pack", "bag", "sleeve"
  unitsPerPack?: number | string | null; // Base units in 1 pack (e.g. 20 cups/pack, 80 grapes/pack)
  cartonUnit?: string | null; // e.g. "carton", "box", "crate"
  packsPerCarton?: number | string | null; // Packs in 1 master carton (e.g. 50 packs/carton)
  isVariablePack?: boolean | null; // true for produce with non-exact piece counts per pack (e.g. grapes)
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
  const mode = item.packagingType || "DIRECT";
  const numQty = Number(quantity) || 0;
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
