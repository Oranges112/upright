import { describe, expect, it } from "vitest";
import { EXERCISES, ROUTINES, buildTimeline, forYou, getRoutine, myMix, resolveSkip, routinesFor } from "../src/lib/exercises";
import { intervalDue } from "../src/lib/schedule";
import { defaultSettings, mergeDocs, emptyDoc } from "../src/lib/merge";
import { COACHING } from "../src/lib/coaching";

describe("body areas", () => {
  it("every exercise has areas, and every full-body one has a pose for each phase", () => {
    for (const ex of Object.values(EXERCISES)) {
      expect(ex.areas?.length, ex.id).toBeGreaterThan(0);
      if (ex.body) for (const ph of ex.cycle) expect(ph.body, `${ex.id} ${ph.label}`).toBeTruthy();
      expect(COACHING[ex.id], ex.id).toBeTruthy();
      if (ex.easier) expect(EXERCISES[ex.easier], `${ex.id} → ${ex.easier}`).toBeTruthy();
    }
  });

  it("only shows routines for your areas (plus the quick stretch, which is for everyone)", () => {
    const { mine, other } = routinesFor({ areas: ["legs"], skip: [] });
    const ids = mine.map((r) => r.id);
    expect(ids).toContain("legs");
    expect(ids).toContain("stretch");
    expect(ids).toContain("mix");
    expect(ids).not.toContain("quickie");
    expect(other.map((r) => r.id)).toContain("quickie");
  });

  it("no areas picked = everything", () => {
    expect(forYou(["neck"], [])).toBe(true);
    expect(routinesFor({ areas: [], skip: [] }).other).toHaveLength(0);
  });

  it("My Mix uses moves from each of your areas", () => {
    const mix = myMix({ areas: ["neck", "legs"] });
    expect(mix.exercises.some((id) => EXERCISES[id].areas!.includes("neck"))).toBe(true);
    expect(mix.exercises.some((id) => EXERCISES[id].areas!.includes("legs"))).toBe(true);
    expect(mix.exercises.length).toBeLessThanOrEqual(6);
    expect(buildTimeline(mix).length).toBeGreaterThan(0);
  });

  it("a move that hurts is swapped for its gentler version, or dropped", () => {
    expect(resolveSkip("calf-stretch", ["calf-stretch"])).toBe("ankle-pumps");
    expect(resolveSkip("calf-stretch", ["calf-stretch", "ankle-pumps"])).toBe(null);
    const r = getRoutine("legs", { skip: ["calf-raise"] });
    expect(r.exercises).not.toContain("calf-raise");
    expect(r.exercises).toContain("ankle-pumps");
  });

  it("full-body poses carry through to the timeline", () => {
    const steps = buildTimeline(getRoutine("stretch"));
    expect(steps.some((s) => s.kind === "work" && s.body)).toBe(true);
    expect(ROUTINES.find((r) => r.id === "stretch")!.standing).toBe(true);
  });
});

describe("interval reminders (quick stretch, eye breaks)", () => {
  const s = { ...defaultSettings(), tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], startHour: 9, endHour: 18 };
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 23, h, m);

  it("fires once the interval has passed since the last one", () => {
    const r = { on: true, everyMin: 60, last: [at(10)] };
    expect(intervalDue(s, r, at(10, 30))).toBe(false);
    expect(intervalDue(s, r, at(11))).toBe(true);
  });
  it("never outside your hours, when off, or while snoozed", () => {
    expect(intervalDue(s, { on: true, everyMin: 60, last: [at(5)] }, at(20))).toBe(false);
    expect(intervalDue(s, { on: false, everyMin: 60, last: [at(5)] }, at(12))).toBe(false);
    expect(intervalDue(s, { on: true, everyMin: 60, last: [at(10)], snoozeUntil: at(11, 30) }, at(11, 10))).toBe(false);
    expect(intervalDue(s, { on: true, everyMin: 60, last: [at(10)], snoozeUntil: at(11, 30) }, at(11, 31))).toBe(true);
  });
  it("a break away from the desk counts", () => {
    // last reminder at 10:00, but you were away until 10:40 -> next at 11:40
    expect(intervalDue(s, { on: true, everyMin: 60, last: [at(10), at(10, 40)] }, at(11, 10))).toBe(false);
    expect(intervalDue(s, { on: true, everyMin: 60, last: [at(10), at(10, 40)] }, at(11, 40))).toBe(true);
  });
});

describe("saving across windows", () => {
  it("merging keeps both windows' sitting time rows (newest copy of a row wins)", () => {
    const a = emptyDoc();
    const b = emptyDoc();
    a.guard = [{ id: "2026-11-23:x", day: "2026-11-23", goodSec: 10, totalSec: 20, nudges: 0, updatedAt: 1 }];
    b.guard = [{ id: "2026-11-23:x", day: "2026-11-23", goodSec: 10, totalSec: 20, nudges: 0, sitSec: 300, updatedAt: 2 }];
    expect(mergeDocs(a, b).guard[0].sitSec).toBe(300);
    expect(mergeDocs(b, a).guard[0].sitSec).toBe(300);
  });
  it("older saved settings get the new defaults", () => {
    const d = mergeDocs(null, { settings: { remindersOn: false } } as never);
    expect(d.settings.stretchOn).toBe(true);
    expect(d.settings.stretchMin).toBe(60);
    expect(d.settings.areas).toEqual([]);
  });
});
