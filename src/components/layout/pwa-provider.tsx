"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { Logo } from "@/components/brand/Logo";
import {
  Download,
  Share2,
  PlusSquare,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Zap,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
  Globe,
  Terminal,
} from "lucide-react";

interface PwaContextType {
  isInstallable: boolean;
  isStandalone: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isSecure: boolean;
  installApp: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isStandalone: false,
  isMobile: false,
  isIOS: false,
  isSecure: true,
  installApp: async () => {},
});

export const usePwa = () => useContext(PwaContext);

// Capture early beforeinstallprompt before React mounts
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
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [isBypassed, setIsBypassed] = useState(false);
  const [isForceInstall, setIsForceInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [originUrl, setOriginUrl] = useState("");

  useEffect(() => {
    setIsMounted(true);

    if (typeof window === "undefined") return;

    setOriginUrl(window.location.origin);

    // 1. Service Worker Registration
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[MOH-OPS PWA] Service worker registered on scope:", reg.scope);
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
    setIsStandalone(checkStandalone());

    // 3. Environment & Security Detection
    const userAgent = window.navigator.userAgent || "";
    const isApple = /iPhone|iPad|iPod/i.test(userAgent);
    const isDroid = /Android/i.test(userAgent);
    const isMob = isApple || isDroid || /Mobile/i.test(userAgent);
    setIsIOS(isApple);
    setIsAndroid(isDroid);
    setIsMobile(isMob);

    // Secure context: localhost, 127.0.0.1, or HTTPS
    const secure = window.isSecureContext === true;
    setIsSecure(secure);

    // 4. Developer Force Parameter (?force_install=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get("force_install") === "true") {
      setIsForceInstall(true);
    }

    // Check session storage for staff override
    const bypassed = sessionStorage.getItem("moh_force_install_bypassed") === "true";
    setIsBypassed(bypassed);

    // 5. Capture Deferred Prompt
    if ((window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      console.log("[MOH-OPS PWA] App successfully installed to Home Screen");
      setIsStandalone(true);
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
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
        console.warn("[MOH-OPS PWA] Prompt failed:", err);
      }
    }
  };

  const handleBypass = () => {
    sessionStorage.setItem("moh_force_install_bypassed", "true");
    setIsBypassed(true);
  };

  const copyOriginToClipboard = () => {
    if (originUrl) {
      navigator.clipboard.writeText(originUrl);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2500);
    }
  };

  if (!isMounted) {
    return <>{children}</>;
  }

  // Gate is displayed on mobile non-standalone or when forced via query param
  const shouldShowInstallGate = !isStandalone && !isBypassed && (isMobile || isForceInstall);

  if (shouldShowInstallGate) {
    return (
      <div className="fixed inset-0 z-50 bg-[#07090E] text-white flex flex-col justify-between overflow-y-auto p-4 sm:p-8 animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 sm:pb-4">
          <div className="flex items-center gap-2">
            <Logo size="sm" showTagline={false} className="brightness-110" />
            <span className="font-bold text-xs text-slate-300 tracking-wider font-mono">
              MOH-OPS
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#84BD00] bg-[#84BD00]/10 border border-[#84BD00]/25 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Factory Floor Kiosk</span>
          </div>
        </div>

        {/* Center Card */}
        <div className="my-auto py-6 max-w-md mx-auto w-full text-center flex flex-col items-center">
          {/* Logo Badge */}
          <div className="relative mb-5">
            <div className="absolute -inset-3 bg-[#CF0458]/30 rounded-3xl blur-xl animate-pulse" />
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white border-2 border-[#CF0458]/40 shadow-2xl shadow-[#CF0458]/50 flex items-center justify-center p-3 overflow-hidden">
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
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
            MOH-OPS runs as a standalone factory application to ensure full-screen floor operation, barcode scanning, and offline sync.
          </p>

          {/* Value Props */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
              <Zap className="w-3 h-3 text-[#84BD00]" />
              No Browser Toolbar
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
              <Sparkles className="w-3 h-3 text-[#FF9065]" />
              Fast Camera Intake
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
              <CheckCircle2 className="w-3 h-3 text-[#CF0458]" />
              Plant Ledger Sync
            </span>
          </div>

          {/* Conditional Path: Insecure LAN HTTP vs Secure Production/Localhost */}
          {!isSecure && isMobile ? (
            /* INSECURE CONTEXT DIAGNOSIS (Local IP HTTP) */
            <div className="w-full bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-left space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>LAN HTTP Security Notice</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Mobile Chrome enforces HTTPS for PWA WebAPK installation. Over local IP (<code className="text-amber-300 font-mono">{originUrl}</code>), Chrome only displays <em>&ldquo;Create shortcut&rdquo;</em>.
              </p>

              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 space-y-2 text-xs">
                <p className="font-semibold text-white text-[11px]">Quick 10-Second Mobile Testing Fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                  <li>In mobile Chrome, navigate to: <span className="text-rose-400 font-mono">chrome://flags</span></li>
                  <li>Search: <strong className="text-white">treat-insecure</strong></li>
                  <li>Enable & paste: <span className="text-amber-300 font-mono">{originUrl}</span></li>
                  <li>Tap <strong className="text-white">Relaunch</strong>. Full PWA install will activate!</li>
                </ol>
                <button
                  type="button"
                  onClick={copyOriginToClipboard}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-colors"
                >
                  {copiedFlag ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied {originUrl} to clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Origin URL for Chrome Flag</span>
                    </>
                  )}
                </button>
              </div>

              <div className="pt-1 text-[11px] text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span>Or run <code className="text-slate-200 bg-slate-900 px-1 py-0.5 rounded">bun run tunnel</code> on PC for HTTPS.</span>
              </div>
            </div>
          ) : isIOS ? (
            /* APPLE IOS SAFARI GUIDE */
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 text-left space-y-3 shadow-xl">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <span>iOS Safari Install Guide</span>
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
            /* ANDROID / CHROMIUM NATIVE 1-CLICK INSTALL */
            <div className="w-full space-y-3">
              <button
                type="button"
                onClick={installApp}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#CF0458] via-[#A81842] to-[#CF0458] hover:from-[#B5034C] hover:to-[#CF0458] text-white text-base font-extrabold shadow-xl shadow-[#CF0458]/35 flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer hover:shadow-2xl hover:shadow-[#CF0458]/50"
              >
                <Download className="w-5 h-5 text-rose-200" />
                <span>Install MOH-OPS App</span>
              </button>

              {!deferredPrompt && (
                <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  Or tap Chrome menu (<strong className="text-white">⋮</strong>) &rarr; <strong className="text-white">Install App</strong>
                </p>
              )}
            </div>
          )}

          {/* Universal Staff / Developer Bypass Override */}
          <button
            type="button"
            onClick={handleBypass}
            className="mt-5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-2 px-4 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 flex items-center gap-1.5 mx-auto"
          >
            <span>Continue in Browser (Staff Temporary Override)</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom Footer */}
        <div className="pt-3 border-t border-slate-800/80 text-center flex items-center justify-between text-[11px] text-slate-500">
          <span>Moh Foods Operations Platform</span>
          <span>NAFDAC Reg. A8-106771</span>
        </div>
      </div>
    );
  }

  // Normal App View
  return (
    <PwaContext.Provider
      value={{
        isInstallable: Boolean(deferredPrompt),
        isStandalone,
        isMobile,
        isIOS,
        isSecure,
        installApp,
      }}
    >
      {/* Compact persistent banner if staff bypassed full-screen gate on mobile */}
      {isBypassed && !isStandalone && isMobile && (
        <div className="bg-slate-900 text-white px-3 py-2 text-xs flex items-center justify-between z-40 border-b border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0 animate-pulse" />
            <span className="text-[11px] text-slate-300 truncate">
              MOH-OPS: Browser tab mode ({isSecure ? "Secure" : "LAN HTTP"})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsBypassed(false)}
            className="shrink-0 ml-2 px-2.5 py-1 rounded-lg bg-[#CF0458] hover:bg-[#B5034C] text-white text-[10px] font-bold transition-all cursor-pointer"
          >
            Install App
          </button>
        </div>
      )}
      {children}
    </PwaContext.Provider>
  );
}
