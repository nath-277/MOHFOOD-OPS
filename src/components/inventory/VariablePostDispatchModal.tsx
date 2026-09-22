"use client";

import React, { useState } from "react";
import { CheckCircle2, X, PackageCheck, AlertCircle } from "lucide-react";

export interface VariableItemUsage {
  id?: string;
  code: string;
  name: string;
  currentStock: number;
  uom: string;
  recipeUom?: string;
  quantityDispensed?: number;
  dispensedUom?: string;
}

interface VariablePostDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  variableItems: VariableItemUsage[];
  batchReference?: string;
  recipeName?: string;
  onSuccess?: () => void;
  mode?: "DISPATCH" | "RETURN";
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT";
  recipient?: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
}

export const VariablePostDispatchModal: React.FC<VariablePostDispatchModalProps> = ({
  isOpen,
  onClose,
  variableItems,
  batchReference,
  recipeName,
  onSuccess,
  mode = "DISPATCH",
  shiftType = "MORNING_SHIFT",
  recipient,
  title,
  subtitle,
  actionLabel,
}) => {
  const isReturn = mode === "RETURN";
  const displayTitle = title || (isReturn ? "Confirm Updated Store Stock" : "Confirm Remaining Stock");
  const displaySubtitle =
    subtitle ||
    (isReturn
      ? "Material return was recorded. Enter the new physical amount remaining in storage units."
      : "Batch was dispatched. Enter the new physical amount remaining in storage units.");
  const displayActionLabel = actionLabel || (isReturn ? "Returned" : "Gave out");
  const quickDeltas = isReturn ? [0.25, 0.5, 1, 2] : [-0.1, -0.25, -0.5, -1];

  // Initialize state map of new remaining stock for each item directly from current physical stock
  const [newStockValues, setNewStockValues] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {};
    for (const item of variableItems) {
      initial[item.code] = item.currentStock !== undefined ? item.currentStock : "";
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || variableItems.length === 0) return null;

  const handleStockChange = (code: string, value: string) => {
    setNewStockValues((prev) => ({
      ...prev,
      [code]: value,
    }));
  };

  const handleQuickAdjust = (code: string, delta: number, current: number) => {
    setNewStockValues((prev) => {
      const existing = prev[code] !== "" && prev[code] !== undefined ? Number(prev[code]) : current;
      const updated = Math.max(0, Number((existing + delta).toFixed(2)));
      return {
        ...prev,
        [code]: updated,
      };
    });
  };

  const handleMarkEmpty = (code: string) => {
    setNewStockValues((prev) => ({
      ...prev,
      [code]: 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updates = variableItems.map((item) => {
        const rawVal = newStockValues[item.code];
        const newStock = rawVal !== "" && rawVal !== undefined ? Number(rawVal) : item.currentStock;
        const dispUom = item.dispensedUom || item.recipeUom || item.uom;
        const opLabel = isReturn ? "Return" : "Batch";

        return {
          itemCode: item.code,
          newStock: Number(newStock) >= 0 ? Number(newStock) : 0,
          previousStock: item.currentStock,
          dispatchQuantity: item.quantityDispensed,
          dispatchUom: dispUom,
          storageUom: item.uom,
          referenceId: batchReference,
          notes: `Physical stock confirmation: remaining ${newStock} ${item.uom}. (${opLabel} ${batchReference || (isReturn ? "return" : "dispatch")}: ${displayActionLabel} ${item.quantityDispensed || 0} ${dispUom})`,
        };
      });

      const res = await fetch("/api/inventory/items/update-floor-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates,
          shiftType,
          recipient,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update remaining stock.");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save updated stock levels.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {displayTitle}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Variable Materials
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {displaySubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {variableItems.map((item) => {
              const currentVal = newStockValues[item.code];
              const dispUom = item.dispensedUom || item.recipeUom || item.uom;

              return (
                <div
                  key={item.code}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  {/* Material summary header */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{item.name}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                        <span>
                          {displayActionLabel}:{" "}
                          <strong className="text-slate-900 font-mono font-bold">
                            {item.quantityDispensed} {dispUom}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Previous stock:{" "}
                          <strong className="text-slate-800 font-mono">
                            {item.currentStock} {item.uom}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMarkEmpty(item.code)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer font-medium"
                    >
                      Empty (0)
                    </button>
                  </div>

                  {/* Single Clean Input: New Amount Left in Stock */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      New Amount Left in Stock ({item.uom}):
                    </label>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={currentVal}
                          onChange={(e) => handleStockChange(item.code, e.target.value)}
                          placeholder={String(item.currentStock)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#CF0458] focus:ring-1 focus:ring-[#CF0458]"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 shrink-0">
                        {item.uom}
                      </span>
                    </div>

                    {/* Quick nudge adjustment buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-400 font-medium mr-1">Quick adjust:</span>
                      {quickDeltas.map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => handleQuickAdjust(item.code, delta, item.currentStock)}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-mono font-semibold text-slate-700 transition-colors cursor-pointer"
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </button>
                      ))}
                    </div>

                    {Number(currentVal) === item.currentStock && (item.quantityDispensed || 0) > 0 && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/70 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Stock is currently unchanged ({item.currentStock} {item.uom}). If this container was opened or partially scooped out, you can enter fractional units (e.g. 0.9 {item.uom}) to reflect the portion taken.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
            >
              Skip / Keep Current
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? "Updating Stock..." : isReturn ? "Confirm Updated Stock" : "Confirm Remaining Stock"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
