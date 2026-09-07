"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { InventoryItem, StockTransaction } from "@/server/inventory/store";
import { ConsignmentReturn } from "@/server/management/store";
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
} from "lucide-react";

interface ExecutiveInventoryViewProps {
  onSwitchToFloorView?: () => void;
  canSwitchView?: boolean;
}

export function ExecutiveInventoryView({
  onSwitchToFloorView,
  canSwitchView = false,
}: ExecutiveInventoryViewProps) {
  // Tabs: "stock" | "history" | "returns"
  const [activeTab, setActiveTab] = useState<"stock" | "history" | "returns">("stock");

  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [returnsAudit, setReturnsAudit] = useState<any>(null);
  const [consignmentReturns, setConsignmentReturns] = useState<ConsignmentReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters for Stock
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("ALL");
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);

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
      if (hash === "stock" || hash === "history" || hash === "returns") {
        setActiveTab(hash as any);
      }
    };
    const handleTabEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail === "stock" || customEvent.detail === "history" || customEvent.detail === "returns") {
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
        return { label: "Batch Dispense", color: "text-[#8E1538] bg-rose-50 border-rose-200" };
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
              title="Switch to floor terminal view"
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

      {/* 4 Quiet Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Stock Valuation
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              ₦ {totalStockValuation.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-[#059669] mt-0.5">
              Live warehouse holding
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Tracked Materials
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              {items.length} <span className="text-xs font-normal text-slate-500">Items</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {lowStockCount > 0 ? (
                <span className="text-[#8E1538] font-bold">{lowStockCount} below safety threshold</span>
              ) : (
                <span className="text-[#059669]">All buffers healthy</span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Plant Floor Scrap Loss
            </div>
            <div className="text-2xl font-bold text-[#8E1538] mt-1 font-mono">
              ₦ {totalScrapLoss.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {returnsAudit ? `${returnsAudit.faultScrappedCount} fault write-offs` : "Loading..."}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#8E1538] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Supermarket SoR Returns
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              ₦ {totalSupermarketCredit.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {consignmentReturns.length} retail credit adjustments
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar: 1. Check Stock, 2. Product History, 3. See Returns & Why */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("stock")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "stock"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Check Stock</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "history"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Product Movement History</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("returns")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "returns"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>See Returns & Why</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-rose-50 text-[#8E1538] font-bold border border-rose-200">
            {(returnsAudit?.totalReturnsCount || 0) + consignmentReturns.length}
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CHECK STOCK */}
      {/* ============================================================ */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                placeholder="Search material name, code, location..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
              {stockSearch && (
                <button
                  type="button"
                  onClick={() => setStockSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {[
                { id: "ALL", label: "All Categories" },
                { id: "PERISHABLE_MEASURED", label: "Measured (kg/l)" },
                { id: "PERISHABLE_NUMBERED", label: "Numbered (pcs)" },
                { id: "PACKAGING_NON_PERISHABLE", label: "Packaging" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStockCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    stockCategory === tab.id
                      ? "bg-[#8E1538] text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Material / Item</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Storage Location</th>
                    <th className="py-3 px-3 text-right">Available Stock</th>
                    <th className="py-3 px-3 text-right">Safety Threshold</th>
                    <th className="py-3 px-3 text-right">Unit Cost</th>
                    <th className="py-3 px-3 text-right">Holding Value</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Loading live inventory balances...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No materials found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
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
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="36px"
                                  />
                                ) : (
                                  <Boxes className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{item.name}</div>
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
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {item.currentStock.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{item.uom}</span>
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

      {/* ============================================================ */}
      {/* TAB 2: PRODUCT MOVEMENT HISTORY */}
      {/* ============================================================ */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search material, batch #, operator..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
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

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    historyType === tab.id
                      ? "bg-[#8E1538] text-white shadow-xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
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
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
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
                              <div className="text-[10px] text-slate-400">To: {txn.recipient}</div>
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

      {/* ============================================================ */}
      {/* TAB 3: SEE RETURNS & WHY */}
      {/* ============================================================ */}
      {activeTab === "returns" && (
        <div className="space-y-5">
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
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:border-[#8E1538] focus:outline-hidden shadow-xs"
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
                  <span className="w-2 h-2 rounded-full bg-[#8E1538]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Plant Floor Material Returns & Scrap
                  </h4>
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {floorReturns.length}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Faulty written off vs excess unmixed restocked</span>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
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

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
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
                              <td className="py-3 px-3 text-right font-mono font-bold text-[#8E1538]">
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

      {/* Detail Modal for Item Lot Audit */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[#8E1538]">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{selectedItemDetail.name}</h3>
                  <div className="font-mono text-[10px] text-slate-400">{selectedItemDetail.code}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Available Stock</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  {selectedItemDetail.currentStock.toLocaleString()} {selectedItemDetail.uom}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Holding Valuation</div>
                <div className="text-xl font-bold font-mono text-[#8E1538] mt-0.5">
                  ₦ {(selectedItemDetail.currentStock * selectedItemDetail.costPerUnit).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Unit Cost</div>
                <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
                  ₦ {selectedItemDetail.costPerUnit.toLocaleString()} / {selectedItemDetail.uom}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Storage Location</div>
                <div className="text-base font-bold text-slate-800 mt-0.5">
                  {selectedItemDetail.storageLocation}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Close Audit Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
