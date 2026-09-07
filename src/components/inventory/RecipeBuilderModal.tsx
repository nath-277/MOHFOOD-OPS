"use client";

import React, { useState, useEffect, useRef } from "react";
import { InventoryItem, ProductRecipe } from "@/server/inventory/store";
import { X, Plus, Trash2, Camera, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Layers } from "lucide-react";

interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableItems: InventoryItem[];
  existingRecipe?: ProductRecipe | null;
  onSuccess: (recipe: any) => void;
}

interface IngredientRow {
  itemCode: string;
  itemName: string;
  quantityRequired: number | string;
  uom: string;
}

export const RecipeBuilderModal: React.FC<RecipeBuilderModalProps> = ({
  isOpen,
  onClose,
  availableItems,
  existingRecipe,
  onSuccess,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yieldQuantity, setYieldQuantity] = useState<string>("1");
  const [yieldUnit, setYieldUnit] = useState("cup");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingRecipe) {
      setCode(existingRecipe.code);
      setName(existingRecipe.name);
      setDescription(existingRecipe.description || "");
      setYieldQuantity(String(existingRecipe.yieldQuantity));
      setYieldUnit(existingRecipe.yieldUnit);
      setImagePreview(existingRecipe.imageUrl || null);
      setIngredients(
        existingRecipe.ingredients.map((ing) => ({
          itemCode: ing.itemCode,
          itemName: ing.itemName,
          quantityRequired: ing.quantityRequired,
          uom: ing.uom,
        }))
      );
    } else {
      setCode("");
      setName("");
      setDescription("");
      setYieldQuantity("1");
      setYieldUnit("cup");
      setImagePreview(null);
      // Default with 2 empty rows or first item
      if (availableItems.length > 0) {
        setIngredients([
          {
            itemCode: availableItems[0].code,
            itemName: availableItems[0].name,
            quantityRequired: 0.150,
            uom: availableItems[0].uom,
          },
        ]);
      } else {
        setIngredients([]);
      }
    }
  }, [existingRecipe, availableItems, isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size must be less than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddIngredientRow = () => {
    if (availableItems.length === 0) return;
    const first = availableItems[0];
    setIngredients((prev) => [
      ...prev,
      {
        itemCode: first.code,
        itemName: first.name,
        quantityRequired: 1,
        uom: first.uom,
      },
    ]);
  };

  const handleIngredientChange = (index: number, itemCode: string) => {
    const found = availableItems.find((i) => i.code === itemCode);
    if (!found) return;

    setIngredients((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        itemCode: found.code,
        itemName: found.name,
        uom: found.uom,
      };
      return copy;
    });
  };

  const handleQuantityChange = (index: number, qty: string) => {
    setIngredients((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        quantityRequired: qty,
      };
      return copy;
    });
  };

  const handleRemoveRow = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) {
      setError("Product code and product name are required.");
      return;
    }

    if (ingredients.length === 0) {
      setError("Please add at least one ingredient to the BOM formula.");
      return;
    }

    for (const ing of ingredients) {
      if (!ing.quantityRequired || Number(ing.quantityRequired) <= 0) {
        setError(`Please specify a valid quantity for ingredient ${ing.itemName}.`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      imageUrl: imagePreview || undefined,
      yieldQuantity: Number(yieldQuantity) || 1,
      yieldUnit: yieldUnit.trim() || "unit",
      ingredients: ingredients.map((i) => ({
        itemCode: i.itemCode,
        itemName: i.itemName,
        quantityRequired: Number(i.quantityRequired),
        uom: i.uom,
      })),
    };

    try {
      const url = existingRecipe
        ? `/api/inventory/recipes/${existingRecipe.id}`
        : "/api/inventory/recipes";
      const method = existingRecipe ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save recipe formula.");
      }

      onSuccess(data.recipe);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save recipe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {existingRecipe ? "Edit Product Recipe & Formula" : "Create Finished Product Recipe & BOM"}
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Define product specifications, photo, and dynamic ingredient requirements per batch.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo & Basic Details */}
          <div className="flex flex-col sm:flex-row items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            {/* Image Preview */}
            <div className="shrink-0">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Product Photo
              </label>
              {imagePreview ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 w-24">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-1.5 px-2 rounded-xl border border-dashed border-slate-200 hover:border-[#8E1538] flex items-center justify-center gap-1.5 text-slate-600 hover:text-[#8E1538] cursor-pointer transition-colors bg-white text-[10px] font-bold shadow-2xs active:scale-95"
                  >
                    <Camera className="w-3.5 h-3.5 text-[#8E1538]" />
                    <span>Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-1.5 px-2 rounded-xl border border-dashed border-slate-200 hover:border-[#8E1538] flex items-center justify-center gap-1.5 text-slate-600 hover:text-[#8E1538] cursor-pointer transition-colors bg-white text-[10px] font-bold shadow-2xs active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload</span>
                  </button>
                </div>
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

            <div className="flex-1 w-full space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Moh Strawberry Parfait (400ml)"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipe Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!existingRecipe}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="REC-PARFAIT-STRW-400"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono uppercase focus:border-[#8E1538] focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Standard Batch Yield
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Yield Unit
                  </label>
                  <input
                    type="text"
                    required
                    value={yieldUnit}
                    onChange={(e) => setYieldUnit(e.target.value)}
                    placeholder="cup, tub, bottle"
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs focus:border-[#8E1538] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Quality Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fresh strawberries layered with Greek yogurt and crunchy granola."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
            />
          </div>

          {/* DYNAMIC INGREDIENT BOM BUILDER */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Bill of Materials (BOM) Formula
                </span>
                <span className="text-[11px] text-slate-500">
                  Ingredients automatically deducted during batch dispensing
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddIngredientRow}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200/80 hover:bg-[#8E1538] hover:text-white text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Ingredient</span>
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
              {ingredients.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No ingredients added yet. Click &quot;Add Ingredient&quot; above.
                </div>
              ) : (
                ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    {/* Item Selector */}
                    <div className="flex-1 min-w-[160px]">
                      <select
                        value={ing.itemCode}
                        onChange={(e) => handleIngredientChange(idx, e.target.value)}
                        className="w-full py-1.5 px-2 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:border-[#8E1538] focus:outline-hidden cursor-pointer"
                      >
                        {availableItems.map((item) => (
                          <option key={item.id} value={item.code}>
                            {item.name} ({item.code} • {item.uom})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Input */}
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        step="any"
                        required
                        value={ing.quantityRequired}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        placeholder="0.00"
                        className="w-full py-1.5 px-2 rounded-md bg-white border border-slate-200 text-xs font-mono text-right focus:border-[#8E1538] focus:outline-hidden"
                      />
                    </div>

                    {/* Unit display */}
                    <span className="text-xs font-semibold text-slate-500 w-12 text-center">
                      {ing.uom}
                    </span>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#8E1538] hover:bg-[#72102C] text-white disabled:opacity-50"
            >
              {loading ? "Saving..." : existingRecipe ? "Save Changes" : "Create Recipe Formula"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
