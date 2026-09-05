"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Logo } from "@/components/brand/Logo";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Package,
  Boxes,
  RotateCcw,
  Clock,
  Briefcase,
  Layers,
  FileSpreadsheet,
  Users,
  LogOut,
  Lock,
  Sun,
  Moon,
  ChevronDown,
  Building2,
  PhoneCall,
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [activeShift, setActiveShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF9]">
        <Logo size="md" className="animate-pulse mb-4" />
        <p className="text-xs font-bold text-[#D81B60] tracking-wider uppercase">
          Verifying Session Permissions...
        </p>
      </div>
    );
  }

  const role = user?.role || "STAFF";
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isExecutive = isSuperAdmin || role === "EXECUTIVE";
  const isStoreDept = isSuperAdmin || role === "STORE_MANAGER" || role === "STORE_OFFICER";

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        {/* Accent Brand Stripe */}
        <div className="h-1.5 bg-gradient-to-r from-[#D81B60] via-[#84BD00] to-[#008153]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand Logo & Department Badge */}
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:opacity-95 transition-opacity">
                <Logo size="sm" showTagline={false} />
              </Link>

              <div className="hidden md:flex items-center gap-2 pl-4 border-l border-slate-200">
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E8F5E9] text-[#008153] border border-[#008153]/20 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{user?.departmentName || "Operations Department"}</span>
                </span>
              </div>
            </div>

            {/* Center: Shift Badge (For Store Staff) */}
            {isStoreDept && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowShiftDropdown(!showShiftDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-bold text-[#2B1B24] transition-all cursor-pointer"
                >
                  {activeShift === "MORNING_SHIFT" ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span>Morning Shift (06:00 - 14:30)</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Night Shift (18:00 - 02:30)</span>
                    </>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>

                {showShiftDropdown && (
                  <div className="absolute top-full mt-1 left-0 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveShift("MORNING_SHIFT");
                        setShowShiftDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-amber-50 flex items-center gap-2 text-slate-700"
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="font-bold">Morning Shift</div>
                        <div className="text-[10px] text-slate-400">06:00 - 14:30 Dispensing</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveShift("NIGHT_SHIFT");
                        setShowShiftDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold hover:bg-indigo-50 flex items-center gap-2 text-slate-700"
                    >
                      <Moon className="w-4 h-4 text-indigo-500" />
                      <div>
                        <div className="font-bold">Night Shift</div>
                        <div className="text-[10px] text-slate-400">18:00 - 02:30 Dispensing</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Right: Operator Profile & Action Controls */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-[#2B1B24]">{user?.fullName || "Staff User"}</span>
                <div className="flex items-center justify-end gap-1 text-[11px] text-[#64748B]">
                  <span className="font-mono font-medium">{user?.staffId}</span>
                  <span>•</span>
                  <span className="font-bold text-[#D81B60]">{user?.role}</span>
                </div>
              </div>

              {/* Tablet Lock Button */}
              <button
                type="button"
                onClick={() => router.push("/pin-lock")}
                title="Lock Terminal to PIN Screen"
                className="p-2 rounded-xl bg-slate-100 hover:bg-[#FCE4EC] text-slate-600 hover:text-[#D81B60] border border-slate-200 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Department Navigation Links */}
          <nav className="flex items-center space-x-1 overflow-x-auto py-2 border-t border-slate-100 no-scrollbar">
            {isStoreDept && (
              <>
                <Link
                  href="/inventory"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    pathname === "/inventory"
                      ? "bg-[#D81B60] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Store Inventory</span>
                </Link>
                <Link
                  href="/inventory#intake"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Raw Material Intake</span>
                </Link>
                <Link
                  href="/inventory#dispense"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Shift Batch Dispensing</span>
                </Link>
                <Link
                  href="/inventory#returns"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Fault & Excess Returns</span>
                </Link>
              </>
            )}

            {isExecutive && (
              <>
                <div className="h-4 w-px bg-slate-200 mx-2" />
                <Link
                  href="/management"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    pathname === "/management"
                      ? "bg-[#008153] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Executive Hub</span>
                </Link>
                <Link
                  href="/management#sor"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Supermarket SoR Ledger</span>
                </Link>
                <Link
                  href="/management#whatsapp"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>WhatsApp Invoices</span>
                </Link>
              </>
            )}

            {isSuperAdmin && (
              <>
                <div className="h-4 w-px bg-slate-200 mx-2" />
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    pathname === "/admin"
                      ? "bg-purple-700 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Admin & Users</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#D81B60]">Moh Foods Operations Platform</span>
            <span>•</span>
            <span>NAFDAC Reg No. A8-106771</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Production Shift Support: +234 701 073 1559</span>
            <span>umoh2475@gmail.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
