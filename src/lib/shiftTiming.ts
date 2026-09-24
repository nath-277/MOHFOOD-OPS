/**
 * Moh Foods Shift Timing & Handover Grace Period Helpers
 *
 * Operational Shifts:
 * - Morning Shift: 08:00 – 18:00 (6:00 PM). Shift ends at 18:00.
 *   Edit/Cancel grace period: 2 hours after shift ends -> 20:00 (8:00 PM) same day.
 * - Night Shift: 18:00 – 08:00 (8:00 AM next day). Shift ends at 08:00 next day.
 *   Edit/Cancel grace period: 2 hours after shift ends -> 10:00 (10:00 AM) that morning.
 */

export function getShiftHandoverCutoff(
  createdAt: string | Date,
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT"
): Date {
  const d = new Date(createdAt);
  const cutoff = new Date(d.getTime());

  if (shiftType === "MORNING_SHIFT") {
    // Morning shift concludes at 18:00; lock-off is 20:00 (8:00 PM) on the same date
    cutoff.setHours(20, 0, 0, 0);
    return cutoff;
  } else {
    // Night shift spans overnight:
    // If dispatched in evening (e.g. 18:00 - 23:59), the shift ends tomorrow at 08:00 -> cutoff is tomorrow at 10:00 AM.
    // If dispatched post-midnight (00:00 - 08:00), the shift ends today at 08:00 -> cutoff is today at 10:00 AM.
    if (d.getHours() >= 12) {
      cutoff.setDate(cutoff.getDate() + 1);
    }
    cutoff.setHours(10, 0, 0, 0);
    return cutoff;
  }
}

export function isDispatchEditable(
  createdAt: string | Date,
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT",
  status?: string,
  nowDate: Date = new Date()
): boolean {
  if (status?.toUpperCase() === "CANCELLED") {
    return false;
  }
  return true;
}

export function getEffectiveDispatchStatus(
  createdAt: string | Date,
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT",
  status?: string,
  nowDate: Date = new Date()
): "PENDING_HANDOVER" | "PERMANENT" | "CANCELLED" {
  if (status?.toUpperCase() === "CANCELLED") return "CANCELLED";
  return "PENDING_HANDOVER";
}

export function formatCutoffTime(cutoff: Date): string {
  const hours = cutoff.getHours();
  const minutes = cutoff.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
  const formattedMins = minutes < 10 ? `0${minutes}` : minutes;
  return `${formattedHours}:${formattedMins} ${ampm}`;
}

export function getHandoverGraceDescription(
  createdAt: string | Date,
  shiftType: "MORNING_SHIFT" | "NIGHT_SHIFT",
  status?: string,
  nowDate: Date = new Date()
): {
  isEditable: boolean;
  effectiveStatus: "PENDING_HANDOVER" | "PERMANENT" | "CANCELLED";
  cutoff: Date;
  cutoffFormatted: string;
  badgeLabel: string;
} {
  const effectiveStatus = getEffectiveDispatchStatus(createdAt, shiftType, status, nowDate);
  const cutoff = getShiftHandoverCutoff(createdAt, shiftType);
  const cutoffFormatted = formatCutoffTime(cutoff);
  const isEditable = effectiveStatus !== "CANCELLED";

  let badgeLabel = "Active / Editable";
  if (effectiveStatus === "CANCELLED") {
    badgeLabel = "Cancelled";
  }

  return {
    isEditable,
    effectiveStatus,
    cutoff,
    cutoffFormatted,
    badgeLabel,
  };
}

export function getProductionDayKey(isoStr: string, shiftType?: string): string {
  const d = new Date(isoStr);
  if (shiftType === "NIGHT_SHIFT" && d.getHours() < 8) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDayOrdinal(dateKey: string): string {
  const parts = dateKey.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayOfWeek = daysOfWeek[d.getDay()];
  const monthName = months[d.getMonth()];
  const dayNum = d.getDate();
  const year = d.getFullYear();

  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const dayOrdinal = getOrdinal(dayNum);
  return `${dayOfWeek}, ${dayOrdinal} ${monthName} ${year}`;
}

