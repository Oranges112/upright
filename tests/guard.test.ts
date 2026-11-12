import { describe, expect, it } from "vitest";
import { measureFace, type Detection, type Sample } from "@/lib/face";
import { assess, THRESH } from "@/lib/guard";
import type { GuardBase } from "@/lib/store";

/**
 * A simple 3D head seen by a 1280x720 webcam, so we can check the Guard against real
 * geometry: turning, leaning in, dropping the chin, and the camera moving.
 * Head coordinates in mm: x right, y down, z toward the camera. Pivot is the neck.
 */
const W = 1280;
const H = 720;
const F = 1000; // focal length in px (~65° wide)
const PIVOT = { y: 60, z: -90 };
const POINTS = {
  re: [-31, 0, 0],
  le: [31, 0, 0],
  nose: [0, 38, 32],
  mouth: [0, 70, 14],
  rEar: [-72, 22, -82],
  lEar: [72, 22, -82],
} as Record<string, readonly [number, number, number]>;

interface Pose {
  /** head turn, degrees (+ = toward your left) */
  yaw?: number;
  /** chin down, degrees */
  pitch?: number;
  /** distance from camera to eyes, mm */
  dist?: number;
  /** head height vs camera, mm (+ = lower in the frame) */
  drop?: number;
}

function project({ yaw = 0, pitch = 0, dist = 600, drop = 0 }: Pose): Detection {
  const cy = Math.cos((yaw * Math.PI) / 180);
  const sy = Math.sin((yaw * Math.PI) / 180);
  const cp = Math.cos((pitch * Math.PI) / 180);
  const sp = Math.sin((pitch * Math.PI) / 180);
  const pts = Object.values(POINTS).map(([x, y, z]) => {
    // rotate about the neck pivot: chin down (x axis), then turn (y axis)
    let Y = y - PIVOT.y;
    let Z = z - PIVOT.z;
    [Y, Z] = [Y * cp + Z * sp, -Y * sp + Z * cp]; // + pitch: the face tips down
    let X = x;
    [X, Z] = [X * cy + Z * sy, -X * sy + Z * cy];
    Y += PIVOT.y + drop;
    Z += PIVOT.z;
    const depth = dist - Z; // distance from the camera
    return { x: (W / 2 + (F * X) / depth) / W, y: (H / 2 + (F * Y) / depth) / H };
  });
  const xs = pts.map((p) => p.x * W);
  const ys = pts.map((p) => p.y * H);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys) - 30;
  return {
    boundingBox: { originX: x0, originY: y0, width: x1 - x0, height: Math.max(...ys) + 20 - y0 },
    keypoints: pts,
  };
}

const sample = (p: Pose) => measureFace(project(p), W, H)!;
function baseFrom(s: Sample): GuardBase {
  return { w: s.w, cy: s.cy, cx: s.cx, pitch: s.pitch ?? undefined, roll: s.roll ?? undefined, yaw: s.yaw ?? undefined, em: s.em ?? undefined, pitchM: s.pitchM ?? undefined, edm: s.edm ?? undefined, at: 0 };
}
const t = THRESH[2];
const base = baseFrom(sample({}));
const worst = (p: Pose, b = base) => assess(sample(p), b, t).scores[0];

describe("Posture Guard: facing the screen", () => {
  it("sitting as calibrated is good", () => {
    expect(worst({})[1]).toBeLessThan(0.2);
  });
  it("leaning in toward the screen is 'forward'", () => {
    expect(worst({ dist: 480 })).toEqual(["forward", expect.any(Number)]);
    expect(worst({ dist: 480 })[1]).toBeGreaterThan(1);
  });
  it("sinking down is 'low'", () => {
    const [s, v] = worst({ drop: 50 });
    expect(s).toBe("low");
    expect(v).toBeGreaterThan(1);
  });
  it("dropping the chin is 'down'", () => {
    const [s, v] = worst({ pitch: 20 });
    expect(s).toBe("down");
    expect(v).toBeGreaterThan(1);
  });
});

describe("Posture Guard: looking at a second screen", () => {
  for (const yaw of [25, 40]) {
    it(`turned ${yaw}° with good posture stays good, and is still judged`, () => {
      const a = assess(sample({ yaw }), base, t);
      expect(a.turned).toBe(true);
      expect(a.away).toBe(false);
      expect(a.scores[0][1]).toBeLessThan(0.75);
    });
    it(`turned ${yaw}° and leaning in is still caught`, () => {
      const [s, v] = worst({ yaw, dist: 460 });
      expect(s).toBe("forward");
      expect(v).toBeGreaterThan(1);
    });
    it(`turned ${yaw}° and dropping the chin is still caught`, () => {
      const [s, v] = worst({ yaw, pitch: 25 });
      expect(s).toBe("down");
      expect(v).toBeGreaterThan(1);
    });
    it(`turned ${yaw}° and sinking is still caught`, () => {
      const [s, v] = worst({ yaw, drop: 60 });
      expect(s).toBe("low");
      expect(v).toBeGreaterThan(1);
    });
  }
});

describe("Posture Guard: turned right away is no excuse", () => {
  for (const yaw of [65, 75]) {
    it(`turned ${yaw}° with good posture stays good`, () => {
      const a = assess(sample({ yaw }), base, t);
      expect(a.away).toBe(true);
      expect(a.scores[0][1]).toBeLessThan(0.75);
    });
    it(`turned ${yaw}° and sinking is caught`, () => {
      const [s, v] = worst({ yaw, drop: 60 });
      expect(s).toBe("low");
      expect(v).toBeGreaterThan(1);
    });
    it(`turned ${yaw}° and dropping the chin is caught`, () => {
      const [s, v] = worst({ yaw, pitch: 25 });
      expect(s).toBe("down");
      expect(v).toBeGreaterThan(1);
    });
  }
  it("turned 65° and leaning in is caught", () => {
    const [s, v] = worst({ yaw: 65, dist: 460 });
    expect(s).toBe("forward");
    expect(v).toBeGreaterThan(1);
  });
  it("head tilt isn't judged when turned right away (a side-on face fakes it)", () => {
    const a = assess(sample({ yaw: 75, drop: 60 }), base, t);
    expect(a.scores.find(([k]) => k === "tilt")![1]).toBe(0);
  });
  it("old calibrations (no turn-proof measures) still catch sinking when turned away", () => {
    const old: GuardBase = { ...base, em: undefined, pitchM: undefined, edm: undefined };
    expect(assess(sample({ yaw: 40 }), old, t).away).toBe(true);
    expect(worst({ yaw: 40, drop: 60 }, old)[0]).toBe("low");
    expect(worst({ yaw: 40 }, old)[1]).toBeLessThan(0.75);
  });
});

describe("Posture Guard: camera moved", () => {
  it("much further away = setup moved", () => {
    expect(assess(sample({ dist: 900 }), base, t).movedNow).toBe(true);
  });
  it("much higher in the frame = setup moved (you can't slouch upward)", () => {
    expect(assess(sample({ drop: -110 }), base, t).movedNow).toBe(true);
  });
  it("normal slouching isn't mistaken for a move", () => {
    expect(assess(sample({ dist: 480 }), base, t).movedNow).toBe(false);
    expect(assess(sample({ drop: 50 }), base, t).movedNow).toBe(false);
    expect(assess(sample({ yaw: 40 }), base, t).movedNow).toBe(false);
  });
  it("a raised laptop, calibrated there, works the same", () => {
    // camera 120 mm higher than your eyes: you sit lower in the frame and it looks down at you
    const raised = baseFrom(sample({ drop: 120, pitch: -8 }));
    expect(assess(sample({ drop: 120, pitch: -8 }), raised, t).scores[0][1]).toBeLessThan(0.2);
    expect(assess(sample({ drop: 120, pitch: -8, dist: 480 }), raised, t).scores[0][0]).toBe("forward");
    expect(assess(sample({ drop: 120, pitch: 15 }), raised, t).scores[0][0]).toBe("down");
  });
});
