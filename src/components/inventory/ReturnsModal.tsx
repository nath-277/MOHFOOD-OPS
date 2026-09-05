"use client";

import React, { useState } from "react";
import { InventoryItem } from "@/server/inventory/store";
import { X, RotateCcw, AlertOctagon, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";

interface ReturnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: () => void;
}

export const ReturnsModal: React.FC<ReturnsModalProps> = ({
  isOpen,
  onClose,
  items,
  shiftType,
  onSuccess,
}) => {
  const [returnMode, setReturnMode] = useState<"FAULT" | "EXCESS">("FAULT");
  const [selectedCode, setSelectedCode] = useState(items[0]?.code || "");
  const [quantity, setQuantity] = useState<string>("");
  const [faultReason, setFaultReason] = useState("Factory defective packaging (cracked cup seam)");
  const [conditionNotes, setConditionNotes] = useState("Cold chain temperature intact, unmixed clean ingredients");
  const [recipient, setRecipient] = useState("Production Shift (Floor)");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.code === selectedCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) {
      setError("Please specify a valid quantity.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = returnMode === "FAULT" ? "/api/inventory/returns/fault" : "/api/inventory/returns/excess";
      const payload =
        returnMode === "FAULT"
          ? {
              itemCode: selectedCode,
              quantity: Number(quantity),
              faultReason,
              recipient,
              shiftType,
            }
          : {
              itemCode: selectedCode,
              quantity: Number(quantity),
              conditionNotes,
              recipient,
              shiftType,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process return.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Return operation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`p-5 text-white flex items-center justify-between transition-colors ${
            returnMode === "FAULT"
              ? "bg-gradient-to-r from-red-600 to-rose-700"
              : "bg-gradient-to-r from-blue-600 to-indigo-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Production Return Desk</h3>
              <p className="text-[11px] text-white/80">
                {returnMode === "FAULT"
                  ? "Defective Item Return & Immediate Replacement"
                  : "Unused Excess Return & Stock Re-entry"}
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setReturnMode("FAULT")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              returnMode === "FAULT"
                ? "bg-white text-red-700 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
            <span>Fault Return & Replace</span>
          </button>

          <button
            type="button"
            onClick={() => setReturnMode("EXCESS")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              returnMode === "EXCESS"
                ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Excess Ingredient Restock</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Returned Material Item
            </label>
            <select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50"
            >
              {items.map((i) => (
                <option key={i.code} value={i.code}>
                  [{i.category.replace("_", " ")}] {i.name} ({i.uom})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Unit */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Quantity Returned ({currentItem?.uom || "units"})
              </label>
              {returnMode === "FAULT" && (
                <span className="text-[11px] text-slate-400">
                  Available in store to replace: <strong className="text-[#008153]">{currentItem?.currentStock}</strong> {currentItem?.uom}
                </span>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0.001"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Specific Mode Fields */}
          {returnMode === "FAULT" ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Defect / Spoilage Reason
              </label>
              <select
                value={faultReason}
                onChange={(e) => setFaultReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50"
              >
                <option value="Factory defective packaging (cracked cup seam)">
                  Factory defective packaging (cracked cup/dome seam)
                </option>
                <option value="Packaging seal compromised / torn foil">
                  Packaging seal compromised / torn foil
                </option>
                <option value="Contaminated / off-odor fruit delivery">
                  Contaminated / off-odor fruit delivery
                </option>
                <option value="Production line drop / spillage damage">
                  Production line drop / spillage damage
                </option>
                <option value="Misprinted label or missing NAFDAC reg mark">
                  Misprinted label or missing NAFDAC reg mark
                </option>
              </select>
              <p className="text-[11px] text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Immediate replacement will be issued from store stock and logged as scrap.</span>
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Sanitary Inspection & Condition Verification
              </label>
              <input
                type="text"
                required
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="e.g. Clean, unmixed, temperature intact"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-blue-600 mt-1.5 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ingredients will be verified and incremented back into active store inventory.</span>
              </p>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Production Floor Handover Representative
            </label>
            <input
              type="text"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                returnMode === "FAULT"
                  ? "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {loading
                  ? "Processing..."
                  : returnMode === "FAULT"
                  ? "Replace & Scrap Fault"
                  : "Restock to Inventory"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
