"use client";

import React from "react";
import { ExecutiveAnalyticsData } from "@/types/analytics";
import { KpiCard } from "./charts/KpiCard";
import { KpiDial } from "./charts/KpiDial";
import {
  Activity,
  Award,
  Boxes,
  Factory,
  Coins,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

interface ExecutiveAnalyticsViewProps {
  data?: ExecutiveAnalyticsData;
  isLoading?: boolean;
}

export function ExecutiveAnalyticsView({ data, isLoading }: ExecutiveAnalyticsViewProps) {
  if (isLoading && !data) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Activity className="w-8 h-8 text-[#CF0458] animate-spin" />
        <span className="text-xs font-semibold">Synthesizing Executive Scorecard...</span>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, storeSummary, productionSummary, financialSummary } = data;

  const fmt = (n: number) => `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* 1. Hero Plant Efficiency & Primary Health Index */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Plant Efficiency Dial Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center justify-center relative overflow-hidden">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plant OEE Score</span>
          </div>

          <div className="my-2">
            <KpiDial
              value={kpis.plantEfficiencyScore}
              label={`${Math.round(kpis.plantEfficiencyScore)}%`}
              subLabel="Overall Efficiency"
              color={kpis.plantEfficiencyScore >= 85 ? "#059669" : kpis.plantEfficiencyScore >= 70 ? "#CF0458" : "#d97706"}
              size={180}
            />
          </div>

          <p className="text-xs text-slate-500 mt-2 max-w-xs">
            Synthesized metric combining production capacity attainment ({kpis.targetAttainmentPct}%), yield adherence, and minimal inventory scrap loss.
          </p>
        </div>

        {/* Executive Fast-Facts / Strategic Pulse */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KpiCard
            title="Total Finished Output"
            value={kpis.totalUnitsPackaged}
            subtitle={`Target Attainment: ${kpis.targetAttainmentPct}%`}
            badge={{
              text: kpis.targetAttainmentPct >= 100 ? "EXCEEDED TARGET" : "ONGOING PRODUCTION",
              variant: kpis.targetAttainmentPct >= 100 ? "success" : "neutral",
            }}
            icon={Factory}
            iconBg="bg-rose-50 text-[#CF0458]"
          />
          <KpiCard
            title="Total Operational Draw"
            value={fmt(kpis.totalOperationalCostNgn)}
            subtitle="Raw materials & packaging absorbed in production"
            icon={Coins}
            iconBg="bg-blue-50 text-blue-600"
          />
          <KpiCard
            title="Net Inventory Movement"
            value={kpis.netInventoryVolume >= 0 ? `+${kpis.netInventoryVolume} units` : `${kpis.netInventoryVolume} units`}
            subtitle={kpis.netInventoryVolume >= 0 ? "Store warehouse buffered" : "Warehouse buffer drawn down"}
            badge={{
              text: kpis.netInventoryVolume >= 0 ? "BUFFER GROWTH" : "CONSUMPTION",
              variant: kpis.netInventoryVolume >= 0 ? "success" : "warning",
            }}
            icon={Boxes}
            iconBg="bg-purple-50 text-purple-600"
          />
          <KpiCard
            title="Recipe Standard Adherence"
            value={`${(100 - kpis.bomOverrideRatePct).toFixed(1)}%`}
            subtitle={`${kpis.bomOverrideRatePct}% of batches had ingredient overrides`}
            badge={{
              text: kpis.bomOverrideRatePct <= 5 ? "STANDARDIZED" : "HIGH VARIANCE",
              variant: kpis.bomOverrideRatePct <= 5 ? "success" : "danger",
            }}
            icon={ShieldCheck}
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>

      {/* 2. Department Triad Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Store Department Snapshot */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Store & Inventory</h3>
                <p className="text-[11px] text-slate-500">Warehouse supply & buffer</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
              Operational
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Total Movements Logged</span>
              <span className="font-bold text-slate-800">{storeSummary.totalMovements}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Inbound Restocks</span>
              <span className="font-bold text-emerald-600">+{storeSummary.inboundCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Outbound Dispatches</span>
              <span className="font-bold text-blue-600">-{storeSummary.outboundCount}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Spoilage & Scrap Items</span>
              <span className={`font-bold ${storeSummary.spoilageCount > 0 ? "text-rose-600" : "text-slate-800"}`}>
                {storeSummary.spoilageCount}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Active Materials</span>
              <span className="font-bold text-slate-800">{storeSummary.activeSkusCount} SKUs</span>
            </div>
          </div>
        </div>

        {/* Production Department Snapshot */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#CF0458] flex items-center justify-center font-bold text-sm">
                <Factory className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Kitchen Production</h3>
                <p className="text-[11px] text-slate-500">Processing & batch yields</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
              Attainment {productionSummary.targetAttainmentPct}%
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Finished Consumer Units</span>
              <span className="font-bold text-slate-800">{productionSummary.totalConsumerUnits}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Daily Target Capacity</span>
              <span className="font-bold text-slate-800">{productionSummary.dailyTargetCapacity} units/day</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Morning Shift Output</span>
              <span className="font-bold text-amber-600">{productionSummary.morningShiftUnits} units</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Night Shift Output</span>
              <span className="font-bold text-indigo-600">{productionSummary.nightShiftUnits} units</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Recipe Override Frequency</span>
              <span className="font-bold text-slate-800">{productionSummary.bomOverrideRatePct}%</span>
            </div>
          </div>
        </div>

        {/* Financial Department Snapshot */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Financial Valuation</h3>
                <p className="text-[11px] text-slate-500">COGS, spend & supermarket SoR</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
              Financials
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Production Material Draw</span>
              <span className="font-bold text-slate-800">{fmt(financialSummary.totalDispenseValuationNgn)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Inbound Restock Spend</span>
              <span className="font-bold text-emerald-600">{fmt(financialSummary.totalRestockSpendNgn)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Waste & Scrap Cost</span>
              <span className="font-bold text-rose-600">{fmt(financialSummary.totalScrapLossNgn)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Supermarket SoR Invoiced</span>
              <span className="font-bold text-slate-800">{fmt(financialSummary.totalSoRInvoicedNgn)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">SoR Cash Collections</span>
              <span className="font-bold text-emerald-600">{fmt(financialSummary.totalSoRCollectedNgn)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
