"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { WorkOrder, EquipmentItem } from "@/server/production/store";
import { CreateWorkOrderModal } from "@/components/production/CreateWorkOrderModal";
import { RecordYieldModal } from "@/components/production/RecordYieldModal";
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
  Thermometer,
  ShieldCheck,
  Check,
} from "lucide-react";

export default function ProductionDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"orders" | "equipment" | "shifts">("orders");

  // Live Data
  const [overview, setOverview] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedYieldOrder, setSelectedYieldOrder] = useState<WorkOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
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
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Order</span>
          </button>

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

      {/* 4 Quiet Metric Summary Cards - 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Daily Output
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {overview ? overview.dailyUnitsProduced : "..."} <span className="text-[10px] sm:text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              {overview
                ? `${Math.round((overview.dailyUnitsProduced / overview.dailyTargetCapacity) * 100)}% of target (${overview.dailyTargetCapacity})`
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

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Line Equipment
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {overview ? `${overview.equipmentRunningCount} / ${overview.totalEquipmentCount}` : "..."}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Active machinery
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Thermometer className="w-4 h-4 sm:w-5 sm:h-5" />
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
              ? "border-[#8E1538] text-[#8E1538]"
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
          onClick={() => setActiveTab("equipment")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "equipment"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Equipment & Temperatures</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {equipment.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shifts")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "shifts"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Shift Schedule Handovers</span>
        </button>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, recipe, batch ID..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
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
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? "bg-[#8E1538] text-white shadow-xs"
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
                    <th className="py-3 px-3">Assigned Line</th>
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
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Loading production work orders...
                      </td>
                    </tr>
                  ) : workOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No work orders found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    workOrders.map((wo) => {
                      const badge = formatStatusBadge(wo.status);

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
                          <td className="py-3 px-3 text-[11px] text-slate-600">
                            {wo.mixingTankName}
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
                            {wo.status === "SCHEDULED" && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(wo.id, "MIXING")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Start Mixing</span>
                              </button>
                            )}

                            {wo.status === "MIXING" && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceStatus(wo.id, "PACKAGING")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <span>To Packaging</span>
                              </button>
                            )}

                            {wo.status === "PACKAGING" && (
                              <button
                                type="button"
                                onClick={() => setSelectedYieldOrder(wo)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Record Yield</span>
                              </button>
                            )}

                            {wo.status === "COMPLETED" && (
                              <span className="text-[11px] font-semibold text-slate-400">
                                Sign-off Locked
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: EQUIPMENT & TEMPERATURES */}
      {/* ============================================================ */}
      {activeTab === "equipment" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {equipment.map((eq) => {
            const isRunning = eq.status === "RUNNING";

            return (
              <div
                key={eq.id}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-slate-400 font-bold">{eq.code}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isRunning
                          ? "text-[#059669] bg-emerald-50 border-emerald-200"
                          : "text-slate-600 bg-slate-100 border-slate-200"
                      }`}
                    >
                      {isRunning ? "Running" : eq.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{eq.name}</h3>

                  {eq.currentTemp !== undefined && (
                    <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Core Temp:</span>
                      <span className="font-mono font-bold text-slate-900 text-base">
                        {eq.currentTemp}°C
                      </span>
                    </div>
                  )}

                  <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                    <div>
                      Operator: <span className="font-semibold text-slate-700">{eq.assignedOperator}</span>
                    </div>
                    <div>
                      Sanitation CIP:{" "}
                      <span className="font-mono text-slate-700">
                        {new Date(eq.lastCleaned).toLocaleDateString("en-NG", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">NAFDAC GMP Status:</span>
                  <span className="font-bold text-[#059669] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Compliant</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: SHIFT SCHEDULE HANDOVERS */}
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
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Morning Shift (Day Run)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-emerald-50 border border-emerald-200">
                  Active
                </span>
              </div>
              <div className="font-mono text-slate-700 font-bold">08:00 – 18:00 (10 Hours)</div>
              <p className="text-slate-500 text-[11px]">
                Primary production of Moh Yogurt Parfaits (fresh fruit slicing, layering, granola top-off, rotary cup sealing).
              </p>
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                Lead Supervisor: <span className="font-semibold text-slate-900">David Adeleke</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span>Night Shift (Overnight Processing)</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                  Scheduled
                </span>
              </div>
              <div className="font-mono text-slate-700 font-bold">18:00 – 08:00 (14 Hours)</div>
              <p className="text-slate-500 text-[11px]">
                Industrial milk pasteurization, inoculation & overnight fermentation of Greek Yogurt and Vanilla Yogurt Drink bases.
              </p>
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                Lead Supervisor: <span className="font-semibold text-slate-900">Emmanuel Udoh</span>
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
    </div>
  );
}
