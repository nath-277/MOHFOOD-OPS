"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import {
  Download,
  Share2,
  PlusSquare,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";

interface PwaContextType {
  isInstallable: boolean;
  isStandalone: boolean;
  isMobile: boolean;
  isIOS: boolean;
  installApp: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isStandalone: false,
  isMobile: false,
  isIOS: false,
  installApp: async () => {},
});

export const usePwa = () => useContext(PwaContext);

// Global early capture for beforeinstallprompt
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    (window as any).__pwaInstallPrompt = e;
  });
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isBypassed, setIsBypassed] = useState(false);
  const [isForceInstall, setIsForceInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // 1. Service Worker Registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[MOH-OPS PWA] Service worker active:", reg.scope);
        })
        .catch((err) => {
          console.warn("[MOH-OPS PWA] Service worker registration failed:", err);
        });
    }

    // 2. Standalone Mode Detection (iOS + Android/Desktop)
    const checkStandalone = () => {
      const isNavStandalone = (window.navigator as any).standalone === true;
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isAndroidReferrer = document.referrer.includes("android-app://");
      return isNavStandalone || isDisplayStandalone || isAndroidReferrer;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    // 3. Environment Detection (Mobile User Agent)
    const userAgent = window.navigator.userAgent || "";
    const mobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
    const ios = /iPhone|iPad|iPod/i.test(userAgent);
    setIsMobile(mobile);
    setIsIOS(ios);

    // 4. Developer Bypass & Force Parameter Detection (?force_install=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get("force_install") === "true") {
      setIsForceInstall(true);
    }

    // Check session storage for temporary staff override
    const bypassed = sessionStorage.getItem("moh_force_install_bypassed") === "true";
    setIsBypassed(bypassed);

    // 5. Capture beforeinstallprompt Event
    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 6. Handle successful app install
    const handleAppInstalled = () => {
      console.log("[MOH-OPS PWA] App installed successfully");
      setIsStandalone(true);
      setInstallSuccess(true);
      setDeferredPrompt(null);
      if (typeof window !== "undefined") (window as any).__pwaInstallPrompt = null;
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    const promptEvent = deferredPrompt || (typeof window !== "undefined" && (window as any).__pwaInstallPrompt);
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === "accepted") {
          setDeferredPrompt(null);
          if (typeof window !== "undefined") (window as any).__pwaInstallPrompt = null;
          setIsStandalone(true);
        }
      } catch (err) {
        console.warn("[MOH-OPS PWA] Install prompt error:", err);
      }
    }
  };

  const handleBypass = () => {
    sessionStorage.setItem("moh_force_install_bypassed", "true");
    setIsBypassed(true);
  };

  // During initial SSR hydration, render children cleanly
  if (!isMounted) {
    return <>{children}</>;
  }

  // Determine if the full-screen install gate should be enforced
  const shouldShowInstallGate =
    !isStandalone && !isBypassed && (isMobile || isForceInstall);

  // Forced Mobile Install Gate (Dark Glassmorphic Fullscreen UI)
  if (shouldShowInstallGate) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xl text-white flex flex-col justify-between overflow-y-auto p-5 sm:p-8 animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <Logo size="sm" showTagline={false} className="brightness-110" />
            <span className="font-bold text-xs text-slate-300 tracking-wider font-mono">
              MOH-OPS
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#84BD00] bg-[#84BD00]/10 border border-[#84BD00]/20 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Factory Terminal</span>
          </div>
        </div>

        {/* Center Install Hero Card */}
        <div className="my-auto py-8 max-w-sm mx-auto w-full text-center flex flex-col items-center">
          {/* Logo Badge with Brand Glow */}
          <div className="relative mb-6">
            <div className="absolute -inset-3 bg-[#8E1538]/30 rounded-3xl blur-xl animate-pulse" />
            <div className="relative w-24 h-24 rounded-3xl bg-white border-2 border-[#8E1538]/40 shadow-2xl shadow-[#8E1538]/50 flex items-center justify-center p-3 overflow-hidden">
              <Image
                src="/Moh-Logo.png"
                alt="Moh Foods Logo"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Install MOH-OPS App
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
            This terminal requires installation to your mobile device for clean full-screen kiosk operations, offline queue sync, and barcode scanning.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5 mb-7">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
              <Zap className="w-3 h-3 text-[#84BD00]" />
              Full-Screen Kiosk
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
              <Sparkles className="w-3 h-3 text-[#FF9065]" />
              Camera Scanner
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
              <CheckCircle2 className="w-3 h-3 text-[#8E1538]" />
              Offline Sync
            </span>
          </div>

          {/* Platform Specific Install Action */}
          {isIOS ? (
            /* Apple iOS (Safari) - Visual 2-Step Instructions */
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left space-y-3 shadow-xl">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>Apple iOS Safari Install Guide</span>
              </div>
              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <p className="leading-tight">
                    1. Tap the <strong className="text-white">Share</strong> icon in the bottom Safari toolbar.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <p className="leading-tight">
                    2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Android / Chromium - Direct 1-Click Install Button */
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={installApp}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#8E1538] via-[#A81842] to-[#8E1538] hover:from-[#72102C] hover:to-[#8E1538] text-white text-base font-extrabold shadow-xl shadow-[#8E1538]/35 flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer hover:shadow-2xl hover:shadow-[#8E1538]/50"
              >
                <Download className="w-5 h-5 text-rose-200" />
                <span>Install App Now</span>
              </button>

              {!deferredPrompt && (
                <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  Or tap Chrome menu (<strong className="text-white">⋮</strong>) &rarr; <strong className="text-white">Install App</strong>
                </p>
              )}
            </div>
          )}

          {/* Developer / Staff Bypass Override */}
          <button
            type="button"
            onClick={handleBypass}
            className="mt-5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-900"
          >
            Continue in Browser (Staff Temporary Override) &rarr;
          </button>
        </div>

        {/* Bottom Footer */}
        <div className="pt-4 border-t border-slate-800/80 text-center flex items-center justify-between text-[11px] text-slate-500">
          <span>Moh Foods Operations Platform</span>
          <span>NAFDAC Reg. A8-106771</span>
        </div>
      </div>
    );
  }

  // Normal App View with Context Provider & Bypassed Reminder Banner
  return (
    <PwaContext.Provider
      value={{
        isInstallable: Boolean(deferredPrompt),
        isStandalone,
        isMobile,
        isIOS,
        installApp,
      }}
    >
      {/* Compact persistent banner if staff bypassed full-screen gate on mobile */}
      {isBypassed && !isStandalone && isMobile && (
        <div className="bg-slate-900 text-white px-3 py-2 text-xs flex items-center justify-between z-40 border-b border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0 animate-pulse" />
            <span className="text-[11px] text-slate-300 truncate">
              MOH-OPS: Running in mobile browser tab.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsBypassed(false)}
            className="shrink-0 ml-2 px-2.5 py-1 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white text-[10px] font-bold transition-all cursor-pointer"
          >
            Install App
          </button>
        </div>
      )}
      {children}
    </PwaContext.Provider>
  );
}
