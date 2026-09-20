"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  ClipboardList,
  Plus,
  Calendar,
  Sun,
  Moon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Zap,
  Cpu,
  Layers,
  ShieldAlert,
  ArrowRight,
  Filter,
} from "lucide-react";

export interface ProductionShiftLogItem {
  id: string;
  shiftDate: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  supervisorId?: string;
  supervisorName: string;
  status: "OPTIMAL" | "MINOR_INCIDENTS" | "DOWNTIME_DELAY" | "CRITICAL_ALERT";
  notes?: string;
  powerStatus?: string;
  equipmentNotes?: string;
  outputSummary?: string;
  incidents?: string;
  handoverNotes?: string;
  createdAt: string;
}

interface ShiftOperationsLogViewProps {
  readOnly?: boolean;
}

export function ShiftOperationsLogView({ readOnly = false }: ShiftOperationsLogViewProps) {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split("T")[0];

  const [logs, setLogs] = useState<ProductionShiftLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState<string>("");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State - 1 comprehensive field
  const [formDate, setFormDate] = useState(todayStr);
  const [formShift, setFormShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [formStatus, setFormStatus] = useState<
    "OPTIMAL" | "MINOR_INCIDENTS" | "DOWNTIME_DELAY" | "CRITICAL_ALERT"
  >("OPTIMAL");
  const [notes, setNotes] = useState("");
  const [selectedDetailLog, setSelectedDetailLog] = useState<ProductionShiftLogItem | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadLogs = useCallback(async () => {
    try {
      setRefreshing(true);
      let url = "/api/production/shift-logs";
      const params = new URLSearchParams();
      if (dateFilter) params.append("date", dateFilter);
      if (shiftFilter !== "ALL") params.append("shift", shiftFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load shift operations logs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateFilter, shiftFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/production/shift-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftDate: formDate,
          shiftType: formShift,
          status: formStatus,
          notes: notes.trim(),
          handoverNotes: notes.trim(),
          outputSummary: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit log.");

      showToast("Shift operations log saved and dispatched to Admin & Executive Hub.");
      setIsModalOpen(false);
      setNotes("");
      loadLogs();
    } catch (err: any) {
      showToast(err.message || "Failed to submit log.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          l.supervisorName.toLowerCase().includes(q) ||
          (l.notes && l.notes.toLowerCase().includes(q)) ||
          (l.outputSummary && l.outputSummary.toLowerCase().includes(q)) ||
          (l.equipmentNotes && l.equipmentNotes.toLowerCase().includes(q)) ||
          (l.incidents && l.incidents.toLowerCase().includes(q)) ||
          (l.handoverNotes && l.handoverNotes.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPTIMAL":
        return {
          label: "Optimal Shift",
          classes: "bg-[#ECFDF5] text-[#059669] border-[#059669]/20",
          icon: CheckCircle2,
        };
      case "MINOR_INCIDENTS":
        return {
          label: "Minor Incidents",
          classes: "bg-amber-50 text-amber-800 border-amber-200",
          icon: AlertTriangle,
        };
      case "DOWNTIME_DELAY":
        return {
          label: "Downtime / Delay",
          classes: "bg-orange-50 text-orange-800 border-orange-200",
          icon: Clock,
        };
      case "CRITICAL_ALERT":
        return {
          label: "Critical Alert",
          classes: "bg-red-50 text-red-700 border-red-200",
          icon: ShieldAlert,
        };
      default:
        return {
          label: status,
          classes: "bg-slate-100 text-slate-700 border-slate-200",
          icon: CheckCircle2,
        };
    }
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

      {/* Header Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
              Plant Shift Ledger
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Visible to Admin & CEO
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Factory Floor Operations Shift Log
          </h2>
          <p className="text-xs text-slate-500">
            Official operational reports recorded after each shift covering power, equipment CIP, batch yields, bottlenecks, and handovers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!readOnly && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Shift Log</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadLogs}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-2xs cursor-pointer transition-colors"
            title="Refresh Shift Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Shift Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setShiftFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                shiftFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
            >
              All Shifts
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter("MORNING_SHIFT")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                shiftFilter === "MORNING_SHIFT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
            >
              Morning
            </button>
            <button
              type="button"
              onClick={() => setShiftFilter("NIGHT_SHIFT")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                shiftFilter === "NIGHT_SHIFT" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
              }`}
            >
              Night
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPTIMAL">Optimal</option>
            <option value="MINOR_INCIDENTS">Minor Incidents</option>
            <option value="DOWNTIME_DELAY">Downtime Delay</option>
            <option value="CRITICAL_ALERT">Critical Alert</option>
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFilter}
              max={todayStr}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer text-xs"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search operational remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#CF0458]"
          />
        </div>
      </div>

      {/* Logs Feed */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CF0458]" />
          <p className="text-xs font-semibold">Loading factory operations logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-1">
          <ClipboardList className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-700">No Shift Operations Logs</p>
          <p className="text-xs text-slate-400">
            No logs matching your filter criteria. Click &quot;Record Shift Log&quot; to log the first operations summary.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLogs.map((log) => {
            const badge = getStatusBadge(log.status);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={log.id}
                onClick={() => setSelectedDetailLog(log)}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-[#CF0458]/40 shadow-xs transition-all cursor-pointer space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 font-bold text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {log.shiftType === "MORNING_SHIFT" ? (
                        <Sun className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>{log.shiftType === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-700 font-mono">
                      {log.shiftDate}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.classes}`}
                    >
                      <BadgeIcon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Logged: {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Supervisor & Content Snippets */}
                {/* Supervisor & Description */}
                <div className="space-y-2 text-xs">
                  <div className="text-slate-500 font-medium">
                    Supervisor: <strong className="text-slate-900">{log.supervisorName}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Operations Description & Remarks:
                    </span>
                    <p className="text-slate-800 line-clamp-3 whitespace-pre-line">
                      {log.notes || log.outputSummary || log.handoverNotes || "Operations recorded without specific notes."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 border-t border-slate-50">
                  <span>Click to view full shift inspection</span>
                  <div className="flex items-center gap-1 text-[#CF0458] font-bold">
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Inspection Modal */}
      {selectedDetailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[92vh] overflow-y-auto font-sans space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Operational Shift Document
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedDetailLog.shiftDate} •{" "}
                  {selectedDetailLog.shiftType === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Supervisor:</span>
                <strong className="text-slate-900">{selectedDetailLog.supervisorName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Logged At:</span>
                <span className="text-slate-700">{new Date(selectedDetailLog.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Status:</span>
                <span className="font-bold text-slate-900">{selectedDetailLog.status}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[10.5px] block mb-2">
                  Shift Operations Log & Remarks
                </span>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedDetailLog.notes ||
                    selectedDetailLog.outputSummary ||
                    selectedDetailLog.handoverNotes ||
                    "No operational notes recorded."}
                </p>
              </div>

              {(selectedDetailLog.powerStatus || selectedDetailLog.equipmentNotes || selectedDetailLog.incidents) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                  {selectedDetailLog.powerStatus && (
                    <div>
                      <span className="font-bold text-[10px] text-slate-400 block uppercase">Power Conditions:</span>
                      {selectedDetailLog.powerStatus}
                    </div>
                  )}
                  {selectedDetailLog.equipmentNotes && (
                    <div>
                      <span className="font-bold text-[10px] text-slate-400 block uppercase">Machinery / CIP:</span>
                      {selectedDetailLog.equipmentNotes}
                    </div>
                  )}
                  {selectedDetailLog.incidents && (
                    <div className="sm:col-span-2 text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      <span className="font-bold text-[10px] text-amber-700 block uppercase">Incidents / Delays:</span>
                      {selectedDetailLog.incidents}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Shift Log Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[92vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#CF0458] flex items-center justify-center font-bold">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Shift Operations Log</h3>
                  <p className="text-xs text-slate-400">Transmitted directly to Admin & Executive Hub</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Shift & Date & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Shift Date</label>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#CF0458]"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Shift Type</label>
                  <select
                    value={formShift}
                    onChange={(e) => setFormShift(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#CF0458] cursor-pointer"
                  >
                    <option value="MORNING_SHIFT">Morning (08:00 - 18:00)</option>
                    <option value="NIGHT_SHIFT">Night (18:00 - 08:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Shift Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#CF0458] cursor-pointer font-bold"
                  >
                    <option value="OPTIMAL">Optimal (Normal)</option>
                    <option value="MINOR_INCIDENTS">Minor Incidents</option>
                    <option value="DOWNTIME_DELAY">Downtime / Delay</option>
                    <option value="CRITICAL_ALERT">Critical Alert</option>
                  </select>
                </div>
              </div>

              {/* Single Comprehensive Field */}
              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  Shift Operations Description & Remarks <span className="text-[#CF0458]">*</span>
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Describe all aspects of the shift in this field (production output, machinery run, power conditions, any bottlenecks/delays, and handover instructions).
                </p>
                <textarea
                  required
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Completed 400 units Strawberry Parfait (400ml). All CIP sanitization on Jacketed Tank #1 completed. Public grid power stable throughout shift. No bottlenecks encountered. Handover: Tank #2 sanitized and ready for morning vanilla run."
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-[#CF0458] focus:bg-white resize-y font-normal leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Transmitting Log..." : "Submit Shift Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
