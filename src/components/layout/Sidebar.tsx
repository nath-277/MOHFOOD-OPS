"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { Logo } from "@/components/brand/Logo";
import {
  Boxes,
  Package,
  Clock,
  RotateCcw,
  CheckCircle2,
  Briefcase,
  Layers,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Building2,
  Lock,
  LogOut,
  Sun,
  Moon,
  X,
  Truck,
  Sparkles,
  ClipboardList,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  activeShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onShiftChange: (shift: "MORNING_SHIFT" | "NIGHT_SHIFT") => void;
}

export function Sidebar({
  isMobileOpen = false,
  onCloseMobile,
  activeShift,
  onShiftChange,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const role = user?.role || "STAFF";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isExecutive = isSuperAdmin || role === "EXECUTIVE";
  const isStoreDept = isSuperAdmin || role === "STORE_MANAGER" || role === "STORE_OFFICER";

  // Initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return "MF";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-white text-slate-700">
      {/* Top Brand & Regulatory Header */}
      <div className="shrink-0 border-b border-slate-100 p-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Logo size="sm" showTagline={false} />
          </Link>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* NAFDAC & Facility Badge */}
        <div className="mt-3 flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <span className="w-2 h-2 rounded-full bg-[#008153] animate-pulse" />
            <span>NAFDAC: A8-106771</span>
          </div>
          <span className="font-semibold text-slate-400 text-[10px]">Lagos & Ogun</span>
        </div>
      </div>

      {/* Active Shift Switcher Card */}
      <div className="shrink-0 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Floor Work Shift
          </span>
          <span className="text-[10px] font-bold text-[#D81B60]">
            {activeShift === "MORNING_SHIFT" ? "06:00 - 14:30" : "18:00 - 02:30"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onShiftChange("MORNING_SHIFT")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeShift === "MORNING_SHIFT"
                ? "bg-white text-amber-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Morning</span>
          </button>
          <button
            type="button"
            onClick={() => onShiftChange("NIGHT_SHIFT")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeShift === "NIGHT_SHIFT"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Night</span>
          </button>
        </div>
      </div>

      {/* Middle Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Core Operations Group */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Core Operations
          </div>
          <div className="space-y-1">
            {/* Store Inventory Link */}
            {isStoreDept && (
              <div className="space-y-0.5">
                <Link
                  href="/inventory"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    pathname === "/inventory"
                      ? "bg-[#D81B60] text-white shadow-sm shadow-[#D81B60]/20"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className={`w-4 h-4 ${pathname === "/inventory" ? "text-white" : "text-[#D81B60]"}`} />
                    <span>Store Inventory</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/inventory" ? "text-white/80" : "text-slate-300"}`} />
                </Link>

                {/* Sub items for store */}
                {pathname === "/inventory" && (
                  <div className="pl-8 pr-2 py-1 space-y-0.5 border-l-2 border-[#D81B60]/30 ml-4 my-1">
                    <a
                      href="#intake"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#D81B60] hover:bg-[#FCE4EC]/50"
                    >
                      <Package className="w-3 h-3 text-[#D81B60]" />
                      <span>Inbound Intake</span>
                    </a>
                    <a
                      href="#dispense"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#D81B60] hover:bg-[#FCE4EC]/50"
                    >
                      <Clock className="w-3 h-3 text-[#D81B60]" />
                      <span>Batch Dispensing</span>
                    </a>
                    <a
                      href="#returns"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#D81B60] hover:bg-[#FCE4EC]/50"
                    >
                      <RotateCcw className="w-3 h-3 text-[#D81B60]" />
                      <span>Returns & Faults</span>
                    </a>
                    <a
                      href="#reconcile"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#D81B60] hover:bg-[#FCE4EC]/50"
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#D81B60]" />
                      <span>Shift Reconciliation</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Executive Hub Link */}
            {isExecutive && (
              <div className="space-y-0.5">
                <Link
                  href="/management"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    pathname === "/management"
                      ? "bg-[#008153] text-white shadow-sm shadow-[#008153]/20"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Briefcase className={`w-4 h-4 ${pathname === "/management" ? "text-white" : "text-[#008153]"}`} />
                    <span>Executive Hub</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/management" ? "text-white/80" : "text-slate-300"}`} />
                </Link>

                {pathname === "/management" && (
                  <div className="pl-8 pr-2 py-1 space-y-0.5 border-l-2 border-[#008153]/30 ml-4 my-1">
                    <a
                      href="#sor"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#008153] hover:bg-[#E8F5E9]/50"
                    >
                      <Layers className="w-3 h-3 text-[#008153]" />
                      <span>Supermarket SoR</span>
                    </a>
                    <a
                      href="#whatsapp"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#008153] hover:bg-[#E8F5E9]/50"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-[#008153]" />
                      <span>WhatsApp Invoices</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Administration Group */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Administration
          </div>
          <div className="space-y-1">
            {isSuperAdmin && (
              <div className="space-y-0.5">
                <Link
                  href="/admin"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    pathname === "/admin"
                      ? "bg-purple-800 text-white shadow-sm shadow-purple-800/20"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className={`w-4 h-4 ${pathname === "/admin" ? "text-white" : "text-purple-700"}`} />
                    <span>Admin & Security</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/admin" ? "text-white/80" : "text-slate-300"}`} />
                </Link>

                {pathname === "/admin" && (
                  <div className="pl-8 pr-2 py-1 space-y-0.5 border-l-2 border-purple-800/30 ml-4 my-1">
                    <a
                      href="#staff"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-purple-800 hover:bg-purple-50"
                    >
                      <Users className="w-3 h-3 text-purple-700" />
                      <span>Staff & Tablet PINs</span>
                    </a>
                    <a
                      href="#departments"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-purple-800 hover:bg-purple-50"
                    >
                      <Building2 className="w-3 h-3 text-purple-700" />
                      <span>Modular Architecture</span>
                    </a>
                    <a
                      href="#security"
                      onClick={onCloseMobile}
                      className="flex items-center gap-2 py-1 px-2 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-purple-800 hover:bg-purple-50"
                    >
                      <ShieldCheck className="w-3 h-3 text-purple-700" />
                      <span>RBAC & Audit Trail</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Enterprise Modules Roadmap (Reflects Moh Foods Modularity) */}
        <div className="pt-2">
          <div className="px-3 mb-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <span>Modular Expansion</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-bold">
              Roadmap
            </span>
          </div>
          <div className="space-y-1 text-slate-400 px-2 text-xs">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
              <span className="flex items-center gap-2 font-medium">
                <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                <span>Production Mixing</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Phase 4</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
              <span className="flex items-center gap-2 font-medium">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span>Logistics & Vans</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Phase 5</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pinned Bottom Operator Card & Session Controls */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center gap-3 mb-2.5">
          {/* Avatar circle */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D81B60] to-[#AD1457] text-white flex items-center justify-center font-extrabold text-xs shadow-sm shrink-0">
            {getInitials(user?.fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-[#2B1B24] truncate">
              {user?.fullName || "Staff Member"}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="font-mono font-bold text-slate-600 truncate">
                {user?.staffId || "MOH-STAFF"}
              </span>
              <span>•</span>
              <span className="font-bold text-[#D81B60] truncate">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Quick Lock & Sign Out */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => router.push("/pin-lock")}
            title="Lock floor tablet terminal"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white hover:bg-[#FCE4EC] border border-slate-200 hover:border-[#D81B60]/30 text-slate-700 hover:text-[#D81B60] text-[11px] font-bold transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#D81B60]" />
            <span>Lock PIN</span>
          </button>

          <button
            type="button"
            onClick={logout}
            title="Sign out of system"
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-700 hover:text-red-600 text-[11px] font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Immovable Sidebar: Fixed to the left edge of viewport */}
      <aside className="hidden lg:block w-64 xl:w-72 shrink-0 h-screen sticky top-0 border-r border-slate-200 z-30 select-none shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Slide-out Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer container */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
