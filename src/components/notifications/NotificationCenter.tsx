"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  Package,
  Layers,
  Truck,
  RotateCcw,
  CheckCircle2,
  X,
  Clock,
  ExternalLink,
  Check,
  ArrowRight,
  Volume2,
} from "lucide-react";
import {
  notifyLowStockAlert,
} from "@/lib/pushNotifications";
import { useAuth } from "@/components/auth/AuthContext";
import { fetchAccountNotificationState, syncNotificationAction } from "@/lib/notifications";
import { LowStockModal } from "@/components/inventory/LowStockModal";

export interface NotificationItem {
  id: string;
  type: "ALERT" | "INFO" | "SUCCESS" | "LOGISTICS";
  category: "STOCK" | "PRODUCTION" | "WAREHOUSE" | "SECURITY";
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  read: boolean;
  linkUrl?: string;
  actionLabel?: string;
}

export function NotificationCenter() {
  const { user } = useAuth();
  const role = user?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isExecutive = role === "EXECUTIVE" || isSuperAdmin;
  const isAccountant = role === "ACCOUNTANT";
  const isStoreStaff = role === "STORE_MANAGER";
  const isProductionSupervisor = role === "PRODUCTION_SUPERVISOR";
  const isLogisticsOfficer = role === "LOGISTICS_OFFICER";

  // Low stock alerts: CEO, Accountant, Store Manager (hidden for Super Admin, Supervisor, Logistics)
  const canSeeLowStock = role === "EXECUTIVE" || role === "ACCOUNTANT" || role === "STORE_MANAGER";

  const [isOpen, setIsOpen] = useState(false);
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "ALERTS" | "PRODUCTION" | "WAREHOUSE">("ALL");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live inventory items to generate real-time operational alerts
  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/inventory/items");
      const data = await res.json();
      const items = data.items || [];

      // Generate low stock alerts only for CEO, Accountant, and Store workers (hidden for Super Admin)
      const stockAlerts: NotificationItem[] = canSeeLowStock
        ? items
            .filter((i: any) => i.currentStock <= i.minStockThreshold)
            .map((i: any, idx: number) => ({
              id: `stock-alert-${i.id}`,
              type: "ALERT" as const,
              category: "STOCK" as const,
              title: `Low Stock: ${i.name}`,
              message: `Current balance (${i.currentStock} ${i.uom}) is at or below minimum buffer threshold (${i.minStockThreshold} ${i.uom}).`,
              timestamp: new Date(Date.now() - (idx + 1) * 12 * 60 * 1000).toISOString(),
              timeAgo: `${(idx + 1) * 12}m ago`,
              read: false,
              linkUrl: "/inventory",
              actionLabel: "View Stock",
            }))
        : [];

      // Real operational activity notifications from ledger
      let activityEvents: NotificationItem[] = [];
      try {
        const txRes = await fetch("/api/inventory/transactions?limit=25");
        if (txRes.ok) {
          const txData = await txRes.json();
          const txList = txData.transactions || [];

          // Group batch dispatches so each batch only shows the recipe dished out
          const batchGroups: Record<string, any[]> = {};
          const individualEvents: any[] = [];

          for (const tx of txList) {
            const isBatch =
              (tx.transactionType === "DISPENSE_PRODUCTION" || tx.transactionType?.includes("DISPENSE")) &&
              tx.referenceId &&
              (tx.referenceId.startsWith("BATCH-") || tx.notes?.includes("Dispensed for"));

            if (isBatch && tx.referenceId) {
              if (!batchGroups[tx.referenceId]) {
                batchGroups[tx.referenceId] = [];
              }
              batchGroups[tx.referenceId].push(tx);
            } else {
              individualEvents.push(tx);
            }
          }

          const batchNotifications: NotificationItem[] = Object.entries(batchGroups).map(
            ([refId, items]) => {
              const first = items[0];
              const recipeTxn = items.find((it: any) => it.notes && /Dispensed for /i.test(it.notes)) || first;
              let recipeName = "Production Recipe Batch";
              let batchSize = "";

              const match = recipeTxn.notes?.match(/Dispensed for (\d+x?)\s+([^.]+)/i);
              if (match) {
                batchSize = match[1];
                recipeName = match[2];
              } else if (recipeTxn.notes && /^Dispensed for /i.test(recipeTxn.notes)) {
                recipeName = recipeTxn.notes.replace(/^Dispensed for\s+/i, "").split(".")[0];
              } else if (recipeTxn.itemName) {
                recipeName = recipeTxn.itemName;
              }

              const ts = first.createdAt ? new Date(first.createdAt).getTime() : Date.now();
              const minsAgo = Math.max(1, Math.round((Date.now() - ts) / 60000));
              const timeAgo = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

              const isCancelled = items.some(
                (i: any) => i.status?.toUpperCase() === "CANCELLED" || i.notes?.includes("[CANCELLED")
              );
              const notifType: "ALERT" | "INFO" | "SUCCESS" | "LOGISTICS" = isCancelled ? "ALERT" : "INFO";
              const title = isCancelled ? `Dispatch Cancelled: ${recipeName}` : `Production Batch: ${recipeName}`;
              const message = isCancelled
                ? `Dispatch ${refId} was cancelled. Deducted materials were returned to store balance.`
                : `${batchSize ? `Batch ${batchSize}: ` : ""}${items.length} materials dished out to ${first.recipient || "Production Floor"}. Ref: ${refId}`;

              return {
                id: `batch-${refId}`,
                type: notifType,
                category: "PRODUCTION" as const,
                title,
                message,
                timestamp: first.createdAt || new Date().toISOString(),
                timeAgo,
                read: false,
                linkUrl: "/inventory#movements",
                actionLabel: "View Dispatches",
              };
            }
          ).filter(Boolean) as NotificationItem[];

          const individualNotifications: NotificationItem[] = individualEvents
            .map((tx: any) => {
              const isCancelled = tx.status?.toUpperCase() === "CANCELLED" || tx.notes?.includes("[CANCELLED");
              const isDispense = tx.transactionType?.includes("DISPENSE");
              const isIntake = tx.transactionType === "INBOUND_PURCHASE";
              const isReturn = tx.transactionType?.includes("RETURN");
              const isReconcile = tx.transactionType?.includes("RECONCIL");

              // Scoping: prevent cross-department notification leakage
              if (isProductionSupervisor && (isIntake || isReconcile)) return null;
              if (isLogisticsOfficer) return null;
              if (isAccountant && isDispense) return null;

              let type: "ALERT" | "INFO" | "SUCCESS" | "LOGISTICS" = "INFO";
              let category: "STOCK" | "PRODUCTION" | "WAREHOUSE" | "SECURITY" = "WAREHOUSE";
              let title = "Stock Movement";

              if (isCancelled) {
                type = "ALERT";
                category = "PRODUCTION";
                title = `Dispatch Cancelled: ${tx.itemName || "Item"}`;
              } else if (isIntake) {
                type = "SUCCESS";
                category = "WAREHOUSE";
                title = "Inbound Intake Recorded";
              } else if (isDispense) {
                type = "INFO";
                category = "PRODUCTION";
                title = `Material Dispensed: ${tx.itemName || "Item"}`;
              } else if (isReturn) {
                type = "ALERT";
                category = "WAREHOUSE";
                title = "Material Return Recorded";
              } else if (isReconcile) {
                type = "SUCCESS";
                category = "WAREHOUSE";
                title = "Shift Reconciliation";
              }

              const ts = tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now();
              const minsAgo = Math.max(1, Math.round((Date.now() - ts) / 60000));
              const timeAgo = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

              let message = "";
              if (isCancelled) {
                message = `Dispatch of ${Math.abs(Number(tx.quantity))} ${tx.unit} ${tx.itemName || "Material"} was cancelled and stock restored.`;
              } else if (isDispense) {
                message = `${Math.abs(Number(tx.quantity))} ${tx.unit} of ${tx.itemName} dished out to ${tx.recipient || "Production Floor"}.`;
              } else {
                message = `${tx.itemName || "Item"}: ${Number(tx.quantity) > 0 ? "+" : ""}${tx.quantity} ${tx.unit}. ${tx.notes || ""}`.trim();
              }

              return {
                id: `tx-${tx.id}`,
                type,
                category,
                title,
                message,
                timestamp: tx.createdAt || new Date().toISOString(),
                timeAgo,
                read: false,
                linkUrl: isDispense || isCancelled ? "/inventory#movements" : "/inventory",
                actionLabel: isDispense || isCancelled ? "View Dispatches" : "View Ledger",
              };
            })
            .filter(Boolean) as NotificationItem[];

          activityEvents = [...batchNotifications, ...individualNotifications].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }
      } catch {
        // Keep empty if ledger query fails
      }

      // Load read and dismissed IDs from account state (with local cache fallback)
      const { readIds, dismissedIds } = await fetchAccountNotificationState();
      const combined = [...stockAlerts, ...activityEvents]
        .filter((n) => !dismissedIds.includes(n.id))
        .map((n) => ({
          ...n,
          read: n.read || readIds.includes(n.id),
        }));

      setNotifications(combined);

      // Trigger native push notification for critical stock shortage if permission granted
      if (stockAlerts.length > 0) {
        const first = items.find((i: any) => i.currentStock <= i.minStockThreshold);
        if (first) {
          notifyLowStockAlert(
            first.id,
            first.name,
            first.currentStock,
            first.uom,
            first.minStockThreshold
          );
        }
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    const readIds = updated.map((n) => n.id);
    localStorage.setItem("moh_read_notifications", JSON.stringify(readIds));
    syncNotificationAction({ markAllReadIds: readIds });
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem("moh_read_notifications", JSON.stringify(readIds));
    }
    syncNotificationAction({ markReadId: id });
  };

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    const dismissed = JSON.parse(localStorage.getItem("moh_dismissed_notifications") || "[]");
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem("moh_dismissed_notifications", JSON.stringify(dismissed));
    }
    syncNotificationAction({ dismissId: id });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const alertNotifications = notifications.filter(
    (n) => n.type === "ALERT" || n.category === "STOCK"
  );
  const productionNotifications = notifications.filter(
    (n) => (n.category === "PRODUCTION" || n.title.includes("Batch") || n.title.includes("Dispense")) && n.type !== "ALERT"
  );
  const warehouseNotifications = notifications.filter(
    (n) => !alertNotifications.some((a) => a.id === n.id) && !productionNotifications.some((p) => p.id === n.id)
  );

  const renderNotificationCard = (n: NotificationItem) => (
    <div
      key={n.id}
      onClick={() => {
        markAsRead(n.id);
        if (n.category === "STOCK" || n.id.startsWith("stock-alert-")) {
          setIsLowStockModalOpen(true);
          setIsOpen(false);
          return;
        }
        if (n.linkUrl) {
          setIsOpen(false);
          if (typeof window !== "undefined") {
            if (window.location.pathname === "/inventory") {
              window.location.hash = n.linkUrl.includes("#") ? n.linkUrl.split("#")[1] : "inventory";
            } else {
              window.location.href = n.linkUrl;
            }
          }
        }
      }}
      className={`p-3 transition-colors cursor-pointer flex gap-3 ${
        n.read ? "bg-white hover:bg-slate-50/70" : "bg-rose-50/30 hover:bg-rose-50/50"
      }`}
    >
      <div className="shrink-0 mt-0.5">
        {n.type === "ALERT" ? (
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        ) : n.type === "SUCCESS" ? (
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        ) : n.type === "LOGISTICS" ? (
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Truck className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <Package className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <h4
            className={`text-xs truncate ${
              n.read ? "font-semibold text-slate-700" : "font-bold text-slate-900"
            }`}
          >
            {n.title}
          </h4>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              <span>{n.timeAgo}</span>
            </span>
            <button
              type="button"
              onClick={(e) => dismissNotification(n.id, e)}
              className="p-1 rounded-md text-slate-300 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
          {n.message}
        </p>

        {n.linkUrl && (
          <div className="mt-1.5 flex items-center gap-2">
            {n.category === "STOCK" || n.id.startsWith("stock-alert-") ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(n.id);
                  setIsOpen(false);
                  setIsLowStockModalOpen(true);
                }}
                className="text-[10px] font-bold text-[#CF0458] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{n.actionLabel || "View Stock"}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            ) : (
              <Link
                href={n.linkUrl}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-[10px] font-bold text-[#CF0458] hover:underline inline-flex items-center gap-1"
              >
                <span>{n.actionLabel || "Open"}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            )}
          </div>
        )}
      </div>

      {!n.read && (
        <div className="shrink-0 flex items-center">
          <span className="w-2 h-2 rounded-full bg-[#CF0458]" />
        </div>
      )}
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? "bg-slate-200 text-slate-900 border-slate-300"
            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#CF0458] text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card & Mobile Backdrop */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] sm:hidden z-40 animate-in fade-in duration-100"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full mt-2 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Plant Notifications</h3>
                <span className="text-[10px] text-slate-500 font-medium">
                  {unreadCount} unread alert{unreadCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-[#CF0458] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 bg-white px-2 pt-1 gap-1 text-[11px] font-semibold overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "ALL"
                  ? "bg-slate-100 text-slate-900 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ALERTS")}
              className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === "ALERTS"
                  ? "bg-amber-50 text-amber-800 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Alerts ({alertNotifications.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("PRODUCTION")}
              className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === "PRODUCTION"
                  ? "bg-rose-50 text-[#CF0458] font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="w-3 h-3 text-[#CF0458]" />
              <span>Production ({productionNotifications.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("WAREHOUSE")}
              className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                activeTab === "WAREHOUSE"
                  ? "bg-slate-100 text-slate-900 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Package className="w-3 h-3 text-slate-500" />
              <span>Warehouse ({warehouseNotifications.length})</span>
            </button>
          </div>

          {/* Sectioned Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#059669]" />
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No active notifications for your station.
                </p>
              </div>
            ) : activeTab === "ALL" ? (
              <div className="space-y-0.5">
                {/* 1. Critical Alerts Section */}
                {alertNotifications.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-amber-50/80 border-y border-amber-100/90 flex items-center justify-between text-[11px] font-bold text-amber-900 sticky top-0 z-10 backdrop-blur-xs">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Critical Alerts & Thresholds</span>
                      </div>
                      <span className="text-[10px] bg-amber-200/60 text-amber-800 px-1.5 py-0.2 rounded-full font-mono">
                        {alertNotifications.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {alertNotifications.map(renderNotificationCard)}
                    </div>
                  </div>
                )}

                {/* 2. Production Section */}
                {productionNotifications.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-rose-50/80 border-y border-rose-100/90 flex items-center justify-between text-[11px] font-bold text-[#CF0458] sticky top-0 z-10 backdrop-blur-xs">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-[#CF0458]" />
                        <span>Production & Recipe Floor</span>
                      </div>
                      <span className="text-[10px] bg-rose-100 text-[#CF0458] px-1.5 py-0.2 rounded-full font-mono">
                        {productionNotifications.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {productionNotifications.map(renderNotificationCard)}
                    </div>
                  </div>
                )}

                {/* 3. Warehouse Section */}
                {warehouseNotifications.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 bg-slate-100/90 border-y border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-700 sticky top-0 z-10 backdrop-blur-xs">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-slate-500" />
                        <span>Warehouse Movements & Store</span>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                        {warehouseNotifications.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {warehouseNotifications.map(renderNotificationCard)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeTab === "ALERTS" &&
                  (alertNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#059669]" />
                      <p className="text-xs font-bold text-slate-700">No active alerts</p>
                    </div>
                  ) : (
                    alertNotifications.map(renderNotificationCard)
                  ))}

                {activeTab === "PRODUCTION" &&
                  (productionNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#059669]" />
                      <p className="text-xs font-bold text-slate-700">No production dispatches</p>
                    </div>
                  ) : (
                    productionNotifications.map(renderNotificationCard)
                  ))}

                {activeTab === "WAREHOUSE" &&
                  (warehouseNotifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#059669]" />
                      <p className="text-xs font-bold text-slate-700">No warehouse movements</p>
                    </div>
                  ) : (
                    warehouseNotifications.map(renderNotificationCard)
                  ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-medium">
              Live Plant Monitoring
            </span>
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-[#CF0458] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All Notifications</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </>
    )}

      {/* Low Stock Items Modal */}
      <LowStockModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
      />
    </div>
  );
}
