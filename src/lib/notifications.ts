/** Lightweight browser Notification API helpers. Web Push (VAPID/service worker) is not required here. */

export function canNotify() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!canNotify()) return "denied";
  if (Notification.permission === "default") {
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }
  return Notification.permission;
}

export function notify(title: string, options?: NotificationOptions & { onClick?: () => void }) {
  if (!canNotify() || Notification.permission !== "granted") return;
  // Avoid showing notification if the tab is focused.
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { icon: "/favicon.ico", badge: "/favicon.ico", ...options });
    if (options?.onClick) n.onclick = () => { window.focus(); options.onClick?.(); n.close(); };
  } catch { /* noop */ }
}
