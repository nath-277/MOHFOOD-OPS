"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ShiftType = "MORNING_SHIFT" | "NIGHT_SHIFT";

export interface ShiftRecordDiscrepancy {
  itemCode: string;
  itemName: string;
  expectedStock: number;
  physicalCount: number;
  variance: number;
  uom: string;
  note?: string;
}

export interface ShiftRecordItem {
  id: string;
  shiftType: ShiftType;
  shiftDate: string;
  status: "OPEN" | "CLOSED" | "RECONCILED";
  openedByName: string;
  closedByName?: string;
  handoverOfficerName?: string;
  totalVariances: number;
  totalItemsChecked: number;
  discrepancies?: ShiftRecordDiscrepancy[];
  allResults?: ShiftRecordDiscrepancy[];
  notes?: string;
  createdAt: string;
  closedAt?: string;
  stats?: {
    dispensedCount: number;
    intakeCount: number;
    returnsCount: number;
  };
}

export interface ActiveShiftStats {
  dispensedCount: number;
  intakeCount: number;
  returnsCount: number;
  totalVariances: number;
}

interface ShiftContextType {
  activeShift: ShiftType;
  setActiveShift: (shift: ShiftType) => void;
  activeShiftRecord: ShiftRecordItem | null;
  shiftStats: ActiveShiftStats;
  historicalShifts: ShiftRecordItem[];
  loadingShifts: boolean;
  refreshShifts: () => Promise<void>;
  openShift: (shiftType: ShiftType, officerName: string, notes?: string) => Promise<ShiftRecordItem>;
  reconcileAndCloseShift: (data: {
    shiftType: ShiftType;
    counts: { itemCode: string; physicalCount: number; discrepancyNote?: string }[];
    handoverOfficerName: string;
    notes?: string;
  }) => Promise<ShiftRecordItem>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

function getSuggestedShift(): ShiftType {
  const currentHour = new Date().getHours();
  // Morning Shift: 08:00 to 18:00
  if (currentHour >= 8 && currentHour < 18) {
    return "MORNING_SHIFT";
  }
  return "NIGHT_SHIFT";
}

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const [activeShift, setActiveShiftState] = useState<ShiftType>("MORNING_SHIFT");
  const [activeShiftRecord, setActiveShiftRecord] = useState<ShiftRecordItem | null>(null);
  const [historicalShifts, setHistoricalShifts] = useState<ShiftRecordItem[]>([]);
  const [shiftStats, setShiftStats] = useState<ActiveShiftStats>({
    dispensedCount: 0,
    intakeCount: 0,
    returnsCount: 0,
    totalVariances: 0,
  });
  const [loadingShifts, setLoadingShifts] = useState(true);

  // Initialize from localStorage or time-of-day heuristic
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("moh_active_shift") as ShiftType | null;
      if (saved === "MORNING_SHIFT" || saved === "NIGHT_SHIFT") {
        setActiveShiftState(saved);
      } else {
        const suggested = getSuggestedShift();
        setActiveShiftState(suggested);
        localStorage.setItem("moh_active_shift", suggested);
      }
    }
  }, []);

  const setActiveShift = (shift: ShiftType) => {
    setActiveShiftState(shift);
    if (typeof window !== "undefined") {
      localStorage.setItem("moh_active_shift", shift);
    }
  };

  const refreshShifts = useCallback(async () => {
    try {
      setLoadingShifts(true);
      const res = await fetch(`/api/inventory/shifts?shiftType=${activeShift}`);
      if (res.ok) {
        const data = await res.json();
        if (data.activeShiftRecord) {
          setActiveShiftRecord(data.activeShiftRecord);
        }
        if (data.shifts) {
          setHistoricalShifts(data.shifts);
        }
        if (data.activeShiftStats) {
          setShiftStats(data.activeShiftStats);
        }
      }
    } catch (err) {
      console.error("Failed to load shift records:", err);
    } finally {
      setLoadingShifts(false);
    }
  }, [activeShift]);

  useEffect(() => {
    refreshShifts();
  }, [refreshShifts]);

  const openShift = async (shiftType: ShiftType, officerName: string, notes?: string): Promise<ShiftRecordItem> => {
    const res = await fetch("/api/inventory/shifts/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftType, officerName, notes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to open shift.");
    setActiveShift(shiftType);
    await refreshShifts();
    return data.shift;
  };

  const reconcileAndCloseShift = async (payload: {
    shiftType: ShiftType;
    counts: { itemCode: string; physicalCount: number; discrepancyNote?: string }[];
    handoverOfficerName: string;
    notes?: string;
  }): Promise<ShiftRecordItem> => {
    const res = await fetch("/api/inventory/shifts/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to reconcile shift.");
    await refreshShifts();
    return data.result?.shiftRecord || data.shiftRecord;
  };

  return (
    <ShiftContext.Provider
      value={{
        activeShift,
        setActiveShift,
        activeShiftRecord,
        shiftStats,
        historicalShifts,
        loadingShifts,
        refreshShifts,
        openShift,
        reconcileAndCloseShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error("useShift must be used within a ShiftProvider");
  }
  return context;
}
