"use client";

import React, { useState } from "react";
import { FleetVehicle } from "@/server/logistics/store";
import {
  X,
  Truck,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Package,
  FileText,
  AlertCircle,
} from "lucide-react";

interface DispatchRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fleet: FleetVehicle[];
}

const STOCKIST_PRESETS = [
  { stockistId: "stk-01", stockistName: "Hubmart Supermarket", location: "Ikeja GRA, Lagos" },
  { stockistId: "stk-02", stockistName: "Prince Ebeano Supermarket", location: "Lekki Phase 1, Lagos" },
  { stockistId: "stk-03", stockistName: "Justrite Superstore", location: "Magodo Shangisha, Lagos" },
  { stockistId: "stk-04", stockistName: "Spar Hypermarket", location: "Victoria Island, Lagos" },
  { stockistId: "stk-05", stockistName: "Shoprite Circle Mall", location: "Jakande, Lekki, Lagos" },
];

const PRODUCT_PRESETS = [
  { code: "REC-PARFAIT-400ML", name: "Moh Yogurt Parfait (400ml Cup)" },
  { code: "REC-GREEK-500G", name: "Moh Greek Yogurt (500g Tub)" },
  { code: "REC-VANILLA-330ML", name: "Moh Probiotic Drink (330ml Bottle)" },
];

export function DispatchRunModal({
  isOpen,
  onClose,
  onSuccess,
  fleet,
}: DispatchRunModalProps) {
  const [vehicleId, setVehicleId] = useState(fleet[0]?.id || "");
  const [driverName, setDriverName] = useState(fleet[0]?.driverName || "");
  const [departureTime, setDepartureTime] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Delivery Stops
  const [stops, setStops] = useState<
    {
      stockistId: string;
      stockistName: string;
      location: string;
      productCode: string;
      productName: string;
      units: number;
    }[]
  >([
    {
      stockistId: STOCKIST_PRESETS[0].stockistId,
      stockistName: STOCKIST_PRESETS[0].stockistName,
      location: STOCKIST_PRESETS[0].location,
      productCode: PRODUCT_PRESETS[0].code,
      productName: PRODUCT_PRESETS[0].name,
      units: 100,
    },
  ]);

  if (!isOpen) return null;

  const handleVehicleChange = (vId: string) => {
    setVehicleId(vId);
    const selected = fleet.find((v) => v.id === vId);
    if (selected) {
      setDriverName(selected.driverName);
    }
  };

  const handleAddStop = () => {
    const nextStockist =
      STOCKIST_PRESETS[stops.length % STOCKIST_PRESETS.length] || STOCKIST_PRESETS[0];
    setStops((prev) => [
      ...prev,
      {
        stockistId: nextStockist.stockistId,
        stockistName: nextStockist.stockistName,
        location: nextStockist.location,
        productCode: PRODUCT_PRESETS[0].code,
        productName: PRODUCT_PRESETS[0].name,
        units: 50,
      },
    ]);
  };

  const handleRemoveStop = (index: number) => {
    if (stops.length <= 1) return;
    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStopStockistChange = (index: number, stockistId: string) => {
    const preset = STOCKIST_PRESETS.find((s) => s.stockistId === stockistId);
    if (!preset) return;
    setStops((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, stockistId: preset.stockistId, stockistName: preset.stockistName, location: preset.location }
          : s
      )
    );
  };

  const handleStopProductChange = (index: number, code: string) => {
    const prod = PRODUCT_PRESETS.find((p) => p.code === code);
    if (!prod) return;
    setStops((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, productCode: prod.code, productName: prod.name } : s
      )
    );
  };

  const handleStopUnitsChange = (index: number, units: number) => {
    setStops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, units: Math.max(1, units) } : s))
    );
  };

  const totalUnits = stops.reduce((acc, s) => acc + Number(s.units || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const chosenVehicle = fleet.find((v) => v.id === vehicleId) || fleet[0];
    if (!chosenVehicle) {
      setError("Please select a fleet delivery vehicle.");
      return;
    }

    if (stops.length === 0) {
      setError("At least one stockist stop is required.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/logistics/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: chosenVehicle.id,
          driverName: driverName.trim() || chosenVehicle.driverName,
          departureTime: departureTime ? new Date(departureTime).toISOString() : new Date().toISOString(),
          stops,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch delivery run.");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8E1538] text-white flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Dispatch Delivery Run</h2>
              <p className="text-xs text-slate-500">
                Assign refrigerated vehicle, driver, and stockist drop-off waybills
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Vehicle & Driver Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fleet Vehicle (Cold-Chain Box)
              </label>
              <select
                value={vehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              >
                {fleet.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleName} ({v.currentTemp}°C) - {v.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Designated Driver
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Sunday Balogun"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Departure Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Departure Time
              </label>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#8E1538] focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Leave blank to dispatch immediately
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Total Manifest Dispatched
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono mt-0.5">
                {totalUnits} <span className="text-xs font-normal text-slate-500">Units</span>
              </span>
            </div>
          </div>

          {/* Stockist Drops / Stops */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800">
                Delivery Stops & Retail Drop-offs ({stops.length})
              </label>
              <button
                type="button"
                onClick={handleAddStop}
                className="flex items-center gap-1 text-[11px] font-bold text-[#8E1538] hover:text-[#72102C] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stop</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {stops.map((stop, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Stop #{idx + 1}</span>
                    </span>
                    {stops.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove stop"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                        Supermarket Stockist
                      </label>
                      <select
                        value={stop.stockistId}
                        onChange={(e) => handleStopStockistChange(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:border-[#8E1538] focus:outline-hidden"
                      >
                        {STOCKIST_PRESETS.map((stk) => (
                          <option key={stk.stockistId} value={stk.stockistId}>
                            {stk.stockistName} ({stk.location})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                          Product
                        </label>
                        <select
                          value={stop.productCode}
                          onChange={(e) => handleStopProductChange(idx, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:border-[#8E1538] focus:outline-hidden"
                        >
                          {PRODUCT_PRESETS.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name.split(" (")[0]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                          Quantity (Units)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={stop.units}
                          onChange={(e) =>
                            handleStopUnitsChange(idx, parseInt(e.target.value) || 0)
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:border-[#8E1538] focus:outline-hidden"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Dispatch Instructions / SoR Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ensure seal intact on handover. Collect signed delivery acknowledgment and return empty crates."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:border-[#8E1538] focus:outline-hidden resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-[#8E1538] hover:bg-[#72102C] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? "Generating Manifest..." : "Confirm & Dispatch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
