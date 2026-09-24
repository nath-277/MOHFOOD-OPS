"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { InventoryItem, ProductRecipe, StockTransaction } from "@/server/inventory/store";
import { formatPackagingDisplay } from "@/lib/packaging";
import { ItemDetailAuditModal } from "@/components/inventory/ItemDetailAuditModal";
import { ShiftDetailModal } from "@/components/inventory/ShiftDetailModal";
import { BatchDetailModal, ProductionBatchGroup } from "@/components/inventory/BatchDetailModal";
import { DailyShiftSheetView } from "@/components/inventory/DailyShiftSheetView";
import { SearchableProductSelect } from "@/components/ui/SearchableProductSelect";
import { ExportStatementModal } from "@/components/inventory/ExportStatementModal";
import { useShift, ShiftRecordItem } from "@/components/shift/ShiftContext";
import {
  getProductionDayKey,
  formatDayOrdinal,
  getHandoverGraceDescription,
} from "@/lib/shiftTiming";
import { cleanStaffName } from "@/lib/printUtils";
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import {
  Boxes,
  Search,
  X,
  Layers,
  Download,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Pencil,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Sun,
  Moon,
  Building,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  AlertCircle,
  LayoutGrid,
  List,
  Box,
  Scale,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Lock,
  Calendar,
} from "lucide-react";

export type ExecutiveStockSortOption =
  | "NAME_ASC"
  | "NAME_DESC"
  | "STOCK_DESC"
  | "STOCK_ASC"
  | "COST_DESC"
  | "COST_ASC"
  | "VALUE_DESC"
  | "VALUE_ASC"
  | "LOW_STOCK";

interface ExecutiveInventoryViewProps {
  onSwitchToFloorView?: () => void;
  canSwitchView?: boolean;
}

export function ExecutiveInventoryView({
  onSwitchToFloorView,
  canSwitchView = false,
}: ExecutiveInventoryViewProps) {
  // Tabs: "stock" | "sheet" | "recipes" | "history"
  const [activeTab, setActiveTab] = useState<"stock" | "sheet" | "recipes" | "history">("stock");

  // Product Recipes State (Observe Mode)
  const [recipes, setRecipes] = useState<ProductRecipe[]>([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [recipesLoading, setRecipesLoading] = useState(false);

  const fetchRecipes = useCallback(async () => {
    try {
      setRecipesLoading(true);
      const res = await fetch("/api/inventory/recipes");
      if (res.ok) {
        const d = await res.json();
        setRecipes(d.recipes || []);
      }
    } catch (err) {
      console.error("Failed to load recipes in executive view:", err);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "recipes") {
      fetchRecipes();
    }
  }, [activeTab, fetchRecipes]);

  const filteredExecutiveRecipes = useMemo(() => {
    const q = recipeSearchQuery.toLowerCase().trim();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.ingredients?.some((i) => i.itemName.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q))
    );
  }, [recipes, recipeSearchQuery]);

  // Live Shift Context & Audit State
  const {
    activeShift,
    activeShiftRecord,
    shiftStats,
    historicalShifts,
    loadingShifts,
    refreshShifts,
  } = useShift();
  const [selectedShiftDetail, setSelectedShiftDetail] = useState<ShiftRecordItem | null>(null);

  // Movements & Production Batches View State
  const [movementViewMode, setMovementViewMode] = useState<"BATCHES" | "LEDGER">("BATCHES");
  const [expandedBatchRef, setExpandedBatchRef] = useState<string | null>(null);
  const [batchDetailModal, setBatchDetailModal] = useState<ProductionBatchGroup | null>(null);

  // State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters for Stock & Sorting & Pagination
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState<"ALL" | "LOW_BUFFER" | "HEALTHY" | "OUT_OF_STOCK">("ALL");
  const [stockSortBy, setStockSortBy] = useState<ExecutiveStockSortOption>("NAME_ASC");
  const [stockCurrentPage, setStockCurrentPage] = useState<number>(1);
  const stockItemsPerPage = 10;
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);
  const [stockViewMode, setStockViewModeState] = useState<"list" | "grid">("list");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("moh_executive_stock_view");
      if (saved === "grid" || saved === "list") {
        setStockViewModeState(saved);
      } else if (window.innerWidth < 640) {
        setStockViewModeState("grid");
      }
    } catch {}
  }, []);

  const setStockViewMode = (mode: "list" | "grid") => {
    setStockViewModeState(mode);
    try {
      localStorage.setItem("moh_executive_stock_view", mode);
    } catch {}
  };

  // Stock Balance Display Preference: Packaging vs Base Units
  const [stockDisplayPref, setStockDisplayPref] = useState<"PACKAGES" | "BASE_UNITS">("PACKAGES");

  useEffect(() => {
    try {
      const savedPref = localStorage.getItem("moh_executive_stock_display_pref");
      if (savedPref === "PACKAGES" || savedPref === "BASE_UNITS") {
        setStockDisplayPref(savedPref);
      }
    } catch {}
  }, []);

  const handleSetStockDisplayPref = (pref: "PACKAGES" | "BASE_UNITS") => {
    setStockDisplayPref(pref);
    try {
      localStorage.setItem("moh_executive_stock_display_pref", pref);
    } catch {}
  };

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

  // Sync tab with URL hash if present & custom event
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (
        hash === "stock" ||
        hash === "sheet" ||
        hash === "recipes" ||
        hash === "history"
      ) {
        setActiveTab(hash as any);
      }
    };
    const handleTabEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (
        customEvent.detail === "stock" ||
        customEvent.detail === "sheet" ||
        customEvent.detail === "recipes" ||
        customEvent.detail === "history"
      ) {
        setActiveTab(customEvent.detail as any);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("executive-inventory:switch-tab", handleTabEvent);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("executive-inventory:switch-tab", handleTabEvent);
    };
  }, []);

  const loadMovements = useCallback(async () => {
    try {
      setMovementLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "250");

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
      console.error("Failed to load executive movements:", err);
    } finally {
      setMovementLoading(false);
    }
  }, [movementDatePreset, movementStartDate, movementEndDate, movementItemFilter, movementTypeFilter, movementSearch]);

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const itemsRes = await fetch(`/api/inventory/items`);
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setItems(d.items || []);
      }
      await loadMovements();
    } catch (err) {
      console.error("Failed to load executive inventory data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadMovements]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-run movement query when filters change
  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Aggregate Metrics
  const totalStockValuation = useMemo(() => {
    return items.reduce((acc, item) => acc + item.currentStock * item.costPerUnit, 0);
  }, [items]);

  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.currentStock <= i.minStockThreshold).length;
  }, [items]);

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCategory = stockCategory === "ALL" || item.category === stockCategory;
      const matchStatus =
        stockStatusFilter === "ALL" ||
        (stockStatusFilter === "LOW_BUFFER" && item.currentStock > 0 && item.currentStock <= item.minStockThreshold) ||
        (stockStatusFilter === "HEALTHY" && item.currentStock > item.minStockThreshold) ||
        (stockStatusFilter === "OUT_OF_STOCK" && item.currentStock <= 0);
      const q = stockSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.storageLocation.toLowerCase().includes(q);
      return matchCategory && matchStatus && matchSearch;
    });
  }, [items, stockCategory, stockStatusFilter, stockSearch]);

  // Reset pagination on filter, search, or sort change
  useEffect(() => {
    setStockCurrentPage(1);
  }, [stockCategory, stockStatusFilter, stockSearch, stockSortBy]);

  // Sorted and Paginated Stock Items (Strictly 10 items per page)
  const sortedStockItems = useMemo(() => {
    const list = [...filteredItems];
    switch (stockSortBy) {
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
      case "VALUE_DESC":
        return list.sort(
          (a, b) => b.currentStock * b.costPerUnit - a.currentStock * a.costPerUnit
        );
      case "VALUE_ASC":
        return list.sort(
          (a, b) => a.currentStock * a.costPerUnit - b.currentStock * b.costPerUnit
        );
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
  }, [filteredItems, stockSortBy]);

  const stockTotalPages = Math.ceil(sortedStockItems.length / stockItemsPerPage) || 1;

  const paginatedStockItems = useMemo(() => {
    const start = (stockCurrentPage - 1) * stockItemsPerPage;
    return sortedStockItems.slice(start, start + stockItemsPerPage);
  }, [sortedStockItems, stockCurrentPage, stockItemsPerPage]);

  const handleStockSortToggle = (field: "NAME" | "STOCK" | "COST" | "VALUE") => {
    if (field === "NAME") {
      setStockSortBy((prev) => (prev === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC"));
    } else if (field === "STOCK") {
      setStockSortBy((prev) => (prev === "STOCK_DESC" ? "STOCK_ASC" : "STOCK_DESC"));
    } else if (field === "COST") {
      setStockSortBy((prev) => (prev === "COST_DESC" ? "COST_ASC" : "COST_DESC"));
    } else if (field === "VALUE") {
      setStockSortBy((prev) => (prev === "VALUE_DESC" ? "VALUE_ASC" : "VALUE_DESC"));
    }
  };

  // Movements are filtered directly on the backend via loadMovements
  const filteredTransactions = transactions;

  // Grouped Production Batches (Recipe Dispatches)
  const productionBatches = useMemo<ProductionBatchGroup[]>(() => {
    const groups: Record<string, ProductionBatchGroup> = {};

    transactions
      .filter((tx) => tx.transactionType === "DISPENSE_PRODUCTION" && tx.referenceId)
      .forEach((tx) => {
        const ref = tx.referenceId!;
        if (!groups[ref]) {
          groups[ref] = {
            batchReference: ref,
            productName: "Production Batch Run",
            batchSize: "Batch Run",
            shiftType: tx.shiftType,
            performedByName: tx.performedByName,
            recipient: tx.recipient || "Production Floor",
            timestamp: tx.createdAt,
            materials: [],
          };
        }
        groups[ref].materials.push(tx);
      });

    const groupedList = Object.values(groups);
    for (const grp of groupedList) {
      const recipeTx = grp.materials.find((m) => m.notes && /Dispensed for /i.test(m.notes));
      if (recipeTx) {
        const match = recipeTx.notes?.match(/Dispensed for (\d+x?)\s+([^.]+)/i);
        if (match) {
          grp.batchSize = match[1];
          grp.productName = match[2].trim();
        } else if (recipeTx.notes && /^Dispensed for /i.test(recipeTx.notes)) {
          grp.productName = recipeTx.notes.replace(/^Dispensed for\s+/i, "").split(".")[0].trim();
        }
      } else if (grp.materials[0]?.itemName) {
        grp.productName = grp.materials[0].itemName;
      }
    }

    return groupedList.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [transactions]);

  // Individual Direct Dispatches (Ad-Hoc / Single Materials)
  const individualDispenses = useMemo(() => {
    return transactions.filter((tx) => tx.transactionType === "DISPENSE_INDIVIDUAL");
  }, [transactions]);

  // Hierarchical Dispatches Grouped by Day and Shift (Max 1 Month, Paginated 10 Days)
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
          status?: string;
          notes?: string;
          materials?: StockTransaction[];
          rawBatch?: ProductionBatchGroup;
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
          status?: string;
          notes?: string;
          materials?: StockTransaction[];
          rawBatch?: ProductionBatchGroup;
          tx?: StockTransaction;
        }>;
        totalCount: number;
      }
    > = {};

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

    // Ensure today's date exists so the feed has current day
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    ensureDay(todayKey);

    // 1. Add grouped recipe batches
    productionBatches.forEach((batch) => {
      const dayKey = getProductionDayKey(batch.timestamp, batch.shiftType);
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
      const dayKey = getProductionDayKey(tx.createdAt, tx.shiftType);
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

  // Production days restricted to up to 1 month (past 30 days)
  const availableBatchDays = useMemo(() => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    const minDateKey = `${oneMonthAgo.getFullYear()}-${String(oneMonthAgo.getMonth() + 1).padStart(2, "0")}-${String(oneMonthAgo.getDate()).padStart(2, "0")}`;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    return Object.values(hierarchicalDispatchesByDay)
      .filter((day) => day.dateKey >= minDateKey && (day.totalCount > 0 || day.dateKey === todayKey))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [hierarchicalDispatchesByDay]);

  // 10-day Pagination State for Production Movements
  const [movementDayPage, setMovementDayPage] = useState(1);
  const DAYS_PER_PAGE = 10;
  const totalDayPages = Math.max(1, Math.ceil(availableBatchDays.length / DAYS_PER_PAGE));

  const paginatedDays = useMemo(() => {
    const start = (movementDayPage - 1) * DAYS_PER_PAGE;
    return availableBatchDays.slice(start, start + DAYS_PER_PAGE);
  }, [availableBatchDays, movementDayPage]);

  // Reset page when filter controls change
  useEffect(() => {
    setMovementDayPage(1);
  }, [movementDatePreset, movementStartDate, movementEndDate, movementItemFilter, movementTypeFilter, movementSearch]);

  // Collapsed by default states
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const toggleDayCollapse = (dateKey: string) => {
    setCollapsedDays((prev) => ({
      ...prev,
      [dateKey]: prev[dateKey] === false ? true : false,
    }));
  };

  const [collapsedShifts, setCollapsedShifts] = useState<Record<string, boolean>>({});
  const toggleShiftCollapse = (shiftKey: string) => {
    setCollapsedShifts((prev) => ({
      ...prev,
      [shiftKey]: prev[shiftKey] === false ? true : false,
    }));
  };

  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const toggleBatchExpand = (refId: string) => {
    setExpandedBatches((prev) => ({ ...prev, [refId]: !prev[refId] }));
  };

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // PWA Back Gesture Handling for Open Modals
  const hasAnyModalOpen = Boolean(
    batchDetailModal ||
    selectedShiftDetail ||
    selectedItemDetail ||
    isExportModalOpen
  );

  const closeTopModal = useCallback(() => {
    if (batchDetailModal) { setBatchDetailModal(null); return; }
    if (selectedShiftDetail) { setSelectedShiftDetail(null); return; }
    if (selectedItemDetail) { setSelectedItemDetail(null); return; }
    if (isExportModalOpen) { setIsExportModalOpen(false); return; }
  }, [batchDetailModal, selectedShiftDetail, selectedItemDetail, isExportModalOpen]);

  useModalBackHandler(hasAnyModalOpen, closeTopModal);

  // Sync activeTab with URL hash for seamless PWA / Android back gesture navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "stock" || hash === "sheet" || hash === "recipes" || hash === "history") {
        setActiveTab(hash as any);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const handleTabChange = (newTab: "stock" | "sheet" | "recipes" | "history") => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      window.location.hash = newTab;
    }
  };

  const isTodayKey = (dateKey: string) => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return dateKey === todayKey;
  };

  const isYesterdayKey = (dateKey: string) => {
    const today = new Date();
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    return dateKey === yKey;
  };

  const formatTxnType = (type: string) => {
    switch (type) {
      case "DISPENSE_PRODUCTION":
        return { label: "Batch Dispense", color: "text-[#CF0458] bg-rose-50 border-rose-200" };
      case "DISPENSE_INDIVIDUAL":
        return { label: "Direct Requisition", color: "text-slate-700 bg-slate-100 border-slate-200" };
      case "INBOUND_PURCHASE":
        return { label: "Supplier Intake", color: "text-[#059669] bg-emerald-50 border-emerald-200" };
      case "RETURN_FAULT_REPLACE":
        return { label: "Fault Defect Replace", color: "text-orange-700 bg-orange-50 border-orange-200" };
      case "RETURN_EXCESS_RESTOCK":
        return { label: "Excess Restocked", color: "text-blue-700 bg-blue-50 border-blue-200" };
      case "DISPOSAL_EXPIRED_SPOILT":
        return { label: "Disposal / Spoilt", color: "text-rose-700 bg-rose-50 border-rose-200" };
      case "RECONCILIATION_ADJUST":
        return { label: "Shift Variance", color: "text-amber-700 bg-amber-50 border-amber-200" };
      default:
        return { label: type.replace(/_/g, " "), color: "text-slate-700 bg-slate-100 border-slate-200" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Executive Inventory & Audit
            </span>
            <span className="text-xs font-semibold text-slate-400">
              Stock Oversight & Return Root Cause Analysis
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Store Stock & Returns Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit store material balances, examine product transaction histories, and analyze returns & root causes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canSwitchView && onSwitchToFloorView && (
            <button
              type="button"
              onClick={onSwitchToFloorView}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-slate-600" />
              <span>Switch to Store Floor Terminal</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards - 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Total Stock Valuation
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              ₦ {totalStockValuation.toLocaleString()}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              Live warehouse holding
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Tracked Materials
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 font-mono truncate">
              {items.length} <span className="text-xs font-normal text-slate-500">Items</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {lowStockCount > 0 ? (
                <span className="text-[#CF0458] font-bold">{lowStockCount} low buffer</span>
              ) : (
                <span className="text-[#059669]">Buffers healthy</span>
              )}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Buffer Warnings
            </div>
            <div className={`text-base sm:text-2xl font-bold mt-0.5 sm:mt-1 font-mono truncate ${
              lowStockCount > 0 ? "text-[#CF0458]" : "text-slate-900"
            }`}>
              {lowStockCount} <span className="text-xs font-normal text-slate-500">SKUs</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {lowStockCount > 0 ? "Requires reorder replenishment" : "All material buffers healthy"}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-amber-600 flex items-center justify-center shrink-0 ml-2">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Live Shift Custody
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#059669] mt-0.5 sm:mt-1 font-mono truncate">
              {activeShift === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              {activeShiftRecord?.openedByName ? `Officer: ${activeShiftRecord.openedByName}` : `${historicalShifts.length} Certified Handovers`}
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-[#059669] flex items-center justify-center shrink-0 ml-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar: 1. Check Stock, 2. Product History, 3. Reconciliation Log */}
      <div className="flex items-center space-x-1 sm:space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar flex-nowrap shrink-0 pb-1 w-full max-w-full min-w-0">
        <button
          type="button"
          onClick={() => handleTabChange("stock")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "stock"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Boxes className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Stock</span>
          <span className="hidden sm:inline">Check Stock</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("sheet")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "sheet"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Stock Sheet</span>
          <span className="hidden sm:inline">Daily Shift Stock Sheet</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("recipes")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "recipes"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Recipes</span>
          <span className="hidden sm:inline">Product Recipes (BOM)</span>
          {recipes.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
              {recipes.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("history")}
          className={`flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
            activeTab === "history"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">History</span>
          <span className="hidden sm:inline">Product Movement History</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {transactions.length}
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: CHECK STOCK */}
      {/* ============================================================ */}
      {activeTab === "stock" && (
        <div className="space-y-4 max-w-full min-w-0">
          {/* Filter Bar */}
          <div className="p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col gap-3 max-w-full">
            {/* Row 0: Stock Status Quick Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full min-w-0 shrink-0 pb-1 border-b border-slate-100">
              {[
                { id: "ALL", label: `All Materials (${items.length})`, mobileLabel: `All (${items.length})` },
                { id: "LOW_BUFFER", label: `Low Buffer Warnings (${lowStockCount})`, mobileLabel: `Low Buffer (${lowStockCount})` },
                { id: "HEALTHY", label: `Healthy Stock (${items.filter((i) => i.currentStock > i.minStockThreshold).length})`, mobileLabel: "Healthy" },
                { id: "OUT_OF_STOCK", label: `Out of Stock (${items.filter((i) => i.currentStock <= 0).length})`, mobileLabel: "Out" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStockStatusFilter(pill.id as any)}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    stockStatusFilter === pill.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span className="sm:hidden">{pill.mobileLabel}</span>
                  <span className="hidden sm:inline">{pill.label}</span>
                </button>
              ))}
            </div>

            {/* Row 1: Category Filter Pills & Search Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full min-w-0 shrink-0 pb-1 sm:pb-0">
                {[
                  { id: "ALL", label: "All Categories", mobileLabel: "All" },
                  { id: "PERISHABLE_MEASURED", label: "Measured (kg/l)", mobileLabel: "Measured (kg/l)" },
                  { id: "PERISHABLE_NUMBERED", label: "Numbered (pcs)", mobileLabel: "Counted (pcs)" },
                  { id: "PACKAGING_NON_PERISHABLE", label: "Packaging", mobileLabel: "Packaging" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStockCategory(tab.id)}
                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      stockCategory === tab.id
                        ? "bg-[#CF0458] text-white shadow-xs"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                    }`}
                  >
                    <span className="sm:hidden">{tab.mobileLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-72 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Search material name, code, location..."
                  className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
                {stockSearch && (
                  <button
                    type="button"
                    onClick={() => setStockSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Sort Selector, Packaging Unit Switcher & View Toggle Switcher */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap sm:flex-nowrap">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex-1 sm:flex-initial min-w-0">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Sort:</span>
                <select
                  value={stockSortBy}
                  onChange={(e) => setStockSortBy(e.target.value as ExecutiveStockSortOption)}
                  className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer w-full truncate"
                >
                  <option value="NAME_ASC">Name (A → Z)</option>
                  <option value="NAME_DESC">Name (Z → A)</option>
                  <option value="STOCK_DESC">Stock: High to Low</option>
                  <option value="STOCK_ASC">Stock: Low to High</option>
                  <option value="COST_DESC">Unit Cost: High to Low</option>
                  <option value="COST_ASC">Unit Cost: Low to High</option>
                  <option value="VALUE_DESC">Valuation: High to Low</option>
                  <option value="VALUE_ASC">Valuation: Low to High</option>
                  <option value="LOW_STOCK">Low Stock Alert First</option>
                </select>
              </div>

              {/* Display & View Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Unit Display Preference Switcher */}
                <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("PACKAGES")}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "PACKAGES"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Display stock in packaged units (cartons/packs)"
                  >
                    <Box className="w-3 h-3 shrink-0" />
                    <span>Packs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStockDisplayPref("BASE_UNITS")}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      stockDisplayPref === "BASE_UNITS"
                        ? "bg-white text-[#CF0458] shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Display stock in base units"
                  >
                    <Scale className="w-3 h-3 shrink-0" />
                    <span>Units</span>
                  </button>
                </div>

                {/* View Toggle Switcher */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setStockViewMode("list")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      stockViewMode === "list"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="List / Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="text-[11px]">List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockViewMode("grid")}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      stockViewMode === "grid"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Grid</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Grid View Mode */}
          {stockViewMode === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
              {loading ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                  <span className="text-xs">Loading live inventory...</span>
                </div>
              ) : sortedStockItems.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-600">No materials found.</span>
                </div>
              ) : (
                paginatedStockItems.map((item) => {
                  const isCritical = item.currentStock <= 0;
                  const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                  const holdingValue = item.currentStock * item.costPerUnit;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemDetail(item)}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-300 active:scale-[0.99] transition-all"
                    >
                      <div>
                        <div className="relative w-full aspect-square sm:aspect-auto sm:h-36 md:h-36 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 mb-2.5">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Boxes className="w-8 h-8" />
                            </div>
                          )}
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/60 text-white backdrop-blur-xs">
                            {item.code}
                          </span>
                          {item.isVariablePack && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/90 text-white backdrop-blur-xs shadow-xs">
                              Variable
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] leading-snug">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {item.storageLocation || "Central Store"}
                        </p>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        {(() => {
                          const pkg = formatPackagingDisplay(item.currentStock, item);
                          const hasPkg = pkg.type !== "DIRECT";

                          if (item.isVariablePack || (stockDisplayPref === "PACKAGES" && hasPkg)) {
                            return (
                              <div className="flex items-baseline justify-between">
                                <span className="text-[10px] text-slate-400 font-semibold">Stock:</span>
                                <div className="text-right">
                                  <div className="font-mono font-extrabold text-sm sm:text-base text-slate-900">
                                    {pkg.primary}
                                  </div>
                                  {pkg.secondary && !item.isVariablePack && (
                                    <div className="text-[10px] font-normal text-amber-700 font-sans">
                                      {pkg.secondary}
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
                                <div className="font-mono font-extrabold text-sm sm:text-base text-slate-900">
                                  {item.currentStock.toLocaleString(undefined, {
                                    minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                                  })}{" "}
                                  <span className="text-[10px] font-normal text-slate-500">{item.uom}</span>
                                </div>
                                {hasPkg && (
                                  <div className="text-[10px] font-normal text-slate-500 font-sans">
                                    ≈ {pkg.primary}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span>Holding:</span>
                          <span className="font-mono font-semibold text-slate-700">
                            ₦{holdingValue.toLocaleString()}
                          </span>
                        </div>

                        {isCritical ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200 truncate">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Out of Stock</span>
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-md border border-[#D97706]/20 truncate">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span>Low Stock ({item.minStockThreshold})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md border border-[#059669]/20">
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                            <span>Healthy</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* List / Table View Mode */}
          {stockViewMode === "list" && (
            <div>
              {/* Mobile List View (< sm) */}
              <div className="sm:hidden space-y-2">
                {loading ? (
                  <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                    <span className="text-xs">Loading live inventory balances...</span>
                  </div>
                ) : sortedStockItems.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs font-semibold text-slate-600">No materials found matching search criteria.</span>
                  </div>
                ) : (
                  paginatedStockItems.map((item) => {
                    const isCritical = item.currentStock <= 0;
                    const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                    const holdingValue = item.currentStock * item.costPerUnit;
                    const pkg = formatPackagingDisplay(item.currentStock, item);

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItemDetail(item)}
                        className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center gap-3 cursor-pointer hover:border-[#CF0458]/40 active:scale-[0.99] transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Boxes className="w-6 h-6" />
                            </div>
                          )}
                        </div>

                        {/* Middle: Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate leading-snug">{item.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                              {item.code}
                            </span>
                            {item.isVariablePack && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Variable
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              ₦{holdingValue.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate">
                              • {item.storageLocation || "Central Store"}
                            </span>
                          </div>
                        </div>

                        {/* Right: Stock & Status */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-extrabold text-sm text-slate-900">
                            {(() => {
                              const hasPkg = pkg.type !== "DIRECT";
                              if (item.isVariablePack || (stockDisplayPref === "PACKAGES" && hasPkg)) {
                                return pkg.primary;
                              }
                              return `${item.currentStock.toLocaleString(undefined, {
                                minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                              })} ${item.uom}`;
                            })()}
                          </div>
                          {(() => {
                            const hasPkg = pkg.type !== "DIRECT";
                            if (item.isVariablePack && pkg.secondary) {
                              return (
                                <div className="text-[10px] text-amber-700 font-sans">
                                  {pkg.secondary}
                                </div>
                              );
                            }
                            if (stockDisplayPref === "PACKAGES" && hasPkg && pkg.secondary) {
                              return (
                                <div className="text-[10px] text-slate-400 font-sans">
                                  {pkg.secondary}
                                </div>
                              );
                            }
                            if (stockDisplayPref === "BASE_UNITS" && hasPkg) {
                              return (
                                <div className="text-[10px] text-slate-400 font-sans">
                                  ≈ {pkg.primary}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div className="mt-0.5">
                            {isCritical ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                <span>Out of Stock</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-md border border-[#D97706]/20">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                <span>Low Buffer</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#059669] bg-[#ECFDF5] px-1.5 py-0.5 rounded-md border border-[#059669]/20">
                                <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                <span>Healthy</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table View (>= sm) */}
              <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[650px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th
                        className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("NAME")}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Material / Item</span>
                          {stockSortBy === "NAME_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "NAME_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "NAME_ASC" && stockSortBy !== "NAME_DESC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-3">Storage Location</th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("STOCK")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Available Stock</span>
                          {stockSortBy === "STOCK_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "STOCK_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "STOCK_DESC" && stockSortBy !== "STOCK_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th className="py-3 px-3 text-right">Safety Threshold</th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("COST")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Unit Cost</span>
                          {stockSortBy === "COST_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "COST_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "COST_DESC" && stockSortBy !== "COST_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleStockSortToggle("VALUE")}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <span>Holding Value</span>
                          {stockSortBy === "VALUE_DESC" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy === "VALUE_ASC" && <ArrowUp className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "VALUE_DESC" && stockSortBy !== "VALUE_ASC" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                      <th
                        className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() =>
                          setStockSortBy((prev) => (prev === "LOW_STOCK" ? "NAME_ASC" : "LOW_STOCK"))
                        }
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Status</span>
                          {stockSortBy === "LOW_STOCK" && <ArrowDown className="w-3 h-3 text-[#CF0458]" />}
                          {stockSortBy !== "LOW_STOCK" && (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                          Loading live inventory balances...
                        </td>
                      </tr>
                    ) : sortedStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          No materials found matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      paginatedStockItems.map((item) => {
                        const isCritical = item.currentStock <= 0;
                        const isLow = item.currentStock <= item.minStockThreshold && item.currentStock > 0;
                        const holdingValue = item.currentStock * item.costPerUnit;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                            onClick={() => setSelectedItemDetail(item)}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden relative shrink-0 flex items-center justify-center">
                                  {item.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.imageUrl}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Boxes className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{item.name}</span>
                                    {item.isVariablePack && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        Variable
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400">{item.code}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] font-medium text-slate-600">
                                {item.category === "PERISHABLE_MEASURED"
                                  ? "Measured Raw"
                                  : item.category === "PERISHABLE_NUMBERED"
                                  ? "Numbered Raw"
                                  : "Packaging"}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                              {item.storageLocation}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {(() => {
                                const pkg = formatPackagingDisplay(item.currentStock, item);
                                const hasPkg = pkg.type !== "DIRECT";

                                if (item.isVariablePack || (stockDisplayPref === "PACKAGES" && hasPkg)) {
                                  return (
                                    <div>
                                      <div className="font-mono font-bold text-slate-900 text-xs">
                                        {pkg.primary}
                                      </div>
                                      {pkg.secondary && (
                                        <div className="text-[10px] text-amber-700 font-normal font-sans">
                                          {pkg.secondary}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div>
                                    <div className="font-mono font-bold text-slate-900 text-xs">
                                      {item.currentStock.toLocaleString()}{" "}
                                      <span className="text-[10px] font-normal text-slate-500 font-sans">{item.uom}</span>
                                    </div>
                                    {hasPkg && (
                                      <div className="text-[10px] text-slate-400 font-normal font-sans">
                                        ≈ {pkg.primary}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-500">
                              {item.minStockThreshold} {item.uom}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              <div className="flex items-center justify-end gap-1.5 group">
                                <span>₦ {item.costPerUnit.toLocaleString()}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemDetail(item);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-[#CF0458] transition-opacity cursor-pointer"
                                  title="Edit unit cost"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              ₦ {holdingValue.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isCritical ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-700 bg-red-50 border border-red-200">
                                  Stock Out
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#D97706] bg-[#FFFBEB] border border-[#D97706]/20">
                                  Low Buffer
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold text-[#059669] bg-[#ECFDF5] border border-[#059669]/20">
                                  Healthy
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
        )}

          {/* 10-Item Pagination & Status Bar */}
          {!loading && sortedStockItems.length > 0 && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full max-w-full min-w-0">
              <div className="text-slate-500 font-medium text-center sm:text-left">
                Showing <span className="font-bold text-slate-800">{Math.min((stockCurrentPage - 1) * stockItemsPerPage + 1, sortedStockItems.length)}</span>–
                <span className="font-bold text-slate-800">{Math.min(stockCurrentPage * stockItemsPerPage, sortedStockItems.length)}</span> of{" "}
                <span className="font-bold text-slate-800">{sortedStockItems.length}</span> materials
                {stockTotalPages > 1 && (
                  <span className="ml-1 text-slate-400 font-normal">
                    (Page {stockCurrentPage} of {stockTotalPages})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={loadData}
                  className="text-xs text-slate-500 hover:text-[#CF0458] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  title="Refresh stock balances"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {stockTotalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStockCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={stockCurrentPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 transition-all"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: stockTotalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          stockTotalPages > 7 &&
                          page !== 1 &&
                          page !== stockTotalPages &&
                          Math.abs(page - stockCurrentPage) > 1
                        ) {
                          if (page === 2 || page === stockTotalPages - 1) {
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
                            onClick={() => setStockCurrentPage(page)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              stockCurrentPage === page
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
                      onClick={() => setStockCurrentPage((p) => Math.min(stockTotalPages, p + 1))}
                      disabled={stockCurrentPage === stockTotalPages}
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
      {/* TAB: DAILY SHIFT STOCK SHEET (READ-ONLY AUDIT)              */}
      {/* ============================================================ */}
      {activeTab === "sheet" && (
        <div className="space-y-4">
          <DailyShiftSheetView readOnly={true} activeShift={activeShift} />
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: PRODUCT RECIPES BOM (READ-ONLY OBSERVE MODE)            */}
      {/* ============================================================ */}
      {activeTab === "recipes" && (
        <div className="space-y-4">
          {/* Header & Search Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Product Recipes & Formulation BOM
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-[#CF0458]" />
                  <span>Observe Mode (Read-Only)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Observe finished product bill of materials, ingredient ratios, and standard batch yields. Formulations cannot be modified in observe mode.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
                onClick={fetchRecipes}
                disabled={recipesLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recipesLoading ? "animate-spin text-[#CF0458]" : "text-slate-600"}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {recipesLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#CF0458] mb-2" />
              <p className="text-xs font-medium text-slate-500">Loading recipe formulations...</p>
            </div>
          ) : recipes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Product Recipes Available</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No active product formulations have been registered in the system yet.
              </p>
            </div>
          ) : filteredExecutiveRecipes.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Matching Formulas Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No formula matches &quot;{recipeSearchQuery}&quot;.
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
              {filteredExecutiveRecipes.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {r.imageUrl ? (
                      <div className="relative w-full h-36 sm:h-40 md:h-44 bg-slate-900/5 overflow-hidden flex items-center justify-center border-b border-slate-100">
                        <img
                          src={r.imageUrl}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-30 select-none pointer-events-none"
                        />
                        <img
                          src={r.imageUrl}
                          alt={r.name}
                          className="relative z-10 max-w-full max-h-full object-contain p-2.5"
                        />
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
                      <h3 className="text-base font-bold text-slate-900 leading-snug">
                        {r.name}
                      </h3>
                      {r.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {r.description}
                        </p>
                      )}

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

                  <div className="p-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">Observation Status:</span>
                    <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Observe Mode</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: PRODUCT MOVEMENT HISTORY & BATCH LEDGER */}
      {/* ============================================================ */}
      {activeTab === "history" && (
        <div className="space-y-4 max-w-full min-w-0">
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

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Export CSV</span>
                </button>

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
                    className="text-xs font-semibold text-[#CF0458] hover:text-[#B5034C] flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>
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
                <SearchableProductSelect
                  items={items}
                  value={movementItemFilter}
                  valueKey="id"
                  allowAll={true}
                  allLabel="All Materials"
                  allValue="ALL"
                  onChange={(id) => setMovementItemFilter(id)}
                  placeholder="Filter by material..."
                />
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
                  {movementSearch && (
                    <button
                      type="button"
                      onClick={() => setMovementSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
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
              <span>
                Shift:{" "}
                <strong className="text-slate-800">
                  {activeShift === "MORNING_SHIFT" ? "Morning" : "Night"}
                </strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>{transactions.length} movements tracked</span>
            </div>
          </div>

          {/* VIEW 1: PRODUCTION BATCH RUNS */}
          {movementViewMode === "BATCHES" && (
            <div className="space-y-4">
              {paginatedDays.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 shadow-xs">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-[#CF0458] flex items-center justify-center mx-auto mb-3">
                    <Boxes className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    No Production Batches or Dispatches Found
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    No dispatches match the selected date filters. Expand your timeframe or clear filters above to inspect historical production runs.
                  </p>
                </div>
              ) : (
                paginatedDays.map((day) => {
                  const isDayCollapsed = collapsedDays[day.dateKey] !== false;
                  const isToday = isTodayKey(day.dateKey);
                  const isYesterday = isYesterdayKey(day.dateKey);
                  const morningShiftKey = `${day.dateKey}-morning`;
                  const nightShiftKey = `${day.dateKey}-night`;
                  const isMorningCollapsed = collapsedShifts[morningShiftKey] !== false;
                  const isNightCollapsed = collapsedShifts[nightShiftKey] !== false;

                  const renderDispatchItem = (item: typeof day.morning[0]) => {
                    const isBatch = item.kind === "RECIPE_BATCH";
                    const isExpanded = !!expandedBatches[item.referenceId];
                    const grace = getHandoverGraceDescription(item.timestamp, item.shiftType, item.status);

                    return (
                      <div
                        key={item.referenceId}
                        className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                      >
                        {/* Mobile View (< sm): Clean, Calm, Decluttered */}
                        <div className="sm:hidden p-3.5 space-y-2.5">
                          {/* Row 1: Ref, Time & Status */}
                          <div className="flex items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                {item.referenceId}
                              </span>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {item.status?.toUpperCase() === "CANCELLED" && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200 shrink-0">
                                Cancelled
                              </span>
                            )}
                          </div>

                          {/* Row 2: Product Name & Target / Qty */}
                          <div className="flex items-baseline justify-between gap-2">
                            <h5 className="text-sm font-bold text-slate-900 leading-tight">
                              {item.productName}
                            </h5>
                            {isBatch && item.batchSize && (
                              <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                                Target: {item.batchSize}
                              </span>
                            )}
                            {!isBatch && item.quantity !== undefined && (
                              <span className="text-xs font-bold text-slate-700 font-mono bg-slate-100 px-2 py-0.5 rounded shrink-0 whitespace-nowrap">
                                {item.quantity} {item.unit}
                              </span>
                            )}
                          </div>

                          {/* Row 3: Staff details cleanly formatted */}
                          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
                            <span>
                              Issued To: <strong className="text-slate-700 font-medium">{cleanStaffName(item.recipient, "Floor")}</strong>
                            </span>
                            <span>
                              Store: <strong className="text-slate-700 font-medium">{cleanStaffName(item.performedByName, "Store Staff")}</strong>
                            </span>
                          </div>
                          {item.notes && (
                            <div className="text-[10px] text-slate-400 italic truncate">
                              {item.notes}
                            </div>
                          )}

                          {/* Row 4: Action Buttons (Calm, Unified) */}
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                            {isBatch && item.materials && item.materials.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleBatchExpand(item.referenceId)}
                                className="flex-1 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <span>{isExpanded ? "Hide Materials" : `Materials (${item.materials.length})`}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (isBatch && item.rawBatch) {
                                  setBatchDetailModal(item.rawBatch);
                                } else {
                                  setBatchDetailModal({
                                    batchReference: item.referenceId,
                                    productName: item.productName,
                                    batchSize: `${item.quantity || 1} ${item.unit || "Unit"}`,
                                    shiftType: item.shiftType,
                                    performedByName: item.performedByName,
                                    recipient: item.recipient,
                                    timestamp: item.timestamp,
                                    status: item.status,
                                    materials: item.tx ? [item.tx] : [],
                                  });
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Print or view detailed requisition slip"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span>Details Slip</span>
                            </button>
                          </div>
                        </div>

                        {/* Desktop View (>= sm): Preserved Full Layout */}
                        <div className="hidden sm:flex sm:items-center justify-between p-4 sm:p-4.5 gap-3 border-b border-slate-100">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
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

                              {item.status?.toUpperCase() === "CANCELLED" && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                                  Cancelled
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
                              <h5 className="text-base font-bold text-slate-900">
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
                              <span>Floor Recipient: <strong className="text-slate-800">{cleanStaffName(item.recipient, "Floor")}</strong></span>
                              <span>•</span>
                              <span>Store Staff: <strong className="text-slate-800">{cleanStaffName(item.performedByName, "Store Staff")}</strong></span>
                              {item.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic text-slate-600 truncate max-w-xs">{item.notes}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isBatch && item.materials && item.materials.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleBatchExpand(item.referenceId)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isExpanded
                                    ? "bg-slate-100 text-slate-800 border border-slate-200"
                                    : "bg-slate-900 hover:bg-slate-800 text-white"
                                }`}
                              >
                                <span>{isExpanded ? "Hide Materials" : `Materials (${item.materials.length})`}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                if (isBatch && item.rawBatch) {
                                  setBatchDetailModal(item.rawBatch);
                                } else {
                                  setBatchDetailModal({
                                    batchReference: item.referenceId,
                                    productName: item.productName,
                                    batchSize: `${item.quantity || 1} ${item.unit || "Unit"}`,
                                    shiftType: item.shiftType,
                                    performedByName: item.performedByName,
                                    recipient: item.recipient,
                                    timestamp: item.timestamp,
                                    status: item.status,
                                    materials: item.tx ? [item.tx] : [],
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="Print or view detailed requisition slip"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span>Details Slip</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Materials Breakdown */}
                        {isBatch && isExpanded && item.materials && (
                          <div className="bg-slate-50/70 p-3 sm:p-4 border-t border-slate-100">
                            <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-[#CF0458]" />
                                <span>Dispatched Materials Breakdown ({item.materials.length})</span>
                              </span>
                              <span className="text-[10px] font-normal text-slate-500">
                                Exact store deduction breakdown
                              </span>
                            </div>

                            <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                                  <tr>
                                    <th className="py-2.5 px-3">Ingredient / Material</th>
                                    <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                                    <th className="py-2.5 px-3">Deduction Type</th>
                                    <th className="py-2.5 px-3">Batch Time</th>
                                    <th className="py-2.5 px-3">Proportion Note</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {item.materials.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 px-3 font-semibold text-slate-900">{m.itemName}</td>
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
                  };

                  return (
                    <div
                      key={day.dateKey}
                      className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                    >
                      {/* Day Header Card */}
                      <div className="p-4 sm:p-4.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0 shadow-2xs">
                            <Calendar className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                                {formatDayOrdinal(day.dateKey)}
                              </h3>
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#CF0458] text-white shadow-2xs">
                                  TODAY
                                </span>
                              )}
                              {isYesterday && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                  YESTERDAY
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-700">
                                {day.totalCount} {day.totalCount === 1 ? "total dispatch" : "total dispatches"}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="px-2 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                                ☀️ {day.morning.length} Morning
                              </span>
                              <span className="px-2 py-0.2 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-semibold">
                                🌙 {day.night.length} Night
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => toggleDayCollapse(day.dateKey)}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <span>{isDayCollapsed ? "Expand Day" : "Collapse Day"}</span>
                            {isDayCollapsed ? (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Shift Sections inside Day Card */}
                      {!isDayCollapsed && (
                        <div className="p-3 sm:p-4 space-y-4 bg-slate-50/30">
                          {day.totalCount === 0 ? (
                            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
                              <Sun className="w-7 h-7 text-amber-400 mx-auto mb-2" />
                              <p className="text-xs font-bold text-slate-800">No Dispatches Recorded For This Day</p>
                            </div>
                          ) : (
                            <>
                              {/* MORNING SHIFT */}
                              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
                                <button
                                  type="button"
                                  onClick={() => toggleShiftCollapse(morningShiftKey)}
                                  className="w-full p-3 sm:p-3.5 bg-amber-50/40 hover:bg-amber-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
                                      <Sun className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Morning Shift</h4>
                                        <span className="text-[10px] font-medium text-slate-500 font-mono">(08:00 – 18:00)</span>
                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300">
                                          {day.morning.length} {day.morning.length === 1 ? "Dispatch" : "Dispatches"}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        Morning shift operational hours (08:00 – 18:00)
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs font-semibold text-slate-500">
                                    <span>{isMorningCollapsed ? "Expand Shift" : "Collapse Shift"}</span>
                                    {isMorningCollapsed ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                </button>

                                {!isMorningCollapsed && (
                                  <div className="p-3 sm:p-3.5 space-y-3 bg-slate-50/30">
                                    {day.morning.length === 0 ? (
                                      <div className="p-5 text-center bg-white rounded-lg border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-500">No morning shift dispatches on this day.</p>
                                      </div>
                                    ) : (
                                      day.morning.map((item) => renderDispatchItem(item))
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* NIGHT SHIFT */}
                              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden transition-all">
                                <button
                                  type="button"
                                  onClick={() => toggleShiftCollapse(nightShiftKey)}
                                  className="w-full p-3 sm:p-3.5 bg-indigo-50/40 hover:bg-indigo-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
                                      <Moon className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">Night Shift</h4>
                                        <span className="text-[10px] font-medium text-slate-500 font-mono">(18:00 – 08:00 next day)</span>
                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-200/70 text-indigo-900 border border-indigo-300">
                                          {day.night.length} {day.night.length === 1 ? "Dispatch" : "Dispatches"}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        Night shift operational hours (18:00 – 08:00 next day)
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs font-semibold text-slate-500">
                                    <span>{isNightCollapsed ? "Expand Shift" : "Collapse Shift"}</span>
                                    {isNightCollapsed ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                </button>

                                {!isNightCollapsed && (
                                  <div className="p-3 sm:p-3.5 space-y-3 bg-slate-50/30">
                                    {day.night.length === 0 ? (
                                      <div className="p-5 text-center bg-white rounded-lg border border-dashed border-slate-200">
                                        <p className="text-xs text-slate-500">No night shift dispatches on this day.</p>
                                      </div>
                                    ) : (
                                      day.night.map((item) => renderDispatchItem(item))
                                    )}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Pagination Bar (10 Days Per Page) */}
              {totalDayPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className="text-xs text-slate-500">
                    Showing production days <span className="font-bold text-slate-900">{(movementDayPage - 1) * DAYS_PER_PAGE + 1}</span> to <span className="font-bold text-slate-900">{Math.min(movementDayPage * DAYS_PER_PAGE, availableBatchDays.length)}</span> of <span className="font-bold text-slate-900">{availableBatchDays.length}</span> days
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={movementDayPage === 1}
                      onClick={() => setMovementDayPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Previous 10 Days</span>
                    </button>

                    <span className="text-xs font-semibold text-slate-600 px-2">
                      Page {movementDayPage} of {totalDayPages}
                    </span>

                    <button
                      type="button"
                      disabled={movementDayPage >= totalDayPages}
                      onClick={() => setMovementDayPage((p) => Math.min(totalDayPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>Next 10 Days</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: FULL CHRONOLOGICAL LEDGER */}
          {movementViewMode === "LEDGER" && (
            <div className="space-y-4">
              {/* Mobile Transaction Cards (< sm: No Horizontal Scroll) */}
              <div className="sm:hidden space-y-2.5">
                {movementLoading || loading ? (
                  <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                    <span className="text-xs">Loading movements...</span>
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs font-semibold">No movements found matching filter.</span>
                  </div>
                ) : (
                  filteredTransactions.map((txn) => {
                    const badge = formatTxnType(txn.transactionType);
                    const isNegative = txn.quantity < 0;

                    return (
                      <div
                        key={txn.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900">{txn.itemName}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                          <span
                            className={`font-mono font-bold text-xs ${
                              isNegative ? "text-rose-700" : "text-[#059669]"
                            }`}
                          >
                            {isNegative ? "" : "+"}
                            {txn.quantity} {txn.unit}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <div className="flex items-center gap-1">
                            {txn.shiftType === "MORNING_SHIFT" ? (
                              <Sun className="w-3 h-3 text-amber-500" />
                            ) : (
                              <Moon className="w-3 h-3 text-indigo-400" />
                            )}
                            <span>
                              {new Date(txn.createdAt).toLocaleDateString("en-NG", {
                                day: "2-digit",
                                month: "short",
                              })}{" "}
                              {new Date(txn.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <span>
                            By: <strong className="text-slate-700">{txn.performedByName}</strong>
                            {txn.recipient && ` → ${txn.recipient}`}
                          </span>
                        </div>

                        {(txn.referenceId || txn.notes) && (
                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span className="font-mono">{txn.referenceId ? `Ref: ${txn.referenceId}` : ""}</span>
                            <span className="truncate max-w-[200px]">{txn.notes || ""}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table (>= sm) */}
              <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden max-w-full">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date & Shift</th>
                        <th className="py-3 px-3">Material / Product</th>
                        <th className="py-3 px-3">Movement Type</th>
                        <th className="py-3 px-3 text-right">Quantity Change</th>
                        <th className="py-3 px-3">Batch / PO Ref</th>
                        <th className="py-3 px-3">Operator</th>
                        <th className="py-3 px-4">Notes / Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {movementLoading || loading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Loading product movement history...
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No transactions recorded matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((txn) => {
                          const badge = formatTxnType(txn.transactionType);
                          const isNegative = txn.quantity < 0;

                          return (
                            <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-900">
                                  {new Date(txn.createdAt).toLocaleDateString("en-NG", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                  {txn.shiftType === "MORNING_SHIFT" ? (
                                    <>
                                      <Sun className="w-3 h-3 text-amber-500" />
                                      <span>Morning (08:00 - 18:00)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Moon className="w-3 h-3 text-indigo-400" />
                                      <span>Night (18:00 - 08:00)</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900">
                                {txn.itemName}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold">
                                <span className={isNegative ? "text-rose-700" : "text-[#059669]"}>
                                  {isNegative ? "" : "+"}
                                  {txn.quantity} {txn.unit}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                                {txn.referenceId || "—"}
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-700">
                                <div>{txn.performedByName}</div>
                                {txn.recipient && (
                                  <div className="text-[10px] text-slate-400">
                                    To: {txn.recipient}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs">
                                {txn.notes || "Standard operation"}
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
        </div>
      )}

      {/* Detail Modal for Production Batch Details */}
      <BatchDetailModal
        batch={batchDetailModal}
        onClose={() => setBatchDetailModal(null)}
      />

      {/* Official Shift Reconciliation Certificate Modal */}
      <ShiftDetailModal
        isOpen={!!selectedShiftDetail}
        shift={selectedShiftDetail}
        onClose={() => setSelectedShiftDetail(null)}
      />

      {/* Detail Modal for Item Lot Audit */}
      <ItemDetailAuditModal
        isOpen={!!selectedItemDetail}
        item={selectedItemDetail}
        onClose={() => setSelectedItemDetail(null)}
        transactions={transactions}
        onRefresh={loadData}
      />

      {/* Export Statement CSV Modal */}
      <ExportStatementModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
