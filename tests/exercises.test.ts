import { describe, expect, it } from "vitest";
import { EXERCISES, KIND, ROUTINES, buildTimeline, routineSeconds, type Level } from "@/lib/exercises";
import { COACHING, workTips } from "@/lib/coaching";

const levels: Level[] = [1, 2, 3, 4];

describe("exercise library", () => {
  it("every routine only uses exercises that exist", () => {
    for (const r of ROUTINES) for (const id of r.exercises) expect(EXERCISES[id], `${r.id} → ${id}`).toBeDefined();
  });
  it("every exercise has full coaching (why, feel, tips, mistake)", () => {
    for (const id of Object.keys(EXERCISES)) {
      const c = COACHING[id];
      expect(c, id).toBeDefined();
      expect(c.why.length).toBeGreaterThan(40);
      expect(c.feel.length).toBeGreaterThan(10);
      expect(c.tips.length).toBeGreaterThanOrEqual(3);
      expect(c.avoid.length).toBeGreaterThan(10);
      expect(workTips(id)[0].text).toMatch(/^Why it helps/);
    }
  });
  it("every exercise has a kind for intensity scaling", () => {
    for (const id of Object.keys(EXERCISES)) expect(KIND[id], id).toBeDefined();
  });
});

describe("timeline and intensity", () => {
  it("the Desk Quickie stays a quick break at the default level", () => {
    const quick = ROUTINES.find((r) => r.id === "quickie")!;
    const sec = routineSeconds(quick, 2);
    expect(sec).toBeGreaterThan(90);
    expect(sec).toBeLessThan(240);
  });
  it("harder levels never make a routine shorter", () => {
    for (const r of ROUTINES) {
      for (let i = 1; i < levels.length; i++) {
        expect(routineSeconds(r, levels[i])).toBeGreaterThanOrEqual(routineSeconds(r, levels[i - 1]));
      }
    }
  });
  it("stretch holds stay at or under 30 s and strength holds under 45 s at any level", () => {
    for (const r of ROUTINES) {
      for (const lvl of levels) {
        for (const s of buildTimeline(r, lvl)) {
          if (s.kind !== "work") continue;
          if (KIND[s.exerciseId] === "stretch") expect(s.sec, `${s.exerciseId} L${lvl}`).toBeLessThanOrEqual(30);
          if (KIND[s.exerciseId] === "strength") expect(s.sec, `${s.exerciseId} L${lvl}`).toBeLessThanOrEqual(45);
        }
      }
    }
  });
  it("sided exercises are done on both sides", () => {
    const full = ROUTINES.find((r) => r.id === "full")!;
    const steps = buildTimeline(full, 2);
    for (const id of full.exercises.filter((e) => EXERCISES[e].sides)) {
      const sides = new Set(steps.filter((s) => s.exerciseId === id && s.kind === "work").map((s) => s.side));
      expect(sides, id).toEqual(new Set(["left", "right"]));
    }
  });
});
