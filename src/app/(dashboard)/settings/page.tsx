"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  ShieldCheck,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Building,
  CheckCircle2,
  AlertCircle,
  Bell,
  Volume2,
  Smartphone,
  Save,
  Check,
  RotateCcw,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Password form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Settings form states
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  const [preferredShift, setPreferredShift] = useState<"MORNING_SHIFT" | "NIGHT_SHIFT">("MORNING_SHIFT");
  const [lowStockAlerts, setLowStockAlerts] = useState(true);
  const [soundFeedback, setSoundFeedback] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [prefSuccess, setPrefSuccess] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "MF";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match. Please verify.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(false);

    if (!/^\d{4}$/.test(pin)) {
      setPinError("PIN must be exactly 4 numeric digits.");
      return;
    }
    if (pin !== confirmPin) {
      setPinError("PINs do not match. Please re-enter.");
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch("/api/auth/update-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update terminal PIN.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("moh_terminal_pin", pin);
      }
      setPinSuccess(true);
      setPin("");
      setConfirmPin("");
      setTimeout(() => setPinSuccess(false), 3500);
    } catch (err: any) {
      setPinError(err.message || "Failed to update terminal PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleSavePreferences = () => {
    setPrefSuccess(true);
    setTimeout(() => setPrefSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
              System Configuration
            </span>
            <span className="text-xs font-semibold text-slate-400">Account & Terminal Preferences</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Settings & Terminal Security
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your operator profile, 4-digit floor terminal PIN lock, shift preferences, and regulatory compliance info.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/pin-lock")}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer w-full sm:w-auto"
        >
          <Lock className="w-3.5 h-3.5 text-slate-600" />
          <span>Test Terminal Lock</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Operator Profile & Identification */}
        <div className="md:col-span-1 space-y-6">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Operator Identity
            </h2>

            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-base font-extrabold shadow-xs">
                {getInitials(user?.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 text-sm truncate">
                  {user?.fullName || "Staff Member"}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {user?.staffId || "MOH-STAFF"}
                </div>
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#059669] border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                  <span>Active Session</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-semibold text-slate-800">{user?.departmentName || "Operations"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">System Role</span>
                <span className="font-mono font-bold text-[#CF0458]">{user?.role || "STAFF"}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Official Email</span>
                <span className="font-mono text-slate-700">{user?.email || "staff@mohfood.com"}</span>
              </div>
              {user?.phone && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
                  <span className="font-mono text-slate-700">{user.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Regulatory NAFDAC Card */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs space-y-3 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <Building className="w-4 h-4 text-[#059669]" />
              <span>Plant & Regulatory Compliance</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Moh Industries Ltd manufacturing facility operates under standard Good Manufacturing Practice (GMP).
            </p>
            <div className="pt-2 border-t border-slate-200/60 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">NAFDAC Reg. No:</span>
                <span className="font-mono font-bold text-slate-800">A8-106771</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Facility Location:</span>
                <span className="font-semibold text-slate-800">Lagos Plant</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">MOH-OPS Engine:</span>
                <span className="font-mono text-slate-600">v1.0.0 (Bun)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Password, PIN Security & System Preferences */}
        <div className="md:col-span-2 space-y-6">
          {/* Card 1: Account Password Security */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Account Password Security</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Login Credential
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your operational portal login password. We recommend a strong, memorable passphrase.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Your account password has been updated and synchronized successfully.</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">At least 8 characters</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      required
                      minLength={8}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#CF0458] focus:outline-hidden transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Must match new password</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={passwordLoading || !currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  {passwordLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Update Account Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Fast Terminal PIN Security */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Floor Terminal PIN Security</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Floor Tablets
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set or update your 4-digit PIN used to quickly unlock floor tablet terminals without entering full passwords.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Lock className="w-4 h-4" />
              </div>
            </div>

            {pinSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Floor Terminal PIN updated and synchronized successfully.</span>
              </div>
            )}

            {pinError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePin} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono text-xl tracking-widest text-slate-900 placeholder-slate-300 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">4 numeric digits only</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirm 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono text-xl tracking-widest text-slate-900 placeholder-slate-300 focus:bg-white focus:border-[#CF0458] focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Re-type to verify</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={pinLoading || pin.length !== 4 || confirmPin.length !== 4}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#CF0458] hover:bg-[#B5034C] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  {pinLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating PIN...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Update Terminal PIN</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Plant Operational Preferences */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Plant & Shift Schedule Preferences
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure default shift schedule hours and automated alerts.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                <Settings className="w-4 h-4" />
              </div>
            </div>

            {prefSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Operational preferences saved.</span>
              </div>
            )}

            <div className="space-y-4 pt-2">
              {/* Default Shift Preference */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Default Operational Shift
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPreferredShift("MORNING_SHIFT")}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      preferredShift === "MORNING_SHIFT"
                        ? "bg-slate-50 border-[#CF0458] text-slate-900"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="font-bold">Morning Shift</div>
                        <div className="text-[10px] text-slate-400 font-mono">08:00 – 18:00 (10 Hours)</div>
                      </div>
                    </div>
                    {preferredShift === "MORNING_SHIFT" && (
                      <Check className="w-4 h-4 text-[#CF0458]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreferredShift("NIGHT_SHIFT")}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      preferredShift === "NIGHT_SHIFT"
                        ? "bg-slate-50 border-[#CF0458] text-slate-900"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Moon className="w-4 h-4 text-indigo-500" />
                      <div>
                        <div className="font-bold">Night Shift</div>
                        <div className="text-[10px] text-slate-400 font-mono">18:00 – 08:00 (14 Hours)</div>
                      </div>
                    </div>
                    {preferredShift === "NIGHT_SHIFT" && (
                      <Check className="w-4 h-4 text-[#CF0458]" />
                    )}
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-bold text-slate-800">Low Stock Safety Alerts</div>
                    <div className="text-[11px] text-slate-500">
                      Alert when raw material inventory dips below safety reorder runway
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={lowStockAlerts}
                    onChange={(e) => setLowStockAlerts(e.target.checked)}
                    className="w-4 h-4 accent-[#CF0458] rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-bold text-slate-800">Barcode Audio Chirp</div>
                    <div className="text-[11px] text-slate-500">
                      Audio confirmation chime when scanning lots or completing batch dispense
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundFeedback}
                    onChange={(e) => setSoundFeedback(e.target.checked)}
                    className="w-4 h-4 accent-[#CF0458] rounded cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="font-bold text-slate-800">Tablet Vibration Feedback</div>
                    <div className="text-[11px] text-slate-500">
                      Haptic pulse when operating store room terminals with work gloves
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hapticFeedback}
                    onChange={(e) => setHapticFeedback(e.target.checked)}
                    className="w-4 h-4 accent-[#CF0458] rounded cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Operational Preferences</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
