"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { InventoryItem, ProductRecipe, StockTransaction } from "@/server/inventory/store";
import { InboundIntakeModal } from "@/components/inventory/InboundIntakeModal";
import { BatchDispenseModal } from "@/components/inventory/BatchDispenseModal";
import { ReturnsModal } from "@/components/inventory/ReturnsModal";
import { ShiftReconcileModal } from "@/components/inventory/ShiftReconcileModal";
import {
  Package,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Hash,
  Box,
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  History,
  Layers,
  Sparkles,
} from "lucide-react";

export default function InventoryDashboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeShift, setActiveShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");

  // Modal States
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, recipesRes, txnsRes] = await Promise.all([
        fetch(`/api/inventory/items?category=${categoryFilter}&search=${encodeURIComponent(searchQuery)}`),
        fetch("/api/inventory/recipes"),
        fetch("/api/inventory/transactions?limit=15"),
      ]);

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items || []);
      }
      if (recipesRes.ok) {
        const d = await recipesRes.json();
        setRecipes(d.recipes || []);
      }
      if (txnsRes.ok) {
        const d = await txnsRes.json();
        setTransactions(d.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate stats
  const totalStockItems = items.length;
  const lowStockCount = items.filter((i) => i.currentStock <= i.minStockThreshold).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#008153] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-slideIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Store Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#D81B60] via-[#C2185B] to-[#AD1457] text-white p-6 sm:p-8 shadow-lg shadow-[#D81B60]/20 relative overflow-hidden">
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
              Manage ad-hoc raw material inbounds, recipe batch dispensing for morning and night shifts, fault replacements, and closing reconciliations.
            </p>
          </div>

          {/* Quick Shift Selector & Officer Info */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-2.5 border border-white/20 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveShift("MORNING_SHIFT")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeShift === "MORNING_SHIFT"
                    ? "bg-[#84BD00] text-white shadow-sm"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                Morning Shift
              </button>
              <button
                type="button"
                onClick={() => setActiveShift("NIGHT_SHIFT")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeShift === "NIGHT_SHIFT"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                Night Shift
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-2.5 px-3.5 border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Logged Staff</span>
              <span className="text-xs font-bold text-white">{user?.fullName}</span>
              <span className="text-[10px] text-[#84BD00] block font-mono font-bold">{user?.staffId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Action Buttons Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setIsIntakeOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-[#D81B60] hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#FCE4EC] text-[#D81B60] group-hover:bg-[#D81B60] group-hover:text-white transition-colors flex items-center justify-center mb-2">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#D81B60]">Ad-Hoc Inbound</div>
            <div className="text-sm font-extrabold text-[#2B1B24]">Receive Raw Material</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsDispenseOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-[#008153] hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#E8F5E9] text-[#008153] group-hover:bg-[#008153] group-hover:text-white transition-colors flex items-center justify-center mb-2">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#008153]">Production Run</div>
            <div className="text-sm font-extrabold text-[#2B1B24]">Dispense Recipe Batch</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsReturnsOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-red-500 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors flex items-center justify-center mb-2">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-red-600">Factory Returns</div>
            <div className="text-sm font-extrabold text-[#2B1B24]">Faults & Excess Restock</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIsReconcileOpen(true)}
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-amber-500 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors flex items-center justify-center mb-2">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600">Shift Closing</div>
            <div className="text-sm font-extrabold text-[#2B1B24]">Stock Count & Handover</div>
          </div>
        </button>
      </div>

      {/* Main Content Layout: Live Catalog (Left) + Transaction Audit Feed (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Item Catalog Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: "ALL", label: "All Items", icon: Layers },
                  { id: "PERISHABLE_MEASURED", label: "Measured", icon: Scale },
                  { id: "PERISHABLE_NUMBERED", label: "Numbered", icon: Hash },
                  { id: "PACKAGING_NON_PERISHABLE", label: "Packaging", icon: Box },
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        categoryFilter === cat.id
                          ? "bg-[#D81B60] text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search materials or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D81B60] bg-slate-50"
                />
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Material Item</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3 text-right">Available Stock</th>
                    <th className="py-2.5 px-3">Location</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Loading inventory catalog...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No materials found matching your search.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isLowStock = item.currentStock <= item.minStockThreshold;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#2B1B24]">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.code}</div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {item.category === "PERISHABLE_MEASURED"
                                ? "Measured (Decimal)"
                                : item.category === "PERISHABLE_NUMBERED"
                                ? "Numbered (Pieces)"
                                : "Packaging"}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-sm text-[#2B1B24]">
                            {item.currentStock.toFixed(item.category === "PERISHABLE_MEASURED" ? 3 : 0)}{" "}
                            <span className="text-xs font-medium text-slate-500">{item.uom}</span>
                          </td>

                          <td className="py-3 px-3 text-slate-500 text-[11px]">{item.storageLocation}</td>

                          <td className="py-3 px-3 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Reorder</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Optimal</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Stock Transactions Audit Feed */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-extrabold text-[#2B1B24] flex items-center gap-1.5 uppercase tracking-wider">
                <History className="w-4 h-4 text-[#D81B60]" />
                <span>Shift Movement Ledger</span>
              </h2>
              <button
                type="button"
                onClick={loadData}
                title="Refresh feed"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {transactions.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No shift transactions logged yet.</div>
              ) : (
                transactions.map((txn) => {
                  const isPositive = txn.quantity > 0;
                  const isFault = txn.transactionType === "RETURN_FAULT_REPLACE";

                  return (
                    <div
                      key={txn.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs space-y-1 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#2B1B24] truncate max-w-[140px]">{txn.itemName}</span>
                        <span
                          className={`font-mono font-bold ${
                            isFault
                              ? "text-red-600"
                              : isPositive
                              ? "text-[#008153]"
                              : "text-[#D81B60]"
                          }`}
                        >
                          {isPositive ? `+${txn.quantity}` : txn.quantity} {txn.unit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-semibold uppercase tracking-wider text-slate-600">
                          {txn.transactionType.replace("_", " ")}
                        </span>
                        <span>{txn.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"}</span>
                      </div>

                      {txn.notes && (
                        <p className="text-[11px] text-slate-600 bg-white/80 p-1.5 rounded-lg border border-slate-200/50 mt-1">
                          {txn.notes}
                        </p>
                      )}

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                        <span>By: {txn.performedByName}</span>
                        <span>{new Date(txn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <InboundIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Ad-hoc raw material inbound logged successfully.");
        }}
      />

      <BatchDispenseModal
        isOpen={isDispenseOpen}
        onClose={() => setIsDispenseOpen(false)}
        recipes={recipes}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Batch ingredients dispensed and deducted from inventory.");
        }}
      />

      <ReturnsModal
        isOpen={isReturnsOpen}
        onClose={() => setIsReturnsOpen(false)}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Return logged & processed successfully.");
        }}
      />

      <ShiftReconcileModal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Shift closing stock count reconciled and report locked.");
        }}
      />
    </div>
  );
}
