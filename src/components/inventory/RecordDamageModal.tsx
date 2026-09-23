"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { InventoryItem } from "@/server/inventory/store";
import {
  X,
  AlertTriangle,
  AlertOctagon,
  Trash2,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Clock,
  Plus,
  Boxes,
  RotateCcw,
} from "lucide-react";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { getAvailableUnits, toBaseUnits } from "@/lib/packaging";
import { SearchableProductSelect } from "@/components/ui/SearchableProductSelect";

export interface DamageRecordItem {
  id: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  quantity: number;
  unit: string;
  damageDate: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  reason: string;
  notes?: string;
  performedByName: string;
  referenceId?: string;
  status: "PERMANENT" | "CANCELLED";
  createdAt: string;
}

const DAMAGE_REASONS = [
  { value: "Expired / Spoilt in Storage", label: "Expired / Spoilt in Storage" },
  { value: "Spillage / Leaking / Broken Container", label: "Spillage / Leaking / Broken Container" },
  { value: "Cold Chain / Refrigerator Failure", label: "Cold Chain / Refrigerator Failure" },
  { value: "Pest / Rodent Infestation Damage", label: "Pest / Rodent Infestation Damage" },
  { value: "Handling / Transport Drop Damage", label: "Handling / Transport Drop Damage" },
  { value: "Physical Contamination / Defect", label: "Physical Contamination / Defect" },
  { value: "Production Floor Scrap / Rejection", label: "Production Floor Scrap / Rejection" },
  { value: "Other Operational Write-Off", label: "Other Operational Write-Off" },
];

interface RecordDamageModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  defaultDate?: string;
  defaultShift?: "MORNING_SHIFT" | "NIGHT_SHIFT" | "ALL";
  onSuccess: () => void;
  initialTab?: "RECORD" | "RECENT";
}

export const RecordDamageModal: React.FC<RecordDamageModalProps> = ({
  isOpen,
  onClose,
  items,
  defaultDate,
  defaultShift = "MORNING_SHIFT",
  onSuccess,
  initialTab = "RECORD",
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [activeTab, setActiveTab] = useState<"RECORD" | "RECENT">(initialTab);

  // Form State
  const [selectedCode, setSelectedCode] = useState(items[0]?.code || "");
  const [quantity, setQuantity] = useState<string>("");
  const [selectedUnitType, setSelectedUnitType] = useState<"CARTON" | "PACK" | "BASE" | "RECIPE_UOM">("BASE");
  const [damageDate, setDamageDate] = useState<string>(defaultDate || todayStr);
  const [shiftType, setShiftType] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">(
    defaultShift === "NIGHT_SHIFT" ? "NIGHT_SHIFT" : "MORNING_SHIFT"
  );
  const [reason, setReason] = useState<string>(DAMAGE_REASONS[0].value);
  const [notes, setNotes] = useState<string>("");
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Recent Damages State
  const [recentDamages, setRecentDamages] = useState<DamageRecordItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentSearch, setRecentSearch] = useState("");

  // Deletion State
  const [deletingDamage, setDeletingDamage] = useState<DamageRecordItem | null>(null);
  const [deletingReason, setDeletingReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setQuantity("");
    setNotes("");
    setDamageDate(defaultDate && defaultDate <= todayStr ? defaultDate : todayStr);
    setShiftType(defaultShift === "NIGHT_SHIFT" ? "NIGHT_SHIFT" : "MORNING_SHIFT");
    setReason(DAMAGE_REASONS[0].value);
    setAttachmentPreview(null);
    setAttachmentName(null);
    setError(null);
    if (items.length > 0) {
      setSelectedCode((prev) => (items.some((i) => i.code === prev) ? prev : items[0].code));
      const first = items[0];
      const units = getAvailableUnits(first);
      setSelectedUnitType(units[0]?.type || "BASE");
    }
  }, [defaultDate, defaultShift, items, todayStr]);

  const loadRecentDamages = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const res = await fetch("/api/inventory/damages?limit=50&includeCancelled=false");
      if (res.ok) {
        const data = await res.json();
        setRecentDamages(data.damages || []);
      }
    } catch (err) {
      console.error("Failed to load recent damages:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      resetForm();
      loadRecentDamages();
      setDeletingDamage(null);
      setDeleteError(null);
      setSuccessToast(null);
    }
  }, [isOpen, initialTab, resetForm, loadRecentDamages]);

  const filteredRecent = useMemo(() => {
    if (!recentSearch.trim()) return recentDamages;
    const q = recentSearch.toLowerCase();
    return recentDamages.filter(
      (d) =>
        d.itemName.toLowerCase().includes(q) ||
        (d.itemCode && d.itemCode.toLowerCase().includes(q)) ||
        (d.referenceId && d.referenceId.toLowerCase().includes(q)) ||
        (d.reason && d.reason.toLowerCase().includes(q)) ||
        (d.performedByName && d.performedByName.toLowerCase().includes(q)) ||
        (d.damageDate && d.damageDate.includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q))
    );
  }, [recentDamages, recentSearch]);

  const currentItem = useMemo(
    () => items.find((i) => i.code === selectedCode) || items[0],
    [items, selectedCode]
  );
  const availableUnits = useMemo(
    () => (currentItem ? getAvailableUnits(currentItem) : []),
    [currentItem]
  );

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setAttachmentName(file.name);
      try {
        const optimized = await optimizeImageFile(file, 1600, 0.82);
        setAttachmentPreview(optimized.dataUrl);
      } catch {
        setError("Failed to process attachment. Please try again.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const effectiveCode = selectedCode || items[0]?.code;
    if (!effectiveCode) {
      setError("Please select a store material item.");
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setError("Please enter a valid damage quantity.");
      return;
    }
    if (!damageDate) {
      setError("Please select the date the damage occurred.");
      return;
    }
    if (damageDate > todayStr) {
      setError("Damage date cannot be in the future.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const activeItem = items.find((i) => i.code === effectiveCode) || currentItem;
      const baseQty = activeItem
        ? toBaseUnits(Number(quantity), selectedUnitType, activeItem)
        : Number(quantity);

      const activeUnitLabel =
        availableUnits.find((u) => u.type === selectedUnitType)?.label ||
        activeItem?.uom ||
        "units";

      const damageNote =
        selectedUnitType !== "BASE"
          ? `${notes ? `${notes} • ` : ""}Scrapped: ${quantity} ${activeUnitLabel} (= ${baseQty.toLocaleString()} ${activeItem?.uom})`
          : notes;

      const res = await fetch("/api/inventory/damages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCode: effectiveCode,
          quantity: baseQty,
          damageDate,
          shiftType,
          reason,
          notes: damageNote,
          attachmentUrl: attachmentPreview || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record damage.");
      }

      resetForm();
      await loadRecentDamages();
      onSuccess();
      setSuccessToast(
        `Damage of -${quantity} ${activeUnitLabel} for ${activeItem?.name || effectiveCode} recorded on ${damageDate} (${shiftType === "MORNING_SHIFT" ? "Morning" : "Night"} Shift).`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setError(err.message || "Failed to record damage.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDamage) return;
    setSubmittingDelete(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/inventory/damages/${encodeURIComponent(deletingDamage.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: deletingReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reverse damage.");
      }

      const deletedName = deletingDamage.itemName;
      const deletedQty = deletingDamage.quantity;
      const deletedUnit = deletingDamage.unit;

      setDeletingDamage(null);
      setDeletingReason("");
      await loadRecentDamages();
      onSuccess();
      setSuccessToast(
        `Damage entry cancelled. +${deletedQty} ${deletedUnit} restored to ${deletedName} in warehouse stock.`
      );
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to cancel damage entry.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Record Material Damage / Spoilage</h3>
              <p className="text-[11px] text-white/85">
                Log defective or expired materials tied to a specific day & shift
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab("RECORD");
                setDeletingDamage(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "RECORD"
                  ? "bg-white text-red-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Damage</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("RECENT");
                loadRecentDamages();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "RECENT"
                  ? "bg-white text-red-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Damages</span>
              {recentDamages.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-mono">
                  {recentDamages.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "RECENT" && (
            <button
              type="button"
              onClick={loadRecentDamages}
              disabled={loadingRecent}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              title="Refresh damage list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRecent ? "animate-spin text-red-600" : ""}`} />
            </button>
          )}
        </div>

        {/* Success Toast Banner */}
        {successToast && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            {activeTab === "RECORD" && (
              <button
                type="button"
                onClick={() => setActiveTab("RECENT")}
                className="text-[11px] underline text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
              >
                View in Recent Damages →
              </button>
            )}
          </div>
        )}

        {/* TAB 1: RECORD DAMAGE */}
        {activeTab === "RECORD" && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Item Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Store Material Item *
              </label>
              <SearchableProductSelect
                items={items}
                value={selectedCode}
                valueKey="code"
                onChange={(newCode) => {
                  setSelectedCode(newCode);
                  const newItem = items.find((i) => i.code === newCode);
                  if (newItem) {
                    const units = getAvailableUnits(newItem);
                    setSelectedUnitType(units[0]?.type || "BASE");
                  }
                }}
                placeholder="Select damaged material..."
              />
            </div>

            {/* Date and Shift of Damage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Date of Damage *
                </label>
                <input
                  type="date"
                  required
                  value={damageDate}
                  max={todayStr}
                  onChange={(e) => setDamageDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Defaults to active sheet date. Can be backdated to a past shift.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Occurred During Shift *
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShiftType("MORNING_SHIFT")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      shiftType === "MORNING_SHIFT"
                        ? "bg-white text-amber-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>☀️ Morning</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftType("NIGHT_SHIFT")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      shiftType === "NIGHT_SHIFT"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>🌙 Night</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quantity and Unit Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Damaged Quantity *
                </label>
                {availableUnits.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                    {availableUnits.map((u) => (
                      <button
                        key={u.type}
                        type="button"
                        onClick={() => setSelectedUnitType(u.type)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                          selectedUnitType === u.type
                            ? "bg-red-600 text-white shadow-xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={`Current stock: ${currentItem?.currentStock || 0} ${currentItem?.uom || "units"}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              {currentItem && Number(quantity) > 0 && selectedUnitType !== "BASE" && (
                <div className="mt-1.5 text-[11px] text-amber-800 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60">
                  <span>=</span>
                  <span>
                    {toBaseUnits(Number(quantity), selectedUnitType, currentItem).toLocaleString()}{" "}
                    {currentItem.uom}
                  </span>
                  <span className="text-slate-400 font-normal text-[10px]">(deducted from warehouse)</span>
                </div>
              )}
            </div>

            {/* Damage Category / Fault Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Damage / Fault Category *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500 bg-white cursor-pointer"
              >
                {DAMAGE_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes / Details */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Fault Explanation & Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. 2 bags found punctured, grain contaminated by moisture in chiller"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Evidence Photo Attachment */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Photo Evidence (Optional)
                </label>
                {attachmentPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentPreview(null);
                      setAttachmentName(null);
                    }}
                    className="text-[11px] text-red-600 hover:text-red-800 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {attachmentPreview ? (
                <div className="flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200">
                  <img
                    src={attachmentPreview}
                    alt="Damage Evidence"
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {attachmentName || "Damage Photo Attached"}
                    </div>
                    <div className="text-[10px] text-[#059669] font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ready for audit logging</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                  >
                    <Camera className="w-4 h-4 text-red-600" />
                    <span>Take Camera Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Upload Image</span>
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={cameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
                title="Clear all fields"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-105 active:scale-95 transition-all shadow-md shadow-red-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>{loading ? "Recording..." : "Confirm & Write-Off Stock"}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: RECENT DAMAGES & REVERSAL */}
        {activeTab === "RECENT" && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                placeholder="Search recent damages by item name, date, staff, or reason..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {loadingRecent ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-red-600" />
                <p className="text-xs font-medium">Loading recent damages & write-offs...</p>
              </div>
            ) : filteredRecent.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No Recent Damages Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {recentSearch ? "No records matched your search query." : "No material damages have been recorded yet."}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("RECORD")}
                  className="mt-3 px-3.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record a Damage Now</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecent.map((damage) => {
                  const isBeingDeleted = deletingDamage?.id === damage.id;

                  return (
                    <div
                      key={damage.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs space-y-3"
                    >
                      {/* Top Row: Item Name, Quantity, and Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{damage.itemName}</span>
                            {damage.itemCode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {damage.itemCode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                            <span>
                              Damage Date: <strong className="text-slate-700">{damage.damageDate}</strong>
                            </span>
                            <span>•</span>
                            <span>{damage.shiftType === "MORNING_SHIFT" ? "☀️ Morning" : "🌙 Night"} Shift</span>
                            <span>•</span>
                            <span>By: <strong className="text-slate-600">{damage.performedByName}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-xl bg-red-50 border border-red-200 text-red-700 font-mono font-bold text-xs">
                            -{damage.quantity.toLocaleString()} {damage.unit}
                          </span>

                          {!isBeingDeleted && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingDamage(damage);
                                setDeletingReason("");
                                setDeleteError(null);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                              title="Delete this damage entry and restore stock"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reference & Reason Notes */}
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>
                          Reason: <strong className="text-slate-800 font-semibold">{damage.reason}</strong>
                        </span>
                        {damage.referenceId && (
                          <span>
                            Ref: <strong className="text-slate-700 font-mono">{damage.referenceId}</strong>
                          </span>
                        )}
                        {damage.notes && (
                          <span className="w-full text-slate-600 italic mt-0.5">
                            &ldquo;{damage.notes}&rdquo;
                          </span>
                        )}
                      </div>

                      {/* Inline Delete Confirmation */}
                      {isBeingDeleted && (
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 space-y-3 animate-in fade-in">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-red-900">
                                Reverse & Cancel This Damage Entry?
                              </h4>
                              <p className="text-[11px] text-red-700 mt-0.5">
                                This will cancel the damage record and restore{" "}
                                <strong>
                                  +{damage.quantity} {damage.unit}
                                </strong>{" "}
                                back to {damage.itemName} in warehouse stock.
                              </p>
                            </div>
                          </div>

                          {deleteError && (
                            <div className="p-2.5 rounded-xl bg-white border border-red-300 text-red-700 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                              <span>{deleteError}</span>
                            </div>
                          )}

                          <input
                            type="text"
                            value={deletingReason}
                            onChange={(e) => setDeletingReason(e.target.value)}
                            placeholder="Optional reason for reversal (e.g. Accidental entry, material recovered)..."
                            className="w-full px-3 py-1.5 rounded-lg border border-red-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                          />

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setDeletingDamage(null)}
                              disabled={submittingDelete}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Keep Record
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmDelete}
                              disabled={submittingDelete}
                              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{submittingDelete ? "Restoring..." : "Confirm Reversal & Restore Stock"}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
