"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Users,
  ShieldCheck,
  Building2,
  KeyRound,
  CheckCircle2,
  Lock,
  Activity,
} from "lucide-react";

interface StaffAccount {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  role: string;
  departmentCode: string;
  departmentName: string;
  phone?: string;
  isActive: boolean;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await fetch("/api/auth/demo-accounts");
        if (res.ok) {
          const data = await res.json();
          setStaffList(data.users || []);
        }
      } catch (err) {
        console.error("Failed to load staff:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 via-purple-700 to-indigo-900 text-white p-6 sm:p-8 shadow-lg shadow-purple-900/20 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-white/20 text-white backdrop-blur">
                System Administration
              </span>
              <span className="text-xs text-white/80 font-medium">RBAC Security & Departments</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              IT Administration & Access Control
            </h1>
            <p className="text-sm text-white/90 mt-1 max-w-xl">
              Configure department memberships, user credentials, floor tablet 4-digit PINs, and audit trails.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/20 text-right self-start md:self-auto">
            <span className="text-[10px] uppercase font-bold text-white/70 block">Super Administrator</span>
            <span className="text-sm font-bold text-white">{user?.fullName}</span>
            <span className="text-xs text-[#84BD00] block font-mono font-bold">{user?.staffId}</span>
          </div>
        </div>
      </div>

      {/* 9 Moh Foods Departments Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-[#2B1B24] flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-purple-700" />
          <span>Moh Foods Enterprise Departments (Modular Architecture)</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { name: "Inventory Store", code: "INVENTORY_STORE", status: "Phase 1 & 2 Active", active: true },
            { name: "Executive Mgmt", code: "EXECUTIVE_MANAGEMENT", status: "Phase 1 & 3 Active", active: true },
            { name: "Production", code: "PRODUCTION", status: "Phase 5 Extension", active: false },
            { name: "Logistics", code: "LOGISTICS", status: "Phase 5 Extension", active: false },
            { name: "Accounting", code: "ACCOUNTING", status: "Phase 5 Extension", active: false },
            { name: "Merchandisers", code: "MERCHANDISERS", status: "Phase 5 Extension", active: false },
            { name: "Cleaners / HACCP", code: "CLEANERS", status: "Phase 5 Extension", active: false },
            { name: "Procurement", code: "PROCUREMENT", status: "Phase 5 Extension", active: false },
            { name: "Media & SMM", code: "MEDIA", status: "Phase 5 Extension", active: false },
          ].map((dept) => (
            <div
              key={dept.code}
              className={`p-3 rounded-xl border text-xs ${
                dept.active
                  ? "bg-[#E8F5E9] border-[#008153]/30 text-[#008153]"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              <div className="font-bold">{dept.name}</div>
              <div className="text-[10px] mt-1 font-medium">{dept.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Staff Accounts & PINs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#2B1B24] flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-700" />
            <span>Authorized Staff & Shared Tablet PIN Directory</span>
          </h2>
          <span className="text-xs text-purple-700 font-bold bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
            {staffList.length} Registered Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Staff ID</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">Tablet PIN</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Loading staff directory...
                  </td>
                </tr>
              ) : (
                staffList.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#2B1B24]">{st.fullName}</div>
                      <div className="text-[11px] text-slate-400">{st.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{st.staffId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {st.departmentName}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-purple-700">{st.role}</td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        <KeyRound className="w-3 h-3 text-[#D81B60]" />
                        <span>Configured</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#008153] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Active</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
