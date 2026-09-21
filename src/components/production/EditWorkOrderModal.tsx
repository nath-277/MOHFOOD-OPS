"use client";

import React, { useState, useEffect } from "react";
import { WorkOrder } from "@/server/production/store";
import { ProductRecipe } from "@/server/inventory/store";
import {
  X,
  Pencil,
  Sun,
  Moon,
  AlertCircle,
  Save,
  Calendar,
} from "lucide-react";

interface EditWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order: WorkOrder | null;
}

export function EditWorkOrderModal({
  isOpen,
  onClose,
  onSuccess,
  order,
}: EditWorkOrderModalProps) {
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [selectedRecipeCode, setSelectedRecipeCode] = useState("");
  const [targetQuantity, setTargetQuantity] = useState<number>(400);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [shiftType, setShiftType] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && order) {
      setError(null);
      setSelectedRecipeCode(order.recipeCode);
      setTargetQuantity(order.targetQuantity);
      setScheduledDate(order.scheduledDate || new Date().toISOString().slice(0, 10));
      setShiftType(order.shiftType);
      setNotes(order.notes || "");

      fetch("/api/inventory/recipes")
        .then((res) => res.json())
        .then((data) => {
          if (data.recipes && data.recipes.length > 0) {
            setRecipes(data.recipes);
          }
        })
        .catch((err) => console.error("Failed to load recipes:", err));
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const selectedRecipe = recipes.find((r) => r.code === selectedRecipeCode);

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
      const res = await fetch(`/api/production/work-orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeCode: selectedRecipeCode,
          recipeName: selectedRecipe?.name || order.recipeName,
          targetQuantity: Number(targetQuantity),
          scheduledDate: scheduledDate || order.scheduledDate,
          shiftType,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update work order.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update work order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Edit Production Work Order</h3>
              <p className="text-[11px] text-slate-500 font-mono">{order.orderNumber}</p>
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
          {/* Recipe Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Product Recipe / Formulation
            </label>
            <select
              value={selectedRecipeCode}
              onChange={(e) => setSelectedRecipeCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
            >
              {recipes.length > 0 ? (
                recipes.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))
              ) : (
                <option value={order.recipeCode}>
                  {order.recipeName} ({order.recipeCode})
                </option>
              )}
            </select>
          </div>

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
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
            />
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

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Production Notes / Specifications
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extra crisp topping, brix target 14%."
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
              <span>{loading ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
