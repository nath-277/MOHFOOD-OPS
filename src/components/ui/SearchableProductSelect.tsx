"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, Boxes, AlertCircle } from "lucide-react";

export interface SearchableItem {
  id?: string;
  code: string;
  name: string;
  category?: string;
  uom?: string;
  currentStock?: number | string;
  isVariablePack?: boolean;
  packUnit?: string | null;
  recipeUom?: string | null;
  imageUrl?: string | null;
  packagingType?: string | null;
  inUseQuantity?: number | string | null;
  inUseRemainingPortions?: number | string | null;
}

export interface SearchableProductSelectProps {
  items: SearchableItem[];
  value: string;
  onChange: (selectedCodeOrId: string, item?: SearchableItem) => void;
  valueKey?: "code" | "id";
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  allValue?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  showStock?: boolean;
  className?: string;
  buttonClassName?: string;
  id?: string;
  autoFocusSearch?: boolean;
}

export const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  items,
  value,
  onChange,
  valueKey = "code",
  placeholder = "Select a material or product...",
  allowAll = false,
  allLabel = "All Materials",
  allValue = "ALL",
  disabled = false,
  size = "md",
  showStock = true,
  className = "",
  buttonClassName = "",
  id,
  autoFocusSearch = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 1. Sort items alphabetically by name
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
    );
  }, [items]);

  // 2. Filter items based on typed search query
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedItems;
    return sortedItems.filter((item) => {
      const name = item.name.toLowerCase();
      const code = item.code.toLowerCase();
      const category = (item.category || "").toLowerCase().replace(/_/g, " ");
      const uom = (item.uom || "").toLowerCase();
      return name.includes(q) || code.includes(q) || category.includes(q) || uom.includes(q);
    });
  }, [sortedItems, searchQuery]);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    if (allowAll && value === allValue) return null;
    return items.find((item) => {
      if (valueKey === "id") return item.id === value;
      return item.code === value;
    });
  }, [items, value, valueKey, allowAll, allValue]);

  // Reset highlight index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setHighlightedIndex(0);
      if (autoFocusSearch) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  }, [isOpen, autoFocusSearch]);

  // Handle outside clicks to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalCount = (allowAll ? 1 : 0) + filteredItems.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, totalCount));
      scrollHighlightedIntoView((highlightedIndex + 1) % Math.max(1, totalCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + totalCount) % Math.max(1, totalCount));
      scrollHighlightedIntoView((highlightedIndex - 1 + totalCount) % Math.max(1, totalCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allowAll && highlightedIndex === 0) {
        selectValue(allValue, undefined);
      } else {
        const itemIndex = allowAll ? highlightedIndex - 1 : highlightedIndex;
        const targetItem = filteredItems[itemIndex];
        if (targetItem) {
          const val = valueKey === "id" && targetItem.id ? targetItem.id : targetItem.code;
          selectValue(val, targetItem);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const scrollHighlightedIntoView = (index: number) => {
    if (!listRef.current) return;
    const elements = listRef.current.querySelectorAll<HTMLButtonElement>("[data-item-option]");
    const target = elements[index];
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  };

  const selectValue = (val: string, item?: SearchableItem) => {
    onChange(val, item);
    setIsOpen(false);
  };

  const isSmall = size === "sm";

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full ${isOpen ? "z-50" : "z-10"} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left transition-all cursor-pointer bg-white border ${
          isOpen
            ? "border-[#CF0458] ring-2 ring-[#CF0458]/15 shadow-sm"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
        } ${disabled ? "opacity-60 cursor-not-allowed bg-slate-100" : ""} ${
          isSmall
            ? "py-1.5 px-2.5 rounded-lg text-xs"
            : "py-2 px-3 rounded-xl text-xs"
        } ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
          {allowAll && value === allValue ? (
            <span className="font-semibold text-slate-900 truncate">
              {allLabel} ({sortedItems.length})
            </span>
          ) : selectedItem ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900 truncate">
                {selectedItem.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {selectedItem.code}
              </span>
              {selectedItem.isVariablePack && (
                <span className="shrink-0 text-[9px] font-bold px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Variable
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2 text-slate-400">
          {showStock && selectedItem && selectedItem.currentStock !== undefined && (
            <span className="hidden sm:inline text-[11px] font-mono text-slate-500 font-medium">
              {Number(selectedItem.currentStock).toLocaleString()} {selectedItem.uom}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isOpen ? "rotate-180 text-[#CF0458]" : "text-slate-400"
            }`}
          />
        </div>
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[260px] sm:min-w-[320px] max-w-full`}
          style={{ zIndex: 100 }}
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search product or code..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#CF0458] focus:ring-1 focus:ring-[#CF0458]"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1.5">
              <span>Sorted alphabetically (A → Z)</span>
              <span>
                {filteredItems.length} of {sortedItems.length} materials
              </span>
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1"
            role="listbox"
          >
            {/* Optional "ALL" option */}
            {allowAll && !searchQuery && (
              <button
                type="button"
                data-item-option
                onClick={() => selectValue(allValue, undefined)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                  value === allValue
                    ? "bg-[#CF0458]/10 text-[#CF0458] font-bold"
                    : highlightedIndex === 0
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Boxes className="w-3.5 h-3.5 text-slate-400" />
                  <span>{allLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {sortedItems.length} items
                  </span>
                  {value === allValue && <Check className="w-3.5 h-3.5 text-[#CF0458]" />}
                </div>
              </button>
            )}

            {filteredItems.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-slate-400 space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto text-slate-300" />
                <p className="font-medium text-slate-600">No matching materials found</p>
                <p className="text-[11px] text-slate-400">
                  Try searching by name, code (e.g. RAW-), or unit.
                </p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const itemVal = valueKey === "id" && item.id ? item.id : item.code;
                const isSelected = value === itemVal;
                const effectiveIndex = allowAll && !searchQuery ? index + 1 : index;
                const isHighlighted = highlightedIndex === effectiveIndex;

                return (
                  <button
                    key={item.id || item.code}
                    type="button"
                    data-item-option
                    onClick={() => selectValue(itemVal, item)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer group ${
                      isSelected
                        ? "bg-[#CF0458]/10 text-[#CF0458] font-bold"
                        : isHighlighted
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`truncate ${
                            isSelected ? "text-[#CF0458] font-bold" : "font-semibold text-slate-800"
                          }`}
                        >
                          {item.name}
                        </span>
                        <span className="font-mono text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.code}
                        </span>
                        {item.isVariablePack && (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Variable
                          </span>
                        )}
                      </div>

                      {/* Secondary information: Stock & packaging */}
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        {item.currentStock !== undefined && (
                          <span>
                            Stock:{" "}
                            <strong className="text-slate-600 font-mono">
                              {Number(item.currentStock).toLocaleString()} {item.uom}
                            </strong>
                          </span>
                        )}
                        {item.recipeUom && item.recipeUom !== item.uom && (
                          <span>• Recipe: {item.recipeUom}</span>
                        )}
                        {Number(item.inUseQuantity || 0) > 0 && (
                          <span className="text-amber-700 font-medium">
                            • {item.inUseQuantity} in use floor
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isSelected && <Check className="w-4 h-4 text-[#CF0458]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
