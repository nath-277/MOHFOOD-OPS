"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { WorkOrder, EquipmentItem } from "@/server/production/store";
import { CreateWorkOrderModal } from "@/components/production/CreateWorkOrderModal";
import { EditWorkOrderModal } from "@/components/production/EditWorkOrderModal";
import { RecordYieldModal } from "@/components/production/RecordYieldModal";
import { SupervisorRequisitionsView } from "@/components/production/SupervisorRequisitionsView";
import {
  ClipboardList,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Settings,
  Scale,
  Sun,
  Moon,
  Search,
  X,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Check,
  FileCheck2,
  Pencil,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function ProductionDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "requisitions" | "shifts">("orders");

  // Role permissions
  const isStoreStaff = user?.role === "STORE_MANAGER";
  const canManage = !isStoreStaff;
  const isPrivilegedUser = user?.role === "SUPER_ADMIN" || user?.role === "EXECUTIVE" || user?.role === "ACCOUNTANT";

  // Target customization state
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<number>(400);
  const [savingTarget, setSavingTarget] = useState(false);

  // Live Data
  const [overview, setOverview] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [selectedYieldOrder, setSelectedYieldOrder] = useState<WorkOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Enforce store staff tab restriction
  useEffect(() => {
    if (isStoreStaff && activeTab === "shifts") {
      setActiveTab("orders");
    }
  }, [isStoreStaff, activeTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInput || targetInput <= 0) return;
    try {
      setSavingTarget(true);
      const res = await fetch("/api/production/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTargetCapacity: Number(targetInput) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update daily target.");
      setOverview((prev: any) => (prev ? { ...prev, dailyTargetCapacity: Number(targetInput) } : prev));
      setIsEditingTarget(false);
      showToast(`Daily output target updated to ${targetInput} units.`);
    } catch (err: any) {
      showToast(err.message || "Failed to update target.");
    } finally {
      setSavingTarget(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [overviewRes, ordersRes, eqRes] = await Promise.all([
        fetch("/api/production/overview"),
        fetch(`/api/production/work-orders?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`),
        fetch("/api/production/equipment"),
      ]);

      if (overviewRes.ok) {
        const d = await overviewRes.json();
        setOverview(d);
      }
      if (ordersRes.ok) {
        const d = await ordersRes.json();
        setWorkOrders(d.workOrders || []);
      }
      if (eqRes.ok) {
        const d = await eqRes.json();
        setEquipment(d.equipment || []);
      }
    } catch (err) {
      console.error("Failed to load production data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteOrder = async (order: WorkOrder) => {
    if (!window.confirm(`Are you sure you want to delete work order ${order.orderNumber}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/production/work-orders/${order.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete work order.");
      showToast(`Work order ${order.orderNumber} deleted.`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete work order.");
    }
  };

  const handleAdvanceStatus = async (orderId: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/production/work-orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to advance stage.");
      showToast(`Work order advanced to ${nextStatus}.`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Action failed.");
    }
  };

  const formatStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return { label: "Scheduled", color: "text-slate-700 bg-slate-100 border-slate-200" };
      case "MIXING":
        return { label: "Mixing & Fermenting", color: "text-amber-700 bg-amber-50 border-amber-200" };
      case "PACKAGING":
        return { label: "Packaging Line", color: "text-blue-700 bg-blue-50 border-blue-200" };
      case "COMPLETED":
        return { label: "Completed & Signed", color: "text-[#059669] bg-emerald-50 border-emerald-200" };
      default:
        return { label: status, color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#059669] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Plant Floor Operations
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Mixing, Pasteurization & Packaging Lines
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Production Mixing Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule work orders, track actual yield against recipe targets, and monitor equipment temperatures.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {canManage && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Order</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Target Customization Modal */}
      {isEditingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 relative font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Custom Daily Output Target</h3>
                <p className="text-[11px] text-slate-400">Executive & Admin Plant KPI</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingTarget(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveTarget} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Daily Expected Units (Standard 400)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={targetInput}
                  onChange={(e) => setTargetInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono text-slate-900 font-bold focus:bg-white focus:border-[#CF0458] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Configured output goal used for plant utilization metrics.
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTarget}
                  className="px-3.5 py-1.5 rounded-lg bg-[#CF0458] text-white font-bold hover:bg-[#B5034C] disabled:opacity-50 cursor-pointer"
                >
                  {savingTarget ? "Saving..." : "Update Target"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                Daily Output Target
              </span>
              {isPrivilegedUser && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetInput(overview?.dailyTargetCapacity || 400);
                    setIsEditingTarget(true);
                  }}
                  className="inline-flex items-center gap-0.5 text-[10px] text-[#CF0458] font-bold hover:underline cursor-pointer"
                  title="Customize Expected Daily Target"
                >
                  <Pencil className="w-2.5 h-2.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {overview ? overview.dailyUnitsProduced : "..."} <span className="text-[10px] sm:text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              {overview
                ? `${Math.round((overview.dailyUnitsProduced / (overview.dailyTargetCapacity || 400)) * 100)}% of target (${overview.dailyTargetCapacity || 400})`
                : "Loading..."}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Active Mixing Runs
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {overview ? overview.activeBatchesCount : "..."} <span className="text-[10px] sm:text-xs font-normal text-slate-500">Batches</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              In mixing or packaging
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Avg Yield Efficiency
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#059669] mt-0.5 sm:mt-1 font-mono truncate">
              {overview ? `${overview.averageYieldEfficiency}%` : "..."}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Recipe BOM adherence
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-[#059669] flex items-center justify-center shrink-0 ml-2">
            <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar flex-nowrap shrink-0 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "orders"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Work Orders & Batch Runs</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {workOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("requisitions")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "requisitions"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          <span>Store Requisitions & Vetting</span>
        </button>

        {!isStoreStaff && (
          <button
            type="button"
            onClick={() => setActiveTab("shifts")}
            className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "shifts"
                ? "border-[#CF0458] text-[#CF0458]"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Shift Schedule Handovers</span>
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* TAB 1: WORK ORDERS */}
      {/* ============================================================ */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search order #, recipe, batch ID..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto">
              {[
                { id: "ALL", label: "All Runs" },
                { id: "SCHEDULED", label: "Scheduled" },
                { id: "MIXING", label: "In Mixing" },
                { id: "PACKAGING", label: "In Packaging" },
                { id: "COMPLETED", label: "Completed" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Order # & Shift</th>
                    <th className="py-3 px-3">Product Formulation</th>
                    <th className="py-3 px-3 text-right">Target Output</th>
                    <th className="py-3 px-3 text-right">Actual Yield</th>
                    <th className="py-3 px-3 text-center">Efficiency</th>
                    <th className="py-3 px-3 text-center">Stage Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading production work orders...
                      </td>
                    </tr>
                  ) : workOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No work orders found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const paginatedOrders = workOrders.slice(
                        (currentPage - 1) * pageSize,
                        currentPage * pageSize
                      );

                      return paginatedOrders.map((wo) => {
                        const badge = formatStatusBadge(wo.status);
                        const isFuture = Boolean(wo.scheduledDate && wo.scheduledDate > todayStr);

                        return (
                          <tr key={wo.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 font-mono">{wo.orderNumber}</div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                {wo.shiftType === "MORNING_SHIFT" ? (
                                  <>
                                    <Sun className="w-3 h-3 text-amber-500" />
                                    <span>Morning</span>
                                  </>
                                ) : (
                                  <>
                                    <Moon className="w-3 h-3 text-indigo-400" />
                                    <span>Night</span>
                                  </>
                                )}
                                <span>• {wo.scheduledDate}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{wo.recipeName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{wo.recipeCode}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {wo.targetQuantity} units
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold">
                              {wo.status === "COMPLETED" ? (
                                <span className="text-[#059669]">{wo.actualYield} units</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {wo.status === "COMPLETED" ? (
                                <span className="font-mono font-bold text-slate-800 text-[11px]">
                                  {wo.yieldEfficiency}%
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">In progress</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!canManage ? (
                                  <span className="text-[11px] font-semibold text-slate-400">
                                    View Only
                                  </span>
                                ) : isFuture ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold cursor-not-allowed select-none"
                                    title={`Scheduled for future date (${wo.scheduledDate}). Actions locked until scheduled day.`}
                                  >
                                    <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>Future ({wo.scheduledDate.slice(5)})</span>
                                  </span>
                                ) : wo.status === "SCHEDULED" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAdvanceStatus(wo.id, "MIXING")}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-all cursor-pointer"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>Start Mixing</span>
                                  </button>
                                ) : wo.status === "MIXING" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAdvanceStatus(wo.id, "PACKAGING")}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white font-bold text-[11px] transition-all cursor-pointer"
                                  >
                                    <span>To Packaging</span>
                                  </button>
                                ) : wo.status === "PACKAGING" ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedYieldOrder(wo)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-[11px] transition-all cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Record Yield</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-semibold text-slate-400">
                                    Completed
                                  </span>
                                )}

                                {canManage && (
                                  <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 pl-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setEditingOrder(wo)}
                                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                      title="Edit work order"
                                      aria-label="Edit work order"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteOrder(wo)}
                                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                      title="Delete work order"
                                      aria-label="Delete work order"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (Max 10 per page) */}
            {workOrders.length > 0 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
                <div>
                  Showing <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{" "}
                  <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, workOrders.length)}</span> of{" "}
                  <span className="font-bold text-slate-800">{workOrders.length}</span> orders
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="px-2 font-mono text-[11px] font-bold text-slate-700">
                    Page {currentPage} of {Math.max(1, Math.ceil(workOrders.length / pageSize))}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(Math.max(1, Math.ceil(workOrders.length / pageSize)), p + 1))}
                    disabled={currentPage === Math.max(1, Math.ceil(workOrders.length / pageSize))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: STORE REQUISITIONS & VETTING */}
      {/* ============================================================ */}
      {activeTab === "requisitions" && (
        <SupervisorRequisitionsView readOnly={!canManage} />
      )}

      {/* ============================================================ */}
      {/* TAB: SHIFT SCHEDULE HANDOVERS */}
      {/* ============================================================ */}
      {activeTab === "shifts" && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Plant Dual-Shift Production Schedule</h3>
            <p className="text-xs text-slate-500">
              Moh Foods operates two continuous factory shifts with scheduled sanitation windows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Morning Shift Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Morning Shift (Day Run)</span>
                </span>
                {new Date().getHours() >= 8 && new Date().getHours() < 18 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-emerald-50 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                    Active Now
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                    Scheduled (08:00)
                  </span>
                )}
              </div>
              <div className="font-mono text-slate-700 font-bold">08:00 – 18:00 (10 Hours)</div>
              <p className="text-slate-500 text-[11px]">
                Primary production of Moh Yogurt Parfaits (fresh fruit slicing, layering, granola top-off, rotary cup sealing).
              </p>
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-center justify-between">
                <div>
                  Lead Supervisor: <span className="font-semibold text-slate-900">{overview?.supervisors?.[0] || "Aishah Anuoluwapo"}</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">Weekly Rotation</span>
              </div>
            </div>

            {/* Night Shift Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Night Shift (Overnight Processing)</span>
                </span>
                {new Date().getHours() < 8 || new Date().getHours() >= 18 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-emerald-50 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                    Active Now
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                    Scheduled (18:00)
                  </span>
                )}
              </div>
              <div className="font-mono text-slate-700 font-bold">18:00 – 08:00 (14 Hours)</div>
              <p className="text-slate-500 text-[11px]">
                Industrial milk pasteurization, inoculation & overnight fermentation of Greek Yogurt and Vanilla Yogurt Drink bases.
              </p>
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 flex items-center justify-between">
                <div>
                  Lead Supervisor: <span className="font-semibold text-slate-900">{overview?.supervisors?.[1] || "Aunty Ada"}</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400">Weekly Rotation</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateWorkOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          loadData();
          showToast("Work order scheduled successfully.");
        }}
        equipment={equipment}
      />

      <RecordYieldModal
        isOpen={!!selectedYieldOrder}
        onClose={() => setSelectedYieldOrder(null)}
        onSuccess={() => {
          loadData();
          showToast("Batch yield and scrap reconciled.");
        }}
        workOrder={selectedYieldOrder}
      />

      <EditWorkOrderModal
        isOpen={Boolean(editingOrder)}
        onClose={() => setEditingOrder(null)}
        onSuccess={() => {
          loadData();
          showToast("Work order updated successfully.");
        }}
        order={editingOrder}
      />
    </div>
  );
}
