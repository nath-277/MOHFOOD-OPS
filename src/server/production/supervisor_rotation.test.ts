import { describe, it, expect, beforeEach } from "bun:test";
import {
  resolveCurrentShiftSupervisors,
  getUpcomingRotationSchedule,
  swapSupervisorShifts,
  updateSupervisorRotationConfig,
  getSupervisorRotationRecord,
  getStartOfWeek,
} from "./supervisorRotation";
import { getDefaultSupervisorName, getProductionSupervisors } from "../auth/store";
import { getShiftParityForDate } from "../../components/inventory/BatchDispenseModal";

describe("Supervisor Shift Rotation Engine", () => {
  beforeEach(async () => {
    // Reset to default anchor: AUTO_WEEKLY, Aishah Morning, Ada Night, baseWeek: 2026-09-21
    await updateSupervisorRotationConfig({
      mode: "AUTO_WEEKLY",
      baseWeekStartDate: "2026-09-21",
      morningSupervisorId: "c620225a-d1ad-47aa-9611-030b0fd656f1",
      morningSupervisorName: "Aishah Anuoluwapo",
      nightSupervisorId: "759ccc19-caf0-4fb8-a309-b9b29d631e71",
      nightSupervisorName: "Aunty Ada",
      rotationDayOfWeek: 1,
      rotationHour: 0,
      notes: "Default weekly rotation: Aishah Morning / Ada Night",
    });
  });

  it("should initialize with Aishah for Morning Shift and Ada for Night Shift for the base week", async () => {
    // Base week: Tuesday, Sep 22, 2026 at 10:00 AM (Morning)
    const resDay = await resolveCurrentShiftSupervisors(new Date("2026-09-22T10:00:00"));
    expect(resDay.morningSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(resDay.nightSupervisor.name).toBe("Aunty Ada");
    expect(resDay.activeShift).toBe("MORNING_SHIFT");
    expect(resDay.activeOnDutySupervisor.name).toBe("Aishah Anuoluwapo");
    expect(resDay.upcomingShift).toBe("NIGHT_SHIFT");
    expect(resDay.upcomingSupervisor.name).toBe("Aunty Ada");
    expect(resDay.upcomingShiftStartsAt).toBe("18:00");
    expect(resDay.isSwappedFromBase).toBe(false);

    // Same day at 21:00 (Night Shift)
    const resNight = await resolveCurrentShiftSupervisors(new Date("2026-09-22T21:00:00"));
    expect(resNight.activeShift).toBe("NIGHT_SHIFT");
    expect(resNight.activeOnDutySupervisor.name).toBe("Aunty Ada");
    expect(resNight.upcomingShift).toBe("MORNING_SHIFT");
    expect(resNight.upcomingSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(resNight.upcomingShiftStartsAt).toBe("08:00");
  });

  it("should automatically rotate shifts in week 1: Ada becomes Day and Aishah becomes Night", async () => {
    // Week 1: Tuesday, Sep 29, 2026 at 11:00 AM
    const resWeek1Day = await resolveCurrentShiftSupervisors(new Date("2026-09-29T11:00:00"));
    expect(resWeek1Day.morningSupervisor.name).toBe("Aunty Ada");
    expect(resWeek1Day.nightSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(resWeek1Day.activeShift).toBe("MORNING_SHIFT");
    expect(resWeek1Day.activeOnDutySupervisor.name).toBe("Aunty Ada");
    expect(resWeek1Day.isSwappedFromBase).toBe(true);

    // Week 1 Night: Tuesday, Sep 29, 2026 at 22:00
    const resWeek1Night = await resolveCurrentShiftSupervisors(new Date("2026-09-29T22:00:00"));
    expect(resWeek1Night.activeShift).toBe("NIGHT_SHIFT");
    expect(resWeek1Night.activeOnDutySupervisor.name).toBe("Aishah Anuoluwapo");
  });

  it("should automatically swap back in week 2: Aishah becomes Day and Ada becomes Night", async () => {
    // Week 2: Tuesday, Oct 06, 2026 at 14:00
    const resWeek2 = await resolveCurrentShiftSupervisors(new Date("2026-10-06T14:00:00"));
    expect(resWeek2.morningSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(resWeek2.nightSupervisor.name).toBe("Aunty Ada");
    expect(resWeek2.activeOnDutySupervisor.name).toBe("Aishah Anuoluwapo");
    expect(resWeek2.isSwappedFromBase).toBe(false);
  });

  it("should project an alternating 6-week schedule timeline", async () => {
    const schedule = await getUpcomingRotationSchedule(6, new Date("2026-09-22T10:00:00"));
    expect(schedule.length).toBe(6);

    // Week 0 (Current)
    expect(schedule[0].isCurrentWeek).toBe(true);
    expect(schedule[0].morningSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(schedule[0].nightSupervisor.name).toBe("Aunty Ada");

    // Week 1
    expect(schedule[1].isCurrentWeek).toBe(false);
    expect(schedule[1].morningSupervisor.name).toBe("Aunty Ada");
    expect(schedule[1].nightSupervisor.name).toBe("Aishah Anuoluwapo");

    // Week 2
    expect(schedule[2].morningSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(schedule[2].nightSupervisor.name).toBe("Aunty Ada");

    // Week 3
    expect(schedule[3].morningSupervisor.name).toBe("Aunty Ada");
    expect(schedule[3].nightSupervisor.name).toBe("Aishah Anuoluwapo");
  });

  it("should allow instant admin shift swap and immediately invert active leads", async () => {
    // Before swap (Week 0): Day is Aishah, Night is Ada
    const before = await resolveCurrentShiftSupervisors(new Date("2026-09-22T10:00:00"));
    expect(before.morningSupervisor.name).toBe("Aishah Anuoluwapo");

    // Admin triggers instant swap
    const swappedRecord = await swapSupervisorShifts("Chief IT Systems Admin");
    expect(swappedRecord.baseMorningSupervisorName).toBe("Aunty Ada");
    expect(swappedRecord.baseNightSupervisorName).toBe("Aishah Anuoluwapo");

    // After swap: Day is Ada, Night is Aishah
    const after = await resolveCurrentShiftSupervisors(new Date("2026-09-22T10:00:00"));
    expect(after.morningSupervisor.name).toBe("Aunty Ada");
    expect(after.nightSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(after.activeOnDutySupervisor.name).toBe("Aunty Ada");

    // Swap back
    await swapSupervisorShifts("Chief IT Systems Admin");
    const restored = await resolveCurrentShiftSupervisors(new Date("2026-09-22T10:00:00"));
    expect(restored.morningSupervisor.name).toBe("Aishah Anuoluwapo");
    expect(restored.nightSupervisor.name).toBe("Aunty Ada");
  });

  it("should support manual override mode to lock shift assignments", async () => {
    // Admin sets manual override
    await updateSupervisorRotationConfig({
      mode: "MANUAL_OVERRIDE",
      morningSupervisorId: "759ccc19-caf0-4fb8-a309-b9b29d631e71",
      morningSupervisorName: "Aunty Ada",
      nightSupervisorId: "c620225a-d1ad-47aa-9611-030b0fd656f1",
      nightSupervisorName: "Aishah Anuoluwapo",
    });

    // In week 0: Morning is Ada
    const week0 = await resolveCurrentShiftSupervisors(new Date("2026-09-22T10:00:00"));
    expect(week0.mode).toBe("MANUAL_OVERRIDE");
    expect(week0.morningSupervisor.name).toBe("Aunty Ada");

    // In week 1: Morning remains Ada because auto-rotation is locked
    const week1 = await resolveCurrentShiftSupervisors(new Date("2026-09-29T10:00:00"));
    expect(week1.morningSupervisor.name).toBe("Aunty Ada");
  });

  it("should dynamically resolve shift-based supervisor in getDefaultSupervisorName", async () => {
    // Reset to default with current week anchor so getDefaultSupervisorName() (which uses new Date()) matches
    const currentMonday = getStartOfWeek(new Date(), 1).toISOString().split("T")[0];
    await updateSupervisorRotationConfig({
      mode: "AUTO_WEEKLY",
      baseWeekStartDate: currentMonday,
      morningSupervisorName: "Aishah Anuoluwapo",
      nightSupervisorName: "Aunty Ada",
    });

    const morningSup = await getDefaultSupervisorName("MORNING_SHIFT");
    const nightSup = await getDefaultSupervisorName("NIGHT_SHIFT");

    expect(morningSup).toBe("Aishah Anuoluwapo");
    expect(nightSup).toBe("Aunty Ada");
  });

  it("should accurately resolve supervisor shifts for previous and future weeks using targetDate", async () => {
    // Week 0: 2026-09-22 -> Aishah Morning, Ada Night
    expect(await getDefaultSupervisorName("MORNING_SHIFT", "2026-09-22")).toBe("Aishah Anuoluwapo");
    expect(await getDefaultSupervisorName("NIGHT_SHIFT", "2026-09-22")).toBe("Aunty Ada");

    // Week 1 (Previous/Target week): 2026-09-29 -> Ada Morning, Aishah Night
    expect(await getDefaultSupervisorName("MORNING_SHIFT", "2026-09-29")).toBe("Aunty Ada");
    expect(await getDefaultSupervisorName("NIGHT_SHIFT", "2026-09-29")).toBe("Aishah Anuoluwapo");

    // Week 2: 2026-10-06 -> Aishah Morning, Ada Night
    expect(await getDefaultSupervisorName("MORNING_SHIFT", "2026-10-06")).toBe("Aishah Anuoluwapo");
    expect(await getDefaultSupervisorName("NIGHT_SHIFT", "2026-10-06")).toBe("Aunty Ada");

    // Week 3: 2026-10-13 -> Ada Morning, Aishah Night
    expect(await getDefaultSupervisorName("MORNING_SHIFT", "2026-10-13")).toBe("Aunty Ada");
    expect(await getDefaultSupervisorName("NIGHT_SHIFT", "2026-10-13")).toBe("Aishah Anuoluwapo");
  });

  it("should tag correct isMorningLead and isNightLead flags in getProductionSupervisors based on targetDate", async () => {
    // Week 1 (Ada Day, Aishah Night)
    const supsWeek1 = await getProductionSupervisors("2026-09-29");
    const adaWeek1 = supsWeek1.find((s) => s.cleanName === "Aunty Ada");
    const aishahWeek1 = supsWeek1.find((s) => s.cleanName === "Aishah Anuoluwapo");

    expect(adaWeek1?.isMorningLead).toBe(true);
    expect(adaWeek1?.isNightLead).toBe(false);
    expect(aishahWeek1?.isMorningLead).toBe(false);
    expect(aishahWeek1?.isNightLead).toBe(true);

    // Week 2 (Aishah Day, Ada Night)
    const supsWeek2 = await getProductionSupervisors("2026-10-06");
    const adaWeek2 = supsWeek2.find((s) => s.cleanName === "Aunty Ada");
    const aishahWeek2 = supsWeek2.find((s) => s.cleanName === "Aishah Anuoluwapo");

    expect(aishahWeek2?.isMorningLead).toBe(true);
    expect(aishahWeek2?.isNightLead).toBe(false);
    expect(adaWeek2?.isMorningLead).toBe(false);
    expect(adaWeek2?.isNightLead).toBe(true);
  });

  it("should calculate correct shift parity across weeks with getShiftParityForDate", () => {
    // Base week (even): 2026-09-21 to 2026-09-27
    expect(getShiftParityForDate("2026-09-21")).toBe(false); // Mon
    expect(getShiftParityForDate("2026-09-25")).toBe(false); // Fri
    expect(getShiftParityForDate("2026-09-27")).toBe(false); // Sun

    // Week 1 (odd / swapped): 2026-09-28 to 2026-10-04
    expect(getShiftParityForDate("2026-09-28")).toBe(true);  // Mon
    expect(getShiftParityForDate("2026-10-01")).toBe(true);  // Thu
    expect(getShiftParityForDate("2026-10-04")).toBe(true);  // Sun

    // Week 2 (even): 2026-10-05 to 2026-10-11
    expect(getShiftParityForDate("2026-10-05")).toBe(false); // Mon
    expect(getShiftParityForDate("2026-10-11")).toBe(false); // Sun

    // Week 3 (odd): 2026-10-12 to 2026-10-18
    expect(getShiftParityForDate("2026-10-12")).toBe(true);  // Mon
  });
});
