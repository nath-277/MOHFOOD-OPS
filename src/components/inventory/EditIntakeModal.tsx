"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Pencil, Package } from "lucide-react";
import { IntakeRecordItem } from "@/components/inventory/InboundIntakeModal";
import { formatDate } from "@/lib/dateUtils";

export interface EditIntakeModalProps {
  isOpen: boolean;
  intake: IntakeRecordItem | null;
  onClose: () => void;
  onSuccess: (updated?: any) => void;
}

export const EditIntakeModal: React.FC<EditIntakeModalProps> = ({
  isOpen,
  intake,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState<string>("");
  const [unitCost, setUnitCost] = useState<string>("");
  const [intakeDate, setIntakeDate] = useState<string>("");
  const [shiftType, setShiftType] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (intake && isOpen) {
      setQuantity(String(intake.quantity));
      setUnitCost(intake.unitCost !== undefined ? String(intake.unitCost) : "");
      setIntakeDate(
        intake.createdAt
          ? new Date(intake.createdAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setShiftType(intake.shiftType || "MORNING_SHIFT");
      setExpiryDate(intake.expiryDate || "");
      setNotes(intake.notes || "");
      setError(null);
    }
  }, [intake, isOpen]);

  if (!isOpen || !intake) return null;

  const originalQty = intake.quantity;
  const parsedQty = parseFloat(quantity) || 0;
  const qtyDiff = Number((parsedQty - originalQty).toFixed(3));
  const parsedCost = parseFloat(unitCost) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intake) return;

    if (!quantity || isNaN(parsedQty) || parsedQty <= 0) {
      setError("Please enter a valid positive quantity.");
      return;
    }

    if (unitCost && (isNaN(parsedCost) || parsedCost < 0)) {
      setError("Unit cost must be a valid non-negative number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/inventory/intakes/${encodeURIComponent(intake.id)}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: parsedQty,
          unitCost: unitCost ? parsedCost : undefined,
          notes: notes.trim() || undefined,
          expiryDate: expiryDate || undefined,
          shiftType,
          intakeDate: intakeDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update intake.");
      }

      onSuccess(data);
    } catch (err: any) {
      setError(err.message || "Failed to update intake.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-350 ease-out">
        {/* Mobile drag handle */}
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto mb-1 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                Inbound Delivery
              </span>
              {intake.grnNumber && (
                <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  GRN: {intake.grnNumber}
                </span>
              )}
              {intake.lotNumber && (
                <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Lot: {intake.lotNumber}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" />
              Edit Inbound Intake
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {intake.itemName} {intake.itemCode ? `(${intake.itemCode})` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Context Banner */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-900 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-600" />
              Original Intake:
            </span>
            <span className="font-mono font-bold text-blue-800">
              +{originalQty.toLocaleString()} {intake.unit}
            </span>
          </div>
          <div className="text-[11px] text-blue-700 flex flex-wrap gap-x-3 gap-y-1">
            <span>
              Recorded: <strong>{formatDate(intake.createdAt)}</strong>
            </span>
            <span>
              By: <strong>{intake.performedByName}</strong>
            </span>
            {intake.unitCost !== undefined && (
              <span>
                Cost: <strong>₦{intake.unitCost.toLocaleString()}</strong> / {intake.unit}
              </span>
            )}
          </div>
          <div className="text-[10px] text-blue-600 pt-1 border-t border-blue-200/50">
            💡 Changes to received quantity will automatically adjust active store inventory.
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Quantity */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Quantity ({intake.unit}) *
                </label>
                {qtyDiff !== 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      qtyDiff > 0
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff} {intake.unit}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:border-blue-600 bg-white text-slate-900 pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                  {intake.unit}
                </span>
              </div>
            </div>

            {/* Unit Cost */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Unit Cost (₦)
                </label>
                {parsedQty > 0 && parsedCost > 0 && (
                  <span className="text-[10px] font-mono font-semibold text-slate-500">
                    Total: ₦{(parsedQty * parsedCost).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                  ₦
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="Purchase price per unit"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Intake Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Intake Date *
              </label>
              <input
                type="date"
                lang="en-GB"
                required
                value={intakeDate}
                onChange={(e) => setIntakeDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
              />
            </div>

            {/* Receiving Shift */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Receiving Shift *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftType("MORNING_SHIFT")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    shiftType === "MORNING_SHIFT"
                      ? "bg-amber-500 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  ☀️ Morning
                </button>
                <button
                  type="button"
                  onClick={() => setShiftType("NIGHT_SHIFT")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    shiftType === "NIGHT_SHIFT"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  🌙 Night
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Expiry Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Expiry Date (Optional)
              </label>
              <input
                type="date"
                lang="en-GB"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Edit / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason or correction notes"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-hidden focus:border-blue-600 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
