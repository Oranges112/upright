"use client";

import { apiBase, asset } from "./base";
import { appBridge, desktopBridge } from "./desktop";
import { getMeta } from "./store";

/** What a notification is about. Clicking it does the matching thing. */
export type NotifyKind = "guard" | "break" | "stretch" | "eye" | "stand" | "phone" | "test";

export interface NotifyOptions {
  title: string;
  body: string;
  kind: NotifyKind;
  /** routine to open when clicked (reminders) */
  routine?: string;
}

const isElectron = () => typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent);

/** upright:// link that opens the desktop app at the right place */
function desktopLink(o: NotifyOptions) {
  if (o.kind === "break" || o.kind === "stretch") return `upright://start/${encodeURIComponent(o.routine ?? (o.kind === "stretch" ? "stretch" : "default"))}`;
  return "upright://open";
}

/**
 * Show a notification, the best way for wherever Upright is running:
 *  - the desktop app: a native Windows / Mac notification (clicking it opens the app)
 *  - a browser: through the service worker, with Start / Snooze buttons for reminders
 */
export async function notify(o: NotifyOptions): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const bridge = desktopBridge()?.notify ?? appBridge()?.notify;
  if (bridge) {
    bridge({ title: o.title, body: o.body, kind: o.kind, link: desktopLink(o) });
    return true;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const tag = o.kind === "guard" ? "upright-guard" : `upright-${o.kind}`;
  try {
    if (isElectron()) {
      // older desktop app: plain notification; a click opens the app through its upright:// link
      const n = new Notification(o.title, { body: o.body, icon: asset("/icons/192.png"), tag });
      if (o.kind !== "guard") n.onclick = () => window.open(desktopLink(o));
      return true;
    }
    const reg = await navigator.serviceWorker?.getRegistration();
    const reminder = o.kind === "break" || o.kind === "stretch";
    const opts: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean } = {
      body: o.body,
      icon: asset("/icons/192.png"),
      badge: asset("/icons/96.png"),
      tag,
      renotify: true,
      data: {
        kind: o.kind,
        url: reminder ? asset(`/?start=${encodeURIComponent(o.routine ?? (o.kind === "stretch" ? "stretch" : "default"))}`) : asset("/"),
        code: getMeta().code,
        api: apiBase(),
      },
      ...(reminder
        ? {
            actions: [
              { action: "start", title: "▶ Start" },
              { action: "snooze", title: "Snooze" },
            ],
          }
        : {}),
    };
    if (reg) await reg.showNotification(o.title, opts);
    else new Notification(o.title, opts);
    return true;
  } catch {
    return false;
  }
}
