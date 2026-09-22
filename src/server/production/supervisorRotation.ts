import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { eventBus } from "../events/eventBus";

export interface SupervisorInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface SupervisorRotationRecord {
  id: string;
  mode: "AUTO_WEEKLY" | "MANUAL_OVERRIDE";
  baseWeekStartDate: string; // YYYY-MM-DD (e.g. "2026-09-21")
  baseMorningSupervisorId: string;
  baseMorningSupervisorName: string;
  baseNightSupervisorId: string;
  baseNightSupervisorName: string;
  manualMorningSupervisorId?: string | null;
  manualMorningSupervisorName?: string | null;
  manualNightSupervisorId?: string | null;
  manualNightSupervisorName?: string | null;
  rotationDayOfWeek: number; // 1 = Monday, 0 = Sunday
  rotationHour: number; // 0 = 00:00 midnight
  lastSwappedAt?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
  notes?: string | null;
}

export interface SupervisorShiftResolution {
  mode: "AUTO_WEEKLY" | "MANUAL_OVERRIDE";
  morningSupervisor: SupervisorInfo;
  nightSupervisor: SupervisorInfo;
  activeShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
  activeOnDutySupervisor: SupervisorInfo;
  upcomingShift: "MORNING_SHIFT" | "NIGHT_SHIFT";
  upcomingSupervisor: SupervisorInfo;
  upcomingShiftStartsAt: string; // "08:00" or "18:00"
  currentWeekStartDate: string;
  nextRotationDate: string;
  nextRotationFormatted: string;
  daysUntilNextRotation: number;
  hoursUntilNextRotation: number;
  isSwappedFromBase: boolean;
  notes?: string | null;
}

export interface UpcomingWeekSchedule {
  weekIndex: number;
  isCurrentWeek: boolean;
  weekStartDate: string;
  weekEndDate: string;
  weekRangeFormatted: string;
  morningSupervisor: SupervisorInfo;
  nightSupervisor: SupervisorInfo;
}

// In-Memory Fallback Cache (Aishah Day / Ada Night)
let MEMORY_ROTATION: SupervisorRotationRecord = {
  id: "default",
  mode: "AUTO_WEEKLY",
  baseWeekStartDate: "2026-09-21",
  baseMorningSupervisorId: "c620225a-d1ad-47aa-9611-030b0fd656f1",
  baseMorningSupervisorName: "Aishah Anuoluwapo",
  baseNightSupervisorId: "759ccc19-caf0-4fb8-a309-b9b29d631e71",
  baseNightSupervisorName: "Aunty Ada",
  manualMorningSupervisorId: null,
  manualMorningSupervisorName: null,
  manualNightSupervisorId: null,
  manualNightSupervisorName: null,
  rotationDayOfWeek: 1, // Monday
  rotationHour: 0, // 00:00
  lastSwappedAt: null,
  updatedAt: new Date().toISOString(),
  updatedBy: null,
  notes: "Initial weekly rotation: Aishah Morning / Ada Night",
};

/**
 * Normalizes date to the beginning of its week based on rotationDayOfWeek (default Monday)
 */
export function getStartOfWeek(date: Date, targetDayOfWeek = 1): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const currentDay = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diff = (currentDay < targetDayOfWeek ? 7 : 0) + currentDay - targetDayOfWeek;
  d.setDate(d.getDate() - diff);
  return d;
}

export async function getSupervisorRotationRecord(): Promise<SupervisorRotationRecord> {
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.supervisorShiftRotations)
        .where(eq(schema.supervisorShiftRotations.id, "default"))
        .limit(1);

      if (rows.length > 0) {
        const r = rows[0];
        MEMORY_ROTATION = {
          id: r.id,
          mode: r.mode as any,
          baseWeekStartDate: r.baseWeekStartDate,
          baseMorningSupervisorId: r.baseMorningSupervisorId,
          baseMorningSupervisorName: r.baseMorningSupervisorName,
          baseNightSupervisorId: r.baseNightSupervisorId,
          baseNightSupervisorName: r.baseNightSupervisorName,
          manualMorningSupervisorId: r.manualMorningSupervisorId,
          manualMorningSupervisorName: r.manualMorningSupervisorName,
          manualNightSupervisorId: r.manualNightSupervisorId,
          manualNightSupervisorName: r.manualNightSupervisorName,
          rotationDayOfWeek: r.rotationDayOfWeek,
          rotationHour: r.rotationHour,
          lastSwappedAt: r.lastSwappedAt ? new Date(r.lastSwappedAt).toISOString() : null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
          updatedBy: r.updatedBy,
          notes: r.notes,
        };
        return MEMORY_ROTATION;
      }
    } catch (err) {
      console.error("DB error in getSupervisorRotationRecord:", err);
    }
  }
  return MEMORY_ROTATION;
}

/**
 * Resolves current supervisor assignments, on-duty lead, and rotation metadata
 * for any given target timestamp (defaults to now).
 */
export async function resolveCurrentShiftSupervisors(
  targetDate: Date = new Date()
): Promise<SupervisorShiftResolution> {
  const record = await getSupervisorRotationRecord();

  let morningSupervisor: SupervisorInfo;
  let nightSupervisor: SupervisorInfo;
  let isSwapped = false;

  const currentMonday = getStartOfWeek(targetDate, record.rotationDayOfWeek);
  const currentWeekStartDate = currentMonday.toISOString().split("T")[0];

  if (record.mode === "MANUAL_OVERRIDE") {
    morningSupervisor = {
      id: record.manualMorningSupervisorId || record.baseMorningSupervisorId,
      name: record.manualMorningSupervisorName || record.baseMorningSupervisorName,
    };
    nightSupervisor = {
      id: record.manualNightSupervisorId || record.baseNightSupervisorId,
      name: record.manualNightSupervisorName || record.baseNightSupervisorName,
    };
  } else {
    // AUTO_WEEKLY rotation
    const baseMonday = getStartOfWeek(
      new Date(record.baseWeekStartDate),
      record.rotationDayOfWeek
    );
    const diffDays = Math.round(
      (currentMonday.getTime() - baseMonday.getTime()) / (24 * 60 * 60 * 1000)
    );
    const diffWeeks = Math.floor(diffDays / 7);
    isSwapped = Math.abs(diffWeeks) % 2 === 1;

    if (isSwapped) {
      morningSupervisor = {
        id: record.baseNightSupervisorId,
        name: record.baseNightSupervisorName,
      };
      nightSupervisor = {
        id: record.baseMorningSupervisorId,
        name: record.baseMorningSupervisorName,
      };
    } else {
      morningSupervisor = {
        id: record.baseMorningSupervisorId,
        name: record.baseMorningSupervisorName,
      };
      nightSupervisor = {
        id: record.baseNightSupervisorId,
        name: record.baseNightSupervisorName,
      };
    }
  }

  // Determine active on-duty shift based on target hour:
  // Morning Shift: 08:00 – 17:59 (10h)
  // Night Shift: 18:00 – 07:59 (14h)
  const hour = targetDate.getHours();
  const isMorning = hour >= 8 && hour < 18;

  const activeShift = isMorning ? "MORNING_SHIFT" : "NIGHT_SHIFT";
  const activeOnDutySupervisor = isMorning ? morningSupervisor : nightSupervisor;
  const upcomingShift = isMorning ? "NIGHT_SHIFT" : "MORNING_SHIFT";
  const upcomingSupervisor = isMorning ? nightSupervisor : morningSupervisor;
  const upcomingShiftStartsAt = isMorning ? "18:00" : "08:00";

  // Next weekly rotation boundary
  const nextRotationDate = new Date(currentMonday);
  nextRotationDate.setDate(nextRotationDate.getDate() + 7);
  nextRotationDate.setHours(record.rotationHour, 0, 0, 0);

  const msUntil = Math.max(0, nextRotationDate.getTime() - targetDate.getTime());
  const daysUntil = Math.floor(msUntil / (24 * 60 * 60 * 1000));
  const hoursUntil = Math.floor((msUntil % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  const nextRotationFormatted = nextRotationDate.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    mode: record.mode,
    morningSupervisor,
    nightSupervisor,
    activeShift,
    activeOnDutySupervisor,
    upcomingShift,
    upcomingSupervisor,
    upcomingShiftStartsAt,
    currentWeekStartDate,
    nextRotationDate: nextRotationDate.toISOString(),
    nextRotationFormatted,
    daysUntilNextRotation: daysUntil,
    hoursUntilNextRotation: hoursUntil,
    isSwappedFromBase: isSwapped,
    notes: record.notes,
  };
}

/**
 * Generates an upcoming weekly projection schedule for the next N weeks.
 */
export async function getUpcomingRotationSchedule(
  weeksCount = 6
): Promise<UpcomingWeekSchedule[]> {
  const record = await getSupervisorRotationRecord();
  const schedule: UpcomingWeekSchedule[] = [];

  const currentMonday = getStartOfWeek(new Date(), record.rotationDayOfWeek);

  for (let w = 0; w < weeksCount; w++) {
    const weekMon = new Date(currentMonday);
    weekMon.setDate(weekMon.getDate() + w * 7);
    weekMon.setHours(12, 0, 0, 0); // Midday of week start

    const weekSun = new Date(weekMon);
    weekSun.setDate(weekSun.getDate() + 6);

    const resolution = await resolveCurrentShiftSupervisors(weekMon);

    const formatOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const rangeFormatted = `Mon, ${weekMon.toLocaleDateString("en-NG", formatOpts)} – Sun, ${weekSun.toLocaleDateString("en-NG", formatOpts)}`;

    schedule.push({
      weekIndex: w,
      isCurrentWeek: w === 0,
      weekStartDate: weekMon.toISOString().split("T")[0],
      weekEndDate: weekSun.toISOString().split("T")[0],
      weekRangeFormatted: rangeFormatted,
      morningSupervisor: resolution.morningSupervisor,
      nightSupervisor: resolution.nightSupervisor,
    });
  }

  return schedule;
}

/**
 * Instantly swaps Morning and Night supervisor assignments.
 */
export async function swapSupervisorShifts(
  updatedBy = "System Admin"
): Promise<SupervisorRotationRecord> {
  const current = await getSupervisorRotationRecord();
  const now = new Date();

  let updatedRecord: Partial<SupervisorRotationRecord>;

  if (current.mode === "MANUAL_OVERRIDE") {
    // Invert manual assignments
    const currentMId = current.manualMorningSupervisorId || current.baseMorningSupervisorId;
    const currentMName = current.manualMorningSupervisorName || current.baseMorningSupervisorName;
    const currentNId = current.manualNightSupervisorId || current.baseNightSupervisorId;
    const currentNName = current.manualNightSupervisorName || current.baseNightSupervisorName;

    updatedRecord = {
      manualMorningSupervisorId: currentNId,
      manualMorningSupervisorName: currentNName,
      manualNightSupervisorId: currentMId,
      manualNightSupervisorName: currentMName,
      lastSwappedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      updatedBy,
    };
  } else {
    // Invert base rotation sequence so parity flips going forward
    updatedRecord = {
      baseMorningSupervisorId: current.baseNightSupervisorId,
      baseMorningSupervisorName: current.baseNightSupervisorName,
      baseNightSupervisorId: current.baseMorningSupervisorId,
      baseNightSupervisorName: current.baseMorningSupervisorName,
      lastSwappedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      updatedBy,
    };
  }

  if (db) {
    try {
      await db
        .update(schema.supervisorShiftRotations)
        .set({
          ...updatedRecord,
          lastSwappedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.supervisorShiftRotations.id, "default"));
    } catch (err) {
      console.error("DB error in swapSupervisorShifts:", err);
    }
  }

  MEMORY_ROTATION = {
    ...current,
    ...updatedRecord,
  } as SupervisorRotationRecord;

  // Publish event bus audit event
  await eventBus.publish(
    "SUPERVISOR_ROTATION_UPDATED",
    {
      action: "SWAP_SHIFTS",
      updatedRecord: MEMORY_ROTATION,
    },
    updatedBy,
    "PRODUCTION"
  );

  return MEMORY_ROTATION;
}

/**
 * Updates rotation mode, supervisor IDs, or rotation frequency settings.
 */
export async function updateSupervisorRotationConfig(
  params: {
    mode?: "AUTO_WEEKLY" | "MANUAL_OVERRIDE";
    morningSupervisorId?: string;
    morningSupervisorName?: string;
    nightSupervisorId?: string;
    nightSupervisorName?: string;
    rotationDayOfWeek?: number;
    rotationHour?: number;
    notes?: string;
  },
  updatedBy = "System Admin"
): Promise<SupervisorRotationRecord> {
  const current = await getSupervisorRotationRecord();
  const now = new Date();

  const updates: any = {
    updatedAt: now,
    updatedBy,
  };

  if (params.mode) updates.mode = params.mode;
  if (params.rotationDayOfWeek !== undefined) updates.rotationDayOfWeek = params.rotationDayOfWeek;
  if (params.rotationHour !== undefined) updates.rotationHour = params.rotationHour;
  if (params.notes !== undefined) updates.notes = params.notes;

  if (params.mode === "MANUAL_OVERRIDE") {
    if (params.morningSupervisorId) updates.manualMorningSupervisorId = params.morningSupervisorId;
    if (params.morningSupervisorName) updates.manualMorningSupervisorName = params.morningSupervisorName;
    if (params.nightSupervisorId) updates.manualNightSupervisorId = params.nightSupervisorId;
    if (params.nightSupervisorName) updates.manualNightSupervisorName = params.nightSupervisorName;
  } else if (params.mode === "AUTO_WEEKLY") {
    if (params.morningSupervisorId) updates.baseMorningSupervisorId = params.morningSupervisorId;
    if (params.morningSupervisorName) updates.baseMorningSupervisorName = params.morningSupervisorName;
    if (params.nightSupervisorId) updates.baseNightSupervisorId = params.nightSupervisorId;
    if (params.nightSupervisorName) updates.baseNightSupervisorName = params.nightSupervisorName;
  }

  if (db) {
    try {
      await db
        .update(schema.supervisorShiftRotations)
        .set(updates)
        .where(eq(schema.supervisorShiftRotations.id, "default"));
    } catch (err) {
      console.error("DB error in updateSupervisorRotationConfig:", err);
    }
  }

  MEMORY_ROTATION = {
    ...current,
    ...updates,
    updatedAt: now.toISOString(),
  };

  await eventBus.publish(
    "SUPERVISOR_ROTATION_UPDATED",
    {
      action: "UPDATE_CONFIG",
      updatedRecord: MEMORY_ROTATION,
    },
    updatedBy,
    "PRODUCTION"
  );

  return MEMORY_ROTATION;
}
