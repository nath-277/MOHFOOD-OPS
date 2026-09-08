"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ConsignmentReturn } from "@/server/management/store";
import {
  RotateCcw,
  Search,
  X,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  Building,
  CheckCircle2,
  Calendar,
  Layers,
  Store,
  DollarSign,
  Boxes,
} from "lucide-react";

export default function ReturnsPage() {
  const [returnsAudit, setReturnsAudit] = useState<any>(null);
  const [consignmentReturns, setConsignmentReturns] = useState<ConsignmentReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [returnSourceFilter, setReturnSourceFilter] = useState<"ALL" | "FLOOR" | "SUPERMARKET">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [returnsAuditRes, sorReturnsRes] = await Promise.all([
        fetch("/api/inventory/returns-audit"),
        fetch("/api/management/returns"),
      ]);

      if (returnsAuditRes.ok) {
        const d = await returnsAuditRes.json();
        setReturnsAudit(d);
      }
      if (sorReturnsRes.ok) {
        const d = await sorReturnsRes.json();
        setConsignmentReturns(d.returns || []);
      }
    } catch (err) {
      console.error("Failed to load returns ledger data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate Metrics
  const totalScrapLoss = useMemo(() => {
    return returnsAudit?.totalFaultLossValue || 0;
  }, [returnsAudit]);

  const totalSupermarketCredit = useMemo(() => {
    return consignmentReturns.reduce((acc, ret) => acc + ret.creditAmount, 0);
  }, [consignmentReturns]);

  // Plant floor raw returns
  const floorReturns = useMemo(() => {
    if (!returnsAudit?.returns) return [];
    let list = returnsAudit.returns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r: any) =>
          r.itemName?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q) ||
          r.rootCause?.toLowerCase().includes(q) ||
          r.referenceId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [returnsAudit, searchQuery]);

  // Supermarket SoR returns
  const filteredSorReturns = useMemo(() => {
    let list = consignmentReturns;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.stockistName.toLowerCase().includes(q) ||
          r.productCode.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }
    return list;
  }, [consignmentReturns, searchQuery]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-50 text-[#8E1538] border border-rose-200">
              Audit & Governance
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Root Cause & Discrepancy Tracking
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Returns & Why Root Cause Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Unified discrepancy tracking for factory floor raw material scrap, production rejects, and retail supermarket shelf returns.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Quiet Metric Summary Cards - 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Plant Floor Scrap Loss
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#8E1538] mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalScrapLoss.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {returnsAudit ? `${returnsAudit.faultScrappedCount} fault write-offs` : "Loading..."}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-[#8E1538] flex items-center justify-center shrink-0 ml-2">
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
              Floor Incidents
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {returnsAudit?.returns?.length || 0} <span className="text-xs font-normal text-slate-500">Events</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Scrap & excess restock
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Retail Outlets Reporting
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {new Set(consignmentReturns.map((r) => r.stockistName)).size} <span className="text-xs font-normal text-slate-500">Stores</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Active stockists
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Root Causes Distribution Banner */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Return Root Cause & Discrepancy Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Analysis of factory mixing rejects, defective packaging, and supermarket shelf expirations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Source:</span>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setReturnSourceFilter("ALL")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  returnSourceFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                All Returns
              </button>
              <button
                type="button"
                onClick={() => setReturnSourceFilter("FLOOR")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  returnSourceFilter === "FLOOR" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Plant Floor Scrap
              </button>
              <button
                type="button"
                onClick={() => setReturnSourceFilter("SUPERMARKET")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                  returnSourceFilter === "SUPERMARKET" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Supermarket SoR
              </button>
            </div>
          </div>
        </div>

        {/* Root Causes Visual Grid */}
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

      {/* Search Bar */}
      <div className="relative w-full md:w-80">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reason, material, store, batch..."
          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:border-[#8E1538] focus:outline-hidden shadow-xs"
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

      {/* Section 1: Factory Floor Raw Material Returns & Scrap */}
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
            <span className="text-[11px] text-slate-400">Fault write-offs vs excess unmixed restocked</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
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
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8E1538]" />
                        Loading plant floor returns...
                      </td>
                    </tr>
                  ) : floorReturns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No plant floor material returns or scrap recorded.
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
                              {ret.shiftType === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
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

      {/* Section 2: Supermarket Sale or Return (SoR) Finished Product Returns */}
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
            <span className="text-[11px] text-slate-400">Expired or damaged products retrieved from retailers</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
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
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8E1538]" />
                        Loading supermarket returns...
                      </td>
                    </tr>
                  ) : filteredSorReturns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        <Store className="w-8 h-8 mx-auto mb-2 text-slate-300" />
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
  );
}
