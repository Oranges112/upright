"use client";

/**
 * A message line between every open Upright window on this computer: the desktop dot, the
 * desktop app window, and browser tabs. They use it to share one Posture Guard (only one window
 * runs the camera; the others show what it sees and can control it) and to show reminders
 * everywhere at once.
 */

export type BusMsg =
  | { t: "guard:state"; from: string; host: "widget" | "page"; state: unknown }
  | { t: "guard:hello"; from: string }
  | { t: "guard:cmd"; from: string; to: string; cmd: string; arg?: number | boolean }
  | { t: "due"; from: string; kind: string }
  | { t: "done"; from: string; kind: string };

type Payload<M> = M extends unknown ? Omit<M, "from"> : never;

export const pageId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);

let ch: BroadcastChannel | null = null;
const handlers = new Set<(m: BusMsg) => void>();

function channel() {
  if (ch || typeof window === "undefined" || typeof BroadcastChannel === "undefined") return ch;
  ch = new BroadcastChannel("upright");
  ch.onmessage = (e) => {
    const m = e.data as BusMsg;
    if (!m || typeof m !== "object" || m.from === pageId) return;
    handlers.forEach((h) => h(m));
  };
  return ch;
}

export function post(m: Payload<BusMsg>) {
  try {
    channel()?.postMessage({ ...m, from: pageId });
  } catch {}
}

export function onBus(h: (m: BusMsg) => void) {
  channel();
  handlers.add(h);
  return () => {
    handlers.delete(h);
  };
}
