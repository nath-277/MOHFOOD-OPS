"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, Camera, CheckCircle2, AlertCircle, Edit3 } from "lucide-react";
import { optimizeImageFile } from "@/lib/imageOptimizer";

interface EditItemModalProps {
  isOpen: boolean;
  item: any | null;
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onSuccess,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"PERISHABLE_MEASURED" | "PERISHABLE_NUMBERED" | "PACKAGING_NON_PERISHABLE">("PERISHABLE_MEASURED");
  const [uom, setUom] = useState("kg");
  const [currentStock, setCurrentStock] = useState<string>("0");
  const [minStockThreshold, setMinStockThreshold] = useState<string>("10");
  const [costPerUnit, setCostPerUnit] = useState<string>("");
  const [storageLocation, setStorageLocation] = useState("Cold Room A");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setCode(item.code || "");
      setName(item.name || "");
      setCategory(item.category || "PERISHABLE_MEASURED");
      setUom(item.uom || "kg");
      setCurrentStock(item.currentStock !== undefined ? String(item.currentStock) : "0");
      setMinStockThreshold(item.minStockThreshold !== undefined ? String(item.minStockThreshold) : "10");
      setCostPerUnit(item.costPerUnit !== undefined ? String(item.costPerUnit) : "");
      setStorageLocation(item.storageLocation || "Central Store");
      setImagePreview(item.imageUrl || null);
      setSelectedFile(null);
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      try {
        const optimized = await optimizeImageFile(file, 1600, 0.82);
        setImagePreview(optimized.dataUrl);
        setSelectedFile(optimized.file);
      } catch (err) {
        setError("Failed to process image. Please try again.");
      }
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !uom) {
      setError("Item code, material name, and unit of measure are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalImageUrl: string | undefined = imagePreview || undefined;

      // Upload picture to Cloudflare R2 only after Save Changes is clicked
      if (selectedFile) {
        setUploadStatus("Uploading updated photo to Cloudflare R2...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folder", "inventory-items");
        formData.append("productName", name.trim());
        formData.append("itemCode", code.trim());

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || "Failed to upload image to Cloudflare R2.");
        }

        finalImageUrl = uploadData.url || uploadData.fileUrl;
      }

      setUploadStatus("Saving material changes...");
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          category,
          uom: uom.trim(),
          currentStock: Number(currentStock) || 0,
          minStockThreshold: Number(minStockThreshold) || 10,
          costPerUnit: Number(costPerUnit) || 0,
          storageLocation: storageLocation.trim(),
          imageUrl: finalImageUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update inventory item.");
      }

      onSuccess(data.item);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update inventory item.");
    } finally {
      setLoading(false);
      setUploadStatus(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-[#8E1538]/10 text-[#8E1538] flex items-center justify-center">
            <Edit3 className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Edit Store Material
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Update material specifications, stock thresholds, or replace the product photo.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Item Image Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Material / Product Image
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {imagePreview ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="h-16 px-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#8E1538] flex flex-col items-center justify-center text-slate-500 hover:text-[#8E1538] cursor-pointer shrink-0 transition-colors bg-slate-50/50"
                  >
                    <Camera className="w-4 h-4 text-[#8E1538]" />
                    <span className="text-[10px] font-bold mt-1">Take Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 px-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#8E1538] flex flex-col items-center justify-center text-slate-500 hover:text-[#8E1538] cursor-pointer shrink-0 transition-colors bg-slate-50/50"
                  >
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span className="text-[10px] font-bold mt-1">Upload File</span>
                  </button>
                </div>
              )}

              <div className="text-xs text-slate-500 min-w-0">
                {selectedFile ? (
                  <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    New photo attached (will upload on save)
                  </span>
                ) : imagePreview ? (
                  <span className="text-[11px] text-slate-600 font-medium block">
                    Current photo saved. Click &times; to remove or replace.
                  </span>
                ) : (
                  <>
                    <span className="text-[11px] text-slate-600 font-medium block">PNG, JPG (Auto-optimized)</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Use camera capture or device gallery</span>
                  </>
                )}
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item Code / SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="RAW-HON-01"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono uppercase focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pure Honey Comb"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const cat = e.target.value as any;
                  setCategory(cat);
                  if (cat === "PERISHABLE_MEASURED") setUom("kg");
                  else if (cat === "PERISHABLE_NUMBERED") setUom("pcs");
                  else setUom("sets");
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden cursor-pointer"
              >
                <option value="PERISHABLE_MEASURED">Measured (kg, L, g)</option>
                <option value="PERISHABLE_NUMBERED">Numbered (pcs, nuts, packs)</option>
                <option value="PACKAGING_NON_PERISHABLE">Packaging (cups, lids, rolls)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit of Measure (UoM) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                placeholder="kg, pcs, L, sets"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Stock ({uom})
              </label>
              <input
                type="number"
                step="any"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Stock Alert Level
              </label>
              <input
                type="number"
                step="any"
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estimated Unit Cost (₦)
              </label>
              <input
                type="number"
                step="any"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                placeholder="1500"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Storage Location
              </label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="Cold Room A, Shelf 2"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#8E1538] hover:bg-[#72102C] text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  {uploadStatus || "Saving..."}
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
