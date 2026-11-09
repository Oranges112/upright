import { describe, expect, it } from "vitest";
import { addDays, bestStreak, currentStreak, levelFor, totalXp } from "@/lib/stats";
import { emptyDoc, mergeDocs } from "@/lib/merge";
import type { Doc } from "@/lib/types";

const session = (day: string, completed = true) => ({
  id: `${day}-${Math.random()}`,
  routineId: "quickie",
  startedAt: Date.parse(`${day}T10:00:00Z`),
  day,
  durationSec: 140,
  completed,
});

function docWith(days: string[], workdays = [0, 1, 2, 3, 4, 5, 6]): Doc {
  const d = emptyDoc();
  d.settings.days = workdays;
  d.sessions = days.map((x) => session(x));
  return d;
}

describe("dates", () => {
  it("adds days across month ends", () => {
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak(docWith(["2025-11-08", "2025-11-09", "2025-11-10"]), "2025-11-10")).toBe(3);
  });
  it("doesn't break just because today isn't done yet", () => {
    expect(currentStreak(docWith(["2025-11-08", "2025-11-09"]), "2025-11-10")).toBe(2);
  });
  it("breaks on a missed working day", () => {
    expect(currentStreak(docWith(["2025-11-06", "2025-11-08", "2025-11-09"]), "2025-11-09")).toBe(2);
  });
  it("skips days that aren't reminder days (weekends off)", () => {
    // Fri 7, (Sat 8, Sun 9 off), Mon 10
    expect(currentStreak(docWith(["2025-11-07", "2025-11-10"], [1, 2, 3, 4, 5]), "2025-11-10")).toBe(2);
  });
  it("tracks the best streak", () => {
    const d = docWith(["2025-11-01", "2025-11-02", "2025-11-03", "2025-11-04", "2025-11-08"]);
    expect(bestStreak(d, "2025-11-08")).toBeGreaterThanOrEqual(4);
  });
});

describe("XP and levels", () => {
  it("only completed sessions earn XP, and levels go up with XP", () => {
    const d = docWith(["2025-11-08"]);
    const before = totalXp(d);
    d.sessions.push(session("2025-11-09", false));
    expect(totalXp(d)).toBe(before);
    expect(levelFor(100_000).index).toBeGreaterThan(levelFor(0).index);
  });
});

describe("sync merge", () => {
  it("keeps sessions from both devices without duplicates", () => {
    const a = docWith(["2025-11-08"]);
    const b = docWith(["2025-11-09"]);
    b.sessions.push(a.sessions[0]);
    const m = mergeDocs(a, b);
    expect(m.sessions.length).toBe(2);
  });
  it("newest settings win", () => {
    const a = emptyDoc();
    const b = emptyDoc();
    a.settings = { ...a.settings, intervalMin: 30, updatedAt: 1 };
    b.settings = { ...b.settings, intervalMin: 90, updatedAt: 2 };
    expect(mergeDocs(a, b).settings.intervalMin).toBe(90);
    expect(mergeDocs(b, a).settings.intervalMin).toBe(90);
  });
});
