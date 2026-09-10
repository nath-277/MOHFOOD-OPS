"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { InventoryItem, StockTransaction } from "@/server/inventory/store";
import { formatPackagingDisplay } from "@/lib/packaging";
import { ConsignmentReturn } from "@/server/management/store";
import { ItemDetailAuditModal } from "@/components/inventory/ItemDetailAuditModal";
import { ShiftDetailModal } from "@/components/inventory/ShiftDetailModal";
import { BatchDetailModal, ProductionBatchGroup } from "@/components/inventory/BatchDetailModal";
import { useShift, ShiftRecordItem } from "@/components/shift/ShiftContext";
import {
  Boxes,
  Search,
  X,
  Layers,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Sun,
  Moon,
  Building,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  AlertCircle,
  LayoutGrid,
  List,
  Box,
  Scale,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Lock,
} from "lucide-react";

export type ExecutiveStockSortOption =
  | "NAME_ASC"
  | "NAME_DESC"
  | "STOCK_DESC"
  | "STOCK_ASC"
  | "COST_DESC"
  | "COST_ASC"
  | "VALUE_DESC"
  | "VALUE_ASC"
  | "LOW_STOCK";

interface ExecutiveInventoryViewProps {
  onSwitchToFloorView?: () => void;
  canSwitchView?: boolean;
}

export function ExecutiveInventoryView({
  onSwitchToFloorView,
  canSwitchView = false,
}: ExecutiveInventoryViewProps) {
  // Tabs: "stock" | "history" | "returns" | "reconcile"
  const [activeTab, setActiveTab] = useState<"stock" | "history" | "returns" | "reconcile">("stock");

  // Live Shift Context & Audit State
  const {
    activeShift,
    activeShiftRecord,
    shiftStats,
    historicalShifts,
    loadingShifts,
    refreshShifts,
  } = useShift();
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<ShiftRecordItem | null>(null);

  // Movements & Production Batches View State
  const [movementViewMode, setMovementViewMode] = useState<"BATCHES" | "LEDGER">("BATCHES");
  const [expandedBatchRef, setExpandedBatchRef] = useState<string | null>(null);
  const [batchDetailModal, setBatchDetailModal] = useState<ProductionBatchGroup | null>(null);

  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [returnsAudit, setReturnsAudit] = useState<any>(null);
  const [consignmentReturns, setConsignmentReturns] = useState<ConsignmentReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters for Stock & Sorting & Pagination
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("ALL");
  const [stockSortBy, setStockSortBy] = useState<ExecutiveStockSortOption>("NAME_ASC");
  const [stockCurrentPage, setStockCurrentPage] = useState<number>(1);
  const stockItemsPerPage = 10;
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);
  const [stockViewMode, setStockViewModeState] = useState<"list" | "grid">("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("moh_executive_stock_view");
      if (saved === "grid" || saved === "list") {
        setStockViewModeState(saved);
      } else if (window.innerWidth < 640) {
        setStockViewModeState("grid");
      }
    } catch {}
  }, []);

  const setStockViewMode = (mode: "list" | "grid") => {
    setStockViewModeState(mode);
    try {
      localStorage.setItem("moh_executive_stock_view", mode);
    } catch {}
  };

  // Stock Balance Display Preference: Packaging vs Base Units
  const [stockDisplayPref, setStockDisplayPref] = useState<"PACKAGES" | "BASE_UNITS">("PACKAGES");

  useEffect(() => {
    try {
      const savedPref = localStorage.getItem("moh_executive_stock_display_pref");
      if (savedPref === "PACKAGES" || savedPref === "BASE_UNITS") {
        setStockDisplayPref(savedPref);
      }
    } catch {}
  }, []);

  const handleSetStockDisplayPref = (pref: "PACKAGES" | "BASE_UNITS") => {
    setStockDisplayPref(pref);
    try {
      localStorage.setItem("moh_executive_stock_display_pref", pref);
    } catch {}
  };

  // Filters for History
  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState("ALL");

  // Filters for Returns
  const [returnSourceFilter, setReturnSourceFilter] = useState<"ALL" | "FLOOR" | "SUPERMARKET">("ALL");
  const [returnSearch, setReturnSearch] = useState("");

  // Sync tab with URL hash if present & custom event
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "stock" || hash === "history" || hash === "returns" || hash === "reconcile") {
        setActiveTab(hash as any);
      }
    };
    const handleTabEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (
        customEvent.detail === "stock" ||
        customEvent.detail === "history" ||
        customEvent.detail === "returns" ||
        customEvent.detail === "reconcile"
      ) {
        setActiveTab(customEvent.detail as any);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("executive-inventory:switch-tab", handleTabEvent);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("executive-inventory:switch-tab", handleTabEvent);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [itemsRes, txnsRes, returnsAuditRes, sorReturnsRes] = await Promise.all([
        fetch(`/api/inventory/items`),
        fetch(`/api/inventory/transactions?limit=150`),
        fetch(`/api/inventory/returns-audit`),
        fetch(`/api/management/returns`),
      ]);

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items || []);
      }
      if (txnsRes.ok) {
        const d = await txnsRes.json();
        setTransactions(d.transactions || []);
      }
      if (returnsAuditRes.ok) {
        const d = await returnsAuditRes.json();
        setReturnsAudit(d);
      }
      if (sorReturnsRes.ok) {
        const d = await sorReturnsRes.json();
        setConsignmentReturns(d.returns || []);
      }
    } catch (err) {
      console.error("Failed to load executive inventory data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate Metrics
  const totalStockValuation = useMemo(() => {
    return items.reduce((acc, item) => acc + item.currentStock * item.costPerUnit, 0);
  }, [items]);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.currentStock <= i.minStockThreshold).length;
  }, [items]);

  const totalScrapLoss = useMemo(() => {
    return returnsAudit?.totalFaultLossValue || 0;
  }, [returnsAudit]);

  const totalSupermarketCredit = useMemo(() => {
    return consignmentReturns.reduce((acc, ret) => acc + ret.creditAmount, 0);
  }, [consignmentReturns]);

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCategory = stockCategory === "ALL" || item.category === stockCategory;
      const q = stockSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.storageLocation.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [items, stockCategory, stockSearch]);

  // Reset pagination on filter, search, or sort change
  useEffect(() => {
    setStockCurrentPage(1);
  }, [stockCategory, stockSearch, stockSortBy]);

  // Sorted and Paginated Stock Items (Strictly 10 items per page)
  const sortedStockItems = useMemo(() => {
    const list = [...filteredItems];
    switch (stockSortBy) {
      case "NAME_ASC":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "NAME_DESC":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "STOCK_DESC":
        return list.sort((a, b) => b.currentStock - a.currentStock);
      case "STOCK_ASC":
        return list.sort((a, b) => a.currentStock - b.currentStock);
      case "COST_DESC":
        return list.sort((a, b) => (b.costPerUnit || 0) - (a.costPerUnit || 0));
      case "COST_ASC":
        return list.sort((a, b) => (a.costPerUnit || 0) - (b.costPerUnit || 0));
      case "VALUE_DESC":
        return list.sort(
          (a, b) => b.currentStock * b.costPerUnit - a.currentStock * a.costPerUnit
        );
      case "VALUE_ASC":
        return list.sort(
          (a, b) => a.currentStock * a.costPerUnit - b.currentStock * b.costPerUnit
        );
      case "LOW_STOCK":
        return list.sort((a, b) => {
          const aLow = a.currentStock <= a.minStockThreshold ? 1 : 0;
          const bLow = b.currentStock <= b.minStockThreshold ? 1 : 0;
          if (aLow !== bLow) return bLow - aLow;
          return a.currentStock - b.currentStock;
        });
      default:
        return list;
    }
  }, [filteredItems, stockSortBy]);

  const stockTotalPages = Math.ceil(sortedStockItems.length / stockItemsPerPage) || 1;

  const paginatedStockItems = useMemo(() => {
    const start = (stockCurrentPage - 1) * stockItemsPerPage;
    return sortedStockItems.slice(start, start + stockItemsPerPage);
  }, [sortedStockItems, stockCurrentPage, stockItemsPerPage]);

  const handleStockSortToggle = (field: "NAME" | "STOCK" | "COST" | "VALUE") => {
    if (field === "NAME") {
      setStockSortBy((prev) => (prev === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC"));
    } else if (field === "STOCK") {
      setStockSortBy((prev) => (prev === "STOCK_DESC" ? "STOCK_ASC" : "STOCK_DESC"));
    } else if (field === "COST") {
      setStockSortBy((prev) => (prev === "COST_DESC" ? "COST_ASC" : "COST_DESC"));
    } else if (field === "VALUE") {
      setStockSortBy((prev) => (prev === "VALUE_DESC" ? "VALUE_ASC" : "VALUE_DESC"));
    }
  };

  // Filtered History Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchType = historyType === "ALL" || txn.transactionType === historyType;
      const q = historySearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        txn.itemName.toLowerCase().includes(q) ||
        (txn.referenceId && txn.referenceId.toLowerCase().includes(q)) ||
        (txn.performedByName && txn.performedByName.toLowerCase().includes(q)) ||
        (txn.notes && txn.notes.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [transactions, historyType, historySearch]);

  // Grouped Production Batches (Recipe Dispatches)
  const productionBatches = useMemo<ProductionBatchGroup[]>(() => {
    const groups: Record<string, ProductionBatchGroup> = {};

    transactions
      .filter((tx) => tx.transactionType === "DISPENSE_PRODUCTION" && tx.referenceId)
      .forEach((tx) => {
        const ref = tx.referenceId!;
        if (!groups[ref]) {
          let productName = "Production Batch Run";
          let batchSize = "Batch Run";

          const match = tx.notes?.match(/Dispensed for (\d+x?)\s+([^.]+)/i);
          if (match) {
            batchSize = match[1];
            productName = match[2];
          } else if (tx.notes) {
            productName = tx.notes.replace("Dispensed for ", "");
          }

          groups[ref] = {
            batchReference: ref,
            productName,
            batchSize,
            shiftType: tx.shiftType,
            performedByName: tx.performedByName,
            recipient: tx.recipient || "Production Floor",
            timestamp: tx.createdAt,
            materials: [],
          };
        }
        groups[ref].materials.push(tx);
      });

    return Object.values(groups).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transactions]);

  // Individual Direct Dispatches (Ad-Hoc / Single Materials)
  const individualDispenses = useMemo(() => {
    return transactions.filter((tx) => tx.transactionType === "DISPENSE_INDIVIDUAL");
  }, [transactions]);

  // Filtered Floor Returns
  const floorReturns = useMemo(() => {
    if (!returnsAudit?.returns) return [];
    return returnsAudit.returns.filter((r: any) => {
      const q = returnSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        r.itemName.toLowerCase().includes(q) ||
        r.rootCause.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.referenceId && r.referenceId.toLowerCase().includes(q))
      );
    });
  }, [returnsAudit, returnSearch]);

  // Filtered Supermarket SoR Returns
  const filteredSorReturns = useMemo(() => {
    return consignmentReturns.filter((r) => {
      const q = returnSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        r.stockistName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    });
  }, [consignmentReturns, returnSearch]);

  const formatTxnType = (type: string) => {
    switch (type) {
      case "DISPENSE_PRODUCTION":
        return { label: "Batch Dispense", color: "text-[#CF0458] bg-rose-50 border-rose-200" };
      case "INBOUND_PURCHASE":
        return { label: "Supplier Intake", color: "text-[#059669] bg-emerald-50 border-emerald-200" };
      case "RETURN_FAULT_REPLACE":
        return { label: "Fault Scrapped", color: "text-red-700 bg-red-50 border-red-200" };
      case "RETURN_EXCESS_RESTOCK":
        return { label: "Excess Restocked", color: "text-blue-700 bg-blue-50 border-blue-200" };
      case "RECONCILIATION_ADJUST":
        return { label: "Shift Variance", color: "text-amber-700 bg-amber-50 border-amber-200" };
      default:
        return { label: type, color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  const formatSoRReason = (reason: string) => {
    switch (reason) {
      case "EXPIRED_ON_SHELF":
        return { label: "Expired on Shelf", color: "text-red-700 bg-red-50 border-red-200" };
      case "BROKEN_SEAL":
        return { label: "Broken Seal / Defect", color: "text-amber-700 bg-amber-50 border-amber-200" };
      case "COLD_CHAIN_FAILURE":
        return { label: "Cold Chain Breakdown", color: "text-orange-700 bg-orange-50 border-orange-200" };
      case "DAMAGED":
        return { label: "Transit Damage", color: "text-purple-700 bg-purple-50 border-purple-200" };
      default:
        return { label: reason, color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Executive Inventory & Audit
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Stock Oversight & Return Root Cause Analysis
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Store Stock & Returns Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit store material balances, examine product transaction histories, and analyze returns & root causes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canSwitchView && onSwitchToFloorView && (
            <button
              type="button"
              onClick={onSwitchToFloorView}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-slate-600" />
              <span>Switch to Store Floor Terminal</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
              Total Stock Valuation
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalStockValuation.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              Live warehouse holding
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Tracked Materials
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {items.length} <span className="text-xs font-normal text-slate-500">Items</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {lowStockCount > 0 ? (
                <span className="text-[#CF0458] font-bold">{lowStockCount} low buffer</span>
              ) : (
                <span className="text-[#059669]">Buffers healthy</span>
              )}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Plant Floor Scrap
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#CF0458] mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalScrapLoss.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {returnsAudit ? `${returnsAudit.faultScrappedCount} write-offs` : "Loading..."}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-[#CF0458] flex items-center justify-center shrink-0 ml-2">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Supermarket SoR
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalSupermarketCredit.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {consignmentReturns.length} credit notes
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar: 1. Check Stock, 2. Product History, 3. See Returns & Why */}
      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar flex-nowrap shrink-0 pb-1 w-full max-w-full min-w-0">
        <button
          type="button"
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "stock"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Boxes className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Stock</span>
          <span className="hidden sm:inline">Check Stock</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "history"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">History</span>
          <span className="hidden sm:inline">Product Movement History</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("returns")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "returns"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Returns</span>
          <span className="hidden sm:inline">See Returns & Why</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-50 text-[#CF0458] font-bold border border-rose-200">
            {(returnsAudit?.returns?.length || 0) + consignmentReturns.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconcile")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "reconcile"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Handover</span>
          <span className="hidden sm:inline">Reconciliation Log</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {historicalShifts.length}
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CHECK STOCK */}
      {/* ============================================================ */}
      {activeTab === "stock" && (
        <div className="space-y-4 max-w-full min-w-0">
          {/* Filter Bar */}
          <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3 max-w-full">
            {/* Row 1: Category Filter Pills & Search Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full min-w-0 shrink-0 pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Categories", mobileLabel: "All" },
                  { id: "PERISHABLE_MEASURED", label: "Measured (kg/l)", mobileLabel: "Measured (kg/l)" },
                  { id: "PERISHABLE_NUMBERED", label: "Numbered (pcs)", mobileLabel: "Counted (pcs)" },
                  { id: "PACKAGING_NON_PERISHABLE", label: "Packaging", mobileLabel: "Packaging" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStockCategory(tab.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      stockCategory === tab.id
                        ? "bg-[#CF0458] text-white shadow-xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span className="sm:hidden">{tab.mobileLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Search material name, code, location..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
                {stockSearch && (
                  <button
                    type="button"
                    onClick={() => setStockSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Sort Selector, Packaging Unit Switcher & View Toggle Switcher */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap sm:flex-nowrap">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex-1 sm:flex-initial min-w-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Sort:</span>
                <select
                  value={stockSortBy}
                  onChange={(e) => setStockSortBy(e.target.value as ExecutiveStockSortOption)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer w-full truncate"
                >
                  <option value="NAME_ASC">Name (A → Z)</option>
                  <option value="NAME_DESC">Name (Z → A)</option>
                  <option value="STOCK_DESC">Stock: High to Low</option>
                  <option value="STOCK_ASC">Stock: Low to High</option>
                  <option value="COST_DESC">Unit Cost: High to Low</option>
                  <option value="COST_ASC">Unit Cost: Low to High</option>
                  <option value="VALUE_DESC">Valuation: High to Low</option>
                  <option value="VALUE_ASC">Valuation: Low to High</option>
                  <option value="LOW_STOCK">Low Stock Alert First</option>
                </select>
              </div>

              {/* Display & View Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Unit Display Preference Switcher */}
                <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("PACKAGES")}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "PACKAGES"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Display stock in packaged units (cartons/packs)"
                  >
                    <Box className="w-3 h-3 shrink-0" />
                    <span>Packs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("BASE_UNITS")}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "BASE_UNITS"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Display stock in base units"
                  >
                    <Scale className="w-3 h-3 shrink-0" />
                    <span>Units</span>
                  </button>
                </div>

                {/* View Toggle Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStockViewMode("list")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      stockViewMode === "list"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="List / Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="text-[11px]">List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockViewMode("grid")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      stockViewMode === "grid"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Grid</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid View Mode */}
          {stockViewMode === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
              {loading ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                  <span className="text-xs">Loading live inventory...</span>
                </div>
              ) : sortedStockItems.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">No materials found.</span>
                </div>
              ) : (
                paginatedStockItems.map((item) => {
                  const isCritical = item.currentStock <= 0;
                  const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                  const holdingValue = item.currentStock * item.costPerUnit;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemDetail(item)}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-300 active:scale-[0.99] transition-all"
                    >
                      <div>
                        <div className="relative w-full h-28 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 mb-2.5">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Boxes className="w-8 h-8" />
                            </div>
                          )}
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 text-white backdrop-blur-xs">
                            {item.code}
                          </span>
                          {item.isVariablePack && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                              🍇 Variable
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] leading-snug">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {item.storageLocation || "Central Store"}
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        {(() => {
                          const pkg = formatPackagingDisplay(item.currentStock, item);
                          const hasPkg = pkg.type !== "DIRECT";

                          if (stockDisplayPref === "PACKAGES" && hasPkg) {
                            return (
                              <div className="flex items-baseline justify-between">
                                <span className="text-[10px] text-slate-400 font-semibold">Stock:</span>
                                <div className="text-right">
                                  <div className="font-mono font-extrabold text-sm sm:text-base text-slate-900">
                                    {pkg.primary}
                                  </div>
                                  {pkg.secondary && (
                                    <div className="text-[10px] font-normal text-slate-500 font-sans">
                                      {pkg.secondary}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex items-baseline justify-between">
                              <span className="text-[10px] text-slate-400 font-semibold">Stock:</span>
                              <div className="text-right">
                                <div className="font-mono font-extrabold text-sm sm:text-base text-slate-900">
                                  {item.currentStock.toLocaleString(undefined, {
                                    minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                                  })}{" "}
                                  <span className="text-[10px] font-normal text-slate-500">{item.uom}</span>
                                </div>
                                {hasPkg && (
                                  <div className="text-[10px] font-normal text-slate-500 font-sans">
                                    ≈ {pkg.primary}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span>Holding:</span>
                          <span className="font-mono font-semibold text-slate-700">
                            ₦{holdingValue.toLocaleString()}
                          </span>
                        </div>

                        {isCritical ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200 truncate">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Out of Stock</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-md border border-[#D97706]/20 truncate">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Low Stock ({item.minStockThreshold})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md border border-[#059669]/20">
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                            <span>Healthy</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* List / Table View Mode */}
          {stockViewMode === "list" && (
            <div>
              {/* Mobile List View (< sm) */}
              <div className="sm:hidden space-y-2">
                {loading ? (
                  <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                    <span className="text-xs">Loading live inventory balances...</span>
                  </div>
                ) : sortedStockItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs font-semibold text-slate-600">No materials found matching search criteria.</span>
                  </div>
                ) : (
                  paginatedStockItems.map((item) => {
                    const isCritical = item.currentStock <= 0;
                    const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                    const holdingValue = item.currentStock * item.costPerUnit;
                    const pkg = formatPackagingDisplay(item.currentStock, item);

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItemDetail(item)}
                        className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center gap-3 cursor-pointer hover:border-[#CF0458]/40 active:scale-[0.99] transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Boxes className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* Middle: Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                              {item.code}
                            </span>
                            {item.isVariablePack && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                🍇 Variable
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              ₦{holdingValue.toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 truncate">{item.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate">{item.storageLocation || "Central Store"}</p>
                        </div>

                        {/* Right: Stock & Status */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-extrabold text-sm text-slate-900">
                            {(() => {
                              const hasPkg = pkg.type !== "DIRECT";
                              if (stockDisplayPref === "PACKAGES" && hasPkg) {
                                return pkg.primary;
                              }
                              return `${item.currentStock.toLocaleString(undefined, {
                                minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                              })} ${item.uom}`;
                            })()}
                          </div>
                          {(() => {
                            const hasPkg = pkg.type !== "DIRECT";
                            if (stockDisplayPref === "PACKAGES" && hasPkg && pkg.secondary) {
                              return (
                                <div className="text-[10px] text-slate-400 font-sans">
                                  {pkg.secondary}
                                </div>
                              );
                            }
                            if (stockDisplayPref === "BASE_UNITS" && hasPkg) {
                              return (
                                <div className="text-[10px] text-slate-400 font-sans">
                                  ≈ {pkg.primary}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="mt-0.5">
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                <span>Out of Stock</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-md border border-[#D97706]/20">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                <span>Low Buffer</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md border border-[#059669]/20">
                                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                <span>Healthy</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View (>= sm) */}
              <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("NAME")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Material / Item</span>
                          {stockSortBy === "NAME_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "NAME_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "NAME_ASC" && stockSortBy !== "NAME_DESC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Storage Location</th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("STOCK")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Available Stock</span>
                          {stockSortBy === "STOCK_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "STOCK_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "STOCK_DESC" && stockSortBy !== "STOCK_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right">Safety Threshold</th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("COST")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Unit Cost</span>
                          {stockSortBy === "COST_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "COST_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "COST_DESC" && stockSortBy !== "COST_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("VALUE")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Holding Value</span>
                          {stockSortBy === "VALUE_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "VALUE_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "VALUE_DESC" && stockSortBy !== "VALUE_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() =>
                          setStockSortBy((prev) => (prev === "LOW_STOCK" ? "NAME_ASC" : "LOW_STOCK"))
                        }
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Status</span>
                          {stockSortBy === "LOW_STOCK" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "LOW_STOCK" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                          Loading live inventory balances...
                        </td>
                      </tr>
                    ) : sortedStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          No materials found matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedStockItems.map((item) => {
                        const isCritical = item.currentStock <= 0;
                        const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                        const holdingValue = item.currentStock * item.costPerUnit;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                            onClick={() => setSelectedItemDetail(item)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                                  {item.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Boxes className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{item.name}</span>
                                    {item.isVariablePack && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        🍇 Variable
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400">{item.code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] font-medium text-slate-600">
                                {item.category === "PERISHABLE_MEASURED"
                                  ? "Measured Raw"
                                  : item.category === "PERISHABLE_NUMBERED"
                                  ? "Numbered Raw"
                                  : "Packaging"}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                              {item.storageLocation}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {(() => {
                                const pkg = formatPackagingDisplay(item.currentStock, item);
                                const hasPkg = pkg.type !== "DIRECT";

                                if (stockDisplayPref === "PACKAGES" && hasPkg) {
                                  return (
                                    <div>
                                      <div className="font-mono font-bold text-slate-900 text-xs">
                                        {pkg.primary}
                                      </div>
                                      {pkg.secondary && (
                                        <div className="text-[10px] text-slate-400 font-normal font-sans">
                                          {pkg.secondary}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div>
                                    <div className="font-mono font-bold text-slate-900 text-xs">
                                      {item.currentStock.toLocaleString()}{" "}
                                      <span className="text-[10px] font-normal text-slate-500 font-sans">{item.uom}</span>
                                    </div>
                                    {hasPkg && (
                                      <div className="text-[10px] text-slate-400 font-normal font-sans">
                                        ≈ {pkg.primary}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-500">
                              {item.minStockThreshold} {item.uom}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              ₦ {item.costPerUnit.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ₦ {holdingValue.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isCritical ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-700 bg-red-50 border border-red-200">
                                  Stock Out
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#D97706] bg-[#FFFBEB] border border-[#D97706]/20">
                                  Low Buffer
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20">
                                  Healthy
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

          {/* 10-Item Pagination & Status Bar */}
          {!loading && sortedStockItems.length > 0 && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full max-w-full min-w-0">
              <div className="text-slate-500 font-medium text-center sm:text-left">
                Showing <span className="font-bold text-slate-800">{Math.min((stockCurrentPage - 1) * stockItemsPerPage + 1, sortedStockItems.length)}</span>–
                <span className="font-bold text-slate-800">{Math.min(stockCurrentPage * stockItemsPerPage, sortedStockItems.length)}</span> of{" "}
                <span className="font-bold text-slate-800">{sortedStockItems.length}</span> materials
                {stockTotalPages > 1 && (
                  <span className="ml-1 text-slate-400 font-normal">
                    (Page {stockCurrentPage} of {stockTotalPages})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadData}
                  className="text-xs text-slate-500 hover:text-[#CF0458] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  title="Refresh stock balances"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {stockTotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStockCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={stockCurrentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: stockTotalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          stockTotalPages > 7 &&
                          page !== 1 &&
                          page !== stockTotalPages &&
                          Math.abs(page - stockCurrentPage) > 1
                        ) {
                          if (page === 2 || page === stockTotalPages - 1) {
                            return (
                              <span key={page} className="px-1 text-slate-400 select-none">
                                ...
                              </span>
                            );
                          }
                          return null;
                        }

                        return (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setStockCurrentPage(page)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              stockCurrentPage === page
                                ? "bg-[#CF0458] text-white shadow-xs"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => setStockCurrentPage((p) => Math.min(stockTotalPages, p + 1))}
                      disabled={stockCurrentPage === stockTotalPages}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PRODUCT MOVEMENT HISTORY & BATCH LEDGER */}
      {/* ============================================================ */}
      {activeTab === "history" && (
        <div className="space-y-4 max-w-full min-w-0">
          {/* Sub-View Switcher: Batches vs Raw Ledger */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMovementViewMode("BATCHES")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  movementViewMode === "BATCHES"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-[#CF0458]" />
                <span>Production Batch Runs</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {productionBatches.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMovementViewMode("LEDGER")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  movementViewMode === "LEDGER"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>All Movements Ledger</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {transactions.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>
                Shift:{" "}
                <strong className="text-slate-800">
                  {activeShift === "MORNING_SHIFT" ? "Morning" : "Night"}
                </strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>{transactions.length} movements tracked</span>
            </div>
          </div>

          {/* VIEW 1: PRODUCTION BATCH RUNS */}
          {movementViewMode === "BATCHES" && (
            <div className="space-y-4">
              {productionBatches.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-[#CF0458] flex items-center justify-center mx-auto mb-3">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    No Production Batches Dispatched Yet
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When raw materials are requisitioned and dispensed for kitchen recipe formulations, the scheduled product and itemized materials breakdown will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {productionBatches.map((batch) => {
                    const isExpanded = expandedBatchRef === batch.batchReference;
                    return (
                      <div
                        key={batch.batchReference}
                        className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                      >
                        {/* Batch Header */}
                        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#059669] border border-emerald-200">
                                Scheduled & Dispatched
                              </span>
                              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                Ref: {batch.batchReference}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(batch.timestamp).toLocaleDateString("en-NG", {
                                  day: "2-digit",
                                  month: "short",
                                })}{" "}
                                {new Date(batch.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-baseline gap-2">
                              <h4 className="text-base font-bold text-slate-900">
                                {batch.productName}
                              </h4>
                              <span className="text-xs font-semibold text-[#CF0458] bg-rose-50 px-2 py-0.5 rounded-full">
                                Target Size: {batch.batchSize}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>
                                Floor Recipient:{" "}
                                <strong className="text-slate-800">{batch.recipient}</strong>
                              </span>
                              <span>
                                Staff:{" "}
                                <strong className="text-slate-800">{batch.performedByName}</strong>
                              </span>
                              <span>
                                Shift:{" "}
                                <strong className="text-slate-800">
                                  {batch.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBatchRef(isExpanded ? null : batch.batchReference)
                              }
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isExpanded
                                  ? "bg-slate-100 text-slate-800 border border-slate-200"
                                  : "bg-slate-900 hover:bg-slate-800 text-white"
                              }`}
                            >
                              <span>
                                {isExpanded
                                  ? "Hide Materials"
                                  : `View Dispatched Materials (${batch.materials.length})`}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setBatchDetailModal(batch)}
                              className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span className="hidden sm:inline">Details Slip</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Materials Table */}
                        {isExpanded && (
                          <div className="bg-slate-50/70 p-4 border-t border-slate-100">
                            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-[#CF0458]" />
                                <span>
                                  Materials Dispatched to Kitchen / Production Floor (
                                  {batch.materials.length})
                                </span>
                              </span>
                              <span className="text-[11px] font-normal text-slate-500">
                                Exact store deduction breakdown
                              </span>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3">Ingredient / Material</th>
                                    <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                                    <th className="py-2.5 px-3">Deduction Type</th>
                                    <th className="py-2.5 px-3">Batch Time</th>
                                    <th className="py-2.5 px-3">Formula / Proportion Note</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {batch.materials.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                                        {m.itemName}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#CF0458]">
                                        -{m.quantity}{" "}
                                        <span className="text-slate-400 font-normal text-[10px]">
                                          {m.unit}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-[#CF0458] border border-rose-100">
                                          Store Deduction
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                        {new Date(m.createdAt).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                        {m.notes || "Standard BOM calculation"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Individual Material Direct Dispatches Card */}
              {individualDispenses.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-6">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4 text-slate-700" />
                        <span>
                          Single Material Direct Dispatches (Ad-Hoc / Floor Requisitions)
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Materials dispensed directly without requiring a recipe formulation
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      {individualDispenses.length} Dispatches
                    </span>
                  </div>

                  {/* Mobile Cards (< sm) */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {individualDispenses.map((tx) => (
                      <div key={tx.id} className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{tx.itemName}</span>
                          <span className="font-mono font-bold text-xs text-slate-900">
                            -{tx.quantity} <span className="text-slate-400 text-[10px]">{tx.unit}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            To: <strong className="text-slate-700">{tx.recipient || "Floor"}</strong> (by {tx.performedByName})
                          </span>
                          <span>
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {tx.notes && (
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {tx.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (>= sm) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Time & Shift</th>
                          <th className="py-2.5 px-4">Item Name</th>
                          <th className="py-2.5 px-4 text-right">Quantity</th>
                          <th className="py-2.5 px-4">Recipient</th>
                          <th className="py-2.5 px-4">Staff</th>
                          <th className="py-2.5 px-4">Purpose / Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {individualDispenses.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 text-slate-500">
                              {new Date(tx.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              <span className="ml-1 text-[10px] text-slate-400">
                                ({tx.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"})
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">{tx.itemName}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              -{tx.quantity}{" "}
                              <span className="text-slate-400 font-normal text-[11px]">{tx.unit}</span>
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-800">
                              {tx.recipient || "Floor"}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{tx.performedByName}</td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                              {tx.notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: FULL CHRONOLOGICAL LEDGER */}
          {movementViewMode === "LEDGER" && (
            <div className="space-y-4">
              {/* History Filters */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 max-w-full">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search material, batch #, operator..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                  {historySearch && (
                    <button
                      type="button"
                      onClick={() => setHistorySearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto max-w-full min-w-0 pb-1 md:pb-0 shrink-0">
                  {[
                    { id: "ALL", label: "All Movements" },
                    { id: "DISPENSE_PRODUCTION", label: "Batch Dispensed" },
                    { id: "INBOUND_PURCHASE", label: "Supplier Intake" },
                    { id: "RETURN_FAULT_REPLACE", label: "Fault Replaced" },
                    { id: "RETURN_EXCESS_RESTOCK", label: "Excess Restocked" },
                    { id: "RECONCILIATION_ADJUST", label: "Shift Variance" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHistoryType(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        historyType === tab.id
                          ? "bg-[#CF0458] text-white shadow-xs"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Transaction Cards (< sm: No Horizontal Scroll) */}
              <div className="sm:hidden space-y-2.5">
                {loading ? (
                  <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                    <span className="text-xs">Loading movements...</span>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs font-semibold">No movements found matching filter.</span>
                  </div>
                ) : (
                  filteredTransactions.map((txn) => {
                    const badge = formatTxnType(txn.transactionType);
                    const isNegative = txn.quantity < 0;

                    return (
                      <div
                        key={txn.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900">{txn.itemName}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold text-xs ${
                              isNegative ? "text-rose-700" : "text-[#059669]"
                            }`}
                          >
                            {isNegative ? "" : "+"}
                            {txn.quantity} {txn.unit}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1">
                            {txn.shiftType === "MORNING_SHIFT" ? (
                              <Sun className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Moon className="w-3 h-3 text-indigo-400" />
                            )}
                            <span>
                              {new Date(txn.createdAt).toLocaleDateString("en-NG", {
                                day: "2-digit",
                                month: "short",
                              })}{" "}
                              {new Date(txn.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <span>
                            By: <strong className="text-slate-700">{txn.performedByName}</strong>
                            {txn.recipient && ` → ${txn.recipient}`}
                          </span>
                        </div>

                        {(txn.referenceId || txn.notes) && (
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-mono">{txn.referenceId ? `Ref: ${txn.referenceId}` : ""}</span>
                            <span className="truncate max-w-[200px]">{txn.notes || ""}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table (>= sm) */}
              <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date & Shift</th>
                        <th className="py-3 px-3">Material / Product</th>
                        <th className="py-3 px-3">Movement Type</th>
                        <th className="py-3 px-3 text-right">Quantity Change</th>
                        <th className="py-3 px-3">Batch / PO Ref</th>
                        <th className="py-3 px-3">Operator</th>
                        <th className="py-3 px-4">Notes / Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Loading product movement history...
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No transactions recorded matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((txn) => {
                          const badge = formatTxnType(txn.transactionType);
                          const isNegative = txn.quantity < 0;

                          return (
                            <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">
                                  {new Date(txn.createdAt).toLocaleDateString("en-NG", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                  {txn.shiftType === "MORNING_SHIFT" ? (
                                    <>
                                      <Sun className="w-3 h-3 text-amber-500" />
                                      <span>Morning (08:00 - 18:00)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Moon className="w-3 h-3 text-indigo-400" />
                                      <span>Night (18:00 - 08:00)</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900">
                                {txn.itemName}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                <span className={isNegative ? "text-rose-700" : "text-[#059669]"}>
                                  {isNegative ? "" : "+"}
                                  {txn.quantity} {txn.unit}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                                {txn.referenceId || "—"}
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-700">
                                <div>{txn.performedByName}</div>
                                {txn.recipient && (
                                  <div className="text-[10px] text-slate-400">
                                    To: {txn.recipient}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs">
                                {txn.notes || "Standard operation"}
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
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: SEE RETURNS & WHY */}
      {/* ============================================================ */}
      {activeTab === "returns" && (
        <div className="space-y-5 max-w-full min-w-0">
          {/* Executive Root Cause Summary Banner */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Return Root Cause & Discrepancy Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Executive analysis of factory mixing rejects, defective packaging, and supermarket shelf expirations.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Filter Source:</span>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setReturnSourceFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      returnSourceFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    All Returns
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnSourceFilter("FLOOR")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      returnSourceFilter === "FLOOR" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Plant Floor Scrap
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnSourceFilter("SUPERMARKET")}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      returnSourceFilter === "SUPERMARKET" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Supermarket SoR
                  </button>
                </div>
              </div>
            </div>

            {/* Root Causes Visual Distribution */}
            {returnsAudit?.reasonBreakdown && (
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(returnsAudit.reasonBreakdown).map(([reason, count]) => (
                  <div key={reason} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                      {reason}
                    </div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                      {count as number} <span className="text-xs font-normal text-slate-500">incidents</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search returns */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={returnSearch}
              onChange={(e) => setReturnSearch(e.target.value)}
              placeholder="Search return reason, material, store..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:border-[#CF0458] focus:outline-hidden shadow-xs"
            />
            {returnSearch && (
              <button
                type="button"
                onClick={() => setReturnSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Table 1: Factory Floor Raw Material Returns & Scrap */}
          {(returnSourceFilter === "ALL" || returnSourceFilter === "FLOOR") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#CF0458]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Plant Floor Material Returns & Scrap
                  </h4>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {floorReturns.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Faulty written off vs excess unmixed restocked</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date & Shift</th>
                        <th className="py-3 px-3">Item Returned</th>
                        <th className="py-3 px-3">Return Category</th>
                        <th className="py-3 px-4">Why Returned (Root Cause & Reason)</th>
                        <th className="py-3 px-3 text-right">Quantity</th>
                        <th className="py-3 px-3 text-right">Valuation Impact</th>
                        <th className="py-3 px-3">Shift Team & Batch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {floorReturns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            No plant floor returns recorded.
                          </td>
                        </tr>
                      ) : (
                        floorReturns.map((ret: any) => {
                          const isFault = ret.transactionType === "RETURN_FAULT_REPLACE";

                          return (
                            <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">
                                  {new Date(ret.createdAt).toLocaleDateString("en-NG", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {ret.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900">
                                {ret.itemName}
                              </td>
                              <td className="py-3 px-3">
                                {isFault ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-700 bg-red-50 border border-red-200">
                                    Fault Scrapped
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200">
                                    Excess Restocked
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{ret.rootCause}</span>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                  {ret.notes}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                {Math.abs(ret.quantity)} {ret.unit}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                <span className={isFault ? "text-rose-700" : "text-[#059669]"}>
                                  ₦ {ret.valueImpact ? ret.valueImpact.toLocaleString() : "0"}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-700">
                                <div className="font-medium">{ret.performedByName}</div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {ret.referenceId || "N/A"}
                                </div>
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

          {/* Table 2: Supermarket Sale or Return (SoR) Finished Product Returns */}
          {(returnSourceFilter === "ALL" || returnSourceFilter === "SUPERMARKET") && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#059669]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Supermarket Sale or Return (SoR) Shelf Returns
                  </h4>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {filteredSorReturns.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Expired or damaged stock retrieved from retailers</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
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
                      {filteredSorReturns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-400">
                            No retail supermarket returns recorded.
                          </td>
                        </tr>
                      ) : (
                        filteredSorReturns.map((ret) => {
                          const badge = formatSoRReason(ret.reason);

                          return (
                            <tr key={ret.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {new Date(ret.returnDate).toLocaleDateString("en-NG", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900">{ret.stockistName}</div>
                                <div className="text-[10px] text-slate-400">Stockist ID: {ret.stockistId}</div>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-slate-700">
                                {ret.productCode}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
                                  {badge.label}
                                </span>
                                {ret.notes && (
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    {ret.notes}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                {ret.quantityReturned} units
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-[#CF0458]">
                                ₦ {ret.creditAmount.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-600">
                                {ret.receivedBy}
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
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: RECONCILIATION LOG & SHIFT HANDOVER LEDGER */}
      {/* ============================================================ */}
      {activeTab === "reconcile" && (
        <div className="space-y-5 max-w-full min-w-0">
          {/* Active Shift Operations HUD Card */}
          <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                      <span>Live Shift Active</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Plant: Lagos Central Facility
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    {activeShift === "MORNING_SHIFT" ? "Morning Shift (08:00 – 18:00)" : "Night Shift (18:00 – 08:00)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Officer on Duty: <span className="font-semibold text-slate-700">{activeShiftRecord?.openedByName || "Store Officer"}</span>
                    {activeShiftRecord?.createdAt && (
                      <span className="ml-1 text-slate-400">
                        • Started {new Date(activeShiftRecord.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshShifts()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingShifts ? "animate-spin text-[#CF0458]" : ""}`} />
                  <span>Sync Shift State</span>
                </button>
              </div>
            </div>

            {/* Live Shift Stats Counter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Batches Dispensed
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shiftStats.dispensedCount} batches
                </span>
                <span className="text-[10px] text-slate-400">Production floor run</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Supplier Deliveries
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shiftStats.intakeCount} received
                </span>
                <span className="text-[10px] text-slate-400">Inbound intake logs</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Returns Processed
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shiftStats.returnsCount} items
                </span>
                <span className="text-[10px] text-slate-400">Faults & excess</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Handover Audit Status
                </span>
                <span className="text-base sm:text-lg font-extrabold text-[#059669] font-mono mt-0.5 block">
                  Official Ledger
                </span>
                <span className="text-[10px] text-slate-400">Certified digital audit</span>
              </div>
            </div>
          </div>

          {/* Historical Shift Handover Ledger */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Shift Handover & Stock Reconciliation History
                </h3>
                <p className="text-xs text-slate-500">
                  Certified digital certificates of shift changeovers, verified physical counts, and custody handovers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshShifts()}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingShifts ? "animate-spin text-[#CF0458]" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Mobile Shift Cards (< sm: No Horizontal Scroll) */}
            <div className="sm:hidden space-y-2">
              {loadingShifts ? (
                <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                  <span className="text-xs">Loading shift records...</span>
                </div>
              ) : historicalShifts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <span className="text-xs font-semibold">No historical shift records yet.</span>
                </div>
              ) : (
                historicalShifts.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedShiftDetail(s)}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2 cursor-pointer hover:border-[#CF0458]/40 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{s.shiftDate}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            s.shiftType === "MORNING_SHIFT"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                          }`}
                        >
                          {s.shiftType === "MORNING_SHIFT" ? "☀️ Morning" : "🌙 Night"}
                        </span>
                      </div>
                      {s.status === "RECONCILED" ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#059669]/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600">
                      <span className="text-slate-400">Handover: </span>
                      <span className="font-semibold text-slate-800">{s.openedByName}</span>
                      {s.handoverOfficerName && (
                        <>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="font-semibold text-slate-800">{s.handoverOfficerName}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500 font-mono">
                        {s.totalVariances === 0 ? "Zero Variances" : `${s.totalVariances} Variances`}
                      </span>
                      <span className="text-[#CF0458] font-bold flex items-center gap-0.5">
                        <span>View Certificate</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Shift Table (>= sm) */}
            <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Shift Date & Schedule</th>
                      <th className="py-3 px-3">Outgoing Officer</th>
                      <th className="py-3 px-3">Incoming Handover Officer</th>
                      <th className="py-3 px-3 text-center">Physical Count Result</th>
                      <th className="py-3 px-3 text-center">Lock Status</th>
                      <th className="py-3 px-4 text-right">Audit Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingShifts ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                          Loading shift handover history...
                        </td>
                      </tr>
                    ) : historicalShifts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No shift handover records found.
                        </td>
                      </tr>
                    ) : (
                      historicalShifts.map((s) => {
                        const isMorning = s.shiftType === "MORNING_SHIFT";

                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedShiftDetail(s)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 font-mono">{s.shiftDate}</div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                {isMorning ? (
                                  <>
                                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>Morning (08:00 – 18:00)</span>
                                  </>
                                ) : (
                                  <>
                                    <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>Night (18:00 – 08:00)</span>
                                  </>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-slate-700">
                              <div className="font-semibold text-slate-900">{s.openedByName}</div>
                              <div className="text-[10px] text-slate-400">Outgoing Officer</div>
                            </td>

                            <td className="py-3 px-3 text-slate-700">
                              {s.handoverOfficerName ? (
                                <>
                                  <div className="font-semibold text-slate-900">{s.handoverOfficerName}</div>
                                  <div className="text-[10px] text-slate-400">Handover Received</div>
                                </>
                              ) : (
                                <span className="text-slate-400 italic">Pending Handover</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center font-mono">
                              {s.status === "RECONCILED" ? (
                                s.totalVariances === 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#059669]">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>100% Balanced</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#CF0458]">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>{s.totalVariances} Variance Items</span>
                                  </span>
                                )
                              ) : (
                                <span className="text-[11px] text-slate-400 font-normal">In Progress</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {s.status === "RECONCILED" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Locked</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Active Count</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShiftDetail(s);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                              >
                                <span>Official Certificate</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
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
        </div>
      )}

      {/* Detail Modal for Production Batch Details */}
      <BatchDetailModal
        batch={batchDetailModal}
        onClose={() => setBatchDetailModal(null)}
      />

      {/* Official Shift Reconciliation Certificate Modal */}
      <ShiftDetailModal
        isOpen={!!selectedShiftDetail}
        shift={selectedShiftDetail}
        onClose={() => setSelectedShiftDetail(null)}
      />

      {/* Detail Modal for Item Lot Audit */}
      <ItemDetailAuditModal
        isOpen={!!selectedItemDetail}
        item={selectedItemDetail}
        onClose={() => setSelectedItemDetail(null)}
        transactions={transactions}
      />
    </div>
  );
}
