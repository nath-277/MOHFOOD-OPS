/**
 * Moh Foods Central Date Formatting Utilities
 * Standardizes date formatting across the entire system to DD/MM/YY
 */

/**
 * Formats any date input (ISO string, YYYY-MM-DD, timestamp, Date object)
 * into standard DD/MM/YY format (or DD/MM/YYYY if shortYear is false).
 *
 * Examples:
 * - "2026-09-29" -> "29/09/26"
 * - "2026-09-29T14:30:00.000Z" -> "29/09/26"
 * - Date object -> "29/09/26"
 */
export function formatDate(
  input?: string | number | Date | null,
  fallback: string = "—",
  shortYear: boolean = true
): string {
  if (!input) return fallback;

  // Handle plain YYYY-MM-DD string without timezone skew
  if (typeof input === "string") {
    const trimmed = input.trim();
    const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch && trimmed.length === 10) {
      const [, yyyy, mm, dd] = dateMatch;
      const yr = shortYear ? yyyy.slice(-2) : yyyy;
      return `${dd}/${mm}/${yr}`;
    }
  }

  const d = new Date(input);
  if (isNaN(d.getTime())) return fallback;

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const yr = shortYear ? String(yyyy).slice(-2) : String(yyyy);

  return `${dd}/${mm}/${yr}`;
}

/**
 * Formats date and time into DD/MM/YY, HH:mm
 */
export function formatDateTime(
  input?: string | number | Date | null,
  fallback: string = "—",
  shortYear: boolean = true
): string {
  if (!input) return fallback;
  const d = new Date(input);
  if (isNaN(d.getTime())) return fallback;

  const datePart = formatDate(d, fallback, shortYear);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${datePart}, ${hours}:${minutes}`;
}

/**
 * Formats date with weekday e.g. "Tue, 29/09/26" or "Tuesday, 29/09/26"
 */
export function formatDateWithDay(
  input?: string | number | Date | null,
  shortWeekday: boolean = true,
  fallback: string = "—",
  shortYear: boolean = true
): string {
  if (!input) return fallback;

  let d: Date;
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const parts = input.trim().split("-").map(Number);
    d = new Date(parts[0], parts[1] - 1, parts[2]);
  } else {
    d = new Date(input);
  }

  if (isNaN(d.getTime())) return fallback;

  const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysLong = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const weekday = shortWeekday ? daysShort[d.getDay()] : daysLong[d.getDay()];

  return `${weekday}, ${formatDate(d, fallback, shortYear)}`;
}

/**
 * Formats relative day label with DD/MM/YY e.g.
 * "Today (29/09/26)" or "Yesterday (28/09/26)" or "29/09/26"
 */
export function formatDayRelative(dateKey: string, shortYear: boolean = true): string {
  if (!dateKey) return "—";

  const parts = dateKey.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  const formatted = formatDate(dateKey, "—", shortYear);
  if (isToday) return `Today (${formatted})`;
  if (isYesterday) return `Yesterday (${formatted})`;
  return formatted;
}
