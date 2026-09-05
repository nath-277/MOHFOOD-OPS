"use client";

import React from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Layers,
  FileSpreadsheet,
  AlertCircle,
  TrendingUp,
  Store,
  DollarSign,
  PhoneCall,
  CheckCircle2,
  Clock,
  Building,
} from "lucide-react";

export default function ManagementDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#008153] via-[#006837] to-[#1B5E20] text-white p-6 sm:p-8 shadow-lg shadow-[#008153]/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#84BD00]/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-white/20 text-white backdrop-blur">
                Executive Management Hub
              </span>
              <span className="text-xs text-white/80 font-medium">Lagos & Ogun Operations Oversight</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Executive Command Center
            </h1>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Real-time supermarket Sale or Return (SoR) reconciliations, WhatsApp invoice verification, procurement par levels, and plant output tracking.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Authorized Executive</span>
              <span className="text-sm font-bold text-white">{user?.fullName}</span>
              <span className="text-xs text-[#84BD00] block font-mono font-bold">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Supermarket Consignment Debt</span>
            <DollarSign className="w-4 h-4 text-[#D81B60]" />
          </div>
          <div className="text-2xl font-black text-[#2B1B24]">₦ 3,845,000</div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 mt-2">
            <Clock className="w-3.5 h-3.5" />
            <span>14 retail stockist accounts pending settlement</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Raw Material Valuation</span>
            <TrendingUp className="w-4 h-4 text-[#008153]" />
          </div>
          <div className="text-2xl font-black text-[#2B1B24]">₦ 8,620,400</div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#008153] mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Sufficient stock for 5 days of production</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">WhatsApp Invoices Queue</span>
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-[#2B1B24]">6 Unreconciled</div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600 mt-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Waybills uploaded from delivery group</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Daily Parfait Output</span>
            <Store className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-[#2B1B24]">850 Units</div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 mt-2">
            <span>85% of plant daily capacity (1,000 max)</span>
          </div>
        </div>
      </div>

      {/* Supermarket Sale or Return (SoR) Consignment Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#2B1B24] flex items-center gap-2">
              <Store className="w-5 h-5 text-[#008153]" />
              <span>Supermarket Consignment Ledger (Sale or Return - SoR)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Net Sold = Delivered - Returned Expired Parfaits • Tracks debt collection across Lagos & Ogun stockists
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#008153] bg-[#E8F5E9] px-3 py-1 rounded-full border border-[#008153]/20 self-start sm:self-auto">
            Active SoR Model
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Retail Stockist</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-right">Delivered</th>
                <th className="py-3 px-4 text-right">Expired Returns</th>
                <th className="py-3 px-4 text-right font-bold text-[#008153]">Net Sold</th>
                <th className="py-3 px-4 text-right font-bold text-[#D81B60]">Outstanding Debt</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-bold text-[#2B1B24]">Hubmart Supermarket</td>
                <td className="py-3 px-4 text-slate-500">Ikeja GRA, Lagos</td>
                <td className="py-3 px-4 text-right font-mono">150 cups</td>
                <td className="py-3 px-4 text-right font-mono text-red-600">8 cups</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#008153]">142 cups</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#D81B60]">₦ 284,000</td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Payment Pending
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-bold text-[#2B1B24]">Prince Ebeano Supermarket</td>
                <td className="py-3 px-4 text-slate-500">Lekki Phase 1, Lagos</td>
                <td className="py-3 px-4 text-right font-mono">200 cups</td>
                <td className="py-3 px-4 text-right font-mono text-red-600">12 cups</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#008153]">188 cups</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#D81B60]">₦ 376,000</td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Payment Pending
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/80">
                <td className="py-3 px-4 font-bold text-[#2B1B24]">Justrite Superstore</td>
                <td className="py-3 px-4 text-slate-500">Abeokuta, Ogun State</td>
                <td className="py-3 px-4 text-right font-mono">120 cups</td>
                <td className="py-3 px-4 text-right font-mono text-red-600">4 cups</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#008153]">116 cups</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-[#008153]">₦ 0 (Paid)</td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Reconciled & Paid
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp Invoices Reconciliation Hub (Preview) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#2B1B24] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
            <span>WhatsApp Waybills & Invoices Ingestion Center (Phase 3 Preview)</span>
          </h2>
          <span className="text-xs text-purple-700 font-bold bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
            Cloudflare R2 Storage Ready
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Upload delivery waybills, supplier receipts, and bank transfer proofs posted into the operations WhatsApp group for instant reconciliation.
        </p>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-purple-400 transition-colors bg-slate-50/50">
          <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-2">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="text-xs font-bold text-slate-700">Drop WhatsApp Waybill or Invoice Snapshot Here</div>
          <div className="text-[11px] text-slate-400 mt-1">Supports PNG, JPG, PDF up to 10MB • Auto-syncs to Cloudflare R2</div>
        </div>
      </div>
    </div>
  );
}
