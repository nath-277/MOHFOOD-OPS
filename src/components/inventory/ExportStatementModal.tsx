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
} from "lucide-react";

interface ExportStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultShift?: "ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT";
}

export function ExportStatementModal({
  isOpen,
  onClose,
  defaultStartDate,
  defaultEndDate,
  defaultShift = "ALL",
}: ExportStatementModalProps) {
  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(defaultStartDate || firstOfMonthStr);
  const [endDate, setEndDate] = useState(defaultEndDate || todayStr);
  const [shiftType, setShiftType] = useState<"ALL" | "MORNING_SHIFT" | "NIGHT_SHIFT">(defaultShift);
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
      a.download = `Moh_Stock_Statement_${startDate}_to_${endDate}_${shiftType}.csv`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Export Stock Period Statement
              </h3>
              <p className="text-xs text-slate-500">
                Generate full period ledger with opening, additions, usages, and movement log.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExport} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{error}</span>
            </div>
          )}

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
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              <span>What this CSV export includes:</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Consolidated Balance Summary:</span> Opening stock at period start, total inbound receipts, total floor usages, damages, reconcile adjustments, and ending period closing stock.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Complete Movement Audit Log:</span> Every individual intake, batch dispense, fault return, and disposal record between {startDate} and {endDate}.
              </li>
            </ul>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={exporting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? "Generating Statement..." : "Download Statement (.CSV)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
