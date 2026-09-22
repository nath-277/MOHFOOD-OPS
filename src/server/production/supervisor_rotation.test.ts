import { describe, it, expect, beforeEach } from "bun:test";
import {
  resolveCurrentShiftSupervisors,
  getUpcomingRotationSchedule,
  swapSupervisorShifts,
  updateSupervisorRotationConfig,
  getSupervisorRotationRecord,
} from "./supervisorRotation";
import { getDefaultSupervisorName } from "../auth/store";

describe("Supervisor Shift Rotation Engine", () => {
  beforeEach(async () => {
    // Reset to default anchor: AUTO_WEEKLY, Aishah Morning, Ada Night, baseWeek: 2026-09-21
    await updateSupervisorRotationConfig({
      mode: "AUTO_WEEKLY",
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
    const schedule = await getUpcomingRotationSchedule(6);
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
    // Reset to default
    await updateSupervisorRotationConfig({
      mode: "AUTO_WEEKLY",
      morningSupervisorName: "Aishah Anuoluwapo",
      nightSupervisorName: "Aunty Ada",
    });

    const morningSup = await getDefaultSupervisorName("MORNING_SHIFT");
    const nightSup = await getDefaultSupervisorName("NIGHT_SHIFT");

    expect(morningSup).toBe("Aishah Anuoluwapo");
    expect(nightSup).toBe("Aunty Ada");
  });
});
