"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  AlertTriangle,
  Package,
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
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ALERT" | "ACTIVITY" | "LOGISTICS">("ALL");

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inventory/items");
      const data = await res.json();
      const items = data.items || [];

      // Generate low stock alerts
      const stockAlerts: NotificationRecord[] = items
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
        }));

      // Operational activity notifications
      const activityEvents: NotificationRecord[] = [
        {
          id: "act-1",
          type: "SUCCESS",
          category: "STOCK",
          title: "Inbound Intake Recorded",
          message: "500.00 kg Whole Milk received from Dan Dairy Farms Ltd into Cold Room A. GRN reference stamped into audit trail.",
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          timeAgo: "45m ago",
          read: false,
          linkUrl: "/inventory",
          actionLabel: "Intake Ledger",
        },
        {
          id: "act-2",
          type: "INFO",
          category: "PRODUCTION",
          title: "Batch BOM Dispense Complete",
          message: "Production Supervisor received 300 units of BOM raw ingredients for Moh Yogurt Parfait 400ml. Store stock deducted accurately.",
          timestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
          timeAgo: "1h ago",
          read: true,
          linkUrl: "/inventory",
          actionLabel: "Recipe BOM",
        },
        {
          id: "act-3",
          type: "LOGISTICS",
          category: "LOGISTICS",
          title: "Cold-Chain Van RUN-LAG-01 In Transit",
          message: "Refrigerated van departed plant carrying 450 units to Hubmart Ikeja and Prince Ebeano Lekki. Calibrated at 4.2°C.",
          timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
          timeAgo: "2h ago",
          read: true,
          linkUrl: "/logistics",
          actionLabel: "Track Run",
        },
        {
          id: "act-4",
          type: "ALERT",
          category: "SECURITY",
          title: "Shift Handover & Reconciliation",
          message: "Morning Shift concluded. Store inventory variance reconciled with zero unexplained shrinkage.",
          timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
          timeAgo: "4h ago",
          read: true,
          linkUrl: "/inventory",
          actionLabel: "Reconciliation Log",
        },
      ];

      const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
      const dismissedIds = JSON.parse(localStorage.getItem("moh_dismissed_notifications") || "[]");

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
  };

  const markSingleAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem("moh_read_notifications", JSON.stringify(readIds));
    }
  };

  const dismissNotification = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    const dismissed = JSON.parse(localStorage.getItem("moh_dismissed_notifications") || "[]");
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem("moh_dismissed_notifications", JSON.stringify(dismissed));
    }
  };

  const restoreDismissed = () => {
    localStorage.removeItem("moh_dismissed_notifications");
    loadNotifications();
  };

  const filteredNotifications = notifications.filter((n) => {
    if (typeFilter === "ALERT" && n.type !== "ALERT") return false;
    if (typeFilter === "LOGISTICS" && n.type !== "LOGISTICS") return false;
    if (typeFilter === "ACTIVITY" && n.type === "ALERT") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q);
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const alertCount = notifications.filter((n) => n.type === "ALERT").length;
  const logisticsCount = notifications.filter((n) => n.type === "LOGISTICS").length;

  return (
    <div className="space-y-5 pb-10">
      {/* Top Header Card */}
      <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#8E1538]/10 text-[#8E1538] flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Plant Notifications & Alert Center
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#8E1538] text-white text-[11px] font-bold">
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
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#8E1538]" : ""}`} />
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
            <div className="text-xl sm:text-2xl font-bold text-[#8E1538] mt-0.5">
              {unreadCount}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#8E1538] flex items-center justify-center shrink-0">
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
            { id: "LOGISTICS", label: `Logistics (${logisticsCount})` },
            { id: "ACTIVITY", label: "Operational Activity" },
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
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
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
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8E1538]" />
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
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markSingleAsRead(n.id)}
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
                        <span className="w-2 h-2 rounded-full bg-[#8E1538] shrink-0" />
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#8E1538] hover:text-white text-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                      <span>{n.actionLabel || "Open Action"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
