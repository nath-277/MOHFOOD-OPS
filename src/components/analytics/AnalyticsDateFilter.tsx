"use client";

import React from "react";
import { Calendar, Clock, Sun, Moon, Layers, RotateCcw } from "lucide-react";
import { AnalyticsPeriod, ShiftFilter } from "@/types/analytics";
import { formatDate } from "@/lib/dateUtils";

interface AnalyticsDateFilterProps {
  period: AnalyticsPeriod;
  onChange: (period: AnalyticsPeriod) => void;
  isLoading?: boolean;
}

export function AnalyticsDateFilter({ period, onChange, isLoading }: AnalyticsDateFilterProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const handlePreset = (preset: "TODAY" | "7_DAYS" | "THIS_MONTH" | "30_DAYS") => {
    const today = new Date();
    const todayFormatted = today.toISOString().slice(0, 10);

    if (preset === "TODAY") {
      onChange({ ...period, startDate: todayFormatted, endDate: todayFormatted });
    } else if (preset === "7_DAYS") {
      const past7 = new Date();
      past7.setDate(today.getDate() - 6);
      onChange({ ...period, startDate: past7.toISOString().slice(0, 10), endDate: todayFormatted });
    } else if (preset === "THIS_MONTH") {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      onChange({ ...period, startDate: firstOfMonth, endDate: todayFormatted });
    } else if (preset === "30_DAYS") {
      const past30 = new Date();
      past30.setDate(today.getDate() - 29);
      onChange({ ...period, startDate: past30.toISOString().slice(0, 10), endDate: todayFormatted });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs space-y-3">
      {/* Top Filter Bar: Presets & Shift Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Presets */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Presets:
          </span>
          <button
            type="button"
            onClick={() => handlePreset("TODAY")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => handlePreset("7_DAYS")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => handlePreset("THIS_MONTH")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handlePreset("30_DAYS")}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            Last 30 Days
          </button>
        </div>

        {/* Shift Scope Segment */}
        <div className="flex items-center bg-slate-100/80 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => onChange({ ...period, shiftType: "ALL" })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period.shiftType === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>24h Day</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...period, shiftType: "MORNING_SHIFT" })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period.shiftType === "MORNING_SHIFT" ? "bg-amber-50 text-amber-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Morning</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...period, shiftType: "NIGHT_SHIFT" })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period.shiftType === "NIGHT_SHIFT" ? "bg-indigo-50 text-indigo-900 shadow-2xs" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Night</span>
          </button>
        </div>
      </div>

      {/* Date Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
          <Calendar className="w-3.5 h-3.5 text-[#CF0458] shrink-0" />
          <span className="font-bold text-slate-500 shrink-0">From:</span>
          <input
            type="date"
            lang="en-GB"
            value={period.startDate}
            max={todayStr}
            onChange={(e) => onChange({ ...period, startDate: e.target.value })}
            className="w-full bg-transparent text-slate-900 font-semibold focus:outline-hidden"
          />
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
          <Calendar className="w-3.5 h-3.5 text-[#CF0458] shrink-0" />
          <span className="font-bold text-slate-500 shrink-0">To:</span>
          <input
            type="date"
            lang="en-GB"
            value={period.endDate}
            max={todayStr}
            onChange={(e) => onChange({ ...period, endDate: e.target.value })}
            className="w-full bg-transparent text-slate-900 font-semibold focus:outline-hidden"
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between px-2">
          <span className="text-[11px] text-slate-400">
            Scope: {formatDate(period.startDate)} to {formatDate(period.endDate)} ({period.shiftType === "ALL" ? "All Shifts" : period.shiftType === "MORNING_SHIFT" ? "Morning Only" : "Night Only"})
          </span>
          {isLoading && (
            <span className="text-[11px] font-bold text-[#CF0458] animate-pulse">
              Refreshing metrics...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
