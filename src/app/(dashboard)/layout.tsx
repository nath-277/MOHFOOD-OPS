"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { PullToRefresh } from "@/components/layout/PullToRefresh";
import { ShiftProvider, useShift } from "@/components/shift/ShiftContext";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { activeShift, setActiveShift } = useShift();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="h-screen w-full max-w-full overflow-hidden flex bg-[#F8FAFC] print:h-auto print:overflow-visible print:bg-white">
      {/* Immovable Left Sidebar */}
      <div className="print:hidden">
        <Sidebar
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
          activeShift={activeShift}
          onShiftChange={setActiveShift}
        />
      </div>

      {/* Right Content Pane (Scrolls independently while left sidebar stays 100% immovable) */}
      <PullToRefresh className="flex-1 h-screen overflow-y-auto overflow-x-hidden flex flex-col min-w-0 w-full max-w-full print:h-auto print:overflow-visible print:block">
        <div className="print:hidden">
          <TopHeader
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            activeShift={activeShift}
          />
        </div>

        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-16 sm:py-6 min-w-0 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
          {children}
        </main>

        {/* Clean Plant Floor Footer with Mobile Breathing Room */}
        <footer className="border-t border-slate-200 bg-white/95 backdrop-blur-xs py-4 px-4 sm:px-6 text-center text-xs text-slate-500 pb-[calc(1.25rem+env(safe-area-inset-bottom))] print:hidden">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-bold text-[#CF0458]">Moh Foods NG</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-600">Moh Industries Ltd</span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold border border-slate-200">
                NAFDAC Reg: A8-106771
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-400">
              <span>Shift Dispatch: <strong className="text-slate-600 font-semibold">+234 701 073 1559</strong></span>
              <span className="text-slate-300">•</span>
              <span>operations@mohfood.com</span>
            </div>
          </div>
        </footer>
      </PullToRefresh>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFFDF9]">
        <Logo size="md" className="animate-pulse mb-4" />
        <p className="text-xs font-bold text-[#CF0458] tracking-wider uppercase">
          Verifying Session Permissions...
        </p>
      </div>
    );
  }

  return (
    <ShiftProvider>
      <DashboardShell>{children}</DashboardShell>
    </ShiftProvider>
  );
}
