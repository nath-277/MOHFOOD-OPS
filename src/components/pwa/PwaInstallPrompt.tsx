"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import {
  Download,
  Share2,
  PlusSquare,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
} from "lucide-react";

// Global listener to capture beforeinstallprompt before React hydrates
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    (window as any).__pwaInstallPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa:prompt-ready"));
  });
}

export function PwaInstallPrompt() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelperModal, setShowHelperModal] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (PWA installed)
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isNavStandalone = (window.navigator as any).standalone === true;
      const isAndroidReferrer = document.referrer.includes("android-app://");
      return isDisplayStandalone || isNavStandalone || isAndroidReferrer;
    };

    setIsStandalone(checkStandalone());

    // 2. Check if mobile or tablet device or small screen viewport
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /android|iphone|ipad|ipod|windows phone|iemobile|mobile/i.test(userAgent);
    const isSmallScreen = window.innerWidth <= 1024;
    const mobileOrTablet = isMobileUA || isTouchDevice || isSmallScreen;
    setIsMobileOrTablet(mobileOrTablet);

    // 3. Detect iOS Safari
    const ios = /iphone|ipad|ipod/i.test(userAgent);
    setIsIOS(ios);

    // 4. Check session storage for temporary override
    const bypassed = sessionStorage.getItem("moh_force_install_bypassed");
    if (bypassed === "true") {
      setIsDismissed(true);
    }

    // 5. Register Service Worker to satisfy Chrome PWA installability criteria
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[MOH-OPS] PWA Service Worker active:", reg.scope);
        })
        .catch((err) => {
          console.warn("[MOH-OPS] SW registration:", err);
        });
    }

    // 6. Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log("[MOH-OPS] App installed successfully!");
      setIsStandalone(true);
      setDeferredPrompt(null);
      if (typeof window !== "undefined") (window as any).__pwaInstallPrompt = null;
      setIsDismissed(true);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // 7. Pick up globally captured beforeinstallprompt or attach listener
    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (typeof window !== "undefined" && (window as any).__pwaInstallPrompt);

    // If on Chrome/Chromium and promptEvent is ready, trigger native prompt immediately!
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
          if (typeof window !== "undefined") (window as any).__pwaInstallPrompt = null;
          setIsDismissed(true);
        }
        return; // Always return after triggering native prompt! Never show instructions!
      } catch (err) {
        console.warn("[MOH-OPS] Install prompt error:", err);
      }
    }

    // If Apple iOS Safari: WebKit strictly enforces manual Share menu
    if (isIOS) {
      setShowHelperModal(true);
      return;
    }

    // If on Chrome/Chromium and promptEvent was null (e.g. Incognito or address bar install):
    setShowHelperModal(true);
  };

  const handleBypass = () => {
    sessionStorage.setItem("moh_force_install_bypassed", "true");
    setIsDismissed(true);
  };

  // If already standalone (running as installed app) or not a mobile/tablet, do not render
  if (isStandalone || !isMobileOrTablet) {
    return null;
  }

  // If bypassed for this session, render a compact persistent reminder banner
  if (isDismissed) {
    return (
      <div className="bg-slate-900 text-white px-3 py-2 text-xs flex items-center justify-between z-40 border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0 animate-pulse" />
          <span className="text-[11px] text-slate-300 truncate">
            MOH-OPS Kiosk: Running in standard browser tab.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="shrink-0 ml-2 px-2.5 py-1 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white text-[10px] font-bold transition-all cursor-pointer"
        >
          Install App
        </button>
      </div>
    );
  }

  // Fullscreen Modern Install Screen (Centered Hero & Single Install Button)
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-y-auto p-5 sm:p-8 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Logo size="sm" showTagline={false} className="brightness-110" />
          <span className="font-bold text-xs text-slate-300 tracking-wider font-mono">
            MOH-OPS
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-[#84BD00] bg-[#84BD00]/10 border border-[#84BD00]/20 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Factory Terminal</span>
        </div>
      </div>

      {/* Main Hero Card */}
      <div className="my-auto py-8 max-w-md mx-auto w-full text-center flex flex-col items-center">
        {/* App Logo Glow */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-[#8E1538]/30 rounded-3xl blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-white border-2 border-[#8E1538]/40 flex items-center justify-center shadow-2xl shadow-[#8E1538]/40 p-2 overflow-hidden">
            <Image
              src="/Moh-logo.png"
              alt="Moh Foods Logo"
              width={64}
              height={64}
              className="object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Install MOH-OPS App
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
          Get the fast, dedicated full-screen experience with offline sync and direct camera scanner access.
        </p>

        {/* Value Props Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5 mb-8">
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
            Offline Shift Sync
          </span>
        </div>

        {/* PRIMARY ACTION: Big Install Button */}
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-[#8E1538] via-[#A81842] to-[#8E1538] hover:from-[#72102C] hover:to-[#8E1538] text-white text-base font-extrabold shadow-xl shadow-[#8E1538]/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer hover:shadow-2xl hover:shadow-[#8E1538]/40"
        >
          <Download className="w-5 h-5 text-rose-200" />
          <span>Install MOH-OPS App</span>
        </button>

        {/* Subtle Continue in Browser link */}
        <button
          type="button"
          onClick={handleBypass}
          className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors cursor-pointer py-1"
        >
          Continue in browser instead →
        </button>
      </div>

      {/* Footer Branding */}
      <div className="pt-4 border-t border-slate-800/80 text-center">
        <span className="text-[11px] text-slate-500">
          Moh Foods NG Operations Platform • NAFDAC Reg. A8-106771
        </span>
      </div>

      {/* Helper Modal (Triggered when browser requires manual tap, like iOS Safari) */}
      {showHelperModal && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 text-left shadow-2xl relative animate-in slide-in-from-bottom-6 duration-200">
            <button
              type="button"
              onClick={() => setShowHelperModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800/80 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-[#8E1538]/20 border border-[#8E1538]/40 flex items-center justify-center text-rose-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {isIOS ? "Install on Apple iOS" : "Install on Browser"}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {isIOS ? "Apple Safari requires 2 quick taps:" : "2 quick taps in browser:"}
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 my-4 text-xs text-slate-200 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold shrink-0">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <p className="leading-tight">
                    1. Tap the <strong className="text-white">Share</strong> button at the bottom of Safari.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[11px] font-bold shrink-0">
                    <PlusSquare className="w-3.5 h-3.5" />
                  </div>
                  <p className="leading-tight">
                    2. Scroll and tap <strong className="text-white">Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 my-4 text-xs text-slate-200 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-[#8E1538]/20 text-rose-400 border border-[#8E1538]/40 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <p className="leading-snug">
                    In Chrome, click the <strong className="text-white">Install App</strong> icon (⤓) in the address bar, or tap the browser menu (<strong className="text-white">⋮</strong>) &rarr; <strong className="text-white">Install App</strong>.
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-tight">
                  <strong className="text-amber-200">Note:</strong> Chrome disables 1-click PWA install in <em>Incognito / Private</em> windows. Please open in a standard tab if you are currently in Incognito.
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowHelperModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer text-center"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
