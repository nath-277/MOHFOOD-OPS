"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ProductRecipe, InventoryItem } from "@/server/inventory/store";
import { formatPackagingDisplay, getAvailableUnits, toBaseUnits, fromBaseUnits, getPackagingMultipliers, UnitOption } from "@/lib/packaging";
import { SearchableProductSelect } from "@/components/ui/SearchableProductSelect";
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
} from "lucide-react";

interface BatchDispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: ProductRecipe[];
  availableItems?: InventoryItem[];
  initialRecipeCode?: string;
  initialItemCode?: string;
  initialMode?: "RECIPE" | "INDIVIDUAL";
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
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
  isExtra?: boolean;
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
  projectedNotes?: string;
  isSufficient?: boolean;
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
  const [dispenseMode, setDispenseMode] = useState<"RECIPE" | "INDIVIDUAL">(
    initialMode || (initialItemCode ? "INDIVIDUAL" : "RECIPE")
  );
  const [selectedRecipeCode, setSelectedRecipeCode] = useState(
    initialRecipeCode || recipes[0]?.code || "REC-PARFAIT-400ML"
  );
  const [batchQuantity, setBatchQuantity] = useState<number>(400);
  const [dispenseRows, setDispenseRows] = useState<DispenseRow[]>([]);
  const [recipient, setRecipient] = useState("David Adeleke (Production Supervisor)");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Individual Material Dispense State
  const [individualItemCode, setIndividualItemCode] = useState(
    initialItemCode || availableItems[0]?.code || ""
  );
  const [individualQuantity, setIndividualQuantity] = useState<string>("10");
  const [individualUnitType, setIndividualUnitType] = useState<"RECIPE_UOM" | "CARTON" | "PACK" | "BASE">("BASE");
  const [individualRecipient, setIndividualRecipient] = useState("David Adeleke (Production Floor)");
  const [individualPurpose, setIndividualPurpose] = useState("Direct Production Floor Requisition");
  const [individualNotes, setIndividualNotes] = useState("");

  // Extra Material State
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraItemCode, setExtraItemCode] = useState("");
  const [extraQuantity, setExtraQuantity] = useState<string>("1");

  // Post-Dispatch Physical Count State for Variable Items
  const [showPostDispatch, setShowPostDispatch] = useState(false);
  const [postDispatchItems, setPostDispatchItems] = useState<VariableItemUsage[]>([]);
  const [postDispatchBatchRef, setPostDispatchBatchRef] = useState("");
  const [postDispatchRecipeName, setPostDispatchRecipeName] = useState("");

  // Keep selected recipe code synced with initial prop when opened
  useEffect(() => {
    if (isOpen) {
      if (initialMode) {
        setDispenseMode(initialMode);
      } else if (initialItemCode) {
        setDispenseMode("INDIVIDUAL");
      }
      if (initialItemCode) {
        setIndividualItemCode(initialItemCode);
        const item = availableItems.find((i) => i.code === initialItemCode);
        if (item) {
          if (item.isVariablePack && item.recipeUom) {
            setIndividualUnitType("RECIPE_UOM");
          } else {
            const units = getAvailableUnits(item);
            setIndividualUnitType(units[0]?.type || "BASE");
          }
        }
      } else if (availableItems.length > 0 && !individualItemCode) {
        setIndividualItemCode(availableItems[0].code);
        if (availableItems[0].isVariablePack && availableItems[0].recipeUom) {
          setIndividualUnitType("RECIPE_UOM");
        } else {
          const units = getAvailableUnits(availableItems[0]);
          setIndividualUnitType(units[0]?.type || "BASE");
        }
      }
      if (initialRecipeCode) {
        setSelectedRecipeCode(initialRecipeCode);
      } else if (recipes.length > 0 && !selectedRecipeCode) {
        setSelectedRecipeCode(recipes[0].code);
      }
    } else {
      setShowPostDispatch(false);
      setPostDispatchItems([]);
      setPostDispatchBatchRef("");
      setPostDispatchRecipeName("");
    }
  }, [isOpen, initialMode, initialItemCode, initialRecipeCode, recipes, availableItems, individualItemCode, selectedRecipeCode]);

  // Auto calculate BOM whenever recipe or batch size changes
  const fetchBOM = useCallback(async () => {
    if (!selectedRecipeCode || batchQuantity <= 0) return;
    setCalculating(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/calculate-bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeCode: selectedRecipeCode,
          batchQuantity: Number(batchQuantity),
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
  }, [selectedRecipeCode, batchQuantity]);

  useEffect(() => {
    if (isOpen && selectedRecipeCode && batchQuantity > 0) {
      fetchBOM();
    }
  }, [isOpen, selectedRecipeCode, batchQuantity, fetchBOM]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (dispenseMode === "INDIVIDUAL") {
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
        const activeUnitLabel =
          individualUnitType === "RECIPE_UOM"
            ? (selectedIndividualItem.recipeUom || selectedIndividualItem.uom)
            : (individualAvailableUnits.find((u) => u.type === individualUnitType)?.label ||
               selectedIndividualItem.uom);

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
            recipient: individualRecipient.trim(),
            shiftType,
            purpose: individualPurpose,
            notes: dispenseNotes,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Material dispensing failed.");

        if (isIndividualVariable || data.result?.isVariable) {
          setPostDispatchItems([
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
          ]);
          setPostDispatchBatchRef(data.result?.referenceId || "");
          setPostDispatchRecipeName(`Direct Dispense: ${selectedIndividualItem.name}`);
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
          recipeCode: selectedRecipeCode,
          batchQuantity: Number(batchQuantity),
          recipient: recipient.trim(),
          shiftType,
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
        onSuccess={() => {
          setShowPostDispatch(false);
          onSuccess();
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
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
                    : "Individual Material Direct Dispense"}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {shiftType === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {dispenseMode === "RECIPE"
                  ? "Recipe Bill of Materials (BOM) guidance — modify quantities or exclude items being omitted."
                  : "Issue raw ingredients or packaging directly to floor, QA, or kitchen prep without a full recipe BOM."}
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
            <span>Single Material Direct Dispense</span>
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

          {/* ============================================================ */}
          {/* 1. INDIVIDUAL MATERIAL DISPENSE VIEW */}
          {/* ============================================================ */}
          {dispenseMode === "INDIVIDUAL" && (
            <div className="space-y-4">
              {/* Material Item Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                  Select Material or Packaging Item
                </label>
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
                        const units = getAvailableUnits(item);
                        setIndividualUnitType(units[0]?.type || "BASE");
                      }
                    }
                  }}
                  placeholder="Select material or product..."
                />
              </div>

              {/* Selected Material Card & Live Stock Balance */}
              {selectedIndividualItem && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
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
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {selectedIndividualItem.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-semibold">{selectedIndividualItem.code}</span>
                        <span>•</span>
                        <span>{selectedIndividualItem.storageLocation || "Central Store"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Current Stock</div>
                      <div className="font-mono font-bold text-sm text-slate-900">
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
                </div>
              )}

              {/* Quantity to Dispense & Quick Pickers */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Quantity to Dispense
                  </label>
                  {selectedIndividualItem && (
                    <span className="text-[11px] text-slate-500">
                      Remaining after dispense:{" "}
                      {isIndividualVariable ? (
                        <span className="text-blue-700 font-semibold italic">
                          Confirm remaining {selectedIndividualItem.uom}s in next step
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
                  <div className="flex items-center gap-1.5 pb-1">
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

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={individualQuantity}
                    onChange={(e) => setIndividualQuantity(e.target.value)}
                    placeholder="Enter quantity..."
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    {[1, 5, 10, 25, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setIndividualQuantity(String(num))}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
                        className="px-2 py-1.5 rounded-lg text-xs font-bold bg-[#CF0458]/10 text-[#CF0458] hover:bg-[#CF0458]/20 transition-colors cursor-pointer"
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
                          Next: Confirm Remaining {selectedIndividualItem.uom}s
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
                  <div className="text-[11px] text-red-600 font-bold flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Requested quantity ({individualDeductBase.toLocaleString()} {selectedIndividualItem?.uom}) exceeds available store balance ({selectedIndividualItem?.currentStock} {selectedIndividualItem?.uom})!
                    </span>
                  </div>
                )}
              </div>

              {/* Purpose & Handover Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                    Requisition Purpose
                  </label>
                  <select
                    value={individualPurpose}
                    onChange={(e) => setIndividualPurpose(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
                  >
                    <option value="Direct Production Floor Requisition">Direct Production Floor Requisition</option>
                    <option value="Production Spillage Replacement">Production Spillage Replacement</option>
                    <option value="Recipe Batch Ingredient Top-Up">Recipe Batch Ingredient Top-Up</option>
                    <option value="Quality Control Lab Sampling">Quality Control Lab Sampling</option>
                    <option value="Machine Trial & Calibration">Machine Trial & Calibration</option>
                    <option value="Kitchen Prep & R&D">Kitchen Prep & R&D</option>
                    <option value="Store Material Transfer">Store Material Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                    Recipient / Receiving Floor Officer
                  </label>
                  <input
                    type="text"
                    required
                    value={individualRecipient}
                    onChange={(e) => setIndividualRecipient(e.target.value)}
                    placeholder="e.g. David Adeleke (Production Supervisor)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
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

              {/* Actions & Submit for Individual Mode */}
              <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <UserCheck className="w-4 h-4 text-[#059669]" />
                  <span>Immediate single-item store balance deduction</span>
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
                    disabled={loading || individualShortfall || individualQtyNum <= 0}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {loading
                        ? "Dispensing Material..."
                        : `Dispense ${individualQuantity} ${individualAvailableUnits.find((u) => u.type === individualUnitType)?.label || selectedIndividualItem?.uom || "units"}`}
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
              {/* Recipe & Batch Quantity Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                    Finished Product Recipe
                  </label>
                  <SearchableProductSelect
                    items={recipeOptions}
                    value={selectedRecipeCode}
                    valueKey="code"
                    onChange={(code) => setSelectedRecipeCode(code)}
                    placeholder="Select finished product recipe..."
                    showStock={false}
                  />
                </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Planned Batch Output (Units)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  required
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
                />
                <div className="flex items-center gap-1 shrink-0">
                  {[10, 20, 50, 100].map((addVal) => (
                    <button
                      key={addVal}
                      type="button"
                      onClick={() => setBatchQuantity((prev) => Math.max(1, prev + addVal))}
                      title={`Add +${addVal} to batch output`}
                      className="px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 hover:border-slate-300"
                    >
                      +{addVal}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBatchQuantity(400)}
                    title="Reset to 400 default"
                    className="px-2 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors bg-slate-100 hover:bg-slate-200 text-slate-600"
                  >
                    400
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive BOM Ingredient Table */}
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

            {/* Table */}
            {calculating ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Calculating recipe Bill of Materials...
              </div>
            ) : dispenseRows.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No ingredients found for this recipe.
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                          {/* Include Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={row.isIncluded}
                              onChange={() => handleToggleInclude(row.itemCode)}
                              className="w-4 h-4 rounded border-slate-300 text-[#CF0458] focus:ring-[#CF0458] cursor-pointer"
                            />
                          </td>

                          {/* Name & SKU */}
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
                            {row.isVariable && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Variable Material
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Standard Recipe Amount */}
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

                          {/* Actual Editable Quantity Input */}
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

                          {/* Store Stock Available */}
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

                          {/* Sufficiency Status */}
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

                          {/* Omit or Remove Action */}
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
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Production Recipient / Shift Lead
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
              />
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
        </form>
      </div>
    </div>
  );
};

