"use client";

import React, { useState } from "react";
import { CheckCircle2, X, PackageCheck, AlertCircle, Sparkles, Scale } from "lucide-react";

export interface VariableItemUsage {
  id?: string;
  code: string;
  name: string;
  currentStock: number;
  uom: string;
  packUnit?: string | null;
  inUseQuantity?: number;
  inUseRemainingPortions?: number;
  recipeUom?: string;
  portionsPerContainer?: number;
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
}

interface ItemFloorState {
  sealedTaken: number;
  inUseQuantity: number;
  inUseRemainingPortions: number | string;
}

export const VariablePostDispatchModal: React.FC<VariablePostDispatchModalProps> = ({
  isOpen,
  onClose,
  variableItems,
  batchReference,
  recipeName,
  onSuccess,
}) => {
  // Initialize state map for each variable item
  const [itemStates, setItemStates] = useState<Record<string, ItemFloorState>>(() => {
    const initial: Record<string, ItemFloorState> = {};
    for (const item of variableItems) {
      initial[item.code] = {
        sealedTaken: 0,
        inUseQuantity: item.inUseQuantity !== undefined && item.inUseQuantity > 0 ? item.inUseQuantity : 1,
        inUseRemainingPortions: item.inUseRemainingPortions !== undefined ? item.inUseRemainingPortions : "",
      };
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || variableItems.length === 0) return null;

  const handleStateChange = (code: string, field: keyof ItemFloorState, value: any) => {
    setItemStates((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [field]: value,
      },
    }));
  };

  const handleMarkEmptied = (code: string) => {
    setItemStates((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        inUseQuantity: 0,
        inUseRemainingPortions: 0,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updates = variableItems.map((item) => {
        const state = itemStates[item.code] || {
          sealedTaken: 0,
          inUseQuantity: 1,
          inUseRemainingPortions: 0,
        };

        return {
          itemCode: item.code,
          sealedContainersTaken: Number(state.sealedTaken) || 0,
          inUseQuantity: Number(state.inUseQuantity) || 0,
          inUseRemainingPortions: Number(state.inUseRemainingPortions) || 0,
          referenceId: batchReference,
          notes: `Batch ${batchReference || "dispatch"} floor update for ${item.name}`,
        };
      });

      const res = await fetch("/api/inventory/items/update-floor-levels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update variable floor quantities.");
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save floor quantities.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  Confirm Variable Material Floor Levels
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Physical Count
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Batch was dispatched. Enter actual physical floor stock for the multi-use ingredients used (no guesswork).
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
              const state = itemStates[item.code] || {
                sealedTaken: 0,
                inUseQuantity: 1,
                inUseRemainingPortions: 0,
              };
              const containerLabel = item.packUnit || item.uom || "container";
              const portionLabel = item.recipeUom || item.uom || "portions";

              return (
                <div
                  key={item.code}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  {/* Item header info */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{item.name}</span>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                          {item.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>
                          Dished for batch:{" "}
                          <strong className="text-slate-800 font-mono font-bold">
                            {item.quantityDispensed} {item.dispensedUom}
                          </strong>
                        </span>
                        <span>•</span>
                        <span>
                          Sealed in warehouse:{" "}
                          <strong className="text-slate-700 font-mono">
                            {item.currentStock} {containerLabel}(s)
                          </strong>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleMarkEmptied(item.code)}
                      className="text-[11px] px-2 py-1 rounded-md bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer font-medium"
                    >
                      Mark Emptied (0)
                    </button>
                  </div>

                  {/* Physical Count Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                    {/* 1. Sealed Containers Taken */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Sealed Taken from Store:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={state.sealedTaken}
                          onChange={(e) =>
                            handleStateChange(item.code, "sealedTaken", Math.max(0, Number(e.target.value)))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
                        />
                        <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                          {containerLabel}(s)
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">
                        0 if used from existing open pack
                      </span>
                    </div>

                    {/* 2. Containers Active on Floor */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Open on Floor Now:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          required
                          value={state.inUseQuantity}
                          onChange={(e) =>
                            handleStateChange(item.code, "inUseQuantity", Math.max(0, Number(e.target.value)))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
                        />
                        <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                          active
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">
                        Usually 1, or 0 if completely finished
                      </span>
                    </div>

                    {/* 3. Portions Remaining in Open Container */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Estimated Left in Pack:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={state.inUseRemainingPortions}
                          onChange={(e) =>
                            handleStateChange(item.code, "inUseRemainingPortions", e.target.value)
                          }
                          placeholder={item.portionsPerContainer ? String(item.portionsPerContainer) : "0"}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
                        />
                        <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                          {portionLabel}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5 block">
                        e.g. 133 pcs, 35 cups, 400 ml
                      </span>
                    </div>
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
              Skip / Keep Previous
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-60 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? "Saving Floor Stock..." : "Confirm Floor Quantities"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
