"use client";

import React, { useState, useRef } from "react";
import { RetailStockist } from "@/server/management/store";
import { X, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

interface UploadWhatsAppInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockists: RetailStockist[];
  onSuccess: () => void;
}

export const UploadWhatsAppInvoiceModal: React.FC<UploadWhatsAppInvoiceModalProps> = ({
  isOpen,
  onClose,
  stockists,
  onSuccess,
}) => {
  const [driverName, setDriverName] = useState("Sunday B. (Van 1)");
  const [senderPhone, setSenderPhone] = useState("+234 803 555 1201");
  const [stockistName, setStockistName] = useState(stockists[0]?.name || "Hubmart Supermarket");
  const [amount, setAmount] = useState<string>("284000");
  const [itemCount, setItemCount] = useState<string>("142");
  const [notes, setNotes] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setError("Image size must be less than 3MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName || !senderPhone || !stockistName || Number(amount) <= 0) {
      setError("Driver, phone number, stockist, and amount are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/management/whatsapp-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverName: driverName.trim(),
          senderPhone: senderPhone.trim(),
          stockistName: stockistName.trim(),
          amount: Number(amount),
          itemCount: Number(itemCount) || 0,
          fileUrl: imagePreview || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit invoice.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit invoice.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-[#8E1538]">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Upload WhatsApp Waybill / Receipt
            </h3>
            <p className="text-xs text-slate-500">
              Record driver waybill photo or stamped teller received from WhatsApp group
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-amber-50 border border-[#D97706]/30 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Driver & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Driver / Sales Rep
              </label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                WhatsApp Phone #
              </label>
              <input
                type="text"
                required
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Supermarket */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Supermarket Stockist
            </label>
            <input
              type="text"
              required
              value={stockistName}
              onChange={(e) => setStockistName(e.target.value)}
              list="stockists-datalist"
              placeholder="e.g. Hubmart Ikeja"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
            />
            <datalist id="stockists-datalist">
              {stockists.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          {/* Amount & Items Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Amount on Note (₦)
              </label>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Units Acknowledged
              </label>
              <input
                type="number"
                min="0"
                value={itemCount}
                onChange={(e) => setItemCount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Waybill / Stamped Teller Snapshot
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative rounded-xl border border-slate-200 overflow-hidden group bg-slate-50">
                <img
                  src={imagePreview}
                  alt="Waybill Preview"
                  className="w-full h-36 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 px-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600">
                  Select photo from WhatsApp download
                </span>
                <span className="text-[10px] text-slate-400">PNG, JPG up to 3MB</span>
              </button>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received with store manager stamp"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#8E1538] hover:bg-[#72102C] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? "Queuing..." : "Queue for Verification"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
