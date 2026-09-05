"use client";

import React, { useState, useEffect } from "react";
import { ProductRecipe } from "@/server/inventory/store";
import { EquipmentItem } from "@/server/production/store";
import {
  X,
  ClipboardList,
  Sparkles,
  Sun,
  Moon,
  AlertCircle,
  Save,
  Boxes,
} from "lucide-react";

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  equipment: EquipmentItem[];
}

export function CreateWorkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  equipment,
}: CreateWorkOrderModalProps) {
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [selectedRecipeCode, setSelectedRecipeCode] = useState("");
  const [targetQuantity, setTargetQuantity] = useState<number>(300);
  const [shiftType, setShiftType] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [mixingTankId, setMixingTankId] = useState("");
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
            setSelectedRecipeCode(data.recipes[0].code);
          }
        })
        .catch((err) => console.error("Failed to load recipes:", err));

      if (equipment.length > 0) {
        setMixingTankId(equipment[0].id);
      }
    }
  }, [isOpen, equipment]);

  if (!isOpen) return null;

  const selectedRecipe = recipes.find((r) => r.code === selectedRecipeCode);
  const selectedEquipment = equipment.find((e) => e.id === mixingTankId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedRecipeCode) {
      setError("Please select a product formulation.");
      return;
    }
    if (!targetQuantity || Number(targetQuantity) <= 0) {
      setError("Target batch quantity must be greater than 0.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/production/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeCode: selectedRecipeCode,
          recipeName: selectedRecipe?.name,
          targetQuantity: Number(targetQuantity),
          shiftType,
          mixingTankId: selectedEquipment?.id || "eq-01",
          mixingTankName: selectedEquipment?.name || "Mixing Tank #1",
          batchReference: batchReference.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[#8E1538]">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Schedule Production Work Order</h3>
              <p className="text-[11px] text-slate-500">Initiate a batch run for the mixing & packaging line.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
          {/* Recipe Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Product Recipe / Formulation
            </label>
            <select
              value={selectedRecipeCode}
              onChange={(e) => setSelectedRecipeCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
            >
              {recipes.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Target Quantity */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Target Output Units
              </label>
              <input
                type="number"
                min={1}
                value={targetQuantity}
                onChange={(e) => setTargetQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Finished packaged units</span>
            </div>

            {/* Mixing Equipment */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Assigned Mixing Line
              </label>
              <select
                value={mixingTankId}
                onChange={(e) => setMixingTankId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              >
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
            </div>
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
                    ? "bg-[#8E1538] text-white border-[#8E1538] shadow-xs"
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
                    ? "bg-[#8E1538] text-white border-[#8E1538] shadow-xs"
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
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
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
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white font-bold shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? "Scheduling..." : "Schedule Work Order"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
