"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  X,
  Package,
  ArrowRight,
  RefreshCw,
  Search,
  ExternalLink,
  MapPin,
  ShieldAlert,
} from "lucide-react";
import { InventoryItem } from "@/server/inventory/store";
import { formatPackagingDisplay } from "@/lib/packaging";
import { fetcher } from "@/lib/swr";

export interface LowStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockItems?: InventoryItem[];
}

export function LowStockModal({
  isOpen,
  onClose,
  lowStockItems: initialItems,
}: LowStockModalProps) {
  const [items, setItems] = useState<InventoryItem[]>(initialItems || []);
  const [loading, setLoading] = useState<boolean>(!initialItems || initialItems.length === 0);
  const [searchQuery, setSearchQuery] = useState("");

  const loadLowStockItems = async () => {
    try {
      setLoading(true);
      const data = await fetcher<{ items?: InventoryItem[] }>("/api/inventory/items");
      const allItems: InventoryItem[] = data.items || [];
      const low = allItems.filter((i) => i.currentStock <= i.minStockThreshold);
      setItems(low);
    } catch (err) {
      console.error("Failed to load low stock items:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialItems && initialItems.length > 0) {
        setItems(initialItems);
        setLoading(false);
      } else {
        loadLowStockItems();
      }
      setSearchQuery("");
    }
  }, [isOpen, initialItems]);

  const filteredItems = useMemo(() => {
    let list = items.filter((i) => i.currentStock <= i.minStockThreshold);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.code.toLowerCase().includes(q) ||
          i.storageLocation?.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }
    // Sort critical (depleted/0 stock) first, then by highest shortfall
    return list.sort((a, b) => {
      const aDepleted = a.currentStock <= 0 ? 1 : 0;
      const bDepleted = b.currentStock <= 0 ? 1 : 0;
      if (aDepleted !== bDepleted) return bDepleted - aDepleted;
      const aShortfall = a.minStockThreshold - a.currentStock;
      const bShortfall = b.minStockThreshold - b.currentStock;
      return bShortfall - aShortfall;
    });
  }, [items, searchQuery]);

  const outOfStockCount = useMemo(() => {
    return items.filter((i) => i.currentStock <= 0).length;
  }, [items]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 relative max-h-[92vh] sm:max-h-[88vh] flex flex-col gap-3 sm:gap-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  Low Stock Safety Alerts
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Warehouse inventory at or below minimum required buffer thresholds
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Summary */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 shrink-0">
          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider block truncate">
                Buffer Breached
              </span>
              <div className="text-base sm:text-xl font-extrabold text-amber-950 mt-0.5">
                {items.length}
              </div>
            </div>
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 ml-1" />
          </div>

          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-rose-800 uppercase tracking-wider block truncate">
                Out of Stock (0 Bal)
              </span>
              <div className="text-base sm:text-xl font-extrabold text-rose-950 mt-0.5">
                {outOfStockCount}
              </div>
            </div>
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 shrink-0 ml-1" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU or location..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:outline-hidden transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* List of Low Stock Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white min-h-[140px]">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
              <span className="text-xs font-medium">Checking warehouse stock balances...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 px-4">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No matching items found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {searchQuery ? "Try refining your search keyword" : "All item stock levels are healthy!"}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const shortfall = Number((item.minStockThreshold - item.currentStock).toFixed(3));
              const isDepleted = item.currentStock <= 0;
              const pkgDisplay = formatPackagingDisplay(item.currentStock, item);

              return (
                <div
                  key={item.id || item.code}
                  className="p-3 sm:p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
                >
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                        isDepleted
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                          {item.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {item.code}
                        </span>
                        {isDepleted ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-rose-100 text-rose-700">
                            Depleted
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-800">
                            Low Buffer
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{item.storageLocation || "Central Warehouse"}</span>
                        </span>
                        <span>•</span>
                        <span>
                          Min: <strong className="font-mono text-slate-700">{item.minStockThreshold} {item.uom}</strong>
                        </span>
                        {shortfall > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-rose-600 font-semibold font-mono">
                              Deficit: -{shortfall} {item.uom}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0 shrink-0">
                    <div className="text-left sm:text-right">
                      <div
                        className={`text-xs sm:text-sm font-mono font-extrabold ${
                          isDepleted ? "text-rose-600" : "text-amber-700"
                        }`}
                      >
                        {item.currentStock} {item.uom}
                      </div>
                      {pkgDisplay.secondary && (
                        <div className="text-[10px] text-slate-400 font-medium">
                          ≈ {pkgDisplay.secondary}
                        </div>
                      )}
                    </div>

                    <Link
                      href="/inventory#inventory"
                      onClick={onClose}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#CF0458] hover:text-white text-slate-700 text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={loadLowStockItems}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
