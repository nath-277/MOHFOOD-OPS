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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <Logo size="lg" className="mb-2" />
          <p className="text-[11px] font-semibold text-slate-500 mt-1 bg-white px-3 py-1 rounded-full border border-slate-200">
            NAFDAC Reg: A8-106771 • Operations Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Staff Sign In</h1>
                <p className="text-xs text-slate-500">Enter credentials to access your department</p>
              </div>
              <Link
                href="/pin-lock"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all text-xs font-semibold"
                title="Switch to tablet PIN mode"
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <span>PIN Mode</span>
              </Link>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                    placeholder="store.officer@mohfood.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#8E1538] focus:bg-white transition-all bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#8E1538] focus:bg-white transition-all bg-slate-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl font-bold text-white bg-[#8E1538] hover:bg-[#72102C] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2 shadow-xs"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Operations Portal</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#059669]" />
                <span>Warehouse terminal?</span>
              </div>
              <Link
                href="/pin-lock"
                className="font-bold text-[#8E1538] hover:underline flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Use 4-digit PIN</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Demo Credentials Panel */}
        <div className="mt-4 bg-white rounded-xl p-3.5 border border-slate-200 text-center">
          <button
            type="button"
            onClick={() => setShowDemoLogins(!showDemoLogins)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#8E1538]" />
              <span>Demo Accounts (Quick Autofill)</span>
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
              {showDemoLogins ? "Hide" : "Click to view"}
            </span>
          </button>

          {showDemoLogins && (
            <div className="mt-3 grid grid-cols-1 gap-1.5 text-left pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleFillDemo("store.officer@mohfood.com")}
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-slate-900">Blessing Okon (Store Officer)</div>
                  <div className="text-[10px] text-slate-400">Inventory Dispense & Returns</div>
                </div>
                <span className="text-[10px] font-mono bg-slate-200/80 px-2 py-0.5 rounded text-slate-700">MOH-STR-02</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo("store.manager@mohfood.com")}
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-slate-900">Alhaji Musa (Store Manager)</div>
                  <div className="text-[10px] text-slate-400">Inbound Stock & Reconciliation</div>
                </div>
                <span className="text-[10px] font-mono bg-slate-200/80 px-2 py-0.5 rounded text-slate-700">MOH-STR-01</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo("admin@mohfood.com")}
                className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-100 text-xs transition-colors flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-bold text-slate-900">Chief IT Systems Admin</div>
                  <div className="text-[10px] text-slate-400">Full System Access & RBAC</div>
                </div>
                <span className="text-[10px] font-mono bg-slate-200/80 px-2 py-0.5 rounded text-slate-700">MOH-ADM-01</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
