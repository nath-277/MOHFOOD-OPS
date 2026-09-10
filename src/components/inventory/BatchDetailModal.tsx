"use client";

import React from "react";
import { StockTransaction } from "@/server/inventory/store";
import { Boxes, X, Package } from "lucide-react";

export interface ProductionBatchGroup {
  batchReference: string;
  productName: string;
  batchSize: string;
  shiftType: string;
  performedByName: string;
  recipient: string;
  timestamp: string;
  materials: StockTransaction[];
}

interface BatchDetailModalProps {
  batch: ProductionBatchGroup | null;
  onClose: () => void;
}

export function BatchDetailModal({ batch, onClose }: BatchDetailModalProps) {
  if (!batch) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#CF0458] flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Production Dispatch Run Details
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Ref: {batch.batchReference}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Product Info Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scheduled Product</span>
                <h4 className="text-lg font-bold text-slate-900">{batch.productName}</h4>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#CF0458] text-white">
                Target: {batch.batchSize}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Floor Recipient</span>
                <strong className="text-slate-800">{batch.recipient}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Dispensed By</span>
                <strong className="text-slate-800">{batch.performedByName}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Shift</span>
                <strong className="text-slate-800">
                  {batch.shiftType === "MORNING_SHIFT" ? "Morning Shift" : "Night Shift"}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Timestamp</span>
                <strong className="text-slate-800 font-mono text-[11px]">
                  {new Date(batch.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </strong>
              </div>
            </div>
          </div>

          {/* Itemized Materials Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#CF0458]" />
                <span>Dispatched Ingredients Specification ({batch.materials.length})</span>
              </h5>
              <span className="text-slate-400 font-medium">All items deducted from store</span>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3.5">Raw Material</th>
                    <th className="py-2.5 px-3.5 text-right">Dispensed Qty</th>
                    <th className="py-2.5 px-3.5">Formula Proportion / Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {batch.materials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">{m.itemName}</td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-[#CF0458]">
                        -{m.quantity} <span className="text-slate-400 font-normal text-[10px]">{m.unit}</span>
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-500">
                        {m.notes || "Standard formulation requisition"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
