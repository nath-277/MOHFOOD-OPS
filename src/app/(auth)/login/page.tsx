"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Logo } from "@/components/brand/Logo";
import Link from "next/link";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  AlertCircle,
  KeyRound,
  UserCheck,
} from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(identifier, password);
    if (!result.success) {
      setError(result.error || "Authentication failed.");
      setLoading(false);
    }
  };

  const handleFillDemo = (email: string) => {
    setIdentifier(email);
    setPassword("ChangeThisSecurePassword123!");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFFDF9] via-[#FCE4EC]/40 to-[#E8F5E9]/40 flex flex-col justify-center items-center px-4 py-8">
      {/* Container */}
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <Logo size="lg" className="mb-2" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#008153] mt-1 bg-[#E8F5E9] px-3 py-1 rounded-full border border-[#008153]/20">
            NAFDAC REG. NO. A8-106771 • OPERATIONS PORTAL
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-[#D81B60]/5 border border-[#E2E8F0] overflow-hidden">
          {/* Accent top ribbon */}
          <div className="h-2.5 bg-gradient-to-r from-[#D81B60] via-[#84BD00] to-[#008153]" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-[#2B1B24]">Staff Sign In</h1>
                <p className="text-xs text-[#64748B]">Enter your credentials to access your department</p>
              </div>
              <Link
                href="/pin-lock"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FCE4EC] text-[#D81B60] hover:bg-[#D81B60] hover:text-white transition-all text-xs font-bold shadow-sm"
                title="Switch to tablet PIN mode"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>PIN Mode</span>
              </Link>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] mb-1.5 uppercase tracking-wider">
                  Email or Staff ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. store.officer@mohfood.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D81B60] focus:border-transparent transition-all bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D81B60] focus:border-transparent transition-all bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-[#D81B60] to-[#AD1457] hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-[#D81B60]/25 flex items-center justify-center gap-2 touch-target cursor-pointer disabled:opacity-70 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Operations Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Shared Tablet Switcher Callout */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <ShieldCheck className="w-4 h-4 text-[#008153]" />
                <span>Store floor terminal?</span>
              </div>
              <Link
                href="/pin-lock"
                className="text-xs font-bold text-[#D81B60] hover:underline flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Use 4-digit PIN</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Demo Credentials Panel */}
        <div className="mt-6 bg-white/80 backdrop-blur rounded-2xl p-4 border border-slate-200/80 shadow-sm text-center">
          <button
            type="button"
            onClick={() => setShowDemoLogins(!showDemoLogins)}
            className="w-full flex items-center justify-between text-xs font-bold text-[#2B1B24] cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#D81B60]" />
              <span>Moh Foods Demo Accounts (Quick Fill)</span>
            </span>
            <span className="text-[10px] bg-[#FCE4EC] text-[#D81B60] font-mono px-2 py-0.5 rounded-full">
              {showDemoLogins ? "Hide" : "Click to view"}
            </span>
          </button>

          {showDemoLogins && (
            <div className="mt-3 grid grid-cols-1 gap-2 text-left pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleFillDemo("store.officer@mohfood.com")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-[#FCE4EC]/50 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-[#2B1B24]">Store Officer (Blessing Okon)</div>
                  <div className="text-[11px] text-slate-500">store.officer@mohfood.com (PIN: 2222)</div>
                </div>
                <span className="text-[10px] font-bold text-[#008153] bg-[#E8F5E9] px-2 py-0.5 rounded">
                  Store Dept
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo("store.manager@mohfood.com")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-[#FCE4EC]/50 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-[#2B1B24]">Store Manager (Alhaji Musa)</div>
                  <div className="text-[11px] text-slate-500">store.manager@mohfood.com (PIN: 1111)</div>
                </div>
                <span className="text-[10px] font-bold text-[#008153] bg-[#E8F5E9] px-2 py-0.5 rounded">
                  Store Dept
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo("ceo@mohfood.com")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-[#FCE4EC]/50 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-[#2B1B24]">Executive Management (CEO)</div>
                  <div className="text-[11px] text-slate-500">ceo@mohfood.com (PIN: 5678)</div>
                </div>
                <span className="text-[10px] font-bold text-[#D81B60] bg-[#FCE4EC] px-2 py-0.5 rounded">
                  Executive
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo("admin@mohfood.com")}
                className="p-2.5 rounded-xl bg-slate-50 hover:bg-[#FCE4EC]/50 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-[#2B1B24]">Chief IT Systems Admin</div>
                  <div className="text-[11px] text-slate-500">admin@mohfood.com (PIN: 1234)</div>
                </div>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  Super Admin
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-xs text-slate-400">
          Moh Industries Ltd © 2026 • Lagos & Ogun Manufacturing Facility
        </div>
      </div>
    </div>
  );
}
