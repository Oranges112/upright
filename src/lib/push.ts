"use client";

import { getMeta, setMeta } from "./store";
import { asset } from "./base";

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(asset("/sw.js"), { scope: asset("/") });
  } catch {
    return null;
  }
}

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function askPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

/** Subscribe this device to background push reminders. */
export async function enablePush(vapidPublicKey: string): Promise<{ ok: boolean; error?: string }> {
  const perm = await askPermission();
  if (perm !== "granted") return { ok: false, error: "Notifications are blocked for this site." };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await registerSW());
  if (!reg || !("pushManager" in reg)) {
    return {
      ok: false,
      error: isIOS() ? "On iPhone, add Upright to your Home Screen first, then enable reminders from the installed app." : "Push isn't supported in this browser.",
    };
  }
  try {
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }
    const code = getMeta().code;
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, subscription: sub.toJSON() }),
    });
    if (!res.ok) return { ok: false, error: "Couldn't register with the server." };
    setMeta({ pushOn: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't subscribe." };
  }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: getMeta().code, endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  setMeta({ pushOn: false });
}

export async function sendTestPush() {
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: getMeta().code }),
  });
  return res.ok;
}

/** Show a notification from the page itself (used when the app is open / no push backend). */
export async function localNotify(title: string, body: string) {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const opts: NotificationOptions & { actions?: { action: string; title: string }[]; renotify?: boolean } = {
    body,
    icon: asset("/icons/192.png"),
    badge: asset("/icons/96.png"),
    tag: "upright-reminder",
    renotify: true,
    data: { url: asset("/?start=default"), code: getMeta().code },
    actions: [
      { action: "start", title: "Start now" },
      { action: "snooze", title: "Snooze 30 min" },
    ],
  };
  if (reg) {
    await reg.showNotification(title, opts);
  } else {
    new Notification(title, opts);
  }
  return true;
}

/** What the server knows about this device's reminders (for the health check). */
export async function pushStatus(): Promise<{ subscribed: boolean; known: boolean; devices: number; lastReminderAt: number | null } | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    const res = await fetch("/api/push/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: getMeta().code, endpoint: sub?.endpoint ?? "" }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return { subscribed: !!sub, ...j };
  } catch {
    return null;
  }
}

/**
 * Self-repair, run each time the app opens: if reminders were switched on here but the phone
 * dropped the subscription (or the server forgot it), quietly sign this device up again.
 */
export async function healPush(vapidPublicKey: string) {
  try {
    if (!getMeta().pushOn || !notificationsSupported() || Notification.permission !== "granted" || !getMeta().code) return;
    await enablePush(vapidPublicKey);
  } catch {}
}
