"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { ShiftOperationsLogView } from "@/components/production/ShiftOperationsLogView";
import {
  BookOpen,
  Activity,
  Clock,
  Search,
  X,
  RefreshCw,
  ShieldCheck,
  Package,
  Layers,
  FileCheck2,
  AlertOctagon,
  Truck,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

interface AuditEvent {
  id: string;
  type: string;
  departmentCode: string;
  performerId: string;
  performerName: string;
  timestamp: string;
  payload: any;
}

export default function GeneralLogsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"shift_logs" | "audit_logs">("shift_logs");

  // Audit Logs State
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditDeptFilter, setAuditDeptFilter] = useState("ALL");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams();
      if (auditDeptFilter !== "ALL") params.append("department", auditDeptFilter);
      if (auditSearchQuery.trim()) params.append("search", auditSearchQuery.trim());
      params.append("limit", "100");

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditEvents(data.events || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditDeptFilter, auditSearchQuery]);

  useEffect(() => {
    if (activeTab === "audit_logs") {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  const getDepartmentMeta = (dept: string) => {
    switch (dept) {
      case "INVENTORY_STORE":
        return { label: "Store & Warehouse", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "EXECUTIVE_MANAGEMENT":
        return { label: "Executive Hub", color: "bg-purple-50 text-purple-700 border-purple-200" };
      case "PRODUCTION":
        return { label: "Production Floor", color: "bg-rose-50 text-[#CF0458] border-rose-200" };
      case "SECURITY_IT":
        return { label: "Security & Access", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "LOGISTICS":
        return { label: "Logistics", color: "bg-blue-50 text-blue-700 border-blue-200" };
      default:
        return { label: dept || "System", color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const getEventTypeMeta = (type: string) => {
    switch (type) {
      case "INTAKE_RECORDED":
      case "STOCK_INTAKE_RECORDED":
        return { label: "Inbound Intake", icon: Package, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
      case "DISPENSE_RECORDED":
      case "RECIPE_DISPENSED":
        return { label: "Production Dispense", icon: Layers, color: "text-rose-600 bg-rose-50 border-rose-100" };
      case "DISPENSE_UPDATED":
        return { label: "Handover Edited", icon: RotateCcw, color: "text-amber-600 bg-amber-50 border-amber-100" };
      case "DISPENSE_CANCELLED":
        return { label: "Dispatch Cancelled", icon: AlertOctagon, color: "text-red-600 bg-red-50 border-red-100" };
      case "REQUISITION_APPROVED":
        return { label: "Requisition Vetted", icon: FileCheck2, color: "text-purple-600 bg-purple-50 border-purple-100" };
      case "RETURN_RECORDED":
        return { label: "Material Return", icon: RotateCcw, color: "text-amber-600 bg-amber-50 border-amber-100" };
      case "DAMAGE_RECORDED":
        return { label: "Damage / Spoilage", icon: AlertOctagon, color: "text-red-600 bg-red-50 border-red-100" };
      case "SHIFT_RECONCILED":
        return { label: "Shift Reconciled", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
      case "STAFF_CREATED":
      case "STAFF_UPDATED":
      case "STAFF_DEACTIVATED":
      case "STAFF_PERMANENT_DELETED":
        return { label: "Staff Administration", icon: ShieldCheck, color: "text-slate-700 bg-slate-100 border-slate-200" };
      case "DISPATCH_TRIP_CREATED":
        return { label: "Logistics Dispatch", icon: Truck, color: "text-blue-600 bg-blue-50 border-blue-100" };
      default:
        return { label: type?.replace(/_/g, " ") || "System Event", icon: Activity, color: "text-slate-600 bg-slate-100 border-slate-200" };
    }
  };

  const formatAuditNarrative = (evt: AuditEvent) => {
    const p = evt.payload || {};
    switch (evt.type) {
      case "STOCK_INTAKE_RECORDED":
      case "INTAKE_RECORDED":
        return `Received ${p.quantity ? `${p.quantity} units of ` : ""}${p.itemName || "materials"}${p.grnNumber ? ` under GRN #${p.grnNumber}` : ""}.`;
      case "RECIPE_DISPENSED":
      case "DISPENSE_RECORDED":
        return `Dispensed materials for ${p.recipeName || p.itemName || "batch"}${p.referenceId ? ` (Ref: ${p.referenceId})` : ""}${p.recipient ? ` to ${p.recipient}` : ""}.`;
      case "DISPENSE_UPDATED":
        return `Adjusted handover quantities for dispatch ${p.referenceId || ""}.`;
      case "DISPENSE_CANCELLED":
        return `Cancelled dispatch ${p.referenceId || ""}. Deducted materials returned to warehouse stock.`;
      case "REQUISITION_APPROVED":
        return `Digitally vetted and approved material requisition ${p.referenceId || ""}.`;
      case "RETURN_RECORDED":
        return `Processed return of ${p.quantity || ""} ${p.unit || ""} ${p.itemName || "material"}${p.reason ? ` (${p.reason})` : ""}.`;
      case "DAMAGE_RECORDED":
        return `Recorded damage of -${p.quantity || ""} ${p.unit || ""} ${p.itemName || "material"} (${p.reason || "defective"}).`;
      case "SHIFT_RECONCILED":
        return `Reconciled and locked store stock for ${p.shiftDate || "active shift"} (${p.shiftType || ""}).`;
      default:
        return p.notes || p.description || p.message || JSON.stringify(p);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Plant Operations & Activity Logs
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Open operational shift log records and cross-departmental auditing accessible to all plant personnel.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar flex-nowrap shrink-0 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("shift_logs")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "shift_logs"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Operations Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit_logs")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "audit_logs"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Central System Audit Trail</span>
          {auditEvents.length > 0 && (
            <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
              {auditEvents.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SHIFT OPERATIONS LOGS */}
      {activeTab === "shift_logs" && (
        <ShiftOperationsLogView readOnly={false} />
      )}

      {/* TAB 2: CENTRAL SYSTEM AUDIT TRAIL */}
      {activeTab === "audit_logs" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search performer, item, note, or ID..."
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden transition-all"
              />
              {auditSearchQuery && (
                <button
                  type="button"
                  onClick={() => setAuditSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={fetchAuditLogs}
                disabled={auditLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin text-[#CF0458]" : ""}`}
                />
                <span>Refresh Audit Logs</span>
              </button>
            </div>
          </div>

          {/* Department Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            {[
              { id: "ALL", label: "All Departments" },
              { id: "INVENTORY_STORE", label: "Store & Warehouse" },
              { id: "PRODUCTION", label: "Production Floor" },
              { id: "EXECUTIVE_MANAGEMENT", label: "Executive & Management" },
              { id: "LOGISTICS", label: "Logistics" },
              { id: "SECURITY_IT", label: "Security & Access" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAuditDeptFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  auditDeptFilter === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Audit Events Feed */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#CF0458]" />
                  <span>Central System Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological record of operational transactions and actions across departments
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-slate-400">
                {auditEvents.length} events logged
              </span>
            </div>

            {auditLoading && auditEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                <span>Loading system audit logs...</span>
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#059669] mx-auto mb-2 opacity-60" />
                <p className="text-xs font-bold text-slate-700">No matching audit events</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Try adjusting the department filter or search terms.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditEvents.map((evt) => {
                  const dept = getDepartmentMeta(evt.departmentCode);
                  const meta = getEventTypeMeta(evt.type);
                  const Icon = meta.icon;
                  const initials = (evt.performerName || "SYS")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={evt.id}
                      className="p-4 sm:p-4.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {evt.performerName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${dept.color}`}
                            >
                              {dept.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${meta.color}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{meta.label}</span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 font-medium">
                            {formatAuditNarrative(evt)}
                          </p>

                          {evt.payload && Object.keys(evt.payload).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500 font-mono">
                              {evt.payload.grnNumber && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  GRN: {evt.payload.grnNumber}
                                </span>
                              )}
                              {evt.payload.referenceId && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  Ref: {evt.payload.referenceId}
                                </span>
                              )}
                              {evt.payload.reason && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  Reason: {evt.payload.reason}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0 text-right text-xs gap-1 sm:pl-3">
                        <span className="text-slate-600 font-medium flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {new Date(evt.timestamp).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {new Date(evt.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {evt.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
