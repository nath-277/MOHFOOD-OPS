"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  FileText,
  CheckCircle2,
  Calendar,
  Sun,
  Moon,
  Clock,
  Printer,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  X,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Layers,
  Check,
} from "lucide-react";
import { generateRequisitionSlipHtml, printHtmlDocument, cleanStaffName } from "@/lib/printUtils";

export interface RequisitionItem {
  itemName: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface RequisitionRecord {
  id: string;
  referenceId: string;
  shiftDate: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  productName?: string;
  preparedBy: string;
  issuedBy: string;
  status: "PENDING_APPROVAL" | "APPROVED";
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  items: RequisitionItem[];
  createdAt: string;
}

interface SupervisorRequisitionsViewProps {
  readOnly?: boolean;
}

export function SupervisorRequisitionsView({ readOnly = false }: SupervisorRequisitionsViewProps) {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<"ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT">("ALL");
  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Vetting Modal State
  const [vettingTarget, setVettingTarget] = useState<RequisitionRecord | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approving, setApproving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadRequisitions = useCallback(async () => {
    try {
      setRefreshing(true);
      const shiftParam = selectedShift === "ALL" ? "" : `&shift=${selectedShift}`;
      const res = await fetch(
        `/api/production/requisitions?date=${selectedDate}${shiftParam}`
      );
      if (res.ok) {
        const data = await res.json();
        setRequisitions(data.requisitions || []);
      }
    } catch (err) {
      console.error("Failed to load shift requisitions:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedShift]);

  useEffect(() => {
    loadRequisitions();
  }, [loadRequisitions]);

  const handleOpenVetting = (req: RequisitionRecord) => {
    setVettingTarget(req);
    setApprovalNotes(req.approvalNotes || "");
  };

  const handleApprove = async () => {
    if (!vettingTarget) return;
    setApproving(true);
    try {
      const res = await fetch(
        `/api/production/requisitions/${encodeURIComponent(vettingTarget.referenceId)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shiftDate: vettingTarget.shiftDate || selectedDate,
            shiftType: vettingTarget.shiftType || "MORNING_SHIFT",
            notes: approvalNotes.trim() || undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed.");

      showToast(`Requisition ${vettingTarget.referenceId} vetted and digitally approved.`);
      setVettingTarget(null);
      loadRequisitions();
    } catch (err: any) {
      showToast(err.message || "Failed to approve requisition.");
    } finally {
      setApproving(false);
    }
  };

  const handlePrint = (req: RequisitionRecord) => {
    const html = generateRequisitionSlipHtml({
      shiftType: req.shiftType,
      date: req.shiftDate,
      referenceId: req.referenceId,
      productName: req.productName,
      preparedBy: req.approvedBy || req.preparedBy,
      issuedBy: req.issuedBy,
      items: req.items,
      status: req.status,
      isApproved: req.status === "APPROVED",
    });
    printHtmlDocument(html, `Requisition_${req.referenceId}`, "portrait");
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#059669] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Shift Controls */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-[#CF0458] border border-rose-200">
              Shift Custody Transfer
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Store &rarr; Production Handover
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Store Material Requisitions & Supervisor Approvals
          </h2>
          <p className="text-xs text-slate-500">
            Vet materials, quantities, and packaging dished out by Store Officers for this shift and sign off digitally.
          </p>
        </div>

        {/* Date & Shift Selectors */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Shift Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelectedShift("ALL")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedShift === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>All Shifts</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift("MORNING_SHIFT")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedShift === "MORNING_SHIFT"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span>Morning</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift("NIGHT_SHIFT")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedShift === "NIGHT_SHIFT"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-600" />
              <span>Night</span>
            </button>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              max={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={loadRequisitions}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-2xs cursor-pointer transition-colors"
            title="Refresh Requisitions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Requisitions List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CF0458]" />
          <p className="text-xs font-semibold">Loading shift requisitions...</p>
        </div>
      ) : requisitions.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-1">
          <FileText className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No Store Requisitions Found</p>
          <p className="text-xs text-slate-400">
            No material dispatches have been issued by the store for {selectedDate}
            {selectedShift !== "ALL" ? ` (${selectedShift === "MORNING_SHIFT" ? "Morning" : "Night"})` : ""}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requisitions.map((req) => {
            const isApproved = req.status === "APPROVED";

            return (
              <div
                key={req.id}
                className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                  isApproved
                    ? "border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/20"
                    : "border-slate-200 hover:border-[#CF0458]/40"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                        {req.referenceId}
                      </span>
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#059669]/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved & Vetted</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending Supervisor Vetting</span>
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        • {req.items.length} materials dished out
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {req.productName || "Shift Production Batch"}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span>
                        Issued by: <strong className="text-slate-700">{cleanStaffName(req.issuedBy, "Ibrahim Musa")}</strong>
                      </span>
                      <span>•</span>
                      <span>Shift: {req.shiftType === "MORNING_SHIFT" ? "Morning (08:00 - 18:00)" : "Night (18:00 - 08:00)"}</span>
                      <span>•</span>
                      <span>Date: {req.shiftDate}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrint(req)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Print Slip</span>
                    </button>

                    {readOnly ? (
                      isApproved ? (
                        <button
                          type="button"
                          onClick={() => setVettingTarget(req)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-2xs transition-all cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-[#059669]" />
                          <span>View Approval Stamp</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          Awaiting Supervisor Vetting
                        </span>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => setVettingTarget(req)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-all cursor-pointer ${
                          isApproved
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-[#CF0458] hover:bg-[#B5034C] text-white"
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{isApproved ? "View Approval Stamp" : "Vet & Approve Slip"}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items Summary Table */}
                <div className="mt-3.5">
                  {req.items.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-400 italic">
                      No material line items recorded for this requisition.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            <th className="py-2 px-2.5 w-10 text-center">#</th>
                            <th className="py-2 px-2.5">Material Name</th>
                            <th className="py-2 px-2.5 text-right">Quantity Transferred</th>
                            <th className="py-2 px-2.5">Notes / Container</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {req.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-2.5 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2.5 font-bold text-slate-900">
                                {item.itemName}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-800">
                                {Number(item.quantity).toLocaleString()} {item.unit}
                              </td>
                              <td className="py-2 px-2.5 text-slate-500 text-[11px] truncate max-w-[200px]">
                                {item.notes || "Standard recipe allocation"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Approval Banner if already approved */}
                {isApproved && (
                  <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold">
                          Digitally Vetted & Signed by {req.approvedBy}
                        </span>
                        {req.approvedAt && (
                          <span className="text-emerald-700 ml-1">
                            on {new Date(req.approvedAt).toLocaleString()}
                          </span>
                        )}
                        {req.approvalNotes && (
                          <p className="text-[11px] text-emerald-800 italic mt-0.5">
                            &quot;{req.approvalNotes}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Custody Accepted
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Digital Vetting & Approval Modal */}
      {vettingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#CF0458] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {vettingTarget.status === "APPROVED" ? "Requisition Verification Slip" : "Supervisor Digital Approval"}
                  </h3>
                  <p className="text-xs text-slate-400">Ref: {vettingTarget.referenceId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVettingTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Slip Summary */}
            <div className="my-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Output Product:</span>
                <span className="font-bold text-slate-900">{vettingTarget.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shift & Date:</span>
                <span className="font-semibold text-slate-700">
                  {vettingTarget.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} • {vettingTarget.shiftDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Issued by Store:</span>
                <span className="font-semibold text-slate-700">{cleanStaffName(vettingTarget.issuedBy, "Ibrahim Musa")}</span>
              </div>
            </div>

            {/* Materials List */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Transferred Ingredients & Materials ({vettingTarget.items.length})
              </label>
              <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                {vettingTarget.items.map((item, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{item.itemName}</div>
                      {item.notes && <div className="text-[10px] text-slate-400">{item.notes}</div>}
                    </div>
                    <div className="font-mono font-bold text-slate-800">
                      {Number(item.quantity).toLocaleString()} {item.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supervisor Remarks Input */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supervisor Vetting Remarks (Optional)
              </label>
              <textarea
                rows={2}
                disabled={vettingTarget.status === "APPROVED"}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. All materials vetted and received in mixing room in good order."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#CF0458] focus:bg-white disabled:opacity-75"
              />
            </div>

            {/* Signer Notice */}
            <div className="mt-4 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Signing this requisition confirms that physical ingredients match the documented quantities and that custody has transferred to Production.
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handlePrint(vettingTarget)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Slip</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVettingTarget(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>

                {vettingTarget.status !== "APPROVED" && (
                  <button
                    type="button"
                    disabled={approving}
                    onClick={handleApprove}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{approving ? "Signing..." : "Sign & Approve Requisition"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
