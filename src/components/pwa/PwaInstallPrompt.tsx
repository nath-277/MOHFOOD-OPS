"use client";

import React, { useState, useEffect } from "react";
import { Logo } from "@/components/brand/Logo";
import {
  Download,
  Share2,
  PlusSquare,
  Smartphone,
  Tablet,
  CheckCircle2,
  ArrowRight,
  X,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

export function PwaInstallPrompt() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (PWA installed)
    const checkStandalone = () => {
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isNavStandalone = (window.navigator as any).standalone === true;
      const isAndroidReferrer = document.referrer.includes("android-app://");
      return isDisplayStandalone || isNavStandalone || isAndroidReferrer;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    // 2. Check if mobile or tablet device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /android|iphone|ipad|ipod|windows phone|iemobile|mobile/i.test(userAgent);
    const isTabletWidth = window.innerWidth <= 1024;
    const mobileOrTablet = (isMobileUA || (isTouchDevice && isTabletWidth));
    setIsMobileOrTablet(mobileOrTablet);

    // 3. Detect iOS Safari
    const ios = /iphone|ipad|ipod/i.test(userAgent);
    setIsIOS(ios);

    // 4. Check session storage for temporary override
    const bypassed = sessionStorage.getItem("moh_force_install_bypassed");
    if (bypassed === "true") {
      setIsDismissed(true);
    }

    // 5. Capture beforeinstallprompt event (Android Chrome)
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsDismissed(true);
      }
    }
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

  // Fullscreen Force Install Screen
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
          <span>NAFDAC Terminal Required</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="my-auto py-6 max-w-md mx-auto w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#8E1538]/20 border border-[#8E1538]/40 text-[#8E1538] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#8E1538]/10">
          <Download className="w-8 h-8 text-rose-400" />
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Install MOH-OPS App
        </h2>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          This operations floor terminal requires installation to your mobile or tablet home screen for kiosk security, full-screen view, and reliable camera scanner access.
        </p>

        {/* Installation Instructions Box */}
        <div className="mt-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-left space-y-3.5">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            {isIOS ? (
              <>
                <Smartphone className="w-3.5 h-3.5 text-rose-400" />
                <span>Apple iOS Safari Instructions</span>
              </>
            ) : (
              <>
                <Tablet className="w-3.5 h-3.5 text-rose-400" />
                <span>Android / Tablet Chrome Instructions</span>
              </>
            )}
          </div>

          {isIOS ? (
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                  1
                </div>
                <p className="leading-snug">
                  Tap the <strong className="text-white">Share</strong> button (box with upward arrow) in the Safari toolbar.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                  2
                </div>
                <p className="leading-snug">
                  Scroll down and tap <strong className="text-white">Add to Home Screen</strong> (<PlusSquare className="w-3 h-3 inline mx-0.5 text-rose-400" />).
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                  3
                </div>
                <p className="leading-snug">
                  Tap <strong className="text-white">Add</strong>, then launch <strong className="text-white">MOH-OPS</strong> directly from your Home Screen.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs text-slate-300">
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-3 px-4 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>Tap to Install MOH-OPS to Tablet</span>
                </button>
              ) : (
                <>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      1
                    </div>
                    <p className="leading-snug">
                      Tap the Chrome menu <strong className="text-white">(⋮)</strong> in the upper-right corner.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      2
                    </div>
                    <p className="leading-snug">
                      Tap <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                      3
                    </div>
                    <p className="leading-snug">
                      Open <strong className="text-white">MOH-OPS</strong> directly from your apps list for full kiosk features.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
        <span className="text-[11px] text-slate-500">
          Moh Foods Operations Platform • Mobile & Tablet Terminal
        </span>

        <button
          type="button"
          onClick={handleBypass}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold border border-slate-800 transition-all cursor-pointer"
        >
          Continue in Browser (Staff Temporary Override) →
        </button>
      </div>
    </div>
  );
}
