"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  Volume2,
} from "lucide-react";
import {
  notifyLowStockAlert,
} from "@/lib/pushNotifications";

export interface NotificationItem {
  id: string;
  type: "ALERT" | "INFO" | "SUCCESS" | "LOGISTICS";
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  read: boolean;
  linkUrl?: string;
  actionLabel?: string;
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"ALL" | "ALERTS" | "ACTIVITY">("ALL");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch live inventory items to generate real-time operational alerts
  const loadNotifications = async () => {
    try {
      const res = await fetch("/api/inventory/items");
      const data = await res.json();
      const items = data.items || [];

      // Generate low stock alerts
      const stockAlerts: NotificationItem[] = items
        .filter((i: any) => i.currentStock <= i.minStockThreshold)
        .map((i: any, idx: number) => ({
          id: `stock-alert-${i.id}`,
          type: "ALERT" as const,
          title: `Low Stock: ${i.name}`,
          message: `Current balance (${i.currentStock} ${i.uom}) is at or below minimum buffer threshold (${i.minStockThreshold} ${i.uom}).`,
          timestamp: new Date(Date.now() - (idx + 1) * 12 * 60 * 1000).toISOString(),
          timeAgo: `${(idx + 1) * 12}m ago`,
          read: false,
          linkUrl: "/inventory",
          actionLabel: "View Stock",
        }));

      // Real operational activity notifications from ledger
      let activityEvents: NotificationItem[] = [];
      try {
        const txRes = await fetch("/api/inventory/transactions?limit=15");
        if (txRes.ok) {
          const txData = await txRes.json();
          const txList = txData.transactions || [];
          activityEvents = txList.map((tx: any) => {
            const isDispense = tx.transactionType?.includes("DISPENSE");
            const isIntake = tx.transactionType === "INBOUND_PURCHASE";
            const isReturn = tx.transactionType?.includes("RETURN");
            const isReconcile = tx.transactionType?.includes("RECONCIL");

            let type: "ALERT" | "INFO" | "SUCCESS" | "LOGISTICS" = "INFO";
            let title = "Stock Movement";
            if (isIntake) {
              type = "SUCCESS";
              title = "Inbound Intake Recorded";
            } else if (isDispense) {
              type = "INFO";
              title = "Production Dispense";
            } else if (isReturn) {
              type = "ALERT";
              title = "Material Return Recorded";
            } else if (isReconcile) {
              type = "SUCCESS";
              title = "Shift Reconciliation";
            }

            const ts = tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now();
            const minsAgo = Math.max(1, Math.round((Date.now() - ts) / 60000));
            const timeAgo = minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo / 60)}h ago`;

            return {
              id: `tx-${tx.id}`,
              type,
              title,
              message: `${tx.itemName || "Item"}: ${Number(tx.quantity) > 0 ? "+" : ""}${tx.quantity} ${tx.unit}. ${tx.notes || ""}`.trim(),
              timestamp: tx.createdAt || new Date().toISOString(),
              timeAgo,
              read: false,
              linkUrl: "/inventory",
              actionLabel: "View Ledger",
            };
          });
        }
      } catch {
        // Keep empty if ledger query fails
      }

      // Load read and dismissed IDs from localStorage
      const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
      const dismissedIds = JSON.parse(localStorage.getItem("moh_dismissed_notifications") || "[]");
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
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem("moh_read_notifications", JSON.stringify(readIds));
    }
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
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "ALERTS") return n.type === "ALERT";
    if (activeTab === "ACTIVITY") return n.type !== "ALERT";
    return true;
  });

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

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
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
          <div className="flex border-b border-slate-100 bg-white px-2 pt-1 gap-1 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
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
              className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === "ALERTS"
                  ? "bg-amber-50 text-amber-800 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Alerts</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ACTIVITY")}
              className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                activeTab === "ACTIVITY"
                  ? "bg-slate-100 text-slate-900 font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Activity
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#059669]" />
                <p className="text-xs font-bold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No active notifications in this category.
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
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
                      </div>
                    )}
                  </div>

                  {!n.read && (
                    <div className="shrink-0 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-[#CF0458]" />
                    </div>
                  )}
                </div>
              ))
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
      )}
    </div>
  );
}
