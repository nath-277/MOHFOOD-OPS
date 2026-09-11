/**
 * Moh Foods NG - Web Push Notifications & Audio Chime Utility
 * Handles Web Notification API permissions, Service Worker registration integration,
 * synthesized Web Audio chimes, and operational alert dispatching.
 */

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export interface PushNotificationOptions {
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  silent?: boolean;
}

/**
 * Check if the current browser environment supports the Web Notification API.
 */
export function isNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window;
}

/**
 * Get the current notification permission state.
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Request notification permission from the user.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return "unsupported";

  try {
    const permission = await Notification.requestPermission();
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("moh_push_permission_status", permission);
      } catch {}
    }
    return permission;
  } catch (err) {
    console.warn("[MOH-OPS Push] Permission request failed:", err);
    return getNotificationPermission();
  }
}

/**
 * Synthesize a soft, clean two-tone operational chime using the Web Audio API.
 * 100% self-contained, works completely offline without loading any external MP3 files.
 */
export function playNotificationChime(): void {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: A5 (880.00 Hz) — harmonic chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880.0, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.14, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.48);

    // Close audio context after playback completes to free resources
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 600);
  } catch {
    // Audio synthesis fallback (silent)
  }
}

/**
 * Dispatch an operational push notification to the user.
 * Tries Service Worker showNotification first, then falls back to new Notification().
 */
export async function sendPushNotification(
  title: string,
  options: PushNotificationOptions = {}
): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const {
    body = "Operational update requires your attention.",
    url = "/notifications",
    tag,
    icon = "/icon-192.png",
    badge = "/icon-192.png",
    silent = false,
  } = options;

  // Play auditory chime unless explicitly muted
  if (!silent) {
    playNotificationChime();
  }

  // 1. Try displaying via Service Worker registration
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, {
          body,
          icon,
          badge,
          tag: tag || `moh-ops-${Date.now()}`,
          data: { url },
          vibrate: [200, 100, 200],
        } as any);
        return true;
      }
    } catch (err) {
      console.warn("[MOH-OPS Push] Service worker notification failed, trying fallback:", err);
    }
  }

  // 2. Fallback to Window Notification instance
  try {
    const notif = new Notification(title, {
      body,
      icon,
      tag: tag || `moh-ops-${Date.now()}`,
    });

    notif.onclick = () => {
      try {
        window.focus();
        if (url && window.location.pathname !== url) {
          window.location.href = url;
        }
      } catch {}
      notif.close();
    };

    return true;
  } catch (err) {
    console.warn("[MOH-OPS Push] Window Notification fallback failed:", err);
    return false;
  }
}

/**
 * Sends a low stock alert push notification, with 30-minute cooldown per item to avoid alert fatigue.
 */
export async function notifyLowStockAlert(
  itemId: string,
  itemName: string,
  currentStock: number,
  uom: string,
  minThreshold: number
): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const storageKey = `moh_pushed_low_stock_${itemId}`;
  const lastPushed = localStorage.getItem(storageKey);
  const now = Date.now();

  // If pushed within last 30 minutes, skip
  if (lastPushed && now - Number(lastPushed) < 30 * 60 * 1000) {
    return false;
  }

  const sent = await sendPushNotification(`⚠️ Critical Stock Alert: ${itemName}`, {
    body: `${itemName} stock is at ${currentStock} ${uom}, breaching minimum safety buffer of ${minThreshold} ${uom}. Replenishment recommended.`,
    url: "/inventory",
    tag: `stock-${itemId}`,
  });

  if (sent) {
    try {
      localStorage.setItem(storageKey, String(now));
    } catch {}
  }

  return sent;
}

/**
 * Sends an intake notification when raw goods arrive at the factory.
 */
export async function notifyInboundIntake(
  itemName: string,
  quantity: number | string,
  uom: string,
  supplierName: string
): Promise<boolean> {
  return sendPushNotification("📦 Inbound Goods Received", {
    body: `${quantity} ${uom} of ${itemName} received from ${supplierName}. Intake ledger updated.`,
    url: "/inventory",
    tag: `intake-${Date.now()}`,
  });
}
