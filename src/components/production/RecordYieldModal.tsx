"use client";

import React, { useState } from "react";
import { WorkOrder } from "@/server/production/store";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Save,
  AlertCircle,
} from "lucide-react";

interface RecordYieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workOrder: WorkOrder | null;
}

export function RecordYieldModal({
  isOpen,
  onClose,
  onSuccess,
  workOrder,
}: RecordYieldModalProps) {
  const [actualYield, setActualYield] = useState<number>(workOrder?.targetQuantity || 0);
  const [scrapQuantity, setScrapQuantity] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when workOrder changes
  React.useEffect(() => {
    if (workOrder) {
      setActualYield(workOrder.actualYield || workOrder.targetQuantity);
      setScrapQuantity(workOrder.scrapQuantity || 0);
      setNotes("");
      setError(null);
    }
  }, [workOrder]);

  if (!isOpen || !workOrder) return null;

  const target = workOrder.targetQuantity;
  const yieldPct = target > 0 ? Number(((actualYield / target) * 100).toFixed(1)) : 0;
  const isHealthy = yieldPct >= 98;
  const isWarning = yieldPct >= 95 && yieldPct < 98;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (actualYield < 0) {
      setError("Actual yield must be zero or a positive number.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/production/work-orders/${workOrder.id}/yield`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actualYield: Number(actualYield),
          scrapQuantity: Number(scrapQuantity),
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record yield.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record yield.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Record Production Yield & Sign-off</h3>
              <p className="text-[11px] text-slate-500 font-mono">{workOrder.orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
          <div className="font-bold text-slate-900">{workOrder.recipeName}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Target Planned Output:</span>
            <span className="font-mono font-bold text-slate-800">{workOrder.targetQuantity} units</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Shift:</span>
            <span className="font-semibold text-slate-700">
              {workOrder.shiftType === "MORNING_SHIFT" ? "Morning (08:00 - 18:00)" : "Night (18:00 - 08:00)"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Actual Finished Packaged
              </label>
              <input
                type="number"
                min={0}
                value={actualYield}
                onChange={(e) => setActualYield(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:bg-white focus:border-[#059669] focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Good units ready for storage</span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Scrap / Defect Count
              </label>
              <input
                type="number"
                min={0}
                value={scrapQuantity}
                onChange={(e) => setScrapQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-rose-700 font-bold focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Wasted or defective units</span>
            </div>
          </div>

          {/* Efficiency Metric Banner */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              isHealthy
                ? "bg-emerald-50 text-[#059669] border-emerald-200"
                : isWarning
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4" />
              <span>Yield Efficiency Rate:</span>
            </div>
            <span className="font-mono text-base font-bold">{yieldPct}%</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Production & QC Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 4 cracked dome lids during capper calibration. Product taste test verified."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? "Completing Run..." : "Sign-off & Complete Batch"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
