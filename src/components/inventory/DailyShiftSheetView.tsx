"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileSpreadsheet,
  Calendar,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Package,
  Layers,
  Sparkles,
  CheckCircle2,
  Check,
  Lock,
  User,
  FileText,
} from "lucide-react";
import { formatPackagingDisplay } from "@/lib/packaging";
import { MaterialRequisitionModal } from "@/components/inventory/MaterialRequisitionModal";
import { generateStockSheetHtml, printHtmlDocument } from "@/lib/printUtils";

export interface DailyShiftReportRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  category: string;
  uom: string;
  packagingType?: string;
  isVariablePack?: boolean;
  inUseQuantity?: number;
  inUseUnit?: string;
  recipeUom?: string;
  openingStock: number;
  newStock: number;
  totalStock: number;
  usage: number;
  damages: number;
  reconcileAdjust: number;
  closingStock: number;
  usageSecondary?: string;
  physicalCount?: number;
  variance?: number;
  discrepancyNote?: string;
}

export interface DailyShiftReport {
  date: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT" | "ALL";
  officerOnDuty?: string;
  handoverOfficer?: string;
  status: "OPEN" | "RECONCILED" | "PENDING";
  certifiedAt?: string;
  notes?: string;
  summary: {
    totalItems: number;
    totalOpening: number;
    totalNewStock: number;
    totalUsage: number;
    totalDamages: number;
    totalClosing: number;
    discrepanciesCount: number;
  };
  rows: DailyShiftReportRow[];
}

interface DailyShiftSheetViewProps {
  onOpenReconcile?: () => void;
  activeShift?: "MORNING_SHIFT" | "NIGHT_SHIFT";
}

export function DailyShiftSheetView({ onOpenReconcile, activeShift }: DailyShiftSheetViewProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedShift, setSelectedShift] = useState<"ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT">(
    activeShift || "MORNING_SHIFT"
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [report, setReport] = useState<DailyShiftReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState<boolean>(false);

  // Synchronize initial activeShift if passed
  useEffect(() => {
    if (activeShift && selectedShift === "ALL") {
      setSelectedShift(activeShift);
    }
  }, [activeShift]);

  const fetchReport = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);

        const res = await fetch(
          `/api/inventory/daily-shift-report?date=${selectedDate}&shiftType=${selectedShift}`
        );
        if (!res.ok) {
          throw new Error("Failed to load shift stock sheet data");
        }
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
        }
      } catch (err) {
        console.error("Error fetching daily shift report:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate, selectedShift]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Date Navigation helpers
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const isToday = selectedDate >= todayStr;

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    if (isToday) return;
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const nextDate = d.toISOString().split("T")[0];
    if (nextDate <= todayStr) {
      setSelectedDate(nextDate);
    }
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!report?.rows) return [];
    return report.rows.filter((row) => {
      // Category filter
      if (categoryFilter !== "ALL" && row.category !== categoryFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = row.itemName.toLowerCase().includes(q);
        const matchesCode = row.itemCode.toLowerCase().includes(q);
        return matchesName || matchesCode;
      }
      return true;
    });
  }, [report?.rows, categoryFilter, searchQuery]);

  // Operational count metrics (accurate stats without summing incompatible UoMs)
  const itemsWithNewStock = useMemo(
    () => filteredRows.filter((r) => r.newStock > 0).length,
    [filteredRows]
  );
  const itemsWithUsage = useMemo(
    () => filteredRows.filter((r) => r.usage > 0).length,
    [filteredRows]
  );
  const itemsWithDamages = useMemo(
    () => filteredRows.filter((r) => r.damages > 0).length,
    [filteredRows]
  );
  const discrepanciesCount = useMemo(
    () => filteredRows.filter((r) => r.variance !== undefined && r.variance !== 0).length,
    [filteredRows]
  );

  // Format numbers nicely
  const formatQty = (qty: number) => {
    if (qty === 0) return "0";
    return Number(qty.toFixed(3)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!report || !filteredRows.length) return;

    const headers = [
      "Item Code",
      "Item Name",
      "Category",
      "UoM",
      "Opening Stock",
      "New Stock (Additions)",
      "Total Stock",
      "Usage (Dispensed)",
      "Secondary Usage",
      "Damages & Waste",
      "Reconcile Adjustment",
      "Closing Stock",
      "Physical Count (Audit)",
      "Variance",
      "Discrepancy Notes",
    ];

    const csvLines = [
      headers.join(","),
      ...filteredRows.map((r) => {
        return [
          `"${r.itemCode}"`,
          `"${r.itemName.replace(/"/g, '""')}"`,
          `"${r.category}"`,
          `"${r.uom}"`,
          r.openingStock,
          r.newStock,
          r.totalStock,
          r.usage,
          `"${r.usageSecondary || ""}"`,
          r.damages,
          r.reconcileAdjust,
          r.closingStock,
          r.physicalCount !== undefined ? r.physicalCount : "",
          r.variance !== undefined ? r.variance : "",
          `"${(r.discrepancyNote || "").replace(/"/g, '""')}"`,
        ].join(",");
      }),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Moh_Daily_Shift_Sheet_${selectedDate}_${selectedShift}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print Report via Isolated Print Engine
  const handlePrint = () => {
    if (!report) return;
    const html = generateStockSheetHtml({
      report,
      selectedDate,
      shiftLabel: getShiftBadgeLabel(),
      rows: filteredRows,
    });
    printHtmlDocument(html, `Moh_Stock_Sheet_${selectedDate}_${selectedShift}`, "landscape");
  };

  const getShiftBadgeLabel = () => {
    if (selectedShift === "MORNING_SHIFT") return "Morning Shift (08:00 – 18:00)";
    if (selectedShift === "NIGHT_SHIFT") return "Night Shift (18:00 – 08:00)";
    return "Consolidated Full Day (24h)";
  };

  return (
    <div className="space-y-4 max-w-full min-w-0 print:m-0 print:p-0">
      {/* ============================================================ */}
      {/* 1. TOP CONTROL BAR: DATE, SHIFT SELECTOR, REFRESH & ACTIONS */}
      {/* ============================================================ */}
      <div className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Daily Shift Stock Sheet
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-[#CF0458] bg-[#CF0458]/10 px-2 py-0.5 rounded-full">
                  Floor Ledger
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Opening & closing balances, inbound deliveries, and production usage by shift.
              </p>
            </div>
          </div>

          {/* Action Buttons: Export & Print */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto">
            <button
              type="button"
              onClick={() => fetchReport(true)}
              disabled={loading || refreshing}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
              title="Refresh Sheet"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : "text-slate-500"}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRequisitionModalOpen(true)}
              disabled={loading}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shadow-xs"
              title="View Requisition Form"
            >
              <FileText className="w-3.5 h-3.5 text-[#CF0458]" />
              <span>Requisition Form</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || !filteredRows.length}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shadow-xs"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial shadow-xs"
              title="Print Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Date & Shift Switcher Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Date Selector with quick Day Prev/Today/Next */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1.5 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                disabled={isToday}
                className={`p-1.5 rounded-lg transition-all ${
                  isToday
                    ? "text-slate-300 opacity-40 cursor-not-allowed"
                    : "hover:bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
                }`}
                title={isToday ? "Future days have not arrived yet" : "Next Day"}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && val <= todayStr) {
                    setSelectedDate(val);
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CF0458]/20 focus:border-[#CF0458] cursor-pointer"
              />
            </div>
          </div>

          {/* Shift Switcher Segmented Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedShift("MORNING_SHIFT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedShift === "MORNING_SHIFT"
                  ? "bg-white text-[#CF0458] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Morning Shift (08:00–18:00)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift("NIGHT_SHIFT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedShift === "NIGHT_SHIFT"
                  ? "bg-white text-[#CF0458] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Night Shift (18:00–08:00)
            </button>
            <button
              type="button"
              onClick={() => setSelectedShift("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedShift === "ALL"
                  ? "bg-white text-[#CF0458] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Day (24h)
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SHIFT STATUS & CONTINUITY HUD BANNER                      */}
      {/* ============================================================ */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              report?.status === "RECONCILED"
                ? "bg-[#059669]/10 text-[#059669]"
                : "bg-blue-50 text-blue-600"
            }`}
          >
            {report?.status === "RECONCILED" ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              {report?.status === "RECONCILED" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#059669]/20">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Certified & Reconciled Shift</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span>Live Operational Sheet</span>
                </span>
              )}
              <span className="text-xs font-bold text-slate-800">
                {getShiftBadgeLabel()} • {selectedDate}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Store Officer:{" "}
              <span className="font-semibold text-slate-700">
                {report?.officerOnDuty || "Store Officer on Duty"}
              </span>
              {report?.handoverOfficer && (
                <span className="ml-1 text-slate-500">
                  • Handed over to:{" "}
                  <span className="font-semibold text-slate-700">{report.handoverOfficer}</span>
                </span>
              )}
              {report?.certifiedAt && (
                <span className="ml-1 text-slate-400">
                  • Closed at {new Date(report.certifiedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Handover continuity explanation / Reconcile CTA */}
        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto print:hidden">
          <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#CF0458] shrink-0" />
            <span>
              Morning Closing Stock automatically becomes Night Opening Stock.
            </span>
          </div>

          {onOpenReconcile && report?.status !== "RECONCILED" && (
            <button
              type="button"
              onClick={onOpenReconcile}
              className="px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify & Reconcile Counts</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. SUMMARY METRICS HUD RIBBON (ACCURATE ITEM COUNTS)         */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 print:hidden">
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Items Tracked
          </span>
          <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
            {filteredRows.length}
          </span>
          <span className="text-[10px] text-slate-400">Active catalog materials</span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider block">
            + Inbound Intakes
          </span>
          <span className="text-base sm:text-lg font-extrabold text-[#059669] font-mono mt-0.5 block">
            +{itemsWithNewStock}
          </span>
          <span className="text-[10px] text-[#059669]/70">Materials received</span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-[#CF0458] uppercase tracking-wider block">
            - Production Usage
          </span>
          <span className="text-base sm:text-lg font-extrabold text-[#CF0458] font-mono mt-0.5 block">
            -{itemsWithUsage}
          </span>
          <span className="text-[10px] text-[#CF0458]/70">Materials dished out</span>
        </div>

        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">
            - Damages / Scrap
          </span>
          <span className="text-base sm:text-lg font-extrabold text-amber-600 font-mono mt-0.5 block">
            -{itemsWithDamages}
          </span>
          <span className="text-[10px] text-amber-600/70">Defective / spoiled materials</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 text-white shadow-xs">
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
            Physical Audit
          </span>
          <span className="text-base sm:text-lg font-extrabold text-white font-mono mt-0.5 block">
            {discrepanciesCount === 0 ? "0 Variances" : `${discrepanciesCount} Discrepancies`}
          </span>
          <span className="text-[10px] text-slate-400">
            {report?.status === "RECONCILED" ? "Certified & locked" : "Shift audit pending"}
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. FILTER TABS & SEARCH BAR                                  */}
      {/* ============================================================ */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              categoryFilter === "ALL"
                ? "bg-[#CF0458] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Materials
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("PERISHABLE_MEASURED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              categoryFilter === "PERISHABLE_MEASURED"
                ? "bg-[#CF0458] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Perishables (Measured)
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("PERISHABLE_NUMBERED")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              categoryFilter === "PERISHABLE_NUMBERED"
                ? "bg-[#CF0458] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Perishables (Numbered)
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter("PACKAGING_NON_PERISHABLE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              categoryFilter === "PACKAGING_NON_PERISHABLE"
                ? "bg-[#CF0458] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Packaging & Consumables
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search material or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#CF0458]/20 focus:border-[#CF0458]"
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. THE 7-COLUMN SHEET TABLE (EXACT MIRROR OF FACTORY NOTEBOOK)*/}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs print:text-[10px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 font-extrabold text-slate-700 text-[11px] uppercase tracking-wider print:bg-slate-100 print:text-black print:border-slate-900">
                <th className="py-3 px-3.5 w-12 text-center print:w-8">#</th>
                <th className="py-3 px-3 min-w-[180px]">Item Name</th>
                <th className="py-3 px-3 text-right min-w-[100px] bg-slate-100/50">
                  Opening Stock
                </th>
                <th className="py-3 px-3 text-right min-w-[100px] text-[#059669]">
                  New Stock (+)
                </th>
                <th className="py-3 px-3 text-right min-w-[100px] font-black text-slate-900 bg-slate-100/50">
                  Total Stock
                </th>
                <th className="py-3 px-3 text-right min-w-[105px] text-[#CF0458]">
                  Usage (-)
                </th>
                <th className="py-3 px-3 text-right min-w-[95px] text-amber-700">
                  Damages (-)
                </th>
                <th className="py-3 px-3.5 text-right min-w-[110px] font-black text-slate-950 bg-slate-100/70">
                  Closing Stock
                </th>
                <th className="py-3 px-3 text-center min-w-[120px] print:hidden">
                  Audit & Physical
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 print:divide-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CF0458]" />
                    <p className="text-xs font-semibold">Computing shift stock ledger balances...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No Materials Found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try selecting another category or clearing your search term.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const hasDiscrepancy = row.variance !== undefined && row.variance !== 0;

                  return (
                    <tr
                      key={row.itemId || row.itemCode}
                      className="hover:bg-slate-50/70 transition-colors print:hover:bg-transparent"
                    >
                      {/* 1. Index */}
                      <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* 2. Item Name & Details */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 text-xs">
                            {row.itemName}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-400">
                              {row.itemCode}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {row.uom}
                            </span>
                            {row.isVariablePack && (
                              <span className="text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                                Variable
                                {row.inUseQuantity && row.inUseQuantity > 0 ? " (1 in use)" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Opening Stock */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 bg-slate-50/30">
                        <span>{formatQty(row.openingStock)}</span>
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">{row.uom}</span>
                      </td>

                      {/* 4. New Stock (+) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {row.newStock > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded font-bold">
                            +{formatQty(row.newStock)}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* 5. Total Stock */}
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 bg-slate-50/50">
                        <span>{formatQty(row.totalStock)}</span>
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">{row.uom}</span>
                      </td>

                      {/* 6. Usage (-) */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {row.usage > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-0.5 text-[#CF0458] bg-[#CF0458]/10 px-1.5 py-0.5 rounded font-bold">
                              -{formatQty(row.usage)} {row.uom}
                            </span>
                            {row.usageSecondary && (
                              <span className="text-[10px] text-purple-700 font-semibold mt-0.5">
                                ({row.usageSecondary})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* 7. Damages (-) */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {row.damages > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                            -{formatQty(row.damages)} {row.uom}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* 8. Closing Stock */}
                      <td className="py-2.5 px-3.5 text-right font-mono font-black text-slate-950 bg-slate-100/60">
                        <span className="text-[13px]">{formatQty(row.closingStock)}</span>
                        <span className="ml-1 text-[10px] text-slate-500 font-bold">{row.uom}</span>
                      </td>

                      {/* 9. Audit & Physical Count Column */}
                      <td className="py-2.5 px-3 text-center print:hidden">
                        {row.physicalCount !== undefined ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 font-mono text-[11px] font-bold">
                              <span>{formatQty(row.physicalCount)}</span>
                              <span className="text-[9px] text-slate-400">{row.uom}</span>
                            </div>
                            {hasDiscrepancy ? (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200"
                                title={row.discrepancyNote || "Variance detected"}
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {row.variance! > 0 ? `+${row.variance}` : row.variance}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold text-[#059669] bg-[#ECFDF5]">
                                <Check className="w-2.5 h-2.5" />
                                Match
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">—</span>
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



      {/* ============================================================ */}
      {/* 8. MATERIAL REQUISITION MODAL (AUTHENTIC PAPER SLIP MIRROR)  */}
      {/* ============================================================ */}
      <MaterialRequisitionModal
        isOpen={isRequisitionModalOpen}
        onClose={() => setIsRequisitionModalOpen(false)}
        shiftType={selectedShift}
        date={selectedDate}
        preparedBy={report?.handoverOfficer || "Production Floor Supervisor"}
        issuedBy={report?.officerOnDuty || "Store Officer on Duty"}
        items={
          (report?.rows || []).some((r) => r.usage > 0)
            ? (report?.rows || [])
                .filter((r) => r.usage > 0)
                .map((r) => ({
                  itemName: r.itemName,
                  itemCode: r.itemCode,
                  quantity: r.usage,
                  unit: r.uom,
                  notes: r.usageSecondary,
                }))
            : (report?.rows || []).map((r) => ({
                itemName: r.itemName,
                itemCode: r.itemCode,
                quantity: 0,
                unit: r.uom,
              }))
        }
      />
    </div>
  );
}
