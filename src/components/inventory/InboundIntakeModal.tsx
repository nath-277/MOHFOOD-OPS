"use client";

import React, { useState, useRef, useEffect } from "react";
import { InventoryItem } from "@/server/inventory/store";
import { X, ArrowDownLeft, Upload, Camera, CheckCircle2, AlertCircle, FileText, Trash2 } from "lucide-react";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { getAvailableUnits, toBaseUnits } from "@/lib/packaging";
import { notifyInboundIntake } from "@/lib/pushNotifications";

interface InboundIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT";
  onSuccess: () => void;
}

export const InboundIntakeModal: React.FC<InboundIntakeModalProps> = ({
  isOpen,
  onClose,
  items,
  shiftType,
  onSuccess,
}) => {
  const [selectedCode, setSelectedCode] = useState(items[0]?.code || "");
  const [quantity, setQuantity] = useState<string>("");
  const [selectedUnitType, setSelectedUnitType] = useState<"CARTON" | "PACK" | "BASE">("BASE");
  // Auto-generated internal lot and GRN (no longer required as manual operator inputs)
  const [lotNumber] = useState(`LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
  const [grnNumber] = useState(`GRN-${Date.now().toString().slice(-6)}`);
  const [supplierName, setSupplierName] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Guarantee selectedCode is populated whenever items load or modal opens
  useEffect(() => {
    if (isOpen && items.length > 0) {
      if (!selectedCode || !items.some((i) => i.code === selectedCode)) {
        const first = items[0];
        setSelectedCode(first.code);
        const units = getAvailableUnits(first);
        setSelectedUnitType(units[0]?.type || "BASE");
      }
    }
  }, [isOpen, items, selectedCode]);

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
    if (!supplierName || !supplierName.trim()) {
      setError("Please enter the supplier or farm name.");
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

      const effectiveLot =
        lotNumber ||
        `LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const res = await fetch("/api/inventory/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCode: effectiveCode,
          quantity: baseQty,
          lotNumber: effectiveLot,
          supplierName: supplierName.trim(),
          expiryDate: expiryDate || undefined,
          unitCost: unitCost ? Number(unitCost) : undefined,
          grnNumber,
          shiftType,
          notes: intakeNote,
          attachmentUrl: attachmentPreview || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to log intake.");
      }

      // Fire push notification for successful inbound intake
      notifyInboundIntake(
        activeItem?.name || currentItem?.name || effectiveCode,
        quantity,
        activeUnitLabel,
        supplierName.trim()
      ).catch(() => {});

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record inbound intake.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#D81B60] to-[#AD1457] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Ad-Hoc Raw Material Inbound</h3>
              <p className="text-[11px] text-white/80">Log unscheduled supplier arrival & assign batch lot</p>
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Selector */}
          {/* Item Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
              Store Material Item
            </label>
            <select
              value={selectedCode}
              onChange={(e) => {
                const newCode = e.target.value;
                setSelectedCode(newCode);
                const newItem = items.find((i) => i.code === newCode);
                if (newItem) {
                  const units = getAvailableUnits(newItem);
                  setSelectedUnitType(units[0]?.type || "BASE");
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D81B60] bg-slate-50"
            >
              {items.map((i) => (
                <option key={i.code} value={i.code}>
                  [{i.category.replace("_", " ")}] {i.name} ({i.uom})
                </option>
              ))}
            </select>
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

          {/* Supplier Name & Expiry Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Supplier / Farm <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Dan Dairy Farms Ltd"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>

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

            {/* Hidden inputs */}
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
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
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
      </div>
    </div>
  );
};
