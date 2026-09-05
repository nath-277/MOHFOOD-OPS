"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
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
  ExternalLink,
  ShieldCheck,
  Building,
} from "lucide-react";

export default function ManagementDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"sor" | "invoices" | "par_levels">("sor");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const STOCKISTS = [
    {
      id: "stk_01",
      name: "Hubmart Supermarket",
      location: "Ikeja GRA, Lagos",
      delivered: 150,
      returns: 8,
      netSold: 142,
      debt: 284000,
      status: "PENDING_SETTLEMENT",
      lastDelivery: "Today, 08:30 AM",
    },
    {
      id: "stk_02",
      name: "Prince Ebeano Supermarket",
      location: "Lekki Phase 1, Lagos",
      delivered: 200,
      returns: 5,
      netSold: 195,
      debt: 390000,
      status: "PENDING_SETTLEMENT",
      lastDelivery: "Yesterday",
    },
    {
      id: "stk_03",
      name: "Justrite Superstore",
      location: "Magodo Shangisha, Lagos",
      delivered: 120,
      returns: 2,
      netSold: 118,
      debt: 236000,
      status: "VERIFIED_PAID",
      lastDelivery: "02 Sep 2026",
    },
    {
      id: "stk_04",
      name: "Supersaver Supermarket",
      location: "Ogudu GRA, Lagos",
      delivered: 100,
      returns: 12,
      netSold: 88,
      debt: 176000,
      status: "PENDING_SETTLEMENT",
      lastDelivery: "01 Sep 2026",
    },
    {
      id: "stk_05",
      name: "SPAR Nigeria",
      location: "Victoria Island, Lagos",
      delivered: 250,
      returns: 10,
      netSold: 240,
      debt: 480000,
      status: "PENDING_SETTLEMENT",
      lastDelivery: "Today, 07:15 AM",
    },
  ];

  const filteredStockists = STOCKISTS.filter(
    (s) =>
      searchQuery === "" ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#059669] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Executive Management
            </span>
            <span className="text-xs font-semibold text-slate-400">Retail Consignment & Cash Oversight</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Executive Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Supermarket Sale or Return (SoR) consignments, WhatsApp invoice verification, and plant oversight.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => showToast("Exporting SoR Reconciliation ledger to CSV...")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Export SoR CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <span>Verify WhatsApp Invoices</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Consignment Debt
            </div>
            <div className="text-2xl font-bold text-[#8E1538] mt-1 font-mono">
              ₦ 3,845,000
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              14 retail accounts pending
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#8E1538] flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Raw Stock Valuation
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
              ₦ 8,620,400
            </div>
            <div className="text-[11px] font-medium text-[#059669] mt-0.5">
              5 days production coverage
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              WhatsApp Queue
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              6 Pending
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Driver receipts to reconcile
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Daily Plant Output
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              850 Units
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              85% of daily plant target
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("sor")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "sor"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Supermarket SoR Consignments</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {STOCKISTS.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "invoices"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>WhatsApp Invoices & Waybills</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            6
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("par_levels")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "par_levels"
              ? "border-[#8E1538] text-[#8E1538]"
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
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stockist name or location..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
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

            <span className="text-xs text-slate-500">
              Net Sold = Delivered minus Expired Parfait Returns
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Retail Stockist</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-right">Delivered</th>
                    <th className="py-3 px-4 text-right">Expired Returns</th>
                    <th className="py-3 px-4 text-right">Net Sold</th>
                    <th className="py-3 px-4 text-right">Outstanding Debt</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredStockists.map((stk) => (
                    <tr key={stk.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {stk.name}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {stk.location}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono">
                        {stk.delivered} cups
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        {stk.returns} cups
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {stk.netSold} cups
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#8E1538]">
                        ₦ {stk.debt.toLocaleString()}
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
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredStockists.length} retail consignment accounts</span>
              <span>Sale or Return (SoR) Settlement Engine</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: WHATSAPP INVOICES */}
      {/* ============================================================ */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <h4 className="font-bold text-slate-900 mb-0.5">Centralized WhatsApp Reconciliation</h4>
            <p>
              Delivery drivers post photos of stamped supermarket delivery notes and payment teller receipts in the logistics WhatsApp group. Management reconciles them here.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: "WA-INV-1092",
                stockist: "Hubmart Ikeja",
                driver: "Sunday B. (Van 1)",
                amount: "₦ 284,000",
                cups: "142 cups",
                time: "Today, 10:15 AM",
                status: "UNVERIFIED",
              },
              {
                id: "WA-INV-1091",
                stockist: "Prince Ebeano Lekki",
                driver: "Sunday B. (Van 1)",
                amount: "₦ 390,000",
                cups: "195 cups",
                time: "Yesterday, 04:30 PM",
                status: "UNVERIFIED",
              },
            ].map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-slate-600">{inv.id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-[#D97706] bg-[#FFFBEB] border border-[#D97706]/20">
                      Pending Verification
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{inv.stockist}</h3>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <div>Delivered by: {inv.driver}</div>
                    <div>Recorded time: {inv.time}</div>
                    <div className="font-bold text-slate-900 font-mono mt-2">
                      Amount: {inv.amount} ({inv.cups})
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => showToast(`Invoice ${inv.id} verified and marked reconciled.`)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Mark Settled</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PLANT OPERATIONS & PAR LEVELS */}
      {/* ============================================================ */}
      {activeTab === "par_levels" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Material Par Levels & Production Safety Buffers
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Buffer calculations based on current plant production velocity of 850 parfaits/day.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-medium">Whole Milk Buffer</span>
                <div className="text-lg font-bold text-slate-900 font-mono mt-1">450.5 kg</div>
                <span className="text-[10px] text-[#059669] font-medium">3.5 days runway</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-medium">Crunchy Granola</span>
                <div className="text-lg font-bold text-slate-900 font-mono mt-1">85.0 kg</div>
                <span className="text-[10px] text-[#059669] font-medium">4.2 days runway</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 font-medium">400ml Parfait Cups</span>
                <div className="text-lg font-bold text-slate-900 font-mono mt-1">3,400 pcs</div>
                <span className="text-[10px] text-[#059669] font-medium">4.0 days runway</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
