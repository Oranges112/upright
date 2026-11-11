"use client";

import { guard } from "./guard";

/**
 * Rolling "how upright have I been lately" figure for the posture widget.
 * Posture Guard time is kept in 5-minute buckets for the last 12 hours (on this device only),
 * so the widget can say e.g. "84% upright over the last 3 hours".
 */

const KEY = "upright:guard-recent";
const SHOWN_KEY = "upright:recent-shown";
const BUCKET = 5 * 60_000;
const KEEP = 12 * 3600_000;
/** Only show the figure once there's at least this much tracked time in the window... */
export const MIN_TRACKED_SEC = 30 * 60;
/** ...and at most once an hour. */
export const SHOW_EVERY = 3600_000;

export interface Bucket {
  t: number; // bucket start (ms)
  g: number; // good seconds
  a: number; // all tracked seconds
}

function load(): Bucket[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

let buckets: Bucket[] = [];
let started = false;
let last = { good: 0, total: 0 };
let lastSave = 0;

function save(now: number) {
  buckets = buckets.filter((b) => b.t > now - KEEP - BUCKET);
  try {
    localStorage.setItem(KEY, JSON.stringify(buckets));
  } catch {}
  lastSave = now;
}

/** Add tracked seconds at time `now` (exported for tests). */
export function addTo(list: Bucket[], now: number, good: number, total: number): Bucket[] {
  const t = Math.floor(now / BUCKET) * BUCKET;
  const lastB = list[list.length - 1];
  if (lastB && lastB.t === t) {
    lastB.g += good;
    lastB.a += total;
  } else list.push({ t, g: good, a: total });
  return list;
}

/** Start recording (safe to call more than once). */
export function trackRecent() {
  if (started || typeof window === "undefined") return;
  started = true;
  buckets = load();
  guard.subscribe(() => {
    const s = guard.getState();
    // sessionGood/Total restart from 0 when Guard restarts
    const dg = s.sessionGood >= last.good ? s.sessionGood - last.good : s.sessionGood;
    const dt = s.sessionTotal >= last.total ? s.sessionTotal - last.total : s.sessionTotal;
    last = { good: s.sessionGood, total: s.sessionTotal };
    if (dt <= 0 || dt > 60) return;
    const now = Date.now();
    addTo(buckets, now, Math.max(0, dg), dt);
    if (now - lastSave > 30_000) save(now);
  });
  window.addEventListener("pagehide", () => save(Date.now()));
}

/** Upright % over the last 12 hours, counting only time Guard actually saw you, and how many hours that was. */
export function summarize(list: Bucket[], now: number): { pct: number; hours: number; tracked: number } | null {
  const inWin = list.filter((b) => b.t > now - KEEP);
  const tracked = inWin.reduce((a, b) => a + b.a, 0);
  if (!inWin.length || tracked < MIN_TRACKED_SEC) return null;
  const good = inWin.reduce((a, b) => a + b.g, 0);
  // hours you were actually at the screen (time away isn't counted at all)
  const hours = Math.min(12, Math.max(1, Math.round(tracked / 3600)));
  return { pct: Math.round((good / tracked) * 100), hours, tracked };
}

export function recentSummary() {
  return summarize(buckets, Date.now());
}

/** True (and remembered) if the figure may be shown now: at most once an hour. */
export function claimRecentSlot(now = Date.now()): boolean {
  try {
    const lastShown = Number(localStorage.getItem(SHOWN_KEY) ?? 0);
    if (now - lastShown < SHOW_EVERY) return false;
    localStorage.setItem(SHOWN_KEY, String(now));
  } catch {}
  return true;
}

export function recentLabel(s: { pct: number; hours: number }) {
  // short enough to fit the pill; the hours only count time you were at the screen
  return `${s.pct}% upright, last ${s.hours === 1 ? "hour" : `${s.hours} hrs`}`;
}
