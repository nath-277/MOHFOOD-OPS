export interface AccountNotificationState {
  readIds: string[];
  dismissedIds: string[];
}

export async function fetchAccountNotificationState(): Promise<AccountNotificationState> {
  try {
    const res = await fetch("/api/notifications/state");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.state) {
        localStorage.setItem("moh_read_notifications", JSON.stringify(data.state.readIds || []));
        localStorage.setItem("moh_dismissed_notifications", JSON.stringify(data.state.dismissedIds || []));
        return data.state;
      }
    }
  } catch {
    // Offline / fallback to local storage
  }
  const readIds = JSON.parse(localStorage.getItem("moh_read_notifications") || "[]");
  const dismissedIds = JSON.parse(localStorage.getItem("moh_dismissed_notifications") || "[]");
  return { readIds, dismissedIds };
}

export async function syncNotificationAction(action: {
  markReadId?: string;
  markAllReadIds?: string[];
  dismissId?: string;
  clearAllDismissedIds?: string[];
}) {
  try {
    await fetch("/api/notifications/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
  } catch {
    // Offline fallback - optimistic update already performed locally
  }
}
