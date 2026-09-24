"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ConsignmentReturn } from "@/server/management/store";
import { InventoryItem } from "@/server/inventory/store";
import { RecordDamageModal } from "@/components/inventory/RecordDamageModal";
import {
  AlertTriangle,
  RotateCcw,
  Search,
  X,
  RefreshCw,
  Plus,
  AlertOctagon,
  Calendar,
  Layers,
  Store,
  Boxes,
  Clock,
  Sparkles,
  ShieldAlert,
  Sun,
  Moon,
  Tag,
  ArrowUpRight,
  TrendingDown,
  Building,
  CheckCircle2,
} from "lucide-react";

interface UnifiedScrapItem {
  id: string;
  source: "FLOOR" | "WAREHOUSE";
  date: string;
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT" | string;
  itemName: string;
  itemCode?: string;
  categoryType: "FAULT" | "WAREHOUSE_DAMAGE" | "EXCESS";
  rootCause: string;
  notes?: string;
  quantity: number;
  uom: string;
  valuationImpact: number;
  loggedBy: string;
  referenceId?: string;
  attachmentUrl?: string;
}

export default function DamagesPage() {
  const [activeTab, setActiveTab] = useState<"SCRAP" | "SOR">("SCRAP");
  const [returnsAudit, setReturnsAudit] = useState<any>(null);
  const [consignmentReturns, setConsignmentReturns] = useState<ConsignmentReturn[]>([]);
  const [damages, setDamages] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isRecordDamageOpen, setIsRecordDamageOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [scrapCategoryFilter, setScrapCategoryFilter] = useState<"ALL" | "FAULT" | "WAREHOUSE" | "EXCESS">("ALL");
  const [scrapRootCauseFilter, setScrapRootCauseFilter] = useState<string>("ALL");
  const [sorReasonFilter, setSorReasonFilter] = useState<string>("ALL");

  // Sync hash with active tab (#scrap vs #sor)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "sor") {
        setActiveTab("SOR");
      } else if (hash === "scrap" || hash === "damages" || hash === "returns") {
        setActiveTab("SCRAP");
      }
    };

    const handleCustomTab = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail === "sor") {
        setActiveTab("SOR");
      } else if (custom.detail === "scrap") {
        setActiveTab("SCRAP");
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("damages:switch-tab", handleCustomTab);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("damages:switch-tab", handleCustomTab);
    };
  }, []);

  const switchTab = (tab: "SCRAP" | "SOR") => {
    setActiveTab(tab);
    setSearchQuery("");
    if (typeof window !== "undefined") {
      window.location.hash = tab === "SOR" ? "sor" : "scrap";
    }
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [returnsAuditRes, sorReturnsRes, damagesRes, itemsRes] = await Promise.all([
        fetch("/api/inventory/returns-audit"),
        fetch("/api/management/returns"),
        fetch("/api/inventory/damages?limit=100&includeCancelled=false"),
        fetch("/api/inventory/items"),
      ]);

      if (returnsAuditRes.ok) {
        const d = await returnsAuditRes.json();
        setReturnsAudit(d);
      }
      if (sorReturnsRes.ok) {
        const d = await sorReturnsRes.json();
        setConsignmentReturns(d.returns || []);
      }
      if (damagesRes.ok) {
        const d = await damagesRes.json();
        setDamages(d.damages || []);
      }
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setInventoryItems(d.items || []);
      }
    } catch (err) {
      console.error("Failed to load damages & loss data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map of inventory items for cost calculation
  const itemMap = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventoryItems.forEach((i) => {
      map.set(i.id, i);
      map.set(i.code, i);
    });
    return map;
  }, [inventoryItems]);

  // Build unified list of Plant Floor Scrap & Warehouse Damages
  const unifiedScrapList = useMemo<UnifiedScrapItem[]>(() => {
    const list: UnifiedScrapItem[] = [];

    // 1. Plant floor return transactions from audit
    if (returnsAudit?.returns) {
      for (const ret of returnsAudit.returns) {
        const isFault = ret.transactionType === "RETURN_FAULT_REPLACE" || ret.transactionType === "DISPOSAL_EXPIRED_SPOILT";
        const isExcess = ret.transactionType === "RETURN_EXCESS_RESTOCK";

        list.push({
          id: `floor-${ret.id || ret.referenceId || Math.random()}`,
          source: "FLOOR",
          date: ret.createdAt ? new Date(ret.createdAt).toISOString() : new Date().toISOString(),
          shiftType: ret.shiftType || "MORNING_SHIFT",
          itemName: ret.itemName || "Plant Material",
          itemCode: ret.itemCode || ret.itemId,
          categoryType: isFault ? "FAULT" : isExcess ? "EXCESS" : "FAULT",
          rootCause: ret.rootCause || "General Floor Scrap",
          notes: ret.notes,
          quantity: Math.abs(ret.quantity || 0),
          uom: ret.uom || "units",
          valuationImpact: ret.valueImpact || 0,
          loggedBy: ret.recipient || ret.performedByName || "Factory Shift Team",
          referenceId: ret.referenceId,
        });
      }
    }

    // 2. Warehouse & Spoilage damages
    if (damages && damages.length > 0) {
      for (const dmg of damages) {
        const itemObj = itemMap.get(dmg.itemCode || dmg.itemId);
        const cost = itemObj?.costPerUnit || 0;
        const valImpact = (dmg.quantity || 0) * cost;

        list.push({
          id: `dmg-${dmg.id}`,
          source: "WAREHOUSE",
          date: dmg.damageDate || dmg.createdAt || new Date().toISOString(),
          shiftType: dmg.shiftType || "MORNING_SHIFT",
          itemName: dmg.itemName || itemObj?.name || "Inventory Item",
          itemCode: dmg.itemCode || itemObj?.code,
          categoryType: "WAREHOUSE_DAMAGE",
          rootCause: dmg.reason || "Physical Damage / Spoilage",
          notes: dmg.notes,
          quantity: dmg.quantity || 0,
          uom: dmg.unit || itemObj?.uom || "units",
          valuationImpact: valImpact,
          loggedBy: dmg.performedByName || "Store Officer",
          referenceId: dmg.referenceId,
          attachmentUrl: dmg.attachmentUrl,
        });
      }
    }

    // Sort by date descending
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [returnsAudit, damages, itemMap]);

  // Aggregate Metrics
  const totalFloorScrapLoss = useMemo(() => {
    const auditLoss = returnsAudit?.totalFaultLossValue || 0;
    const warehouseLoss = damages.reduce((acc, d) => {
      const itemObj = itemMap.get(d.itemCode || d.itemId);
      return acc + (d.quantity || 0) * (itemObj?.costPerUnit || 0);
    }, 0);
    return auditLoss + warehouseLoss;
  }, [returnsAudit, damages, itemMap]);

  const totalSupermarketCredit = useMemo(() => {
    return consignmentReturns.reduce((acc, ret) => acc + ret.creditAmount, 0);
  }, [consignmentReturns]);

  const totalLossIncidents = useMemo(() => {
    return unifiedScrapList.length + consignmentReturns.length;
  }, [unifiedScrapList, consignmentReturns]);

  const uniqueReportingStockists = useMemo(() => {
    return new Set(consignmentReturns.map((r) => r.stockistName)).size;
  }, [consignmentReturns]);

  // Filtered Plant Floor Scrap
  const filteredScrap = useMemo(() => {
    let list = unifiedScrapList;

    // Filter by Category
    if (scrapCategoryFilter === "FAULT") {
      list = list.filter((i) => i.categoryType === "FAULT");
    } else if (scrapCategoryFilter === "WAREHOUSE") {
      list = list.filter((i) => i.categoryType === "WAREHOUSE_DAMAGE");
    } else if (scrapCategoryFilter === "EXCESS") {
      list = list.filter((i) => i.categoryType === "EXCESS");
    }

    // Filter by Root Cause
    if (scrapRootCauseFilter !== "ALL") {
      list = list.filter((i) => i.rootCause === scrapRootCauseFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.itemName.toLowerCase().includes(q) ||
          (i.itemCode && i.itemCode.toLowerCase().includes(q)) ||
          i.rootCause.toLowerCase().includes(q) ||
          (i.notes && i.notes.toLowerCase().includes(q)) ||
          (i.referenceId && i.referenceId.toLowerCase().includes(q)) ||
          i.loggedBy.toLowerCase().includes(q)
      );
    }

    return list;
  }, [unifiedScrapList, scrapCategoryFilter, scrapRootCauseFilter, searchQuery]);

  // Plant floor scrap root cause distribution
  const scrapRootCauseBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of unifiedScrapList) {
      if (item.categoryType !== "EXCESS") {
        counts[item.rootCause] = (counts[item.rootCause] || 0) + 1;
      }
    }
    return counts;
  }, [unifiedScrapList]);

  // Filtered Supermarket SoR returns
  const filteredSorReturns = useMemo(() => {
    let list = consignmentReturns;

    if (sorReasonFilter !== "ALL") {
      list = list.filter((r) => r.reason === sorReasonFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.stockistName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q)) ||
          r.receivedBy.toLowerCase().includes(q)
      );
    }

    return list;
  }, [consignmentReturns, sorReasonFilter, searchQuery]);

  // SoR reason breakdown
  const sorReasonBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ret of consignmentReturns) {
      counts[ret.reason] = (counts[ret.reason] || 0) + 1;
    }
    return counts;
  }, [consignmentReturns]);

  const formatSoRReason = (reason: string) => {
    switch (reason) {
      case "EXPIRED_ON_SHELF":
        return { label: "Expired on Shelf", color: "bg-red-50 text-red-700 border-red-200" };
      case "BROKEN_SEAL":
        return { label: "Broken Seal / Tampered", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case "COLD_CHAIN_FAILURE":
        return { label: "Cold Chain Break", color: "bg-rose-50 text-rose-700 border-rose-200" };
      case "DAMAGED":
        return { label: "Transport Crushed / Damaged", color: "bg-orange-50 text-orange-700 border-orange-200" };
      default:
        return { label: reason, color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-50 text-[#CF0458] border border-rose-200">
              Audit & Governance
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Discrepancy & Loss Prevention Ledger
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Damages & Scrap Loss Control
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified governance for plant floor scrap, warehouse material damages, recipe rejects, and supermarket Sale or Return (SoR) claims.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsRecordDamageOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Plant Damage</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Floor Scrap & Damages
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#CF0458] mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalFloorScrapLoss.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {unifiedScrapList.filter((i) => i.categoryType !== "EXCESS").length} write-off events
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-[#CF0458] flex items-center justify-center shrink-0 ml-2">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Supermarket SoR Credit
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalSupermarketCredit.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {consignmentReturns.length} retail credit notes
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Total Loss Incidents
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {totalLossIncidents} <span className="text-xs font-normal text-slate-500">Events</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Combined plant & retail
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Stockists Reporting
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {uniqueReportingStockists} <span className="text-xs font-normal text-slate-500">Stores</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Active retail outlets
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation: Plant Floor Scrap vs Supermarket SoR */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-3 sm:px-6 pt-3 gap-2 sm:gap-4 overflow-x-auto no-scrollbar shadow-2xs">
        <button
          type="button"
          onClick={() => switchTab("SCRAP")}
          className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === "SCRAP"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${activeTab === "SCRAP" ? "text-[#CF0458]" : "text-slate-400"}`} />
          <span>Plant Floor Scrap & Damages</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              activeTab === "SCRAP"
                ? "bg-[#CF0458]/10 text-[#CF0458]"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {unifiedScrapList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => switchTab("SOR")}
          className={`py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === "SOR"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <RotateCcw className={`w-4 h-4 ${activeTab === "SOR" ? "text-[#CF0458]" : "text-slate-400"}`} />
          <span>Supermarket Sale or Return (SoR)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
              activeTab === "SOR"
                ? "bg-[#CF0458]/10 text-[#CF0458]"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {consignmentReturns.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PLANT FLOOR SCRAP & DAMAGES */}
      {/* ========================================================================= */}
      {activeTab === "SCRAP" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Root Cause Distribution Banner */}
          {Object.keys(scrapRootCauseBreakdown).length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-amber-600" />
                    <span>Scrap & Damage Root Cause Breakdown</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defective materials, mixing discrepancies, shelf spoilage, and warehouse spillage incidents.
                  </p>
                </div>
                {scrapRootCauseFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setScrapRootCauseFilter("ALL")}
                    className="text-xs text-[#CF0458] hover:underline font-semibold self-start sm:self-auto cursor-pointer"
                  >
                    Clear cause filter
                  </button>
                )}
              </div>

              {/* Clickable Root Cause Chips */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                {Object.entries(scrapRootCauseBreakdown).map(([cause, count]) => {
                  const isSelected = scrapRootCauseFilter === cause;
                  return (
                    <button
                      key={cause}
                      type="button"
                      onClick={() => setScrapRootCauseFilter(isSelected ? "ALL" : cause)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                      }`}
                    >
                      <span>{cause}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto">
              {[
                { id: "ALL", label: `All Scrap (${unifiedScrapList.length})` },
                {
                  id: "FAULT",
                  label: `Floor Fault Scrap (${unifiedScrapList.filter((i) => i.categoryType === "FAULT").length})`,
                },
                {
                  id: "WAREHOUSE",
                  label: `Warehouse Damage (${unifiedScrapList.filter((i) => i.categoryType === "WAREHOUSE_DAMAGE").length})`,
                },
                {
                  id: "EXCESS",
                  label: `Excess Restock (${unifiedScrapList.filter((i) => i.categoryType === "EXCESS").length})`,
                },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setScrapCategoryFilter(pill.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    scrapCategoryFilter === pill.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search material, reason, shift, ref..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Plant Floor Scrap & Damages Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date & Shift</th>
                    <th className="py-3 px-3">Material Item</th>
                    <th className="py-3 px-3">Loss Category</th>
                    <th className="py-3 px-4">Why Scrapped / Root Cause</th>
                    <th className="py-3 px-3 text-right">Quantity</th>
                    <th className="py-3 px-3 text-right">Valuation Loss</th>
                    <th className="py-3 px-3">Shift Team & Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CF0458]" />
                        <span>Loading plant floor scrap & damage records...</span>
                      </td>
                    </tr>
                  ) : filteredScrap.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <h4 className="text-sm font-bold text-slate-800">No Scrap or Damage Records Found</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          No write-off incidents matching your active filters. All raw materials and storage buffers are clean.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredScrap.map((ret) => {
                      const isExcess = ret.categoryType === "EXCESS";
                      const isWarehouse = ret.categoryType === "WAREHOUSE_DAMAGE";

                      return (
                        <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {ret.shiftType === "NIGHT_SHIFT" ? (
                                <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              ) : (
                                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <span>
                                {new Date(ret.date).toLocaleDateString("en-NG", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <span className="text-[10px] font-normal text-slate-400 block ml-5">
                              {ret.shiftType === "NIGHT_SHIFT" ? "Night Shift" : "Morning Shift"}
                            </span>
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-900">{ret.itemName}</div>
                            {ret.itemCode && (
                              <div className="text-[10px] font-mono text-slate-400">{ret.itemCode}</div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {isExcess ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Excess Restock
                              </span>
                            ) : isWarehouse ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Warehouse Damage
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-[#CF0458] border border-rose-200">
                                Floor Fault Scrap
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">{ret.rootCause}</div>
                            {ret.notes && (
                              <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                {ret.notes}
                              </div>
                            )}
                            {ret.attachmentUrl && (
                              <a
                                href={ret.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#CF0458] hover:underline mt-1"
                              >
                                <span>View Photo Proof</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {ret.quantity.toLocaleString()} {ret.uom}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            {isExcess ? (
                              <span className="text-[#059669]">
                                +₦ {ret.valuationImpact.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-[#CF0458]">
                                -₦ {ret.valuationImpact.toLocaleString()}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{ret.loggedBy}</div>
                            {ret.referenceId && (
                              <div className="text-[10px] font-mono text-slate-400">
                                Ref: {ret.referenceId}
                              </div>
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

      {/* ========================================================================= */}
      {/* TAB 2: SUPERMARKET SALE OR RETURN (SoR) */}
      {/* ========================================================================= */}
      {activeTab === "SOR" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* SoR Defect & Return Breakdown Banner */}
          {Object.keys(sorReasonBreakdown).length > 0 && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-blue-600" />
                    <span>Supermarket Shelf Return Causes</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defects, broken packaging seals, cold-chain failures, and expired goods pulled from stockist shelves.
                  </p>
                </div>
                {sorReasonFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setSorReasonFilter("ALL")}
                    className="text-xs text-[#CF0458] hover:underline font-semibold self-start sm:self-auto cursor-pointer"
                  >
                    Clear reason filter
                  </button>
                )}
              </div>

              {/* Clickable Defect Chips */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                {Object.entries(sorReasonBreakdown).map(([reason, count]) => {
                  const isSelected = sorReasonFilter === reason;
                  const badge = formatSoRReason(reason);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSorReasonFilter(isSelected ? "ALL" : reason)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                      }`}
                    >
                      <span>{badge.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filter & Search Bar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Reason Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto">
              {[
                { id: "ALL", label: `All SoR (${consignmentReturns.length})` },
                { id: "EXPIRED_ON_SHELF", label: "Expired on Shelf" },
                { id: "BROKEN_SEAL", label: "Broken Seal" },
                { id: "COLD_CHAIN_FAILURE", label: "Cold Chain Break" },
                { id: "DAMAGED", label: "Transport Crushed" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSorReasonFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    sorReasonFilter === pill.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stockist, product, reason..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Supermarket SoR Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Supermarket Stockist</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-4">Why Returned (Defect / Expiry)</th>
                    <th className="py-3 px-3 text-right">Units Returned</th>
                    <th className="py-3 px-3 text-right">Credit Issued</th>
                    <th className="py-3 px-3">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CF0458]" />
                        <span>Loading supermarket returns ledger...</span>
                      </td>
                    </tr>
                  ) : filteredSorReturns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Store className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <h4 className="text-sm font-bold text-slate-800">No Supermarket Returns Recorded</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          No retail shelf returns matching your active filters. All supermarket consignment accounts are reconciled.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSorReturns.map((ret) => {
                      const badge = formatSoRReason(ret.reason);

                      return (
                        <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                            {new Date(ret.returnDate).toLocaleDateString("en-NG", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>

                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-900">{ret.stockistName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {ret.stockistId}
                            </div>
                          </td>

                          <td className="py-3.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {ret.productCode}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                            {ret.notes && (
                              <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                {ret.notes}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {ret.quantityReturned.toLocaleString()} units
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold text-[#CF0458] whitespace-nowrap">
                            ₦ {ret.creditAmount.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{ret.receivedBy}</div>
                            <span className="text-[10px] text-slate-400">Credit Adjusted</span>
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

      {/* Embedded Record Damage Modal */}
      <RecordDamageModal
        isOpen={isRecordDamageOpen}
        onClose={() => setIsRecordDamageOpen(false)}
        items={inventoryItems}
        onSuccess={() => {
          loadData();
          setIsRecordDamageOpen(false);
        }}
      />
    </div>
  );
}
