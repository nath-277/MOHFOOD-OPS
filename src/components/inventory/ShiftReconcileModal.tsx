"use client";

import React, { useState } from "react";
import { InventoryItem } from "@/server/inventory/store";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  Sun,
  Moon,
  UserCheck,
  FileText,
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
  items: _items,
  shiftType,
  onSuccess,
}) => {
  const [selectedShift, setSelectedShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">(shiftType);
  const [handoverOfficer, setHandoverOfficer] = useState(
    shiftType === "MORNING_SHIFT" ? "Blessing Okon (Night Shift Lead)" : "Ajayi Boluwatife (Store Manager)"
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/inventory/shifts/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftType: selectedShift,
          counts: [],
          handoverOfficerName: handoverOfficer.trim() || "Incoming Shift Officer",
          notes:
            notes.trim() ||
            `Store material handover for ${
              selectedShift === "MORNING_SHIFT" ? "Morning" : "Night"
            } production shift. Materials verified and dispatches locked.`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Shift handover failed.");

      onSuccess(data.shiftRecord || data.result?.shiftRecord);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to sign off shift handover.");
    } finally {
      setLoading(false);
    }
  };

  const isMorning = selectedShift === "MORNING_SHIFT";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#2B1B24] to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CF0458] flex items-center justify-center text-white shrink-0 shadow-sm">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#CF0458] bg-white/10 px-2 py-0.5 rounded">
                  Store Handover
                </span>
                <span className="text-[10px] font-bold text-slate-300">
                  {isMorning ? "Morning Shift Sign-off" : "Night Shift Sign-off"}
                </span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
                Store Material Handover
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

          {/* Context Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <p className="font-bold text-slate-800 mb-0.5">
              Material Dispensing Sign-off
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Store operations run continuously to supply production. Select the factory shift materials were dispensed for to sign off and lock the dispatch audit ledger.
            </p>
          </div>

          {/* Shift Selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Production Shift Material Dispensed For
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedShift("MORNING_SHIFT")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  isMorning
                    ? "border-[#CF0458] bg-[#CF0458]/5 text-[#CF0458] font-bold shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                }`}
              >
                <Sun className={`w-5 h-5 ${isMorning ? "text-[#CF0458]" : "text-amber-500"}`} />
                <span className="text-xs">Morning Production Shift</span>
                <span className="text-[10px] text-slate-400 font-normal">08:00 – 18:00</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShift("NIGHT_SHIFT")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                  !isMorning
                    ? "border-[#CF0458] bg-[#CF0458]/5 text-[#CF0458] font-bold shadow-xs"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                }`}
              >
                <Moon className={`w-5 h-5 ${!isMorning ? "text-[#CF0458]" : "text-indigo-400"}`} />
                <span className="text-xs">Night Production Shift</span>
                <span className="text-[10px] text-slate-400 font-normal">18:00 – 08:00</span>
              </button>
            </div>
          </div>

          {/* Handover / Receiving Officer */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Incoming Officer / Production Supervisor Receiving Sign-off
            </label>
            <div className="relative">
              <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={handoverOfficer}
                onChange={(e) => setHandoverOfficer(e.target.value)}
                placeholder="e.g. Blessing Okon (Night Shift Lead) or Floor Supervisor"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458] bg-white text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Handover Remarks & Dispensing Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. All batch raw materials, packaging, and fruits issued for scheduled orders. Requisition quantities verified with mixing team."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-hidden focus:border-[#CF0458] bg-white placeholder-slate-400 resize-none"
              />
            </div>
          </div>

          {/* Security & Audit Lock Guarantee */}
          <div className="flex items-start gap-2.5 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-800">
            <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-bold text-emerald-900 block">Ledger Lock Protocol:</strong>
              Signing off will permanently lock all pending material dispatches for the{" "}
              <span className="font-semibold text-emerald-950">
                {isMorning ? "Morning Shift" : "Night Shift"}
              </span>
              . Stock balances on the Daily Shift Sheet will be archived.
            </div>
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
              <span>{loading ? "Signing Off & Locking..." : "Sign Off & Lock Shift Handover"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
