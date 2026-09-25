"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { notifyLowStockAlert } from "@/lib/pushNotifications";
import { useAuth } from "@/components/auth/AuthContext";
import { LowStockModal } from "@/components/inventory/LowStockModal";
import { InventoryItem } from "@/server/inventory/store";

export function TopNotificationBanner() {
  const { user } = useAuth();
  const role = user?.role;
  const canSeeLowStock =
    role === "EXECUTIVE" ||
    role === "ACCOUNTANT" ||
    role === "STORE_MANAGER";

  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    title: string;
    message: string;
    linkUrl: string;
  } | null>(null);

  const [lowStockList, setLowStockList] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const checkAlerts = async () => {
    if (!canSeeLowStock) {
      setActiveAlert(null);
      setLowStockList([]);
      return;
    }
    try {
      const res = await fetch("/api/inventory/items");
      const data = await res.json();
      const items: InventoryItem[] = data.items || [];
      const dismissed: string[] = JSON.parse(
        localStorage.getItem("moh_dismissed_notifications") || "[]"
      );

      const lowStockItems = items.filter(
        (i: any) => i.currentStock <= i.minStockThreshold
      );
      setLowStockList(lowStockItems);

      if (lowStockItems.length > 0) {
        const first = lowStockItems[0];
        notifyLowStockAlert(
          first.id,
          first.name,
          first.currentStock,
          first.uom,
          first.minStockThreshold
        );
        const alertId = `stock-alert-${first.id}`;
        if (!dismissed.includes(alertId)) {
          setActiveAlert({
            id: alertId,
            title: `Low Stock Alert: ${first.name}`,
            message: `${first.name} balance (${first.currentStock} ${first.uom}) has reached the minimum safety threshold (${first.minStockThreshold} ${first.uom}).`,
            linkUrl: "/inventory",
          });
          return;
        }
      }

      setActiveAlert(null);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    if (canSeeLowStock) {
      checkAlerts();
      const interval = setInterval(checkAlerts, 60000);
      return () => clearInterval(interval);
    } else {
      setActiveAlert(null);
      setLowStockList([]);
    }
  }, [canSeeLowStock]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeAlert) return;
    const dismissed: string[] = JSON.parse(
      localStorage.getItem("moh_dismissed_notifications") || "[]"
    );
    if (!dismissed.includes(activeAlert.id)) {
      dismissed.push(activeAlert.id);
      localStorage.setItem(
        "moh_dismissed_notifications",
        JSON.stringify(dismissed)
      );
    }
    setActiveAlert(null);
  };

  if (!activeAlert) return null;

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex items-center justify-between text-amber-900 animate-in fade-in duration-150 cursor-pointer hover:bg-amber-500/15 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <span className="p-1 rounded-md bg-amber-500/20 text-[#D97706] shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
          <span className="font-bold truncate shrink-0">{activeAlert.title}:</span>
          <span className="text-amber-800/90 truncate hidden sm:inline">
            {activeAlert.message}
          </span>
          {lowStockList.length > 1 && (
            <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded shrink-0 hidden md:inline">
              +{lowStockList.length - 1} more items
            </span>
          )}
          <span className="text-[10px] font-bold text-amber-700 bg-amber-200/50 hover:bg-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 ml-1">
            <span>View Details</span>
            <ChevronRight className="w-2.5 h-2.5" />
          </span>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-md text-amber-700/60 hover:text-amber-900 hover:bg-amber-500/20 transition-colors cursor-pointer shrink-0"
          aria-label="Dismiss alert banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <LowStockModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lowStockItems={lowStockList}
      />
    </>
  );
}
