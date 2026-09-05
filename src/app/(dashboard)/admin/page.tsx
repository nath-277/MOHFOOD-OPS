"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Users,
  ShieldCheck,
  Building2,
  KeyRound,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  X,
  Check,
  Cpu,
  Package,
  FileSpreadsheet,
  Briefcase,
  Layers,
  Sparkles,
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

const MOH_DEPARTMENTS = [
  {
    code: "INVENTORY_STORE",
    name: "Inventory Store",
    status: "Live MVP Module",
    phase: "Phase 1 & 2",
    active: true,
    lead: "Alhaji Musa (Store Manager)",
    description: "Raw material intake, shift batch dispensing, BOM calculations, returns, and shift reconciliations.",
    color: "border-[#D81B60]/40 bg-[#FCE4EC]/30 text-[#D81B60]",
    badgeBg: "bg-[#D81B60] text-white",
  },
  {
    code: "EXECUTIVE_MANAGEMENT",
    name: "Executive Management",
    status: "Live MVP Module",
    phase: "Phase 1 & 3",
    active: true,
    lead: "CEO & IT Lead",
    description: "Supermarket Sale or Return (SoR) ledger, WhatsApp invoice processing, and overall plant KPIs.",
    color: "border-[#008153]/40 bg-[#E8F5E9]/30 text-[#008153]",
    badgeBg: "bg-[#008153] text-white",
  },
  {
    code: "PRODUCTION",
    name: "Production Department",
    status: "Roadmap Extension",
    phase: "Phase 4",
    active: false,
    lead: "David Adeleke (Supervisor)",
    description: "Dough mixing schedules, recipe scaling, oven temperatures, and daily batch yield tracking.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
  {
    code: "LOGISTICS",
    name: "Logistics & Delivery",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Logistics Coordinator",
    description: "Van loading sheets, route deliveries to supermarkets across Lagos & Ogun, and waybills.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
  {
    code: "ACCOUNTING",
    name: "Accounting & Finance",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Plant Accountant",
    description: "Supermarket payment collections, ingredient supplier PO settlements, and weekly P&L.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
  {
    code: "MERCHANDISERS",
    name: "Supermarket Merchandisers",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Lead Merchandiser",
    description: "In-store shelf audits, product placement, expiry date rotation, and replenishment requests.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
  {
    code: "CLEANERS",
    name: "Cleaners & HACCP Sanitation",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "HACCP Safety Officer",
    description: "Food safety sanitation logs, machinery deep cleaning verification, and NAFDAC hygiene audits.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
  {
    code: "PROCUREMENT",
    name: "Procurement & Sourcing",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Procurement Lead",
    description: "Bulk flour, sugar, yeast, and packaging sourcing with multi-vendor price comparison.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
  {
    code: "MEDIA",
    name: "Media & Digital Marketing",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Social Media Manager",
    description: "Consumer engagement, retail branding campaigns, product packaging review, and feedback logs.",
    color: "border-slate-200 bg-white text-slate-700",
    badgeBg: "bg-slate-100 text-slate-600",
  },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab State: "staff" | "departments" | "security"
  const [activeTab, setActiveTab] = useState<"staff" | "departments" | "security">("staff");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedRole, setSelectedRole] = useState("ALL");

  // Add Staff Modal
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    staffId: "",
    email: "",
    role: "STORE_OFFICER",
    departmentCode: "INVENTORY_STORE",
    phone: "",
    pin: "",
  });

  // Success Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchStaff = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/auth/demo-accounts");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load staff accounts:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((item) => {
      const matchSearch =
        searchQuery === "" ||
        item.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.staffId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDept =
        selectedDept === "ALL" || item.departmentCode === selectedDept;

      const matchRole =
        selectedRole === "ALL" || item.role === selectedRole;

      return matchSearch && matchDept && matchRole;
    });
  }, [staffList, searchQuery, selectedDept, selectedRole]);

  // Handle adding new staff locally
  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.fullName || !newStaff.staffId || !newStaff.email) {
      alert("Please fill all required fields.");
      return;
    }

    const deptObj = MOH_DEPARTMENTS.find((d) => d.code === newStaff.departmentCode);
    const createdAccount: StaffAccount = {
      id: `usr_${Date.now()}`,
      staffId: newStaff.staffId.toUpperCase().trim(),
      fullName: newStaff.fullName.trim(),
      email: newStaff.email.trim(),
      role: newStaff.role,
      departmentCode: newStaff.departmentCode,
      departmentName: deptObj ? deptObj.name : "Department",
      phone: newStaff.phone || undefined,
      isActive: true,
    };

    setStaffList((prev) => [createdAccount, ...prev]);
    setIsAddStaffOpen(false);
    setNewStaff({
      fullName: "",
      staffId: "",
      email: "",
      role: "STORE_OFFICER",
      departmentCode: "INVENTORY_STORE",
      phone: "",
      pin: "",
    });
    showToast(`Staff member ${createdAccount.fullName} added successfully.`);
  };

  const getInitials = (name?: string) => {
    if (!name) return "MF";
    const p = name.trim().split(" ");
    return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#008153] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200">
              System Administration
            </span>
            <span className="text-xs font-bold text-slate-400">RBAC & PIN Access Control</span>
          </div>
          <h1 className="text-2xl font-black text-[#2B1B24] tracking-tight mt-1">
            IT Administration & Personnel
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure staff accounts, floor tablet 4-digit PINs, and modular department permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchStaff}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-700" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddStaffOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-sm shadow-purple-700/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Account</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Active Staff */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Personnel
            </div>
            <div className="text-2xl font-black text-[#2B1B24] mt-1">
              {loading ? "..." : staffList.length}
            </div>
            <div className="text-[11px] font-medium text-purple-700 mt-0.5">
              Across registered departments
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Tablet PINs */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Floor Tablet PINs
            </div>
            <div className="text-2xl font-black text-[#D81B60] mt-1">
              100%
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Floor quick switch active
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FCE4EC] text-[#D81B60] flex items-center justify-center border border-[#D81B60]/20">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Modular Departments */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Modular Departments
            </div>
            <div className="text-2xl font-black text-[#008153] mt-1">
              2 / 9
            </div>
            <div className="text-[11px] font-medium text-[#008153] mt-0.5">
              Live in MVP (7 Slated)
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#E8F5E9] text-[#008153] flex items-center justify-center border border-[#008153]/20">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Security Standard */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Security Standard
            </div>
            <div className="text-xl font-black text-slate-800 mt-1">
              Argon2id + AES
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Signed HTTP-only sessions
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Modern Segmented Tab Bar */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === "staff"
              ? "border-purple-700 text-purple-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Tablet PIN Directory</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
            {filteredStaff.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("departments")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === "departments"
              ? "border-purple-700 text-purple-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Modular Departments Hierarchy</span>
          <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-50 text-purple-700 font-bold">
            9 Modules
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === "security"
              ? "border-purple-700 text-purple-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>RBAC Matrix & Security Architecture</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: STAFF & TABLET PIN DIRECTORY */}
      {/* ============================================================ */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-purple-600 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Filter by Department */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">Dept:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full sm:w-auto py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-purple-600 transition-all cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  <option value="INVENTORY_STORE">Inventory Store</option>
                  <option value="EXECUTIVE_MANAGEMENT">Executive & IT</option>
                  <option value="PRODUCTION">Production</option>
                </select>
              </div>

              {/* Filter by Role */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">Role:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full sm:w-auto py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-hidden focus:border-purple-600 transition-all cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="EXECUTIVE">EXECUTIVE</option>
                  <option value="STORE_MANAGER">STORE_MANAGER</option>
                  <option value="STORE_OFFICER">STORE_OFFICER</option>
                  <option value="PRODUCTION_SUPERVISOR">PRODUCTION_SUPERVISOR</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clean Staff Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Staff ID</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Role Badge</th>
                    <th className="py-3.5 px-4 text-center">Floor Tablet PIN</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                        <span className="text-xs font-medium">Loading personnel directory...</span>
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">No staff members match your filter.</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search terms or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {getInitials(st.fullName)}
                            </div>
                            <div>
                              <div className="font-extrabold text-[#2B1B24]">{st.fullName}</div>
                              <div className="text-[11px] text-slate-400">{st.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                            {st.staffId}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {st.departmentName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${
                              st.role === "SUPER_ADMIN"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : st.role === "EXECUTIVE"
                                ? "bg-emerald-100 text-[#008153] border border-emerald-200"
                                : st.role === "STORE_MANAGER"
                                ? "bg-[#FCE4EC] text-[#D81B60] border border-[#D81B60]/30"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {st.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-slate-100 px-2.5 py-1 rounded-xl text-slate-700 border border-slate-200">
                            <KeyRound className="w-3 h-3 text-[#D81B60]" />
                            <span>Active 4-Digit</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#008153] bg-[#E8F5E9] px-2.5 py-0.5 rounded-full border border-[#008153]/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#008153]" />
                            <span>Active</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredStaff.length} of {staffList.length} staff accounts</span>
              <span className="font-semibold text-purple-800">Argon2id Salted + Floor PIN Protection</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MODULAR DEPARTMENTS HIERARCHY */}
      {/* ============================================================ */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200/80 flex items-start gap-3">
            <Building2 className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-extrabold text-purple-900">
                Moh Foods Enterprise Modular Architecture
              </div>
              <p className="text-[11px] text-purple-700 mt-0.5">
                The operations platform is strictly designed so additional business units plug in cleanly without modifying core auth or database primitives.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOH_DEPARTMENTS.map((dept) => (
              <div
                key={dept.code}
                className={`p-4 rounded-2xl border transition-all ${
                  dept.active
                    ? "bg-white border-slate-300 shadow-sm ring-1 ring-slate-200"
                    : "bg-slate-50/80 border-slate-200 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${dept.badgeBg}`}
                  >
                    {dept.status}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {dept.phase}
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-[#2B1B24]">{dept.name}</h3>
                <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                  {dept.code}
                </div>

                <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                  {dept.description}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-500">Lead: {dept.lead}</span>
                  {dept.active ? (
                    <span className="flex items-center gap-1 font-bold text-[#008153]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Live</span>
                    </span>
                  ) : (
                    <span className="font-medium text-slate-400">Slated</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: RBAC MATRIX & SECURITY ARCHITECTURE */}
      {/* ============================================================ */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* RBAC Matrix Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[#2B1B24] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-700" />
                  <span>Role-Based Access Control (RBAC) Matrix</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permissions enforced at both Next.js edge proxy and Hono API handler layers.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">System Role</th>
                    <th className="py-3 px-4 text-center">Store Intake</th>
                    <th className="py-3 px-4 text-center">Batch Dispense</th>
                    <th className="py-3 px-4 text-center">Shift Reconcile</th>
                    <th className="py-3 px-4 text-center">SoR Ledger</th>
                    <th className="py-3 px-4 text-center">WhatsApp Approvals</th>
                    <th className="py-3 px-4 text-center">Admin & PINs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {[
                    { role: "SUPER_ADMIN", permissions: [true, true, true, true, true, true] },
                    { role: "EXECUTIVE", permissions: [false, false, false, true, true, false] },
                    { role: "STORE_MANAGER", permissions: [true, true, true, false, false, false] },
                    { role: "STORE_OFFICER", permissions: [true, true, false, false, false, false] },
                    { role: "PRODUCTION_SUPERVISOR", permissions: [false, false, false, false, false, false] },
                  ].map((row) => (
                    <tr key={row.role} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{row.role}</td>
                      {row.permissions.map((perm, idx) => (
                        <td key={idx} className="py-3 px-4 text-center">
                          {perm ? (
                            <span className="inline-flex p-1 rounded-md bg-emerald-100 text-[#008153]">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="inline-block w-2 h-0.5 bg-slate-300 rounded" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cryptographic Standards Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-700" />
                <span>Authentication & Session Safeguards</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008153] shrink-0 mt-0.5" />
                  <span><strong>Argon2id (RFC 9106)</strong>: Passwords salted and hashed with memory-hard parameters resisting GPU attacks.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008153] shrink-0 mt-0.5" />
                  <span><strong>HMAC-SHA256 Signed Tokens</strong>: User session payloads cryptographically validated on every HTTP request.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008153] shrink-0 mt-0.5" />
                  <span><strong>HttpOnly Cookies</strong>: Prevents JavaScript XSS token theft via browser cookie security flags.</span>
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#D81B60]" />
                <span>Floor Tablet Terminal Protocols</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008153] shrink-0 mt-0.5" />
                  <span><strong>Shared Tablet Station</strong>: Operators instantly switch shifts using a fast 4-digit numeric keypad without typing full passwords.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008153] shrink-0 mt-0.5" />
                  <span><strong>Auto-Locking</strong>: Terminals lock to the PIN screen during inactivity or shift handovers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#008153] shrink-0 mt-0.5" />
                  <span><strong>Digital Sign-Off</strong>: Store reconciliations require operator confirmation and digital lock.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* INTERACTIVE ADD STAFF MODAL */}
      {/* ============================================================ */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-[#2B1B24]">
                Register New Staff Account
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Create credentials and assign an instant 4-digit PIN for warehouse tablet terminals.
            </p>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  placeholder="e.g. Samuel Adewale"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Staff ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.staffId}
                    onChange={(e) => setNewStaff({ ...newStaff, staffId: e.target.value })}
                    placeholder="e.g. MOH-STR-05"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-purple-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="s.adewale@mohfood.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newStaff.departmentCode}
                    onChange={(e) => setNewStaff({ ...newStaff, departmentCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden cursor-pointer"
                  >
                    <option value="INVENTORY_STORE">Inventory Store</option>
                    <option value="EXECUTIVE_MANAGEMENT">Executive Management</option>
                    <option value="PRODUCTION">Production</option>
                    <option value="LOGISTICS">Logistics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    System Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden cursor-pointer"
                  >
                    <option value="STORE_OFFICER">STORE_OFFICER</option>
                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                    <option value="PRODUCTION_SUPERVISOR">PRODUCTION_SUPERVISOR</option>
                    <option value="EXECUTIVE">EXECUTIVE</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="+2348012345678"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-purple-600 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tablet 4-Digit PIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={newStaff.pin}
                    onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })}
                    placeholder="••••"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono tracking-widest text-center focus:bg-white focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-sm shadow-purple-700/20 transition-colors"
                >
                  Register Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
