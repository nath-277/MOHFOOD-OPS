"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Upload, Camera, CheckCircle2, AlertCircle, Edit3 } from "lucide-react";
import { optimizeImageFile } from "@/lib/imageOptimizer";
import { calculateBaseCostFromPackage, calculatePackageCost } from "@/lib/packaging";

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
  const [costUnitType, setCostUnitType] = useState<"CARTON" | "PACK" | "BASE">("BASE");
  const [storageLocation, setStorageLocation] = useState("Cold Room A");
  const [packagingType, setPackagingType] = useState<"DIRECT" | "PACK_ONLY" | "CARTON_AND_PACK">("DIRECT");
  const [packUnit, setPackUnit] = useState("pack");
  const [unitsPerPack, setUnitsPerPack] = useState<string>("20");
  const [cartonUnit, setCartonUnit] = useState("carton");
  const [packsPerCarton, setPacksPerCarton] = useState<string>("50");
  const [isVariablePack, setIsVariablePack] = useState(false);
  const [stockUnit, setStockUnit] = useState<"CARTON" | "PACK" | "BASE">("BASE");
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
      setStorageLocation(item.storageLocation || "Central Store");
      setPackagingType((item.packagingType as any) || "DIRECT");
      setPackUnit(item.packUnit || "pack");
      setUnitsPerPack(item.unitsPerPack ? String(item.unitsPerPack) : "20");
      setCartonUnit(item.cartonUnit || "carton");
      setPacksPerCarton(item.packsPerCarton ? String(item.packsPerCarton) : "50");
      setIsVariablePack(Boolean(item.isVariablePack));
      setStockUnit("BASE");
      setImagePreview(item.imageUrl || null);
      setSelectedFile(null);

      // Initialize cost according to packaging unit
      const pkgCost = calculatePackageCost(Number(item.costPerUnit) || 0, item);
      if (item.packagingType === "CARTON_AND_PACK") {
        setCostUnitType("CARTON");
        setCostPerUnit(pkgCost.packagePrice ? String(pkgCost.packagePrice) : "");
      } else if (item.packagingType === "PACK_ONLY") {
        setCostUnitType("PACK");
        setCostPerUnit(pkgCost.packagePrice ? String(pkgCost.packagePrice) : "");
      } else {
        setCostUnitType("BASE");
        setCostPerUnit(item.costPerUnit !== undefined ? String(item.costPerUnit) : "");
      }
      setError(null);
    }
  }, [item, isOpen]);

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

      // Calculate stock in base units
      let finalBaseStock = Number(currentStock) || 0;
      const numUnitsPerPack = Math.max(1, Number(unitsPerPack) || 1);
      const numPacksPerCarton = Math.max(1, Number(packsPerCarton) || 1);

      if (packagingType === "CARTON_AND_PACK") {
        if (stockUnit === "CARTON") {
          finalBaseStock = (Number(currentStock) || 0) * numPacksPerCarton * numUnitsPerPack;
        } else if (stockUnit === "PACK") {
          finalBaseStock = (Number(currentStock) || 0) * numUnitsPerPack;
        }
      } else if (packagingType === "PACK_ONLY") {
        if (stockUnit === "PACK") {
          finalBaseStock = (Number(currentStock) || 0) * numUnitsPerPack;
        }
      }

      // Calculate base cost from package price if applicable
      const finalBaseCost = calculateBaseCostFromPackage(
        Number(costPerUnit) || 0,
        costUnitType,
        {
          packagingType,
          uom: uom.trim(),
          packUnit: packUnit.trim(),
          unitsPerPack: numUnitsPerPack,
          cartonUnit: cartonUnit.trim(),
          packsPerCarton: numPacksPerCarton,
          isVariablePack,
        }
      );

      setUploadStatus("Saving material changes...");
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          category,
          uom: uom.trim(),
          currentStock: finalBaseStock,
          minStockThreshold: Number(minStockThreshold) || 10,
          costPerUnit: finalBaseCost,
          storageLocation: storageLocation.trim(),
          imageUrl: finalImageUrl,
          packagingType,
          packUnit: packagingType !== "DIRECT" ? packUnit.trim() : null,
          unitsPerPack: packagingType !== "DIRECT" ? numUnitsPerPack : null,
          cartonUnit: packagingType === "CARTON_AND_PACK" ? cartonUnit.trim() : null,
          packsPerCarton: packagingType === "CARTON_AND_PACK" ? numPacksPerCarton : null,
          isVariablePack: Boolean(isVariablePack),
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
          <div className="w-7 h-7 rounded-lg bg-[#CF0458]/10 text-[#CF0458] flex items-center justify-center">
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
                    className="h-16 px-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#CF0458] flex flex-col items-center justify-center text-slate-500 hover:text-[#CF0458] cursor-pointer shrink-0 transition-colors bg-slate-50/50"
                  >
                    <Camera className="w-4 h-4 text-[#CF0458]" />
                    <span className="text-[10px] font-bold mt-1">Take Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-16 px-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#CF0458] flex flex-col items-center justify-center text-slate-500 hover:text-[#CF0458] cursor-pointer shrink-0 transition-colors bg-slate-50/50"
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
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono uppercase focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
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
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
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
                  if (cat === "PERISHABLE_MEASURED") {
                    setUom("kg");
                    setPackagingType("DIRECT");
                  } else if (cat === "PERISHABLE_NUMBERED") {
                    setUom("pcs");
                  } else {
                    setUom("pcs");
                    setPackagingType("CARTON_AND_PACK");
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden cursor-pointer"
              >
                <option value="PERISHABLE_MEASURED">Measured (kg, L, g)</option>
                <option value="PERISHABLE_NUMBERED">Numbered (pcs, nuts, packs)</option>
                <option value="PACKAGING_NON_PERISHABLE">Packaging (cups, lids, rolls)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Base Unit of Measure (UoM) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                placeholder="kg, pcs, L, cups"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Packaging & Hierarchy Configuration */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Packaging & Hierarchy
              </label>
              <span className="text-[10px] text-slate-400">Cartons / Packs / Pieces</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/60 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  setPackagingType("DIRECT");
                  setStockUnit("BASE");
                }}
                className={`py-1.5 px-2 rounded-md transition-all text-center cursor-pointer ${
                  packagingType === "DIRECT"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Direct Count
              </button>
              <button
                type="button"
                onClick={() => {
                  setPackagingType("PACK_ONLY");
                  if (stockUnit === "CARTON") setStockUnit("PACK");
                }}
                className={`py-1.5 px-2 rounded-md transition-all text-center cursor-pointer ${
                  packagingType === "PACK_ONLY"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Pack-Based
              </button>
              <button
                type="button"
                onClick={() => setPackagingType("CARTON_AND_PACK")}
                className={`py-1.5 px-2 rounded-md transition-all text-center cursor-pointer ${
                  packagingType === "CARTON_AND_PACK"
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Carton + Pack
              </button>
            </div>

            {packagingType === "PACK_ONLY" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    Pack Unit Name
                  </label>
                  <input
                    type="text"
                    value={packUnit}
                    onChange={(e) => setPackUnit(e.target.value)}
                    placeholder="pack, bag, crate"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                    {isVariablePack ? `Estimated Avg Count (~${uom || "units"})` : `Units per Pack (${uom || "units"})`}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={unitsPerPack}
                    onChange={(e) => setUnitsPerPack(e.target.value)}
                    placeholder="80"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono focus:border-[#CF0458] focus:outline-hidden"
                  />
                </div>
                <div className="col-span-2 text-[10px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                  💡 <strong>Formula:</strong> 1 {packUnit || "pack"} = {isVariablePack ? "approx. " : ""}{Number(unitsPerPack) || 1} {uom || "units"}. (e.g. 20 packs = {20 * (Number(unitsPerPack) || 1)} {uom || "units"}).
                </div>
              </div>
            )}

            {packagingType === "CARTON_AND_PACK" && (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Inner Pack Unit
                    </label>
                    <input
                      type="text"
                      value={packUnit}
                      onChange={(e) => setPackUnit(e.target.value)}
                      placeholder="pack, sleeve"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#CF0458] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      {isVariablePack ? `Estimated Avg Count (~${uom || "units"})` : `Units per Pack (${uom || "units"})`}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={unitsPerPack}
                      onChange={(e) => setUnitsPerPack(e.target.value)}
                      placeholder="20"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono focus:border-[#CF0458] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Master Carton Unit
                    </label>
                    <input
                      type="text"
                      value={cartonUnit}
                      onChange={(e) => setCartonUnit(e.target.value)}
                      placeholder="carton, box"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#CF0458] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Packs per Carton
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={packsPerCarton}
                      onChange={(e) => setPacksPerCarton(e.target.value)}
                      placeholder="50"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono focus:border-[#CF0458] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                  💡 <strong>Formula:</strong> 1 {cartonUnit || "carton"} = {Number(packsPerCarton) || 1} {packUnit || "packs"} = {isVariablePack ? "approx. " : ""}{(Number(packsPerCarton) || 1) * (Number(unitsPerPack) || 1)} {uom || "units"}. (e.g. 6.5 cartons = {6.5 * (Number(packsPerCarton) || 1) * (Number(unitsPerPack) || 1)} {uom || "units"}).
                </div>
              </div>
            )}

            {/* Variable Product Manual Toggle (Always available for all packaging modes) */}
            <div className="pt-1 border-t border-slate-200/80">
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100/70 transition-colors">
                <input
                  type="checkbox"
                  checked={isVariablePack}
                  onChange={(e) => setIsVariablePack(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#CF0458] focus:ring-[#CF0458] border-slate-300 cursor-pointer"
                />
                <div className="text-[11px] text-slate-700">
                  <span className="font-bold text-slate-900">Variable Product / Variable Yield</span>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                    {packagingType === "DIRECT"
                      ? "Enable for materials where unit size, piece weight, or batch yield varies. Stock balance is estimated based on an average recipe yield."
                      : "Enable for packs or cases where piece count varies. Stock balance is tracked in whole units with an estimated recipe output."}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Current Stock
                </label>
                {packagingType !== "DIRECT" && (
                  <div className="flex items-center gap-1">
                    {packagingType === "CARTON_AND_PACK" && (
                      <button
                        type="button"
                        onClick={() => setStockUnit("CARTON")}
                        className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer ${
                          stockUnit === "CARTON"
                            ? "bg-[#CF0458] text-white font-bold"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {cartonUnit || "Cartons"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStockUnit("PACK")}
                      className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer ${
                        stockUnit === "PACK"
                          ? "bg-[#CF0458] text-white font-bold"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {packUnit || "Packs"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockUnit("BASE")}
                      className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer ${
                        stockUnit === "BASE"
                          ? "bg-[#CF0458] text-white font-bold"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {uom || "Units"}
                    </button>
                  </div>
                )}
              </div>
              <input
                type="number"
                step="any"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
              {packagingType !== "DIRECT" && Number(currentStock) > 0 && (
                <span className="text-[10px] text-slate-400 block mt-1">
                  = {
                    stockUnit === "CARTON"
                      ? `${(Number(currentStock) * (Number(packsPerCarton) || 1) * (Number(unitsPerPack) || 1)).toLocaleString()} ${uom}`
                      : stockUnit === "PACK"
                      ? `${(Number(currentStock) * (Number(unitsPerPack) || 1)).toLocaleString()} ${uom}`
                      : `${currentStock} ${uom}`
                  } (Base Stock)
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Min Stock Alert Level ({uom})
              </label>
              <input
                type="number"
                step="any"
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Estimated Purchase Cost (₦)
                </label>
                {packagingType !== "DIRECT" && (
                  <div className="flex items-center gap-1">
                    {packagingType === "CARTON_AND_PACK" && (
                      <button
                        type="button"
                        onClick={() => setCostUnitType("CARTON")}
                        className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          costUnitType === "CARTON"
                            ? "bg-[#CF0458] text-white font-bold shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Per {cartonUnit || "Carton"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCostUnitType("PACK")}
                      className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        costUnitType === "PACK"
                          ? "bg-[#CF0458] text-white font-bold shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Per {packUnit || "Pack"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostUnitType("BASE")}
                      className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        costUnitType === "BASE"
                          ? "bg-[#CF0458] text-white font-bold shadow-2xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Per {uom || "Unit"}
                    </button>
                  </div>
                )}
              </div>
              <input
                type="number"
                step="any"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                placeholder={costUnitType === "BASE" ? "1000" : "50000"}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
              />
              {packagingType !== "DIRECT" && Number(costPerUnit) > 0 && costUnitType !== "BASE" && (
                <span className="text-[10px] text-emerald-700 block mt-1 font-semibold">
                  = ₦{calculateBaseCostFromPackage(Number(costPerUnit), costUnitType, { packagingType, uom, packUnit, unitsPerPack, cartonUnit, packsPerCarton, isVariablePack }).toFixed(2)} / {uom} (calculated base cost)
                </span>
              )}
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
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
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
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#CF0458] hover:bg-[#B5034C] text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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
