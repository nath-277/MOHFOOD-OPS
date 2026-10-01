"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ProductRecipe } from "@/server/inventory/store";
import { EquipmentItem } from "@/server/production/store";
import { CustomSelect, CustomSelectOption } from "@/components/ui/CustomSelect";
import {
  X,
  ClipboardList,
  Sun,
  Moon,
  AlertCircle,
  Save,
  Boxes,
  Calendar,
  Plus,
  Trash2,
} from "lucide-react";

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment?: EquipmentItem[];
}

interface RecipeSelectionItem {
  id: string;
  recipeCode: string;
  targetQuantity: number;
}

export function CreateWorkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  equipment = [],
}: CreateWorkOrderModalProps) {
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeSelectionItem[]>([
    { id: "item-1", recipeCode: "", targetQuantity: 400 },
  ]);
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [shiftType, setShiftType] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [batchReference, setBatchReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetch("/api/inventory/recipes")
        .then((res) => res.json())
        .then((data) => {
          if (data.recipes && data.recipes.length > 0) {
            setRecipes(data.recipes);
            const firstRec = data.recipes[0];
            setRecipeItems([
              {
                id: "item-1",
                recipeCode: firstRec.code,
                targetQuantity: firstRec.yieldQuantity || 400,
              },
            ]);
          }
        })
        .catch((err) => console.error("Failed to load recipes:", err));
    }
  }, [isOpen]);

  const recipeSelectOptions = useMemo<CustomSelectOption[]>(() => {
    return recipes.map((r) => ({
      value: r.code,
      label: r.name,
      sublabel: `${r.code} • Default Yield: ${r.yieldQuantity || 400} ${r.yieldUnit || "pcs"}`,
      badge: `${r.yieldQuantity || 400} ${r.yieldUnit || "pcs"}`,
    }));
  }, [recipes]);

  if (!isOpen) return null;

  const handleAddRecipeItem = () => {
    const unusedRecipe = recipes.find(
      (r) => !recipeItems.some((item) => item.recipeCode === r.code)
    );
    const chosenRec = unusedRecipe || recipes[0];
    setRecipeItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        recipeCode: chosenRec ? chosenRec.code : "",
        targetQuantity: chosenRec?.yieldQuantity || 400,
      },
    ]);
  };

  const handleRemoveRecipeItem = (id: string) => {
    if (recipeItems.length <= 1) return;
    setRecipeItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSelectRecipe = (id: string, newRecipeCode: string) => {
    const chosenRec = recipes.find((r) => r.code === newRecipeCode);
    setRecipeItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              recipeCode: newRecipeCode,
              targetQuantity: chosenRec?.yieldQuantity || item.targetQuantity || 400,
            }
          : item
      )
    );
  };

  const handleUpdateRecipeItem = (id: string, updates: Partial<RecipeSelectionItem>) => {
    setRecipeItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const totalPlannedUnits = recipeItems.reduce(
    (sum, item) => sum + (Number(item.targetQuantity) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < recipeItems.length; i++) {
      const item = recipeItems[i];
      if (!item.recipeCode) {
        setError(`Formulation #${i + 1} has no recipe selected.`);
        return;
      }
      if (!item.targetQuantity || Number(item.targetQuantity) <= 0) {
        setError(`Target quantity for formulation #${i + 1} must be greater than 0.`);
        return;
      }
    }

    try {
      setLoading(true);
      const payload = {
        recipes: recipeItems.map((item) => {
          const rec = recipes.find((r) => r.code === item.recipeCode);
          return {
            recipeCode: item.recipeCode,
            recipeName: rec?.name || item.recipeCode,
            targetQuantity: Number(item.targetQuantity),
          };
        }),
        scheduledDate: scheduledDate || new Date().toISOString().slice(0, 10),
        shiftType,
        mixingTankId: "production-line",
        mixingTankName: "Production Floor",
        batchReference: batchReference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/production/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create work order.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to schedule work order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-4 sm:p-5 space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1 shrink-0" />
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[#CF0458]">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Schedule Production Work Orders</h3>
              <p className="text-[11px] text-slate-500">
                Schedule single or multiple formulations for batch mixing & packaging.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Multi-Recipe Formulation List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-[#CF0458]" />
                <span>Product Formulations & Output Targets</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-[#CF0458] bg-[#CF0458]/10 px-2 py-0.5 rounded-full">
                  {recipeItems.length} {recipeItems.length === 1 ? "Recipe" : "Recipes"} • {totalPlannedUnits.toLocaleString()} Total Units
                </span>
                <button
                  type="button"
                  onClick={handleAddRecipeItem}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#CF0458]" />
                  <span>Add Recipe</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
              {recipeItems.map((item, index) => {
                const itemRec = recipes.find((r) => r.code === item.recipeCode);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs"
                  >
                    <span className="w-5 text-center font-bold text-slate-400 text-[10px] shrink-0">
                      #{index + 1}
                    </span>

                    {/* Formulation Dropdown with CustomSelect */}
                    <div className="flex-1 min-w-[220px]">
                      <CustomSelect
                        options={recipeSelectOptions}
                        value={item.recipeCode}
                        onChange={(val) => handleSelectRecipe(item.id, val)}
                        placeholder="Select formulation..."
                        searchPlaceholder="Search formulation name or code..."
                        size="sm"
                      />
                    </div>

                    {/* Output Units */}
                    <div className="w-28 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          value={item.targetQuantity}
                          onChange={(e) =>
                            handleUpdateRecipeItem(item.id, {
                              targetQuantity: Number(e.target.value),
                            })
                          }
                          className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:bg-white focus:border-[#CF0458] focus:outline-hidden text-right text-xs"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold pointer-events-none">
                          {itemRec?.yieldUnit || "pcs"}
                        </span>
                      </div>
                    </div>

                    {/* Delete button if more than 1 item */}
                    {recipeItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        title="Remove formulation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scheduled Date Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#CF0458]" />
              <span>Scheduled Production Date</span>
            </label>
            <input
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-semibold focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Orders scheduled for future dates will lock floor execution until that day.
            </span>
          </div>

          {/* Shift Selection */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Production Shift
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShiftType("MORNING_SHIFT")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                  shiftType === "MORNING_SHIFT"
                    ? "bg-[#CF0458] text-white border-[#CF0458] shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Morning (08:00 - 18:00)</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("NIGHT_SHIFT")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold transition-all cursor-pointer ${
                  shiftType === "NIGHT_SHIFT"
                    ? "bg-[#CF0458] text-white border-[#CF0458] shadow-xs"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Night (18:00 - 08:00)</span>
              </button>
            </div>
          </div>

          {/* Optional Batch Reference */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Linked Store Batch Reference (Optional)
            </label>
            <input
              type="text"
              value={batchReference}
              onChange={(e) => setBatchReference(e.target.value)}
              placeholder="e.g. BATCH-PRF-0905-A"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Production Notes / Specifications
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extra crisp granola topping layer, target brix level 14%."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white font-bold shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {loading
                  ? "Scheduling..."
                  : `Schedule ${recipeItems.length > 1 ? `${recipeItems.length} Work Orders` : "Work Order"}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
