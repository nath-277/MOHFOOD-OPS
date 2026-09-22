import { describe, test, expect } from "bun:test";
import {
  getShiftHandoverCutoff,
  isDispatchEditable,
  getEffectiveDispatchStatus,
  formatCutoffTime,
  getHandoverGraceDescription,
} from "@/lib/shiftTiming";

describe("Shift Handover Timing & 2-Hour Grace Period Cutoff", () => {
  test("Morning Shift (ends at 18:00): Cutoff is 20:00 (8:00 PM) on the same day", () => {
    // Dispatched at 10:30 AM during morning shift
    const dispatchTime = new Date(2026, 8, 22, 10, 30, 0); // 2026-09-22 10:30
    const cutoff = getShiftHandoverCutoff(dispatchTime, "MORNING_SHIFT");

    expect(cutoff.getFullYear()).toBe(2026);
    expect(cutoff.getMonth()).toBe(8);
    expect(cutoff.getDate()).toBe(22);
    expect(cutoff.getHours()).toBe(20);
    expect(cutoff.getMinutes()).toBe(0);
    expect(formatCutoffTime(cutoff)).toBe("8:00 PM");

    // At 19:30 (7:30 PM, 1.5h after shift ended, within 2h grace window): Still editable
    const duringGrace = new Date(2026, 8, 22, 19, 30, 0);
    expect(isDispatchEditable(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", duringGrace)).toBe(true);
    expect(getEffectiveDispatchStatus(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", duringGrace)).toBe("PENDING_HANDOVER");

    // At 20:01 (8:01 PM, past 2h grace window): Locked off completely
    const afterGrace = new Date(2026, 8, 22, 20, 1, 0);
    expect(isDispatchEditable(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", afterGrace)).toBe(false);
    expect(getEffectiveDispatchStatus(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", afterGrace)).toBe("PERMANENT");
  });

  test("Night Shift (ends at 08:00 next day): Cutoff is 10:00 (10:00 AM) on the concluding morning", () => {
    // Evening dispatch at 21:00 (9:00 PM) during night shift
    const dispatchEvening = new Date(2026, 8, 22, 21, 0, 0); // 2026-09-22 21:00
    const cutoffEvening = getShiftHandoverCutoff(dispatchEvening, "NIGHT_SHIFT");

    expect(cutoffEvening.getDate()).toBe(23); // Next day
    expect(cutoffEvening.getHours()).toBe(10); // 10:00 AM
    expect(cutoffEvening.getMinutes()).toBe(0);
    expect(formatCutoffTime(cutoffEvening)).toBe("10:00 AM");

    // At 09:15 AM next day (1h15m after shift ends, within grace window): Still editable
    const duringGraceMorning = new Date(2026, 8, 23, 9, 15, 0);
    expect(isDispatchEditable(dispatchEvening, "NIGHT_SHIFT", "PENDING_HANDOVER", duringGraceMorning)).toBe(true);

    // At 10:05 AM next day: Locked off
    const afterGraceMorning = new Date(2026, 8, 23, 10, 5, 0);
    expect(isDispatchEditable(dispatchEvening, "NIGHT_SHIFT", "PENDING_HANDOVER", afterGraceMorning)).toBe(false);
    expect(getEffectiveDispatchStatus(dispatchEvening, "NIGHT_SHIFT", "PENDING_HANDOVER", afterGraceMorning)).toBe("PERMANENT");
  });

  test("Night Shift post-midnight dispatch (02:30 AM): Cutoff is 10:00 AM of that same morning", () => {
    // Dispatched at 02:30 AM
    const dispatchMidnight = new Date(2026, 8, 23, 2, 30, 0);
    const cutoff = getShiftHandoverCutoff(dispatchMidnight, "NIGHT_SHIFT");

    expect(cutoff.getDate()).toBe(23); // Same calendar date as dispatch
    expect(cutoff.getHours()).toBe(10);
    expect(formatCutoffTime(cutoff)).toBe("10:00 AM");

    const beforeCutoff = new Date(2026, 8, 23, 8, 45, 0);
    expect(isDispatchEditable(dispatchMidnight, "NIGHT_SHIFT", "PENDING_HANDOVER", beforeCutoff)).toBe(true);

    const afterCutoff = new Date(2026, 8, 23, 10, 2, 0);
    expect(isDispatchEditable(dispatchMidnight, "NIGHT_SHIFT", "PENDING_HANDOVER", afterCutoff)).toBe(false);
  });

  test("Explicit status handling: CANCELLED and PERMANENT are never editable", () => {
    const recent = new Date();
    expect(isDispatchEditable(recent, "MORNING_SHIFT", "CANCELLED")).toBe(false);
    expect(isDispatchEditable(recent, "MORNING_SHIFT", "PERMANENT")).toBe(false);
  });

  test("Badge and description helper returns informative user labels", () => {
    const dispatchTime = new Date(2026, 8, 22, 11, 0, 0);
    const duringGrace = new Date(2026, 8, 22, 17, 0, 0);
    const descGrace = getHandoverGraceDescription(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", duringGrace);

    expect(descGrace.isEditable).toBe(true);
    expect(descGrace.badgeLabel).toBe("Editable until 8:00 PM");

    const afterGrace = new Date(2026, 8, 22, 20, 30, 0);
    const descLocked = getHandoverGraceDescription(dispatchTime, "MORNING_SHIFT", "PENDING_HANDOVER", afterGrace);

    expect(descLocked.isEditable).toBe(false);
    expect(descLocked.effectiveStatus).toBe("PERMANENT");
    expect(descLocked.badgeLabel).toBe("Handed Over (8:00 PM)");
  });
});
