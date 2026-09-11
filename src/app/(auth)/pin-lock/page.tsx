"use client";

import React, { useState, Suspense } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Logo } from "@/components/brand/Logo";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Delete, ArrowLeft, ShieldCheck, AlertCircle, Lock } from "lucide-react";

function PinLockContent() {
  const { user, unlockTerminal, isTerminalLocked } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/inventory";
  const isLocked = searchParams.get("locked") === "true" || isTerminalLocked;

  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [showDemoPins, setShowDemoPins] = useState<boolean>(false);
  const isProduction = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_HIDE_DEMO_ACCOUNTS === "true";

  const handleDigit = async (digit: string) => {
    if (loading || pin.length >= 4) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === 4) {
      setLoading(true);
      const res = await unlockTerminal(newPin);
      if (res.success) {
        router.push(returnTo || res.redirectUrl || "/inventory");
      } else {
        setError(res.error || "Incorrect PIN code. Please try again.");
        setPin("");
        setLoading(false);
      }
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (loading) return;
    setPin("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2B1B24] via-[#1E293B] to-[#111827] text-white flex flex-col justify-between items-center px-4 py-8 select-none">
      {/* Top Header */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <Link
          href="/login"
          className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-2 rounded-xl transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Password Login</span>
        </Link>
        <div className="flex items-center gap-1 text-[11px] font-bold text-[#84BD00] bg-[#84BD00]/10 border border-[#84BD00]/20 px-2.5 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Store Floor Terminal</span>
        </div>
      </div>

      {/* Center PIN HUD */}
      <div className="w-full max-w-xs flex flex-col items-center my-auto">
        <Logo size="md" className="mb-4 brightness-110" />

        <h1 className="text-xl font-bold text-white text-center">Store Counter Terminal</h1>
        <p className="text-xs text-slate-400 text-center mb-4">
          Enter your 4-digit staff PIN to unlock shift actions
        </p>

        {isLocked && user && (
          <div className="w-full mb-5 px-3 py-2 rounded-xl bg-[#CF0458]/30 border border-[#CF0458]/50 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-rose-300">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span>Terminal Locked (Session Preserved)</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 font-medium">
              Operator: {user.fullName} ({user.role.replace("_", " ")})
            </div>
          </div>
        )}

        {/* PIN Bubble Display */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-[#CF0458] shadow-md shadow-[#CF0458]/50 scale-110 border-2 border-white"
                    : "bg-slate-700/60 border-2 border-slate-600"
                }`}
              />
            );
          })}
        </div>

        {error && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-center justify-center gap-2 text-center animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Numeric Keypad (Ergonomic Touch Targets for Gloved Hands) */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl bg-white/10 hover:bg-[#CF0458] active:scale-95 transition-all text-2xl font-bold flex items-center justify-center border border-white/10 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          {/* Bottom Row */}
          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleClear}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
          >
            Clear
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit("0")}
            className="h-16 rounded-2xl bg-white/10 hover:bg-[#CF0458] active:scale-95 transition-all text-2xl font-bold flex items-center justify-center border border-white/10 shadow-sm cursor-pointer disabled:opacity-50"
          >
            0
          </button>

          <button
            type="button"
            disabled={loading || pin.length === 0}
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-white/5 hover:bg-red-500/30 text-slate-300 flex items-center justify-center transition-all cursor-pointer disabled:opacity-30"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Demo PIN hints (Hidden in Production) */}
        {!isProduction && (
          <div className="mt-6 text-center bg-white/5 rounded-2xl p-3 border border-white/10 w-full">
            <button
              type="button"
              onClick={() => setShowDemoPins(!showDemoPins)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 cursor-pointer"
            >
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Quick Demo PINs
              </span>
              <span className="text-[10px] bg-white/10 text-slate-300 font-mono px-2 py-0.5 rounded">
                {showDemoPins ? "Hide" : "Click to view"}
              </span>
            </button>
            {showDemoPins && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs mt-3 pt-2 border-t border-white/10">
                {[
                  { label: "Store Officer", pinVal: "2222" },
                  { label: "Store Manager", pinVal: "1111" },
                  { label: "Production", pinVal: "3333" },
                  { label: "Logistics", pinVal: "4444" },
                  { label: "Executive CEO", pinVal: "5678" },
                  { label: "System Admin", pinVal: "1234" },
                ].map((d) => (
                  <button
                    key={d.pinVal}
                    type="button"
                    onClick={async () => {
                      setPin(d.pinVal);
                      setLoading(true);
                      const res = await unlockTerminal(d.pinVal);
                      if (res.success) {
                        router.push(returnTo || res.redirectUrl || "/inventory");
                      } else {
                        setError(res.error || "Incorrect PIN code.");
                        setLoading(false);
                      }
                    }}
                    className="px-2 py-1.5 bg-white/10 rounded-lg hover:bg-[#CF0458] transition-all flex items-center justify-between cursor-pointer text-left"
                  >
                    <span className="text-slate-300 text-[11px] truncate">{d.label}</span>
                    <span className="font-mono font-bold text-emerald-400 text-xs ml-1">
                      {d.pinVal}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-slate-500">
        Moh Industries Ltd • Secure Warehouse Terminal Protocol
      </div>
    </div>
  );
}

export default function PinLockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#111827] flex items-center justify-center text-white text-xs">
          Loading terminal security...
        </div>
      }
    >
      <PinLockContent />
    </Suspense>
  );
}
