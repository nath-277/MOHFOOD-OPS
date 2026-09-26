import { describe, it, expect } from "bun:test";
import { getUserNotificationState, updateUserNotificationState } from "./store";

describe("User Notification State Persistence & Anti-Spam", () => {
  const testUserKey = `test-user-${Date.now()}`;

  it("returns empty arrays for a new user", async () => {
    const state = await getUserNotificationState(testUserKey);
    expect(state).toBeDefined();
    expect(Array.isArray(state.readIds)).toBe(true);
    expect(Array.isArray(state.dismissedIds)).toBe(true);
  });

  it("marks a notification as read and persists it", async () => {
    const notifId = "stock-alert-item-123";
    const state = await updateUserNotificationState(testUserKey, { markReadId: notifId });
    expect(state.readIds).toContain(notifId);

    const reloaded = await getUserNotificationState(testUserKey);
    expect(reloaded.readIds).toContain(notifId);
  });

  it("dismisses a notification and persists it", async () => {
    const dismissId = "batch-BATCH-2026-001";
    const state = await updateUserNotificationState(testUserKey, { dismissId });
    expect(state.dismissedIds).toContain(dismissId);

    const reloaded = await getUserNotificationState(testUserKey);
    expect(reloaded.dismissedIds).toContain(dismissId);
  });

  it("clears multiple dismissed IDs at once", async () => {
    const ids = ["stock-alert-item-1", "stock-alert-item-2", "tx-999"];
    const state = await updateUserNotificationState(testUserKey, { clearAllDismissedIds: ids });
    for (const id of ids) {
      expect(state.dismissedIds).toContain(id);
    }
  });

  it("resets dismissed IDs when restore is triggered", async () => {
    const state = await updateUserNotificationState(testUserKey, { resetDismissed: true });
    expect(state.dismissedIds.length).toBe(0);

    const reloaded = await getUserNotificationState(testUserKey);
    expect(reloaded.dismissedIds.length).toBe(0);
  });
});
