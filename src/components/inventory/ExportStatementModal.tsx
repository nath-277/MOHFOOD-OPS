"use client";

import React, { useState } from "react";
import {
  X,
  Download,
  Calendar,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Layers,
  BarChart3,
  Sparkles,
} from "lucide-react";

interface ExportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultShift?: "ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT";
  defaultFormat?: "STRUCTURED_REPORT" | "RAW_LEDGER";
}

export function ExportStatementModal({
  isOpen,
  onClose,
  defaultStartDate,
  defaultEndDate,
  defaultShift = "ALL",
  defaultFormat = "STRUCTURED_REPORT",
}: ExportStatementModalProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(defaultStartDate || firstOfMonthStr);
  const [endDate, setEndDate] = useState(defaultEndDate || todayStr);
  const [shiftType, setShiftType] = useState<"ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT">(defaultShift);
  const [reportFormat, setReportFormat] = useState<"STRUCTURED_REPORT" | "RAW_LEDGER">(defaultFormat);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset Date Ranges
  const handleSetPreset = (preset: "TODAY" | "7_DAYS" | "THIS_MONTH" | "30_DAYS") => {
    setError(null);
    const today = new Date();
    const todayFormatted = today.toISOString().split("T")[0];

    if (preset === "TODAY") {
      setStartDate(todayFormatted);
      setEndDate(todayFormatted);
    } else if (preset === "7_DAYS") {
      const past7 = new Date();
      past7.setDate(today.getDate() - 6);
      setStartDate(past7.toISOString().split("T")[0]);
      setEndDate(todayFormatted);
    } else if (preset === "THIS_MONTH") {
      setStartDate(firstOfMonthStr);
      setEndDate(todayFormatted);
    } else if (preset === "30_DAYS") {
      const past30 = new Date();
      past30.setDate(today.getDate() - 29);
      setStartDate(past30.toISOString().split("T")[0]);
      setEndDate(todayFormatted);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Please select both a start date and an end date.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    try {
      setExporting(true);
      setError(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
        shiftType,
        reportFormat,
      });

      const res = await fetch(`/api/inventory/statement-export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate statement export.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const prefix = reportFormat === "STRUCTURED_REPORT" ? "Moh_Executive_Stock_Report" : "Moh_Movement_Audit_Log";
      a.download = `${prefix}_${startDate}_to_${endDate}_${shiftType}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err: any) {
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-350 ease-out">
        <div className="sm:hidden w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 shrink-0" />
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Export Movement & Audit Report
              </h3>
              <p className="text-xs text-slate-500">
                Generate an executive structured analysis report or raw tabular audit ledger.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExport} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Report Layout / Type Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5 text-[#CF0458]" />
              <span>Report Layout & Structure</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportFormat("STRUCTURED_REPORT")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportFormat === "STRUCTURED_REPORT"
                    ? "border-[#CF0458] bg-[#CF0458]/5 ring-1 ring-[#CF0458]/20"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-slate-900">
                    <Sparkles className="w-3.5 h-3.5 text-[#CF0458]" />
                    Executive Report
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#CF0458]/10 text-[#CF0458]">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  6 sections with KPI scorecard, batch yields, daily velocity, material balances & audit flags.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setReportFormat("RAW_LEDGER")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  reportFormat === "RAW_LEDGER"
                    ? "border-[#CF0458] bg-[#CF0458]/5 ring-1 ring-[#CF0458]/20"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-slate-900">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                    Continuous Ledger
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                    19 Columns
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Single flat table optimized for Excel auto-filters, pivot tables & external spreadsheet imports.
                </p>
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Quick Date Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSetPreset("TODAY")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-center cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset("7_DAYS")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-center cursor-pointer"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset("THIS_MONTH")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-center cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset("30_DAYS")}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-center cursor-pointer"
              >
                Last 30 Days
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#CF0458]" />
                <span>Start Date (From)</span>
              </label>
              <input
                type="date"
                value={startDate}
                max={todayStr}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#CF0458] shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#CF0458]" />
                <span>End Date (To)</span>
              </label>
              <input
                type="date"
                value={endDate}
                max={todayStr}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#CF0458] shadow-2xs"
              />
            </div>
          </div>

          {/* Shift Filter Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#CF0458]" />
              <span>Shift Scope</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShiftType("ALL")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center ${
                  shiftType === "ALL"
                    ? "border-[#CF0458] bg-[#CF0458]/5 text-[#CF0458]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Shifts</span>
                <span className="text-[9px] font-normal opacity-70">24-hour day</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("MORNING_SHIFT")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center ${
                  shiftType === "MORNING_SHIFT"
                    ? "border-amber-500 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Morning</span>
                <span className="text-[9px] font-normal opacity-70">08:00 – 18:00</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("NIGHT_SHIFT")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center gap-0.5 text-center ${
                  shiftType === "NIGHT_SHIFT"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Night</span>
                <span className="text-[9px] font-normal opacity-70">18:00 – 08:00</span>
              </button>
            </div>
          </div>

          {/* Export Content Details Box */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>
                {reportFormat === "STRUCTURED_REPORT"
                  ? "Executive Structured Report Highlights:"
                  : "Continuous Ledger Format Highlights:"}
              </span>
            </div>
            {reportFormat === "STRUCTURED_REPORT" ? (
              <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-600">
                <li>
                  <span className="font-semibold text-slate-800">Executive KPI Scorecard:</span> Pre-calculated totals, handover sign-off rates, recipe override rates, and financial valuations.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Batch Yields & Velocity:</span> Finished goods output breakdown by product line, average units per batch run, and daily replenishment rhythms.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Material Balance & Exceptions:</span> Net material change, deficit indicators, scrap disposals, negative counts, and unconfirmed handover audit flags.
                </li>
              </ul>
            ) : (
              <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-slate-600">
                <li>
                  <span className="font-semibold text-slate-800">Clean Tabular Format:</span> Single continuous table with 19 standardized columns. Fully compatible with Excel & Google Sheets auto-filters, sorting, and pivot tables.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Comprehensive Movement Tracking:</span> Item SKUs, category, movement type, in/out direction, verified quantities, UoM, secondary portions, unit costs, and valuation.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Handover Statuses:</span> Preserves 2-hour grace period handover statuses (Handed Over vs. Pending Handover vs. Cancelled) for compliance audit.
                </li>
              </ul>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={exporting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] active:scale-95 transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px]"
            >
              <Download className="w-4 h-4" />
              <span>
                {exporting
                  ? "Generating Report..."
                  : reportFormat === "STRUCTURED_REPORT"
                  ? "Download Executive Report CSV"
                  : "Download Continuous Ledger CSV"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
