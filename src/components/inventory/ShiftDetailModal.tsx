"use client";

import React, { useEffect, useState } from "react";
import { ShiftRecordItem } from "@/components/shift/ShiftContext";
import {
  X,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Calendar,
  Lock,
  Sun,
  Moon,
  ArrowRight,
  Boxes,
  FileCheck,
} from "lucide-react";

interface ShiftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftRecordItem | null;
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({
  isOpen,
  onClose,
  shift,
}) => {
  const [fullShiftData, setFullShiftData] = useState<any>(shift);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shift && isOpen) {
      setFullShiftData(shift);
      // Fetch full shift details if needed
      fetch(`/api/inventory/shifts/${shift.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.shift) {
            setFullShiftData(data.shift);
          }
        })
        .catch((err) => console.error("Error loading shift detail:", err));
    }
  }, [shift, isOpen]);

  if (!isOpen || !shift) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const isMorning = shift.shiftType === "MORNING_SHIFT";
  const discrepancies = fullShiftData?.discrepancies || shift.discrepancies || [];
  const hasVariances = discrepancies.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Certificate Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-[#2B1B24] to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CF0458] flex items-center justify-center text-white shrink-0 shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#CF0458] bg-white/10 px-2 py-0.5 rounded">
                  NAFDAC Reg: A8-106771
                </span>
                <span className="text-[10px] font-mono text-slate-300">
                  REF: {shift.id.toUpperCase().slice(0, 16)}
                </span>
              </div>
              <h3 className="font-extrabold text-sm sm:text-base text-white mt-0.5">
                Official Shift Handover & Stock Audit Certificate
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 print:p-0">
          {/* Shift Overview Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Shift Schedule
              </span>
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                {isMorning ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Morning Shift</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Night Shift</span>
                  </>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {isMorning ? "08:00 – 18:00" : "18:00 – 08:00"}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Calendar Date & Log
              </span>
              <div className="flex items-center gap-1.5 font-bold text-slate-900 font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{shift.shiftDate}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {new Date(shift.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                {shift.closedAt ? ` → ${new Date(shift.closedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` : " (Active)"}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Digital Security Lock
              </span>
              {shift.status === "RECONCILED" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Reconciled & Locked</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Shift in Progress</span>
                </span>
              )}
            </div>
          </div>

          {/* Handover Officers Signature Box */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Outgoing Store Officer (Count Certified)
              </span>
              <div className="font-bold text-slate-900 text-xs sm:text-sm">
                {shift.closedByName || shift.openedByName}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Store Operations Dept • Lagos Central Plant
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Incoming Shift Lead (Custody Acknowledged)
              </span>
              <div className="font-bold text-slate-900 text-xs sm:text-sm">
                {shift.handoverOfficerName || "Shift Lead Handover Officer"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Physical stock handed over & signed digitally
              </div>
            </div>
          </div>

          {/* Physical Count Discrepancies Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Physical Inventory Count Audit & Variances
              </span>
              <span className="text-[10px] font-semibold text-slate-500 font-mono">
                {hasVariances ? `${discrepancies.length} discrepancy noted` : "100% Matched"}
              </span>
            </div>

            {hasVariances ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Item Name / SKU</th>
                      <th className="py-2.5 px-3 text-right">System Expected</th>
                      <th className="py-2.5 px-3 text-right">Physical Count</th>
                      <th className="py-2.5 px-3 text-center">Variance</th>
                      <th className="py-2.5 px-3">Discrepancy Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {discrepancies.map((d: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{d.itemName}</div>
                          <div className="text-[10px] font-mono text-slate-400">{d.itemCode}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {d.expectedStock} {d.uom}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {d.physicalCount} {d.uom}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.variance < 0 ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {d.variance > 0 ? `+${d.variance}` : d.variance} {d.uom}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-600">
                          {d.note || "Shift closing physical count variance."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 text-center bg-emerald-50/50 flex flex-col items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[#059669] mb-1.5" />
                <span className="text-xs font-bold text-emerald-900">
                  Zero Stock Discrepancies
                </span>
                <p className="text-[11px] text-emerald-700 max-w-sm mt-0.5">
                  Physical warehouse stock counts matched the expected book inventory balance with zero variance.
                </p>
              </div>
            )}
          </div>

          {/* Shift Activity Summary */}
          {shift.stats && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Dispenses</span>
                <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shift.stats.dispensedCount} batches
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Inbound Intakes</span>
                <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shift.stats.intakeCount} deliveries
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-semibold uppercase block">Returns Handled</span>
                <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shift.stats.returnsCount} items
                </span>
              </div>
            </div>
          )}

          {/* Shift Handover Notes */}
          {shift.notes && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Handover Operational Notes
              </span>
              <p className="text-slate-700 italic">"{shift.notes}"</p>
            </div>
          )}

          {/* Regulatory & Audit Footer */}
          <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 flex items-center gap-2 text-[11px] text-slate-600">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              This shift handover report is permanently archived in the immutable transaction ledger. Certified for NAFDAC Good Manufacturing Practice (GMP) compliance.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Certificate</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] transition-all cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
