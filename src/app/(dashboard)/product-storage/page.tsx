"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { FinishedGoodsBatch, FinishedGoodsTransfer } from "@/server/product-storage/store";
import {
  Boxes,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Search,
  X,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Thermometer,
  ShieldCheck,
  Truck,
  Upload,
  Camera,
  ExternalLink,
  Layers,
  FileText,
} from "lucide-react";

export default function ProductStoragePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"batches" | "transfers">("batches");

  // Live Data
  const [overview, setOverview] = useState<any>(null);
  const [batches, setBatches] = useState<FinishedGoodsBatch[]>([]);
  const [transfers, setTransfers] = useState<FinishedGoodsTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [selectedBatchForDispatch, setSelectedBatchForDispatch] = useState<FinishedGoodsBatch | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Intake Form State
  const [intakeProductCode, setIntakeProductCode] = useState("REC-PARFAIT-400ML");
  const [intakeProductName, setIntakeProductName] = useState("Moh Yogurt Parfait (400ml Cup)");
  const [intakeQuantity, setIntakeQuantity] = useState("");
  const [intakeYieldUnit, setIntakeYieldUnit] = useState("cup");
  const [intakeColdBay, setIntakeColdBay] = useState("Cold Room C (Finished Goods)");
  const [intakeTemp, setIntakeTemp] = useState("3.2");
  const [intakeShelfLifeDays, setIntakeShelfLifeDays] = useState("14");
  const [intakeNotes, setIntakeNotes] = useState("");
  const [submittingIntake, setSubmittingIntake] = useState(false);

  // Dispatch Form State
  const [dispatchBatchId, setDispatchBatchId] = useState("");
  const [dispatchQuantity, setDispatchQuantity] = useState("");
  const [dispatchDriverName, setDispatchDriverName] = useState("Sunday Balogun");
  const [dispatchVehiclePlate, setDispatchVehiclePlate] = useState("LAG-882-XA (Toyota HiAce Chill)");
  const [dispatchWaybillNumber, setDispatchWaybillNumber] = useState("");
  const [dispatchWaybillPhotoUrl, setDispatchWaybillPhotoUrl] = useState("");
  const [dispatchTemp, setDispatchTemp] = useState("3.0");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [overviewRes, batchesRes, transfersRes] = await Promise.all([
        fetch("/api/product-storage/overview"),
        fetch(`/api/product-storage/batches?status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`),
        fetch("/api/product-storage/transfers?limit=60"),
      ]);

      if (overviewRes.ok) {
        const d = await overviewRes.json();
        setOverview(d);
      }
      if (batchesRes.ok) {
        const d = await batchesRes.json();
        setBatches(d.batches || []);
      }
      if (transfersRes.ok) {
        const d = await transfersRes.json();
        setTransfers(d.transfers || []);
      }
    } catch (err) {
      console.error("Failed to load product storage data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Waybill photo upload to Cloudflare R2
  const handleWaybillUpload = async (file: File) => {
    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "waybills");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload waybill photo.");
      }

      setDispatchWaybillPhotoUrl(data.url);
      showToast("Waybill document uploaded to Cloudflare R2 storage.");
    } catch (err: any) {
      showToast(err.message || "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Submit Kitchen Intake
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeQuantity || Number(intakeQuantity) <= 0) {
      showToast("Please enter a valid quantity.");
      return;
    }

    try {
      setSubmittingIntake(true);
      const res = await fetch("/api/product-storage/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: intakeProductCode,
          productName: intakeProductName,
          quantity: Number(intakeQuantity),
          yieldUnit: intakeYieldUnit,
          coldStorageBay: intakeColdBay,
          currentTemp: Number(intakeTemp),
          shelfLifeDays: Number(intakeShelfLifeDays),
          notes: intakeNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record intake.");

      showToast(`Batch ${data.batch.batchNumber} received into storage!`);
      setIsIntakeOpen(false);
      setIntakeQuantity("");
      setIntakeNotes("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to intake batch.");
    } finally {
      setSubmittingIntake(false);
    }
  };

  // Submit Dispatch to Rider
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchBatchId) {
      showToast("Please select a batch to dispatch.");
      return;
    }
    if (!dispatchQuantity || Number(dispatchQuantity) <= 0) {
      showToast("Please enter a valid dispatch quantity.");
      return;
    }
    if (!dispatchDriverName) {
      showToast("Please enter the driver/rider name.");
      return;
    }

    try {
      setSubmittingDispatch(true);
      const res = await fetch("/api/product-storage/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: dispatchBatchId,
          quantity: Number(dispatchQuantity),
          driverName: dispatchDriverName,
          vehiclePlate: dispatchVehiclePlate,
          waybillNumber: dispatchWaybillNumber,
          waybillPhotoUrl: dispatchWaybillPhotoUrl || undefined,
          temperature: Number(dispatchTemp),
          notes: dispatchNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch batch.");

      showToast(`Successfully dispatched ${dispatchQuantity} units to ${dispatchDriverName}!`);
      setIsDispatchOpen(false);
      setSelectedBatchForDispatch(null);
      setDispatchQuantity("");
      setDispatchNotes("");
      setDispatchWaybillPhotoUrl("");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch batch.");
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const openDispatchModalForBatch = (batch: FinishedGoodsBatch) => {
    setSelectedBatchForDispatch(batch);
    setDispatchBatchId(batch.id);
    setDispatchQuantity(batch.quantityRemaining.toString());
    setIsDispatchOpen(true);
  };

  const activeBatchesList = useMemo(() => {
    return batches.filter((b) => b.quantityRemaining > 0);
  }, [batches]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <ShieldCheck className="w-4 h-4 text-[#059669]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-[#8E1538]/10 text-[#8E1538] border border-[#8E1538]/20">
              Department: Product Storage
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Finished Goods Cold Room (2°C – 4°C)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Product Storage & Dispatch Custody
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central cold holding for finished goods from kitchen production, managed handover to logistics riders, and digital R2 waybill tracking.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsIntakeOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102c] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Intake from Kitchen</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedBatchForDispatch(null);
              setDispatchBatchId(activeBatchesList[0]?.id || "");
              setDispatchQuantity("");
              setIsDispatchOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            <span>Dispatch to Rider</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="col-span-2 sm:col-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
              Chamber Holding
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {(overview?.totalUnitsInStorage || 0).toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              Ready for dispatch
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-[#8E1538]" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Active Batches
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {overview?.activeBatchesCount ?? activeBatchesList.length} <span className="text-xs font-normal text-slate-500">Batches</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              In cold room C
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Dispatched Today
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {(overview?.dispatchedUnitsToday || 0).toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-500">Units</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              To logistics fleet
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Cold Bay Temp
            </div>
            <div className="text-base sm:text-2xl font-bold text-emerald-600 mt-0.5 sm:mt-1 font-mono truncate">
              {overview?.storageColdRoomTemp || 3.2}°C
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Target: 2.0°C – 4.0°C
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ml-2">
            <Thermometer className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto no-scrollbar flex-nowrap shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("batches")}
          className={`flex items-center gap-2 py-2.5 px-1 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "batches"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Cold Storage Batches</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-semibold">
            {batches.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("transfers")}
          className={`flex items-center gap-2 py-2.5 px-1 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "transfers"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Handover & Transfers Log</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-semibold">
            {transfers.length}
          </span>
        </button>
      </div>

      {/* TAB 1: BATCHES */}
      {activeTab === "batches" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search batch #, product name, bay..."
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

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap shrink-0 w-full md:w-auto">
              {[
                { id: "ALL", label: "All Statuses" },
                { id: "IN_CHILLER", label: "In Chiller" },
                { id: "PARTIALLY_DISPATCHED", label: "Partially Dispatched" },
                { id: "DEPLETED", label: "Depleted" },
                { id: "EXPIRED", label: "Expired" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
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

          {/* Batches Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Batch Number</th>
                    <th className="py-3 px-3">Product Name</th>
                    <th className="py-3 px-3">Cold Storage Bay</th>
                    <th className="py-3 px-3 text-right">Received</th>
                    <th className="py-3 px-3 text-right">Remaining</th>
                    <th className="py-3 px-3 text-center">Temp</th>
                    <th className="py-3 px-3">Production Date</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8E1538]" />
                        Loading finished goods batches...
                      </td>
                    </tr>
                  ) : batches.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <div className="text-xs font-semibold text-slate-700">No batches in product storage.</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Click &ldquo;Intake from Kitchen&rdquo; to receive finished batches into cold holding.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => {
                      const isDepleted = batch.quantityRemaining <= 0;
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {batch.batchNumber}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{batch.productName}</div>
                            <div className="font-mono text-[10px] text-slate-400">{batch.productCode}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            {batch.coldStorageBay}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {batch.quantityReceived.toLocaleString()} {batch.yieldUnit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            <span className={isDepleted ? "text-slate-400" : "text-[#8E1538]"}>
                              {batch.quantityRemaining.toLocaleString()} {batch.yieldUnit}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[11px] text-emerald-600 font-semibold">
                            {batch.currentTemp}°C
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                            {batch.productionDate.slice(0, 10)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isDepleted || batch.status === "DEPLETED" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                                Depleted
                              </span>
                            ) : batch.status === "EXPIRED" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-700 bg-red-50 border border-red-200">
                                Expired
                              </span>
                            ) : batch.status === "PARTIALLY_DISPATCHED" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                Partial Disp
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20">
                                In Chiller
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isDepleted && (
                              <button
                                type="button"
                                onClick={() => openDispatchModalForBatch(batch)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                Dispatch
                              </button>
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

      {/* TAB 2: TRANSFERS LOG */}
      {activeTab === "transfers" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3 text-right">Units</th>
                  <th className="py-3 px-3">Driver / Rider</th>
                  <th className="py-3 px-3">Waybill Document</th>
                  <th className="py-3 px-4">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8E1538]" />
                      Loading transfer history...
                    </td>
                  </tr>
                ) : transfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <div className="text-xs font-semibold text-slate-700">No transfer handovers recorded yet.</div>
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {t.createdAt.replace("T", " ").slice(0, 16)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {t.transferType === "INTAKE_FROM_PRODUCTION" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>Kitchen Intake</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Rider Dispatch</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {t.batchNumber}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{t.productName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{t.productCode}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {t.quantity.toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        {t.driverName ? (
                          <div>
                            <div className="font-semibold text-slate-800">{t.driverName}</div>
                            <div className="text-[10px] text-slate-400">{t.vehiclePlate}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {t.waybillPhotoUrl ? (
                          <a
                            href={t.waybillPhotoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8E1538] hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{t.waybillNumber || "View Doc"}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : t.waybillNumber ? (
                          <span className="font-mono text-[11px] text-slate-600">{t.waybillNumber}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        {t.performedByName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: INTAKE FROM KITCHEN */}
      {isIntakeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Intake Finished Goods from Kitchen</h3>
                <p className="text-xs text-slate-500">Record fresh batch received from Kitchen Production into Cold Room C.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsIntakeOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product SKU</label>
                <select
                  value={intakeProductCode}
                  onChange={(e) => {
                    setIntakeProductCode(e.target.value);
                    if (e.target.value === "REC-PARFAIT-400ML") {
                      setIntakeProductName("Moh Yogurt Parfait (400ml Cup)");
                      setIntakeYieldUnit("cup");
                    } else if (e.target.value === "REC-GREEK-500G") {
                      setIntakeProductName("Moh Greek Yogurt (500g Tub)");
                      setIntakeYieldUnit("tub");
                    } else if (e.target.value === "REC-DRINK-350ML") {
                      setIntakeProductName("Moh Vanilla Yogurt Drink (350ml Bottle)");
                      setIntakeYieldUnit("bottle");
                    } else if (e.target.value === "REC-COCONUT-250ML") {
                      setIntakeProductName("Moh Pure Coconut Oil (250ml Glass)");
                      setIntakeYieldUnit("bottle");
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden text-xs"
                >
                  <option value="REC-PARFAIT-400ML">Moh Yogurt Parfait (400ml Cup)</option>
                  <option value="REC-GREEK-500G">Moh Greek Yogurt (500g Tub)</option>
                  <option value="REC-DRINK-350ML">Moh Vanilla Yogurt Drink (350ml Bottle)</option>
                  <option value="REC-COCONUT-250ML">Moh Pure Coconut Oil (250ml Glass)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity Received</label>
                  <input
                    type="number"
                    value={intakeQuantity}
                    onChange={(e) => setIntakeQuantity(e.target.value)}
                    placeholder="e.g. 295"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Yield Unit</label>
                  <input
                    type="text"
                    value={intakeYieldUnit}
                    onChange={(e) => setIntakeYieldUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Cold Storage Bay</label>
                  <input
                    type="text"
                    value={intakeColdBay}
                    onChange={(e) => setIntakeColdBay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bay Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={intakeTemp}
                    onChange={(e) => setIntakeTemp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Quality Verification</label>
                <textarea
                  value={intakeNotes}
                  onChange={(e) => setIntakeNotes(e.target.value)}
                  rows={2}
                  placeholder="Seals verified, passed rapid chiller test..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsIntakeOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIntake}
                  className="px-4 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102c] text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingIntake ? "Recording Intake..." : "Confirm Intake to Chiller"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DISPATCH TO RIDER */}
      {isDispatchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Dispatch Products to Rider</h3>
                <p className="text-xs text-slate-500">Hand over chilled goods to logistics dispatch with digital waybill custody.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Cold Room Batch</label>
                <select
                  value={dispatchBatchId}
                  onChange={(e) => {
                    setDispatchBatchId(e.target.value);
                    const b = batches.find((x) => x.id === e.target.value);
                    if (b) {
                      setSelectedBatchForDispatch(b);
                      setDispatchQuantity(b.quantityRemaining.toString());
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden text-xs font-mono"
                  required
                >
                  <option value="">-- Select Available Batch --</option>
                  {activeBatchesList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} - {b.productName} ({b.quantityRemaining} units avail)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Units to Hand Over</label>
                  <input
                    type="number"
                    value={dispatchQuantity}
                    onChange={(e) => setDispatchQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden font-mono"
                    required
                  />
                  {selectedBatchForDispatch && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Max available: {selectedBatchForDispatch.quantityRemaining} units
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transfer Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dispatchTemp}
                    onChange={(e) => setDispatchTemp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Driver / Rider Name</label>
                  <input
                    type="text"
                    value={dispatchDriverName}
                    onChange={(e) => setDispatchDriverName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle / Van Plate</label>
                  <input
                    type="text"
                    value={dispatchVehiclePlate}
                    onChange={(e) => setDispatchVehiclePlate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Waybill Number (Optional)</label>
                <input
                  type="text"
                  value={dispatchWaybillNumber}
                  onChange={(e) => setDispatchWaybillNumber(e.target.value)}
                  placeholder="Auto-generated if left blank"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden font-mono"
                />
              </div>

              {/* Waybill Photo Upload (Cloudflare R2) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Upload Signed Waybill Photo (Cloudflare R2)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition-all border border-slate-200">
                    <Camera className="w-4 h-4 text-[#8E1538]" />
                    <span>{uploadingPhoto ? "Uploading to R2..." : "Take Photo / Select File"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleWaybillUpload(file);
                      }}
                      disabled={uploadingPhoto}
                    />
                  </label>
                  {dispatchWaybillPhotoUrl && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>R2 Stored</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Dispatch Notes</label>
                <textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  rows={2}
                  placeholder="Inspected chill packs, driver confirmed count..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDispatchOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispatch}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingDispatch ? "Processing Dispatch..." : "Confirm Handover to Rider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
