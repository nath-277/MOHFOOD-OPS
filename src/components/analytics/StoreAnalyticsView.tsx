"use client";

import React from "react";
import { StoreAnalyticsData } from "@/types/analytics";
import { KpiCard } from "./charts/KpiCard";
import { VelocityAreaChart } from "./charts/VelocityAreaChart";
import { ScrapDonutChart } from "./charts/CategoryDonutChart";
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  TrendingDown,
  Activity,
  Layers,
} from "lucide-react";

interface StoreAnalyticsViewProps {
  data?: StoreAnalyticsData;
  isLoading?: boolean;
}

export function StoreAnalyticsView({ data, isLoading }: StoreAnalyticsViewProps) {
  if (isLoading && !data) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Activity className="w-8 h-8 text-[#CF0458] animate-spin" />
        <span className="text-xs font-semibold">Loading Store Analytics...</span>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, velocityCurve, topMovingMaterials, scrapCauses, stockoutHazards } = data;

  const netMovements = kpis.inboundCount - kpis.outboundCount;
  const scrapPercentage = kpis.totalMovements > 0 ? ((kpis.spoilageCount / kpis.totalMovements) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* 1. KPI Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total Movements"
          value={kpis.totalMovements}
          subtitle={`${kpis.inboundCount} Inbound • ${kpis.outboundCount} Dispatched`}
          icon={Boxes}
          iconBg="bg-blue-50 text-blue-600"
        />
        <KpiCard
          title="Net Stock Balance"
          value={netMovements >= 0 ? `+${netMovements}` : `${netMovements}`}
          subtitle={netMovements >= 0 ? "Inventory buffer expanded" : "Warehouse buffer drawn down"}
          badge={{
            text: netMovements >= 0 ? "SURPLUS" : "DRAWDOWN",
            variant: netMovements >= 0 ? "success" : "warning",
          }}
          icon={netMovements >= 0 ? ArrowDownLeft : ArrowUpRight}
          iconBg={netMovements >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}
        />
        <KpiCard
          title="Active SKUs Traded"
          value={kpis.activeSkusCount}
          subtitle="Distinct materials moved this period"
          icon={Layers}
          iconBg="bg-purple-50 text-purple-600"
        />
        <KpiCard
          title="Scrap & Spoilage Rate"
          value={`${scrapPercentage}%`}
          subtitle={`${kpis.spoilageCount} scrap / disposal events`}
          badge={{
            text: Number(scrapPercentage) > 2 ? "HIGH LOSS" : "NORMAL",
            variant: Number(scrapPercentage) > 2 ? "danger" : "neutral",
          }}
          icon={TrendingDown}
          iconBg="bg-amber-50 text-amber-600"
        />
      </div>

      {/* 2. Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Velocity Curve (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Intake vs Dispatch Movement Velocity</h4>
              <p className="text-xs text-slate-400">Daily warehouse replenishment (IN) vs factory floor consumption (OUT)</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
              Daily Rhythm
            </span>
          </div>
          <VelocityAreaChart data={velocityCurve} />
        </div>

        {/* Scrap Breakdown Donut (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Scrap & Defect Causes</h4>
              <p className="text-xs text-slate-400">Classified by recorded reason</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <ScrapDonutChart data={scrapCauses} />
        </div>
      </div>

      {/* 3. Operational Tables: Top Movers & Stockout Hazards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Movers */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <h4 className="text-sm font-bold text-slate-900 mb-1">Top Fast-Moving Materials</h4>
          <p className="text-xs text-slate-400 mb-3">Volume received vs volume dispensed</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  <th className="pb-2">Item Name</th>
                  <th className="pb-2 text-right">Inbound</th>
                  <th className="pb-2 text-right">Dispensed</th>
                  <th className="pb-2 text-right">Net Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topMovingMaterials.map((m) => {
                  const net = m.inbound - m.outbound;
                  return (
                    <tr key={m.sku} className="hover:bg-slate-50/50">
                      <td className="py-2.5">
                        <span className="font-bold text-slate-900">{m.name}</span>
                        <span className="block text-[10px] text-slate-400">{m.sku}</span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-700">
                        {m.inbound > 0 ? `+${m.inbound}` : "0"} {m.uom}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-rose-700">
                        {m.outbound > 0 ? `-${m.outbound}` : "0"} {m.uom}
                      </td>
                      <td className="py-2.5 text-right font-bold">
                        <span className={net >= 0 ? "text-emerald-700" : "text-rose-700"}>
                          {net > 0 ? `+${net}` : net} {m.uom}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stockout Hazards */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-slate-900">Buffer Runway & Deficit Warnings</h4>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {stockoutHazards.length} Flagged
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Items where stock buffer is depleted or at immediate risk</p>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {stockoutHazards.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No buffer deficits or stockout hazards detected in this period.
              </div>
            ) : (
              stockoutHazards.map((h, i) => (
                <div
                  key={`${h.sku}-${i}`}
                  className="p-2.5 rounded-xl border border-amber-200/60 bg-amber-50/40 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900">{h.name}</span>
                    <span className="block text-[10px] text-slate-500 font-mono">{h.sku}</span>
                    <p className="text-[11px] text-amber-900/80 mt-0.5">{h.note}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full shrink-0 ${
                      h.currentDrain === "CRITICAL DRAIN"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {h.currentDrain}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
