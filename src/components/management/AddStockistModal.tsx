"use client";

import React, { useState } from "react";
import { X, Building, CheckCircle2, AlertCircle } from "lucide-react";

interface AddStockistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddStockistModal: React.FC<AddStockistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [standardUnitPrice, setStandardUnitPrice] = useState<string>("2000");
  const [paymentTerms, setPaymentTerms] = useState("Weekly Net 7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !location || !contactPerson || !phone) {
      setError("Supermarket name, location, contact person, and phone are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/management/stockists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          contactPerson: contactPerson.trim(),
          phone: phone.trim(),
          standardUnitPrice: Number(standardUnitPrice) || 2000,
          paymentTerms: paymentTerms.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register stockist.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to register stockist.");
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
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Register Supermarket Partner
            </h3>
            <p className="text-xs text-slate-500">
              Add new retail stockist account for Sale or Return (SoR) consignments
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
          {/* Name & Location */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Supermarket Brand Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Blenco Supermarket"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
              Store Branch / Location
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Sangotedo, Ajah, Lagos"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
            />
          </div>

          {/* Contact Person & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Store Receiving Manager
              </label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Mr. Austin"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Direct Contact Phone #
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +234 812 000 1122"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Unit Price & Payment Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Wholesale Unit Price (₦)
              </label>
              <input
                type="number"
                min="0"
                required
                value={standardUnitPrice}
                onChange={(e) => setStandardUnitPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:border-[#8E1538] bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Agreed Payment Terms
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#8E1538] bg-slate-50 text-slate-900"
              >
                <option value="Weekly Net 7">Weekly Net 7</option>
                <option value="Bi-Weekly">Bi-Weekly</option>
                <option value="Monthly Net 14">Monthly Net 14</option>
                <option value="Cash on Reconcile">Cash on Reconcile</option>
              </select>
            </div>
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
              <span>{loading ? "Registering..." : "Register Retail Partner"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
