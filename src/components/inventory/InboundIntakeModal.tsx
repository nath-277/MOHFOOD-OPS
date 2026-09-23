"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { InventoryItem } from "@/server/inventory/store";
import {
  X,
  ArrowDownLeft,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Pencil,
  RotateCcw,
  RefreshCw,
  Search,
  Clock,
  Plus,
  AlertTriangle,
  Boxes,
} from "lucide-react";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { getAvailableUnits, toBaseUnits } from "@/lib/packaging";
import { notifyInboundIntake } from "@/lib/pushNotifications";
import { SearchableProductSelect } from "@/components/ui/SearchableProductSelect";

export interface IntakeRecordItem {
  id: string;
  itemId: string;
  itemCode?: string;
  itemName: string;
  quantity: number;
  unit: string;
  lotId?: string;
  lotNumber?: string;
  grnNumber?: string;
  unitCost?: number;
  expiryDate?: string;
  waybillUrl?: string;
  notes?: string;
  performedByName: string;
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  status: "PERMANENT" | "CANCELLED" | "PENDING_HANDOVER";
  createdAt: string;
}

interface InboundIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: () => void;
  initialTab?: "NEW" | "RECENT";
}

export const InboundIntakeModal: React.FC<InboundIntakeModalProps> = ({
  isOpen,
  onClose,
  items,
  shiftType,
  onSuccess,
  initialTab = "NEW",
}) => {
  const [activeTab, setActiveTab] = useState<"NEW" | "RECENT">(initialTab);

  // Form State
  const [selectedCode, setSelectedCode] = useState(items[0]?.code || "");
  const [quantity, setQuantity] = useState<string>("");
  const [selectedUnitType, setSelectedUnitType] = useState<"CARTON" | "PACK" | "BASE" | "RECIPE_UOM">("BASE");
  const [lotNumber, setLotNumber] = useState("");
  const [grnNumber, setGrnNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Recent Intakes State
  const [recentIntakes, setRecentIntakes] = useState<IntakeRecordItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [recentSearch, setRecentSearch] = useState("");

  // Edit Intake State
  const [editingIntake, setEditingIntake] = useState<IntakeRecordItem | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Intake State
  const [deletingIntake, setDeletingIntake] = useState<IntakeRecordItem | null>(null);
  const [deletingReason, setDeletingReason] = useState("");
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const generateLot = () =>
    `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const generateGrn = () => `GRN-${Date.now().toString().slice(-6)}`;

  const resetForm = useCallback(() => {
    setQuantity("");
    setUnitCost("");
    setNotes("");
    setExpiryDate("");
    setAttachmentPreview(null);
    setAttachmentName(null);
    setError(null);
    setLotNumber(generateLot());
    setGrnNumber(generateGrn());
    if (items.length > 0) {
      setSelectedCode((prev) => (items.some((i) => i.code === prev) ? prev : items[0].code));
      const first = items[0];
      const units = getAvailableUnits(first);
      setSelectedUnitType(units[0]?.type || "BASE");
    }
  }, [items]);

  const loadRecentIntakes = useCallback(async () => {
    try {
      setLoadingRecent(true);
      const res = await fetch("/api/inventory/intakes?limit=50&includeCancelled=false");
      if (res.ok) {
        const data = await res.json();
        setRecentIntakes(data.intakes || []);
      }
    } catch (err) {
      console.error("Failed to load recent intakes:", err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  // Guarantee form reset whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      resetForm();
      loadRecentIntakes();
      setEditingIntake(null);
      setDeletingIntake(null);
      setEditError(null);
      setDeleteError(null);
      setSuccessToast(null);
    }
  }, [isOpen, initialTab, resetForm, loadRecentIntakes]);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.code === selectedCode) || items[0];
  const availableUnits = currentItem ? getAvailableUnits(currentItem) : [];

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
      setError("Please enter a valid intake quantity.");
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

      const intakeNote =
        selectedUnitType !== "BASE"
          ? `${notes ? `${notes} • ` : ""}Received: ${quantity} ${activeUnitLabel} (= ${baseQty.toLocaleString()} ${activeItem?.uom})`
          : notes;

      const effectiveLot = lotNumber || generateLot();
      const effectiveGrn = grnNumber || generateGrn();

      const res = await fetch("/api/inventory/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCode: effectiveCode,
          quantity: baseQty,
          lotNumber: effectiveLot,
          expiryDate: expiryDate || undefined,
          unitCost: unitCost ? Number(unitCost) : undefined,
          grnNumber: effectiveGrn,
          shiftType,
          notes: intakeNote,
          attachmentUrl: attachmentPreview || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log intake.");
      }

      notifyInboundIntake(
        activeItem?.name || currentItem?.name || effectiveCode,
        quantity,
        activeUnitLabel
      ).catch(() => {});

      // Completely clear the form to protect subsequent intakes
      resetForm();
      await loadRecentIntakes();
      onSuccess();
      setSuccessToast(`Logged +${quantity} ${activeUnitLabel} of ${activeItem?.name || effectiveCode} successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to record inbound intake.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (intake: IntakeRecordItem) => {
    setEditingIntake(intake);
    setEditQty(String(intake.quantity));
    setEditCost(intake.unitCost !== undefined ? String(intake.unitCost) : "");
    setEditNotes(intake.notes || "");
    setEditExpiry(intake.expiryDate || "");
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIntake) return;
    if (!editQty || Number(editQty) <= 0) {
      setEditError("Please enter a valid positive quantity.");
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/inventory/intakes/${encodeURIComponent(editingIntake.id)}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: Number(editQty),
          unitCost: editCost ? Number(editCost) : undefined,
          notes: editNotes.trim() || undefined,
          expiryDate: editExpiry || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update intake.");
      }

      setEditingIntake(null);
      await loadRecentIntakes();
      onSuccess();
      setSuccessToast(`Intake for ${editingIntake.itemName} updated successfully.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setEditError(err.message || "Failed to update intake.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingIntake) return;
    setSubmittingDelete(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/inventory/intakes/${encodeURIComponent(deletingIntake.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: deletingReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete intake.");
      }

      const deletedItemName = deletingIntake.itemName;
      const deletedQty = deletingIntake.quantity;
      const deletedUnit = deletingIntake.unit;

      setDeletingIntake(null);
      setDeletingReason("");
      await loadRecentIntakes();
      onSuccess();
      setSuccessToast(`Intake of ${deletedQty} ${deletedUnit} ${deletedItemName} deleted and reversed from stock.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete intake.");
    } finally {
      setSubmittingDelete(false);
    }
  };

  const filteredRecent = useMemo(() => {
    if (!recentSearch.trim()) return recentIntakes;
    const q = recentSearch.toLowerCase();
    return recentIntakes.filter(
      (it) =>
        it.itemName.toLowerCase().includes(q) ||
        (it.itemCode && it.itemCode.toLowerCase().includes(q)) ||
        (it.lotNumber && it.lotNumber.toLowerCase().includes(q)) ||
        (it.grnNumber && it.grnNumber.toLowerCase().includes(q)) ||
        (it.performedByName && it.performedByName.toLowerCase().includes(q)) ||
        (it.notes && it.notes.toLowerCase().includes(q))
    );
  }, [recentIntakes, recentSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Raw Material Inbound</h3>
              <p className="text-[11px] text-white/80">Log incoming stock, or inspect and modify recent intakes</p>
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
                setActiveTab("NEW");
                setEditingIntake(null);
                setDeletingIntake(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "NEW"
                  ? "bg-white text-[#CF0458] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log New Intake</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("RECENT");
                loadRecentIntakes();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "RECENT"
                  ? "bg-white text-[#CF0458] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recent Intakes</span>
              {recentIntakes.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-[#CF0458]/10 text-[#CF0458] rounded-full text-[10px] font-mono">
                  {recentIntakes.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === "RECENT" && (
            <button
              type="button"
              onClick={loadRecentIntakes}
              disabled={loadingRecent}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              title="Refresh intake list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRecent ? "animate-spin text-[#CF0458]" : ""}`} />
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
            {activeTab === "NEW" && (
              <button
                type="button"
                onClick={() => setActiveTab("RECENT")}
                className="text-[11px] underline text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
              >
                View in Recent Intakes →
              </button>
            )}
          </div>
        )}

        {/* TAB 1: LOG NEW INTAKE */}
        {activeTab === "NEW" && (
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
                Store Material Item
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
                placeholder="Select store material item..."
              />
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Intake Qty
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
                              ? "bg-[#D81B60] text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#D81B60]"
                />
                {currentItem && Number(quantity) > 0 && selectedUnitType !== "BASE" && (
                  <div className="mt-1.5 text-[11px] text-emerald-700 font-semibold flex flex-wrap items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200/60">
                    <span>=</span>
                    <span>
                      {toBaseUnits(Number(quantity), selectedUnitType, currentItem).toLocaleString()}{" "}
                      {currentItem.uom}
                    </span>
                    {selectedUnitType === "CARTON" && currentItem.packagingType === "CARTON_AND_PACK" && (
                      <span className="text-slate-500 font-normal text-[10px]">
                        ({(Number(quantity) * (Number(currentItem.packsPerCarton) || 1)).toLocaleString()}{" "}
                        {currentItem.packUnit || "packs"})
                      </span>
                    )}
                    <span className="text-slate-400 font-normal text-[10px]">(to store)</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Unit Purchase Cost (₦)
                </label>
                <input
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={`Current: ₦${currentItem?.costPerUnit || 0}`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D81B60]"
                />
              </div>
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>

            {/* Waybill / Paper Invoice Attachment with Camera & Upload */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Waybill / Invoice Attachment (Optional)
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
                  {attachmentPreview.startsWith("data:image") ? (
                    <img
                      src={attachmentPreview}
                      alt="Waybill Preview"
                      className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {attachmentName || "Waybill Document Attached"}
                    </div>
                    <div className="text-[10px] text-[#059669] font-semibold flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ready for secure storage</span>
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
                    <Camera className="w-4 h-4 text-[#D81B60]" />
                    <span>Take Camera Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Upload File / PDF</span>
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
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Receiving Condition Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Packaging intact, temperature 4°C verified on cold truck"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D81B60]"
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
                <span>Reset Form</span>
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
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#D81B60] to-[#AD1457] hover:brightness-105 active:scale-95 transition-all shadow-md shadow-[#D81B60]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? "Logging..." : "Confirm Inbound Intake"}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: RECENT INTAKES LIST & MANAGEMENT */}
        {activeTab === "RECENT" && (
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                placeholder="Search recent intakes by item name, code, lot, or staff..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>

            {loadingRecent ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#D81B60]" />
                <p className="text-xs font-medium">Loading recent inbound intakes...</p>
              </div>
            ) : filteredRecent.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No Recent Intakes Found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {recentSearch ? "No intakes matched your search query." : "No material intakes have been recorded yet."}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("NEW")}
                  className="mt-3 px-3.5 py-1.5 bg-[#CF0458] text-white rounded-lg text-xs font-bold hover:bg-[#B5034C] transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log an Inbound Intake Now</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecent.map((intake) => {
                  const isBeingEdited = editingIntake?.id === intake.id;
                  const isBeingDeleted = deletingIntake?.id === intake.id;

                  return (
                    <div
                      key={intake.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs space-y-3"
                    >
                      {/* Top Row: Item Name, Quantity, and Actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{intake.itemName}</span>
                            {intake.itemCode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                {intake.itemCode}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                            <span>
                              {new Date(intake.createdAt).toLocaleDateString()} at{" "}
                              {new Date(intake.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span>•</span>
                            <span>{intake.shiftType === "MORNING_SHIFT" ? "☀️ Morning" : "🌙 Night"} Shift</span>
                            <span>•</span>
                            <span>By: <strong className="text-slate-600">{intake.performedByName}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold text-xs">
                            +{intake.quantity.toLocaleString()} {intake.unit}
                          </span>

                          {!isBeingEdited && !isBeingDeleted && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(intake)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
                                title="Modify / Edit this intake"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingIntake(intake);
                                  setDeletingReason("");
                                  setDeleteError(null);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                                title="Delete this intake and reverse stock"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reference & Notes meta */}
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                        {intake.lotNumber && (
                          <span>
                            Lot: <strong className="text-slate-700 font-mono">{intake.lotNumber}</strong>
                          </span>
                        )}
                        {intake.grnNumber && (
                          <span>
                            GRN: <strong className="text-slate-700 font-mono">{intake.grnNumber}</strong>
                          </span>
                        )}
                        {intake.unitCost !== undefined && (
                          <span>
                            Cost: <strong className="text-slate-700 font-mono">₦{intake.unitCost.toLocaleString()}</strong> / {intake.unit}
                          </span>
                        )}
                        {intake.expiryDate && (
                          <span>
                            Expires: <strong className="text-slate-700">{intake.expiryDate}</strong>
                          </span>
                        )}
                        {intake.notes && (
                          <span className="w-full text-slate-600 italic mt-0.5">
                            &ldquo;{intake.notes}&rdquo;
                          </span>
                        )}
                      </div>

                      {/* Inline Edit Form */}
                      {isBeingEdited && (
                        <form
                          onSubmit={handleSaveEdit}
                          className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3 animate-in fade-in"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                              Modify Intake Details
                            </span>
                            <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
                              Stock will adjust automatically
                            </span>
                          </div>

                          {editError && (
                            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                              <span>{editError}</span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                                Quantity ({intake.unit}) *
                              </label>
                              <input
                                type="number"
                                step="any"
                                required
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                                Unit Cost (₦)
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={editCost}
                                onChange={(e) => setEditCost(e.target.value)}
                                placeholder="Unit purchase cost"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                                Expiry Date
                              </label>
                              <input
                                type="date"
                                value={editExpiry}
                                onChange={(e) => setEditExpiry(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                                Updated Notes
                              </label>
                              <input
                                type="text"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Reason for change / condition"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingIntake(null)}
                              disabled={savingEdit}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={savingEdit}
                              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{savingEdit ? "Saving..." : "Save Changes"}</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Inline Delete Confirmation */}
                      {isBeingDeleted && (
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-200 space-y-3 animate-in fade-in">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-red-900">
                                Delete & Reverse This Intake?
                              </h4>
                              <p className="text-[11px] text-red-700 mt-0.5">
                                This will reverse the intake record and deduct{" "}
                                <strong>
                                  {intake.quantity} {intake.unit}
                                </strong>{" "}
                                from {intake.itemName} in store inventory.
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
                            placeholder="Optional reason for cancellation (e.g. Duplicated entry, wrong weight)..."
                            className="w-full px-3 py-1.5 rounded-lg border border-red-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                          />

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setDeletingIntake(null)}
                              disabled={submittingDelete}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              Keep Intake
                            </button>
                            <button
                              type="button"
                              onClick={handleConfirmDelete}
                              disabled={submittingDelete}
                              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{submittingDelete ? "Deleting..." : "Confirm Reversal & Delete"}</span>
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
