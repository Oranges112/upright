import { describe, expect, it } from "vitest";
import { GYM, GYM_PLANS, planItem } from "@/lib/gym";
import { GUIDES } from "@/lib/guides";
import { FLOOR, LEN, cycleLength, joints, sample, solve2, type Key, type SidePose } from "@/lib/gymAnim";

const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("gym library", () => {
  it("every gym exercise is fully written up", () => {
    for (const ex of Object.values(GYM)) {
      expect(ex.steps.length, ex.id).toBeGreaterThanOrEqual(3);
      expect(ex.why.length, ex.id).toBeGreaterThan(60);
      expect(ex.tips.length, ex.id).toBeGreaterThanOrEqual(3);
      expect(ex.mistakes.length, ex.id).toBeGreaterThanOrEqual(2);
      expect(ex.easier && ex.harder, ex.id).toBeTruthy();
      expect(ex.anim.keys.length, ex.id).toBeGreaterThanOrEqual(1);
    }
  });
  it("plans only use exercises that exist and have sane rest times", () => {
    for (const p of GYM_PLANS) {
      expect(p.id.startsWith("gym-")).toBe(true);
      for (const it of p.items) {
        const x = planItem(it);
        expect(x.ex, `${p.id} → ${it.id}`).toBeDefined();
        expect(x.sets).toBeGreaterThan(0);
        expect(x.rest).toBeGreaterThanOrEqual(10);
      }
    }
  });
  it("guides have content", () => {
    for (const g of GUIDES) expect(g.sections.length, g.id).toBeGreaterThan(0);
    expect(new Set(GUIDES.map((g) => g.id)).size).toBe(GUIDES.length);
  });
});

describe("animation engine", () => {
  it("2-bone IK keeps bone lengths and reaches reachable targets", () => {
    const r = solve2([0, 0], [30, 50], 40, 40, 1);
    expect(d([0, 0], r.mid)).toBeCloseTo(40, 3);
    expect(d(r.mid, r.end)).toBeCloseTo(40, 3);
    expect(d(r.end, [30, 50])).toBeLessThan(0.05);
  });
  it("planted feet stay planted through every side-view animation", () => {
    for (const ex of Object.values(GYM)) {
      if (ex.anim.view !== "side") continue;
      const keys = ex.anim.keys as Key<SidePose>[];
      const total = cycleLength(keys);
      for (let t = 0; t < total; t += 0.25) {
        const p = sample(keys, t).pose;
        const j = joints(p);
        for (const v of Object.values(j)) if (Array.isArray(v)) expect(Number.isFinite(v[0]) && Number.isFinite(v[1]), ex.id).toBe(true);
        expect(d(j.hip, j.knee), ex.id).toBeCloseTo(LEN.th, 1);
        if (p.foot) expect(d(j.ankle, p.foot), `${ex.id} @${t}`).toBeLessThan(1.5);
        // nothing sinks through the floor
        expect(j.headC[1] + LEN.head, ex.id).toBeLessThanOrEqual(FLOOR + 1);
      }
    }
  });
});
