"use client";

import React from "react";
import { FinancialAnalyticsData } from "@/types/analytics";
import { KpiCard } from "./charts/KpiCard";
import { CategorySpendDonutChart } from "./charts/CategoryDonutChart";
import {
  Coins,
  TrendingDown,
  ShoppingBag,
  AlertCircle,
  Activity,
  Receipt,
  Store,
  Wallet,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface FinancialAnalyticsViewProps {
  data?: FinancialAnalyticsData;
  isLoading?: boolean;
}

export function FinancialAnalyticsView({ data, isLoading }: FinancialAnalyticsViewProps) {
  if (isLoading && !data) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-2 text-slate-400">
        <Activity className="w-8 h-8 text-[#CF0458] animate-spin" />
        <span className="text-xs font-semibold">Loading Financial Analytics...</span>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, valuationDrawCurve, categorySpendBreakdown, sorProgression, valuationBlindspots } = data;

  const fmt = (n: number) => `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* 1. Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Floor COGS Material Draw"
          value={fmt(kpis.totalDispenseValuationNgn)}
          subtitle="Valuation of stock dispensed into kitchen"
          icon={Coins}
          iconBg="bg-rose-50 text-[#CF0458]"
        />
        <KpiCard
          title="Inbound Restock Spend"
          value={fmt(kpis.totalRestockSpendNgn)}
          subtitle="New stock receipts logged via GRN"
          icon={ShoppingBag}
          iconBg="bg-blue-50 text-blue-600"
        />
        <KpiCard
          title="Scrap & Spoilage Financial Loss"
          value={fmt(kpis.totalScrapLossNgn)}
          subtitle="Direct capital loss from expired/damaged stock"
          badge={{
            text: kpis.totalScrapLossNgn > 0 ? "SCRAP LOSS" : "ZERO LOSS",
            variant: kpis.totalScrapLossNgn > 0 ? "danger" : "success",
          }}
          icon={TrendingDown}
          iconBg="bg-amber-50 text-amber-600"
        />
        <KpiCard
          title="Supermarket SoR Collections"
          value={fmt(kpis.totalSoRCollectedNgn)}
          subtitle={`Invoiced: ${fmt(kpis.totalSoRInvoicedNgn)}`}
          icon={Wallet}
          iconBg="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* 2. Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Material Valuation Draw Curve (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Daily Material Consumption Valuation (NGN)</h4>
              <p className="text-xs text-slate-400">Daily financial impact of floor dispatches</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
              COGS Trend
            </span>
          </div>

          <div className="w-full h-72">
            {valuationDrawCurve.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                No financial valuation recorded for this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valuationDrawCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#64748B" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(v: any) => [fmt(Number(v || 0)), "Dispense Valuation"]}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "0.75rem",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="valuationImpact"
                    name="Daily COGS Draw"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Spend Breakdown Donut (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Expenditure by Category</h4>
              <p className="text-xs text-slate-400">Packaging vs Raw Materials</p>
            </div>
            <Receipt className="w-4 h-4 text-purple-600" />
          </div>
          <CategorySpendDonutChart data={categorySpendBreakdown} />
        </div>
      </div>

      {/* 3. SoR Supermarket Balances & Valuation Blindspots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Supermarket SoR Progression */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>Supermarket SoR Consignments</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {sorProgression.length} Stockists
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Total invoiced value vs payments received from retail partners</p>

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold sticky top-0 bg-white">
                  <th className="pb-2">Stockist</th>
                  <th className="pb-2 text-right">Invoiced</th>
                  <th className="pb-2 text-right">Collected</th>
                  <th className="pb-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorProgression.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No active retail stockists configured.
                    </td>
                  </tr>
                ) : (
                  sorProgression.map((s) => (
                    <tr key={s.stockistName} className="hover:bg-slate-50/50">
                      <td className="py-2.5 font-bold text-slate-900">{s.stockistName}</td>
                      <td className="py-2.5 text-right font-medium text-slate-600">{fmt(s.invoicedAmount)}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-700">{fmt(s.paidAmount)}</td>
                      <td className="py-2.5 text-right font-bold text-rose-700">{fmt(s.outstandingBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Valuation Blindspots Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Valuation Blindspots (₦0.00 Unit Cost)</span>
            </h4>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {valuationBlindspots.length} Action Needed
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-3">Materials moving through floor without price/unit configured in master catalogue</p>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {valuationBlindspots.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                All traded inventory items have standard unit cost prices assigned.
              </div>
            ) : (
              valuationBlindspots.map((b) => (
                <div
                  key={b.sku}
                  className="p-2.5 rounded-xl border border-amber-200/60 bg-amber-50/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">{b.name}</span>
                    <span className="block text-[10px] text-slate-400 font-mono">{b.sku} • {b.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-amber-900">{b.movementCount} Movements</span>
                    <span className="block text-[10px] font-extrabold text-rose-600 uppercase">₦0.00 Logged</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
