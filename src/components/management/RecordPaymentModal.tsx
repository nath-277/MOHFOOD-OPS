"use client";

import React, { useState, useEffect } from "react";
import { RetailStockist } from "@/server/management/store";
import { X, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockists: RetailStockist[];
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  stockists,
  onSuccess,
}) => {
  const [stockistId, setStockistId] = useState(stockists[0]?.id || "");
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "CHEQUE" | "CASH">("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stockists.length > 0 && !stockistId) {
      setStockistId(stockists[0].id);
      setAmount(String(stockists[0].outstandingDebt));
    }
  }, [stockists, stockistId]);

  useEffect(() => {
    const s = stockists.find((st) => st.id === stockistId);
    if (s) {
      setAmount(String(s.outstandingDebt));
    }
  }, [stockistId, stockists]);

  if (!isOpen) return null;

  const selectedStockist = stockists.find((s) => s.id === stockistId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockistId || Number(amount) <= 0 || !reference) {
      setError("Stockist, valid amount (> 0), and payment reference (teller/ref) are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/management/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockistId,
          amount: Number(amount),
          paymentMethod,
          reference: reference.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record payment.");
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
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#059669]">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Record Consignment Payment
            </h3>
            <p className="text-xs text-slate-500">
              Settle outstanding debt received via Bank Transfer, Cheque, or Cash
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

          {/* Current Debt Card */}
          {selectedStockist && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-600">Current Outstanding Debt:</span>
              <span className="font-mono font-bold text-[#CF0458] text-sm">
                ₦ {selectedStockist.outstandingDebt.toLocaleString()}
              </span>
            </div>
          )}

          {/* Amount & Quick Full Balance */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Payment Amount (₦)
              </label>
              {selectedStockist && selectedStockist.outstandingDebt > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(selectedStockist.outstandingDebt))}
                  className="text-[10px] font-bold text-[#CF0458] hover:underline cursor-pointer"
                >
                  Pay Full Balance
                </button>
              )}
            </div>
            <input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
            />
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Payment Channel
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-slate-50 text-slate-900"
              >
                <option value="BANK_TRANSFER">Bank Transfer / NIP</option>
                <option value="CHEQUE">Corporate Cheque</option>
                <option value="CASH">Cash Deposit</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Bank Ref / Teller #
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. GTB/TRF/99120"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Settlement Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Full weekly settlement confirmed"
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
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#059669] hover:bg-[#047857] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Recording..." : "Confirm & Settle Payment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
