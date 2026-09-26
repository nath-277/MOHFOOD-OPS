"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, CheckCircle2, AlertCircle, Pencil, Package, RotateCcw, Layers } from "lucide-react";
import { ProductRecipe } from "@/server/inventory/store";
import { CustomSelect, CustomSelectOption } from "@/components/ui/CustomSelect";

export interface DispatchItemToEdit {
  txId: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  quantity: number; // Dispensed quantity (positive number)
  unit: string;
  notes?: string;
}

export interface EditPendingDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceId: string;
  title?: string;
  recipient?: string;
  notes?: string;
  items: DispatchItemToEdit[];
  recipes?: ProductRecipe[];
  currentRecipeCode?: string;
  currentTargetYield?: number;
  onSuccess: (result?: any) => void;
}

export const EditPendingDispatchModal: React.FC<EditPendingDispatchModalProps> = ({
  isOpen,
  onClose,
  referenceId,
  title,
  recipient: initialRecipient = "",
  notes: initialNotes = "",
  items: initialItems,
  recipes = [],
  currentRecipeCode,
  currentTargetYield,
  onSuccess,
}) => {
  const isBatch = Boolean(
    recipes.length > 0 && (referenceId.startsWith("BATCH-") || currentRecipeCode)
  );

  const [recipient, setRecipient] = useState(initialRecipient);
  const [notes, setNotes] = useState(initialNotes);
  const [selectedRecipeCode, setSelectedRecipeCode] = useState(currentRecipeCode || recipes[0]?.code || "");
  const [targetYield, setTargetYield] = useState<string>(
    String(currentTargetYield || recipes[0]?.yieldQuantity || 1)
  );
  const [displayItems, setDisplayItems] = useState<DispatchItemToEdit[]>(initialItems);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipient(initialRecipient);
      setNotes(initialNotes);
      const initialRecipe = currentRecipeCode || (recipes.length > 0 ? recipes[0].code : "");
      setSelectedRecipeCode(initialRecipe);
      setTargetYield(String(currentTargetYield || (recipes.find((r) => r.code === initialRecipe)?.yieldQuantity || 1)));
      setDisplayItems(initialItems);

      const initialMap: Record<string, string> = {};
      initialItems.forEach((it) => {
        initialMap[it.txId] = String(it.quantity);
      });
      setQuantities(initialMap);
      setError(null);
    }
  }, [isOpen, initialRecipient, initialNotes, initialItems, currentRecipeCode, currentTargetYield, recipes]);

  const recipeOptions: CustomSelectOption[] = useMemo(() => {
    return recipes.map((r) => ({
      value: r.code,
      label: r.name,
      sublabel: `Formula Yield: ${r.yieldQuantity} ${r.yieldUnit || "units"} • ${r.ingredients.length} materials`,
      badge: r.code,
    }));
  }, [recipes]);

  const selectedRecipeObj = useMemo(() => {
    return recipes.find((r) => r.code === selectedRecipeCode);
  }, [recipes, selectedRecipeCode]);

  const handleRecipeChange = (newCode: string) => {
    setSelectedRecipeCode(newCode);
    const rec = recipes.find((r) => r.code === newCode);
    if (!rec) return;

    const yieldNum = Number(targetYield) > 0 ? Number(targetYield) : rec.yieldQuantity;
    const factor = yieldNum / rec.yieldQuantity;

    const newItems: DispatchItemToEdit[] = rec.ingredients.map((ing) => ({
      txId: `temp-${ing.itemCode}`,
      itemId: ing.itemCode,
      itemCode: ing.itemCode,
      itemName: ing.itemName,
      quantity: Number((ing.quantityRequired * factor).toFixed(3)),
      unit: ing.uom || "kg",
    }));

    setDisplayItems(newItems);
    const newQuantities: Record<string, string> = {};
    newItems.forEach((it) => {
      newQuantities[it.txId] = String(it.quantity);
    });
    setQuantities(newQuantities);
  };

  const handleTargetYieldChange = (val: string) => {
    setTargetYield(val);
    const numYield = Number(val);
    if (!numYield || numYield <= 0) return;

    const rec = recipes.find((r) => r.code === selectedRecipeCode);
    if (!rec) return;

    const factor = numYield / rec.yieldQuantity;

    const newItems: DispatchItemToEdit[] = rec.ingredients.map((ing) => ({
      txId: `temp-${ing.itemCode}`,
      itemId: ing.itemCode,
      itemCode: ing.itemCode,
      itemName: ing.itemName,
      quantity: Number((ing.quantityRequired * factor).toFixed(3)),
      unit: ing.uom || "kg",
    }));

    setDisplayItems(newItems);
    const newQuantities: Record<string, string> = {};
    newItems.forEach((it) => {
      newQuantities[it.txId] = String(it.quantity);
    });
    setQuantities(newQuantities);
  };

  const handleQtyChange = (txId: string, val: string) => {
    setQuantities((prev) => ({
      ...prev,
      [txId]: val,
    }));
  };

  const handleResetItem = (txId: string, originalQty: number) => {
    setQuantities((prev) => ({
      ...prev,
      [txId]: String(originalQty),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const itemsPayload = displayItems.map((it) => {
        const raw = quantities[it.txId];
        const qtyNum = raw !== undefined && raw !== "" ? Math.max(0, Number(raw)) : it.quantity;
        return {
          txId: it.txId.startsWith("temp-") ? undefined : it.txId,
          itemId: it.itemId,
          itemCode: it.itemCode,
          quantity: qtyNum,
        };
      });

      const bodyPayload: any = {
        items: itemsPayload,
        recipient: recipient.trim(),
        notes: notes.trim(),
      };

      if (isBatch && selectedRecipeCode) {
        bodyPayload.recipeCode = selectedRecipeCode;
        bodyPayload.targetYield = Number(targetYield) || 1;
      }

      const res = await fetch(`/api/inventory/dispatches/${encodeURIComponent(referenceId)}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update pending dispatch.");
      }

      onSuccess(data.result);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update pending dispatch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                Shift Handover
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                Ref: {referenceId}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              Edit Dispatch
            </h3>
            {title && (
              <p className="text-xs text-slate-500 font-medium mt-0.5">{title}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Batch Recipe & Yield Controls */}
          {isBatch && recipes.length > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  Recipe Formulation & Target Yield
                </label>
                {currentRecipeCode && selectedRecipeCode !== currentRecipeCode && (
                  <button
                    type="button"
                    onClick={() => handleRecipeChange(currentRecipeCode)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                  >
                    Reset Formula
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <CustomSelect
                    options={recipeOptions}
                    value={selectedRecipeCode}
                    onChange={handleRecipeChange}
                    placeholder="Select recipe formula..."
                    searchPlaceholder="Search recipe..."
                    size="sm"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={targetYield}
                      onChange={(e) => handleTargetYieldChange(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-right focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
                      placeholder="Target yield"
                    />
                    <span className="text-xs font-semibold text-slate-600 shrink-0">
                      {selectedRecipeObj?.yieldUnit || "units"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recipient & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Floor Recipient
              </label>
              <input
                type="text"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Recipient name..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Modification Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for change..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100/80 px-4 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between border-b border-slate-200">
              <span>Dispatched Materials ({displayItems.length})</span>
              <span className="text-[10px] font-normal text-slate-500">
                Adjust quantities before shift sign-off
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {displayItems.map((item) => {
                const currentVal = quantities[item.txId] ?? String(item.quantity);
                const currentNum = Number(currentVal) || 0;
                const delta = Number((currentNum - item.quantity).toFixed(3));

                return (
                  <div
                    key={item.txId}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{item.itemName}</div>
                        <div className="text-[11px] text-slate-500">
                          Formula BOM: <strong className="font-mono text-slate-700">{item.quantity} {item.unit}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={currentVal}
                          onChange={(e) => handleQtyChange(item.txId, e.target.value)}
                          className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-right focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
                        />
                        <span className="text-xs font-medium text-slate-500 w-12">{item.unit}</span>
                      </div>

                      {/* Delta badge */}
                      {delta !== 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            delta > 0
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </span>
                      )}

                      {/* Reset button */}
                      {delta !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleResetItem(item.txId, item.quantity)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Reset to recipe quantity"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            ℹ️ <strong>Inventory Note:</strong> Changing formula restores previous dispatches and allocates new recipe ingredients. Reducing quantities returns stock to central storage.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Saving Changes..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
