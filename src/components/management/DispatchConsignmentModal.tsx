"use client";

import React, { useState, useEffect } from "react";
import { RetailStockist } from "@/server/management/store";
import { ProductRecipe } from "@/server/inventory/store";
import { X, Truck, CheckCircle2, AlertCircle } from "lucide-react";

interface DispatchConsignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockists: RetailStockist[];
  recipes?: ProductRecipe[];
  onSuccess: () => void;
}

export const DispatchConsignmentModal: React.FC<DispatchConsignmentModalProps> = ({
  isOpen,
  onClose,
  stockists,
  recipes = [],
  onSuccess,
}) => {
  const [stockistId, setStockistId] = useState(stockists[0]?.id || "");
  const [productCode, setProductCode] = useState(recipes[0]?.code || "REC-PARFAIT-400ML");
  const [productName, setProductName] = useState(recipes[0]?.name || "Moh Yogurt Parfait (400ml Cup)");
  const [quantityDelivered, setQuantityDelivered] = useState<string>("150");
  const [unitPrice, setUnitPrice] = useState<string>("2000");
  const [driverName, setDriverName] = useState("Sunday B. (Van 1)");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (stockists.length > 0 && !stockistId) {
      setStockistId(stockists[0].id);
      setUnitPrice(String(stockists[0].standardUnitPrice || 2000));
    }
  }, [stockists, stockistId]);

  useEffect(() => {
    const s = stockists.find((st) => st.id === stockistId);
    if (s) {
      setUnitPrice(String(s.standardUnitPrice));
    }
  }, [stockistId, stockists]);

  useEffect(() => {
    const r = recipes.find((rec) => rec.code === productCode);
    if (r) {
      setProductName(r.name);
    }
  }, [productCode, recipes]);

  if (!isOpen) return null;

  const totalValue = (Number(quantityDelivered) || 0) * (Number(unitPrice) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockistId || Number(quantityDelivered) <= 0) {
      setError("Please select a supermarket and specify a quantity greater than 0.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/management/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockistId,
          productCode,
          productName,
          quantityDelivered: Number(quantityDelivered),
          unitPrice: Number(unitPrice),
          driverName: driverName.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record delivery dispatch.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record dispatch.");
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
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Dispatch Supermarket Consignment
            </h3>
            <p className="text-xs text-slate-500">
              Issue outbound finished goods batch on Sale or Return (SoR)
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
          {/* Supermarket Stockist */}
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
                  {s.name} — {s.location}
                </option>
              ))}
            </select>
          </div>

          {/* Product & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Product
              </label>
              <select
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-slate-50 text-slate-900"
              >
                {recipes.length > 0 ? (
                  recipes.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))
                ) : (
                  <option value="REC-PARFAIT-400ML">Moh Yogurt Parfait (400ml Cup)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Quantity Dispatched (Units)
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantityDelivered}
                onChange={(e) => setQuantityDelivered(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Unit Price & Total Value Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Wholesale Unit Price (₦)
              </label>
              <input
                type="number"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Total Dispatch Value
              </label>
              <div className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-[#CF0458]">
                ₦ {totalValue.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Driver & Van Assignment */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Assigned Van & Driver
            </label>
            <select
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-900"
            >
              <option value="Sunday B. (Van 1 - Chilled)">Sunday B. (Van 1 - Chilled)</option>
              <option value="Kayode O. (Van 2 - Chilled)">Kayode O. (Van 2 - Chilled)</option>
              <option value="Direct Store Pickup / Logistics">Direct Store Pickup / Logistics</option>
            </select>
          </div>

          {/* Dispatch Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Dispatch Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Delivered to cold storage room"
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
              <span>{loading ? "Generating Waybill..." : "Confirm & Dispatch Consignment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
