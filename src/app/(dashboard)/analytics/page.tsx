"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { AnalyticsPeriod } from "@/types/analytics";
import {
  useStoreAnalytics,
  useProductionAnalytics,
  useFinancialAnalytics,
  useExecutiveAnalytics,
} from "@/lib/swr";
import { AnalyticsDateFilter } from "@/components/analytics/AnalyticsDateFilter";
import { StoreAnalyticsView } from "@/components/analytics/StoreAnalyticsView";
import { ProductionAnalyticsView } from "@/components/analytics/ProductionAnalyticsView";
import { FinancialAnalyticsView } from "@/components/analytics/FinancialAnalyticsView";
import { ExecutiveAnalyticsView } from "@/components/analytics/ExecutiveAnalyticsView";
import {
  BarChart3,
  Boxes,
  Factory,
  Coins,
  ShieldAlert,
  RefreshCw,
  Sparkles,
  Lock,
} from "lucide-react";

export type AnalyticsTabId = "store" | "production" | "finance" | "executive";

export default function AnalyticsDashboardPage() {
  const { user } = useAuth();
  const userRole = user?.role || "";

  // Financial & Executive clearance: SUPER_ADMIN, EXECUTIVE, ACCOUNTANT
  const canAccessFinancials = ["SUPER_ADMIN", "EXECUTIVE", "ACCOUNTANT"].includes(userRole);

  // Tab State synced with URL hash
  const [activeTab, setActiveTab] = useState<AnalyticsTabId>("store");

  // Initial 7-day period window
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => {
    const today = new Date();
    const past7 = new Date();
    past7.setDate(today.getDate() - 6);
    return {
      startDate: past7.toISOString().slice(0, 10),
      endDate: today.toISOString().slice(0, 10),
      shiftType: "ALL",
    };
  });

  // Sync hash on mount and on hashchange
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "").toLowerCase() as AnalyticsTabId;
      if (["store", "production", "finance", "executive"].includes(hash)) {
        if ((hash === "finance" || hash === "executive") && !canAccessFinancials) {
          // Fallback to store if unauthorized
          setActiveTab("store");
          window.location.hash = "store";
        } else {
          setActiveTab(hash);
        }
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [canAccessFinancials]);

  const handleTabChange = (tab: AnalyticsTabId) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // SWR Hook calls with conditional fetching for privileged endpoints
  const isStoreTab = activeTab === "store";
  const isProdTab = activeTab === "production";
  const isFinTab = activeTab === "finance";
  const isExecTab = activeTab === "executive";

  const {
    analytics: storeData,
    isLoading: storeLoading,
    isValidating: storeValidating,
    mutate: mutateStore,
  } = useStoreAnalytics(period, isStoreTab || isExecTab);

  const {
    analytics: prodData,
    isLoading: prodLoading,
    isValidating: prodValidating,
    mutate: mutateProd,
  } = useProductionAnalytics(period, isProdTab || isExecTab);

  const {
    analytics: finData,
    isLoading: finLoading,
    isValidating: finValidating,
    mutate: mutateFin,
  } = useFinancialAnalytics(period, canAccessFinancials && (isFinTab || isExecTab));

  const {
    analytics: execData,
    isLoading: execLoading,
    isValidating: execValidating,
    mutate: mutateExec,
  } = useExecutiveAnalytics(period, canAccessFinancials && isExecTab);

  const isRefreshing = storeValidating || prodValidating || finValidating || execValidating;

  const handleRefresh = () => {
    if (isStoreTab) mutateStore();
    else if (isProdTab) mutateProd();
    else if (isFinTab) mutateFin();
    else if (isExecTab) mutateExec();
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-[#CF0458] to-[#800020] text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Operations & Analytics Hub
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Live cross-departmental intelligence, yield curves, inventory velocity & financial draw
              </p>
            </div>
          </div>
        </div>

        {/* Access Clearance & Refresh Controls */}
        <div className="flex items-center gap-2.5">
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              canAccessFinancials
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {canAccessFinancials ? "Executive & Finance Access" : "Departmental Operations Access"}
          </span>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Refresh active tab data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#CF0458]" : "text-slate-500"}`} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* 2. Global Date & Shift Filter Bar */}
      <AnalyticsDateFilter period={period} onChange={setPeriod} isLoading={isRefreshing} />

      {/* 3. Role-Gated Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto scrollbar-none pb-px">
        {/* Store Analytics Tab */}
        <button
          type="button"
          onClick={() => handleTabChange("store")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "store"
              ? "border-[#CF0458] text-[#CF0458] bg-rose-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Store & Inventory</span>
        </button>

        {/* Production Analytics Tab */}
        <button
          type="button"
          onClick={() => handleTabChange("production")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "production"
              ? "border-[#CF0458] text-[#CF0458] bg-rose-50/50 rounded-t-lg"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>Kitchen Production</span>
        </button>

        {/* Financial Analytics Tab */}
        <button
          type="button"
          disabled={!canAccessFinancials}
          onClick={() => handleTabChange("finance")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            !canAccessFinancials
              ? "border-transparent text-slate-400 opacity-60 cursor-not-allowed"
              : activeTab === "finance"
              ? "border-[#CF0458] text-[#CF0458] bg-rose-50/50 rounded-t-lg cursor-pointer"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 cursor-pointer"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Financial Valuation</span>
          {!canAccessFinancials && <Lock className="w-3 h-3 text-slate-400" />}
        </button>

        {/* Executive Overview Tab */}
        <button
          type="button"
          disabled={!canAccessFinancials}
          onClick={() => handleTabChange("executive")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
            !canAccessFinancials
              ? "border-transparent text-slate-400 opacity-60 cursor-not-allowed"
              : activeTab === "executive"
              ? "border-[#CF0458] text-[#CF0458] bg-rose-50/50 rounded-t-lg cursor-pointer"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 cursor-pointer"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Executive Overview</span>
          {!canAccessFinancials && <Lock className="w-3 h-3 text-slate-400" />}
        </button>
      </div>

      {/* 4. Active Tab Content Panels */}
      <div className="pt-2">
        {activeTab === "store" && (
          <StoreAnalyticsView data={storeData} isLoading={storeLoading} />
        )}

        {activeTab === "production" && (
          <ProductionAnalyticsView data={prodData} isLoading={prodLoading} />
        )}

        {activeTab === "finance" && (
          canAccessFinancials ? (
            <FinancialAnalyticsView data={finData} isLoading={finLoading} />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-md mx-auto">
              <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">Access Restricted</h3>
              <p className="text-xs text-slate-600 mt-1 mb-4">
                Financial valuation and supermarket ledger analytics are restricted to Finance and Executive Management roles.
              </p>
              <button
                type="button"
                onClick={() => handleTabChange("store")}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
              >
                Return to Store Analytics
              </button>
            </div>
          )
        )}

        {activeTab === "executive" && (
          canAccessFinancials ? (
            <ExecutiveAnalyticsView data={execData} isLoading={execLoading} />
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-md mx-auto">
              <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">Access Restricted</h3>
              <p className="text-xs text-slate-600 mt-1 mb-4">
                The Executive scorecard synthesizes plant-wide financial and yield data restricted to Senior Management.
              </p>
              <button
                type="button"
                onClick={() => handleTabChange("store")}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-colors"
              >
                Return to Store Analytics
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
