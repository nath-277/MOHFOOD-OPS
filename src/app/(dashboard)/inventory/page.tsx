"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { InventoryItem, ProductRecipe, StockTransaction } from "@/server/inventory/store";
import { InboundIntakeModal } from "@/components/inventory/InboundIntakeModal";
import { BatchDispenseModal } from "@/components/inventory/BatchDispenseModal";
import { ReturnsModal } from "@/components/inventory/ReturnsModal";
import { ShiftReconcileModal } from "@/components/inventory/ShiftReconcileModal";
import { AddItemModal } from "@/components/inventory/AddItemModal";
import { EditItemModal } from "@/components/inventory/EditItemModal";
import { RecipeBuilderModal } from "@/components/inventory/RecipeBuilderModal";
import { ItemDetailAuditModal } from "@/components/inventory/ItemDetailAuditModal";
import { formatPackagingDisplay } from "@/lib/packaging";
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
  LayoutGrid,
  List,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Eye,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  ExternalLink,
  Boxes,
  Sun,
  Moon,
  ShieldCheck,
  FileCheck,
  Printer,
  Lock,
} from "lucide-react";
import { useShift, ShiftRecordItem } from "@/components/shift/ShiftContext";
import { ShiftDetailModal } from "@/components/inventory/ShiftDetailModal";
import { BatchDetailModal } from "@/components/inventory/BatchDetailModal";
import { ExecutiveInventoryView } from "@/components/inventory/ExecutiveInventoryView";

export type InventorySortOption =
  | "NAME_ASC"
  | "NAME_DESC"
  | "STOCK_DESC"
  | "STOCK_ASC"
  | "COST_DESC"
  | "COST_ASC"
  | "CODE_ASC"
  | "LOW_STOCK";

export default function InventoryDashboardPage() {
  const { user } = useAuth();
  const role = user?.role || "STAFF";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isExecutive = role === "EXECUTIVE";

  const [viewMode, setViewMode] = useState<"EXECUTIVE" | "FLOOR">(
    isExecutive ? "EXECUTIVE" : "FLOOR"
  );

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "executive") setViewMode("EXECUTIVE");
      if (hash === "floor") setViewMode("FLOOR");
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search & Sorting & Pagination
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<InventorySortOption>("NAME_ASC");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  const {
    activeShift,
    setActiveShift,
    activeShiftRecord,
    shiftStats,
    historicalShifts,
    loadingShifts,
    refreshShifts,
    openShift,
  } = useShift();
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<ShiftRecordItem | null>(null);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [startShiftOfficer, setStartShiftOfficer] = useState("");
  const [startShiftNotes, setStartShiftNotes] = useState("");
  const [submittingStartShift, setSubmittingStartShift] = useState(false);

  // Tabs: "inventory" | "recipes" | "movements" | "reconciliation"
  const [activeTab, setActiveTab] = useState<"inventory" | "recipes" | "movements" | "reconciliation">("inventory");

  // Modal States
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedAuditItem, setSelectedAuditItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRecipeBuilderOpen, setIsRecipeBuilderOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ProductRecipe | null>(null);
  const [dispenseInitialRecipeCode, setDispenseInitialRecipeCode] = useState<string | undefined>(undefined);
  const [dispenseInitialItemCode, setDispenseInitialItemCode] = useState<string | undefined>(undefined);
  const [dispenseInitialMode, setDispenseInitialMode] = useState<"RECIPE" | "INDIVIDUAL">("RECIPE");

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/inventory/items/${deletingItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete item.");
      }
      showToast(`Material ${deletingItem.name} (${deletingItem.code}) removed from catalog.`);
      setDeletingItem(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete material.");
    } finally {
      setIsDeleting(false);
    }
  };

  const [deletingRecipe, setDeletingRecipe] = useState<ProductRecipe | null>(null);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);

  const handleDeleteRecipe = async () => {
    if (!deletingRecipe) return;
    try {
      setIsDeletingRecipe(true);
      const targetId = deletingRecipe.id || deletingRecipe.code;
      const res = await fetch(`/api/inventory/recipes/${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete recipe.");
      }
      showToast(`Product recipe "${deletingRecipe.name}" (${deletingRecipe.code}) removed successfully.`);
      setDeletingRecipe(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete recipe.");
    } finally {
      setIsDeletingRecipe(false);
    }
  };

  // Movements & Batches View State
  const [movementViewMode, setMovementViewMode] = useState<"BATCHES" | "LEDGER">("BATCHES");
  const [expandedBatchRef, setExpandedBatchRef] = useState<string | null>(null);
  const [batchDetailModal, setBatchDetailModal] = useState<{
    batchReference: string;
    productName: string;
    batchSize: string;
    shiftType: string;
    performedByName: string;
    recipient: string;
    timestamp: string;
    materials: StockTransaction[];
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Layout View Switcher: Table vs Grid
  const [viewLayout, setViewLayout] = useState<"TABLE" | "GRID">("TABLE");

  useEffect(() => {
    const saved = localStorage.getItem("moh_stock_view_layout");
    if (saved === "GRID" || saved === "TABLE") {
      setViewLayout(saved);
    } else if (typeof window !== "undefined" && window.innerWidth < 640) {
      setViewLayout("GRID");
    }
  }, []);

  const handleSetLayout = (mode: "TABLE" | "GRID") => {
    setViewLayout(mode);
    localStorage.setItem("moh_stock_view_layout", mode);
  };

  // Stock Balance Display Preference: Packaging vs Base Units
  const [stockDisplayPref, setStockDisplayPref] = useState<"PACKAGES" | "BASE_UNITS">("PACKAGES");

  useEffect(() => {
    try {
      const savedPref = localStorage.getItem("moh_stock_display_pref");
      if (savedPref === "PACKAGES" || savedPref === "BASE_UNITS") {
        setStockDisplayPref(savedPref);
      }
    } catch {}
  }, []);

  const handleSetStockDisplayPref = (pref: "PACKAGES" | "BASE_UNITS") => {
    setStockDisplayPref(pref);
    try {
      localStorage.setItem("moh_stock_display_pref", pref);
    } catch {}
  };

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
        fetch("/api/inventory/transactions?limit=100"),
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

  const [cancellingRef, setCancellingRef] = useState<string | null>(null);

  const handleCancelDispatch = async (referenceId: string) => {
    if (!window.confirm(`Are you sure you want to cancel dispatch "${referenceId}"? All deducted materials will be immediately restored to active store balance.`)) {
      return;
    }
    try {
      setCancellingRef(referenceId);
      const res = await fetch(`/api/inventory/dispatches/${encodeURIComponent(referenceId)}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel dispatch.");
      showToast(`Dispatch ${referenceId} cancelled. Stock restored to store balance.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to cancel dispatch.");
    } finally {
      setCancellingRef(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aggregate stats
  const totalStockItems = items.length;
  const lowStockCount = items.filter((i) => i.currentStock <= i.minStockThreshold).length;

  // Reset pagination on filter, search, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, sortBy]);

  // Sorted and Paginated Inventory Items (Strictly 10 items per page)
  const sortedItems = useMemo(() => {
    const list = [...items];
    switch (sortBy) {
      case "NAME_ASC":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "NAME_DESC":
        return list.sort((a, b) => b.name.localeCompare(a.name));
      case "STOCK_DESC":
        return list.sort((a, b) => b.currentStock - a.currentStock);
      case "STOCK_ASC":
        return list.sort((a, b) => a.currentStock - b.currentStock);
      case "COST_DESC":
        return list.sort((a, b) => (b.costPerUnit || 0) - (a.costPerUnit || 0));
      case "COST_ASC":
        return list.sort((a, b) => (a.costPerUnit || 0) - (b.costPerUnit || 0));
      case "CODE_ASC":
        return list.sort((a, b) => a.code.localeCompare(b.code));
      case "LOW_STOCK":
        return list.sort((a, b) => {
          const aLow = a.currentStock <= a.minStockThreshold ? 1 : 0;
          const bLow = b.currentStock <= b.minStockThreshold ? 1 : 0;
          if (aLow !== bLow) return bLow - aLow;
          return a.currentStock - b.currentStock;
        });
      default:
        return list;
    }
  }, [items, sortBy]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  const handleSortToggle = (field: "NAME" | "STOCK" | "COST" | "CODE") => {
    if (field === "NAME") {
      setSortBy((prev) => (prev === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC"));
    } else if (field === "STOCK") {
      setSortBy((prev) => (prev === "STOCK_DESC" ? "STOCK_ASC" : "STOCK_DESC"));
    } else if (field === "COST") {
      setSortBy((prev) => (prev === "COST_DESC" ? "COST_ASC" : "COST_DESC"));
    } else if (field === "CODE") {
      setSortBy((prev) => (prev === "CODE_ASC" ? "NAME_ASC" : "CODE_ASC"));
    }
  };

  // Grouped Production Batches
  const productionBatches = useMemo(() => {
    const groups: Record<
      string,
      {
        batchReference: string;
        productName: string;
        batchSize: string;
        shiftType: string;
        performedByName: string;
        recipient: string;
        timestamp: string;
        status: string;
        materials: StockTransaction[];
      }
    > = {};

    transactions
      .filter((tx) => tx.transactionType === "DISPENSE_PRODUCTION" && tx.referenceId)
      .forEach((tx) => {
        const ref = tx.referenceId!;
        if (!groups[ref]) {
          let productName = "Production Batch Run";
          let batchSize = "Batch Run";

          const match = tx.notes?.match(/Dispensed for (\d+x?)\s+([^.]+)/i);
          if (match) {
            batchSize = match[1];
            productName = match[2];
          } else if (tx.notes) {
            productName = tx.notes.replace("Dispensed for ", "");
          }

          groups[ref] = {
            batchReference: ref,
            productName,
            batchSize,
            shiftType: tx.shiftType,
            performedByName: tx.performedByName,
            recipient: tx.recipient || "Production Floor",
            timestamp: tx.createdAt,
            status: (tx as any).status || "PERMANENT",
            materials: [],
          };
        }
        groups[ref].materials.push(tx);
        // If any transaction is cancelled, mark the whole batch as cancelled
        if ((tx as any).status === "CANCELLED") {
          groups[ref].status = "CANCELLED";
        }
      });

    return Object.values(groups).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transactions]);

  // Individual Direct Dispatches
  const individualDispenses = useMemo(() => {
    return transactions.filter((tx) => tx.transactionType === "DISPENSE_INDIVIDUAL");
  }, [transactions]);

  // Action Handler for Sidebar triggers & URL hash deep links
  const handleAction = useCallback(
    (action: string) => {
      if (action === "intake") {
        if (!isExecutive || isSuperAdmin) {
          setViewMode("FLOOR");
          setIsIntakeOpen(true);
        }
      } else if (action === "dispense") {
        if (!isExecutive || isSuperAdmin) {
          setViewMode("FLOOR");
          setDispenseInitialRecipeCode(undefined);
          setIsDispenseOpen(true);
        }
      } else if (action === "returns") {
        if (!isExecutive || isSuperAdmin) {
          setViewMode("FLOOR");
          setIsReturnsOpen(true);
        }
      } else if (action === "reconcile") {
        if (!isExecutive || isSuperAdmin) {
          setViewMode("FLOOR");
          setIsReconcileOpen(true);
        }
      } else if (action === "add-item") {
        setIsAddItemOpen(true);
      } else if (action === "recipe-builder") {
        setIsRecipeBuilderOpen(true);
      }
    },
    [isExecutive, isSuperAdmin]
  );

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        handleAction(hash);
      }
    };
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleAction(customEvent.detail);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("inventory:open-modal", handleCustomEvent);

    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("inventory:open-modal", handleCustomEvent);
    };
  }, [handleAction]);

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
    <div className="space-y-6 pb-24 sm:pb-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 bg-[#059669] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200 max-w-sm sm:max-w-md mx-auto">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{toastMessage}</span>
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
        {/* Primary Action Buttons - Responsive 2x2 grid on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setViewMode("EXECUTIVE")}
              className="col-span-2 sm:col-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs transition-all cursor-pointer hover:bg-slate-800"
            >
              <Eye className="w-3.5 h-3.5 text-white/80" />
              <span>Executive Audit View</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsIntakeOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
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
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600" />
            <span>Dispense Batch</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReturnsOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Returns</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReconcileOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Reconcile</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards - Responsive 2x2 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Total Catalog SKUs
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">
              {loading ? "..." : totalStockItems}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Measured, numbered & packaging
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Low Stock Alerts
            </div>
            <div className={`text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1 ${lowStockCount > 0 ? "text-[#D97706]" : "text-slate-900"}`}>
              {loading ? "..." : lowStockCount}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {lowStockCount > 0 ? "Below threshold" : "Well stocked"}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 ${lowStockCount > 0 ? "text-[#D97706]" : "text-slate-400"}`} />
          </div>
        </div>

        <div
          onClick={() => setActiveTab("reconciliation")}
          className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-[#CF0458]/40 transition-all active:scale-[0.99]"
          title="Click to view Shift Handover & Stock Audit"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              <span>Active Shift</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 sm:mt-1 truncate flex items-center gap-1.5">
              {activeShift === "MORNING_SHIFT" ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span>Morning</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>Night</span>
                </>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {activeShift === "MORNING_SHIFT" ? "08:00 – 18:00" : "18:00 – 08:00"} • Handover HUD
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Recent Movements
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">
              {loading ? "..." : transactions.length}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Intakes & dispenses
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar flex-nowrap w-full max-w-full min-w-0 pb-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "inventory"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Materials</span>
          <span className="hidden sm:inline">Stock Balances & Materials</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recipes")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "recipes"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Recipes</span>
          <span className="hidden sm:inline">Recipes & BOM Formulations</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {recipes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("movements")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "movements"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Movements</span>
          <span className="hidden sm:inline">Movements & Audit Trail</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reconciliation")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "reconciliation"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Handover</span>
          <span className="hidden sm:inline">Shift Handover Lock</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: STOCK BALANCES */}
      {/* ============================================================ */}
      {activeTab === "inventory" && (
        <div className="space-y-4 max-w-full min-w-0">
          <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3 max-w-full">
            {/* Row 1: Category Filter Pills & Search Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full min-w-0 shrink-0 pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Materials", mobileLabel: "All" },
                  { id: "PERISHABLE_MEASURED", label: "Measured (kg/L)", mobileLabel: "Measured (kg/l)" },
                  { id: "PERISHABLE_NUMBERED", label: "Numbered (pcs)", mobileLabel: "Counted (pcs)" },
                  { id: "PACKAGING_NON_PERISHABLE", label: "Packaging", mobileLabel: "Packaging" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryFilter(c.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      categoryFilter === c.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span className="sm:hidden">{c.mobileLabel}</span>
                    <span className="hidden sm:inline">{c.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search materials or SKU code..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Controls Toolbar (< sm) - Balanced 2-row layout */}
            <div className="flex sm:hidden flex-col gap-2 pt-2 border-t border-slate-100">
              {/* Row A: Sort Dropdown & Unit Preference Switcher */}
              <div className="grid grid-cols-2 gap-2">
                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200 min-w-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as InventorySortOption)}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer w-full truncate"
                  >
                    <option value="NAME_ASC">Name (A → Z)</option>
                    <option value="NAME_DESC">Name (Z → A)</option>
                    <option value="STOCK_DESC">Stock: High to Low</option>
                    <option value="STOCK_ASC">Stock: Low to High</option>
                    <option value="COST_DESC">Unit Cost: High to Low</option>
                    <option value="COST_ASC">Unit Cost: Low to High</option>
                    <option value="LOW_STOCK">Low Stock First</option>
                    <option value="CODE_ASC">SKU Code (A → Z)</option>
                  </select>
                </div>

                {/* Unit Display Preference Switcher */}
                <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("PACKAGES")}
                    className={`px-1.5 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "PACKAGES"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <Box className="w-3 h-3 shrink-0" />
                    <span>Packs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("BASE_UNITS")}
                    className={`px-1.5 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "BASE_UNITS"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <Scale className="w-3 h-3 shrink-0" />
                    <span>Units</span>
                  </button>
                </div>
              </div>

              {/* Row B: View Layout Switcher & + Add Material Button */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetLayout("TABLE")}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      viewLayout === "TABLE"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="text-[11px]">List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetLayout("GRID")}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      viewLayout === "GRID"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Grid</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Material</span>
                </button>
              </div>
            </div>

            {/* Desktop Controls Toolbar (sm:) */}
            <div className="hidden sm:flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as InventorySortOption)}
                    className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="NAME_ASC">Name (A → Z)</option>
                    <option value="NAME_DESC">Name (Z → A)</option>
                    <option value="STOCK_DESC">Stock: High to Low</option>
                    <option value="STOCK_ASC">Stock: Low to High</option>
                    <option value="COST_DESC">Unit Cost: High to Low</option>
                    <option value="COST_ASC">Unit Cost: Low to High</option>
                    <option value="LOW_STOCK">Low Stock First</option>
                    <option value="CODE_ASC">SKU Code (A → Z)</option>
                  </select>
                </div>

                {/* Unit Display Preference Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("PACKAGES")}
                    title="Display stock balances in packages (Cartons, Bags, Packs)"
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "PACKAGES"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Packages</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("BASE_UNITS")}
                    title="Display stock balances in base units (kg, pcs, cups)"
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "BASE_UNITS"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Units</span>
                  </button>
                </div>

                {/* View Switcher: Table vs Grid */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSetLayout("TABLE")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      viewLayout === "TABLE"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetLayout("GRID")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      viewLayout === "GRID"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Grid</span>
                  </button>
                </div>
              </div>

              {/* Add Material Button */}
              <button
                type="button"
                onClick={() => setIsAddItemOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Material</span>
              </button>
            </div>
          </div>

          {viewLayout === "GRID" ? (
            /* Materials Card Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {loading ? (
                <div className="col-span-full py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                  <span className="text-xs">Loading materials balance...</span>
                </div>
              ) : sortedItems.length === 0 ? (
                <div className="col-span-full py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">No items found.</span>
                </div>
              ) : (
                paginatedItems.map((item) => {
                  const isLow = item.currentStock <= item.minStockThreshold;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAuditItem(item)}
                      className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-xs flex flex-col justify-between hover:border-[#CF0458]/40 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div>
                        {/* Image Container - Clean without micro-buttons */}
                        <div className="relative w-full h-28 sm:h-32 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 mb-2">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Package className="w-8 h-8" />
                            </div>
                          )}
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-black/65 text-white backdrop-blur-xs shadow-xs">
                            {item.code}
                          </span>
                          {item.isVariablePack && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                              Variable
                            </span>
                          )}
                        </div>

                        {/* Title & Metadata with 2-line wrap */}
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 min-h-[2rem] leading-snug group-hover:text-[#CF0458] transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {item.storageLocation || "Central Store"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {item.packagingType === "CARTON_AND_PACK" && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {item.packsPerCarton}pk × {item.unitsPerPack}
                            </span>
                          )}
                          {item.packagingType === "PACK_ONLY" && (
                            <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {item.unitsPerPack} {item.uom}/pk
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Stock count, status badge & clear action buttons */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        {(() => {
                          const pkgDisplay = formatPackagingDisplay(item.currentStock, item);
                          const hasPkg = pkgDisplay.type !== "DIRECT";

                          if (stockDisplayPref === "PACKAGES" && hasPkg) {
                            return (
                              <div className="flex items-baseline justify-between">
                                <span className="text-[10px] text-slate-400 font-semibold">Stock:</span>
                                <div className="text-right">
                                  <div className="font-mono font-extrabold text-sm text-slate-900">
                                    {pkgDisplay.primary}
                                  </div>
                                  {pkgDisplay.secondary && (
                                    <div className="text-[10px] font-normal text-slate-500 font-sans">
                                      {pkgDisplay.secondary}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div className="flex items-baseline justify-between">
                              <span className="text-[10px] text-slate-400 font-semibold">Stock:</span>
                              <div className="text-right">
                                <span className="font-mono font-extrabold text-sm text-slate-900">
                                  {item.currentStock.toLocaleString(undefined, {
                                    minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  <span className="text-[10px] font-normal text-slate-500">{item.uom}</span>
                                </span>
                                {hasPkg && (
                                  <div className="text-[10px] font-normal text-slate-500 font-mono">
                                    ({pkgDisplay.primary})
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {isLow ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-md border border-[#D97706]/20 truncate">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Low Stock ({item.minStockThreshold})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md border border-[#059669]/20">
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                            <span>In Stock</span>
                          </span>
                        )}

                        {/* Action buttons: prominent Dispense and Edit */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDispenseInitialRecipeCode(undefined);
                              setDispenseInitialItemCode(item.code);
                              setDispenseInitialMode("INDIVIDUAL");
                              setIsDispenseOpen(true);
                            }}
                            className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-[#CF0458] hover:text-white text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                            <span>Dispense</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem(item);
                            }}
                            title="Edit Material Specs"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div>
              {/* Mobile List View (< sm) */}
              <div className="sm:hidden space-y-2">
                {loading ? (
                  <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                    <span className="text-xs">Loading materials balance...</span>
                  </div>
                ) : sortedItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs font-semibold text-slate-600">No items found.</span>
                  </div>
                ) : (
                  paginatedItems.map((item) => {
                    const isLow = item.currentStock <= item.minStockThreshold;
                    const pkgDisplay = formatPackagingDisplay(item.currentStock, item);
                    const hasPkg = pkgDisplay.type !== "DIRECT";

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedAuditItem(item)}
                        className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center gap-3 cursor-pointer hover:border-[#CF0458]/40 active:scale-[0.99] transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* Middle: Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                              {item.code}
                            </span>
                            {item.isVariablePack && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800">
                                Variable
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 truncate">{item.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate">{item.storageLocation || "Central Store"}</p>
                        </div>

                        {/* Right: Stock & Status */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-extrabold text-sm text-slate-900">
                            {item.isVariablePack ? (
                              <div>
                                <div>{pkgDisplay.primary}</div>
                                <div className="text-[10px] text-amber-700 font-sans font-normal">{pkgDisplay.secondary}</div>
                              </div>
                            ) : stockDisplayPref === "PACKAGES" && hasPkg ? (
                              pkgDisplay.primary
                            ) : (
                              `${item.currentStock.toLocaleString(undefined, {
                                minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                                maximumFractionDigits: 2,
                              })} ${item.uom}`
                            )}
                          </div>
                          <div className="mt-0.5">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-md border border-[#D97706]/20">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Low Stock</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md border border-[#059669]/20">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>In Stock</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View (sm:) */}
              <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
              <div className="overflow-x-auto no-scrollbar max-w-full">
                <table className="w-full text-left text-xs min-w-[680px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSortToggle("NAME")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Material / Item</span>
                          {sortBy === "NAME_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {sortBy === "NAME_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {sortBy !== "NAME_ASC" && sortBy !== "NAME_DESC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSortToggle("CODE")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>SKU Code</span>
                          {sortBy === "CODE_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {sortBy !== "CODE_ASC" && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                        </div>
                      </th>
                      <th className="py-3 px-4">Category</th>
                      <th
                        className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSortToggle("STOCK")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Current Stock</span>
                          {sortBy === "STOCK_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {sortBy === "STOCK_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {sortBy !== "STOCK_DESC" && sortBy !== "STOCK_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Min Threshold</th>
                      <th
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => setSortBy((prev) => (prev === "LOW_STOCK" ? "NAME_ASC" : "LOW_STOCK"))}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Status</span>
                          {sortBy === "LOW_STOCK" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {sortBy !== "LOW_STOCK" && <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                        </div>
                      </th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                          <span>Loading materials balance...</span>
                        </td>
                      </tr>
                    ) : sortedItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <span className="text-xs font-semibold text-slate-600">No items found.</span>
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((item) => {
                      const isLow = item.currentStock <= item.minStockThreshold;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedAuditItem(item)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100 group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 group-hover:text-[#CF0458] transition-colors">{item.name}</div>
                                <div className="text-[10px] text-slate-400">{item.storageLocation || "Central Store"}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-slate-600">
                            {item.code}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {item.category === "PERISHABLE_MEASURED"
                                  ? "Measured"
                                  : item.category === "PERISHABLE_NUMBERED"
                                  ? "Numbered"
                                  : "Packaging"}
                              </span>
                              {item.packagingType === "CARTON_AND_PACK" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {item.packsPerCarton}pk × {item.unitsPerPack}
                                </span>
                              )}
                              {item.packagingType === "PACK_ONLY" && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {item.unitsPerPack} {item.uom}/pk
                                </span>
                              )}
                              {item.isVariablePack && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Variable
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {(() => {
                              const pkgDisplay = formatPackagingDisplay(item.currentStock, item);
                              const hasPkg = pkgDisplay.type !== "DIRECT";

                              if (item.isVariablePack || (stockDisplayPref === "PACKAGES" && hasPkg)) {
                                return (
                                  <div>
                                    <div className="font-mono font-bold text-slate-900 text-xs">
                                      {pkgDisplay.primary}
                                    </div>
                                    {pkgDisplay.secondary && (
                                      <div className="text-[10px] text-amber-700 font-normal font-sans">
                                        {pkgDisplay.secondary}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              return (
                                <div>
                                  <div className="font-mono font-bold text-slate-900 text-xs">
                                    {item.currentStock.toLocaleString(undefined, {
                                      minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 2 : 0,
                                    })}{" "}
                                    <span className="text-slate-400 font-normal font-sans">{item.uom}</span>
                                  </div>
                                  {hasPkg && (
                                    <div className="text-[10px] text-slate-400 font-normal font-mono">
                                      ({pkgDisplay.primary})
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
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

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAuditItem(item);
                                }}
                                title="View Details & Audit"
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-[#CF0458] hover:text-[#CF0458] text-slate-500 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDispenseInitialRecipeCode(undefined);
                                  setDispenseInitialItemCode(item.code);
                                  setDispenseInitialMode("INDIVIDUAL");
                                  setIsDispenseOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#CF0458] hover:text-white text-slate-700 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Dispense</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(item);
                                }}
                                title="Edit Material"
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-[#CF0458] hover:text-[#CF0458] text-slate-500 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem(item);
                                }}
                                title="Delete Material"
                                className="p-1.5 rounded-lg border border-slate-200 hover:border-red-500 hover:bg-red-50 hover:text-red-600 text-slate-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      )}

        {/* 10-Item Pagination & Status Bar */}
        {!loading && sortedItems.length > 0 && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs max-w-full min-w-0">
            <div className="flex items-center justify-between w-full sm:w-auto text-slate-500 font-medium">
              <span>
                Showing <span className="font-bold text-slate-800">{Math.min((currentPage - 1) * itemsPerPage + 1, sortedItems.length)}</span>–
                <span className="font-bold text-slate-800">{Math.min(currentPage * itemsPerPage, sortedItems.length)}</span> of{" "}
                <span className="font-bold text-slate-800">{sortedItems.length}</span> materials
                {totalPages > 1 && (
                  <span className="ml-1 text-slate-400 font-normal hidden sm:inline">
                    (Page {currentPage} of {totalPages})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={loadData}
                className="sm:hidden text-xs text-slate-500 hover:text-[#CF0458] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title="Refresh stock balances"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
              <button
                type="button"
                onClick={loadData}
                className="hidden sm:flex text-xs text-slate-500 hover:text-[#CF0458] font-medium transition-colors items-center gap-1 cursor-pointer mr-2"
                title="Refresh stock balances"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
                <span>Refresh</span>
              </button>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        totalPages > 7 &&
                        page !== 1 &&
                        page !== totalPages &&
                        Math.abs(page - currentPage) > 1
                      ) {
                        if (page === 2 || page === totalPages - 1) {
                          return (
                            <span key={page} className="px-1 text-slate-400 select-none">
                              ...
                            </span>
                          );
                        }
                        return null;
                      }

                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === page
                              ? "bg-[#CF0458] text-white shadow-xs"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto shrink-0"
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
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold cursor-pointer"
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
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-600" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRecipe(r)}
                      className="p-2 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors flex items-center justify-center cursor-pointer"
                      title={`Delete Recipe ${r.name}`}
                      aria-label="Delete Recipe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
      {/* ============================================================ */}
      {/* TAB 3: MOVEMENTS & AUDIT LEDGER */}
      {/* ============================================================ */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          {/* Sub-View Switcher: Batches vs Raw Ledger */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setMovementViewMode("BATCHES")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  movementViewMode === "BATCHES"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-[#CF0458]" />
                <span>Production Batch Runs</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {productionBatches.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMovementViewMode("LEDGER")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  movementViewMode === "LEDGER"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>All Movements Ledger</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                  {transactions.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Shift: <strong className="text-slate-800">{activeShift === "MORNING_SHIFT" ? "Morning" : "Night"}</strong></span>
              <span className="text-slate-300">•</span>
              <span>{transactions.length} movements tracked</span>
            </div>
          </div>

          {/* VIEW 1: PRODUCTION BATCH RUNS (Item 10) */}
          {movementViewMode === "BATCHES" && (
            <div className="space-y-4">
              {productionBatches.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-[#CF0458] flex items-center justify-center mx-auto mb-3">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">No Production Batches Dispatched Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                    When raw materials are requisitioned and dispensed for a recipe run, the scheduled product and itemized materials breakdown will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsDispenseOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Dispense Recipe Batch Now</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {productionBatches.map((batch) => {
                    const isExpanded = expandedBatchRef === batch.batchReference;
                    return (
                      <div
                        key={batch.batchReference}
                        className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                      >
                        {/* Batch Header */}
                        <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {batch.status === "PENDING_HANDOVER" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                  Pending Shift Handover
                                </span>
                              ) : batch.status === "CANCELLED" ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                  Cancelled
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#059669] border border-emerald-200">
                                  Reconciled & Handed Over
                                </span>
                              )}
                              <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                Ref: {batch.batchReference}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {new Date(batch.timestamp).toLocaleDateString()} {new Date(batch.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-baseline gap-2">
                              <h4 className="text-base font-bold text-slate-900">
                                {batch.productName}
                              </h4>
                              <span className="text-xs font-semibold text-[#CF0458] bg-rose-50 px-2 py-0.5 rounded-full">
                                Target Size: {batch.batchSize}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>Floor Recipient: <strong className="text-slate-800">{batch.recipient}</strong></span>
                              <span>Staff: <strong className="text-slate-800">{batch.performedByName}</strong></span>
                              <span>Shift: <strong className="text-slate-800">{batch.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"}</strong></span>
                            </div>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {batch.status === "PENDING_HANDOVER" && (
                              <button
                                type="button"
                                disabled={cancellingRef === batch.batchReference}
                                onClick={() => handleCancelDispatch(batch.batchReference)}
                                className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                                title="Cancel provisional dispatch before shift handover and restore materials to store balance"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                                <span>{cancellingRef === batch.batchReference ? "Cancelling..." : "Cancel Dispatch"}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBatchRef(isExpanded ? null : batch.batchReference)
                              }
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isExpanded
                                  ? "bg-slate-100 text-slate-800 border border-slate-200"
                                  : "bg-slate-900 hover:bg-slate-800 text-white"
                              }`}
                            >
                              <span>{isExpanded ? "Hide Materials" : `View Dispatched Materials (${batch.materials.length})`}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setBatchDetailModal(batch)}
                              className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span className="hidden sm:inline">Details Slip</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Materials Table */}
                        {isExpanded && (
                          <div className="bg-slate-50/70 p-4 border-t border-slate-100">
                            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-[#CF0458]" />
                                <span>Materials Dispatched to Kitchen / Production Floor ({batch.materials.length})</span>
                              </span>
                              <span className="text-[11px] font-normal text-slate-500">
                                Exact store deduction breakdown
                              </span>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3">Ingredient / Material</th>
                                    <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                                    <th className="py-2.5 px-3">Deduction Type</th>
                                    <th className="py-2.5 px-3">Batch Time</th>
                                    <th className="py-2.5 px-3">Formula / Proportion Note</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {batch.materials.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                                        {m.itemName}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#CF0458]">
                                        -{m.quantity} <span className="text-slate-400 font-normal text-[10px]">{m.unit}</span>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-[#CF0458] border border-rose-100">
                                          Store Deduction
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                        {m.notes || "Standard BOM calculation"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Individual Material Direct Dispatches Card */}
              {individualDispenses.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-6">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <ArrowUpRight className="w-4 h-4 text-slate-700" />
                        <span>Single Material Direct Dispatches (Ad-Hoc / Floor Requisitions)</span>
                      </h4>
                      <p className="text-xs text-slate-400">
                        Materials dispensed directly without requiring a recipe formulation
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                      {individualDispenses.length} Dispatches
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Time & Shift</th>
                          <th className="py-2.5 px-4">Item Name</th>
                          <th className="py-2.5 px-4 text-right">Quantity</th>
                          <th className="py-2.5 px-4">Recipient</th>
                          <th className="py-2.5 px-4">Staff</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Purpose / Reference</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {individualDispenses.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 text-slate-500">
                              {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              <span className="ml-1 text-[10px] text-slate-400">
                                ({tx.shiftType === "MORNING_SHIFT" ? "Morning" : "Night"})
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">{tx.itemName}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              {tx.quantity > 0 ? `-${tx.quantity}` : tx.quantity}{" "}
                              <span className="text-slate-400 font-normal text-[11px]">{tx.unit}</span>
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-800">{tx.recipient || "Floor"}</td>
                            <td className="py-2.5 px-4 text-slate-600">{tx.performedByName}</td>
                            <td className="py-2.5 px-4">
                              {tx.status === "PENDING_HANDOVER" ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
                                  Pending Handover
                                </span>
                              ) : tx.status === "CANCELLED" ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                                  Cancelled
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200 whitespace-nowrap">
                                  Handed Over
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{tx.notes || "—"}</td>
                            <td className="py-2.5 px-4 text-right">
                              {tx.status === "PENDING_HANDOVER" && tx.referenceId && (
                                <button
                                  type="button"
                                  disabled={cancellingRef === tx.referenceId}
                                  onClick={() => handleCancelDispatch(tx.referenceId!)}
                                  className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold border border-red-200 cursor-pointer disabled:opacity-50"
                                >
                                  {cancellingRef === tx.referenceId ? "..." : "Cancel"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: FULL RAW LEDGER */}
          {movementViewMode === "LEDGER" && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-[#CF0458]" />
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
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4">Staff / Sign-Off</th>
                      <th className="py-3 px-4">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
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
                              {tx.transactionType.replace(/_/g, " ")}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {tx.status === "PENDING_HANDOVER" ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                Provisional
                              </span>
                            ) : tx.status === "CANCELLED" ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                Cancelled
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                                Handed Over
                              </span>
                            )}
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
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: RECONCILIATION & SHIFT HANDOVER */}
      {/* ============================================================ */}
      {activeTab === "reconciliation" && (
        <div className="space-y-5 max-w-full min-w-0">
          {/* Active Shift Operations HUD Card */}
          <div className="p-4 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
                      <span>Live Shift Active</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Plant: Lagos Central Facility
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                    {activeShift === "MORNING_SHIFT" ? "Morning Shift (08:00 – 18:00)" : "Night Shift (18:00 – 08:00)"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Officer on Duty: <span className="font-semibold text-slate-700">{activeShiftRecord?.openedByName || "Store Officer"}</span>
                    {activeShiftRecord?.createdAt && (
                      <span className="ml-1 text-slate-400">
                        • Started {new Date(activeShiftRecord.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsStartShiftModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-initial"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Switch / Start Shift</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsReconcileOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer flex-1 sm:flex-initial active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sign Off & Lock Shift Handover</span>
                </button>
              </div>
            </div>

            {/* Live Shift Stats Counter Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Batches Dispensed
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shiftStats.dispensedCount} batches
                </span>
                <span className="text-[10px] text-slate-400">Production floor run</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Supplier Deliveries
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shiftStats.intakeCount} received
                </span>
                <span className="text-[10px] text-slate-400">Inbound intake logs</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Returns Processed
                </span>
                <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono mt-0.5 block">
                  {shiftStats.returnsCount} items
                </span>
                <span className="text-[10px] text-slate-400">Faults & excess</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Count Verification
                </span>
                <span className="text-base sm:text-lg font-extrabold text-[#059669] font-mono mt-0.5 block">
                  Ready
                </span>
                <span className="text-[10px] text-slate-400">Audit awaiting sign-off</span>
              </div>
            </div>
          </div>

          {/* Historical Shift Handover Ledger */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Shift Handover & Stock Reconciliation History
                </h3>
                <p className="text-xs text-slate-500">
                  Certified digital certificates of shift changeovers, verified physical counts, and custody handovers.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshShifts()}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingShifts ? "animate-spin text-[#CF0458]" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Mobile Shift Cards (< sm) */}
            <div className="sm:hidden space-y-2">
              {loadingShifts ? (
                <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                  <span className="text-xs">Loading shift records...</span>
                </div>
              ) : historicalShifts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  <span className="text-xs font-semibold">No historical shift records yet.</span>
                </div>
              ) : (
                historicalShifts.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedShiftDetail(s)}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2 cursor-pointer hover:border-[#CF0458]/40 active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900">{s.shiftDate}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            s.shiftType === "MORNING_SHIFT"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                          }`}
                        >
                          {s.shiftType === "MORNING_SHIFT" ? "☀️ Morning" : "🌙 Night"}
                        </span>
                      </div>
                      {s.status === "RECONCILED" ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#059669]/20">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600">
                      <span className="text-slate-400">Handover: </span>
                      <span className="font-semibold text-slate-800">{s.openedByName}</span>
                      {s.handoverOfficerName && (
                        <>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="font-semibold text-slate-800">{s.handoverOfficerName}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                      <span className="text-slate-500 font-mono">
                        {s.totalVariances === 0 ? "Zero Variances" : `${s.totalVariances} Variances`}
                      </span>
                      <span className="text-[#CF0458] font-bold flex items-center gap-0.5">
                        <span>View Certificate</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Shift Table (>= sm) */}
            <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Shift Date & Schedule</th>
                      <th className="py-3 px-3">Outgoing Officer</th>
                      <th className="py-3 px-3">Incoming Handover Officer</th>
                      <th className="py-3 px-3 text-center">Physical Count Result</th>
                      <th className="py-3 px-3 text-center">Lock Status</th>
                      <th className="py-3 px-4 text-right">Audit Certificate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingShifts ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                          Loading shift handover history...
                        </td>
                      </tr>
                    ) : historicalShifts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No shift handover records found.
                        </td>
                      </tr>
                    ) : (
                      historicalShifts.map((s) => {
                        const isMorning = s.shiftType === "MORNING_SHIFT";

                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedShiftDetail(s)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 font-mono">{s.shiftDate}</div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                                {isMorning ? (
                                  <>
                                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>Morning (08:00 – 18:00)</span>
                                  </>
                                ) : (
                                  <>
                                    <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>Night (18:00 – 08:00)</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {s.closedByName || s.openedByName}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {s.handoverOfficerName || "—"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {s.totalVariances === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20">
                                  0 Discrepancy
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200">
                                  {s.totalVariances} {s.totalVariances === 1 ? "Discrepancy" : "Discrepancies"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {s.status === "RECONCILED" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#059669]/20">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Reconciled & Locked</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Active Shift</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedShiftDetail(s);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#CF0458] hover:text-white text-slate-700 text-xs font-bold transition-all cursor-pointer"
                              >
                                View Report
                              </button>
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
        </div>
      )}

      {/* Interactive Modals */}
      <InboundIntakeModal
        isOpen={isIntakeOpen}
        onClose={() => {
          setIsIntakeOpen(false);
          if (typeof window !== "undefined" && window.location.hash === "#intake") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            window.dispatchEvent(new Event("hashchange"));
          }
        }}
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
          setDispenseInitialItemCode(undefined);
          setDispenseInitialMode("RECIPE");
          if (typeof window !== "undefined" && window.location.hash === "#dispense") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            window.dispatchEvent(new Event("hashchange"));
          }
        }}
        recipes={recipes}
        availableItems={items}
        initialRecipeCode={dispenseInitialRecipeCode}
        initialItemCode={dispenseInitialItemCode}
        initialMode={dispenseInitialMode}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Batch / material successfully dispensed and stock adjusted.");
        }}
      />

      <ReturnsModal
        isOpen={isReturnsOpen}
        onClose={() => {
          setIsReturnsOpen(false);
          if (typeof window !== "undefined" && window.location.hash === "#returns") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            window.dispatchEvent(new Event("hashchange"));
          }
        }}
        items={items}
        shiftType={activeShift}
        onSuccess={() => {
          loadData();
          showToast("Return recorded and stock adjusted.");
        }}
      />

      <ShiftReconcileModal
        isOpen={isReconcileOpen}
        onClose={() => {
          setIsReconcileOpen(false);
          if (typeof window !== "undefined" && window.location.hash === "#reconcile") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            window.dispatchEvent(new Event("hashchange"));
          }
        }}
        items={items}
        shiftType={activeShift}
        onSuccess={(reconciledShift) => {
          loadData();
          refreshShifts();
          showToast("Shift closing reconciliation signed and locked.");
          if (reconciledShift) {
            setSelectedShiftDetail(reconciledShift);
          }
        }}
      />

      {/* Official Shift Handover Certificate Modal */}
      <ShiftDetailModal
        isOpen={!!selectedShiftDetail}
        onClose={() => setSelectedShiftDetail(null)}
        shift={selectedShiftDetail}
      />

      {/* Switch / Start Shift Modal */}
      {isStartShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#CF0458]" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  Switch or Open Shift
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStartShiftModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Shift Schedule
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveShift("MORNING_SHIFT")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      activeShift === "MORNING_SHIFT"
                        ? "border-[#CF0458] bg-[#CF0458]/5 text-[#CF0458] font-bold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span>Morning Shift</span>
                    <span className="text-[10px] text-slate-400 font-normal">08:00 – 18:00</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveShift("NIGHT_SHIFT")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      activeShift === "NIGHT_SHIFT"
                        ? "border-[#CF0458] bg-[#CF0458]/5 text-[#CF0458] font-bold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span>Night Shift</span>
                    <span className="text-[10px] text-slate-400 font-normal">18:00 – 08:00</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Store Officer Name on Duty
                </label>
                <input
                  type="text"
                  value={startShiftOfficer}
                  onChange={(e) => setStartShiftOfficer(e.target.value)}
                  placeholder="e.g. Ajayi Boluwatife (Store Manager)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#CF0458]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Operational Notes (Optional)
                </label>
                <input
                  type="text"
                  value={startShiftNotes}
                  onChange={(e) => setStartShiftNotes(e.target.value)}
                  placeholder="e.g. Morning yogurt mixing and packing"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-hidden focus:border-[#CF0458]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsStartShiftModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingStartShift}
                onClick={async () => {
                  try {
                    setSubmittingStartShift(true);
                    await openShift(
                      activeShift,
                      startShiftOfficer || "Store Officer",
                      startShiftNotes || undefined
                    );
                    showToast(`${activeShift === "MORNING_SHIFT" ? "Morning" : "Night"} shift started.`);
                    setIsStartShiftModalOpen(false);
                    setStartShiftNotes("");
                  } catch (err: any) {
                    showToast(err.message || "Failed to start shift.");
                  } finally {
                    setSubmittingStartShift(false);
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#CF0458] hover:bg-[#B5034C] transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submittingStartShift ? "Opening..." : "Confirm & Open Shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={() => {
          loadData();
          showToast("Raw material/SKU catalog item added successfully.");
        }}
      />

      <EditItemModal
        isOpen={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={() => {
          loadData();
          showToast("Raw material/SKU updated successfully.");
        }}
      />

      <ItemDetailAuditModal
        isOpen={!!selectedAuditItem}
        item={selectedAuditItem}
        onClose={() => setSelectedAuditItem(null)}
        transactions={transactions}
        onDispenseItem={(item) => {
          setDispenseInitialRecipeCode(undefined);
          setDispenseInitialItemCode(item.code);
          setDispenseInitialMode("INDIVIDUAL");
          setIsDispenseOpen(true);
        }}
        onEditItem={(item) => {
          setEditingItem(item);
        }}
      />

      {/* Delete Item Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Delete Material</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove <span className="font-semibold text-slate-800">{deletingItem.name}</span> (<span className="font-mono">{deletingItem.code}</span>) from the catalog? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteItem}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Material</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Recipe Confirmation Modal */}
      {deletingRecipe && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Delete Product Recipe</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to delete <span className="font-semibold text-slate-800">{deletingRecipe.name}</span> (<span className="font-mono">{deletingRecipe.code}</span>) and its ingredient formula? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingRecipe}
                onClick={() => setDeletingRecipe(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingRecipe}
                onClick={handleDeleteRecipe}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeletingRecipe ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Recipe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <RecipeBuilderModal
        isOpen={isRecipeBuilderOpen}
        onClose={() => {
          setIsRecipeBuilderOpen(false);
          setEditingRecipe(null);
        }}
        availableItems={items}
        existingRecipe={editingRecipe}
        onDelete={(recipe) => {
          setIsRecipeBuilderOpen(false);
          setEditingRecipe(null);
          setDeletingRecipe(recipe);
        }}
        onSuccess={() => {
          loadData();
          showToast(
            editingRecipe
              ? "Product formulation and BOM recipe updated successfully."
              : "New finished product and BOM formulation created."
          );
        }}
      />

      {/* Production Batch Details Modal (Item 10) */}
      <BatchDetailModal
        batch={batchDetailModal}
        onClose={() => setBatchDetailModal(null)}
      />
    </div>
  );
}
