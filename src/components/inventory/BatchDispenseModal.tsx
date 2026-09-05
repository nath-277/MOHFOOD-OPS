"use client";

import React, { useState, useEffect } from "react";
import { ProductRecipe } from "@/server/inventory/store";
import { X, ArrowUpRight, CheckCircle2, AlertTriangle, Scale, UserCheck } from "lucide-react";

interface BatchDispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: ProductRecipe[];
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: () => void;
}

export const BatchDispenseModal: React.FC<BatchDispenseModalProps> = ({
  isOpen,
  onClose,
  recipes,
  shiftType,
  onSuccess,
}) => {
  const [selectedRecipeCode, setSelectedRecipeCode] = useState(recipes[0]?.code || "REC-PARFAIT-400ML");
  const [batchQuantity, setBatchQuantity] = useState<number>(300);
  const [calculation, setCalculation] = useState<any>(null);
  const [recipient, setRecipient] = useState("David Adeleke (Production Supervisor)");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto calculate BOM whenever recipe or quantity changes
  useEffect(() => {
    if (!isOpen || !selectedRecipeCode || batchQuantity <= 0) return;

    let isMounted = true;
    async function fetchBOM() {
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
        if (isMounted) {
          if (res.ok) {
            setCalculation(data.calculation);
          } else {
            setError(data.error);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setCalculating(false);
      }
    }

    fetchBOM();
    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedRecipeCode, batchQuantity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculation?.allAvailable) {
      setError("Cannot dispense batch due to ingredient stock shortfalls.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/inventory/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeCode: selectedRecipeCode,
          batchQuantity: Number(batchQuantity),
          recipient,
          shiftType,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dispensing failed.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to dispense ingredients.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#008153] to-[#006837] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Production Batch Dispensing</h3>
              <p className="text-[11px] text-white/80">
                Recipe Bill of Materials (BOM) guidance & live inventory deduction
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Recipe & Batch Quantity Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Finished Product Recipe
              </label>
              <select
                value={selectedRecipeCode}
                onChange={(e) => setSelectedRecipeCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#008153] bg-slate-50"
              >
                {recipes.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Batch Size Quantity (Units)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  required
                  value={batchQuantity}
                  onChange={(e) => setBatchQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#008153]"
                />
                <div className="flex items-center gap-1">
                  {[100, 200, 300].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setBatchQuantity(q)}
                      className={`px-2 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        batchQuantity === q
                          ? "bg-[#008153] text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Recipe BOM Calculation Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#008153]" />
                <span>Calculated Recipe Bill of Materials (BOM)</span>
              </span>
              <span className="text-[11px] font-bold text-[#008153]">
                {shiftType === "MORNING_SHIFT" ? "Morning Shift Batch" : "Night Shift Batch"}
              </span>
            </div>

            {calculating ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Calculating ingredient requirements...
              </div>
            ) : calculation ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Ingredient / Packaging</th>
                      <th className="py-2.5 px-3 text-right">Required</th>
                      <th className="py-2.5 px-3 text-right">Available in Store</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculation.requiredIngredients.map((ing: any) => (
                      <tr key={ing.itemCode} className="hover:bg-white/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{ing.itemName}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[#D81B60]">
                          {ing.unitRequired} {ing.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {ing.availableStock} {ing.uom}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {ing.isSufficient ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Ready
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              Shortfall: -{ing.shortfall}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

          {/* Recipient & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Production Recipient / Shift Lead
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#008153]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Batch Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. First morning parfait run"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#008153]"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <UserCheck className="w-4 h-4 text-[#008153]" />
              <span>Dual digital acknowledgment recorded</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !calculation?.allAvailable}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#008153] to-[#006837] hover:brightness-105 active:scale-95 transition-all shadow-md shadow-[#008153]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? "Dispensing..." : "Dispense Batch & Deduct Stock"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
