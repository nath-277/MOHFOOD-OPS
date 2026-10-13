"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ProductRecipe, InventoryItem } from "@/server/inventory/store";
import { formatPackagingDisplay, getAvailableUnits, toBaseUnits, fromBaseUnits, getPackagingMultipliers, UnitOption } from "@/lib/packaging";
import { SearchableProductSelect } from "@/components/ui/SearchableProductSelect";
import { CustomSelect, CustomSelectOption } from "@/components/ui/CustomSelect";
import { VariablePostDispatchModal, VariableItemUsage } from "./VariablePostDispatchModal";
import {
  X,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Scale,
  UserCheck,
  RotateCcw,
  Plus,
  Trash2,
  AlertCircle,
  Package,
  Layers,
  Sun,
  Moon,
  Calendar,
  Tag,
} from "lucide-react";

interface BatchDispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: ProductRecipe[];
  availableItems?: InventoryItem[];
  initialRecipeCode?: string;
  initialItemCode?: string;
  initialMode?: "RECIPE" | "INDIVIDUAL";
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: () => void;
}

interface DispenseRow {
  itemCode: string;
  itemName: string;
  standardRequired: number;
  actualQuantity: number;
  uom: string;
  availableStock: number;
  isIncluded: boolean;
  isExtra: boolean;
  isVariable?: boolean;
  benchmark?: number;
  recipeUom?: string;
  containerUom?: string;
  containerEquivalent?: number;
  inUseQuantity?: number;
  inUseRemainingPortions?: number;
  projectedSealedStock?: number;
  projectedInUsePortions?: number;
  projectedInUsePercent?: number;
  sourceBreakdown?: string;
  isSufficient?: boolean;
}

export const GROUP_LABEL_PRESETS = [
  "Packaging Line Prep",
  "Kitchen Prep Top-Up",
  "Floor Restock",
  "Mixing Station",
  "Emergency Supply",
  "QA Testing Samples",
];

export interface GroupedDirectItem {
  id: string;
  itemCode: string;
  itemName: string;
  imageUrl?: string;
  storageLocation?: string;
  quantity: number;
  unitType: "RECIPE_UOM" | "CARTON" | "PACK" | "BASE";
  unitLabel: string;
  deductBase: number;
  baseUom: string;
  isVariable: boolean;
  currentStock: number;
}

/**
 * Calculates rotation week parity for a given YYYY-MM-DD date string.
 * Base Anchor: 2026-09-21 (Aishah Day / Ada Night)
 * Returns true if odd week (Ada Day / Aishah Night), false if even week (Aishah Day / Ada Night).
 */
export function getShiftParityForDate(dateStr: string): boolean {
  try {
    const parts = (dateStr || "").split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return false;
    }
    const [y, m, d] = parts;
    const target = new Date(y, m - 1, d);
    const day = target.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    target.setDate(target.getDate() + diffToMon);
    const base = new Date(2026, 8, 21); // 2026-09-21 Monday
    const diffDays = Math.round((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
    const diffWeeks = Math.floor(diffDays / 7);
    return Math.abs(diffWeeks) % 2 === 1;
  } catch {
    return false;
  }
}

export const BatchDispenseModal: React.FC<BatchDispenseModalProps> = ({
  isOpen,
  onClose,
  recipes,
  availableItems = [],
  initialRecipeCode,
  initialItemCode,
  initialMode,
  shiftType,
  onSuccess,
}) => {
  const prevOpenRef = useRef(false);
  const [dispenseMode, setDispenseMode] = useState<"RECIPE" | "INDIVIDUAL">(
    initialMode || (initialItemCode ? "INDIVIDUAL" : "RECIPE")
  );
  const [selectedShift, setSelectedShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">(
    shiftType || (new Date().getHours() >= 8 && new Date().getHours() < 18 ? "MORNING_SHIFT" : "NIGHT_SHIFT")
  );
  const [dispatchDate, setDispatchDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [selectedRecipesList, setSelectedRecipesList] = useState<Array<{ recipeCode: string; batchQuantity: number }>>(
    initialRecipeCode
      ? [{ recipeCode: initialRecipeCode, batchQuantity: recipes.find((r) => r.code === initialRecipeCode)?.yieldQuantity || 1 }]
      : []
  );
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [addRecipeCode, setAddRecipeCode] = useState("");
  const [addRecipeQty, setAddRecipeQty] = useState<number>(200);
  const [dispenseRows, setDispenseRows] = useState<DispenseRow[]>([]);
  const [recipient, setRecipient] = useState("");
  const [availableRecipients, setAvailableRecipients] = useState<Array<{ id: string; fullName: string; role: string; label: string }>>([]);
  const [availableSupervisors, setAvailableSupervisors] = useState<
    Array<{
      id: string;
      staffId: string;
      fullName: string;
      cleanName: string;
      role: string;
      label: string;
      isMorningLead: boolean;
      isNightLead: boolean;
      isActiveNow: boolean;
    }>
  >([]);
  const [isCustomRecipient, setIsCustomRecipient] = useState(false);
  const [isCustomIndividualRecipient, setIsCustomIndividualRecipient] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDateSwapped = useMemo(() => {
    return getShiftParityForDate(dispatchDate);
  }, [dispatchDate]);

  const isPastDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return Boolean(dispatchDate && dispatchDate < today);
  }, [dispatchDate]);

  // Fallback production supervisors dynamically calculated from target dispatch date parity
  const fallbackSupervisors = useMemo(() => {
    const morningName = isDateSwapped ? "Aunty Ada" : "Aishah Anuoluwapo";
    const morningId = isDateSwapped ? "759ccc19-caf0-4fb8-a309-b9b29d631e71" : "c620225a-d1ad-47aa-9611-030b0fd656f1";
    const morningStaffId = isDateSwapped ? "MOH-PRD-02" : "MOH-PRD-01";

    const nightName = isDateSwapped ? "Aishah Anuoluwapo" : "Aunty Ada";
    const nightId = isDateSwapped ? "c620225a-d1ad-47aa-9611-030b0fd656f1" : "759ccc19-caf0-4fb8-a309-b9b29d631e71";
    const nightStaffId = isDateSwapped ? "MOH-PRD-01" : "MOH-PRD-02";

    return [
      {
        id: morningId,
        staffId: morningStaffId,
        fullName: morningName,
        cleanName: morningName,
        role: "PRODUCTION_SUPERVISOR",
        label: `${morningName} (${selectedShift === "MORNING_SHIFT" ? "Morning Shift" : "Rotational"} Lead)`,
        isMorningLead: true,
        isNightLead: false,
        isActiveNow: selectedShift === "MORNING_SHIFT",
      },
      {
        id: nightId,
        staffId: nightStaffId,
        fullName: nightName,
        cleanName: nightName,
        role: "PRODUCTION_SUPERVISOR",
        label: `${nightName} (${selectedShift === "NIGHT_SHIFT" ? "Night Shift" : "Rotational"} Lead)`,
        isMorningLead: false,
        isNightLead: true,
        isActiveNow: selectedShift === "NIGHT_SHIFT",
      },
    ];
  }, [isDateSwapped, selectedShift]);

  const effectiveSupervisors = availableSupervisors.length > 0 ? availableSupervisors : fallbackSupervisors;

  // Individual Material Dispense State
  const [individualItemCode, setIndividualItemCode] = useState(
    initialItemCode || availableItems[0]?.code || ""
  );
  const [individualQuantity, setIndividualQuantity] = useState<string>("1");
  const [individualUnitType, setIndividualUnitType] = useState<"RECIPE_UOM" | "CARTON" | "PACK" | "BASE">("BASE");
  const [individualRecipient, setIndividualRecipient] = useState("");
  const [individualPurpose, setIndividualPurpose] = useState("Direct Production Floor Requisition");
  const [individualNotes, setIndividualNotes] = useState("");

  // Grouped Requisition State
  const [groupedDirectItems, setGroupedDirectItems] = useState<GroupedDirectItem[]>([]);
  const [groupLabel, setGroupLabel] = useState("");

  // Extra Material State
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraItemCode, setExtraItemCode] = useState("");
  const [extraQuantity, setExtraQuantity] = useState<string>("1");

  // Post-Dispatch Physical Count State for Variable Items
  const [showPostDispatch, setShowPostDispatch] = useState(false);
  const [postDispatchItems, setPostDispatchItems] = useState<VariableItemUsage[]>([]);
  const [postDispatchBatchRef, setPostDispatchBatchRef] = useState("");
  const [postDispatchRecipeName, setPostDispatchRecipeName] = useState("");

  // Date change handler to auto-remember shift rotation for previous day or week
  const handleDateChange = useCallback((newDateStr: string) => {
    setDispatchDate(newDateStr);
    const swapped = getShiftParityForDate(newDateStr);
    const morningLeadName = swapped ? "Aunty Ada" : "Aishah Anuoluwapo";
    const nightLeadName = swapped ? "Aishah Anuoluwapo" : "Aunty Ada";
    const targetLeadName = selectedShift === "MORNING_SHIFT" ? morningLeadName : nightLeadName;

    if (!isCustomRecipient) {
      setRecipient(`${targetLeadName} (Production Supervisor)`);
    }
    if (!isCustomIndividualRecipient) {
      setIndividualRecipient(`${targetLeadName} (Production Supervisor)`);
    }
  }, [selectedShift, isCustomRecipient, isCustomIndividualRecipient]);

  // Handle shift toggle and sync default supervisor if not manually customized
  const handleShiftChange = useCallback((newShift: "MORNING_SHIFT" | "NIGHT_SHIFT") => {
    setSelectedShift(newShift);
    if (!isCustomRecipient) {
      const matchSup = effectiveSupervisors.find((s) =>
        newShift === "MORNING_SHIFT" ? s.isMorningLead : s.isNightLead
      ) || effectiveSupervisors[0];
      if (matchSup) {
        setRecipient(`${matchSup.cleanName} (Production Supervisor)`);
      }
    }
    if (!isCustomIndividualRecipient) {
      const matchSup = effectiveSupervisors.find((s) =>
        newShift === "MORNING_SHIFT" ? s.isMorningLead : s.isNightLead
      ) || effectiveSupervisors[0];
      if (matchSup) {
        setIndividualRecipient(`${matchSup.cleanName} (Production Supervisor)`);
      }
    }
  }, [effectiveSupervisors, isCustomRecipient, isCustomIndividualRecipient]);

  // Fetch recipients from DB and keep selected recipe code synced with initial prop when opened
  useEffect(() => {
    const justOpened = isOpen && !prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (isOpen) {
      if (justOpened) {
        setGroupedDirectItems([]);
        setGroupLabel("");
        if (initialMode) {
          setDispenseMode(initialMode);
        } else if (initialItemCode) {
          setDispenseMode("INDIVIDUAL");
        } else {
          setDispenseMode("RECIPE");
        }

        if (initialItemCode) {
          setIndividualItemCode(initialItemCode);
          const item = availableItems.find((i) => i.code === initialItemCode);
          if (item) {
            if (item.isVariablePack && item.recipeUom) {
              setIndividualUnitType("RECIPE_UOM");
            } else {
              setIndividualUnitType("BASE");
            }
          }
        } else if (availableItems.length > 0) {
          setIndividualItemCode(availableItems[0].code);
          if (availableItems[0].isVariablePack && availableItems[0].recipeUom) {
            setIndividualUnitType("RECIPE_UOM");
          } else {
            setIndividualUnitType("BASE");
          }
        }

        if (initialRecipeCode) {
          const rec = recipes.find((r) => r.code === initialRecipeCode);
          setSelectedRecipesList([{ recipeCode: initialRecipeCode, batchQuantity: rec?.yieldQuantity || 1 }]);
        } else {
          // Empty by default (remove default Parfait)
          setSelectedRecipesList([]);
        }
      }

      fetch(`/api/inventory/recipients?shiftType=${encodeURIComponent(selectedShift)}&dispatchDate=${encodeURIComponent(dispatchDate)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            if (data.supervisors?.length > 0) {
              setAvailableSupervisors(data.supervisors);
            }
            if (data.recipients?.length > 0) {
              setAvailableRecipients(data.recipients);
            }
            if (data.defaultRecipient) {
              if (!isCustomRecipient) {
                setRecipient(data.defaultRecipient);
              }
              if (!isCustomIndividualRecipient) {
                setIndividualRecipient(data.defaultRecipient);
              }
            }
          }
        })
        .catch((err) => console.warn("Could not fetch staff recipients:", err));
    } else {
      setShowPostDispatch(false);
      setPostDispatchItems([]);
      setPostDispatchBatchRef("");
      setPostDispatchRecipeName("");
      setGroupedDirectItems([]);
      setGroupLabel("");
    }
  }, [isOpen, initialMode, initialItemCode, initialRecipeCode, recipes, availableItems, selectedShift, dispatchDate, isCustomRecipient, isCustomIndividualRecipient]);

  // Auto calculate BOM whenever recipes or batch sizes change
  const fetchBOM = useCallback(async () => {
    const validBatches = selectedRecipesList.filter((r) => r.recipeCode && r.batchQuantity > 0);
    if (validBatches.length === 0) {
      setDispenseRows([]);
      return;
    }
    setCalculating(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/calculate-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipes: validBatches.map((r) => ({
            recipeCode: r.recipeCode,
            batchQuantity: Number(r.batchQuantity),
          })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.calculation) {
        const rows: DispenseRow[] = data.calculation.requiredIngredients.map((ing: any) => ({
          itemCode: ing.itemCode,
          itemName: ing.itemName,
          standardRequired: ing.unitRequired,
          actualQuantity: ing.unitRequired,
          uom: ing.uom,
          availableStock: ing.availableStock,
          isIncluded: true,
          isExtra: false,
          isVariable: Boolean(ing.isVariable),
          sourceBreakdown: ing.sourceBreakdown || "",
          benchmark: ing.benchmark,
          recipeUom: ing.recipeUom,
          containerUom: ing.containerUom,
          containerEquivalent: ing.containerEquivalent,
          inUseQuantity: ing.inUseQuantity,
          inUseRemainingPortions: ing.inUseRemainingPortions,
          projectedSealedStock: ing.projectedSealedStock,
          projectedInUsePortions: ing.projectedInUsePortions,
          projectedInUsePercent: ing.projectedInUsePercent,
          projectedNotes: ing.projectedNotes,
          isSufficient: ing.isSufficient,
        }));
        setDispenseRows(rows);
      } else {
        setError(data.error || "Failed to calculate recipe BOM.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to calculate recipe requirements.");
    } finally {
      setCalculating(false);
    }
  }, [selectedRecipesList]);

  useEffect(() => {
    if (isOpen && selectedRecipesList.length > 0) {
      fetchBOM();
    }
  }, [isOpen, selectedRecipesList, fetchBOM]);

  const unselectedRecipes = useMemo(() => {
    const selectedCodes = new Set(selectedRecipesList.map((r) => r.recipeCode));
    return recipes.filter((r) => !selectedCodes.has(r.code));
  }, [recipes, selectedRecipesList]);

  const supervisorOptions = useMemo<CustomSelectOption[]>(() => {
    const list: CustomSelectOption[] = effectiveSupervisors.map((s) => ({
      value: `${s.cleanName} (Production Supervisor)`,
      label: s.cleanName,
      sublabel: s.isMorningLead ? "☀️ Morning Lead" : s.isNightLead ? "🌙 Night Lead" : "Supervisor",
      group: "Production Supervisors",
    }));
    list.push({
      value: "__CUSTOM__",
      label: "✏️ Other / Custom Recipient...",
      sublabel: "Type custom recipient name",
    });
    return list;
  }, [effectiveSupervisors]);

  const unselectedRecipeOptions = useMemo<CustomSelectOption[]>(() => {
    return unselectedRecipes.map((r) => ({
      value: r.code,
      label: r.name,
      sublabel: `Code: ${r.code} • Yield: ${r.yieldQuantity} ${r.yieldUnit}`,
    }));
  }, [unselectedRecipes]);

  const handleRecipeQtyChange = (recipeCode: string, newQty: number) => {
    const val = isNaN(newQty) ? 0 : Math.max(0, newQty);
    setSelectedRecipesList((prev) =>
      prev.map((r) => (r.recipeCode === recipeCode ? { ...r, batchQuantity: val } : r))
    );
  };

  const handleRecipeQtyAdjust = (recipeCode: string, delta: number) => {
    setSelectedRecipesList((prev) =>
      prev.map((r) =>
        r.recipeCode === recipeCode
          ? { ...r, batchQuantity: Math.max(0, Number((r.batchQuantity + delta).toFixed(3))) }
          : r
      )
    );
  };

  const handleRemoveRecipe = (recipeCode: string) => {
    setSelectedRecipesList((prev) => prev.filter((r) => r.recipeCode !== recipeCode));
  };

  const handleAddRecipeToBatch = () => {
    if (!addRecipeCode) return;
    const rec = recipes.find((r) => r.code === addRecipeCode);
    const defaultYield = rec ? (rec.yieldQuantity || 1) : 100;
    const qty = Math.max(0, Number(addRecipeQty) || defaultYield);
    setSelectedRecipesList((prev) => {
      const existing = prev.find((r) => r.recipeCode === addRecipeCode);
      if (existing) {
        return prev.map((r) =>
          r.recipeCode === addRecipeCode ? { ...r, batchQuantity: r.batchQuantity + qty } : r
        );
      }
      return [...prev, { recipeCode: addRecipeCode, batchQuantity: qty }];
    });
    setAddRecipeCode("");
    setAddRecipeQty(100);
    setShowAddRecipe(false);
  };

  // Available items that aren't already in the dispense rows
  const unselectedItems = useMemo(() => {
    const selectedCodes = new Set(dispenseRows.map((r) => r.itemCode));
    return availableItems.filter((i) => !selectedCodes.has(i.code));
  }, [availableItems, dispenseRows]);

  // Row update handlers
  const handleToggleInclude = (itemCode: string) => {
    setDispenseRows((prev) =>
      prev.map((r) => (r.itemCode === itemCode ? { ...r, isIncluded: !r.isIncluded } : r))
    );
  };

  const handleQuantityChange = (itemCode: string, newQty: number) => {
    const val = isNaN(newQty) ? 0 : Math.max(0, newQty);
    setDispenseRows((prev) =>
      prev.map((r) => (r.itemCode === itemCode ? { ...r, actualQuantity: val } : r))
    );
  };

  const handleRemoveRow = (itemCode: string) => {
    const row = dispenseRows.find((r) => r.itemCode === itemCode);
    if (row?.isExtra) {
      setDispenseRows((prev) => prev.filter((r) => r.itemCode !== itemCode));
    } else {
      handleToggleInclude(itemCode);
    }
  };

  const handleResetToStandard = () => {
    setDispenseRows((prev) =>
      prev
        .filter((r) => !r.isExtra)
        .map((r) => ({
          ...r,
          isIncluded: true,
          actualQuantity: r.standardRequired,
        }))
    );
  };

  const handleAddExtraItem = () => {
    if (!extraItemCode) return;
    const item = availableItems.find((i) => i.code === extraItemCode);
    if (!item) return;

    const qty = Math.max(0.001, Number(extraQuantity) || 1);
    setDispenseRows((prev) => [
      ...prev,
      {
        itemCode: item.code,
        itemName: item.name,
        standardRequired: 0,
        actualQuantity: qty,
        uom: item.uom,
        availableStock: item.currentStock,
        isIncluded: true,
        isExtra: true,
      },
    ]);

    setExtraItemCode("");
    setExtraQuantity("1");
    setShowAddExtra(false);
  };

  // Validation calculations
  const activeRows = dispenseRows.filter((r) => r.isIncluded && r.actualQuantity > 0);
  const isRowShortfall = (r: DispenseRow) => {
    if (!r.isIncluded) return false;
    if (r.isVariable) {
      return r.availableStock <= 0;
    }
    return r.actualQuantity > r.availableStock;
  };
  const hasShortfalls = activeRows.some(isRowShortfall);
  const isCustomized = dispenseRows.some(
    (r) => !r.isIncluded || r.isExtra || r.actualQuantity !== r.standardRequired
  );

  const selectedIndividualItem = useMemo(
    () => availableItems.find((i) => i.code === individualItemCode) || availableItems[0],
    [availableItems, individualItemCode]
  );

  const recipeOptions = useMemo(
    () =>
      recipes.map((r) => ({
        code: r.code,
        name: r.name,
        uom: `${r.yieldQuantity} ${r.yieldUnit}/batch`,
      })),
    [recipes]
  );
  const individualAvailableUnits = useMemo(() => {
    if (!selectedIndividualItem) return [];
    if (selectedIndividualItem.isVariablePack && selectedIndividualItem.recipeUom) {
      const recipeOpt: UnitOption = {
        type: "RECIPE_UOM",
        label: `${selectedIndividualItem.recipeUom} (Culinary / Dispatch)`,
        multiplier: 1,
      };
      const baseOpt: UnitOption = {
        type: "BASE",
        label: `${selectedIndividualItem.uom} (Storage Container)`,
        multiplier: 1,
      };
      return [recipeOpt, baseOpt];
    }
    return getAvailableUnits(selectedIndividualItem);
  }, [selectedIndividualItem]);

  const individualQtyNum = Number(individualQuantity) || 0;
  const isIndividualVariable = Boolean(
    selectedIndividualItem?.isVariablePack && individualUnitType === "RECIPE_UOM"
  );

  const individualDeductBase = selectedIndividualItem
    ? toBaseUnits(individualQtyNum, individualUnitType, selectedIndividualItem)
    : individualQtyNum;

  const individualShortfall = selectedIndividualItem
    ? isIndividualVariable
      ? selectedIndividualItem.currentStock <= 0
      : individualDeductBase > selectedIndividualItem.currentStock
    : false;

  const currentPackaging = selectedIndividualItem
    ? formatPackagingDisplay(selectedIndividualItem.currentStock, selectedIndividualItem)
    : null;

  const remainingBaseQty = selectedIndividualItem
    ? isIndividualVariable
      ? selectedIndividualItem.currentStock
      : Math.max(0, selectedIndividualItem.currentStock - individualDeductBase)
    : 0;

  const remainingPackaging = selectedIndividualItem
    ? isIndividualVariable
      ? null
      : formatPackagingDisplay(remainingBaseQty, selectedIndividualItem)
    : null;

  const activeUnitLabel = useMemo(() => {
    if (!selectedIndividualItem) return "";
    if (individualUnitType === "RECIPE_UOM") {
      return selectedIndividualItem.recipeUom || selectedIndividualItem.uom;
    }
    return (
      individualAvailableUnits.find((u) => u.type === individualUnitType)?.label ||
      selectedIndividualItem.uom
    );
  }, [selectedIndividualItem, individualUnitType, individualAvailableUnits]);

  const handleAddToGroup = () => {
    if (!selectedIndividualItem) {
      setError("Please select a valid material to add.");
      return;
    }
    if (individualQtyNum <= 0) {
      setError("Please specify a valid quantity greater than 0.");
      return;
    }
    if (individualShortfall) {
      if (isIndividualVariable) {
        setError(
          `Cannot add: ${selectedIndividualItem.name} is currently out of stock (0 ${selectedIndividualItem.uom} available in storage).`
        );
      } else {
        setError(
          `Cannot add: Insufficient stock. Store only has ${selectedIndividualItem.currentStock} ${selectedIndividualItem.uom} available.`
        );
      }
      return;
    }

    setGroupedDirectItems((prev) => {
      const existingIdx = prev.findIndex((g) => g.itemCode === selectedIndividualItem.code);
      if (existingIdx >= 0) {
        const current = prev[existingIdx];
        const newQty = Number((current.quantity + individualQtyNum).toFixed(3));
        const newDeductBase = selectedIndividualItem.isVariablePack && individualUnitType === "RECIPE_UOM"
          ? newQty
          : toBaseUnits(newQty, individualUnitType, selectedIndividualItem);

        if (!isIndividualVariable && newDeductBase > selectedIndividualItem.currentStock) {
          setError(
            `Cannot add: Total quantity (${newDeductBase} ${selectedIndividualItem.uom}) exceeds store stock (${selectedIndividualItem.currentStock} ${selectedIndividualItem.uom})`
          );
          return prev;
        }

        const updated = [...prev];
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          unitType: individualUnitType,
          unitLabel: activeUnitLabel,
          deductBase: newDeductBase,
        };
        return updated;
      }

      return [
        ...prev,
        {
          id: `grp-${selectedIndividualItem.code}-${Date.now()}`,
          itemCode: selectedIndividualItem.code,
          itemName: selectedIndividualItem.name,
          imageUrl: selectedIndividualItem.imageUrl,
          storageLocation: selectedIndividualItem.storageLocation,
          quantity: individualQtyNum,
          unitType: individualUnitType,
          unitLabel: activeUnitLabel,
          deductBase: individualDeductBase,
          baseUom: selectedIndividualItem.uom,
          isVariable: isIndividualVariable,
          currentStock: selectedIndividualItem.currentStock,
        },
      ];
    });

    setError(null);
    setIndividualQuantity("1");
  };

  const handleRemoveFromGroup = (id: string) => {
    setGroupedDirectItems((prev) => prev.filter((g) => g.id !== id));
  };

  const handleClearGroup = () => {
    setGroupedDirectItems([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (dispenseMode === "INDIVIDUAL") {
      // 1. Grouped Direct Requisition Mode
      if (groupedDirectItems.length > 0) {
        if (!individualRecipient.trim()) {
          setError("Please select or enter a recipient for the requisition.");
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const payloadItems = groupedDirectItems.map((g) => ({
            itemCode: g.itemCode,
            quantity: g.isVariable ? g.quantity : g.deductBase,
            dispensedUom: g.unitLabel,
            isVariableDispatch: g.isVariable,
          }));

          const res = await fetch("/api/inventory/dispense-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: payloadItems,
              groupLabel: groupLabel.trim() || undefined,
              recipient: individualRecipient.trim(),
              shiftType: selectedShift,
              dispatchDate,
              purpose: groupLabel.trim() || individualPurpose,
              notes: individualNotes.trim(),
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Material group dispensing failed.");

          const variableItems: VariableItemUsage[] = data.result?.variableItems || [];
          if (variableItems.length > 0) {
            setPostDispatchItems(variableItems);
            setPostDispatchBatchRef(data.result?.referenceId || "");
            setPostDispatchRecipeName(
              groupLabel.trim()
                ? `Requisition: ${groupLabel.trim()}`
                : `Direct Dispense (${groupedDirectItems.length} Materials)`
            );
            setShowPostDispatch(true);
          } else {
            onSuccess();
            onClose();
          }
        } catch (err: any) {
          setError(err.message || "Failed to dispense material group.");
        } finally {
          setLoading(false);
        }
        return;
      }

      // 2. Single Material Direct Dispense Mode (instant 1-click fallback)
      if (!selectedIndividualItem) {
        setError("Please select a valid material to dispense.");
        return;
      }
      if (individualQtyNum <= 0) {
        setError("Please specify a valid quantity greater than 0.");
        return;
      }
      if (individualShortfall) {
        if (isIndividualVariable) {
          setError(
            `Cannot dispense: ${selectedIndividualItem.name} is currently out of stock (0 ${selectedIndividualItem.uom} available in storage).`
          );
        } else {
          setError(
            `Insufficient stock: Store only has ${selectedIndividualItem.currentStock} ${selectedIndividualItem.uom} available.`
          );
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const dispenseNotes =
          individualUnitType === "RECIPE_UOM"
            ? `${individualNotes ? `${individualNotes} • ` : ""}Dispensed: ${individualQuantity} ${activeUnitLabel}`
            : individualUnitType !== "BASE"
            ? `${individualNotes ? `${individualNotes} • ` : ""}Dispensed: ${individualQuantity} ${activeUnitLabel} (= ${individualDeductBase.toLocaleString()} ${selectedIndividualItem.uom})`
            : individualNotes.trim();

        const res = await fetch("/api/inventory/dispense-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemCode: selectedIndividualItem.code,
            quantity: isIndividualVariable ? individualQtyNum : individualDeductBase,
            dispensedUom: activeUnitLabel,
            isVariableDispatch: isIndividualVariable,
            groupLabel: groupLabel.trim() || undefined,
            recipient: individualRecipient.trim(),
            shiftType: selectedShift,
            dispatchDate,
            purpose: groupLabel.trim() || individualPurpose,
            notes: dispenseNotes,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Material dispensing failed.");

        const variableItems: VariableItemUsage[] = data.result?.variableItems || [];
        if (isIndividualVariable || data.result?.isVariable || variableItems.length > 0) {
          setPostDispatchItems(
            variableItems.length > 0
              ? variableItems
              : [
                  {
                    id: selectedIndividualItem.id,
                    code: selectedIndividualItem.code,
                    name: selectedIndividualItem.name,
                    currentStock: selectedIndividualItem.currentStock,
                    uom: selectedIndividualItem.uom,
                    recipeUom: selectedIndividualItem.recipeUom || undefined,
                    quantityDispensed: individualQtyNum,
                    dispensedUom: activeUnitLabel,
                  },
                ]
          );
          setPostDispatchBatchRef(data.result?.referenceId || "");
          setPostDispatchRecipeName(
            groupLabel.trim()
              ? `Requisition: ${groupLabel.trim()}`
              : `Direct Dispense: ${selectedIndividualItem.name}`
          );
          setShowPostDispatch(true);
        } else {
          onSuccess();
          onClose();
        }
      } catch (err: any) {
        setError(err.message || "Failed to dispense material.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Recipe Batch Mode
    if (selectedRecipesList.length === 0) {
      setError("Please select at least one production recipe to dispense.");
      return;
    }

    if (activeRows.length === 0) {
      setError("Please include at least 1 ingredient with a quantity greater than 0.");
      return;
    }

    if (hasShortfalls) {
      setError("Cannot dispense batch: one or more included items exceed available store stock.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const customIngredients = activeRows.map((r) => ({
        itemCode: r.itemCode,
        quantity: r.actualQuantity,
        itemName: r.itemName,
        uom: r.uom,
      }));

      const res = await fetch("/api/inventory/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipes: selectedRecipesList.map((r) => ({
            recipeCode: r.recipeCode,
            batchQuantity: Number(r.batchQuantity),
          })),
          recipeCode: selectedRecipesList[0]?.recipeCode,
          batchQuantity: selectedRecipesList.reduce((acc, r) => acc + r.batchQuantity, 0),
          recipient: recipient.trim(),
          shiftType: selectedShift,
          dispatchDate,
          notes: notes.trim(),
          customIngredients,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch dispensing failed.");

      const variableItems: VariableItemUsage[] = data.result?.variableItems || [];
      if (variableItems.length > 0) {
        setPostDispatchItems(variableItems);
        setPostDispatchBatchRef(data.result?.batchReference || "");
        setPostDispatchRecipeName(data.result?.recipeName || "");
        setShowPostDispatch(true);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to dispense ingredients.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (showPostDispatch && postDispatchItems.length > 0) {
    return (
      <VariablePostDispatchModal
        isOpen={true}
        onClose={() => {
          setShowPostDispatch(false);
          onClose();
        }}
        variableItems={postDispatchItems}
        batchReference={postDispatchBatchRef}
        recipeName={postDispatchRecipeName}
        shiftType={selectedShift}
        recipient={recipient || individualRecipient}
        onSuccess={() => {
          setShowPostDispatch(false);
          onSuccess();
          onClose();
        }}
      />
    );
  }

  return (
    <div
      data-modal="true"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl ${dispenseMode === "INDIVIDUAL" ? "max-w-5xl" : "max-w-3xl"} w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[92vh] animate-in slide-in-from-bottom duration-350 ease-out`}>
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 shrink-0" />
        {/* Clean Calm Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#CF0458]">
              {dispenseMode === "RECIPE" ? (
                <Layers className="w-5 h-5" />
              ) : (
                <Package className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">
                  {dispenseMode === "RECIPE"
                    ? "Production Batch Dispensing"
                    : groupLabel.trim()
                    ? `Requisition: ${groupLabel.trim()}`
                    : groupedDirectItems.length > 0
                    ? `Direct Material Requisition (${groupedDirectItems.length} Items)`
                    : "Direct Material Dispense (Single / Group)"}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  selectedShift === "MORNING_SHIFT"
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-indigo-50 text-indigo-800 border-indigo-200"
                }`}>
                  {selectedShift === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {dispenseMode === "RECIPE"
                  ? "Recipe Bill of Materials (BOM) guidance — modify quantities or exclude items being omitted."
                  : "Issue raw ingredients or packaging directly to floor or kitchen prep as single items or grouped requisitions."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setDispenseMode("RECIPE");
              setError(null);
            }}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              dispenseMode === "RECIPE"
                ? "border-[#CF0458] text-[#CF0458] bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Recipe Production Batch (BOM)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDispenseMode("INDIVIDUAL");
              setError(null);
            }}
            className={`py-2 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              dispenseMode === "INDIVIDUAL"
                ? "border-[#CF0458] text-[#CF0458] bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Direct Material Dispense</span>
            {groupedDirectItems.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#CF0458] text-white">
                {groupedDirectItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-[#D97706]/30 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706]" />
              <span>{error}</span>
            </div>
          )}

          {/* Interactive Production Date & Shift Selector */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            {/* Target Dispatch Date */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#CF0458]" />
                  <span>Target Dispatch Date</span>
                  <span className="text-[#CF0458]">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Select the factory production date this dispatch belongs to.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  lang="en-GB"
                  value={dispatchDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-[#CF0458]"
                />
                <button
                  type="button"
                  onClick={() => handleDateChange(new Date().toISOString().slice(0, 10))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    dispatchDate === new Date().toISOString().slice(0, 10)
                      ? "bg-[#CF0458] text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    handleDateChange(d.toISOString().slice(0, 10));
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    dispatchDate === (() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 1);
                      return d.toISOString().slice(0, 10);
                    })()
                      ? "bg-[#CF0458] text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Yesterday
                </button>
              </div>
            </div>

            {/* Production Shift */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  Production Shift Dispensed For <span className="text-[#CF0458]">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Select which production shift will receive, verify, and consume these materials.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleShiftChange("MORNING_SHIFT")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedShift === "MORNING_SHIFT"
                      ? "bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Sun className={`w-3.5 h-3.5 ${selectedShift === "MORNING_SHIFT" ? "text-amber-600" : "text-slate-400"}`} />
                  <span>Morning Shift (08:00 – 18:00)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftChange("NIGHT_SHIFT")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedShift === "NIGHT_SHIFT"
                      ? "bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Moon className={`w-3.5 h-3.5 ${selectedShift === "NIGHT_SHIFT" ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>Night Shift (18:00 – 08:00)</span>
                </button>
              </div>
            </div>

            {/* Auto-Remembered Shift Rotation Banner */}
            <div className="pt-2.5 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-3.5 h-3.5 text-[#CF0458] shrink-0" />
                <span className="text-[11px] text-slate-600">
                  Week Shift Rotation:{" "}
                  <strong className="text-slate-800">
                    {effectiveSupervisors.find((s) => s.isMorningLead)?.cleanName || "Aishah Anuoluwapo"}
                  </strong>{" "}
                  <span className="text-amber-700 font-semibold">(Morning)</span>
                  {" • "}
                  <strong className="text-slate-800">
                    {effectiveSupervisors.find((s) => s.isNightLead)?.cleanName || "Aunty Ada"}
                  </strong>{" "}
                  <span className="text-indigo-700 font-semibold">(Night)</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {isPastDate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                    <span>Past Date Auto-Resolved</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                  <span>Assigned:</span>
                  <strong className="text-[#CF0458]">
                    {effectiveSupervisors.find((s) => selectedShift === "MORNING_SHIFT" ? s.isMorningLead : s.isNightLead)?.cleanName || "Supervisor"}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* 1. INDIVIDUAL MATERIAL DISPENSE VIEW */}
          {/* ============================================================ */}
          {dispenseMode === "INDIVIDUAL" && (
            <div className="space-y-5">
              {/* Responsive 2-Column Desktop Grid / Stacked Mobile Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* -------------------------------------------------------- */}
                {/* LEFT COLUMN: Material Selection & Quantity Configurator */}
                {/* -------------------------------------------------------- */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Card 1: Material Item Selector & Selected Item Preview */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Select Material or Packaging Item
                        </label>
                        <span className="text-[10px] font-medium text-slate-400">
                          {availableItems.length} items available
                        </span>
                      </div>
                      <SearchableProductSelect
                        items={availableItems}
                        value={individualItemCode}
                        valueKey="code"
                        onChange={(code) => {
                          setIndividualItemCode(code);
                          const item = availableItems.find((i) => i.code === code);
                          if (item) {
                            if (item.isVariablePack && item.recipeUom) {
                              setIndividualUnitType("RECIPE_UOM");
                            } else {
                              setIndividualUnitType("BASE");
                            }
                          }
                        }}
                        placeholder="Select material or product..."
                      />
                    </div>

                    {/* Selected Material Card & Live Stock Balance */}
                    {selectedIndividualItem && (
                      <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {selectedIndividualItem.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={selectedIndividualItem.imageUrl}
                                alt={selectedIndividualItem.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {selectedIndividualItem.name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-semibold text-slate-700">{selectedIndividualItem.code}</span>
                              <span>•</span>
                              <span className="truncate">{selectedIndividualItem.storageLocation || "Central Store"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200/70">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Store Stock</div>
                          <div className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                            {currentPackaging ? (
                              <>
                                <div>{currentPackaging.primary}</div>
                                {currentPackaging.secondary && (
                                  <div className="text-[10px] font-normal text-slate-500 font-sans">{currentPackaging.secondary}</div>
                                )}
                              </>
                            ) : (
                              <>
                                {selectedIndividualItem.currentStock} <span className="text-[11px] font-normal text-slate-500">{selectedIndividualItem.uom}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Quantity to Dispense & Quick Pickers */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Quantity to Dispense
                      </label>
                      {selectedIndividualItem && (
                        <span className="text-[11px] text-slate-500">
                          Remaining after dispense:{" "}
                          {isIndividualVariable ? (
                            <span className="text-blue-700 font-semibold italic">
                              Confirm in next step
                            </span>
                          ) : (
                            <strong className={individualShortfall ? "text-red-600 font-bold" : "text-emerald-700 font-bold"}>
                              {remainingPackaging?.primary || `${remainingBaseQty.toFixed(2)} ${selectedIndividualItem.uom}`}
                              {remainingPackaging?.secondary ? ` (${remainingPackaging.secondary})` : ""}
                            </strong>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Unit selection pills if multi-unit is available */}
                    {individualAvailableUnits.length > 1 && (
                      <div className="flex items-center gap-1.5 pb-1 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Unit:</span>
                        {individualAvailableUnits.map((u) => (
                          <button
                            key={u.type}
                            type="button"
                            onClick={() => setIndividualUnitType(u.type)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              individualUnitType === u.type
                                ? "bg-[#CF0458] text-white shadow-xs"
                                : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                          >
                            {u.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          required
                          value={individualQuantity}
                          onChange={(e) => setIndividualQuantity(e.target.value)}
                          placeholder="Enter quantity..."
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5">Quick:</span>
                        {[1, 5, 10, 25, 50].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setIndividualQuantity(String(num))}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                          >
                            +{num}
                          </button>
                        ))}
                        {selectedIndividualItem && selectedIndividualItem.currentStock > 0 && !isIndividualVariable && (
                          <button
                            type="button"
                            onClick={() => {
                              const maxQty = fromBaseUnits(
                                selectedIndividualItem.currentStock,
                                individualUnitType,
                                selectedIndividualItem
                              );
                              const formatted = maxQty % 1 === 0 ? maxQty.toString() : maxQty.toFixed(2);
                              setIndividualQuantity(formatted);
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#CF0458]/10 text-[#CF0458] hover:bg-[#CF0458]/20 transition-colors cursor-pointer"
                          >
                            Max
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Conversion breakdown display */}
                    {selectedIndividualItem && Number(individualQuantity) > 0 && (
                      <>
                        {isIndividualVariable ? (
                          <div className="text-[11px] text-blue-800 bg-blue-50/80 border border-blue-200 px-3 py-2 rounded-lg flex items-center justify-between">
                            <span>
                              Dishing out <strong>{individualQuantity} {selectedIndividualItem.recipeUom}</strong> from <strong>{selectedIndividualItem.uom}</strong> storage container.
                            </span>
                            <span className="font-bold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                              Confirm Remaining Next
                            </span>
                          </div>
                        ) : individualUnitType !== "BASE" ? (
                          <div className="text-[11px] text-slate-600 font-medium flex flex-wrap items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                            <span className="font-bold text-[#CF0458]">Deduction from store:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {individualDeductBase.toLocaleString()} {selectedIndividualItem.uom}
                            </span>
                            {individualUnitType === "CARTON" && selectedIndividualItem.packagingType === "CARTON_AND_PACK" && (
                              <span className="text-slate-400 font-normal">
                                ({(Number(individualQuantity) * (Number(selectedIndividualItem.packsPerCarton) || 1)).toLocaleString()}{" "}
                                {selectedIndividualItem.packUnit || "packs"})
                              </span>
                            )}
                          </div>
                        ) : null}
                      </>
                    )}

                    {individualShortfall && (
                      <div className="text-[11px] text-red-600 font-bold flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>
                          Requested quantity ({individualDeductBase.toLocaleString()} {selectedIndividualItem?.uom}) exceeds available store balance ({selectedIndividualItem?.currentStock} {selectedIndividualItem?.uom})!
                        </span>
                      </div>
                    )}

                    {/* Stage into Group Action Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/80">
                      <div className="text-[11px] text-slate-500">
                        Bundle with other items in one requisition?
                      </div>
                      <button
                        type="button"
                        onClick={handleAddToGroup}
                        disabled={!selectedIndividualItem || individualQtyNum <= 0 || individualShortfall}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-bold bg-[#CF0458] text-white hover:bg-[#B5034C] active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Add Material to Group</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* -------------------------------------------------------- */}
                {/* RIGHT COLUMN: Requisition Group Manifest & Recipient   */}
                {/* -------------------------------------------------------- */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Card 1: Requisition Group Manifest Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                            Requisition Group Manifest
                          </h4>
                          <p className="text-[10px] text-slate-500">
                            All queued items will dispatch together under one slip.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          groupedDirectItems.length > 0
                            ? "bg-[#CF0458] text-white shadow-2xs"
                            : "bg-slate-200 text-slate-600"
                        }`}>
                          {groupedDirectItems.length} {groupedDirectItems.length === 1 ? "Item" : "Items"}
                        </span>
                        {groupedDirectItems.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearGroup}
                            className="text-[11px] font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer flex items-center gap-1"
                            title="Clear all queued materials"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Clear All</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group Label / Requisition Purpose Input & Presets */}
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-[#CF0458]" />
                          <span>Group Name / Requisition Purpose</span>
                        </label>
                        {groupLabel && (
                          <button
                            type="button"
                            onClick={() => setGroupLabel("")}
                            className="text-[10px] text-slate-400 hover:text-red-600 font-semibold cursor-pointer"
                          >
                            Clear label
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          value={groupLabel}
                          onChange={(e) => setGroupLabel(e.target.value)}
                          placeholder="e.g. Packaging Line Prep, Kitchen Prep Top-Up..."
                          className="w-full pl-3 pr-8 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-slate-50/50 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                        />
                        {groupLabel && (
                          <button
                            type="button"
                            onClick={() => setGroupLabel("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Preset Chips */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Quick Preset Labels:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {GROUP_LABEL_PRESETS.map((preset) => {
                            const isSelected = groupLabel.trim().toLowerCase() === preset.toLowerCase();
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setGroupLabel("");
                                  } else {
                                    setGroupLabel(preset);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-[#CF0458] text-white shadow-2xs font-bold"
                                    : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/70"
                                }`}
                              >
                                {preset}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Queued Materials List OR Empty State */}
                    {groupedDirectItems.length > 0 ? (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto divide-y divide-slate-100 pr-0.5">
                        {groupedDirectItems.map((g) => (
                          <div
                            key={g.id}
                            className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {g.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={g.imageUrl}
                                    alt={g.itemName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {g.itemName}
                                </div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-mono">
                                  <span>{g.itemCode}</span>
                                  {g.storageLocation && (
                                    <>
                                      <span>•</span>
                                      <span className="font-sans">{g.storageLocation}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              <div className="text-right">
                                <div className="text-xs font-bold text-slate-900 font-mono">
                                  {g.quantity} <span className="text-[10px] font-normal text-slate-500 font-sans">{g.unitLabel}</span>
                                </div>
                                {g.unitType !== "BASE" && !g.isVariable && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    = {g.deductBase} {g.baseUom}
                                  </div>
                                )}
                                {g.isVariable && (
                                  <div className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1 py-0.2 rounded">
                                    Variable stock
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromGroup(g.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Remove from group"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-white text-center space-y-1.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          No materials queued in group yet
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          Add items from the left to issue multiple materials under one requisition, or dispense the selected item directly below.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Handover Recipient & Shift Details */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Production Supervisor / Recipient <span className="text-[#CF0458]">*</span>
                        </label>
                        <span className="text-[10px] font-semibold text-[#CF0458] bg-[#CF0458]/10 px-1.5 py-0.5 rounded">
                          Supervisor
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <CustomSelect
                          options={supervisorOptions}
                          value={
                            isCustomIndividualRecipient
                              ? "__CUSTOM__"
                              : effectiveSupervisors.some((s) => individualRecipient.includes(s.cleanName))
                              ? effectiveSupervisors.find((s) => individualRecipient.includes(s.cleanName))?.cleanName + " (Production Supervisor)"
                              : individualRecipient
                              ? "__CUSTOM__"
                              : supervisorOptions[0]?.value || ""
                          }
                          onChange={(val) => {
                            if (val === "__CUSTOM__") {
                              setIsCustomIndividualRecipient(true);
                              setIndividualRecipient("");
                            } else {
                              setIsCustomIndividualRecipient(false);
                              setIndividualRecipient(val);
                            }
                          }}
                          placeholder="Select production supervisor..."
                          searchPlaceholder="Search supervisor..."
                          size="sm"
                        />

                        {isCustomIndividualRecipient && (
                          <input
                            type="text"
                            required
                            value={individualRecipient}
                            onChange={(e) => setIndividualRecipient(e.target.value)}
                            placeholder="Enter recipient name..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900 animate-in fade-in duration-150"
                          />
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                        Shift Notes / Requisition Details
                      </label>
                      <input
                        type="text"
                        value={individualNotes}
                        onChange={(e) => setIndividualNotes(e.target.value)}
                        placeholder="e.g. Emergency top-up for morning parfait cup packing line"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions & Submit for Individual Mode (Spanning Bottom) */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
                <div className="flex items-center gap-2 text-xs text-slate-600 self-start sm:self-auto">
                  {groupedDirectItems.length > 0 ? (
                    <>
                      <Layers className="w-4 h-4 text-[#CF0458] shrink-0" />
                      <span>
                        Grouped requisition of <strong>{groupedDirectItems.length}</strong> materials
                        {groupLabel.trim() ? ` under "${groupLabel.trim()}"` : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4 text-[#059669] shrink-0" />
                      <span>Immediate single-material store deduction</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      (groupedDirectItems.length > 0
                        ? false
                        : individualShortfall || individualQtyNum <= 0)
                    }
                    className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {loading
                        ? "Dispensing Material..."
                        : groupedDirectItems.length > 0
                        ? `Dispense Group (${groupedDirectItems.length} Materials)`
                        : `Dispense ${individualQuantity} ${
                            individualAvailableUnits.find((u) => u.type === individualUnitType)?.label ||
                            selectedIndividualItem?.uom ||
                            "units"
                          }`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 2. RECIPE PRODUCTION BATCH VIEW */}
          {/* ============================================================ */}
          {dispenseMode === "RECIPE" && (
            <div className="space-y-4">
              {/* Recipe & Batch Quantities Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Selected Production Recipes ({selectedRecipesList.length})
                  </label>
                  <div className="text-[11px] font-medium text-slate-500">
                    Total Output:{" "}
                    <span className="font-bold text-slate-900 font-mono">
                      {selectedRecipesList.reduce((sum, r) => sum + r.batchQuantity, 0).toLocaleString()} units
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedRecipesList.map((entry) => {
                    const rec = recipes.find((r) => r.code === entry.recipeCode);
                    return (
                      <div
                        key={entry.recipeCode}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#CF0458] shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">
                              {rec?.name || entry.recipeCode}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-semibold">{entry.recipeCode}</span>
                              {rec && (
                                <>
                                  <span>•</span>
                                  <span>Standard yield: {rec.yieldQuantity} {rec.yieldUnit}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1 hidden sm:inline">Output:</span>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              required
                              value={entry.batchQuantity}
                              onChange={(e) => handleRecipeQtyChange(entry.recipeCode, Number(e.target.value))}
                              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white text-slate-900 text-center focus:outline-hidden focus:border-[#CF0458]"
                            />
                            <span className="text-[11px] text-slate-500">{rec?.yieldUnit || "units"}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {[50, 100].map((step) => (
                              <button
                                key={step}
                                type="button"
                                onClick={() => handleRecipeQtyAdjust(entry.recipeCode, step)}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                +{step}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleRemoveRecipe(entry.recipeCode)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove recipe from batch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {selectedRecipesList.length === 0 && (
                    <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-1.5">
                      <p className="text-xs text-slate-700 font-bold">No Production Recipe Selected</p>
                      <p className="text-[11px] text-slate-500">Choose a recipe below to calculate the required Bill of Materials (BOM).</p>
                    </div>
                  )}
                </div>

                {/* Add Another Recipe Accordion/Form */}
                {showAddRecipe || selectedRecipesList.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-3 animate-in fade-in duration-100">
                    <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                      <span>{selectedRecipesList.length === 0 ? "Select Production Recipe" : "Add Recipe to Batch"}</span>
                      {selectedRecipesList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAddRecipe(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <CustomSelect
                          options={unselectedRecipeOptions}
                          value={addRecipeCode}
                          onChange={(code) => {
                            setAddRecipeCode(code);
                            const rec = recipes.find((r) => r.code === code);
                            if (rec) {
                              setAddRecipeQty(rec.yieldQuantity || 1);
                            }
                          }}
                          placeholder="Select recipe formulation..."
                          searchPlaceholder="Search recipe..."
                          size="sm"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          placeholder="Output Qty"
                          value={addRecipeQty}
                          onChange={(e) => setAddRecipeQty(Math.max(0, Number(e.target.value)))}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white text-slate-900 text-center"
                        />
                        <button
                          type="button"
                          disabled={!addRecipeCode}
                          onClick={handleAddRecipeToBatch}
                          className="px-3 py-2 rounded-lg bg-[#CF0458] text-white text-xs font-bold hover:bg-[#B5034C] disabled:opacity-50 cursor-pointer shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ) : unselectedRecipes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const first = unselectedRecipes[0];
                      setAddRecipeCode(first?.code || "");
                      setAddRecipeQty(first?.yieldQuantity || 1);
                      setShowAddRecipe(true);
                    }}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-[#CF0458] hover:bg-[#CF0458]/5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Recipe to This Batch Run</span>
                  </button>
                ) : null}
              </div>

              {/* Interactive BOM Ingredient Table & Mobile Cards */}
              <div className="border border-slate-200 rounded-xl overflow-visible bg-white shadow-xs">
                {/* Table Header Bar */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 rounded-t-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-900">
                      Batch Bill of Materials (BOM)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {activeRows.length} of {dispenseRows.length} included
                    </span>
                    {isCustomized && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#CF0458]/10 text-[#CF0458]">
                        Customized Formula
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {isCustomized && (
                      <button
                        type="button"
                        onClick={handleResetToStandard}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Standard BOM</span>
                      </button>
                    )}

                    {unselectedItems.length > 0 && !showAddExtra && (
                      <button
                        type="button"
                        onClick={() => setShowAddExtra(true)}
                        className="flex items-center gap-1 text-[11px] font-bold text-[#CF0458] hover:text-[#B5034C] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Extra Material</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Extra Material Form (If Open) */}
                {showAddExtra && (
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-100 overflow-visible relative z-20">
                    <div className="flex-1 w-full">
                      <SearchableProductSelect
                        items={unselectedItems}
                        value={extraItemCode}
                        valueKey="code"
                        size="sm"
                        onChange={(code) => setExtraItemCode(code)}
                        placeholder="Select extra inventory material..."
                      />
                    </div>
                    <div className="w-full sm:w-32 flex items-center gap-1">
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        placeholder="Qty"
                        value={extraQuantity}
                        onChange={(e) => setExtraQuantity(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white text-slate-900"
                      />
                      <span className="text-xs text-slate-500">
                        {availableItems.find((i) => i.code === extraItemCode)?.uom || "units"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      <button
                        type="button"
                        disabled={!extraItemCode}
                        onClick={handleAddExtraItem}
                        className="px-3 py-1.5 rounded-lg bg-[#CF0458] text-white text-xs font-bold hover:bg-[#B5034C] disabled:opacity-50 cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddExtra(false);
                          setExtraItemCode("");
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Ingredients Content */}
                {calculating ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Calculating recipe Bill of Materials...
                  </div>
                ) : dispenseRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No ingredients found for selected recipes.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View (>= md) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">Include</th>
                            <th className="py-2.5 px-3">Ingredient / Packaging</th>
                            <th className="py-2.5 px-3 text-right">Standard BOM</th>
                            <th className="py-2.5 px-3 text-center w-36">Dispensing Qty</th>
                            <th className="py-2.5 px-3 text-right">Store Balance</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 w-10 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {dispenseRows.map((row) => {
                            const isOmitted = !row.isIncluded;
                            const hasRowShortfall = isRowShortfall(row);
                            const isModified =
                              row.isIncluded &&
                              !row.isExtra &&
                              row.actualQuantity !== row.standardRequired;

                            return (
                              <tr
                                key={row.itemCode}
                                className={`transition-colors ${
                                  isOmitted
                                    ? "bg-slate-50/70 opacity-60 text-slate-400"
                                    : "hover:bg-slate-50/50"
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={row.isIncluded}
                                    onChange={() => handleToggleInclude(row.itemCode)}
                                    className="w-4 h-4 rounded border-slate-300 text-[#CF0458] focus:ring-[#CF0458] cursor-pointer"
                                  />
                                </td>

                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-bold ${
                                        isOmitted ? "line-through text-slate-400" : "text-slate-900"
                                      }`}
                                    >
                                      {row.itemName}
                                    </span>
                                    {row.isExtra && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                        Extra
                                      </span>
                                    )}
                                    {isModified && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                        Adjusted
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {row.itemCode}
                                  </div>
                                  {row.sourceBreakdown && (
                                    <div className="text-[10px] text-slate-500 mt-0.5 font-sans">
                                      <span className="font-semibold text-slate-600">Breakdown:</span>{" "}
                                      {row.sourceBreakdown}
                                    </div>
                                  )}
                                  {row.isVariable && (
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        Variable Material
                                      </span>
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                  {row.isExtra ? (
                                    <span className="text-slate-300 italic">—</span>
                                  ) : (
                                    <div>
                                      <div className="font-bold text-slate-800">
                                        {row.standardRequired} {row.uom}
                                      </div>
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  {isOmitted ? (
                                    <span className="text-xs text-slate-400 italic">0 (Omitted)</span>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={row.actualQuantity}
                                        onChange={(e) =>
                                          handleQuantityChange(row.itemCode, Number(e.target.value))
                                        }
                                        className={`w-20 px-2 py-1 rounded-md border text-xs font-mono font-bold text-center focus:outline-hidden focus:border-[#CF0458] ${
                                          hasRowShortfall
                                            ? "border-[#D97706] bg-amber-50/50 text-[#D97706]"
                                            : "border-slate-300 bg-white text-slate-900"
                                        }`}
                                      />
                                      <span className="text-[11px] font-medium text-slate-500 w-8 text-left">
                                        {row.uom}
                                      </span>
                                    </div>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  {(() => {
                                    const itemObj = availableItems.find((i) => i.code === row.itemCode);
                                    const pkg = itemObj ? formatPackagingDisplay(row.availableStock, itemObj) : null;
                                    return (
                                      <div>
                                        <div>{row.availableStock} {row.uom}</div>
                                        {pkg && pkg.type !== "DIRECT" && (
                                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                                            {pkg.primary}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  {isOmitted ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                      Omitted
                                    </span>
                                  ) : hasRowShortfall ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20">
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>
                                        {row.isVariable ? "Shortfall" : `Shortfall: -${(row.actualQuantity - row.availableStock).toFixed(2)}`}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#059669]/20">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>In Stock</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  {row.isIncluded ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRow(row.itemCode)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInclude(row.itemCode)}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold text-[#CF0458] hover:bg-[#CF0458]/10 transition-colors cursor-pointer"
                                    >
                                      Restore
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile & Tablet Card View (< md) */}
                    <div className="md:hidden divide-y divide-slate-100 p-2 space-y-2.5">
                      {dispenseRows.map((row) => {
                        const isOmitted = !row.isIncluded;
                        const hasRowShortfall = isRowShortfall(row);
                        const isModified =
                          row.isIncluded &&
                          !row.isExtra &&
                          row.actualQuantity !== row.standardRequired;
                        const itemObj = availableItems.find((i) => i.code === row.itemCode);
                        const pkg = itemObj ? formatPackagingDisplay(row.availableStock, itemObj) : null;

                        return (
                          <div
                            key={row.itemCode}
                            className={`p-3 rounded-xl border transition-colors ${
                              isOmitted
                                ? "bg-slate-50/70 border-slate-200 opacity-60"
                                : hasRowShortfall
                                ? "bg-amber-50/40 border-amber-300"
                                : "bg-white border-slate-200 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={row.isIncluded}
                                  onChange={() => handleToggleInclude(row.itemCode)}
                                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#CF0458] focus:ring-[#CF0458] cursor-pointer"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-xs font-bold ${
                                        isOmitted ? "line-through text-slate-400" : "text-slate-900"
                                      }`}
                                    >
                                      {row.itemName}
                                    </span>
                                    {row.isExtra && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                        Extra
                                      </span>
                                    )}
                                    {isModified && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                        Adjusted
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {row.itemCode}
                                  </div>
                                  {row.sourceBreakdown && (
                                    <div className="mt-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium">
                                      {row.sourceBreakdown}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isOmitted ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                                    Omitted
                                  </span>
                                ) : hasRowShortfall ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Shortfall</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#059669]/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>In Stock</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] border-t border-slate-100 mt-2">
                              <div>
                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Standard BOM</span>
                                <span className="font-mono font-bold text-slate-800">
                                  {row.isExtra ? "—" : `${row.standardRequired} ${row.uom}`}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Store Balance</span>
                                <span className="font-mono font-bold text-slate-800">{row.availableStock} {row.uom}</span>
                                {pkg && pkg.type !== "DIRECT" && (
                                  <div className="text-[10px] text-slate-400 font-sans">{pkg.primary}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-600">Dispense:</span>
                                {isOmitted ? (
                                  <span className="text-xs text-slate-400 italic">0 (Omitted)</span>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      value={row.actualQuantity}
                                      onChange={(e) => handleQuantityChange(row.itemCode, Number(e.target.value))}
                                      className="w-20 px-2 py-1 rounded-md border border-slate-300 text-xs font-mono font-bold text-center bg-white text-slate-900"
                                    />
                                    <span className="text-[11px] text-slate-500">{row.uom}</span>
                                  </div>
                                )}
                              </div>
                              <div>
                                {row.isIncluded ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveRow(row.itemCode)}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInclude(row.itemCode)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold text-[#CF0458] hover:bg-[#CF0458]/10 transition-colors cursor-pointer"
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

            {/* Table Footer Guidance */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
              <span className="text-[11px]">
                Tip: Uncheck or delete any ingredient you are not issuing for this batch run.
              </span>
              <div className="text-[11px] font-semibold text-slate-700">
                {activeRows.length} item(s) will be deducted from inventory
              </div>
            </div>
          </div>

          {/* Recipient & Shift Lead Sign-off */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Production Supervisor / Recipient
                </label>
                <span className="text-[10px] font-semibold text-[#CF0458] bg-[#CF0458]/10 px-1.5 py-0.5 rounded">
                  Supervisor
                </span>
              </div>
              <div className="space-y-1.5">
                <CustomSelect
                  options={supervisorOptions}
                  value={
                    isCustomRecipient
                      ? "__CUSTOM__"
                      : effectiveSupervisors.some((s) => recipient.includes(s.cleanName))
                      ? effectiveSupervisors.find((s) => recipient.includes(s.cleanName))?.cleanName + " (Production Supervisor)"
                      : recipient
                      ? "__CUSTOM__"
                      : supervisorOptions[0]?.value || ""
                  }
                  onChange={(val) => {
                    if (val === "__CUSTOM__") {
                      setIsCustomRecipient(true);
                      setRecipient("");
                    } else {
                      setIsCustomRecipient(false);
                      setRecipient(val);
                    }
                  }}
                  placeholder="Select production supervisor..."
                  searchPlaceholder="Search supervisor..."
                  size="sm"
                />

                {isCustomRecipient && (
                  <input
                    type="text"
                    required
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Enter recipient name..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900 animate-in fade-in duration-150"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Batch Run Notes / Exceptions
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Dispensed without raisins per supervisor request"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
              />
            </div>
          </div>

              {/* Actions & Submit */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserCheck className="w-4 h-4 text-[#059669]" />
                  <span>Shift verification & store deduction ledger sign-off</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || activeRows.length === 0 || hasShortfalls}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {loading
                        ? "Dispensing Batch..."
                        : `Dispense Batch (${activeRows.length} items)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Datalist for fast recipient auto-complete from DB */}
          <datalist id="staff-recipients-list">
            {availableRecipients.map((r) => (
              <option key={r.id} value={r.label} />
            ))}
          </datalist>
        </form>
      </div>
    </div>
  );
};

