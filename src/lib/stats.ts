import type { Doc } from "./types";
import { dayKey } from "./schedule";

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function countsByDay(doc: Doc): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of doc.sessions) {
    if (!s.completed) continue;
    map.set(s.day, (map.get(s.day) ?? 0) + 1);
  }
  return map;
}

export function secondsByDay(doc: Doc): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of doc.sessions) map.set(s.day, (map.get(s.day) ?? 0) + s.durationSec);
  return map;
}

/**
 * Streak = consecutive scheduled days with at least one completed session.
 * Unscheduled days (e.g. weekends) never break a streak, but count if you practise.
 * Today doesn't break the streak until it's over.
 */
export function currentStreak(doc: Doc, today: string): number {
  const counts = countsByDay(doc);
  const days = doc.settings.days;
  let streak = 0;
  let d = today;
  for (let i = 0; i < 3000; i++) {
    const c = counts.get(d) ?? 0;
    if (c > 0) streak++;
    else if (d === today) {
      /* still time today */
    } else if (!days.includes(weekdayOf(d))) {
      /* rest day */
    } else break;
    d = addDays(d, -1);
    if (doc.sessions.length && d < doc.sessions[0].day) break;
  }
  return streak;
}

export function bestStreak(doc: Doc, today: string): number {
  const counts = countsByDay(doc);
  if (!doc.sessions.length) return 0;
  const days = doc.settings.days;
  let best = 0;
  let run = 0;
  for (let d = doc.sessions[0].day; d <= today; d = addDays(d, 1)) {
    const c = counts.get(d) ?? 0;
    if (c > 0) run++;
    else if (d === today || !days.includes(weekdayOf(d))) {
      /* neutral */
    } else run = 0;
    best = Math.max(best, run);
  }
  return best;
}

export const LEVELS: { xp: number; name: string }[] = [
  { xp: 0, name: "Tech Neck" },
  { xp: 60, name: "Screen Slouch" },
  { xp: 160, name: "Desk Survivor" },
  { xp: 320, name: "Chin Tucker" },
  { xp: 550, name: "Shoulder Setter" },
  { xp: 850, name: "Upright Rookie" },
  { xp: 1250, name: "Aligned" },
  { xp: 1800, name: "Posture Pro" },
  { xp: 2500, name: "Spine Sage" },
  { xp: 3400, name: "Statue Mode" },
  { xp: 4600, name: "Upright Legend" },
];

export function totalXp(doc: Doc): number {
  let xp = 0;
  for (const s of doc.sessions) {
    if (!s.completed) continue;
    xp += 10 + Math.round(s.durationSec / 60) * 2;
  }
  const counts = countsByDay(doc);
  for (const c of counts.values()) if (c >= doc.settings.dailyGoal) xp += 15;
  xp += doc.checkins.length * 2 + doc.tests.length * 10;
  return xp;
}

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1];
  const progress = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { index: i + 1, name: cur.name, next, progress, xp };
}

/** Share of daily goal hit across the last N scheduled days (excluding today). 0..1 */
export function consistency(doc: Doc, today: string, n = 14): number {
  const counts = countsByDay(doc);
  const goal = Math.max(1, doc.settings.dailyGoal);
  let total = 0;
  let seen = 0;
  let d = addDays(today, -1);
  for (let i = 0; i < 60 && seen < n; i++, d = addDays(d, -1)) {
    if (!doc.settings.days.includes(weekdayOf(d))) continue;
    seen++;
    total += Math.min(1, (counts.get(d) ?? 0) / goal);
  }
  // Include today's progress only if it helps (so a fresh user isn't at 0 forever)
  const todayShare = Math.min(1, (counts.get(today) ?? 0) / goal);
  if (seen === 0) return todayShare;
  return Math.max(total / seen, (total + todayShare) / (seen + 1));
}

/** 0-100 score that rewards consistency first, streak second. */
export function postureScore(doc: Doc, today: string): number {
  const c = consistency(doc, today);
  const s = Math.min(currentStreak(doc, today), 21) / 21;
  return Math.round(100 * (0.75 * c + 0.25 * s));
}

export interface WeekPoint {
  start: string;
  sessions: number;
  minutes: number;
  stiffness: number | null;
}

export function weekly(doc: Doc, today: string, weeks = 8): WeekPoint[] {
  // weeks start Monday
  const wd = weekdayOf(today);
  const monday = addDays(today, -((wd + 6) % 7));
  const out: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(monday, -7 * w);
    const end = addDays(start, 7);
    const ss = doc.sessions.filter((s) => s.completed && s.day >= start && s.day < end);
    const cs = doc.checkins.filter((c) => c.day >= start && c.day < end);
    out.push({
      start,
      sessions: ss.length,
      minutes: Math.round(ss.reduce((a, s) => a + s.durationSec, 0) / 60),
      stiffness: cs.length ? cs.reduce((a, c) => a + c.stiffness, 0) / cs.length : null,
    });
  }
  return out;
}

export function todayKey(doc: Doc): string {
  return dayKey(Date.now(), doc.settings.tz);
}
