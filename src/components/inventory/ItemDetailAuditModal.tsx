"use client";

import React, { useState, useMemo, useEffect } from "react";
import { InventoryItem, StockTransaction } from "@/server/inventory/store";
import { formatPackagingDisplay, calculatePackageCost, getPackagingMultipliers } from "@/lib/packaging";
import {
  Boxes,
  Package,
  X,
  Scale,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Sparkles,
  Pencil,
  Info,
  Layers,
  History,
  Tag,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface ItemDetailAuditModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  transactions?: StockTransaction[];
  onDispenseItem?: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
  onDeleteItem?: (item: InventoryItem) => void;
  onRefresh?: () => void;
}

export function ItemDetailAuditModal({
  isOpen,
  item,
  onClose,
  transactions = [],
  onDispenseItem,
  onEditItem,
  onDeleteItem,
  onRefresh,
}: ItemDetailAuditModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "ledger">("overview");
  const [modalDisplayMode, setModalDisplayMode] = useState<"PACKAGES" | "BASE">("PACKAGES");
  const [auditDateFilter, setAuditDateFilter] = useState<"ALL" | "30_DAYS" | "90_DAYS">("ALL");
  const [dedicatedTxns, setDedicatedTxns] = useState<StockTransaction[]>([]);
  const [loadingDedicated, setLoadingDedicated] = useState(false);

  // Container Depletion State
  const [localItem, setLocalItem] = useState<InventoryItem | null>(item);
  const [showDepleteDialog, setShowDepleteDialog] = useState(false);
  const [openNextContainer, setOpenNextContainer] = useState(true);
  const [depleteReason, setDepleteReason] = useState("Container fully consumed on production floor");
  const [depleting, setDepleting] = useState(false);
  const [depleteSuccess, setDepleteSuccess] = useState<string | null>(null);
  const [depleteError, setDepleteError] = useState<string | null>(null);

  // Unit Cost Edit State (for Executives & Admins)
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [costInput, setCostInput] = useState<string>("");
  const [savingCost, setSavingCost] = useState(false);
  const [costSaveSuccess, setCostSaveSuccess] = useState<string | null>(null);
  const [costSaveError, setCostSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLocalItem(item);
    setDepleteSuccess(null);
    setDepleteError(null);
    if (item) {
      setCostInput(String(item.costPerUnit || "0"));
      setIsEditingCost(false);
      setCostSaveSuccess(null);
      setCostSaveError(null);
    }
  }, [item]);

  const activeItem = localItem || item;

  const handleSaveUnitCost = async () => {
    if (!activeItem) return;
    const numCost = parseFloat(costInput);
    if (isNaN(numCost) || numCost < 0) {
      setCostSaveError("Please enter a valid non-negative cost value.");
      return;
    }
    try {
      setSavingCost(true);
      setCostSaveError(null);
      const res = await fetch(`/api/inventory/items/${activeItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costPerUnit: numCost }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update unit cost");
      }
      setLocalItem((prev) => (prev ? { ...prev, costPerUnit: numCost } : null));
      setCostSaveSuccess("Unit cost updated successfully");
      setIsEditingCost(false);
      onRefresh?.();
      setTimeout(() => setCostSaveSuccess(null), 3500);
    } catch (err: any) {
      setCostSaveError(err.message || "Failed to update unit cost");
    } finally {
      setSavingCost(false);
    }
  };

  const fetchItemMovements = React.useCallback(async () => {
    if (!item) return;
    try {
      setLoadingDedicated(true);
      const params = new URLSearchParams();
      params.set("itemId", item?.id || "");
      params.set("limit", "100");

      if (auditDateFilter === "30_DAYS") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.set("startDate", d.toISOString().split("T")[0]);
      } else if (auditDateFilter === "90_DAYS") {
        const d = new Date();
        d.setDate(d.getDate() - 90);
        params.set("startDate", d.toISOString().split("T")[0]);
      }

      const res = await fetch(`/api/inventory/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDedicatedTxns(data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to fetch item dedicated movements:", err);
    } finally {
      setLoadingDedicated(false);
    }
  }, [item, auditDateFilter]);

  useEffect(() => {
    if (isOpen && item) {
      fetchItemMovements();
    }
  }, [isOpen, item, fetchItemMovements]);

  const handleConfirmDeplete = async () => {
    if (!activeItem) return;
    setDepleting(true);
    setDepleteError(null);
    setDepleteSuccess(null);
    try {
      const res = await fetch(`/api/inventory/items/${activeItem.id}/deplete-container`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openNextContainer,
          reason: depleteReason.trim() || "Container fully consumed on production floor",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark container depleted.");
      if (data.item) {
        setLocalItem(data.item);
      }
      setDepleteSuccess(data.message || "Container successfully marked depleted.");
      setShowDepleteDialog(false);
      onRefresh?.();
      fetchItemMovements();
    } catch (err: any) {
      setDepleteError(err.message || "Failed to deplete container.");
    } finally {
      setDepleting(false);
    }
  };

  const itemTransactions = useMemo(() => {
    if (dedicatedTxns.length > 0) return dedicatedTxns;
    if (!item) return [];
    return transactions
      .filter((t) => t.itemId === item.id || t.itemName === item.name || (t as any).itemCode === item.code)
      .slice(0, 50);
  }, [dedicatedTxns, item, transactions]);

  if (!isOpen || !item || !activeItem) return null;

  const pkg = formatPackagingDisplay(activeItem.currentStock, activeItem);
  const costInfo = calculatePackageCost(activeItem.costPerUnit, activeItem);
  const holdingValuation = activeItem.currentStock * activeItem.costPerUnit;
  const isLowStock = activeItem.currentStock <= activeItem.minStockThreshold;
  const isOut = activeItem.currentStock <= 0;
  const { unitsPerPack, packsPerCarton, unitsPerCarton } = getPackagingMultipliers(activeItem);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#CF0458]">
                  <Boxes className="w-6 h-6" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {activeItem.name}
                </h2>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {activeItem.code}
                </span>
                {activeItem.isVariablePack && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    Variable Product
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>Category: <strong className="text-slate-700 font-semibold">{activeItem.category.replace(/_/g, " ")}</strong></span>
                <span>•</span>
                <span>Location: <strong className="text-slate-700 font-semibold">{activeItem.storageLocation || "Central Warehouse"}</strong></span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {depleteSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{depleteSuccess}</span>
          </div>
        )}

        {/* View mode toggle & Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Stock & Packaging
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === "ledger"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit History ({itemTransactions.length})</span>
            </button>
          </div>

          {/* Display Mode Switcher */}
          {item.packagingType && item.packagingType !== "DIRECT" && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="text-[11px] font-medium hidden sm:inline">Unit View:</span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalDisplayMode("PACKAGES")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    modalDisplayMode === "PACKAGES"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📦 {item.packagingType === "CARTON_AND_PACK" ? (item.cartonUnit ? `${item.cartonUnit}s` : "Cartons") : (item.packUnit ? `${item.packUnit}s` : "Packs")}
                </button>
                <button
                  type="button"
                  onClick={() => setModalDisplayMode("BASE")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                    modalDisplayMode === "BASE"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ⚖️ {item.uom}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" ? (
          <div className="space-y-4">
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Card 1: Available Stock */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Available Stock
                </div>
                <div className="mt-1">
                  {item.isVariablePack ? (
                    <div>
                      <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                        {item.currentStock.toLocaleString()} {item.uom}
                      </div>
                      <div className="text-[11px] text-amber-700 font-medium">
                        Variable Material (Dispatched in {item.recipeUom || item.uom})
                      </div>
                    </div>
                  ) : modalDisplayMode === "PACKAGES" && pkg.type !== "DIRECT" ? (
                    <div>
                      <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                        {pkg.primary}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {item.currentStock.toLocaleString()} {item.uom}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                        {item.currentStock.toLocaleString(undefined, {
                          minimumFractionDigits: item.uom === "kg" || item.uom === "L" ? 1 : 0,
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-xs font-semibold text-slate-500">{item.uom}</span>
                      </div>
                      {pkg.type !== "DIRECT" && (
                        <div className="text-[11px] text-slate-500 font-medium font-mono">
                          {pkg.primary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  {isOut ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                      Out of Stock
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      <AlertTriangle className="w-2.5 h-2.5" /> Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-2.5 h-2.5" /> In Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Card 2: Holding Valuation */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Holding Valuation
                </div>
                <div className="mt-1 text-lg sm:text-xl font-extrabold font-mono text-[#CF0458]">
                  ₦ {holdingValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="mt-2 text-[10px] text-slate-400 font-medium">
                  {activeItem.currentStock.toLocaleString()} {activeItem.uom} × ₦{activeItem.costPerUnit.toLocaleString()}/{activeItem.uom}
                </div>
              </div>

              {/* Card 3: Purchase / Unit Cost with Executive Edit */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Unit Cost
                  </div>
                  {!isEditingCost && (
                    <button
                      type="button"
                      onClick={() => {
                        setCostInput(String(activeItem.costPerUnit || "0"));
                        setIsEditingCost(true);
                      }}
                      className="text-[10px] font-bold text-[#CF0458] hover:underline flex items-center gap-1 cursor-pointer"
                      title="Edit item unit cost"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                {isEditingCost ? (
                  <div className="mt-2 space-y-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">
                        Cost per {activeItem.uom} (₦)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={costInput}
                        onChange={(e) => setCostInput(e.target.value)}
                        className="w-full px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#CF0458]"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    {costInfo.isPackaged && Number(costInput) > 0 && (
                      <div className="text-[9px] text-slate-500 font-mono">
                        ≈ ₦{calculatePackageCost(Number(costInput), activeItem).packagePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {costInfo.packageUnitLabel}
                      </div>
                    )}
                    {costSaveError && (
                      <div className="text-[10px] text-red-600 font-medium">
                        {costSaveError}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={handleSaveUnitCost}
                        disabled={savingCost}
                        className="px-2 py-1 rounded bg-[#CF0458] hover:bg-[#b0034a] text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {savingCost && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingCost(false);
                          setCostSaveError(null);
                        }}
                        disabled={savingCost}
                        className="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {costInfo.isPackaged ? (
                      <div className="mt-1">
                        <div className="text-base sm:text-lg font-extrabold font-mono text-slate-900">
                          ₦ {costInfo.packagePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          <span className="text-[10px] font-normal text-slate-500"> / {costInfo.packageUnitLabel}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          (₦ {activeItem.costPerUnit.toLocaleString()}/{activeItem.uom})
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <div className="text-base sm:text-lg font-extrabold font-mono text-slate-900">
                          ₦ {activeItem.costPerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          <span className="text-[10px] font-normal text-slate-500"> / {activeItem.uom}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          Direct unit rate
                        </div>
                      </div>
                    )}
                    {costSaveSuccess && (
                      <div className="mt-1 text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{costSaveSuccess}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[10px] text-slate-400">
                      Valuation rate
                    </div>
                  </>
                )}
              </div>

              {/* Card 4: Min Buffer Threshold */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Reorder Threshold
                </div>
                <div className="mt-1 text-lg sm:text-xl font-extrabold font-mono text-slate-800">
                  {item.minStockThreshold.toLocaleString()}{" "}
                  <span className="text-xs font-semibold text-slate-500">{item.uom}</span>
                </div>
                {pkg.type !== "DIRECT" && (
                  <div className="mt-1 text-[10px] text-slate-500 font-mono">
                    ≈ {formatPackagingDisplay(item.minStockThreshold, item).primary}
                  </div>
                )}
                <div className="mt-1 text-[10px] text-slate-400">
                  Safety buffer
                </div>
              </div>
            </div>

            {/* Packaging Configuration Details */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Layers className="w-4 h-4 text-[#CF0458]" />
                  <span>Packaging Architecture</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                  Mode: {item.packagingType || "DIRECT"}
                </span>
              </div>

              {item.packagingType === "CARTON_AND_PACK" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-900 uppercase">1 Master Carton</div>
                    <div className="text-sm font-extrabold text-indigo-950 mt-0.5">
                      {packsPerCarton} {item.packUnit ? `${item.packUnit}s` : "packs"}
                    </div>
                    <div className="text-[10px] text-indigo-700 mt-0.5">
                      Total {unitsPerCarton.toLocaleString()} {item.uom} per carton
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-900 uppercase">1 Inner Pack</div>
                    <div className="text-sm font-extrabold text-indigo-950 mt-0.5">
                      {unitsPerPack} {item.uom}
                    </div>
                    <div className="text-[10px] text-indigo-700 mt-0.5">
                      Cost: ₦{(item.costPerUnit * unitsPerPack).toLocaleString()}/pack
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-900 uppercase">Carton Pricing</div>
                    <div className="text-sm font-extrabold text-indigo-950 mt-0.5">
                      ₦{(item.costPerUnit * unitsPerCarton).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-indigo-700 mt-0.5">
                      Per full {item.cartonUnit || "carton"}
                    </div>
                  </div>
                </div>
              ) : item.packagingType === "PACK_ONLY" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-900 uppercase">Package Unit Multiplier</div>
                    <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                      1 {item.packUnit || "pack"} = {unitsPerPack} {item.uom}
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">
                      e.g., 50kg bag of milk powder, or pack of cups
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-900 uppercase">Package Unit Price</div>
                    <div className="text-sm font-extrabold text-emerald-950 mt-0.5">
                      ₦{(item.costPerUnit * unitsPerPack).toLocaleString()} / {item.packUnit || "pack"}
                    </div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">
                      Equivalent to ₦{item.costPerUnit.toLocaleString()} per {item.uom}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600">
                  This item is stored and dispensed as individual direct units (<strong>{item.uom}</strong>). Unit cost is <strong>₦{item.costPerUnit.toLocaleString()}</strong> per {item.uom}.
                </div>
              )}

              {/* Variable Product Specification */}
              {activeItem.isVariablePack && (
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-950">Variable Product / Multi-Use Material</div>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Inventory balance is stored and accounted in <strong className="font-bold">{activeItem.uom}</strong>. Recipes and kitchen dispatches dish out in <strong className="font-bold">{activeItem.recipeUom || activeItem.uom}</strong>. Remaining stock is physically confirmed after batch dispatch.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60 text-xs">
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/60">
                      <div className="text-[10px] font-bold text-amber-700 uppercase">Storage Stock Balance</div>
                      <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        {activeItem.currentStock} {activeItem.uom}
                      </div>
                    </div>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200/60">
                      <div className="text-[10px] font-bold text-amber-700 uppercase">Dispatch Unit of Measure</div>
                      <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                        {activeItem.recipeUom || activeItem.uom}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Audit History Ledger */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 gap-2 flex-wrap pb-1">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAuditDateFilter("ALL")}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    auditDateFilter === "ALL"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Time
                </button>
                <button
                  type="button"
                  onClick={() => setAuditDateFilter("30_DAYS")}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    auditDateFilter === "30_DAYS"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => setAuditDateFilter("90_DAYS")}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    auditDateFilter === "90_DAYS"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  3 Months Ago
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px]">
                {loadingDedicated && <RefreshCw className="w-3 h-3 text-[#CF0458] animate-spin" />}
                <span>{itemTransactions.length} movement records</span>
              </div>
            </div>

            {itemTransactions.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">No stock movements recorded yet for this item.</p>
                <p className="text-[11px] text-slate-400 mt-1">Inbound intakes, dispatches, and returns will appear here.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100">
                {itemTransactions.map((tx) => {
                  const isInbound = tx.transactionType === "INBOUND_PURCHASE" || tx.transactionType === "RETURN_EXCESS_RESTOCK";
                  const isDispense = tx.transactionType.startsWith("DISPENSE");
                  const isReturn = tx.transactionType.startsWith("RETURN");
                  const isReconcile = tx.transactionType === "RECONCILIATION_ADJUST";

                  return (
                    <div key={tx.id} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isInbound
                            ? "bg-emerald-100 text-emerald-700"
                            : isDispense
                            ? "bg-amber-100 text-amber-700"
                            : isReturn
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {isInbound ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : isDispense ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : isReturn ? (
                            <RotateCcw className="w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 capitalize">
                            {tx.transactionType.replace(/_/g, " ").toLowerCase()}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>{new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            <span>•</span>
                            <span>By: {tx.performedByName || "Staff"}</span>
                            {tx.recipient && (
                              <>
                                <span>•</span>
                                <span>To: {tx.recipient}</span>
                              </>
                            )}
                          </div>
                          {tx.notes && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5">
                              &ldquo;{tx.notes}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-mono font-bold text-xs ${
                          isInbound
                            ? "text-emerald-700"
                            : isDispense
                            ? "text-slate-900"
                            : "text-indigo-700"
                        }`}>
                          {isInbound ? "+" : isDispense ? "-" : ""}{tx.quantity.toLocaleString()} {tx.unit}
                        </div>
                        {item.packagingType && item.packagingType !== "DIRECT" && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {formatPackagingDisplay(tx.quantity, item).primary}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {onDispenseItem && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDispenseItem(item);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#CF0458] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Dispense Item</span>
              </button>
            )}
            {onEditItem && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditItem(item);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Specs</span>
              </button>
            )}
            {onDeleteItem && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteItem(item);
                }}
                className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete Material</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Mark Container Empty Dialog */}
      {showDepleteDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Mark Container Empty</h4>
                <p className="text-[11px] text-slate-500">{activeItem.name} ({activeItem.code})</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              This marks the active floor container as exhausted, logs a reconciliation depletion event in the audit trail, and lets you open the next sealed container from store stock.
            </p>

            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openNextContainer}
                  onChange={(e) => setOpenNextContainer(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#CF0458] focus:ring-[#CF0458] border-slate-300 cursor-pointer"
                />
                <div className="text-xs text-slate-700">
                  <span className="font-bold text-slate-900">Open next sealed container from store</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Deducts 1 sealed container from store stock ({activeItem.currentStock} {activeItem.packUnit || activeItem.uom} available) and opens it for production floor use.
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Reason / Floor Note
                </label>
                <input
                  type="text"
                  value={depleteReason}
                  onChange={(e) => setDepleteReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
                />
              </div>
            </div>

            {depleteError && (
              <div className="mb-3 p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{depleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDepleteDialog(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={depleting}
                onClick={handleConfirmDeplete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {depleting ? "Updating..." : "Confirm Depletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
