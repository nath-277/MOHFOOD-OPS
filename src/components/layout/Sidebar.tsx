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
  ClipboardList,
  ChevronRight,
  Settings,
  Store,
  Bell,
  Download,
  Warehouse,
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
  const { user, logout, lockTerminal } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const role = user?.role || "STAFF";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isExecutive = isSuperAdmin || role === "EXECUTIVE";
  const isStoreDept = isSuperAdmin || isExecutive || role === "STORE_MANAGER" || role === "STORE_OFFICER";
  const isProductionDept = isSuperAdmin || isExecutive || role === "PRODUCTION_SUPERVISOR";
  const isLogisticsDept = isSuperAdmin || isExecutive || role === "LOGISTICS_OFFICER";
  const isProductStorageDept = isSuperAdmin || isExecutive || isStoreDept || isProductionDept || isLogisticsDept;
  const isReturnsDept = isSuperAdmin || isExecutive || isStoreDept || isProductionDept || isLogisticsDept;

  const [activeHash, setActiveHash] = React.useState<string>("");
  const [canInstallPwa, setCanInstallPwa] = React.useState(false);

  React.useEffect(() => {
    const updateHash = () => {
      if (typeof window !== "undefined") {
        setActiveHash(window.location.hash.replace("#", ""));
      }
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);

    const checkCanInstall = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      if (isStandalone) {
        setCanInstallPwa(false);
        return;
      }
      if ((window as any).__pwaInstallPrompt) {
        setCanInstallPwa(true);
      }
    };

    checkCanInstall();
    window.addEventListener("pwa:prompt-ready", checkCanInstall);
    window.addEventListener("beforeinstallprompt", () => setCanInstallPwa(true));
    window.addEventListener("appinstalled", () => setCanInstallPwa(false));

    return () => {
      window.removeEventListener("hashchange", updateHash);
      window.removeEventListener("pwa:prompt-ready", checkCanInstall);
      window.removeEventListener("beforeinstallprompt", () => setCanInstallPwa(true));
      window.removeEventListener("appinstalled", () => setCanInstallPwa(false));
    };
  }, [pathname]);

  const handleSidebarInstall = async () => {
    const promptEvent = (window as any).__pwaInstallPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === "accepted") {
          (window as any).__pwaInstallPrompt = null;
          setCanInstallPwa(false);
        }
      } catch (err) {
        console.warn("[Sidebar] PWA Install Error:", err);
      }
    }
  };

  const handleInventoryModal = (e: React.MouseEvent, action: string) => {
    e.preventDefault();
    if (pathname === "/inventory") {
      window.dispatchEvent(new CustomEvent("inventory:open-modal", { detail: action }));
      window.history.replaceState(null, "", `#${action}`);
      setActiveHash(action);
    } else {
      router.push(`/inventory#${action}`);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleExecutiveInventoryTab = (e: React.MouseEvent, tab: "stock" | "history" | "returns" | "reconcile") => {
    e.preventDefault();
    if (pathname === "/inventory") {
      window.dispatchEvent(new CustomEvent("executive-inventory:switch-tab", { detail: tab }));
      window.location.hash = tab;
      setActiveHash(tab);
    } else {
      router.push(`/inventory#${tab}`);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleManagementTab = (e: React.MouseEvent, tab: "sor" | "invoices" | "par_levels") => {
    e.preventDefault();
    if (pathname === "/management") {
      window.dispatchEvent(new CustomEvent("management:switch-tab", { detail: tab }));
      window.location.hash = tab;
      setActiveHash(tab);
    } else {
      router.push(`/management#${tab}`);
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleAdminTab = (e: React.MouseEvent, tab: "staff" | "departments" | "security") => {
    e.preventDefault();
    if (pathname === "/admin") {
      window.dispatchEvent(new CustomEvent("admin:switch-tab", { detail: tab }));
      window.location.hash = tab;
      setActiveHash(tab);
    } else {
      router.push(`/admin#${tab}`);
    }
    if (onCloseMobile) onCloseMobile();
  };

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
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
            <span>NAFDAC: A8-106771</span>
          </div>
          <span className="font-semibold text-slate-400 text-[10px]">Lagos Plant</span>
        </div>
      </div>

      {/* Active Shift Switcher Card */}
      <div className="shrink-0 px-4 py-3 bg-slate-50/60 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Shift Schedule
          </span>
          <span className="text-[10px] font-bold text-slate-600 font-mono">
            {activeShift === "MORNING_SHIFT" ? "08:00 - 18:00" : "18:00 - 08:00"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => onShiftChange("MORNING_SHIFT")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
              activeShift === "MORNING_SHIFT"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-slate-600" />
            <span>Morning</span>
          </button>
          <button
            type="button"
            onClick={() => onShiftChange("NIGHT_SHIFT")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
              activeShift === "NIGHT_SHIFT"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Moon className="w-3.5 h-3.5 text-slate-600" />
            <span>Night</span>
          </button>
        </div>
      </div>

      {/* Middle Navigation Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Core Operations Group */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Operations
          </div>
          <div className="space-y-1">
            {/* Executive Hub Link - Hoisted to top for Executive users */}
            {isExecutive && (
              <div className="space-y-0.5">
                <Link
                  href="/management"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/management"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4 h-4" />
                    <span>Executive Hub</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/management" ? "text-white/70" : "text-slate-300"}`} />
                </Link>

                {pathname === "/management" && (
                  <div className="pl-6 pr-2 py-1 space-y-0.5 border-l border-slate-200 ml-4 my-1 text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => handleManagementTab(e, "sor")}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                        activeHash === "sor" || (!activeHash && pathname === "/management")
                          ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                          : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                      }`}
                    >
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>Supermarket SoR</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleManagementTab(e, "invoices")}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                        activeHash === "invoices"
                          ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                          : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                      }`}
                    >
                      <FileSpreadsheet className="w-3 h-3 text-slate-400" />
                      <span>WhatsApp Invoices</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleManagementTab(e, "par_levels")}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                        activeHash === "par_levels"
                          ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                          : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                      }`}
                    >
                      <Boxes className="w-3 h-3 text-slate-400" />
                      <span>Plant Buffer Runway</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Store Inventory Link */}
            {isStoreDept && (
              <div className="space-y-0.5">
                <Link
                  href="/inventory"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/inventory"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Boxes className="w-4 h-4" />
                    <span>Store Inventory</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/inventory" ? "text-white/70" : "text-slate-300"}`} />
                </Link>

                {/* Sub items for store */}
                {pathname === "/inventory" && (
                  <div className="pl-6 pr-2 py-1 space-y-0.5 border-l border-slate-200 ml-4 my-1 text-[11px]">
                    {isExecutive && !isSuperAdmin ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleExecutiveInventoryTab(e, "stock")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "stock"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <Boxes className="w-3 h-3 text-slate-400" />
                          <span>Check Stock</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleExecutiveInventoryTab(e, "history")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "history"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Product History</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleExecutiveInventoryTab(e, "returns")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "returns"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400" />
                          <span>Returns & Why</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleExecutiveInventoryTab(e, "reconcile")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "reconcile"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3 text-slate-400" />
                          <span>Reconciliation Log</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleInventoryModal(e, "intake")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "intake"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <Package className="w-3 h-3 text-slate-400" />
                          <span>Inbound Intake</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleInventoryModal(e, "dispense")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "dispense"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Batch Dispensing</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleInventoryModal(e, "returns")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "returns"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <RotateCcw className="w-3 h-3 text-slate-400" />
                          <span>Returns & Replacements</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleInventoryModal(e, "reconcile")}
                          className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                            activeHash === "reconcile"
                              ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                              : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-slate-400" />
                          <span>Shift Reconciliation</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Production Mixing Link */}
            {isProductionDept && (
              <div className="space-y-0.5">
                <Link
                  href="/production"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/production"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ClipboardList className="w-4 h-4" />
                    <span>Production Mixing</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      pathname === "/production" ? "text-white/70" : "text-slate-300"
                    }`}
                  />
                </Link>
              </div>
            )}

            {/* Product Storage (Finished Goods Cold Room) Link */}
            {isProductStorageDept && (
              <div className="space-y-0.5">
                <Link
                  href="/product-storage"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/product-storage"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Warehouse className="w-4 h-4" />
                    <span>Product Storage</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      pathname === "/product-storage" ? "text-white/70" : "text-slate-300"
                    }`}
                  />
                </Link>
              </div>
            )}

            {/* Logistics & Cold-Chain Dispatch Link */}
            {isLogisticsDept && (
              <div className="space-y-0.5">
                <Link
                  href="/logistics"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/logistics"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4" />
                    <span>Logistics & Dispatch</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      pathname === "/logistics" ? "text-white/70" : "text-slate-300"
                    }`}
                  />
                </Link>
              </div>
            )}

            {/* Returns & Root Cause Analysis Link */}
            {isReturnsDept && (
              <div className="space-y-0.5">
                <Link
                  href="/returns"
                  onClick={onCloseMobile}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/returns"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4" />
                    <span>Returns & Why</span>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${
                      pathname === "/returns" ? "text-white/70" : "text-slate-300"
                    }`}
                  />
                </Link>
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
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    pathname === "/admin"
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>System Administration</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 ${pathname === "/admin" ? "text-white/70" : "text-slate-300"}`} />
                </Link>

                {pathname === "/admin" && (
                  <div className="pl-6 pr-2 py-1 space-y-0.5 border-l border-slate-200 ml-4 my-1 text-[11px]">
                    <button
                      type="button"
                      onClick={(e) => handleAdminTab(e, "staff")}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                        activeHash === "staff" || (!activeHash && pathname === "/admin")
                          ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                          : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                      }`}
                    >
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>Staff & Tablet PINs</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleAdminTab(e, "departments")}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                        activeHash === "departments"
                          ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                          : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                      }`}
                    >
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>Modular Hierarchy</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleAdminTab(e, "security")}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded-lg font-medium text-[11px] transition-colors cursor-pointer text-left ${
                        activeHash === "security"
                          ? "text-[#CF0458] bg-rose-50/80 font-semibold"
                          : "text-slate-600 hover:text-[#CF0458] hover:bg-slate-50"
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3 text-slate-400" />
                      <span>RBAC & Security</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Slated Modules Roadmap */}
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
                <Store className="w-3.5 h-3.5 text-slate-400" />
                <span>Retail Merchandising</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Phase 6</span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
              <span className="flex items-center gap-2 font-medium">
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                <span>Factory Accounting</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">Phase 7</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pinned Bottom Operator Card & Session Controls */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/70 p-3">
        {/* Notifications & Settings Navigation Links directly above username */}
        <div className="space-y-1 mb-2.5">
          <Link
            href="/notifications"
            onClick={onCloseMobile}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              pathname === "/notifications"
                ? "bg-[#CF0458] text-white shadow-xs"
                : "text-slate-700 hover:bg-slate-200/70 bg-white border border-slate-200/80"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </div>
            <ChevronRight
              className={`w-3.5 h-3.5 ${pathname === "/notifications" ? "text-white/70" : "text-slate-400"}`}
            />
          </Link>

          <Link
            href="/settings"
            onClick={onCloseMobile}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              pathname === "/settings"
                ? "bg-[#CF0458] text-white shadow-xs"
                : "text-slate-700 hover:bg-slate-200/70 bg-white border border-slate-200/80"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </div>
            <ChevronRight
              className={`w-3.5 h-3.5 ${pathname === "/settings" ? "text-white/70" : "text-slate-400"}`}
            />
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-2.5">
          {/* Avatar circle */}
          <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-extrabold text-xs shrink-0">
            {getInitials(user?.fullName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate">
              {user?.fullName || "Staff Member"}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="font-mono font-semibold text-slate-600 truncate">
                {user?.staffId || "MOH-STAFF"}
              </span>
              <span>•</span>
              <span className="font-medium text-slate-500 truncate">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* PWA 1-Click Install Button (Shown on desktop/tablets when installable) */}
        {canInstallPwa && (
          <button
            type="button"
            onClick={handleSidebarInstall}
            className="w-full mb-2 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-[#CF0458] to-[#AD1457] hover:from-[#B5034C] hover:to-[#CF0458] text-white text-[11px] font-extrabold shadow-sm shadow-[#CF0458]/20 transition-all cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5 text-rose-200 shrink-0" />
            <span>Install MOH-OPS App</span>
          </button>
        )}

        {/* Action Buttons: Quick Lock & Sign Out */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
              lockTerminal();
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-slate-600" />
            <span>Lock PIN</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Immovable Sidebar */}
      <aside className="hidden lg:block w-64 xl:w-72 shrink-0 h-screen sticky top-0 border-r border-slate-200 z-30 select-none bg-white">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Slide-out Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl z-50 animate-in slide-in-from-left duration-150">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
