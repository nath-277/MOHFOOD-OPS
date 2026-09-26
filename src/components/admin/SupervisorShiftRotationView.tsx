"use client";

import React, { useState, useEffect } from "react";
import {
  RotateCcw,
  Sun,
  Moon,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Settings,
  Sparkles,
  UserCheck,
  CalendarDays,
} from "lucide-react";

interface SupervisorInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface RotationRecord {
  id: string;
  mode: "AUTO_WEEKLY" | "MANUAL_OVERRIDE";
  baseWeekStartDate: string;
  baseMorningSupervisorId: string;
  baseMorningSupervisorName: string;
  baseNightSupervisorId: string;
  baseNightSupervisorName: string;
  manualMorningSupervisorId?: string | null;
  manualMorningSupervisorName?: string | null;
  manualNightSupervisorId?: string | null;
  manualNightSupervisorName?: string | null;
  rotationDayOfWeek: number;
  rotationHour: number;
  lastSwappedAt?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
  notes?: string | null;
}

interface RotationResolution {
  mode: "AUTO_WEEKLY" | "MANUAL_OVERRIDE";
  morningSupervisor: SupervisorInfo;
  nightSupervisor: SupervisorInfo;
  activeShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
  activeOnDutySupervisor: SupervisorInfo;
  upcomingShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
  upcomingSupervisor: SupervisorInfo;
  upcomingShiftStartsAt: string;
  currentWeekStartDate: string;
  nextRotationDate: string;
  nextRotationFormatted: string;
  daysUntilNextRotation: number;
  hoursUntilNextRotation: number;
  isSwappedFromBase: boolean;
  notes?: string | null;
}

interface UpcomingWeekSchedule {
  weekIndex: number;
  isCurrentWeek: boolean;
  weekStartDate: string;
  weekEndDate: string;
  weekRangeFormatted: string;
  morningSupervisor: SupervisorInfo;
  nightSupervisor: SupervisorInfo;
}

export function SupervisorShiftRotationView() {
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [record, setRecord] = useState<RotationRecord | null>(null);
  const [resolution, setResolution] = useState<RotationResolution | null>(null);
  const [schedule, setSchedule] = useState<UpcomingWeekSchedule[]>([]);

  // Settings form state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [formMode, setFormMode] = useState<"AUTO_WEEKLY" | "MANUAL_OVERRIDE">("AUTO_WEEKLY");
  const [selectedMorningId, setSelectedMorningId] = useState<string>("");
  const [selectedNightId, setSelectedNightId] = useState<string>("");
  const [rotationDayOfWeek, setRotationDayOfWeek] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  const [supervisorsCatalog, setSupervisorsCatalog] = useState<
    Array<{ id: string; name: string; email: string; role?: string }>
  >([
    { id: "c620225a-d1ad-47aa-9611-030b0fd656f1", name: "Aishah Anuoluwapo", email: "production@mohfood.com" },
    { id: "759ccc19-caf0-4fb8-a309-b9b29d631e71", name: "Aunty Ada", email: "ada@mohfood.com" },
  ]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/supervisor-rotation");
      if (!res.ok) throw new Error("Failed to load supervisor rotation data.");
      const data = await res.json();
      setRecord(data.record);
      setResolution(data.resolution);
      setSchedule(data.schedule || []);
      if (data.supervisorsCatalog && Array.isArray(data.supervisorsCatalog) && data.supervisorsCatalog.length > 0) {
        setSupervisorsCatalog(data.supervisorsCatalog);
      }

      if (data.record) {
        setFormMode(data.record.mode);
        setSelectedMorningId(
          data.record.mode === "MANUAL_OVERRIDE"
            ? data.record.manualMorningSupervisorId || data.record.baseMorningSupervisorId
            : data.record.baseMorningSupervisorId
        );
        setSelectedNightId(
          data.record.mode === "MANUAL_OVERRIDE"
            ? data.record.manualNightSupervisorId || data.record.baseNightSupervisorId
            : data.record.baseNightSupervisorId
        );
        setRotationDayOfWeek(data.record.rotationDayOfWeek);
        setNotes(data.record.notes || "");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load supervisor rotation.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSwapNow = async () => {
    try {
      setSwapping(true);
      setError(null);
      const res = await fetch("/api/admin/supervisor-rotation/swap", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to swap supervisor shifts.");

      setRecord(data.record);
      setResolution(data.resolution);
      setSchedule(data.schedule || []);
      showToast("Supervisor shifts swapped successfully! New active assignments are now live.");
    } catch (err: any) {
      setError(err.message || "Failed to swap shifts.");
    } finally {
      setSwapping(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setError(null);

      const morningObj = supervisorsCatalog.find((s) => s.id === selectedMorningId);
      const nightObj = supervisorsCatalog.find((s) => s.id === selectedNightId);

      const res = await fetch("/api/admin/supervisor-rotation/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: formMode,
          morningSupervisorId: selectedMorningId,
          morningSupervisorName: morningObj?.name || "Production Supervisor",
          nightSupervisorId: selectedNightId,
          nightSupervisorName: nightObj?.name || "Production Supervisor",
          rotationDayOfWeek,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save configuration.");

      setRecord(data.record);
      setResolution(data.resolution);
      setSchedule(data.schedule || []);
      setIsSettingsOpen(false);
      showToast("Rotation configuration updated and synchronized.");
    } catch (err: any) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <RotateCcw className="w-8 h-8 animate-spin text-[#CF0458]" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Loading Supervisor Shift Schedule...
        </span>
      </div>
    );
  }

  const isMorningNow = resolution?.activeShift === "MORNING_SHIFT";

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-emerald-600 text-white shadow-xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Callout */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. TOP HEADER & INSTANT SWAP ACTION                         */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-[#CF0458] border border-rose-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#CF0458]" />
              Production Supervision System
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                resolution?.mode === "AUTO_WEEKLY"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {resolution?.mode === "AUTO_WEEKLY" ? "🔄 Auto-Weekly Rotation" : "🔒 Manual Lock"}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Supervisor Shift Rotation
          </h2>
          <p className="text-xs text-slate-500">
            Aishah & Ada supervise alternating day and night factory runs. Rotates automatically weekly.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer min-h-[42px]"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>{isSettingsOpen ? "Hide Settings" : "Configure"}</span>
          </button>

          <button
            type="button"
            onClick={handleSwapNow}
            disabled={swapping}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[42px]"
            title="Invert current day and night supervisors immediately"
          >
            <ArrowRightLeft className={`w-4 h-4 ${swapping ? "animate-spin" : ""}`} />
            <span>{swapping ? "Swapping Shifts..." : "⇄ Swap Shifts Now"}</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. LIVE ON-DUTY STATUS & SHIFT HUD                           */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: On-Duty Active Supervisor */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#059669]" />
              <span>Active On-Duty Lead</span>
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse" />
              On Factory Floor
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold text-lg shadow-sm ${
                isMorningNow
                  ? "bg-gradient-to-br from-amber-500 to-orange-500"
                  : "bg-gradient-to-br from-indigo-600 to-slate-800"
              }`}
            >
              {resolution?.activeOnDutySupervisor.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 truncate">
                {resolution?.activeOnDutySupervisor.name}
              </div>
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                {isMorningNow ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Morning Shift Lead (08:00 – 18:00)</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Night Shift Lead (18:00 – 08:00)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Current Shift Run</span>
            <span className="font-mono font-bold text-slate-700">
              {isMorningNow ? "Day Mixing & Assembly" : "Overnight Fermentation"}
            </span>
          </div>
        </div>

        {/* Card 2: Upcoming Shift Handover */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Next Shift Handover</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Starts {resolution?.upcomingShiftStartsAt}
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700 font-bold text-lg">
              {resolution?.upcomingSupervisor.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold text-slate-900 truncate">
                {resolution?.upcomingSupervisor.name}
              </div>
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                {resolution?.upcomingShift === "MORNING_SHIFT" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Morning Shift Takeover</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>Night Shift Takeover</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Handover Schedule</span>
            <span className="font-mono font-bold text-slate-700">
              {resolution?.upcomingShiftStartsAt}:00 Prompt
            </span>
          </div>
        </div>

        {/* Card 3: Next Weekly Rotation Countdown */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#CF0458]" />
              <span>Next Weekly Swap</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              Every Monday 00:00
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {resolution?.daysUntilNextRotation}d {resolution?.hoursUntilNextRotation}h
            </div>
            <p className="text-xs font-medium text-slate-500">
              Automatic swap scheduled for:{" "}
              <strong className="text-slate-800">{resolution?.nextRotationFormatted}</strong>
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Following Rotation</span>
            <span className="font-semibold text-slate-700">
              {resolution?.morningSupervisor.name.split(" ")[0]} &rarr; Night
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. SETTINGS & CONFIGURATION DRAWER (COLLAPSIBLE)            */}
      {/* ============================================================ */}
      {isSettingsOpen && (
        <form
          onSubmit={handleSaveSettings}
          className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-[#CF0458]" />
                <span>Rotation Engine Settings</span>
              </h3>
              <p className="text-xs text-slate-500">
                Configure automatic weekly switching rules, default leads, or manual overrides.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Mode Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rotation Mode
              </label>
              <select
                value={formMode}
                onChange={(e) => setFormMode(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
              >
                <option value="AUTO_WEEKLY">🔄 Automatic Weekly Alternation</option>
                <option value="MANUAL_OVERRIDE">🔒 Manual Assignment Lock</option>
              </select>
            </div>

            {/* Morning Supervisor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Morning Shift Lead (Day)</span>
              </label>
              <select
                value={selectedMorningId}
                onChange={(e) => setSelectedMorningId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
              >
                {supervisorsCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email}) {s.role === "ASSISTANT_PRODUCTION_SUPERVISOR" ? "— Asst. Lead" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Night Supervisor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Night Shift Lead (Night)</span>
              </label>
              <select
                value={selectedNightId}
                onChange={(e) => setSelectedNightId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
              >
                {supervisorsCatalog.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email}) {s.role === "ASSISTANT_PRODUCTION_SUPERVISOR" ? "— Asst. Lead" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Rotation Day */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Rotation Switch Day
              </label>
              <select
                value={rotationDayOfWeek}
                onChange={(e) => setRotationDayOfWeek(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
              >
                <option value={1}>Every Monday (00:00 Midnight)</option>
                <option value={0}>Every Sunday (00:00 Midnight)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Administrative Rotation Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Aishah covers day, Ada covers night. Swaps weekly."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#CF0458]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              {savingSettings ? "Saving Settings..." : "Save Configuration"}
            </button>
          </div>
        </form>
      )}

      {/* ============================================================ */}
      {/* 4. UPCOMING 6-WEEK ROTATION SCHEDULE TIMELINE               */}
      {/* ============================================================ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#CF0458]" />
              <span>Automated 6-Week Shift Rotation Projection</span>
            </h3>
            <p className="text-xs text-slate-500">
              Weekly alternating supervisory schedule calculated forward from active rotation parity.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            Cycle: 7-Day Inversion
          </span>
        </div>

        {/* Schedule Grid */}
        <div className="divide-y divide-slate-100 overflow-x-auto">
          {schedule.map((item) => (
            <div
              key={item.weekIndex}
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                item.isCurrentWeek ? "bg-rose-50/30" : "hover:bg-slate-50/50"
              }`}
            >
              {/* Week Tag */}
              <div className="flex items-center gap-3 sm:w-64 shrink-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    item.isCurrentWeek
                      ? "bg-[#CF0458] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  W{item.weekIndex + 1}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">
                      {item.weekRangeFormatted}
                    </span>
                    {item.isCurrentWeek && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-[#CF0458] border border-rose-200">
                        Current Week
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Starts {item.weekStartDate}
                  </span>
                </div>
              </div>

              {/* Assignments: Morning & Night */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 flex-1">
                {/* Morning Assignment */}
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Sun className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Day Run (08:00–18:00)
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate block">
                      {item.morningSupervisor.name}
                    </span>
                  </div>
                </div>

                {/* Night Assignment */}
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Moon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Night Run (18:00–08:00)
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate block">
                      {item.nightSupervisor.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
