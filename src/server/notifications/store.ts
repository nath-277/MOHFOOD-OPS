import fs from "fs";
import path from "path";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

export interface UserNotificationState {
  readIds: string[];
  dismissedIds: string[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "notification_state.json");

let notificationCache: Record<string, UserNotificationState> = {};
let loaded = false;

function loadFileState() {
  if (loaded) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      notificationCache = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Failed to read notification state from file:", e);
  }
  loaded = true;
}

function saveFileState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(notificationCache, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to persist notification state to file:", e);
  }
}

export async function getUserNotificationState(userKey: string): Promise<UserNotificationState> {
  loadFileState();

  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.userNotificationState)
        .where(eq(schema.userNotificationState.userId, userKey))
        .limit(1);

      if (rows.length > 0) {
        const state: UserNotificationState = {
          readIds: (rows[0].readIds as string[]) || [],
          dismissedIds: (rows[0].dismissedIds as string[]) || [],
        };
        notificationCache[userKey] = state;
        return state;
      }
    } catch (e) {
      console.warn("DB lookup for notification state failed, using fallback:", e);
    }
  }

  return notificationCache[userKey] || { readIds: [], dismissedIds: [] };
}

export async function updateUserNotificationState(
  userKey: string,
  update: {
    markReadId?: string;
    markAllReadIds?: string[];
    dismissId?: string;
    clearAllDismissedIds?: string[];
    resetDismissed?: boolean;
  }
): Promise<UserNotificationState> {
  const current = await getUserNotificationState(userKey);
  const readSet = new Set(current.readIds);
  const dismissedSet = new Set(current.dismissedIds);

  if (update.markReadId) {
    readSet.add(update.markReadId);
  }
  if (update.markAllReadIds) {
    update.markAllReadIds.forEach((id) => readSet.add(id));
  }
  if (update.dismissId) {
    dismissedSet.add(update.dismissId);
  }
  if (update.clearAllDismissedIds) {
    update.clearAllDismissedIds.forEach((id) => dismissedSet.add(id));
  }
  if (update.resetDismissed) {
    dismissedSet.clear();
  }

  const newState: UserNotificationState = {
    readIds: Array.from(readSet),
    dismissedIds: Array.from(dismissedSet),
  };

  notificationCache[userKey] = newState;
  saveFileState();

  if (db) {
    try {
      await db
        .insert(schema.userNotificationState)
        .values({
          userId: userKey,
          readIds: newState.readIds,
          dismissedIds: newState.dismissedIds,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.userNotificationState.userId,
          set: {
            readIds: newState.readIds,
            dismissedIds: newState.dismissedIds,
            updatedAt: new Date(),
          },
        });
    } catch (e) {
      console.warn("DB upsert for notification state failed, preserved in cache:", e);
    }
  }

  return newState;
}
