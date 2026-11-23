import type { Settings } from "./types";

export interface LocalParts {
  day: string; // YYYY-MM-DD
  hour: number;
  minute: number;
  weekday: number; // 0 = Sun
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(ts: number, tz?: string): LocalParts {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
  }
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ts))) parts[p.type] = p.value;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WD[parts.weekday] ?? 0,
  };
}

export function dayKey(ts: number, tz?: string): string {
  return localParts(ts, tz).day;
}

export interface ReminderState {
  lastSessionAt?: number;
  lastReminderAt?: number;
  snoozeUntil?: number;
}

/** Inside the user's active reminder window (day + hours)? */
export function inActiveWindow(s: Settings, now: number): boolean {
  const p = localParts(now, s.tz);
  if (!s.days.includes(p.weekday)) return false;
  const m = p.hour * 60 + p.minute;
  return m >= s.startHour * 60 && m < s.endHour * 60;
}

/**
 * Should a "time for your neck break" reminder fire right now?
 * Used identically by the in-app timer and the server push ticker.
 */
export function isReminderDue(s: Settings, st: ReminderState, now: number): boolean {
  if (!s.remindersOn) return false;
  if (!inActiveWindow(s, now)) return false;
  if (st.snoozeUntil && now < st.snoozeUntil) return false;

  const p = localParts(now, s.tz);
  const minutesIntoWindow = p.hour * 60 + p.minute - s.startHour * 60;
  const windowStart = now - minutesIntoWindow * 60_000;
  const anchor = Math.max(st.lastSessionAt || 0, st.lastReminderAt || 0, windowStart);

  // A snooze that just expired fires immediately.
  if (st.snoozeUntil && st.snoozeUntil > anchor && st.snoozeUntil <= now) return true;

  const toleranceMs = 2 * 60_000; // ticker runs every few minutes
  return now - anchor >= s.intervalMin * 60_000 - toleranceMs;
}

/** When will the next reminder roughly be (for display)? */
export function nextReminderAt(s: Settings, st: ReminderState, now: number): number | null {
  if (!s.remindersOn || s.days.length === 0) return null;
  // Walk forward in 5-minute steps for up to 8 days.
  const step = 5 * 60_000;
  for (let t = now; t < now + 8 * 86_400_000; t += step) {
    if (isReminderDue(s, st, t)) return t;
  }
  return null;
}

/* ---------------- the other reminders (quick stretch, eye breaks, standing desk) ---------------- */

export interface IntervalReminder {
  on: boolean;
  everyMin: number;
  /** times that count as "just did it" (last done, last reminded, last away-from-desk break) */
  last: (number | undefined)[];
  snoozeUntil?: number;
}

/** Same rules as the neck-break reminder: only on your days and hours, after a snooze, every N minutes since the last one. */
export function intervalDue(s: Settings, r: IntervalReminder, now: number): boolean {
  if (!r.on || r.everyMin <= 0) return false;
  if (!inActiveWindow(s, now)) return false;
  if (r.snoozeUntil && now < r.snoozeUntil) return false;
  const p = localParts(now, s.tz);
  const windowStart = now - (p.hour * 60 + p.minute - s.startHour * 60) * 60_000;
  const anchor = Math.max(windowStart, ...r.last.map((x) => x || 0));
  if (r.snoozeUntil && r.snoozeUntil > anchor && r.snoozeUntil <= now) return true;
  return now - anchor >= r.everyMin * 60_000 - 30_000;
}

export function nextIntervalAt(s: Settings, r: IntervalReminder, now: number): number | null {
  if (!r.on || s.days.length === 0) return null;
  const step = 60_000;
  for (let t = now; t < now + 8 * 86_400_000; t += t - now < 6 * 3600_000 ? step : 5 * step) {
    if (intervalDue(s, r, t)) return t;
  }
  return null;
}
