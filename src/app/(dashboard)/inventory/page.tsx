"use client";

import React from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Package,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Hash,
  Box,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

export default function InventoryDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#D81B60] via-[#C2185B] to-[#AD1457] text-white p-6 sm:p-8 shadow-lg shadow-[#D81B60]/20 relative overflow-hidden">
        {/* Subtle decorative curve */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-[#84BD00]/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-white/20 text-white backdrop-blur">
                Store Operations Module
              </span>
              <span className="text-xs text-white/80 font-medium">Lagos Central Facility</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Inventory & Warehouse Store
            </h1>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Manage ad-hoc raw material inbounds, batch dispensing for morning and night shifts, fault replacements, and shift reconciliations.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Active Shift Staff</span>
              <span className="text-sm font-bold text-white">{user?.fullName}</span>
              <span className="text-xs text-[#84BD00] block font-mono font-bold">{user?.staffId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Material Classification Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Perishable Measured */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/50">
              <Scale className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Decimal Precision
            </span>
          </div>
          <h2 className="text-base font-bold text-[#2B1B24]">Measured Perishables</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Bought in bulk sacks/packs, dispensed in exact weights or volume measurements.
          </p>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span>Whole Cow Milk</span>
              <span className="font-mono font-bold text-[#D81B60]">450.500 kg</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Granulated Sugar</span>
              <span className="font-mono font-bold text-[#D81B60]">120.000 kg</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Rolled Oats & Granola</span>
              <span className="font-mono font-bold text-[#D81B60]">88.250 kg</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Raisins & Natural Sweeteners</span>
              <span className="font-mono font-bold text-[#D81B60]">32.000 cups</span>
            </div>
          </div>
        </div>

        {/* Card 2: Perishable Numbered */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/50">
              <Hash className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
              Discrete Counts
            </span>
          </div>
          <h2 className="text-base font-bold text-[#2B1B24]">Numbered Perishables</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Bought in crates/packs, issued to production in exact piece counts.
          </p>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span>Fresh Green Apples</span>
              <span className="font-mono font-bold text-[#008153]">1,420 pcs</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Seedless Purple Grapes</span>
              <span className="font-mono font-bold text-[#008153]">3,200 pcs</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Fresh Whole Coconuts</span>
              <span className="font-mono font-bold text-[#008153]">385 nuts</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Roasted Cashew Nuts</span>
              <span className="font-mono font-bold text-[#008153]">650 packs</span>
            </div>
          </div>
        </div>

        {/* Card 3: Packaging & Non-Perishables */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/50">
              <Box className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
              Packaging Inventory
            </span>
          </div>
          <h2 className="text-base font-bold text-[#2B1B24]">Packaging Materials</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Containers, foil, tamper seals, and barcode labels for finished parfaits and yogurts.
          </p>
          <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex justify-between items-center text-slate-700">
              <span>Parfait Cups & Dome Lids</span>
              <span className="font-mono font-bold text-purple-700">4,800 sets</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Greek Yogurt Containers</span>
              <span className="font-mono font-bold text-purple-700">2,100 sets</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Aluminium Foil Rolls</span>
              <span className="font-mono font-bold text-purple-700">24 rolls</span>
            </div>
            <div className="flex justify-between items-center text-slate-700">
              <span>Tamper-Proof Shrink Seals</span>
              <span className="font-mono font-bold text-purple-700">9,500 units</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Workflows Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Quick Actions */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#2B1B24] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D81B60]" />
            <span>Store Operations Actions (Phase 2 Preview)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-[#D81B60] transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#D81B60] mb-1">
                  <ArrowDownLeft className="w-4 h-4" />
                  <span>Ad-hoc Intake</span>
                </div>
                <div className="text-sm font-bold text-slate-800">Raw Material Inbound</div>
                <p className="text-xs text-slate-500 mt-1">
                  Receive unscheduled supplier delivery, log GRN, batch lot number & R2 waybill.
                </p>
              </div>
              <span className="mt-4 text-[11px] font-bold text-[#D81B60] flex items-center gap-1">
                Phase 2 Store Module →
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-[#008153] transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-[#008153] mb-1">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Shift Batch</span>
                </div>
                <div className="text-sm font-bold text-slate-800">Dispense to Production</div>
                <p className="text-xs text-slate-500 mt-1">
                  Weigh & count ingredients for Morning/Night batch run with recipe BOM guidance.
                </p>
              </div>
              <span className="mt-4 text-[11px] font-bold text-[#008153] flex items-center gap-1">
                Phase 2 Store Module →
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-red-500 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-red-600 mb-1">
                  <RotateCcw className="w-4 h-4" />
                  <span>Fault Replacement</span>
                </div>
                <div className="text-sm font-bold text-slate-800">Defective Returns</div>
                <p className="text-xs text-slate-500 mt-1">
                  Accept defective packaging or spoiled items, log write-off scrap & issue replacements.
                </p>
              </div>
              <span className="mt-4 text-[11px] font-bold text-red-600 flex items-center gap-1">
                Phase 2 Store Module →
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 hover:border-amber-500 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Shift Close</span>
                </div>
                <div className="text-sm font-bold text-slate-800">Stock Count & Handover</div>
                <p className="text-xs text-slate-500 mt-1">
                  Physical stock check vs expected balance, variance audit & digital handover sign-off.
                </p>
              </div>
              <span className="mt-4 text-[11px] font-bold text-amber-600 flex items-center gap-1">
                Phase 2 Store Module →
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Shift Status & Audit Overview */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#2B1B24] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#008153]" />
              <span>Shift Handover Protocol Status</span>
            </h2>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Shift Open
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Current Shift:</span>
              <span className="font-bold text-[#2B1B24]">Morning Shift (06:00 - 14:30)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Logged Operator:</span>
              <span className="font-bold text-[#D81B60]">{user?.fullName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Scheduled Production Batches:</span>
              <span className="font-bold text-slate-800">300x Moh Parfait, 150x Greek Yogurt</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Shift Handover Audit Lock:</span>
              <span className="font-bold text-[#008153]">Awaiting Shift Completion</span>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold text-slate-700">
              <span>Daily Target Progress</span>
              <span>65% Completed</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#D81B60] to-[#008153] rounded-full w-[65%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
