import type { Doc, Settings } from "./types";

export function defaultSettings(): Settings {
  let tz = "UTC";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {}
  return {
    remindersOn: true,
    intervalMin: 60,
    startHour: 9,
    endHour: 18,
    days: [1, 2, 3, 4, 5],
    dailyGoal: 3,
    sound: true,
    ambient: true,
    voice: true,
    defaultRoutine: "quickie",
    level: 2,
    theme: "system",
    tz,
    stretchOn: true,
    stretchMin: 60,
    eyeOn: false,
    eyeMin: 20,
    standDeskOn: false,
    standDeskMin: 45,
    reminderSound: true,
    snoozeMin: 15,
    awayBreakMin: 3,
    sitTrackOn: true,
    areas: [],
    showAll: false,
    painCheckOn: true,
    painCheckDays: 1,
    weeklyOn: true,
    skip: [],
    seatedOnly: false,
    planOn: false,
    planPerWeek: 5,
    quietCalls: true,
    phoneCheckMin: 0,
    updatedAt: 0,
  };
}

export function emptyDoc(): Doc {
  return { settings: defaultSettings(), sessions: [], checkins: [], tests: [], guard: [], custom: [] };
}

/** Union by id. Records that carry `updatedAt` keep the newest copy; others: b wins. */
function unionById<T extends { id: string; updatedAt?: number }>(a: T[] = [], b: T[] = [], key: (x: T) => number | string): T[] {
  const map = new Map<string, T>();
  for (const x of a) map.set(x.id, x);
  for (const x of b) {
    const cur = map.get(x.id);
    if (cur && cur.updatedAt != null && x.updatedAt != null && cur.updatedAt > x.updatedAt) continue;
    map.set(x.id, x);
  }
  return [...map.values()].sort((x, y) => {
    const kx = key(x);
    const ky = key(y);
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
}

/** Merge two copies of the data. Logs are append-only (union); settings: newest wins. */
export function mergeDocs(a: Doc | null | undefined, b: Doc | null | undefined): Doc {
  if (!a) return normalize(b);
  if (!b) return normalize(a);
  const settings =
    (b.settings?.updatedAt ?? 0) >= (a.settings?.updatedAt ?? 0) ? b.settings : a.settings;
  return normalize({
    settings,
    sessions: unionById(a.sessions, b.sessions, (x) => x.startedAt),
    checkins: unionById(a.checkins, b.checkins, (x) => x.at),
    tests: unionById(a.tests, b.tests, (x) => x.at),
    guard: unionById(a.guard, b.guard, (x) => x.day),
    custom: unionById(
      (a.custom ?? []).map((r) => ({ ...r, updatedAt: r.updatedAt ?? 0 })),
      (b.custom ?? []).map((r) => ({ ...r, updatedAt: r.updatedAt ?? 0 })),
      (x) => x.updatedAt ?? 0,
    ),
  });
}

export function normalize(d: Partial<Doc> | null | undefined): Doc {
  const e = emptyDoc();
  return {
    settings: { ...e.settings, ...(d?.settings ?? {}) },
    sessions: Array.isArray(d?.sessions) ? d!.sessions : [],
    checkins: Array.isArray(d?.checkins) ? d!.checkins : [],
    tests: Array.isArray(d?.tests) ? d!.tests : [],
    guard: Array.isArray(d?.guard) ? d!.guard : [],
    custom: Array.isArray(d?.custom) ? d!.custom : [],
  };
}
