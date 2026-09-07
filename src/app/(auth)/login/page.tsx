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
  const [activeQuickEmail, setActiveQuickEmail] = useState<string | null>(null);

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

  const handleQuickLogin = async (email: string) => {
    setIdentifier(email);
    setPassword("ChangeThisSecurePassword123!");
    setError(null);
    setLoading(true);
    setActiveQuickEmail(email);

    const result = await login(email, "ChangeThisSecurePassword123!");
    if (!result.success) {
      setError(result.error || "Authentication failed.");
      setLoading(false);
      setActiveQuickEmail(null);
    }
  };

  const handleFillDemo = (email: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
                    autoComplete="username"
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
                    autoComplete="current-password"
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

        {/* Demo Credentials Directory */}
        <div className="mt-4 bg-white rounded-xl p-3.5 border border-slate-200 text-center">
          <button
            type="button"
            onClick={() => setShowDemoLogins(!showDemoLogins)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#8E1538]" />
              <span>Demo Accounts Directory (Autofill & Quick Login)</span>
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
              {showDemoLogins ? "Hide" : "Click to view"}
            </span>
          </button>

          {showDemoLogins && (
            <div className="mt-3 space-y-3 text-left pt-2 border-t border-slate-100">
              {/* Quick 1-Click Role Chips */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Quick 1-Click Demo Sign In
                  </span>
                  <span className="text-[10px] font-bold text-[#059669]">6 Roles Ready</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { label: "Store Officer", email: "store.officer@mohfood.com", pin: "2222" },
                    { label: "Store Manager", email: "store.manager@mohfood.com", pin: "1111" },
                    { label: "Production", email: "production@mohfood.com", pin: "3333" },
                    { label: "Logistics", email: "logistics@mohfood.com", pin: "4444" },
                    { label: "Executive CEO", email: "ceo@mohfood.com", pin: "5678" },
                    { label: "Super Admin", email: "admin@mohfood.com", pin: "1234" },
                  ].map((r) => (
                    <button
                      key={r.email}
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickLogin(r.email)}
                      className={`py-1.5 px-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                        activeQuickEmail === r.email && loading
                          ? "bg-[#8E1538] text-white border-[#8E1538]"
                          : identifier === r.email
                          ? "bg-[#8E1538]/10 border-[#8E1538] text-slate-900"
                          : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span className="text-[11px] font-bold truncate">{r.label}</span>
                      {activeQuickEmail === r.email && loading ? (
                        <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono text-emerald-600 font-bold ml-1">
                          {r.pin}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Itemized Directory */}
              <div className="grid grid-cols-1 gap-2">
              {[
                {
                  role: "Store Officer",
                  name: "Blessing Okon",
                  staffId: "MOH-STR-02",
                  email: "store.officer@mohfood.com",
                  pin: "2222",
                  scope: "Inventory Dispense & Returns",
                },
                {
                  role: "Store Manager",
                  name: "Alhaji Musa",
                  staffId: "MOH-STR-01",
                  email: "store.manager@mohfood.com",
                  pin: "1111",
                  scope: "Inbound Stock & Reconciliation",
                },
                {
                  role: "Production Supervisor",
                  name: "David Adeleke",
                  staffId: "MOH-PRD-01",
                  email: "production@mohfood.com",
                  pin: "3333",
                  scope: "Mixing Lines, Batches & Tank CIP",
                },
                {
                  role: "Logistics Officer",
                  name: "Sunday Balogun",
                  staffId: "MOH-LOG-01",
                  email: "logistics@mohfood.com",
                  pin: "4444",
                  scope: "Cold-Chain Fleet & Van Dispatch",
                },
                {
                  role: "Executive (CEO)",
                  name: "Chief Executive Officer",
                  staffId: "MOH-EXEC-01",
                  email: "ceo@mohfood.com",
                  pin: "5678",
                  scope: "Executive Hub & Supermarket SoR",
                },
                {
                  role: "System Administrator",
                  name: "Chief IT Systems Admin",
                  staffId: "MOH-ADM-01",
                  email: "admin@mohfood.com",
                  pin: "1234",
                  scope: "Full System Access, RBAC & Floor PINs",
                },
              ].map((acc) => (
                <div
                  key={acc.email}
                  className={`p-2.5 rounded-xl border text-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    identifier === acc.email
                      ? "bg-[#8E1538]/5 border-[#8E1538]/40 ring-1 ring-[#8E1538]/20"
                      : "bg-slate-50/70 border-slate-200/80"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{acc.name}</span>
                      <span className="text-[10px] font-mono bg-slate-200/80 px-1.5 py-0.2 rounded text-slate-700 font-semibold">
                        {acc.staffId}
                      </span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                      {acc.role} • <span className="text-slate-400">{acc.scope}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleFillDemo(acc.email, e)}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                      title="Fill the form without signing in"
                    >
                      Autofill
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleQuickLogin(acc.email)}
                      className="px-2.5 py-1 rounded-lg bg-[#8E1538] hover:bg-[#72102C] text-white text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {activeQuickEmail === acc.email && loading ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Sign In</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
