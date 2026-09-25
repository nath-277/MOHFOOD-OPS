"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";
import { fetchAccountNotificationState, syncNotificationAction } from "@/lib/notifications";
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
  Search,
  Filter,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface NotificationRecord {
  id: string;
  type: "ALERT" | "INFO" | "SUCCESS" | "LOGISTICS";
  category: "STOCK" | "PRODUCTION" | "LOGISTICS" | "SECURITY";
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  read: boolean;
  linkUrl?: string;
  actionLabel?: string;
}

export default function NotificationsPage() {
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

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ALERT" | "PRODUCTION" | "WAREHOUSE" | "LOGISTICS">("ALL");

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/items");
      const data = await res.json();
      const items = data.items || [];

      // Generate low stock alerts only for CEO, Accountant, and Store workers
      const stockAlerts: NotificationRecord[] = canSeeLowStock
        ? items
            .filter((i: any) => i.currentStock <= i.minStockThreshold)
            .map((i: any, idx: number) => ({
              id: `stock-alert-${i.id}`,
              type: "ALERT" as const,
              category: "STOCK" as const,
              title: `Low Stock: ${i.name}`,
              message: `Warehouse stock balance of ${i.name} (${i.currentStock} ${i.uom}) is at or below the safety buffer (${i.minStockThreshold} ${i.uom}). Replenishment required.`,
              timestamp: new Date(Date.now() - (idx + 1) * 12 * 60 * 1000).toISOString(),
              timeAgo: `${(idx + 1) * 12}m ago`,
              read: false,
              linkUrl: "/inventory",
              actionLabel: "View Stock",
            }))
        : [];

      // Real operational activity notifications from ledger
      let activityEvents: NotificationRecord[] = [];
      try {
        const txRes = await fetch("/api/inventory/transactions?limit=30");
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

          const batchNotifications: NotificationRecord[] = Object.entries(batchGroups).map(
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

              if (isLogisticsOfficer) return null;

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
          ).filter(Boolean) as NotificationRecord[];

          const individualNotifications: NotificationRecord[] = individualEvents
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
              let category: "STOCK" | "PRODUCTION" | "LOGISTICS" | "SECURITY" = "STOCK";
              let title = "Stock Movement Recorded";

              if (isCancelled) {
                type = "ALERT";
                category = "PRODUCTION";
                title = `Dispatch Cancelled: ${tx.itemName || "Material"}`;
              } else if (isIntake) {
                type = "SUCCESS";
                category = "STOCK";
                title = "Inbound Intake Recorded";
              } else if (isDispense) {
                type = "INFO";
                category = "PRODUCTION";
                title = `Material Dispensed: ${tx.itemName || "Material"}`;
              } else if (isReturn) {
                type = "ALERT";
                category = "STOCK";
                title = "Material Return Recorded";
              } else if (isReconcile) {
                type = "SUCCESS";
                category = "SECURITY";
                title = "Shift Reconciled & Locked";
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
                message = `${tx.itemName || "Material"}: ${Number(tx.quantity) > 0 ? "+" : ""}${tx.quantity} ${tx.unit}. ${tx.notes || ""}`.trim();
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
            .filter(Boolean) as NotificationRecord[];

          activityEvents = [...batchNotifications, ...individualNotifications].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }
      } catch {
        // Keep empty if ledger query fails
      }

      const { readIds, dismissedIds } = await fetchAccountNotificationState();

      const combined = [...stockAlerts, ...activityEvents]
        .filter((n) => !dismissedIds.includes(n.id))
        .map((n) => ({
          ...n,
          read: n.read || readIds.includes(n.id),
        }));

      setNotifications(combined);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    const allIds = updated.map((n) => n.id);
    localStorage.setItem("moh_read_notifications", JSON.stringify(allIds));
    syncNotificationAction({ markAllReadIds: allIds });
  };

  const markSingleAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem("moh_read_notifications", JSON.stringify(readIds));
    }
    syncNotificationAction({ markReadId: id });
  };

  const dismissNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    const dismissed = JSON.parse(localStorage.getItem("moh_dismissed_notifications") || "[]");
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem("moh_dismissed_notifications", JSON.stringify(dismissed));
    }
    syncNotificationAction({ dismissId: id });
  };

  const restoreDismissed = () => {
    localStorage.removeItem("moh_dismissed_notifications");
    loadNotifications();
  };

  const searchedNotifications = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
  });

  const alertNotifications = searchedNotifications.filter(
    (n) => n.type === "ALERT" || n.category === "STOCK"
  );
  const productionNotifications = searchedNotifications.filter(
    (n) => (n.category === "PRODUCTION" || n.title.includes("Batch") || n.title.includes("Dispense")) && n.type !== "ALERT"
  );
  const warehouseNotifications = searchedNotifications.filter(
    (n) => (n.category === "STOCK" || n.category === "SECURITY") && n.type !== "ALERT"
  );
  const logisticsNotifications = searchedNotifications.filter(
    (n) => n.category === "LOGISTICS" || n.type === "LOGISTICS"
  );

  const unreadCount = notifications.filter((n) => !n.read).length;
  const alertCount = notifications.filter((n) => n.type === "ALERT" || n.category === "STOCK").length;
  const productionCount = notifications.filter(
    (n) => (n.category === "PRODUCTION" || n.title.includes("Batch") || n.title.includes("Dispense")) && n.type !== "ALERT"
  ).length;
  const warehouseCount = notifications.filter(
    (n) => (n.category === "STOCK" || n.category === "SECURITY") && n.type !== "ALERT"
  ).length;
  const logisticsCount = notifications.filter((n) => n.type === "LOGISTICS" || n.category === "LOGISTICS").length;

  const filteredNotifications =
    typeFilter === "ALERT"
      ? alertNotifications
      : typeFilter === "PRODUCTION"
      ? productionNotifications
      : typeFilter === "WAREHOUSE"
      ? warehouseNotifications
      : typeFilter === "LOGISTICS"
      ? logisticsNotifications
      : searchedNotifications;

  const sections = [
    {
      id: "alerts",
      title: "Critical Alerts & Safety Thresholds",
      description: "Low-stock warnings and replenishment threshold breaches",
      icon: AlertTriangle,
      iconColor: "text-amber-600 bg-amber-50 border-amber-200",
      badgeColor: "bg-amber-100 text-amber-800",
      items: alertNotifications,
    },
    {
      id: "production",
      title: "Production Floor & Recipe Dispatches",
      description: "Dispatched materials, floor batch runs, and raw recipe releases",
      icon: Package,
      iconColor: "text-[#CF0458] bg-rose-50 border-rose-200",
      badgeColor: "bg-rose-100 text-[#CF0458]",
      items: productionNotifications,
    },
    {
      id: "warehouse",
      title: "Warehouse Movements & Stock Operations",
      description: "Intakes, stock returns, damage recordings, and store reconciliations",
      icon: Layers,
      iconColor: "text-slate-700 bg-slate-100 border-slate-200",
      badgeColor: "bg-slate-200 text-slate-700",
      items: warehouseNotifications,
    },
    {
      id: "logistics",
      title: "Logistics & Fleet Dispatches",
      description: "Outbound truck manifests, delivery movements, and transit runs",
      icon: Truck,
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      badgeColor: "bg-blue-100 text-blue-800",
      items: logisticsNotifications,
    },
  ];

  const renderItem = (n: NotificationRecord) => (
    <div
      key={n.id}
      onClick={() => {
        markSingleAsRead(n.id);
        if (n.linkUrl) {
          if (typeof window !== "undefined") {
            if (window.location.pathname === "/inventory") {
              window.location.hash = n.linkUrl.includes("#") ? n.linkUrl.split("#")[1] : "inventory";
            } else {
              window.location.href = n.linkUrl;
            }
          }
        }
      }}
      className={`p-4 sm:p-5 transition-colors cursor-pointer flex items-start gap-3.5 ${
        n.read ? "bg-white hover:bg-slate-50/70" : "bg-rose-50/25 hover:bg-rose-50/40"
      }`}
    >
      {/* Type Icon Badge */}
      <div className="shrink-0 mt-0.5">
        {n.type === "ALERT" ? (
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        ) : n.type === "SUCCESS" ? (
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#059669] flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        ) : n.type === "LOGISTICS" ? (
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3
                className={`text-sm ${
                  n.read ? "font-semibold text-slate-800" : "font-extrabold text-slate-900"
                }`}
              >
                {n.title}
              </h3>
              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-[#CF0458] shrink-0" />
              )}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{n.timeAgo}</span>
              <span>•</span>
              <span className="font-mono text-[10px]">
                {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
          </div>

          {/* Dismiss X Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissNotification(n.id);
            }}
            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed mt-2">
          {n.message}
        </p>

        {n.linkUrl && (
          <div className="mt-3">
            <Link
              href={n.linkUrl}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#CF0458] hover:text-white text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
            >
              <span>{n.actionLabel || "Open Action"}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Plant Notifications & Alert Center
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#CF0458] text-white text-[11px] font-bold">
                  {unreadCount} Unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live operational monitoring of warehouse thresholds, batch production, dispatches, and audit alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Check className="w-3.5 h-3.5 text-[#059669]" />
              <span>Mark All as Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={restoreDismissed}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Restore Dismissed</span>
          </button>

          <button
            type="button"
            onClick={loadNotifications}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#CF0458]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Notifications
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {notifications.length}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Critical Stock Alerts
            </div>
            <div className={`text-xl sm:text-2xl font-bold mt-0.5 ${alertCount > 0 ? "text-[#D97706]" : "text-slate-900"}`}>
              {alertCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#D97706] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Active Logistics Runs
            </div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
              {logisticsCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Unread Updates
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#CF0458] mt-0.5">
              {unreadCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#CF0458] flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto">
          {[
            { id: "ALL", label: `All (${notifications.length})` },
            { id: "ALERT", label: `Alerts (${alertCount})` },
            { id: "PRODUCTION", label: `Production (${productionCount})` },
            { id: "WAREHOUSE", label: `Warehouse (${warehouseCount})` },
            { id: "LOGISTICS", label: `Logistics (${logisticsCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                typeFilter === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter notifications by keyword..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications Chronological Stream */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#CF0458]" />
            <span className="text-xs">Loading operational alerts stream...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-[#059669]" />
            <h3 className="text-sm font-bold text-slate-800">All Caught Up!</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No notifications matching your active filter criteria. All plant processes and safety thresholds are optimal.
            </p>
          </div>
        ) : typeFilter === "ALL" ? (
          <div className="divide-y divide-slate-200">
            {sections
              .filter((sec) => sec.items.length > 0)
              .map((section) => (
                <div key={section.id} className="first:pt-0">
                  {/* Category Section Header */}
                  <div className="bg-slate-50/90 px-4 sm:px-5 py-3 border-y border-slate-200/80 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xs">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${section.iconColor}`}>
                        <section.icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                            {section.title}
                          </h2>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${section.badgeColor}`}>
                            {section.items.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 hidden sm:block">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section Items */}
                  <div className="divide-y divide-slate-100">
                    {section.items.map(renderItem)}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map(renderItem)}
          </div>
        )}
      </div>
    </div>
  );
}
