import fs from "fs";
import path from "path";

export interface UserNotificationState {
  readIds: string[];
  dismissedIds: string[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "notification_state.json");

let notificationCache: Record<string, UserNotificationState> = {};
let loaded = false;

function loadState() {
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

function saveState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(notificationCache, null, 2), "utf-8");
  } catch (e) {
    console.warn("Failed to persist notification state to file:", e);
  }
}

export function getUserNotificationState(userKey: string): UserNotificationState {
  loadState();
  return notificationCache[userKey] || { readIds: [], dismissedIds: [] };
}

export function updateUserNotificationState(
  userKey: string,
  update: {
    markReadId?: string;
    markAllReadIds?: string[];
    dismissId?: string;
    clearAllDismissedIds?: string[];
  }
): UserNotificationState {
  loadState();
  const current = notificationCache[userKey] || { readIds: [], dismissedIds: [] };
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

  const newState: UserNotificationState = {
    readIds: Array.from(readSet),
    dismissedIds: Array.from(dismissedSet),
  };

  notificationCache[userKey] = newState;
  saveState();
  return newState;
}
