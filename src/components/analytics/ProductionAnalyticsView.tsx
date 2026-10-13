"use client";

import React from "react";
import { ProductionAnalyticsData } from "@/types/analytics";
import { KpiCard } from "./charts/KpiCard";
import { KpiDial } from "./charts/KpiDial";
import { YieldBarChart, ShiftThroughputBarChart } from "./charts/YieldBarChart";
import {
  Factory,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  TrendingUp,
  Activity,
  Award,
} from "lucide-react";

interface ProductionAnalyticsViewProps {
  data?: ProductionAnalyticsData;
  isLoading?: boolean;
}

export function ProductionAnalyticsView({ data, isLoading }: ProductionAnalyticsViewProps) {
  if (isLoading && !data) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Activity className="w-8 h-8 text-[#CF0458] animate-spin" />
        <span className="text-xs font-semibold">Loading Production Analytics...</span>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, productYields, shiftThroughput, supervisorLeads, recipeVariances } = data;

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Packaged Consumer Units"
          value={kpis.totalConsumerUnits}
          subtitle="Total finished parfait & yoghurt output"
          icon={Factory}
          iconBg="bg-rose-50 text-[#CF0458]"
        />
        <KpiCard
          title="Daily Target Capacity"
          value={`${kpis.dailyTargetCapacity} units/day`}
          subtitle={`Plant capacity attainment: ${kpis.targetAttainmentPct}%`}
          badge={{
            text: kpis.targetAttainmentPct >= 100 ? "GOAL REACHED" : `${kpis.targetAttainmentPct}%`,
            variant: kpis.targetAttainmentPct >= 100 ? "success" : "warning",
          }}
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          title="Shift Output Split"
          value={`${kpis.morningShiftUnits} / ${kpis.nightShiftUnits}`}
          subtitle="Morning shift vs Night shift finished units"
          icon={TrendingUp}
          iconBg="bg-indigo-50 text-indigo-600"
        />
        <KpiCard
          title="BOM Override Rate"
          value={`${kpis.bomOverrideRatePct}%`}
          subtitle="Floor ingredient recipe modifications"
          badge={{
            text: kpis.bomOverrideRatePct > 20 ? "HIGH VARIANCE" : "STABLE",
            variant: kpis.bomOverrideRatePct > 20 ? "danger" : "neutral",
          }}
          icon={AlertCircle}
          iconBg="bg-amber-50 text-amber-600"
        />
      </div>

      {/* 2. Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Finished Goods Output by Product Line (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Finished Goods Yield by Recipe</h4>
              <p className="text-xs text-slate-400">Total units packaged and batch runs per product line</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
              Output Yield
            </span>
          </div>
          <YieldBarChart data={productYields} />
        </div>

        {/* Capacity Attainment Dial (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between items-center text-center">
          <div className="w-full text-left mb-2">
            <h4 className="text-sm font-bold text-slate-900">Capacity Attainment</h4>
            <p className="text-xs text-slate-400">Target capacity benchmark</p>
          </div>
          <div className="my-auto py-2">
            <KpiDial
              value={kpis.targetAttainmentPct}
              size={130}
              strokeWidth={10}
              subLabel="CAPACITY"
              color={kpis.targetAttainmentPct >= 100 ? "#059669" : "#CF0458"}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Output of {kpis.totalConsumerUnits} units against benchmark of {kpis.dailyTargetCapacity} units/day.
          </p>
        </div>
      </div>

      {/* 3. Shift Rhythm & Supervisor Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Shift Throughput Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <h4 className="text-sm font-bold text-slate-900 mb-1">Shift Throughput Comparison</h4>
          <p className="text-xs text-slate-400 mb-3">Daily units produced: Day Shift vs Night Shift</p>
          <ShiftThroughputBarChart data={shiftThroughput} />
        </div>

        {/* Supervisor Leaderboard & BOM Variances */}
        <div className="space-y-4">
          {/* Supervisor Attribution */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Shift Supervisor Yield Leaderboard</span>
              </h4>
            </div>

            <div className="space-y-2">
              {supervisorLeads.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No supervisor batch leads logged.</div>
              ) : (
                supervisorLeads.map((s, i) => (
                  <div
                    key={s.name}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900">{s.name}</span>
                      <span className="block text-[11px] text-slate-500">{s.batches} batches managed</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-[#CF0458]">{s.totalUnits} units</span>
                      <span className="block text-[10px] text-slate-400">{s.avgUnitsPerBatch} units/batch</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recipe Variances */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900">Floor Recipe Deviations</h4>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                {recipeVariances.length} Logged
              </span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {recipeVariances.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  All recipe batches strictly adhered to standard master BOM.
                </div>
              ) : (
                recipeVariances.map((v, i) => (
                  <div key={`${v.referenceId}-${i}`} className="p-2 rounded-lg bg-slate-50 text-[11px] border border-slate-100">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{v.referenceId}</span>
                      <span className="text-[10px] text-slate-400">{v.date} • {v.shift}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5 truncate">{v.notes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
