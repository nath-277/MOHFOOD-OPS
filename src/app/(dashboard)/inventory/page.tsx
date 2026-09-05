"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { InventoryItem, ProductRecipe, StockTransaction } from "@/server/inventory/store";
import { InboundIntakeModal } from "@/components/inventory/InboundIntakeModal";
import { BatchDispenseModal } from "@/components/inventory/BatchDispenseModal";
import { ReturnsModal } from "@/components/inventory/ReturnsModal";
import { ShiftReconcileModal } from "@/components/inventory/ShiftReconcileModal";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { RecipeBuilderModal } from "@/components/inventory/RecipeBuilderModal";
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
  RefreshCw,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  FileSpreadsheet,
  Pencil,
  Eye,
} from "lucide-react";
import { ExecutiveInventoryView } from "@/components/inventory/ExecutiveInventoryView";

export default function InventoryDashboardPage() {
  const { user } = useAuth();
  const role = user?.role || "STAFF";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isExecutive = role === "EXECUTIVE";

  const [viewMode, setViewMode] = useState<"EXECUTIVE" | "FLOOR">(
    isExecutive ? "EXECUTIVE" : "FLOOR"
  );

  useEffect(() => {
    if (isExecutive) {
      setViewMode("EXECUTIVE");
    }
  }, [isExecutive]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeShift, setActiveShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");

  // Tabs: "inventory" | "recipes" | "movements" | "reconciliation"
  const [activeTab, setActiveTab] = useState<"inventory" | "recipes" | "movements" | "reconciliation">("inventory");

  // Modal States
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isRecipeBuilderOpen, setIsRecipeBuilderOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ProductRecipe | null>(null);
  const [dispenseInitialRecipeCode, setDispenseInitialRecipeCode] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [itemsRes, recipesRes, txnsRes] = await Promise.all([
        fetch(`/api/inventory/items?category=${categoryFilter}&search=${encodeURIComponent(searchQuery)}`),
        fetch("/api/inventory/recipes"),
        fetch("/api/inventory/transactions?limit=25"),
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
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate stats
  const totalStockItems = items.length;
  const lowStockCount = items.filter((i) => i.currentStock <= i.minStockThreshold).length;

  // Executive Management view
  if (viewMode === "EXECUTIVE") {
    return (
      <ExecutiveInventoryView
        onSwitchToFloorView={() => setViewMode("FLOOR")}
        canSwitchView={isSuperAdmin}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#059669] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clean Uncluttered Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Warehouse
            </span>
            <span className="text-xs font-semibold text-slate-400">Inventory & Shift Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Store Room Operations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ad-hoc raw material inbounds, recipe batch dispensing, returns, and shift reconciliations.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setViewMode("EXECUTIVE")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer hover:bg-slate-800"
              title="Switch to executive inventory & audit view"
            >
              <Eye className="w-3.5 h-3.5 text-white/80" />
              <span>Executive Audit View</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsIntakeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Intake</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDispenseInitialRecipeCode(undefined);
              setIsDispenseOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
            <span>Dispense Batch</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReturnsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Returns</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReconcileOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Reconcile</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Catalog SKUs
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? "..." : totalStockItems}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Measured, numbered & packaging
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Low Stock Alerts
            </div>
            <div className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? "text-[#D97706]" : "text-slate-900"}`}>
              {loading ? "..." : lowStockCount}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {lowStockCount > 0 ? "Below minimum threshold" : "All items well stocked"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? "text-[#D97706]" : "text-slate-400"}`} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Shift
            </div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {activeShift === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              {activeShift === "MORNING_SHIFT" ? "08:00 - 18:00" : "18:00 - 08:00"}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Recent Movements
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? "..." : transactions.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Intakes & dispenses logged
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "inventory"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Stock Balances & Materials</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recipes")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "recipes"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Recipes & BOM Formulations</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {recipes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("movements")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "movements"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Movements & Audit Trail</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "reconciliation"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Shift Handover Lock</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: STOCK BALANCES */}
      {/* ============================================================ */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
              {[
                { id: "ALL", label: "All Materials" },
                { id: "PERISHABLE_MEASURED", label: "Measured (kg/L)" },
                { id: "PERISHABLE_NUMBERED", label: "Numbered (pcs)" },
                { id: "PACKAGING_NON_PERISHABLE", label: "Packaging" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    categoryFilter === c.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search Box & Add Material Button */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search materials or SKU code..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
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

              <button
                type="button"
                onClick={() => setIsAddItemOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Material</span>
              </button>
            </div>
          </div>

          {/* Clean Materials Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Material / Item</th>
                    <th className="py-3 px-4">SKU Code</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-right">Min Threshold</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8E1538]" />
                        <span>Loading materials balance...</span>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="text-xs font-semibold text-slate-600">No items found.</span>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const isLow = item.currentStock <= item.minStockThreshold;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{item.name}</div>
                                <div className="text-[10px] text-slate-400">{item.storageLocation || "Central Store"}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-slate-600">
                            {item.code}
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {item.category === "PERISHABLE_MEASURED"
                                ? "Measured"
                                : item.category === "PERISHABLE_NUMBERED"
                                ? "Numbered"
                                : "Packaging"}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {item.currentStock.toLocaleString(undefined, {
                              minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 2 : 0,
                            })}{" "}
                            <span className="text-slate-400 font-normal">{item.uom}</span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-slate-500">
                            {item.minStockThreshold} {item.uom}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#D97706] bg-[#FFFBEB] px-2 py-0.5 rounded-full border border-[#D97706]/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Low Stock</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>In Stock</span>
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

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {items.length} items in store</span>
              <button
                type="button"
                onClick={loadData}
                className="text-[#8E1538] font-semibold hover:underline cursor-pointer"
              >
                Refresh Balances
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: RECIPES & BOM FORMULATIONS */}
      {/* ============================================================ */}
      {activeTab === "recipes" && (
        <div className="space-y-4">
          {/* Recipes Header & Action Bar */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Finished Product Recipes & Formulas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Store Manager can configure finished products, batch yield sizes, and dynamic ingredient ratios.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRecipe(null);
                setIsRecipeBuilderOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Product Recipe</span>
            </button>
          </div>

          {recipes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Product Recipes Created</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Click &quot;Create Product Recipe&quot; above to add your first finished product and specify its raw ingredient bill of materials.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingRecipe(null);
                  setIsRecipeBuilderOpen(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Recipe</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-xs flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Product Photo Banner or Header */}
                    {r.imageUrl ? (
                      <div className="h-40 w-full relative bg-slate-100 border-b border-slate-100 overflow-hidden">
                        <img
                          src={r.imageUrl}
                          alt={r.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                          {r.code}
                        </div>
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-xs text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold shadow-xs">
                          Yield: {r.yieldQuantity} {r.yieldUnit}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          {r.code}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          Yield: {r.yieldQuantity} {r.yieldUnit}
                        </span>
                      </div>
                    )}

                    <div className="p-5">
                      <h3 className="text-base font-bold text-slate-900">{r.name}</h3>
                      {r.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.description}</p>
                      )}

                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-400 block mb-2">
                          Ingredient Formula (per batch):
                        </span>
                        <ul className="space-y-1.5 text-xs text-slate-600">
                          {r.ingredients.map((i) => (
                            <li key={i.itemCode} className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-700">{i.itemName}</span>
                              <span className="font-mono font-semibold text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                {i.quantityRequired} {i.uom}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDispenseInitialRecipeCode(r.code);
                        setIsDispenseOpen(true);
                      }}
                      className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Dispense Batch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecipe(r);
                        setIsRecipeBuilderOpen(true);
                      }}
                      className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Edit Recipe & Formula"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: MOVEMENTS & AUDIT LEDGER */}
      {/* ============================================================ */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#8E1538]" />
                <span>Stock Movement Transaction Log</span>
              </h3>
              <span className="text-xs text-slate-400">Chronological feed</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Time & Shift</th>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Staff / Sign-Off</th>
                    <th className="py-3 px-4">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No transactions logged yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-500">
                          <div>{new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          <div className="text-[10px] text-slate-400">{tx.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"}</div>
                        </td>

                        <td className="py-3 px-4 font-bold text-slate-900">
                          {tx.itemName}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {tx.transactionType.replace("_", " ")}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {tx.quantity} <span className="text-slate-400 font-normal text-[11px]">{tx.unit}</span>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {tx.performedByName}
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {tx.notes || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: RECONCILIATION */}
      {/* ============================================================ */}
      {activeTab === "reconciliation" && (
        <div className="space-y-4">
          <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-xs max-w-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              End-of-Shift Physical Reconciliation
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              At the close of each morning and night shift, warehouse staff must count physical inventory, record variances against system book stock, and lock the shift report.
            </p>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600 mb-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Active Shift:</span>
                <span className="font-bold text-slate-900">
                  {activeShift === "MORNING_SHIFT" ? "Morning Shift (08:00 - 18:00)" : "Night Shift (18:00 - 08:00)"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Warehouse Location:</span>
                <span className="text-slate-900 font-medium">Lagos Central Facility</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Digital Lock Status:</span>
                <span className="text-[#059669] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready for Handover Entry</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsReconcileOpen(true)}
              className="py-2.5 px-5 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Launch Shift Reconciliation Modal</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive Modals */}
      <InboundIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => setIsIntakeOpen(false)}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Inbound intake received and logged successfully.");
        }}
      />

      <BatchDispenseModal
        isOpen={isDispenseOpen}
        onClose={() => {
          setIsDispenseOpen(false);
          setDispenseInitialRecipeCode(undefined);
        }}
        recipes={recipes}
        availableItems={items}
        initialRecipeCode={dispenseInitialRecipeCode}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Recipe batch successfully dispensed and stock adjusted.");
        }}
      />

      <ReturnsModal
        isOpen={isReturnsOpen}
        onClose={() => setIsReturnsOpen(false)}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Return recorded and stock adjusted.");
        }}
      />

      <ShiftReconcileModal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Shift closing reconciliation signed and locked.");
        }}
      />

      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={() => {
          loadData();
          showToast("Raw material/SKU catalog item added successfully.");
        }}
      />

      <RecipeBuilderModal
        isOpen={isRecipeBuilderOpen}
        onClose={() => {
          setIsRecipeBuilderOpen(false);
          setEditingRecipe(null);
        }}
        availableItems={items}
        existingRecipe={editingRecipe}
        onSuccess={() => {
          loadData();
          showToast(
            editingRecipe
              ? "Product formulation and BOM recipe updated successfully."
              : "New finished product and BOM formulation created."
          );
        }}
      />
    </div>
  );
}
