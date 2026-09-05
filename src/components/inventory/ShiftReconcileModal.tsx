"use client";

import React, { useState } from "react";
import { InventoryItem } from "@/server/inventory/store";
import { X, CheckCircle2, AlertTriangle, Scale, Lock, ShieldCheck } from "lucide-react";

interface ShiftReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: () => void;
}

export const ShiftReconcileModal: React.FC<ShiftReconcileModalProps> = ({
  isOpen,
  onClose,
  items,
  shiftType,
  onSuccess,
}) => {
  const [handoverOfficer, setHandoverOfficer] = useState(
    shiftType === "MORNING_SHIFT" ? "Night Shift Lead (Alhaji Musa)" : "Morning Shift Lead (Blessing Okon)"
  );
  const [counts, setCounts] = useState<{ [code: string]: { physical: string; note: string } }>(() => {
    const initial: { [code: string]: { physical: string; note: string } } = {};
    items.forEach((item) => {
      initial[item.code] = { physical: String(item.currentStock), note: "" };
    });
    return initial;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhysicalChange = (code: string, val: string) => {
    setCounts((prev) => ({
      ...prev,
      [code]: { ...prev[code], physical: val },
    }));
  };

  const handleNoteChange = (code: string, note: string) => {
    setCounts((prev) => ({
      ...prev,
      [code]: { ...prev[code], note },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payloadCounts = Object.entries(counts).map(([code, val]) => ({
      itemCode: code,
      physicalCount: Number(val.physical || 0),
      discrepancyNote: val.note || undefined,
    }));

    try {
      const res = await fetch("/api/inventory/shifts/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftType,
          counts: payloadCounts,
          handoverOfficerName: handoverOfficer,
          notes: `End of ${shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} shift handover reconciliation.`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shift reconciliation failed.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to reconcile shift stock.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2B1B24] via-[#1E293B] to-[#111827] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-[#84BD00]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Shift Closing Stock Reconciliation</h3>
              <p className="text-[11px] text-slate-300">
                Verify physical counts vs expected system balance & lock handover protocol
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Shift & Handover Details */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Active Closing Shift
              </span>
              <div className="font-bold text-sm text-[#2B1B24]">
                {shiftType === "MORNING_SHIFT" ? "Morning Shift (08:00 - 18:00)" : "Night Shift (18:00 - 08:00)"}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Incoming Shift Handover Officer
              </label>
              <input
                type="text"
                required
                value={handoverOfficer}
                onChange={(e) => setHandoverOfficer(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D81B60] bg-white"
              />
            </div>
          </div>

          {/* Physical Count Checklist Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#D81B60]" />
                <span>Physical Floor Count Checklist</span>
              </span>
              <span className="text-[11px] text-slate-500">Auto-calculates discrepancy variance</span>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-right">System Expected</th>
                    <th className="py-2.5 px-3 text-right">Physical Count</th>
                    <th className="py-2.5 px-3 text-center">Variance</th>
                    <th className="py-2.5 px-3">Discrepancy Note (If Any)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const entered = Number(counts[item.code]?.physical ?? item.currentStock);
                    const variance = Number((entered - item.currentStock).toFixed(3));
                    const hasVariance = variance !== 0;

                    return (
                      <tr key={item.code} className={hasVariance ? "bg-amber-50/50" : "hover:bg-slate-50/60"}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {item.currentStock} {item.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right w-36">
                          <input
                            type="number"
                            step="any"
                            value={counts[item.code]?.physical ?? item.currentStock}
                            onChange={(e) => handlePhysicalChange(item.code, e.target.value)}
                            className="w-full px-2.5 py-1 text-right rounded-lg border border-slate-300 font-mono font-bold text-xs focus:ring-2 focus:ring-[#D81B60] focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {hasVariance ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                variance < 0 ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {variance > 0 ? `+${variance}` : variance} {item.uom}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              0.000 Match
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 w-48">
                          {hasVariance ? (
                            <input
                              type="text"
                              required
                              placeholder="e.g. Spillage / moisture loss"
                              value={counts[item.code]?.note ?? ""}
                              onChange={(e) => handleNoteChange(item.code, e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-amber-300 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-400">Reconciled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Handover protocol disclaimer */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
            <ShieldCheck className="w-5 h-5 text-[#008153] shrink-0" />
            <span>
              Submitting locks this shift's inventory balance. Any noted variances will be audited and archived in the immutable ledger.
            </span>
          </div>

          {/* Action buttons */}
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#2B1B24] via-[#1E293B] to-[#111827] hover:brightness-125 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-[#84BD00]" />
              <span>{loading ? "Reconciling & Locking..." : "Sign Off & Lock Shift Handover"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
