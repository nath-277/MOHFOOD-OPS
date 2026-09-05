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
  Plus,
  RefreshCw,
  X,
  Check,
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
  },
  {
    code: "EXECUTIVE_MANAGEMENT",
    name: "Executive Management",
    status: "Live MVP Module",
    phase: "Phase 1 & 3",
    active: true,
    lead: "CEO & IT Lead",
    description: "Supermarket Sale or Return (SoR) ledger, WhatsApp invoice processing, and overall plant KPIs.",
  },
  {
    code: "PRODUCTION",
    name: "Production Department",
    status: "Roadmap Extension",
    phase: "Phase 4",
    active: false,
    lead: "David Adeleke (Supervisor)",
    description: "Dough mixing schedules, recipe scaling, oven temperatures, and daily batch yield tracking.",
  },
  {
    code: "LOGISTICS",
    name: "Logistics & Delivery",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Logistics Coordinator",
    description: "Van loading sheets, route deliveries to supermarkets across Lagos & Ogun, and waybills.",
  },
  {
    code: "ACCOUNTING",
    name: "Accounting & Finance",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Plant Accountant",
    description: "Supermarket payment collections, ingredient supplier PO settlements, and weekly P&L.",
  },
  {
    code: "MERCHANDISERS",
    name: "Supermarket Merchandisers",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Lead Merchandiser",
    description: "In-store shelf audits, product placement, expiry date rotation, and replenishment requests.",
  },
  {
    code: "CLEANERS",
    name: "Cleaners & HACCP Sanitation",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "HACCP Safety Officer",
    description: "Food safety sanitation logs, machinery deep cleaning verification, and NAFDAC hygiene audits.",
  },
  {
    code: "PROCUREMENT",
    name: "Procurement & Sourcing",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Procurement Lead",
    description: "Bulk flour, sugar, yeast, and packaging sourcing with multi-vendor price comparison.",
  },
  {
    code: "MEDIA",
    name: "Media & Digital Marketing",
    status: "Roadmap Extension",
    phase: "Phase 5",
    active: false,
    lead: "Social Media Manager",
    description: "Consumer engagement, retail branding campaigns, product packaging review, and feedback logs.",
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
    showToast(`Staff member ${createdAccount.fullName} registered successfully.`);
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
        <div className="fixed bottom-6 right-6 z-50 bg-[#059669] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              Administration
            </span>
            <span className="text-xs font-semibold text-slate-400">Personnel & RBAC</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            System Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage staff accounts, floor tablet PIN credentials, and module permissions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchStaff}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#8E1538]" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddStaffOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Account</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Personnel
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? "..." : staffList.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Active staff directory
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Tablet PIN Status
            </div>
            <div className="text-2xl font-bold text-[#8E1538] mt-1">
              100%
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Floor quick switch active
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#8E1538] flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Departments
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              2 / 9
            </div>
            <div className="text-[11px] font-medium text-[#059669] mt-0.5">
              2 Live in MVP (7 Slated)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Security Standard
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              Argon2id + AES
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">
              Signed HTTP-only sessions
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "staff"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Tablet PIN Directory</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {filteredStaff.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("departments")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "departments"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Modular Hierarchy</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            9
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "security"
              ? "border-[#8E1538] text-[#8E1538]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>RBAC & Architecture</span>
        </button>
      </div>

      {/* TAB 1: STAFF & PIN DIRECTORY */}
      {activeTab === "staff" && (
        <div className="space-y-4">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, email, or ID..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#8E1538] focus:bg-white transition-all"
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
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#8E1538] cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                <option value="INVENTORY_STORE">Inventory Store</option>
                <option value="EXECUTIVE_MANAGEMENT">Executive & IT</option>
                <option value="PRODUCTION">Production</option>
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#8E1538] cursor-pointer"
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

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
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
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8E1538]" />
                        <span>Loading personnel directory...</span>
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">No staff accounts match your filter.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {getInitials(st.fullName)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{st.fullName}</div>
                              <div className="text-[11px] text-slate-400">{st.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {st.staffId}
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          {st.departmentName}
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {st.role}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                            <KeyRound className="w-3 h-3 text-[#8E1538]" />
                            <span>Configured</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                            <span>Active</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredStaff.length} of {staffList.length} personnel</span>
              <span>Argon2id Encrypted Credentials</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MODULAR DEPARTMENTS */}
      {activeTab === "departments" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {MOH_DEPARTMENTS.map((dept) => (
              <div
                key={dept.code}
                className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      dept.active
                        ? "bg-[#ECFDF5] text-[#059669] border border-[#059669]/20"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {dept.status}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {dept.phase}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{dept.name}</h3>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  {dept.code}
                </div>

                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {dept.description}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Lead: {dept.lead}</span>
                  {dept.active ? (
                    <span className="font-semibold text-[#059669]">Live</span>
                  ) : (
                    <span className="text-slate-400">Roadmap</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RBAC & SECURITY */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8E1538]" />
                <span>Role-Based Access Control Matrix</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-center">Store Intake</th>
                    <th className="py-3 px-4 text-center">Dispensing</th>
                    <th className="py-3 px-4 text-center">Reconciliation</th>
                    <th className="py-3 px-4 text-center">SoR Ledger</th>
                    <th className="py-3 px-4 text-center">Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {[
                    { role: "SUPER_ADMIN", permissions: [true, true, true, true, true] },
                    { role: "EXECUTIVE", permissions: [false, false, false, true, false] },
                    { role: "STORE_MANAGER", permissions: [true, true, true, false, false] },
                    { role: "STORE_OFFICER", permissions: [true, true, false, false, false] },
                    { role: "PRODUCTION_SUPERVISOR", permissions: [false, false, false, false, false] },
                  ].map((row) => (
                    <tr key={row.role} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{row.role}</td>
                      {row.permissions.map((perm, idx) => (
                        <td key={idx} className="py-3 px-4 text-center">
                          {perm ? (
                            <Check className="w-4 h-4 text-[#059669] mx-auto" />
                          ) : (
                            <span className="inline-block w-2 h-0.5 bg-slate-200" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setIsAddStaffOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Register Staff Account
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Create staff credentials and floor tablet 4-digit PIN.
            </p>

            <form onSubmit={handleAddStaffSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  placeholder="e.g. Samuel Adewale"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff ID
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.staffId}
                    onChange={(e) => setNewStaff({ ...newStaff, staffId: e.target.value })}
                    placeholder="MOH-STR-05"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="s.adewale@mohfood.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={newStaff.departmentCode}
                    onChange={(e) => setNewStaff({ ...newStaff, departmentCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  >
                    <option value="INVENTORY_STORE">Inventory Store</option>
                    <option value="EXECUTIVE_MANAGEMENT">Executive Management</option>
                    <option value="PRODUCTION">Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    System Role
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                  >
                    <option value="STORE_OFFICER">STORE_OFFICER</option>
                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                    <option value="EXECUTIVE">EXECUTIVE</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Floor Tablet 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  value={newStaff.pin}
                  onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono tracking-widest text-center focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#8E1538] hover:bg-[#72102C] text-white"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
