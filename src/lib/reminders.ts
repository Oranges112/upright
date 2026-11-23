"use client";

/**
 * Every reminder Upright gives (neck breaks, quick stretch, eye breaks, standing desk), run by
 * ONE window on this computer at a time, so you never get the same reminder twice when the
 * desktop dot and the app window (or two browser tabs) are both open.
 *
 * It also notices when you're away from the desk (computer idle or locked, or Posture Guard can't
 * see you): a long enough break counts as your stretch, and your sitting time is counted.
 */

import { addSitTime, getConfig, getDoc, getMeta, lastSessionEnd, setMeta, snooze } from "./store";
import { intervalDue, isReminderDue, type IntervalReminder } from "./schedule";
import { onBus, post } from "./bus";
import { notify } from "./notify";
import { sound } from "./sound";
import { guard } from "./guard";
import { appBridge, desktopBridge } from "./desktop";
import { fmtDuration, getRoutine, routineSeconds } from "./exercises";
import type { Settings } from "./types";
import type { Meta } from "./store";

export type ReminderKind = "break" | "stretch" | "eye" | "stand";

export const REMINDER_TEXT: Record<ReminderKind, { title: string; body: string }> = {
  break: { title: "Time for a neck break 🧘", body: "Sit tall. Two minutes, that's all." },
  stretch: { title: "Quick stretch 🧍", body: "Stand up for a minute: reach up tall, roll your shoulders, shake out your legs." },
  eye: { title: "Eye break 👀", body: "Look at something about 6 metres (20 feet) away for 20 seconds. Blink a few times." },
  stand: { title: "Switch it up 🔁", body: "Time to change position at your standing desk." },
};

export function standText(standingNow: boolean | undefined) {
  return standingNow ? { title: "Time to sit for a bit 🪑", body: "You've been standing a while. Sit down and rest your legs." } : { title: "Time to stand up 🧍", body: "Raise your desk and work standing for a while." };
}

export function stretchReminder(s: Settings, m: Meta): IntervalReminder {
  return { on: s.stretchOn, everyMin: s.stretchMin, last: [m.lastStretchAt, m.lastStretchReminderAt, m.lastAwayBreakAt, lastSessionEnd(getDoc())], snoozeUntil: m.stretchSnoozeUntil };
}
export function eyeReminder(s: Settings, m: Meta): IntervalReminder {
  return { on: s.eyeOn, everyMin: s.eyeMin, last: [m.lastEyeAt, m.lastAwayBreakAt], snoozeUntil: m.eyeSnoozeUntil };
}
export function standReminder(s: Settings, m: Meta): IntervalReminder {
  return { on: s.standDeskOn, everyMin: s.standDeskMin, last: [m.lastStandSwitchAt] };
}

/* ---------------- what the app shows ---------------- */

const dueHandlers = new Set<(kind: ReminderKind | null, done?: ReminderKind) => void>();

/** The app shows a banner for each reminder (in every window). */
export function onReminder(h: (kind: ReminderKind | null, done?: ReminderKind) => void) {
  dueHandlers.add(h);
  return () => {
    dueHandlers.delete(h);
  };
}

/** You did it (or tapped "Done"): the timer starts again, and every window hides its banner. */
export function reminderDone(kind: ReminderKind) {
  const now = Date.now();
  if (kind === "stretch") setMeta({ lastStretchAt: now, stretchSnoozeUntil: undefined });
  if (kind === "eye") setMeta({ lastEyeAt: now, eyeSnoozeUntil: undefined });
  // (stand: the switch was already counted when the reminder fired)
  post({ t: "done", kind });
  dueHandlers.forEach((h) => h(null, kind));
}

export function snoozeReminder(kind: ReminderKind) {
  const min = getDoc().settings.snoozeMin || 15;
  const until = Date.now() + min * 60_000;
  if (kind === "break") void snooze(min);
  if (kind === "stretch") setMeta({ stretchSnoozeUntil: until });
  if (kind === "eye") setMeta({ eyeSnoozeUntil: until });
  if (kind === "stand") setMeta({ lastStandSwitchAt: until - getDoc().settings.standDeskMin * 60_000 });
  post({ t: "done", kind });
  dueHandlers.forEach((h) => h(null, kind));
}

/* ---------------- the clock (in one window only) ---------------- */

let started = false;
let leader = false;

function fire(kind: ReminderKind) {
  const d = getDoc();
  const m = getMeta();
  const s = d.settings;
  if (s.reminderSound) sound.gentle();
  let text = REMINDER_TEXT[kind];
  let routine: string | undefined;
  if (kind === "break") {
    const r = getRoutine(s.defaultRoutine, s);
    routine = r.id;
    text = { title: text.title, body: `${r.name} · ${fmtDuration(routineSeconds(r, s.level))}. Sit tall and let's go.` };
  }
  if (kind === "stand") text = standText(m.standing);
  // background push (set up on a server) already notifies about neck breaks
  const pushed = kind === "break" && getConfig()?.push && m.pushOn;
  if (!pushed) void notify({ title: text.title, body: text.body, kind, routine });
  post({ t: "due", kind });
  dueHandlers.forEach((h) => h(kind));
}

/** How long the computer has been idle, if we can tell (desktop app 1.4+). */
async function idleInfo(): Promise<{ sec: number; locked: boolean } | null> {
  const f = desktopBridge()?.idle ?? appBridge()?.idle;
  if (!f) return null;
  try {
    return await f();
  } catch {
    return null;
  }
}

const TICK = 15;
let awayFor = 0;
let awayCounted = false;
let sitStreak = 0;
let sitPending = 0;
let lastFlush = Date.now();

async function tick() {
  if (!leader) return;
  const now = Date.now();
  const d = getDoc();
  const s = d.settings;
  const m = getMeta();

  // ---- are you at the desk? ----
  const idle = await idleInfo();
  const g = guard.getState();
  const guardOn = g.status !== "off" && g.status !== "error";
  const guardAway = guardOn && g.status === "away";
  const idleAway = !!idle && (idle.locked || idle.sec >= 90);
  const away = idleAway || guardAway;
  const present = !away && ((!!idle && idle.sec < 90) || (guardOn && !g.exercising));

  if (away) {
    awayFor += TICK;
    if (!awayCounted && s.awayBreakMin > 0 && awayFor >= s.awayBreakMin * 60) {
      awayCounted = true;
      sitStreak = 0;
      setMeta({ lastAwayBreakAt: now });
    }
  } else {
    awayFor = 0;
    awayCounted = false;
  }
  if (present) {
    sitStreak += TICK;
    sitPending += TICK;
  }
  if (s.sitTrackOn && (sitPending >= 60 || (sitPending > 0 && now - lastFlush > 120_000))) {
    addSitTime(sitPending, sitStreak);
    sitPending = 0;
    lastFlush = now;
  }

  // ---- reminders (not while you're away: the break is happening anyway) ----
  if (away) return;
  if (isReminderDue(s, { lastSessionAt: lastSessionEnd(d), lastReminderAt: m.lastReminderAt, snoozeUntil: m.snoozeUntil }, now)) {
    setMeta({ lastReminderAt: now, snoozeUntil: undefined });
    fire("break");
    return; // one at a time
  }
  if (intervalDue(s, stretchReminder(s, m), now)) {
    setMeta({ lastStretchReminderAt: now, stretchSnoozeUntil: undefined });
    fire("stretch");
    return;
  }
  if (intervalDue(s, eyeReminder(s, m), now)) {
    setMeta({ lastEyeAt: now, eyeSnoozeUntil: undefined });
    fire("eye");
    return;
  }
  if (intervalDue(s, standReminder(s, m), now)) {
    fire("stand");
    setMeta({ lastStandSwitchAt: now, standing: !m.standing });
  }
}

/** Start the reminder clock. Safe to call from every window: only one runs it. */
export function startReminders() {
  if (started || typeof window === "undefined") return;
  started = true;
  onBus((msg) => {
    if (msg.t === "due") dueHandlers.forEach((h) => h(msg.kind as ReminderKind));
    if (msg.t === "done") dueHandlers.forEach((h) => h(null, msg.kind as ReminderKind));
  });
  const run = () => {
    leader = true;
    // first time: count from now, so a new reminder doesn't fire the moment you open the app
    const m = getMeta();
    const now = Date.now();
    const init: Partial<Meta> = {};
    if (!m.lastStretchReminderAt) init.lastStretchReminderAt = now;
    if (!m.lastEyeAt) init.lastEyeAt = now;
    if (!m.lastStandSwitchAt) init.lastStandSwitchAt = now;
    if (Object.keys(init).length) setMeta(init);
    void tick();
    setInterval(() => void tick(), TICK * 1000);
  };
  const locks = (navigator as Navigator & { locks?: LockManager }).locks;
  if (locks?.request) {
    // held until this window closes; then the next window takes over
    void locks.request("upright-reminders", () => {
      run();
      return new Promise<void>(() => {});
    });
  } else run();
}

/** Is this window the one giving reminders? (for tests / the health check) */
export const isReminderLeader = () => leader;
