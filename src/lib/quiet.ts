"use client";

/**
 * Quiet times: no reminders and no posture pop-ups while you're
 *  - on a call (another app is using your camera or microphone), presenting, or in a full-screen
 *    app (the desktop app can tell; Settings → "Stay quiet during calls and presentations")
 *  - or you've tapped "Quiet for 1 hour" (any device).
 * Posture is still measured; you just aren't interrupted. Reminders that came due wait until after.
 */
import { getDoc, getMeta, setMeta } from "./store";
import { onBus, post } from "./bus";

let busy: { on: boolean; why: string; at: number } = { on: false, why: "", at: 0 };
const listeners = new Set<() => void>();

/** What the desktop app sees (called by the window that checks, shared with the others). */
export function setBusy(on: boolean, why = "", share = true) {
  const changed = on !== busy.on || why !== busy.why;
  busy = { on, why, at: Date.now() };
  if (share) post({ t: "busy", on, why });
  if (changed) listeners.forEach((l) => l());
}

let listening = false;
function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  onBus((m) => {
    if (m.t === "busy") setBusy(m.on, m.why, false);
  });
}

/** Why it's quiet right now (or null if it isn't). */
export function quietReason(now = Date.now()): string | null {
  listen();
  const m = getMeta();
  if (m.quietUntil && m.quietUntil > now) return "you asked for quiet";
  // news older than a minute is stale (the checking window closed)
  if (busy.on && now - busy.at < 60_000 && getDoc().settings.quietCalls) return busy.why || "you're busy";
  return null;
}

export function quietFor(minutes: number | null) {
  setMeta({ quietUntil: minutes ? Date.now() + minutes * 60_000 : undefined });
}

export function onQuietChange(l: () => void) {
  listen();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
