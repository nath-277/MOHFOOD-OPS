"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { RetailStockist, WhatsAppInvoice } from "@/server/management/store";
import { ProductRecipe } from "@/server/inventory/store";
import { DispatchConsignmentModal } from "@/components/management/DispatchConsignmentModal";
import { RecordSoRReturnModal } from "@/components/management/RecordSoRReturnModal";
import { RecordPaymentModal } from "@/components/management/RecordPaymentModal";
import { UploadWhatsAppInvoiceModal } from "@/components/management/UploadWhatsAppInvoiceModal";
import { AddStockistModal } from "@/components/management/AddStockistModal";
import { useShift } from "@/components/shift/ShiftContext";
import { formatPackagingDisplay } from "@/lib/packaging";
import {
  Store,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  Clock,
  Check,
  Search,
  X,
  Plus,
  Truck,
  RotateCcw,
  RefreshCw,
  Building,
  Upload,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  Boxes,
  Box,
  Scale,
  Sun,
  Moon,
} from "lucide-react";

export default function ManagementDashboardPage() {
  const { user } = useAuth();
  const { activeShift, activeShiftRecord } = useShift();
  const [activeTab, setActiveTab] = useState<"sor" | "invoices" | "par_levels">("sor");
  const [parUnitPref, setParUnitPref] = useState<"PACKAGES" | "BASE_UNITS">("PACKAGES");

  // Sync tab with URL hash if present & custom event
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "sor" || hash === "invoices" || hash === "par_levels") {
        setActiveTab(hash as any);
      }
    };
    const handleTabEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail === "sor" || customEvent.detail === "invoices" || customEvent.detail === "par_levels") {
        setActiveTab(customEvent.detail as any);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("management:switch-tab", handleTabEvent);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("management:switch-tab", handleTabEvent);
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("ALL");

  // Live Data States
  const [overview, setOverview] = useState<any>(null);
  const [stockists, setStockists] = useState<RetailStockist[]>([]);
  const [invoices, setInvoices] = useState<WhatsAppInvoice[]>([]);
  const [parRunways, setParRunways] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isUploadInvoiceOpen, setIsUploadInvoiceOpen] = useState(false);
  const [isAddStockistOpen, setIsAddStockistOpen] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [overviewRes, stockistsRes, invoicesRes, parRes, recipesRes] = await Promise.all([
        fetch("/api/management/overview"),
        fetch(`/api/management/stockists?search=${encodeURIComponent(searchQuery)}`),
        fetch(`/api/management/whatsapp-invoices?status=${invoiceFilter}`),
        fetch("/api/management/par-levels"),
        fetch("/api/inventory/recipes"),
      ]);

      if (overviewRes.ok) {
        const d = await overviewRes.json();
        setOverview(d);
      }
      if (stockistsRes.ok) {
        const d = await stockistsRes.json();
        setStockists(d.stockists || []);
      }
      if (invoicesRes.ok) {
        const d = await invoicesRes.json();
        setInvoices(d.invoices || []);
      }
      if (parRes.ok) {
        const d = await parRes.json();
        setParRunways(d.parRunways || []);
      }
      if (recipesRes.ok) {
        const d = await recipesRes.json();
        setRecipes(d.recipes || []);
      }
    } catch (err) {
      console.error("Failed to load management dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, invoiceFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerifyInvoice = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/management/whatsapp-invoices/${invoiceId}/verify`, {
        method: "PUT",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify invoice.");
      showToast(`Invoice ${invoiceId} verified and reconciled.`);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to verify invoice.");
    }
  };

  const handleExportCSV = () => {
    window.open("/api/management/export-sor", "_blank");
    showToast("Supermarket SoR ledger exported to CSV.");
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

      {/* Clean Uncluttered Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Executive Management
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Retail Consignment & Cash Oversight
            </span>

            {/* Live Operational Shift HUD Banner */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {activeShift === "MORNING_SHIFT" ? (
                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              )}
              <span className="font-bold">
                {activeShift === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600 text-[10px]">
                Officer: <strong className="text-slate-800">{activeShiftRecord?.openedByName || "Store Officer"}</strong>
              </span>
              <Link
                href="/inventory#reconcile"
                className="ml-1 text-[10px] font-bold text-[#CF0458] hover:underline flex items-center gap-0.5"
                title="View shift reconciliation log in Store Inventory"
              >
                <span>Audit</span>
                <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Executive Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supermarket Sale or Return (SoR) consignments, WhatsApp invoice verification, and plant buffer runway.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsDispatchOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Dispatch Consignment</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReturnOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Record Return</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPaymentOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-slate-600" />
            <span>Record Payment</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards - 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Consignment Receivables
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#CF0458] mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {overview ? overview.totalConsignmentDebt.toLocaleString() : "..."}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {overview ? `${overview.activeAccountsPending} accounts pending` : "Loading..."}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-[#CF0458] flex items-center justify-center shrink-0 ml-2">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Raw Stock Valuation
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {overview ? overview.rawStockValuation.toLocaleString() : "..."}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              Store inventory holding
            </div>
            <div className="mt-1 sm:mt-2">
              <Link
                href="/inventory"
                className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-[#CF0458] hover:underline"
              >
                <span>Store Stock</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              WhatsApp Waybill Queue
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
              {overview ? `${overview.pendingInvoices} Pending` : "..."}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Driver receipts to reconcile
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Daily Plant Output
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {overview ? `${overview.dailyOutput} Units` : "..."}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {overview ? `${Math.round((overview.dailyOutput / overview.targetOutput) * 100)}% of target (${overview.targetOutput})` : "Loading..."}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar flex-nowrap shrink-0 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("sor")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "sor"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Supermarket SoR Consignments</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {stockists.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "invoices"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>WhatsApp Invoices & Waybills</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {invoices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("par_levels")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "par_levels"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Plant Par Levels & Buffers</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: SUPERMARKET SoR LEDGER */}
      {/* ============================================================ */}
      {activeTab === "sor" && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stockist name or location..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
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

            {/* Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Net Sold = Delivered minus Expired Shelf Returns
              </span>

              <button
                type="button"
                onClick={() => setIsAddStockistOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Retail Stockist</span>
              </button>
            </div>
          </div>

          {/* Mobile Card Layout (< sm) */}
          <div className="sm:hidden space-y-3">
            {loading ? (
              <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                <span className="text-xs">Loading supermarket consignment accounts...</span>
              </div>
            ) : stockists.length === 0 ? (
              <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                <Building className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <span className="text-xs font-semibold text-slate-600">No stockists found.</span>
              </div>
            ) : (
              stockists.map((stk) => (
                <div
                  key={stk.id}
                  className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between"
                >
                  {/* Top: Name, Code & Status */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {stk.code}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {stk.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1 truncate">
                        <Building className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{stk.location}</span>
                        <span className="text-slate-300">•</span>
                        <span className="truncate text-slate-600 font-medium">{stk.contactPerson}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        <a href={`tel:${stk.phone}`} className="hover:text-[#CF0458] font-mono">
                          {stk.phone}
                        </a>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {stk.status === "VERIFIED_PAID" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Settled</span>
                        </span>
                      ) : stk.status === "OVERDUE" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Overdue</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full border border-[#D97706]/20">
                          <Clock className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-slate-100 text-center">
                    <div className="p-1.5 rounded-lg bg-slate-50">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase">Delivered</div>
                      <div className="font-mono font-bold text-xs text-slate-900 mt-0.5">
                        {stk.totalDelivered} <span className="text-[9px] font-normal text-slate-500">cups</span>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50">
                      <div className="text-[9px] text-slate-400 font-semibold uppercase">Returns</div>
                      <div className="font-mono font-bold text-xs text-slate-500 mt-0.5">
                        {stk.totalReturns} <span className="text-[9px] font-normal text-slate-400">cups</span>
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-50/50">
                      <div className="text-[9px] text-emerald-700 font-semibold uppercase">Net Sold</div>
                      <div className="font-mono font-extrabold text-xs text-emerald-800 mt-0.5">
                        {stk.totalNetSold} <span className="text-[9px] font-normal text-emerald-600">cups</span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Footer: Unit Price & Outstanding Debt */}
                  <div className="pt-2.5 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500">
                      <span>Rate: </span>
                      <span className="font-mono font-semibold text-slate-700">₦{stk.standardUnitPrice.toLocaleString()}/cup</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Outstanding Debt</div>
                      <div className="font-mono font-extrabold text-sm text-[#CF0458]">
                        ₦ {stk.outstandingDebt.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between text-xs text-slate-500">
              <span>Showing {stockists.length} accounts</span>
              <button
                type="button"
                onClick={loadData}
                className="text-[#CF0458] font-semibold hover:underline cursor-pointer"
              >
                Refresh Accounts
              </button>
            </div>
          </div>

          {/* Desktop Table View (>= sm) */}
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Retail Stockist</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Unit Price</th>
                    <th className="py-3 px-4 text-right">Delivered</th>
                    <th className="py-3 px-4 text-right">Expired Returns</th>
                    <th className="py-3 px-4 text-right">Net Sold</th>
                    <th className="py-3 px-4 text-right">Outstanding Debt</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                        <span>Loading supermarket consignment accounts...</span>
                      </td>
                    </tr>
                  ) : stockists.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">
                        <Building className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-600">No stockists found.</span>
                      </td>
                    </tr>
                  ) : (
                    stockists.map((stk) => (
                      <tr key={stk.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{stk.name}</div>
                          <div className="text-[10px] text-slate-400">{stk.contactPerson} • {stk.phone}</div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          {stk.location}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                          ₦ {stk.standardUnitPrice.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-900">
                          {stk.totalDelivered} cups
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                          {stk.totalReturns} cups
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {stk.totalNetSold} cups
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-[#CF0458]">
                          ₦ {stk.outstandingDebt.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {stk.status === "VERIFIED_PAID" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                              <Check className="w-3 h-3" />
                              <span>Settled</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full border border-[#D97706]/20">
                              <Clock className="w-3 h-3" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {stockists.length} retail consignment accounts</span>
              <button
                type="button"
                onClick={loadData}
                className="text-[#CF0458] font-semibold hover:underline cursor-pointer"
              >
                Refresh Accounts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: WHATSAPP INVOICES & WAYBILLS */}
      {/* ============================================================ */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Centralized WhatsApp Delivery Reconciliation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Delivery drivers post photos of signed delivery notes and bank teller receipts in the logistics WhatsApp group. Reconcile and confirm here.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { id: "ALL", label: "All" },
                  { id: "PENDING_REVIEW", label: "Pending" },
                  { id: "VERIFIED", label: "Verified" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInvoiceFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      invoiceFilter === f.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsUploadInvoiceOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Waybill</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
              <span className="text-xs">Loading WhatsApp invoices...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <span className="text-xs font-semibold text-slate-600">No invoices in this view.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Header bar */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {inv.invoiceNumber}
                      </span>
                      {inv.status === "VERIFIED" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#D97706] bg-[#FFFBEB] border border-[#D97706]/20">
                          Pending Review
                        </span>
                      )}
                    </div>

                    {/* Image Preview if available */}
                    {inv.fileUrl && (
                      <div className="h-32 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                        <img
                          src={inv.fileUrl}
                          alt="Receipt photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Details */}
                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-slate-900 text-sm">{inv.stockistName}</h3>

                      <div className="text-xs text-slate-500 space-y-1">
                        <div>Delivered by: <span className="font-semibold text-slate-700">{inv.driverName}</span></div>
                        <div>WhatsApp sender: <span className="font-mono text-slate-700">{inv.senderPhone}</span></div>
                        <div>Time logged: <span>{inv.time}</span></div>
                        {inv.notes && (
                          <div className="p-2 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                            {inv.notes}
                          </div>
                        )}
                        <div className="font-bold text-slate-900 font-mono text-sm pt-1">
                          Amount: ₦ {inv.amount.toLocaleString()} {inv.itemCount > 0 && `(${inv.itemCount} cups)`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end">
                    {inv.status === "VERIFIED" ? (
                      <div className="text-[11px] text-slate-400 font-medium">
                        Verified by {inv.verifiedByName || "Executive"}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVerifyInvoice(inv.id)}
                        className="w-full py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm & Reconcile Account</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PLANT OPERATIONS & PAR LEVELS */}
      {/* ============================================================ */}
      {activeTab === "par_levels" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Live Material Par Levels & Plant Runway
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buffer days calculated dynamically against current daily plant velocity of 850 units/day.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {/* Unit Display Preference Switcher */}
                <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setParUnitPref("PACKAGES")}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      parUnitPref === "PACKAGES"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Display stock in packages (cartons/packs)"
                  >
                    <Box className="w-3 h-3 shrink-0" />
                    <span>Packs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setParUnitPref("BASE_UNITS")}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      parUnitPref === "BASE_UNITS"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Display stock in raw base units"
                  >
                    <Scale className="w-3 h-3 shrink-0" />
                    <span>Units</span>
                  </button>
                </div>

                <Link
                  href="/inventory"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs transition-all"
                >
                  <Boxes className="w-3.5 h-3.5 text-slate-600" />
                  <span>Manage Store Stock</span>
                </Link>
                <button
                  type="button"
                  onClick={loadData}
                  className="text-xs font-bold text-[#CF0458] hover:underline cursor-pointer"
                >
                  Refresh Buffer Runways
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              {parRunways.map((item) => {
                const isCritical = item.status === "CRITICAL";
                const isWarning = item.status === "WARNING";
                const pkg = formatPackagingDisplay(item.stock, item);
                const hasPkg = pkg.type !== "DIRECT";

                return (
                  <div
                    key={item.code}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">
                            {item.code}
                          </span>
                          {item.isVariablePack && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Variable
                            </span>
                          )}
                        </div>
                        {isCritical ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-700 bg-red-50 border border-red-200">
                            Critical Alert
                          </span>
                        ) : isWarning ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#D97706] bg-[#FFFBEB] border border-[#D97706]/20">
                            Low Buffer
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20">
                            Healthy
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm mb-1">{item.name}</h4>
                      
                      {parUnitPref === "PACKAGES" && hasPkg ? (
                        <div>
                          <div className="text-xl font-bold font-mono text-slate-900">
                            {pkg.primary}
                          </div>
                          {pkg.secondary && (
                            <div className="text-xs text-slate-500 font-sans mt-0.5">
                              {pkg.secondary}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="text-xl font-bold font-mono text-slate-900">
                            {item.stock.toLocaleString()}{" "}
                            <span className="text-xs font-normal text-slate-500">{item.uom}</span>
                          </div>
                          {hasPkg && (
                            <div className="text-xs text-slate-500 font-sans mt-0.5">
                              ≈ {pkg.primary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-500">Runway coverage:</span>
                      <span className={`font-bold font-mono ${isCritical ? "text-red-700" : isWarning ? "text-[#D97706]" : "text-[#059669]"}`}>
                        {item.runwayDays} days
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modals */}
      <DispatchConsignmentModal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        stockists={stockists}
        recipes={recipes}
        onSuccess={() => {
          loadData();
          showToast("Consignment dispatch waybill generated.");
        }}
      />

      <RecordSoRReturnModal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        stockists={stockists}
        onSuccess={() => {
          loadData();
          showToast("Sale or Return credit adjustment applied.");
        }}
      />

      <RecordPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        stockists={stockists}
        onSuccess={() => {
          loadData();
          showToast("Consignment payment settlement recorded.");
        }}
      />

      <UploadWhatsAppInvoiceModal
        isOpen={isUploadInvoiceOpen}
        onClose={() => setIsUploadInvoiceOpen(false)}
        stockists={stockists}
        onSuccess={() => {
          loadData();
          showToast("Driver waybill queued for verification.");
        }}
      />

      <AddStockistModal
        isOpen={isAddStockistOpen}
        onClose={() => setIsAddStockistOpen(false)}
        onSuccess={() => {
          loadData();
          showToast("Retail stockist registered successfully.");
        }}
      />
    </div>
  );
}
