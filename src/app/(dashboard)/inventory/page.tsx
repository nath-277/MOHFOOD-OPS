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
import { EditPendingDispatchModal, DispatchItemToEdit } from "@/components/inventory/EditPendingDispatchModal";
import { formatPackagingDisplay } from "@/lib/packaging";
import {
  getShiftHandoverCutoff,
  isDispatchEditable,
  getEffectiveDispatchStatus,
  formatCutoffTime,
  getHandoverGraceDescription,
} from "@/lib/shiftTiming";
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
  Download,
} from "lucide-react";
import { useShift, ShiftRecordItem } from "@/components/shift/ShiftContext";
import { ShiftDetailModal } from "@/components/inventory/ShiftDetailModal";
import { BatchDetailModal } from "@/components/inventory/BatchDetailModal";
import { ExecutiveInventoryView } from "@/components/inventory/ExecutiveInventoryView";
import { DailyShiftSheetView } from "@/components/inventory/DailyShiftSheetView";
import { ExportStatementModal } from "@/components/inventory/ExportStatementModal";

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
  const isAccountant = role === "ACCOUNTANT";
  const isExecutiveOrAccountant = isExecutive || isAccountant;

  const [viewMode, setViewMode] = useState<"EXECUTIVE" | "FLOOR">(
    isExecutiveOrAccountant ? "EXECUTIVE" : "FLOOR"
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
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
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

  // Tabs: "inventory" | "recipes" | "movements" | "daily-sheet"
  const [activeTab, setActiveTab] = useState<"inventory" | "recipes" | "movements" | "daily-sheet">("inventory");

  // Modal States
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDispenseOpen, setIsDispenseOpen] = useState(false);
  const [isReturnsOpen, setIsReturnsOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
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
  const [editingDispatch, setEditingDispatch] = useState<{
    referenceId: string;
    title?: string;
    recipient?: string;
    notes?: string;
    items: DispatchItemToEdit[];
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
      const [itemsRes, recipesRes] = await Promise.all([
        fetch(`/api/inventory/items?category=${categoryFilter}`),
        fetch("/api/inventory/recipes"),
      ]);

      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items || []);
      }
      if (recipesRes.ok) {
        const d = await recipesRes.json();
        setRecipes(d.recipes || []);
      }
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryFilter]);

  // Movements & Audit Ledger Advanced Filters
  const [movementDatePreset, setMovementDatePreset] = useState<
    "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH" | "LAST_30_DAYS" | "LAST_90_DAYS" | "CUSTOM"
  >("ALL");
  const [movementStartDate, setMovementStartDate] = useState("");
  const [movementEndDate, setMovementEndDate] = useState("");
  const [movementItemFilter, setMovementItemFilter] = useState("ALL");
  const [movementTypeFilter, setMovementTypeFilter] = useState("ALL");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementLoading, setMovementLoading] = useState(false);

  const loadMovements = useCallback(async () => {
    try {
      setMovementLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "200");

      let start = movementStartDate;
      let end = movementEndDate;

      if (movementDatePreset !== "CUSTOM" && movementDatePreset !== "ALL") {
        const now = new Date();
        const fmt = (d: Date) => d.toISOString().split("T")[0];
        if (movementDatePreset === "TODAY") {
          start = fmt(now);
          end = fmt(now);
        } else if (movementDatePreset === "YESTERDAY") {
          const y = new Date(now);
          y.setDate(y.getDate() - 1);
          start = fmt(y);
          end = fmt(y);
        } else if (movementDatePreset === "LAST_7_DAYS") {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          start = fmt(d);
          end = fmt(now);
        } else if (movementDatePreset === "THIS_MONTH") {
          const d = new Date(now.getFullYear(), now.getMonth(), 1);
          start = fmt(d);
          end = fmt(now);
        } else if (movementDatePreset === "LAST_30_DAYS") {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          start = fmt(d);
          end = fmt(now);
        } else if (movementDatePreset === "LAST_90_DAYS") {
          const d = new Date(now);
          d.setDate(d.getDate() - 90);
          start = fmt(d);
          end = fmt(now);
        }
      }

      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);
      if (movementItemFilter && movementItemFilter !== "ALL") params.set("itemId", movementItemFilter);
      if (movementTypeFilter && movementTypeFilter !== "ALL") params.set("type", movementTypeFilter);
      if (movementSearch.trim()) params.set("search", movementSearch.trim());

      const res = await fetch(`/api/inventory/transactions?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setTransactions(d.transactions || []);
      }
    } catch (err) {
      console.error("Failed to load movements:", err);
    } finally {
      setMovementLoading(false);
    }
  }, [movementDatePreset, movementStartDate, movementEndDate, movementItemFilter, movementTypeFilter, movementSearch]);

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
      await Promise.all([loadData(), loadMovements()]);
    } catch (err: any) {
      alert(err.message || "Failed to cancel dispatch.");
    } finally {
      setCancellingRef(null);
    }
  };

  const handleOpenEditBatch = (batch: any) => {
    const itemsToEdit: DispatchItemToEdit[] = batch.materials.map((m: any) => ({
      txId: m.id,
      itemId: m.itemId,
      itemName: m.itemName,
      quantity: Math.abs(Number(m.quantity)),
      unit: m.unit,
      notes: m.notes,
    }));

    setEditingDispatch({
      referenceId: batch.batchReference,
      title: `${batch.productName} (Target: ${batch.batchSize})`,
      recipient: batch.recipient,
      notes: "",
      items: itemsToEdit,
    });
  };

  const handleOpenEditMovement = (tx: StockTransaction) => {
    if (!tx.referenceId) return;
    const related = transactions.filter((t) => t.referenceId === tx.referenceId);
    const itemsToEdit: DispatchItemToEdit[] = (related.length > 0 ? related : [tx]).map((m) => ({
      txId: m.id,
      itemId: m.itemId,
      itemName: m.itemName,
      quantity: Math.abs(Number(m.quantity)),
      unit: m.unit,
      notes: m.notes,
    }));

    setEditingDispatch({
      referenceId: tx.referenceId,
      title: tx.referenceId.startsWith("BATCH-") ? `Batch: ${tx.notes || tx.itemName}` : `Material: ${tx.itemName}`,
      recipient: tx.recipient || "Production Floor",
      notes: "",
      items: itemsToEdit,
    });
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Instant In-Memory Filtered Items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q) ||
        (i.storageLocation && i.storageLocation.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Aggregate stats from filtered items
  const totalStockItems = filteredItems.length;
  const lowStockCount = filteredItems.filter((i) => i.currentStock <= i.minStockThreshold).length;

  // Reset pagination on filter, search, or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, searchQuery, sortBy]);

  // Sorted and Paginated Inventory Items (Strictly 10 items per page)
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
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
  }, [filteredItems, sortBy]);

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
        if (
          (tx as any).status?.toUpperCase() === "CANCELLED" ||
          (tx as any).notes?.includes("[CANCELLED")
        ) {
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

  // Selected Day and Shift Accordion State for Hierarchical Production Batches View
  const [selectedBatchDay, setSelectedBatchDay] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [expandedMorningShift, setExpandedMorningShift] = useState(true);
  const [expandedNightShift, setExpandedNightShift] = useState(true);

  // Hierarchical Dispatches Grouped by Day and Shift
  const hierarchicalDispatchesByDay = useMemo(() => {
    const dayMap: Record<
      string,
      {
        dateKey: string;
        dateLabel: string;
        morning: Array<{
          kind: "RECIPE_BATCH" | "SINGLE_ITEM";
          referenceId: string;
          productName: string;
          batchSize?: string;
          quantity?: number;
          unit?: string;
          shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
          performedByName: string;
          recipient: string;
          timestamp: string;
          status: string;
          materials?: StockTransaction[];
          notes?: string;
          rawBatch?: any;
          tx?: StockTransaction;
        }>;
        night: Array<{
          kind: "RECIPE_BATCH" | "SINGLE_ITEM";
          referenceId: string;
          productName: string;
          batchSize?: string;
          quantity?: number;
          unit?: string;
          shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
          performedByName: string;
          recipient: string;
          timestamp: string;
          status: string;
          materials?: StockTransaction[];
          notes?: string;
          rawBatch?: any;
          tx?: StockTransaction;
        }>;
        totalCount: number;
      }
    > = {};

    const getDayKey = (isoStr: string) => {
      const d = new Date(isoStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    const formatDayLabel = (dateKey: string) => {
      const parts = dateKey.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const today = new Date();
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const isYesterday =
        d.getFullYear() === yesterday.getFullYear() &&
        d.getMonth() === yesterday.getMonth() &&
        d.getDate() === yesterday.getDate();

      const dateFormatted = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      if (isToday) return `Today (${dateFormatted})`;
      if (isYesterday) return `Yesterday (${dateFormatted})`;
      return dateFormatted;
    };

    const ensureDay = (key: string) => {
      if (!dayMap[key]) {
        dayMap[key] = {
          dateKey: key,
          dateLabel: formatDayLabel(key),
          morning: [],
          night: [],
          totalCount: 0,
        };
      }
      return dayMap[key];
    };

    // Ensure today's date exists so the dropdown always has Today
    const todayKey = getDayKey(new Date().toISOString());
    ensureDay(todayKey);

    // 1. Add grouped recipe batches
    productionBatches.forEach((batch) => {
      const dayKey = getDayKey(batch.timestamp);
      const dayObj = ensureDay(dayKey);
      const item = {
        kind: "RECIPE_BATCH" as const,
        referenceId: batch.batchReference,
        productName: batch.productName,
        batchSize: batch.batchSize,
        shiftType: (batch.shiftType as any) || "MORNING_SHIFT",
        performedByName: batch.performedByName,
        recipient: batch.recipient,
        timestamp: batch.timestamp,
        status: batch.status,
        materials: batch.materials,
        rawBatch: batch,
      };
      if (item.shiftType === "MORNING_SHIFT") {
        dayObj.morning.push(item);
      } else {
        dayObj.night.push(item);
      }
      dayObj.totalCount += 1;
    });

    // 2. Add singular direct dispatches
    individualDispenses.forEach((tx) => {
      const dayKey = getDayKey(tx.createdAt);
      const dayObj = ensureDay(dayKey);
      const item = {
        kind: "SINGLE_ITEM" as const,
        referenceId: tx.referenceId || `DISP-${tx.id.slice(0, 8)}`,
        productName: tx.itemName,
        quantity: Math.abs(Number(tx.quantity)),
        unit: tx.unit,
        shiftType: (tx.shiftType as any) || "MORNING_SHIFT",
        performedByName: tx.performedByName,
        recipient: tx.recipient || "Production Floor",
        timestamp: tx.createdAt,
        status: (tx as any).status || "PERMANENT",
        notes: (tx as any).notes,
        tx,
      };
      if (item.shiftType === "MORNING_SHIFT") {
        dayObj.morning.push(item);
      } else {
        dayObj.night.push(item);
      }
      dayObj.totalCount += 1;
    });

    // Sort batches/items inside each shift descending by timestamp
    Object.values(dayMap).forEach((day) => {
      day.morning.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      day.night.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    return dayMap;
  }, [productionBatches, individualDispenses]);

  const availableBatchDays = useMemo(() => {
    return Object.values(hierarchicalDispatchesByDay).sort(
      (a, b) => b.dateKey.localeCompare(a.dateKey)
    );
  }, [hierarchicalDispatchesByDay]);

  const currentDayBatches = useMemo(() => {
    return (
      hierarchicalDispatchesByDay[selectedBatchDay] ||
      availableBatchDays[0] || {
        dateKey: selectedBatchDay,
        dateLabel: selectedBatchDay,
        morning: [],
        night: [],
        totalCount: 0,
      }
    );
  }, [hierarchicalDispatchesByDay, selectedBatchDay, availableBatchDays]);

  // Filtered Recipes for Redesigned Recipe Catalog
  const filteredRecipes = useMemo(() => {
    const q = recipeSearchQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        r.ingredients.some(
          (ing) =>
            ing.itemName.toLowerCase().includes(q) ||
            ing.itemCode.toLowerCase().includes(q)
        )
    );
  }, [recipes, recipeSearchQuery]);

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

          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            title="Export Full Stock Period Statement (Custom Date Range)"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
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

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              <span>Current Production Shift</span>
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
              Dispensing for {activeShift === "MORNING_SHIFT" ? "08:00 – 18:00" : "18:00 – 08:00"}
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
          onClick={() => setActiveTab("daily-sheet")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "daily-sheet"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Daily Sheet</span>
          <span className="hidden sm:inline">Daily Shift Stock Sheet</span>
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
                        <div className="relative w-full aspect-square sm:aspect-auto sm:h-36 md:h-36 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 mb-2">
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
                                  {pkgDisplay.secondary && !item.isVariablePack && (
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingItem(item);
                            }}
                            title="Delete Material"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate leading-snug">{item.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                              {item.code}
                            </span>
                            {item.isVariablePack && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800">
                                Variable
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 truncate">
                              • {item.storageLocation || "Central Store"}
                            </span>
                          </div>
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
                          <div className="flex items-center justify-end gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setEditingItem(item)}
                              title="Edit Material"
                              className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingItem(item)}
                              title="Delete Material"
                              className="p-1 rounded-md bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
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
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Finished Product Recipes & Formulas
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#CF0458]/10 text-[#CF0458] border border-[#CF0458]/20">
                  {recipes.length} {recipes.length === 1 ? "formula" : "formulas"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure production BOM formulations, batch yield sizes, and dispense directly to kitchen floor.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Recipe Search Input */}
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={recipeSearchQuery}
                  onChange={(e) => setRecipeSearchQuery(e.target.value)}
                  placeholder="Search recipe or ingredient..."
                  className="w-full pl-8.5 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
                {recipeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setRecipeSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingRecipe(null);
                  setIsRecipeBuilderOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer self-stretch sm:self-auto shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Create Product Recipe</span>
              </button>
            </div>
          </div>

          {recipes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
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
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Recipe</span>
              </button>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Matching Recipes Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No formula matches &quot;{recipeSearchQuery}&quot;. Try searching by product name, SKU code, or ingredient.
              </p>
              <button
                type="button"
                onClick={() => setRecipeSearchQuery("")}
                className="mt-3 text-xs font-semibold text-[#CF0458] hover:underline cursor-pointer"
              >
                Clear search filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {filteredRecipes.map((r) => (
                <div
                  key={r.id}
                  className="group rounded-2xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Adaptive Image Presentation (Supports both vertical parfait cups & horizontal yoghurt containers) */}
                    {r.imageUrl ? (
                      <div className="relative w-full h-36 sm:h-40 md:h-44 bg-slate-900/5 overflow-hidden flex items-center justify-center border-b border-slate-100">
                        {/* Ambient blurred backdrop fills aspect ratio naturally */}
                        <img
                          src={r.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-30 select-none pointer-events-none"
                        />
                        {/* Centered true image with object-contain to preserve vertical parfait cup and horizontal tub */}
                        <img
                          src={r.imageUrl}
                          alt={r.name}
                          className="relative z-10 max-w-full max-h-full object-contain p-2.5 group-hover:scale-105 transition-transform duration-300"
                        />
                        {/* Floating glass badges */}
                        <div className="absolute top-2.5 left-2.5 z-20 bg-black/65 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shadow-xs">
                          {r.code}
                        </div>
                        <div className="absolute top-2.5 right-2.5 z-20 bg-white/95 backdrop-blur-md text-slate-900 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs flex items-center gap-1 border border-slate-200/60">
                          <Scale className="w-3 h-3 text-[#CF0458]" />
                          <span>Yield: {r.yieldQuantity} {r.yieldUnit}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#CF0458] shadow-2xs">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {r.code}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs flex items-center gap-1">
                          <Scale className="w-3 h-3 text-[#CF0458]" />
                          <span>Yield: {r.yieldQuantity} {r.yieldUnit}</span>
                        </span>
                      </div>
                    )}

                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-[#CF0458] transition-colors leading-snug">
                          {r.name}
                        </h3>
                      </div>
                      {r.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {r.description}
                        </p>
                      )}

                      {/* Formulation ingredients breakdown */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Batch Ingredients ({r.ingredients.length})
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">Standard BOM</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {r.ingredients.map((i) => (
                            <div
                              key={i.itemCode}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60 text-[11px]"
                            >
                              <span className="text-slate-700 font-medium truncate pr-1" title={i.itemName}>
                                {i.itemName}
                              </span>
                              <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px] shrink-0">
                                {i.quantityRequired} {i.uom}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDispenseInitialRecipeCode(r.code);
                        setIsDispenseOpen(true);
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
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
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Edit recipe formula"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRecipe(r)}
                      className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors flex items-center justify-center cursor-pointer"
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
      {activeTab === "movements" && (
        <div className="space-y-4">
          {/* Advanced Date & Material Filter Control Center */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Audit Timeframe & Movement Filters</span>
                    {movementLoading && (
                      <RefreshCw className="w-3.5 h-3.5 text-[#CF0458] animate-spin" />
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Query historical material movements, batch runs, and audit trails across any timeframe
                  </p>
                </div>
              </div>

              {(movementDatePreset !== "ALL" || movementItemFilter !== "ALL" || movementTypeFilter !== "ALL" || movementSearch || movementStartDate || movementEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setMovementDatePreset("ALL");
                    setMovementStartDate("");
                    setMovementEndDate("");
                    setMovementItemFilter("ALL");
                    setMovementTypeFilter("ALL");
                    setMovementSearch("");
                  }}
                  className="text-xs font-semibold text-[#CF0458] hover:text-[#B5034C] flex items-center gap-1 cursor-pointer self-start sm:self-auto px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset All Filters</span>
                </button>
              )}
            </div>

            {/* Date Range Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold uppercase tracking-wider text-slate-400">Date Range Preset</span>
                {movementDatePreset === "LAST_90_DAYS" && (
                  <span className="text-[#CF0458] font-bold">Showing 3 Months Historical Range</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: "ALL", label: "All Time" },
                  { id: "TODAY", label: "Today" },
                  { id: "YESTERDAY", label: "Yesterday" },
                  { id: "LAST_7_DAYS", label: "Last 7 Days" },
                  { id: "THIS_MONTH", label: "This Month" },
                  { id: "LAST_30_DAYS", label: "Last 30 Days" },
                  { id: "LAST_90_DAYS", label: "Last 90 Days (3 Months)" },
                  { id: "CUSTOM", label: "Custom Range..." },
                ].map((preset) => {
                  const isActive = movementDatePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setMovementDatePreset(preset.id as any);
                        if (preset.id !== "CUSTOM") {
                          setMovementStartDate("");
                          setMovementEndDate("");
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? "bg-slate-900 text-white shadow-xs font-bold"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Pickers (Shown if CUSTOM preset selected) */}
            {movementDatePreset === "CUSTOM" && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    From Date (Inclusive)
                  </label>
                  <input
                    type="date"
                    value={movementStartDate}
                    onChange={(e) => setMovementStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-[#CF0458]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    To Date (Inclusive)
                  </label>
                  <input
                    type="date"
                    value={movementEndDate}
                    onChange={(e) => setMovementEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-[#CF0458]"
                  />
                </div>
              </div>
            )}

            {/* Filter Dropdowns & Quick Search */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Material Dropdown */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Specific Material
                </label>
                <select
                  value={movementItemFilter}
                  onChange={(e) => setMovementItemFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-hidden focus:border-[#CF0458] cursor-pointer"
                >
                  <option value="ALL">All Materials ({items.length})</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Movement Type Dropdown */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Movement Type
                </label>
                <select
                  value={movementTypeFilter}
                  onChange={(e) => setMovementTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-semibold focus:outline-hidden focus:border-[#CF0458] cursor-pointer"
                >
                  <option value="ALL">All Movement Types</option>
                  <option value="INBOUND_PURCHASE">Incoming / Supplier Intake</option>
                  <option value="DISPENSE_PRODUCTION">Batch Dispenses (Recipes)</option>
                  <option value="DISPENSE_INDIVIDUAL">Direct Floor Requisitions</option>
                  <option value="RETURN_FAULT_REPLACE">Fault Defect Replacements</option>
                  <option value="RETURN_EXCESS_RESTOCK">Excess Restocks</option>
                  <option value="DISPOSAL_EXPIRED_SPOILT">Disposals / Spoilt</option>
                  <option value="RECONCILIATION_ADJUST">Reconciliation Adjustments</option>
                </select>
              </div>

              {/* Keyword Search Box */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Search Ref / Staff / Notes
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    placeholder="Batch code, staff name..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-hidden focus:border-[#CF0458] placeholder-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

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

          {/* VIEW 1: PRODUCTION BATCH RUNS (Hierarchical: Day Dropdown -> Morning/Night Shifts -> Recipes & Singular Items) */}
          {movementViewMode === "BATCHES" && (
            <div className="space-y-4">
              {/* Tier 1: Day Selector Bar */}
              <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#CF0458] flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        Production Day
                      </label>
                      <span className="text-xs font-bold text-slate-900 hidden sm:inline">
                        Select date to inspect shift dispatches:
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <select
                      value={selectedBatchDay}
                      onChange={(e) => setSelectedBatchDay(e.target.value)}
                      className="w-full sm:w-auto px-3 py-1.5 pr-8 rounded-lg border border-slate-300 text-xs font-bold bg-slate-50 text-slate-900 focus:outline-hidden focus:border-[#CF0458] cursor-pointer shadow-2xs"
                    >
                      {availableBatchDays.map((day) => (
                        <option key={day.dateKey} value={day.dateKey}>
                          {day.dateLabel} ({day.totalCount} {day.totalCount === 1 ? "dispatch" : "dispatches"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      ☀️ {currentDayBatches.morning.length} Morning
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                      🌙 {currentDayBatches.night.length} Night
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDispenseOpen(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Dispense Materials</span>
                  </button>
                </div>
              </div>

              {/* Tier 2: Shift Dropdowns / Accordions */}
              <div className="space-y-4">
                {/* ----------------- MORNING SHIFT SECTION ----------------- */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
                  {/* Morning Shift Accordion Header Bar */}
                  <button
                    type="button"
                    onClick={() => setExpandedMorningShift((prev) => !prev)}
                    className="w-full p-4 bg-amber-50/40 hover:bg-amber-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">Morning Shift</h4>
                          <span className="text-[11px] font-medium text-slate-500 font-mono">(08:00 – 18:00)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300">
                            {currentDayBatches.morning.length} {currentDayBatches.morning.length === 1 ? "Dispatch" : "Dispatches"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Morning shift concludes at 6:00 PM • Modifications permitted until 8:00 PM (2-hr handover grace)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-semibold text-slate-500">
                        {expandedMorningShift ? "Collapse Shift" : "Expand Shift"}
                      </span>
                      {expandedMorningShift ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* Morning Shift Dispatches Body */}
                  {expandedMorningShift && (
                    <div className="p-3 sm:p-4 space-y-3 bg-slate-50/30">
                      {currentDayBatches.morning.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-lg border border-dashed border-slate-200">
                          <Sun className="w-7 h-7 text-amber-300 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-slate-700">No Morning Shift Dispatches</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            No recipe batches or individual materials were dispensed during the morning shift on this day.
                          </p>
                        </div>
                      ) : (
                        currentDayBatches.morning.map((item) => {
                          const isBatch = item.kind === "RECIPE_BATCH";
                          const isExpanded = expandedBatchRef === item.referenceId;
                          const grace = getHandoverGraceDescription(item.timestamp, item.shiftType, item.status);

                          return (
                            <div
                              key={item.referenceId}
                              className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                            >
                              <div className="p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Kind Badge: Recipe Run vs Single Item */}
                                    {isBatch ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-[#CF0458] border border-rose-200 flex items-center gap-1">
                                        <Layers className="w-3 h-3" />
                                        Recipe Batch Run
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                        <Package className="w-3 h-3" />
                                        Single Material Dispatch
                                      </span>
                                    )}

                                    {/* Status / Grace Period Badge */}
                                    {item.status?.toUpperCase() === "CANCELLED" ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                        Cancelled
                                      </span>
                                    ) : grace.isEditable ? (
                                      <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs"
                                        title={`Cutoff: ${grace.cutoffFormatted}`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        {grace.badgeLabel}
                                      </span>
                                    ) : (
                                      <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center gap-1"
                                        title={`Cutoff: ${grace.cutoffFormatted}`}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {grace.badgeLabel}
                                      </span>
                                    )}

                                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                      Ref: {item.referenceId}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <h5 className="text-sm sm:text-base font-bold text-slate-900">
                                      {item.productName}
                                    </h5>
                                    {isBatch && item.batchSize && (
                                      <span className="text-xs font-semibold text-[#CF0458] bg-rose-50 px-2 py-0.5 rounded-full">
                                        Target: {item.batchSize}
                                      </span>
                                    )}
                                    {!isBatch && item.quantity !== undefined && (
                                      <span className="text-xs font-bold text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                        Qty: {item.quantity} {item.unit}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                    <span>Recipient: <strong className="text-slate-800">{item.recipient}</strong></span>
                                    <span>•</span>
                                    <span>Staff: <strong className="text-slate-800">{item.performedByName}</strong></span>
                                    {item.notes && (
                                      <>
                                        <span>•</span>
                                        <span className="italic text-slate-600 truncate max-w-xs">{item.notes}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                                  {grace.isEditable && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          isBatch
                                            ? handleOpenEditBatch(item.rawBatch)
                                            : handleOpenEditMovement(item.tx!)
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        title="Edit dispatch quantities during 2-hour grace period"
                                      >
                                        <Pencil className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={cancellingRef === item.referenceId}
                                        onClick={() => handleCancelDispatch(item.referenceId)}
                                        className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                                        title="Cancel provisional dispatch before handover cutoff"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                                        <span>{cancellingRef === item.referenceId ? "..." : "Cancel"}</span>
                                      </button>
                                    </>
                                  )}

                                  {isBatch && item.materials && item.materials.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedBatchRef(isExpanded ? null : item.referenceId)
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        isExpanded
                                          ? "bg-slate-100 text-slate-800 border border-slate-200"
                                          : "bg-slate-900 hover:bg-slate-800 text-white"
                                      }`}
                                    >
                                      <span>{isExpanded ? "Hide" : `Materials (${item.materials.length})`}</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}

                                  {isBatch && (
                                    <button
                                      type="button"
                                      onClick={() => setBatchDetailModal(item.rawBatch)}
                                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Print or view detailed requisition slip"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                      <span className="hidden sm:inline">Slip</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Materials Table / Mobile View for Batch */}
                              {isBatch && isExpanded && item.materials && (
                                <div className="bg-slate-50/70 p-3 sm:p-4 border-t border-slate-100">
                                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-[#CF0458]" />
                                      <span>Dispatched Materials Breakdown ({item.materials.length})</span>
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-500">
                                      Exact store deduction ledger
                                    </span>
                                  </div>

                                  {/* Desktop Table */}
                                  <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                        <tr>
                                          <th className="py-2.5 px-3">Ingredient / Material</th>
                                          <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                                          <th className="py-2.5 px-3">Deduction Type</th>
                                          <th className="py-2.5 px-3">Time</th>
                                          <th className="py-2.5 px-3">Formula / Proportion Note</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {item.materials.map((m) => (
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

                                  {/* Mobile Card List */}
                                  <div className="md:hidden space-y-2">
                                    {item.materials.map((m) => (
                                      <div key={m.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                                        <div>
                                          <div className="font-bold text-slate-900">{m.itemName}</div>
                                          <div className="text-[10px] text-slate-500 mt-0.5">{m.notes || "Standard BOM calculation"}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-mono font-bold text-[#CF0458]">-{m.quantity} {m.unit}</div>
                                          <div className="text-[10px] text-slate-400">
                                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* ----------------- NIGHT SHIFT SECTION ----------------- */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
                  {/* Night Shift Accordion Header Bar */}
                  <button
                    type="button"
                    onClick={() => setExpandedNightShift((prev) => !prev)}
                    className="w-full p-4 bg-indigo-50/40 hover:bg-indigo-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900">Night Shift</h4>
                          <span className="text-[11px] font-medium text-slate-500 font-mono">(18:00 – 08:00 next day)</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200/70 text-indigo-900 border border-indigo-300">
                            {currentDayBatches.night.length} {currentDayBatches.night.length === 1 ? "Dispatch" : "Dispatches"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Night shift concludes at 8:00 AM • Modifications permitted until 10:00 AM (2-hr handover grace)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-xs font-semibold text-slate-500">
                        {expandedNightShift ? "Collapse Shift" : "Expand Shift"}
                      </span>
                      {expandedNightShift ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* Night Shift Dispatches Body */}
                  {expandedNightShift && (
                    <div className="p-3 sm:p-4 space-y-3 bg-slate-50/30">
                      {currentDayBatches.night.length === 0 ? (
                        <div className="p-8 text-center bg-white rounded-lg border border-dashed border-slate-200">
                          <Moon className="w-7 h-7 text-indigo-300 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-slate-700">No Night Shift Dispatches</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            No recipe batches or individual materials were dispensed during the night shift on this day.
                          </p>
                        </div>
                      ) : (
                        currentDayBatches.night.map((item) => {
                          const isBatch = item.kind === "RECIPE_BATCH";
                          const isExpanded = expandedBatchRef === item.referenceId;
                          const grace = getHandoverGraceDescription(item.timestamp, item.shiftType, item.status);

                          return (
                            <div
                              key={item.referenceId}
                              className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                            >
                              <div className="p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Kind Badge: Recipe Run vs Single Item */}
                                    {isBatch ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-[#CF0458] border border-rose-200 flex items-center gap-1">
                                        <Layers className="w-3 h-3" />
                                        Recipe Batch Run
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                        <Package className="w-3 h-3" />
                                        Single Material Dispatch
                                      </span>
                                    )}

                                    {/* Status / Grace Period Badge */}
                                    {item.status?.toUpperCase() === "CANCELLED" ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                        Cancelled
                                      </span>
                                    ) : grace.isEditable ? (
                                      <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs"
                                        title={`Cutoff: ${grace.cutoffFormatted}`}
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        {grace.badgeLabel}
                                      </span>
                                    ) : (
                                      <span
                                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center gap-1"
                                        title={`Cutoff: ${grace.cutoffFormatted}`}
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {grace.badgeLabel}
                                      </span>
                                    )}

                                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                      Ref: {item.referenceId}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <h5 className="text-sm sm:text-base font-bold text-slate-900">
                                      {item.productName}
                                    </h5>
                                    {isBatch && item.batchSize && (
                                      <span className="text-xs font-semibold text-[#CF0458] bg-rose-50 px-2 py-0.5 rounded-full">
                                        Target: {item.batchSize}
                                      </span>
                                    )}
                                    {!isBatch && item.quantity !== undefined && (
                                      <span className="text-xs font-bold text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded">
                                        Qty: {item.quantity} {item.unit}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                    <span>Recipient: <strong className="text-slate-800">{item.recipient}</strong></span>
                                    <span>•</span>
                                    <span>Staff: <strong className="text-slate-800">{item.performedByName}</strong></span>
                                    {item.notes && (
                                      <>
                                        <span>•</span>
                                        <span className="italic text-slate-600 truncate max-w-xs">{item.notes}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                                  {grace.isEditable && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          isBatch
                                            ? handleOpenEditBatch(item.rawBatch)
                                            : handleOpenEditMovement(item.tx!)
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        title="Edit dispatch quantities during 2-hour grace period"
                                      >
                                        <Pencil className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={cancellingRef === item.referenceId}
                                        onClick={() => handleCancelDispatch(item.referenceId)}
                                        className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                                        title="Cancel provisional dispatch before handover cutoff"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5 text-red-600" />
                                        <span>{cancellingRef === item.referenceId ? "..." : "Cancel"}</span>
                                      </button>
                                    </>
                                  )}

                                  {isBatch && item.materials && item.materials.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedBatchRef(isExpanded ? null : item.referenceId)
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        isExpanded
                                          ? "bg-slate-100 text-slate-800 border border-slate-200"
                                          : "bg-slate-900 hover:bg-slate-800 text-white"
                                      }`}
                                    >
                                      <span>{isExpanded ? "Hide" : `Materials (${item.materials.length})`}</span>
                                      {isExpanded ? (
                                        <ChevronUp className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}

                                  {isBatch && (
                                    <button
                                      type="button"
                                      onClick={() => setBatchDetailModal(item.rawBatch)}
                                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                      title="Print or view detailed requisition slip"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                                      <span className="hidden sm:inline">Slip</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Materials Table / Mobile View for Batch */}
                              {isBatch && isExpanded && item.materials && (
                                <div className="bg-slate-50/70 p-3 sm:p-4 border-t border-slate-100">
                                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Package className="w-3.5 h-3.5 text-[#CF0458]" />
                                      <span>Dispatched Materials Breakdown ({item.materials.length})</span>
                                    </span>
                                    <span className="text-[10px] font-normal text-slate-500">
                                      Exact store deduction ledger
                                    </span>
                                  </div>

                                  {/* Desktop Table */}
                                  <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                        <tr>
                                          <th className="py-2.5 px-3">Ingredient / Material</th>
                                          <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                                          <th className="py-2.5 px-3">Deduction Type</th>
                                          <th className="py-2.5 px-3">Time</th>
                                          <th className="py-2.5 px-3">Formula / Proportion Note</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {item.materials.map((m) => (
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

                                  {/* Mobile Card List */}
                                  <div className="md:hidden space-y-2">
                                    {item.materials.map((m) => (
                                      <div key={m.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                                        <div>
                                          <div className="font-bold text-slate-900">{m.itemName}</div>
                                          <div className="text-[10px] text-slate-500 mt-0.5">{m.notes || "Standard BOM calculation"}</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-mono font-bold text-[#CF0458]">-{m.quantity} {m.unit}</div>
                                          <div className="text-[10px] text-slate-400">
                                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                            {tx.transactionType === "INBOUND_PURCHASE" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                                <span>Supplier Intake</span>
                              </span>
                            ) : tx.transactionType === "RETURN_EXCESS_RESTOCK" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                                <RotateCcw className="w-3 h-3 text-blue-600" />
                                <span>Excess Restock</span>
                              </span>
                            ) : tx.transactionType === "RETURN_FAULT_REPLACE" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                Fault Replace
                              </span>
                            ) : tx.transactionType === "DISPOSAL_EXPIRED_SPOILT" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Disposal / Spoilt
                              </span>
                            ) : tx.transactionType === "RECONCILIATION_ADJUST" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Reconciliation
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                {tx.transactionType.replace(/_/g, " ")}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {tx.status?.toUpperCase() === "PENDING_HANDOVER" && !tx.notes?.includes("[CANCELLED") ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                Provisional
                              </span>
                            ) : tx.status?.toUpperCase() === "CANCELLED" || tx.notes?.includes("[CANCELLED") ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                Cancelled
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                                Handed Over
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {tx.transactionType === "INBOUND_PURCHASE" || tx.transactionType === "RETURN_EXCESS_RESTOCK" ? (
                              <span className="text-emerald-600 font-bold">+{tx.quantity}</span>
                            ) : (
                              <span className="text-slate-900">{tx.quantity > 0 ? `-${tx.quantity}` : tx.quantity}</span>
                            )}{" "}
                            <span className="text-slate-400 font-normal text-[11px]">{tx.unit}</span>
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
      {/* TAB 4: DAILY SHIFT STOCK SHEET */}
      {/* ============================================================ */}
      {activeTab === "daily-sheet" && (
        <DailyShiftSheetView
          onOpenReconcile={() => setIsReconcileOpen(true)}
          activeShift={activeShift}
        />
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
                  Select Production Shift Dispensing For
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
                  placeholder="e.g. Store Manager on Duty"
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
        onDelete={() => {
          if (editingItem) {
            setDeletingItem(editingItem);
          }
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
        onDeleteItem={(item) => {
          setDeletingItem(item);
        }}
        onRefresh={loadData}
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

      {/* Edit Pending Shift Handover Modal */}
      {editingDispatch && (
        <EditPendingDispatchModal
          isOpen={true}
          onClose={() => setEditingDispatch(null)}
          referenceId={editingDispatch.referenceId}
          title={editingDispatch.title}
          recipient={editingDispatch.recipient}
          notes={editingDispatch.notes}
          items={editingDispatch.items}
          onSuccess={async () => {
            showToast(`Pending dispatch "${editingDispatch.referenceId}" updated successfully.`);
            await Promise.all([loadData(), loadMovements()]);
          }}
        />
      )}

      {/* Export Statement Modal */}
      <ExportStatementModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultShift={activeShift}
      />
    </div>
  );
}
