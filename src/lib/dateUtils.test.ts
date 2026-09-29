import { describe, it, expect } from "bun:test";
import {
  formatDate,
  formatDateTime,
  formatDateWithDay,
  formatDayRelative,
} from "./dateUtils";

describe("Date Formatting Utilities (DD/MM/YYYY)", () => {
  it("formats plain YYYY-MM-DD string to DD/MM/YYYY without timezone shift", () => {
    expect(formatDate("2026-09-29")).toBe("29/09/2026");
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
    expect(formatDate("2025-12-31")).toBe("31/12/2025");
  });

  it("formats ISO datetime string to DD/MM/YYYY", () => {
    const d = new Date(2026, 8, 29, 14, 30); // 29 Sep 2026
    expect(formatDate(d.toISOString())).toBe("29/09/2026");
  });

  it("formats Date object to DD/MM/YYYY", () => {
    const d = new Date(2026, 8, 29);
    expect(formatDate(d)).toBe("29/09/2026");
  });

  it("handles null, undefined, or empty gracefully", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("invalid-date")).toBe("—");
  });

  it("formats date and time accurately", () => {
    const d = new Date(2026, 8, 29, 9, 5); // 09:05 AM
    const res = formatDateTime(d);
    expect(res).toBe("29/09/2026, 09:05");
  });

  it("formats date with weekday", () => {
    expect(formatDateWithDay("2026-09-29", true)).toBe("Tue, 29/09/2026");
    expect(formatDateWithDay("2026-09-29", false)).toBe("Tuesday, 29/09/2026");
  });

  it("formats relative day labels", () => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(formatDayRelative(todayKey)).toContain("Today (");
    expect(formatDayRelative(todayKey)).toContain("/");
  });
});
