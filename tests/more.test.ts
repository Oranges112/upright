import { describe, expect, it } from "vitest";
import { EXERCISES, SEATED_SWAP, buildTimeline, getRoutine, planRoutine, planWeek, routinesFor, isStanding } from "../src/lib/exercises";
import { pickBest } from "../src/lib/guard";
import { judge } from "../src/components/DeskCheck";
import { headBendFromPhone, neckKg } from "../src/lib/phone";
import { emptyDoc, mergeDocs } from "../src/lib/merge";
import type { Sample } from "../src/lib/face";

describe("tension relief", () => {
  it("has its own routine and area", () => {
    const { mine } = routinesFor({ areas: ["tension"], skip: [] });
    expect(mine.map((r) => r.id)).toContain("tension");
    for (const id of getRoutine("tension").exercises) expect(EXERCISES[id]).toBeTruthy();
  });
});

describe("seated only", () => {
  it("swaps every standing move for a seated one", () => {
    const r = getRoutine("stretch", { seatedOnly: true, skip: [] });
    expect(r.exercises.some(isStanding)).toBe(false);
    expect(r.standing).toBe(false);
    for (const [from, to] of Object.entries(SEATED_SWAP)) {
      expect(isStanding(to), `${from} → ${to}`).toBe(false);
      expect(EXERCISES[to]).toBeTruthy();
    }
  });
});

describe("your own routines", () => {
  const mine = { id: "my-1", name: "Morning", blurb: "", emoji: "⭐", exercises: ["chin-tuck", "calf-raise"], gradient: ["#000", "#fff"] as [string, string], custom: true, updatedAt: 5 };
  it("can be played and listed first", () => {
    expect(getRoutine("my-1", { custom: [mine], skip: [] }).name).toBe("Morning");
    expect(routinesFor({ custom: [mine], areas: [], skip: [] }).mine[0].id).toBe("my-1");
  });
  it("removing one on any device removes it everywhere (newest wins)", () => {
    const a = { ...emptyDoc(), custom: [mine] };
    const b = { ...emptyDoc(), custom: [{ ...mine, deleted: true, updatedAt: 9 }] };
    expect(mergeDocs(a, b).custom[0].deleted).toBe(true);
    expect(routinesFor({ custom: mergeDocs(a, b).custom, areas: [], skip: [] }).mine.map((r) => r.id)).not.toContain("my-1");
  });
});

describe("4-week plan", () => {
  it("knows which week you're in", () => {
    const s = { planOn: true, planStart: "2026-11-02" };
    expect(planWeek(s, "2026-11-02")).toBe(1);
    expect(planWeek(s, "2026-11-08")).toBe(1);
    expect(planWeek(s, "2026-11-09")).toBe(2);
    expect(planWeek(s, "2026-11-23")).toBe(4);
    expect(planWeek(s, "2027-01-01")).toBe(5);
    expect(planWeek({ planOn: false, planStart: "2026-11-02" }, "2026-11-09")).toBe(0);
  });
  it("starts gentle and gets stronger", () => {
    const p = { areas: ["neck" as const, "legs" as const], skip: [] };
    const w1 = planRoutine(p, 1);
    const w3 = planRoutine(p, 3);
    const w4 = planRoutine(p, 4);
    expect(w1.level).toBe(1);
    expect(w4.level).toBe(3);
    expect(w3.exercises).toContain("tuck-hold");
    // the plan's level overrides your usual one
    const hold = (r: typeof w1) => buildTimeline(r, 2).find((x) => x.exerciseId === "chin-tuck" && x.label === "Tuck")?.sec ?? 0;
    expect(hold(w4)).toBeGreaterThan(hold(w1));
  });
});

describe("Posture Guard calibrates itself", () => {
  const smp = (w: number, cy: number): Sample => ({ w, cy, cx: 0.5, pitch: 0, roll: 0, yaw: 0, em: w * 0.6, pitchM: 0, edm: 1 });
  it("picks the tall moments (further back, higher up)", () => {
    const xs = [...Array(30)].map((_, i) => smp(0.2 + (i % 10) * 0.01, 0.45 + (i % 10) * 0.01));
    const best = pickBest(xs);
    const avgW = best.reduce((a, x) => a + x.w, 0) / best.length;
    expect(best.length).toBeGreaterThanOrEqual(5);
    expect(avgW).toBeLessThan(0.24);
  });
});

describe("desk check", () => {
  it("spots a low laptop and a too-close screen", () => {
    const r = judge({ w: 0.3, cy: 0.25, cx: 0.5 });
    expect(r.distance.ok).toBe(false);
    expect(r.height.title).toMatch(/too low/);
    const good = judge({ w: 0.17, cy: 0.5, cx: 0.52 });
    expect([good.distance.ok, good.height.ok, good.centre.ok]).toEqual([true, true, true]);
  });
});

describe("phone posture", () => {
  it("a phone held low weighs more on the neck", () => {
    expect(neckKg(0)).toBe(5);
    expect(neckKg(60)).toBe(27);
    expect(neckKg(headBendFromPhone(20))).toBeGreaterThan(neckKg(headBendFromPhone(80)));
  });
});
