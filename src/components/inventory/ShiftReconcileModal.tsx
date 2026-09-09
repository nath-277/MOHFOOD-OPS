"use client";

import React, { useState, useMemo } from "react";
import { InventoryItem } from "@/server/inventory/store";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Lock,
  ShieldCheck,
  Search,
  Sun,
  Moon,
} from "lucide-react";

interface ShiftReconcileModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: (reconciledShift?: any) => void;
}

export const ShiftReconcileModal: React.FC<ShiftReconcileModalProps> = ({
  isOpen,
  onClose,
  items,
  shiftType,
  onSuccess,
}) => {
  const [handoverOfficer, setHandoverOfficer] = useState(
    shiftType === "MORNING_SHIFT" ? "Blessing Okon (Night Shift Lead)" : "Alhaji Musa (Store Manager)"
  );
  const [counts, setCounts] = useState<{ [code: string]: { physical: string; note: string } }>(() => {
    const initial: { [code: string]: { physical: string; note: string } } = {};
    items.forEach((item) => {
      initial[item.code] = { physical: String(item.currentStock), note: "" };
    });
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const varianceCount = useMemo(() => {
    return items.reduce((acc, item) => {
      const entered = Number(counts[item.code]?.physical ?? item.currentStock);
      const diff = Number((entered - item.currentStock).toFixed(3));
      return diff !== 0 ? acc + 1 : acc;
    }, 0);
  }, [items, counts]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

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

      onSuccess(data.shiftRecord || data.result?.shiftRecord);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to reconcile shift stock.");
    } finally {
      setLoading(false);
    }
  };

  const isMorning = shiftType === "MORNING_SHIFT";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#2B1B24] to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CF0458] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#CF0458] bg-white/10 px-2 py-0.5 rounded">
                  Stock Handover
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  {isMorning ? "Morning Shift" : "Night Shift"}
                </span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
                Shift Closing Stock Reconciliation
              </h3>
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Shift & Handover Details */}
          <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Active Closing Shift
              </span>
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                {isMorning ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Morning Shift (08:00 – 18:00)</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Night Shift (18:00 – 08:00)</span>
                  </>
                )}
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
                placeholder="e.g. Blessing Okon (Night Shift Lead)"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-800"
              />
            </div>
          </div>

          {/* Physical Count Checklist Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scale className="w-3.5 h-3.5 text-[#CF0458]" />
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Physical Floor Count Checklist
                </span>
                {varianceCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                    {varianceCount} {varianceCount === 1 ? "Discrepancy" : "Discrepancies"}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    All Balanced
                  </span>
                )}
              </div>

              {/* Checklist Search Box */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter material..."
                  className="w-full pl-8 pr-3 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-[#CF0458]"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs min-w-[550px]">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-right">System Expected</th>
                    <th className="py-2.5 px-3 text-right w-36">Physical Count</th>
                    <th className="py-2.5 px-3 text-center">Variance</th>
                    <th className="py-2.5 px-3 w-52">Discrepancy Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const entered = Number(counts[item.code]?.physical ?? item.currentStock);
                    const variance = Number((entered - item.currentStock).toFixed(3));
                    const hasVariance = variance !== 0;

                    return (
                      <tr key={item.code} className={hasVariance ? "bg-amber-50/50" : "hover:bg-slate-50/60"}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div className="font-bold text-xs">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {item.currentStock.toLocaleString(undefined, {
                            minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {item.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            value={counts[item.code]?.physical ?? item.currentStock}
                            onChange={(e) => handlePhysicalChange(item.code, e.target.value)}
                            className="w-full px-2.5 py-1 text-right rounded-lg border border-slate-300 font-mono font-bold text-xs focus:ring-2 focus:ring-[#CF0458] focus:outline-hidden"
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
                            <span className="text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                              0.00 Match
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {hasVariance ? (
                            <input
                              type="text"
                              required
                              placeholder="Reason (spillage, cracked cup...)"
                              value={counts[item.code]?.note ?? ""}
                              onChange={(e) => handleNoteChange(item.code, e.target.value)}
                              className="w-full px-2 py-1 text-xs rounded border border-amber-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
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
            <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0" />
            <span>
              Submitting locks this shift's inventory balance. Any noted variances will be audited and archived in the immutable ledger.
            </span>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{loading ? "Reconciling & Locking..." : "Sign Off & Lock Shift Handover"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
