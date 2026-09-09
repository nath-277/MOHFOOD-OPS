"use client";

import React, { useState, useEffect } from "react";
import { RetailStockist } from "@/server/management/store";
import { X, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";

interface RecordSoRReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockists: RetailStockist[];
  onSuccess: () => void;
}

export const RecordSoRReturnModal: React.FC<RecordSoRReturnModalProps> = ({
  isOpen,
  onClose,
  stockists,
  onSuccess,
}) => {
  const [stockistId, setStockistId] = useState(stockists[0]?.id || "");
  const [quantityReturned, setQuantityReturned] = useState<string>("5");
  const [reason, setReason] = useState<"EXPIRED_ON_SHELF" | "BROKEN_SEAL" | "COLD_CHAIN_FAILURE" | "DAMAGED">("EXPIRED_ON_SHELF");
  const [receivedBy, setReceivedBy] = useState("Sunday B. (Van 1)");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stockists.length > 0 && !stockistId) {
      setStockistId(stockists[0].id);
    }
  }, [stockists, stockistId]);

  if (!isOpen) return null;

  const selectedStockist = stockists.find((s) => s.id === stockistId);
  const creditValue = (Number(quantityReturned) || 0) * (selectedStockist?.standardUnitPrice || 2000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockistId || Number(quantityReturned) <= 0) {
      setError("Please select a supermarket and specify a returned quantity greater than 0.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/management/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockistId,
          quantityReturned: Number(quantityReturned),
          reason,
          receivedBy: receivedBy.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record return.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record return.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#CF0458]">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Record Sale or Return (SoR)
            </h3>
            <p className="text-xs text-slate-500">
              Log shelf returns, issue credit note, and adjust net sold invoice balance
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-amber-50 border border-[#D97706]/30 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Stockist */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Retail Supermarket Stockist
            </label>
            <select
              value={stockistId}
              onChange={(e) => setStockistId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-slate-50 text-slate-900"
            >
              {stockists.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (Debt: ₦{s.outstandingDebt.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Returned Units
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantityReturned}
                onChange={(e) => setQuantityReturned(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Return Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-slate-50 text-slate-900"
              >
                <option value="EXPIRED_ON_SHELF">Expired on Shelf</option>
                <option value="BROKEN_SEAL">Damaged / Broken Seal</option>
                <option value="COLD_CHAIN_FAILURE">Cold Chain Temperature Spoilage</option>
                <option value="DAMAGED">Customer Return / Crushed</option>
              </select>
            </div>
          </div>

          {/* Credit Note Amount */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Automatic Credit Adjustment
            </label>
            <div className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-600">Credit to apply on outstanding debt:</span>
              <span className="font-mono font-bold text-[#059669]">
                - ₦ {creditValue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Driver & Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Retrieved By Driver / Staff
            </label>
            <input
              type="text"
              required
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Return Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 5 units retrieved from shelf cold room"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Recording..." : "Apply Credit & Record Return"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
