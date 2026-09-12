"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";

interface ItemDetailAuditModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  transactions?: StockTransaction[];
  onDispenseItem?: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
}

export function ItemDetailAuditModal({
  isOpen,
  item,
  onClose,
  transactions = [],
  onDispenseItem,
  onEditItem,
}: ItemDetailAuditModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "ledger">("overview");
  const [modalDisplayMode, setModalDisplayMode] = useState<"PACKAGES" | "BASE">("PACKAGES");

  const itemTransactions = useMemo(() => {
    if (!item) return [];
    return transactions
      .filter((t) => t.itemId === item.id || t.itemName === item.name || (t as any).itemCode === item.code)
      .slice(0, 30);
  }, [item, transactions]);

  if (!isOpen || !item) return null;

  const pkg = formatPackagingDisplay(item.currentStock, item);
  const costInfo = calculatePackageCost(item.costPerUnit, item);
  const holdingValuation = item.currentStock * item.costPerUnit;
  const isLowStock = item.currentStock <= item.minStockThreshold;
  const isOut = item.currentStock <= 0;
  const { unitsPerPack, packsPerCarton, unitsPerCarton } = getPackagingMultipliers(item);

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
                  {item.name}
                </h2>
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {item.code}
                </span>
                {item.isVariablePack && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    Variable Product
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>Category: <strong className="text-slate-700 font-semibold">{item.category.replace(/_/g, " ")}</strong></span>
                <span>•</span>
                <span>Location: <strong className="text-slate-700 font-semibold">{item.storageLocation || "Central Warehouse"}</strong></span>
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
                        {pkg.primary}
                      </div>
                      <div className="text-[11px] text-amber-700 font-medium">
                        +{item.inUseQuantity || 1} container in use on floor
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
                  {item.currentStock.toLocaleString()} {item.uom} × ₦{item.costPerUnit.toLocaleString()}/{item.uom}
                </div>
              </div>

              {/* Card 3: Purchase / Unit Cost */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Unit Cost
                </div>
                {costInfo.isPackaged ? (
                  <div className="mt-1">
                    <div className="text-base sm:text-lg font-extrabold font-mono text-slate-900">
                      ₦ {costInfo.packagePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-[10px] font-normal text-slate-500"> / {costInfo.packageUnitLabel}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      (₦ {item.costPerUnit.toLocaleString()}/{item.uom})
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    <div className="text-base sm:text-lg font-extrabold font-mono text-slate-900">
                      ₦ {item.costPerUnit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      <span className="text-[10px] font-normal text-slate-500"> / {item.uom}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      Direct unit rate
                    </div>
                  </div>
                )}
                <div className="mt-1 text-[10px] text-slate-400">
                  Valuation rate
                </div>
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
              {item.isVariablePack && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Multi-Use Variable Container</div>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      Accounted as full containers plus active containers in use on the floor. Consumed gradually across shifts without individual piece counting; dispatches to the floor remain provisional until end-of-shift reconciliation handover.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Audit History Ledger */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Recent Movement Log</span>
              <span>Showing last {itemTransactions.length} records</span>
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
    </div>
  );
}
