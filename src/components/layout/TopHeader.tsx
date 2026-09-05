"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Lock,
  Sun,
  Moon,
  ChevronRight,
} from "lucide-react";

interface TopHeaderProps {
  onOpenMobileMenu: () => void;
  activeShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
}

export function TopHeader({ onOpenMobileMenu, activeShift }: TopHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
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

  let pageTitle = "Dashboard";
  let sectionName = "Operations";

  if (pathname.startsWith("/admin")) {
    sectionName = "Administration";
    pageTitle = "System Administration & RBAC";
  } else if (pathname.startsWith("/inventory")) {
    sectionName = "Warehouse Floor";
    pageTitle = "Store Inventory & Materials";
  } else if (pathname.startsWith("/management")) {
    sectionName = "Executive";
    pageTitle = "Executive Management Hub";
  }

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 select-none">
      <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Calm Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-slate-400 hidden sm:inline">{sectionName}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
            <h1 className="text-sm font-bold text-slate-900 tracking-tight">{pageTitle}</h1>
          </div>
        </div>

        {/* Right: Shift Status, Plant Status, Quick Tablet Lock */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Shift Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            {activeShift === "MORNING_SHIFT" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-slate-500" />
                <span>Morning (08:00 - 18:00)</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-500" />
                <span>Night (18:00 - 08:00)</span>
              </>
            )}
          </div>

          {/* Plant Online Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
            <span>Lagos Plant</span>
          </div>

          {/* Date string */}
          {currentDateStr && (
            <span className="hidden xl:inline text-xs font-normal text-slate-400 font-mono">
              {currentDateStr}
            </span>
          )}

          {/* Tablet Quick Lock Button */}
          <button
            type="button"
            onClick={() => router.push("/pin-lock")}
            title="Lock tablet to PIN screen"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all text-xs font-bold cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Lock PIN</span>
          </button>
        </div>
      </div>
    </header>
  );
}
