"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { ShiftOperationsLogView } from "@/components/production/ShiftOperationsLogView";
import { SupervisorShiftRotationView } from "@/components/admin/SupervisorShiftRotationView";
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
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Clock,
  Filter,
  Pencil,
  Trash2,
  RotateCcw,
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
    lead: "Store Manager",
    description: "Raw material intake, shift batch dispensing, BOM calculations, returns, and shift reconciliations.",
  },
  {
    code: "EXECUTIVE_MANAGEMENT",
    name: "Executive Management",
    status: "Live MVP Module",
    phase: "Phase 1 & 3",
    active: true,
    lead: "Chief Executive Officer",
    description: "Supermarket Sale or Return (SoR) ledger, WhatsApp invoice processing, and overall plant KPIs.",
  },
  {
    code: "PRODUCT_STORAGE",
    name: "Product Storage (Finished Goods)",
    status: "Live MVP Module",
    phase: "Phase 1 & 2",
    active: true,
    lead: "Finished Goods Officer",
    description: "Chilled cold room for finished products post-production and staging room for dispatch riders.",
  },
  {
    code: "PRODUCTION",
    name: "Production Department",
    status: "Roadmap Extension",
    phase: "Phase 4",
    active: false,
    lead: "Production Supervisor",
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

  // Tab State: "staff" | "departments" | "security" | "audit" | "shift_logs" | "shift_rotation"
  const [activeTab, setActiveTab] = useState<
    "staff" | "departments" | "security" | "audit" | "shift_logs" | "shift_rotation"
  >("staff");

  // Audit Logs State (Item 11)
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditDeptFilter, setAuditDeptFilter] = useState("ALL");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams();
      if (auditDeptFilter !== "ALL") params.set("department", auditDeptFilter);
      if (auditSearchQuery.trim()) params.set("search", auditSearchQuery.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        setAuditEvents(d.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditDeptFilter, auditSearchQuery]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Sync tab with URL hash if present & custom event
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "staff" || hash === "departments" || hash === "security" || hash === "audit" || hash === "shift_logs") {
        setActiveTab(hash as any);
      }
    };
    const handleTabEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (
        customEvent.detail === "staff" ||
        customEvent.detail === "departments" ||
        customEvent.detail === "security" ||
        customEvent.detail === "audit" ||
        customEvent.detail === "shift_logs"
      ) {
        setActiveTab(customEvent.detail as any);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("admin:switch-tab", handleTabEvent);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("admin:switch-tab", handleTabEvent);
    };
  }, []);

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
    password: "",
    role: "STORE_MANAGER",
    departmentCode: "INVENTORY_STORE",
    phone: "",
    pin: "",
  });
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Edit Staff State
  const [editingStaff, setEditingStaff] = useState<StaffAccount | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "STORE_MANAGER",
    departmentCode: "INVENTORY_STORE",
    password: "",
    pin: "",
    isActive: true,
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Staff State
  const [deletingStaff, setDeletingStaff] = useState<StaffAccount | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Success Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchStaff = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/staff");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || data.users || []);
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

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.fullName || !newStaff.staffId || !newStaff.email) {
      setStaffError("Please fill all required fields.");
      return;
    }

    if (newStaff.pin && !/^\d{4}$/.test(newStaff.pin.trim())) {
      setStaffError("Floor Tablet PIN must be exactly 4 digits.");
      return;
    }

    setSubmittingStaff(true);
    setStaffError(null);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newStaff.fullName.trim(),
          staffId: newStaff.staffId.toUpperCase().trim(),
          email: newStaff.email.trim().toLowerCase(),
          password: newStaff.password.trim() || undefined,
          role: newStaff.role,
          departmentCode: newStaff.departmentCode,
          phone: newStaff.phone.trim() || undefined,
          pin: newStaff.pin.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create staff account.");
      }

      showToast(`Staff member ${data.staff?.fullName || newStaff.fullName} registered successfully.`);
      setIsAddStaffOpen(false);
      setNewStaff({
        fullName: "",
        staffId: "",
        email: "",
        password: "",
        role: "STORE_MANAGER",
        departmentCode: "INVENTORY_STORE",
        phone: "",
        pin: "",
      });
      await fetchStaff();
    } catch (err: any) {
      setStaffError(err.message || "Failed to create staff account.");
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        showToast("Staff status updated successfully.");
        await fetchStaff();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to update staff status.");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to toggle status.");
    }
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (!editForm.fullName || !editForm.email) {
      setEditError("Full Name and Email are required.");
      return;
    }
    if (editForm.pin && !/^\d{4}$/.test(editForm.pin.trim())) {
      setEditError("Floor Tablet PIN must be exactly 4 digits.");
      return;
    }

    try {
      setSubmittingEdit(true);
      setEditError(null);
      const res = await fetch(`/api/admin/staff/${editingStaff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim().toLowerCase(),
          phone: editForm.phone.trim() || undefined,
          role: editForm.role,
          departmentCode: editForm.departmentCode,
          password: editForm.password.trim() || undefined,
          pin: editForm.pin.trim() || undefined,
          isActive: editForm.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update staff account.");
      }

      showToast(`Staff member ${data.staff?.fullName || editForm.fullName} updated successfully.`);
      setEditingStaff(null);
      await fetchStaff();
    } catch (err: any) {
      setEditError(err.message || "Failed to update staff account.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteStaffConfirm = async () => {
    if (!deletingStaff) return;
    try {
      setSubmittingDelete(true);
      setDeleteError(null);
      const res = await fetch(`/api/admin/staff/${deletingStaff.id}?permanent=true`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete staff account.");
      }

      showToast(`Staff account for ${deletingStaff.fullName} permanently deleted.`);
      setDeletingStaff(null);
      await fetchStaff();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete staff account.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "MF";
    const p = name.trim().split(" ");
    return p.length >= 2 ? `${p[0][0]}${p[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const getActionMeta = (type: string) => {
    switch (type) {
      case "INVENTORY_INTAKE_RECORDED":
        return {
          label: "Inbound Intake",
          color: "bg-emerald-50 text-[#059669] border-emerald-200",
          icon: ArrowDownLeft,
        };
      case "INVENTORY_BATCH_DISPENSED":
        return {
          label: "Recipe Batch Dispensed",
          color: "bg-rose-50 text-[#CF0458] border-rose-200",
          icon: ArrowUpRight,
        };
      case "INVENTORY_INDIVIDUAL_DISPENSED":
        return {
          label: "Direct Material Dispensed",
          color: "bg-blue-50 text-blue-700 border-blue-200",
          icon: ArrowUpRight,
        };
      case "INVENTORY_FAULT_SCRAPPED":
        return {
          label: "Defect & Scrap Log",
          color: "bg-amber-50 text-amber-700 border-amber-200",
          icon: AlertTriangle,
        };
      case "INVENTORY_EXCESS_RESTOCKED":
        return {
          label: "Excess Restocked",
          color: "bg-teal-50 text-teal-700 border-teal-200",
          icon: ArrowDownLeft,
        };
      case "SHIFT_HANDOVER_RECONCILED":
        return {
          label: "Shift Reconciled",
          color: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: CheckCircle2,
        };
      case "MANAGEMENT_CONSIGNMENT_DISPATCHED":
        return {
          label: "Consignment Dispatched",
          color: "bg-purple-50 text-purple-700 border-purple-200",
          icon: ArrowUpRight,
        };
      case "MANAGEMENT_SOR_RETURN_RECORDED":
        return {
          label: "SoR Credit / Return",
          color: "bg-orange-50 text-orange-700 border-orange-200",
          icon: AlertTriangle,
        };
      case "MANAGEMENT_PAYMENT_SETTLED":
        return {
          label: "Payment Settled",
          color: "bg-emerald-50 text-[#059669] border-emerald-200",
          icon: CheckCircle2,
        };
      case "SECURITY_PIN_SWITCH":
        return {
          label: "PIN Quick-Switch",
          color: "bg-slate-100 text-slate-700 border-slate-200",
          icon: KeyRound,
        };
      case "STAFF_ACCOUNT_CREATED":
        return {
          label: "Staff Account Enrolled",
          color: "bg-emerald-50 text-[#059669] border-emerald-200",
          icon: Users,
        };
      default:
        return {
          label: type.replace(/_/g, " "),
          color: "bg-slate-100 text-slate-700 border-slate-200",
          icon: Activity,
        };
    }
  };

  const getDeptBadge = (code: string) => {
    switch (code) {
      case "INVENTORY_STORE":
        return { label: "Store & Warehouse", color: "bg-emerald-50 text-[#059669] border-emerald-200" };
      case "EXECUTIVE_MANAGEMENT":
        return { label: "Executive & SoR", color: "bg-rose-50 text-[#CF0458] border-rose-200" };
      case "PRODUCTION":
        return { label: "Production Floor", color: "bg-purple-50 text-purple-700 border-purple-200" };
      case "LOGISTICS":
        return { label: "Logistics & Fleet", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case "SECURITY_IT":
        return { label: "Security & Access", color: "bg-amber-50 text-amber-700 border-amber-200" };
      default:
        return { label: code.replace(/_/g, " "), color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const formatAuditNarrative = (event: any) => {
    const p = event.payload || {};
    switch (event.type) {
      case "INVENTORY_INTAKE_RECORDED":
        return `Received ${p.quantity} ${p.uom || "units"} of "${p.itemName || "Raw Material"}" from ${p.supplier || "Supplier"}${p.grnNumber ? ` • GRN: ${p.grnNumber}` : ""}`;
      case "INVENTORY_BATCH_DISPENSED":
        return `Dispensed recipe batch for ${p.batchQuantity}x "${p.recipeName || "Product"}" to ${p.recipient || "Production Floor"}${p.materialsCount ? ` (${p.materialsCount} ingredients deducted)` : ""}`;
      case "INVENTORY_INDIVIDUAL_DISPENSED":
        return `Requisitioned ${p.quantity} ${p.uom || "units"} of "${p.itemName || "Material"}" to ${p.recipient || "Kitchen"}${p.purpose ? ` • Purpose: ${p.purpose}` : ""}`;
      case "INVENTORY_FAULT_SCRAPPED":
        return `Defective return logged: ${p.quantity} units of "${p.itemName || "Material"}"${p.faultReason ? ` (${p.faultReason})` : ""}${p.replacementIssued ? ` • Replacement issued (-${p.quantity})` : ` • No replacement (±0 store balance)`}`;
      case "INVENTORY_EXCESS_RESTOCKED":
        return `Excess production restocked: +${p.quantity} ${p.uom || "units"} of "${p.itemName || "Material"}"${p.sourceDepartment ? ` from ${p.sourceDepartment}` : ""}`;
      case "SHIFT_HANDOVER_RECONCILED":
        return `Physical handover locked for ${p.shiftType === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}${p.itemsCount ? ` across ${p.itemsCount} SKUs` : ""}${p.verifiedBy ? ` • Verified by ${p.verifiedBy}` : ""}`;
      case "MANAGEMENT_CONSIGNMENT_DISPATCHED":
        return `Consignment delivery dispatched: ${p.quantity} units to ${p.stockistName || "Stockist"}${p.grossValue ? ` • Gross Value: ₦${Number(p.grossValue).toLocaleString()}` : ""}`;
      case "MANAGEMENT_SOR_RETURN_RECORDED":
        return `Sale-or-Return credit: ${p.quantityReturned} units returned from ${p.stockistName || "Stockist"}${p.reason ? ` [Reason: ${p.reason}]` : ""}${p.creditAmount ? ` • Credit: ₦${Number(p.creditAmount).toLocaleString()}` : ""}`;
      case "MANAGEMENT_PAYMENT_SETTLED":
        return `Consignment payment settled: ₦${Number(p.amount || 0).toLocaleString()} received from ${p.stockistName || "Stockist"}${p.paymentMethod ? ` via ${p.paymentMethod}` : ""}`;
      case "SECURITY_PIN_SWITCH":
        return `Floor PIN quick-switch authenticated for ${p.staffName || "Staff"} on ${p.terminal || "iPad Terminal"}`;
      case "STAFF_ACCOUNT_CREATED":
        return `Staff account created: ${p.fullName || "Staff"} (${p.staffId || ""}) assigned to ${p.departmentCode || "Store"}`;
      default:
        return `Operation logged with parameters: ${JSON.stringify(p)}`;
    }
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

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchStaff}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#CF0458]" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddStaffOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Account</span>
          </button>
        </div>
      </div>

      {/* 4 Quiet Metric Summary Cards - 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Total Personnel
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
              {loading ? "..." : staffList.length}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Active staff directory
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Tablet PIN Status
            </div>
            <div className="text-base sm:text-2xl font-bold text-[#CF0458] mt-0.5 sm:mt-1 truncate">
              100%
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Floor switch active
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-[#CF0458] flex items-center justify-center shrink-0 ml-2">
            <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Departments
            </div>
            <div className="text-base sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
              3 / 9
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#059669] mt-0.5 truncate">
              Live in system
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Security Standard
            </div>
            <div className="text-sm sm:text-lg font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">
              Argon2id + AES
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 mt-0.5 truncate">
              Signed sessions
            </div>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 ml-2">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Tab Bar - Responsive, horizontal scroll with no scrollbar */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto no-scrollbar flex-nowrap shrink-0 whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "staff"
              ? "border-[#CF0458] text-[#CF0458]"
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
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "departments"
              ? "border-[#CF0458] text-[#CF0458]"
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
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "security"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>RBAC & Architecture</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "audit"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Activity & Audit Logs</span>
          <span className="ml-1 px-2 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-semibold">
            {auditEvents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shift_logs")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "shift_logs"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Factory Shift Logs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shift_rotation")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "shift_rotation"
              ? "border-[#CF0458] text-[#CF0458]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Supervisor Shift Rotation</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-[#CF0458] font-bold">
            Weekly
          </span>
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
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#CF0458] focus:bg-white transition-all"
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
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#CF0458] cursor-pointer"
              >
                <option value="ALL">All Departments</option>
                <option value="INVENTORY_STORE">Inventory Store</option>
                <option value="EXECUTIVE_MANAGEMENT">Executive & IT</option>
                <option value="PRODUCTION">Production</option>
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#CF0458] cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="EXECUTIVE">EXECUTIVE</option>
                <option value="STORE_MANAGER">STORE_MANAGER</option>
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
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                        <span>Loading personnel directory...</span>
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
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
                            <KeyRound className="w-3 h-3 text-[#CF0458]" />
                            <span>Configured</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {st.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#059669]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaff(st);
                                setEditForm({
                                  fullName: st.fullName,
                                  email: st.email,
                                  phone: st.phone || "",
                                  role: st.role,
                                  departmentCode: st.departmentCode || "INVENTORY_STORE",
                                  password: "",
                                  pin: "",
                                  isActive: st.isActive,
                                });
                                setEditError(null);
                              }}
                              className="px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              title="Edit user details, role, or credentials"
                            >
                              <Pencil className="w-3 h-3 text-[#CF0458]" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStaffStatus(st.id, st.isActive)}
                              className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                                st.isActive
                                  ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                                  : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              }`}
                              title={st.isActive ? "Deactivate account" : "Activate account"}
                            >
                              {st.isActive ? "Deactivate" : "Activate"}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDeletingStaff(st);
                                setDeleteError(null);
                              }}
                              className="p-1 rounded-md text-[10px] font-bold border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                              title="Delete staff account permanently"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
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
                <ShieldCheck className="w-4 h-4 text-[#CF0458]" />
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

      {/* TAB 4: ACTIVITY & AUDIT LOGS (Item 11) */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Summary Metric Cards for Audit */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Logged Events
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {auditEvents.length}
              </div>
              <div className="text-[10px] text-slate-500">Systemwide operations</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Active Operators
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {new Set(auditEvents.map((e) => e.performerName)).size}
              </div>
              <div className="text-[10px] text-slate-500">Distinct personnel logged</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Store Operations
              </div>
              <div className="text-xl font-bold text-[#059669] mt-1">
                {auditEvents.filter((e) => e.departmentCode === "INVENTORY_STORE").length}
              </div>
              <div className="text-[10px] text-slate-500">Intakes, dispatches & returns</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Executive & Finance
              </div>
              <div className="text-xl font-bold text-[#CF0458] mt-1">
                {auditEvents.filter((e) => e.departmentCode === "EXECUTIVE_MANAGEMENT").length}
              </div>
              <div className="text-[10px] text-slate-500">Consignments & SoR settlements</div>
            </div>
          </div>

          {/* Filtering Toolbar */}
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search operator, SKU, supplier, stockist..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden transition-all"
                />
                {auditSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAuditSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  disabled={auditLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin text-[#CF0458]" : ""}`}
                  />
                  <span>Refresh Logs</span>
                </button>
              </div>
            </div>

            {/* Department Filter Pills (Responsive scroll) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {[
                { id: "ALL", label: "All Departments" },
                { id: "INVENTORY_STORE", label: "Store & Warehouse" },
                { id: "EXECUTIVE_MANAGEMENT", label: "Executive & Management" },
                { id: "PRODUCTION", label: "Production Floor" },
                { id: "SECURITY_IT", label: "Security & Access" },
                { id: "LOGISTICS", label: "Logistics" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAuditDeptFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    auditDeptFilter === tab.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Events Feed */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#CF0458]" />
                  <span>Central System Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological record of operational transactions and user actions across departments
                </p>
              </div>
              <span className="text-xs font-mono font-medium text-slate-400">
                {auditEvents.length} events logged
              </span>
            </div>

            {auditLoading && auditEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#CF0458]" />
                <span>Loading system audit logs...</span>
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <Activity className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No events matched</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search query or department filter.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditEvents.map((evt) => {
                  const meta = getActionMeta(evt.type);
                  const dept = getDeptBadge(evt.departmentCode);
                  const Icon = meta.icon;
                  const initials = getInitials(evt.performerName);

                  return (
                    <div
                      key={evt.id}
                      className="p-4 sm:p-4.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>

                        {/* Event Details */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {evt.performerName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${dept.color}`}
                            >
                              {dept.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${meta.color}`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{meta.label}</span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 font-medium">
                            {formatAuditNarrative(evt)}
                          </p>

                          {/* Payload Details Mini Grid / Tags */}
                          {evt.payload && Object.keys(evt.payload).length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500 font-mono">
                              {evt.payload.grnNumber && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  GRN: {evt.payload.grnNumber}
                                </span>
                              )}
                              {evt.payload.referenceId && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  Ref: {evt.payload.referenceId}
                                </span>
                              )}
                              {evt.payload.deliveryCode && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  Waybill: {evt.payload.deliveryCode}
                                </span>
                              )}
                              {evt.payload.referenceNumber && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  Txn: {evt.payload.referenceNumber}
                                </span>
                              )}
                              {evt.payload.terminal && (
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
                                  Terminal: {evt.payload.terminal}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Timestamp & Event ID */}
                      <div className="flex sm:flex-col sm:items-end justify-between items-center shrink-0 text-right text-xs gap-1 sm:pl-3">
                        <span className="text-slate-600 font-medium flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {new Date(evt.timestamp).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {new Date(evt.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                          {evt.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FACTORY SHIFT LOGS */}
      {activeTab === "shift_logs" && (
        <ShiftOperationsLogView readOnly={true} />
      )}

      {/* SUPERVISOR SHIFT ROTATION */}
      {activeTab === "shift_rotation" && (
        <SupervisorShiftRotationView />
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
            <p className="text-xs text-slate-500 mb-3">
              Create staff credentials, secure password, and floor tablet 4-digit PIN.
            </p>

            {staffError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleAddStaffSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  placeholder="e.g. Samuel Adewale"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaff.staffId}
                    onChange={(e) => setNewStaff({ ...newStaff, staffId: e.target.value })}
                    placeholder="MOH-STR-05"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono uppercase focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newStaff.email}
                    onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                    placeholder="s.adewale@mohfood.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                    placeholder="+234 801 234 5678"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Login Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const random = `MohOps#${Math.floor(1000 + Math.random() * 9000)}!`;
                        setNewStaff({ ...newStaff, password: random });
                      }}
                      className="text-[10px] text-[#CF0458] hover:underline font-semibold"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    placeholder="ChangeThisSecurePassword123!"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
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
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden cursor-pointer"
                  >
                    <option value="INVENTORY_STORE">Inventory Store</option>
                    <option value="PRODUCT_STORAGE">Product Storage</option>
                    <option value="PRODUCTION">Production</option>
                    <option value="LOGISTICS">Logistics & Fleet</option>
                    <option value="EXECUTIVE_MANAGEMENT">Executive & IT</option>
                    <option value="ACCOUNTING">Accounting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    System Role
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden cursor-pointer"
                  >
                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                    <option value="PRODUCTION_SUPERVISOR">PRODUCTION_SUPERVISOR</option>
                    <option value="LOGISTICS_OFFICER">LOGISTICS_OFFICER</option>
                    <option value="ACCOUNTANT">ACCOUNTANT</option>
                    <option value="EXECUTIVE">EXECUTIVE</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Floor Tablet 4-Digit PIN (Optional)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newStaff.pin}
                  onChange={(e) => setNewStaff({ ...newStaff, pin: e.target.value })}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono tracking-widest text-center focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Used for instantaneous fast terminal switching without logging out.
                </span>
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
                  disabled={submittingStaff}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#CF0458] hover:bg-[#B5034C] text-white disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submittingStaff ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      Saving...
                    </>
                  ) : (
                    "Save Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-[#CF0458]" />
              <span>Edit Staff Registration</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Modify staff personnel information, assigned role, or reset security credentials.
            </p>

            {editError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditStaffSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  placeholder="e.g. Samuel Adewale"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Staff ID <span className="text-slate-400 font-normal">(Read-only)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingStaff.staffId}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono uppercase text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="s.adewale@mohfood.com"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="+234 801 234 5678"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Reset Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const random = `MohOps#${Math.floor(1000 + Math.random() * 9000)}!`;
                        setEditForm({ ...editForm, password: random });
                      }}
                      className="text-[10px] text-[#CF0458] hover:underline font-semibold cursor-pointer"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={editForm.departmentCode}
                    onChange={(e) => setEditForm({ ...editForm, departmentCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden cursor-pointer"
                  >
                    <option value="INVENTORY_STORE">Inventory Store</option>
                    <option value="PRODUCT_STORAGE">Product Storage</option>
                    <option value="PRODUCTION">Production</option>
                    <option value="LOGISTICS">Logistics & Fleet</option>
                    <option value="EXECUTIVE_MANAGEMENT">Executive & IT</option>
                    <option value="ACCOUNTING">Accounting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    System Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden cursor-pointer"
                  >
                    <option value="STORE_MANAGER">STORE_MANAGER</option>
                    <option value="PRODUCTION_SUPERVISOR">PRODUCTION_SUPERVISOR</option>
                    <option value="LOGISTICS_OFFICER">LOGISTICS_OFFICER</option>
                    <option value="ACCOUNTANT">ACCOUNTANT</option>
                    <option value="EXECUTIVE">EXECUTIVE</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="STAFF">STAFF</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reset Floor Tablet 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={editForm.pin}
                  onChange={(e) => setEditForm({ ...editForm, pin: e.target.value })}
                  placeholder="Leave blank to keep current PIN"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono tracking-widest text-center focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Only enter 4 digits if you wish to reset or assign a new quick-switch PIN.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-[#CF0458] focus:ring-[#CF0458] cursor-pointer"
                />
                <label htmlFor="editIsActive" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Account is Active (permitted to authenticate)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#CF0458] hover:bg-[#B5034C] text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {submittingEdit ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                      Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative">
            <button
              type="button"
              onClick={() => setDeletingStaff(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100">
              <Trash2 className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Delete Staff Registration?
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Are you sure you want to permanently delete the account for{" "}
              <strong className="text-slate-900">{deletingStaff.fullName}</strong>{" "}
              (<span className="font-mono text-slate-700">{deletingStaff.staffId}</span>)?
            </p>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] space-y-1 mb-4">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Permanent Removal Warning</span>
              </div>
              <p className="text-amber-700">
                This will permanently delete their login credentials and quick tablet PIN from the database.
                Historical transaction logs and supervised shifts will safely retain their name for audit compliance.
              </p>
            </div>

            {deleteError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingStaff(null)}
                disabled={submittingDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaffConfirm}
                disabled={submittingDelete}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {submittingDelete ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
