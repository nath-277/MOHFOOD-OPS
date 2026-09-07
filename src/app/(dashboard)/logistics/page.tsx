"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { FleetVehicle, DeliveryRun } from "@/server/logistics/store";
import { DispatchRunModal } from "@/components/logistics/DispatchRunModal";
import {
  Truck,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Search,
  X,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Layers,
  Thermometer,
  ShieldCheck,
  Check,
  MapPin,
  Phone,
  Store,
  ArrowRight,
} from "lucide-react";

export default function LogisticsDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"runs" | "fleet" | "stockists">("runs");

  // Live Data
  const [overview, setOverview] = useState<any>(null);
  const [runs, setRuns] = useState<DeliveryRun[]>([]);
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Interactivity
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tempUpdateModal, setTempUpdateModal] = useState<{
    open: boolean;
    type: "vehicle" | "run";
    id: string;
    currentTemp: number;
    title: string;
  } | null>(null);
  const [newTempInput, setNewTempInput] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [overviewRes, runsRes, fleetRes] = await Promise.all([
        fetch("/api/logistics/overview"),
        fetch(`/api/logistics/runs?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`),
        fetch("/api/logistics/fleet"),
      ]);

      if (overviewRes.ok) {
        const d = await overviewRes.json();
        setOverview(d);
      }
      if (runsRes.ok) {
        const d = await runsRes.json();
        setRuns(d.runs || []);
      }
      if (fleetRes.ok) {
        const d = await fleetRes.json();
        setFleet(d.fleet || []);
      }
    } catch (err) {
      console.error("Failed to load logistics data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdvanceRunStatus = async (
    runId: string,
    nextStatus: "SCHEDULED" | "IN_TRANSIT" | "DELIVERED_COLLECTING" | "RETURNED_RECONCILED",
    currentTemp?: number
  ) => {
    try {
      const res = await fetch(`/api/logistics/runs/${runId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, currentTemp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update run status.");
      showToast(`Run advanced to ${nextStatus.replace(/_/g, " ")}.`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Action failed.");
    }
  };

  const handleSaveTempLog = async () => {
    if (!tempUpdateModal) return;
    const tempVal = parseFloat(newTempInput);
    if (isNaN(tempVal)) {
      showToast("Please enter a valid temperature in °C.");
      return;
    }

    try {
      if (tempUpdateModal.type === "vehicle") {
        const res = await fetch(`/api/logistics/fleet/${tempUpdateModal.id}/temperature`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ temp: tempVal }),
        });
        if (!res.ok) throw new Error("Failed to calibrate vehicle temperature.");
        showToast(`Vehicle temperature logged at ${tempVal}°C.`);
      } else {
        const run = runs.find((r) => r.id === tempUpdateModal.id);
        if (run) {
          await handleAdvanceRunStatus(run.id, run.status, tempVal);
          showToast(`In-transit probe logged at ${tempVal}°C.`);
        }
      }
      setTempUpdateModal(null);
      setNewTempInput("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save temperature.");
    }
  };

  const formatRunStatusBadge = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return { label: "Scheduled", color: "text-slate-700 bg-slate-100 border-slate-200" };
      case "IN_TRANSIT":
        return { label: "In Cold Transit", color: "text-blue-700 bg-blue-50 border-blue-200" };
      case "DELIVERED_COLLECTING":
        return { label: "At Retail Stockist", color: "text-amber-700 bg-amber-50 border-amber-200" };
      case "RETURNED_RECONCILED":
        return { label: "Returned & Settled", color: "text-[#059669] bg-emerald-50 border-emerald-200" };
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
              Cold-Chain Distribution
            </span>
            <span className="text-xs font-semibold text-slate-400">
              NAFDAC Standard 2.0°C – 4.0°C Refrigerated Logistics
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Logistics & Fleet Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor refrigerated vans, dispatch stockist delivery runs, and track real-time temperatures.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsDispatchOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Dispatch Delivery Run</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Delivery Runs
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {overview ? overview.activeRunsCount : "..."} <span className="text-xs font-normal text-slate-500">En Route</span>
            </div>
            <div className="text-[11px] font-medium text-blue-600 mt-0.5">
              Live delivery or collecting
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Units in Cold Transit
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {overview ? overview.totalUnitsInTransit : "..."} <span className="text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Dispatched across all vans
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Cold-Chain Compliance
            </div>
            <div className="text-2xl font-bold text-[#059669] mt-1 font-mono">
              {overview ? `${overview.coldChainComplianceRate}%` : "..."}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Within 2.0°C – 4.0°C range
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#059669] flex items-center justify-center">
            <Thermometer className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Fleet Availability
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {overview ? `${overview.availableVehiclesCount} / ${overview.totalFleetCount}` : "..."}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Ready for immediate dispatch
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("runs")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "runs"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Active Runs & Dispatch Manifests</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {runs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fleet")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "fleet"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Thermometer className="w-4 h-4" />
          <span>Refrigerated Fleet Directory</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {fleet.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("stockists")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "stockists"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Stockist Network & SoR Waybills</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: RUNS & MANIFESTS */}
      {/* ============================================================ */}
      {activeTab === "runs" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dispatch #, driver, stockist..."
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
                { id: "IN_TRANSIT", label: "In Transit" },
                { id: "DELIVERED_COLLECTING", label: "At Stockist" },
                { id: "RETURNED_RECONCILED", label: "Reconciled" },
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

          {/* Runs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Dispatch # & Time</th>
                    <th className="py-3 px-3">Vehicle & Driver</th>
                    <th className="py-3 px-3">Stockist Drops</th>
                    <th className="py-3 px-3 text-right">Units</th>
                    <th className="py-3 px-3 text-center">Cold Temp</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading delivery runs...
                      </td>
                    </tr>
                  ) : runs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No delivery runs found matching the filter.
                      </td>
                    </tr>
                  ) : (
                    runs.map((run) => {
                      const badge = formatRunStatusBadge(run.status);
                      const latestTemp =
                        run.temperatureLogs[run.temperatureLogs.length - 1]?.tempCelsius ?? 3.0;
                      const isTempSafe = latestTemp <= 4.0;

                      return (
                        <tr key={run.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 font-mono">
                              {run.dispatchNumber}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>
                                {new Date(run.departureTime).toLocaleTimeString("en-NG", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{run.vehicleName.split(" - ")[0]}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <span>{run.driverName}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              {run.stops.map((s, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  <span className="font-medium text-slate-800">
                                    {s.stockistName.split(" ")[0]}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    ({s.units}u)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {run.totalUnitsDispatched}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setTempUpdateModal({
                                  open: true,
                                  type: "run",
                                  id: run.id,
                                  currentTemp: latestTemp,
                                  title: `Log Probe Temp for ${run.dispatchNumber}`,
                                });
                                setNewTempInput(latestTemp.toString());
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                                isTempSafe
                                  ? "bg-emerald-50 text-[#059669] border-emerald-200 hover:bg-emerald-100"
                                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              }`}
                            >
                              <Thermometer className="w-3 h-3" />
                              <span>{latestTemp}°C</span>
                            </button>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {run.status === "SCHEDULED" && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceRunStatus(run.id, "IN_TRANSIT")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Depart Plant</span>
                              </button>
                            )}

                            {run.status === "IN_TRANSIT" && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceRunStatus(run.id, "DELIVERED_COLLECTING")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <span>At Stockist</span>
                              </button>
                            )}

                            {run.status === "DELIVERED_COLLECTING" && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceRunStatus(run.id, "RETURNED_RECONCILED")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-[11px] transition-all cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Reconcile Return</span>
                              </button>
                            )}

                            {run.status === "RETURNED_RECONCILED" && (
                              <span className="text-[11px] font-semibold text-slate-400">
                                Manifest Reconciled
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
      {/* TAB 2: REFRIGERATED FLEET DIRECTORY */}
      {/* ============================================================ */}
      {activeTab === "fleet" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fleet.map((vehicle) => {
            const isAvailable = vehicle.status === "AVAILABLE";
            const isTempSafe = vehicle.currentTemp <= 4.0;

            return (
              <div
                key={vehicle.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-slate-600 px-2 py-0.5 bg-slate-100 rounded">
                      {vehicle.plateNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isAvailable
                          ? "text-[#059669] bg-emerald-50 border-emerald-200"
                          : vehicle.status === "ON_DELIVERY_RUN"
                          ? "text-blue-700 bg-blue-50 border-blue-200"
                          : "text-slate-600 bg-slate-100 border-slate-200"
                      }`}
                    >
                      {vehicle.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mt-1">{vehicle.vehicleName}</h3>

                  {/* Core Box Temperature Meter */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Cold Box Temp
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Target: {vehicle.targetTempRange}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTempUpdateModal({
                          open: true,
                          type: "vehicle",
                          id: vehicle.id,
                          currentTemp: vehicle.currentTemp,
                          title: `Calibrate Temp for ${vehicle.plateNumber}`,
                        });
                        setNewTempInput(vehicle.currentTemp.toString());
                      }}
                      className={`px-3 py-1 rounded-lg font-mono font-bold text-base border transition-all cursor-pointer ${
                        isTempSafe
                          ? "bg-emerald-50 text-[#059669] border-emerald-200 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      {vehicle.currentTemp}°C
                    </button>
                  </div>

                  {/* Driver Details */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Driver:</span>
                      <span className="font-bold text-slate-800">{vehicle.driverName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Contact:</span>
                      <span className="font-mono text-slate-700">{vehicle.driverPhone}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Box Capacity:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {vehicle.capacityUnits} units
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">NAFDAC Cold Audit:</span>
                  <span className="font-bold text-[#059669] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Certified Chilled</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: STOCKIST NETWORK & SOR WAYBILLS */}
      {/* ============================================================ */}
      {activeTab === "stockists" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Registered Retail Accounts & Cold Delivery Windows
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Strict delivery window enforcement ensuring yogurt arrives before supermarket shelves experience peak ambient temperature.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
              {[
                {
                  name: "Hubmart Supermarket",
                  branch: "Ikeja GRA, Lagos",
                  window: "09:00 – 11:30",
                  terms: "Sale-or-Return (SoR)",
                  contact: "Mr. Femi (Procurement)",
                },
                {
                  name: "Prince Ebeano Supermarket",
                  branch: "Lekki Phase 1, Lagos",
                  window: "10:30 – 13:00",
                  terms: "Direct Cash / Transfer",
                  contact: "Madam Chioma (Dairy Dept)",
                },
                {
                  name: "Justrite Superstore",
                  branch: "Magodo Shangisha, Lagos",
                  window: "09:00 – 12:00",
                  terms: "Sale-or-Return (SoR)",
                  contact: "Alhaji Bello",
                },
                {
                  name: "Spar Hypermarket",
                  branch: "Victoria Island, Lagos",
                  window: "11:00 – 14:00",
                  terms: "Weekly Central Invoicing",
                  contact: "Mrs. Nkechi",
                },
                {
                  name: "Shoprite Circle Mall",
                  branch: "Jakande, Lekki, Lagos",
                  window: "10:00 – 13:30",
                  terms: "Central Warehouse SoR",
                  contact: "Receiving Bay 3",
                },
              ].map((stk, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{stk.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#8E1538] bg-rose-50 border border-rose-100">
                      {stk.terms}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{stk.branch}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Chilled Window:</span>
                    <span className="font-mono font-bold text-slate-800">{stk.window}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-600">
                    <span className="text-slate-400">Receiving Rep:</span>
                    <span className="font-medium text-slate-700">{stk.contact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      <DispatchRunModal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        onSuccess={() => {
          loadData();
          showToast("Delivery run dispatched successfully.");
        }}
        fleet={fleet}
      />

      {/* Temperature Calibration / Log Modal */}
      {tempUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{tempUpdateModal.title}</h3>
              <button
                type="button"
                onClick={() => setTempUpdateModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Temperature Reading (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={newTempInput}
                onChange={(e) => setNewTempInput(e.target.value)}
                placeholder="e.g. 2.8"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold text-slate-800 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                autoFocus
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Target cold-chain range: 2.0°C – 4.0°C. Above 4.5°C triggers warning.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTempUpdateModal(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTempLog}
                className="px-4 py-1.5 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
