"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, X, ArrowRight } from "lucide-react";

export function TopNotificationBanner() {
  const [activeAlert, setActiveAlert] = useState<{
    id: string;
    title: string;
    message: string;
    linkUrl: string;
  } | null>(null);

  const checkAlerts = async () => {
    try {
      const res = await fetch("/api/inventory/items");
      const data = await res.json();
      const items = data.items || [];
      const dismissed: string[] = JSON.parse(
        localStorage.getItem("moh_dismissed_notifications") || "[]"
      );

      const lowStockItems = items.filter(
        (i: any) => i.currentStock <= i.minStockThreshold
      );

      if (lowStockItems.length > 0) {
        const first = lowStockItems[0];
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
    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
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
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex items-center justify-between text-amber-900 animate-in fade-in duration-150">
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        <span className="p-1 rounded-md bg-amber-500/20 text-[#D97706] shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
        </span>
        <span className="font-bold truncate shrink-0">{activeAlert.title}:</span>
        <span className="text-amber-800/90 truncate hidden sm:inline">
          {activeAlert.message}
        </span>
        <Link
          href={activeAlert.linkUrl}
          className="font-bold text-[#CF0458] hover:underline shrink-0 inline-flex items-center gap-1 ml-1"
        >
          <span>Resolve</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
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
  );
}
