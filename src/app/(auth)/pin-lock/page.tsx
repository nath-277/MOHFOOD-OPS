"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Logo } from "@/components/brand/Logo";
import Link from "next/link";
import { Delete, ArrowLeft, ShieldCheck, AlertCircle } from "lucide-react";

export default function PinLockPage() {
  const { pinSwitch } = useAuth();
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleDigit = async (digit: string) => {
    if (loading || pin.length >= 4) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError(null);

    if (newPin.length === 4) {
      setLoading(true);
      const res = await pinSwitch(newPin);
      if (!res.success) {
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
        <p className="text-xs text-slate-400 text-center mb-6">
          Enter your 4-digit staff PIN to unlock shift actions
        </p>

        {/* PIN Bubble Display */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? "bg-[#8E1538] shadow-md shadow-[#8E1538]/50 scale-110 border-2 border-white"
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
              className="h-16 rounded-2xl bg-white/10 hover:bg-[#8E1538] active:scale-95 transition-all text-2xl font-bold flex items-center justify-center border border-white/10 shadow-sm cursor-pointer disabled:opacity-50"
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
            className="h-16 rounded-2xl bg-white/10 hover:bg-[#8E1538] active:scale-95 transition-all text-2xl font-bold flex items-center justify-center border border-white/10 shadow-sm cursor-pointer disabled:opacity-50"
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

        {/* Demo PIN hints */}
        <div className="mt-8 text-center bg-white/5 rounded-2xl p-3 border border-white/10 w-full">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
            Floor Staff Quick Demo PINs
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setPin("2222");
                pinSwitch("2222");
              }}
              className="px-2 py-1 bg-white/10 rounded-lg hover:bg-[#8E1538] transition-colors"
            >
              Store Officer: <span className="font-mono font-bold text-[#059669]">2222</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPin("1111");
                pinSwitch("1111");
              }}
              className="px-2 py-1 bg-white/10 rounded-lg hover:bg-[#8E1538] transition-colors"
            >
              Store Mgr: <span className="font-mono font-bold text-[#059669]">1111</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPin("5678");
                pinSwitch("5678");
              }}
              className="px-2 py-1 bg-white/10 rounded-lg hover:bg-[#8E1538] transition-colors"
            >
              Executive: <span className="font-mono font-bold text-[#059669]">5678</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-slate-500">
        Moh Industries Ltd • Secure Warehouse Terminal Protocol
      </div>
    </div>
  );
}
