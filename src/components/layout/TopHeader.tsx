"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Menu,
  Lock,
  Sun,
  Moon,
  ShieldCheck,
  Building2,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
  activeShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
}

export function TopHeader({ onOpenMobileMenu, activeShift }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [currentDateStr, setCurrentDateStr] = useState<string>("");

  useEffect(() => {
    const d = new Date();
    setCurrentDateStr(
      d.toLocaleDateString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  }, []);

  // Compute breadcrumb title & subtitle based on pathname
  let pageTitle = "Dashboard";
  let sectionName = "Operations";
  let badgeColor = "bg-slate-100 text-slate-700";

  if (pathname.startsWith("/admin")) {
    sectionName = "Administration";
    pageTitle = "System Administration & RBAC";
    badgeColor = "bg-purple-100 text-purple-800 border-purple-200";
  } else if (pathname.startsWith("/inventory")) {
    sectionName = "Warehouse Floor";
    pageTitle = "Store Inventory Engine";
    badgeColor = "bg-[#FCE4EC] text-[#D81B60] border-[#D81B60]/20";
  } else if (pathname.startsWith("/management")) {
    sectionName = "Executive";
    pageTitle = "Executive Management Hub";
    badgeColor = "bg-[#E8F5E9] text-[#008153] border-[#008153]/20";
  }

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 select-none">
      {/* Brand Accent Top Stripe */}
      <div className="h-1 bg-gradient-to-r from-[#D81B60] via-[#84BD00] to-[#008153]" />

      <div className="px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger menu button */}
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden cursor-pointer"
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-400 hidden sm:inline">{sectionName}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
            <h1 className="text-sm font-extrabold text-[#2B1B24] tracking-tight">{pageTitle}</h1>
          </div>
        </div>

        {/* Right: Shift Status, Plant Status, Quick Tablet Lock */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Shift Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-bold text-slate-700">
            {activeShift === "MORNING_SHIFT" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Morning Shift</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Night Shift</span>
              </>
            )}
          </div>

          {/* Plant Online Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E8F5E9] border border-[#008153]/20 text-[11px] font-bold text-[#008153]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#008153] animate-pulse" />
            <span>Lagos Plant Online</span>
          </div>

          {/* Date string */}
          {currentDateStr && (
            <span className="hidden xl:inline text-xs font-medium text-slate-400">
              {currentDateStr}
            </span>
          )}

          {/* Tablet Quick Lock Button */}
          <button
            type="button"
            onClick={() => router.push("/pin-lock")}
            title="Switch staff / lock tablet to PIN screen"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#FCE4EC] text-slate-600 hover:text-[#D81B60] border border-slate-200 transition-all text-xs font-bold cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#D81B60]" />
            <span className="hidden sm:inline">Lock PIN</span>
          </button>
        </div>
      </div>
    </header>
  );
}
