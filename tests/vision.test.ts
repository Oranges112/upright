import { describe, expect, it } from "vitest";
import { measureFace, median, type Detection } from "@/lib/face";
import { RepScorer, judge, type Baseline } from "@/lib/formcheck";
import { headAngle } from "@/lib/photos";

const W = 640;
const H = 480;

/** A synthetic face: eyes level at y, nose below, ears either side. Coordinates normalised 0..1. */
function face({ y = 0.4, noseDrop = 0.06, earY = 0.42, tilt = 0, size = 0.3, turn = 0 } = {}): Detection {
  const cx = 0.5;
  const half = 0.06;
  return {
    boundingBox: { originX: (cx - size / 2) * W, originY: (y - 0.15) * H, width: size * W, height: size * W },
    keypoints: [
      { x: cx - half, y: y - tilt }, // right eye
      { x: cx + half, y: y + tilt }, // left eye
      { x: cx + turn, y: y + noseDrop }, // nose
      { x: cx, y: y + 0.1 }, // mouth
      { x: cx - 0.12, y: earY }, // right ear
      { x: cx + 0.12, y: earY }, // left ear
    ],
  };
}

describe("measureFace", () => {
  it("reads a level, straight face as ~0 roll and ~0 yaw", () => {
    const s = measureFace(face(), W, H)!;
    expect(Math.abs(s.roll!)).toBeLessThan(0.5);
    expect(Math.abs(s.yaw!)).toBeLessThan(0.01);
  });
  it("pitch rises when the chin drops (nose lower vs ears)", () => {
    const up = measureFace(face(), W, H)!;
    const down = measureFace(face({ noseDrop: 0.12 }), W, H)!;
    expect(down.pitch!).toBeGreaterThan(up.pitch!);
  });
  it("roll follows a head tilt, yaw follows a turn", () => {
    expect(Math.abs(measureFace(face({ tilt: 0.03 }), W, H)!.roll!)).toBeGreaterThan(10);
    expect(Math.abs(measureFace(face({ turn: 0.05 }), W, H)!.yaw!)).toBeGreaterThan(0.3);
  });
  it("returns null without a face box", () => {
    expect(measureFace({}, W, H)).toBeNull();
  });
});

describe("form check", () => {
  const base: Baseline = { w: 0.3, pitch: 0.2, roll: 0, yaw: 0 };
  const s = (p: Partial<{ w: number; pitch: number; roll: number; yaw: number }>) => ({ w: 0.3, cy: 0.4, cx: 0.5, pitch: 0.2, roll: 0, yaw: 0, ...p });

  it("a chin tuck that glides back is good", () => {
    expect(judge("chin-tuck", "Tuck", s({ w: 0.29 }), base)?.tone).toBe("good");
  });
  it("nodding down instead of tucking is flagged", () => {
    expect(judge("chin-tuck", "Tuck", s({ w: 0.29, pitch: 0.4 }), base)?.tone).toBe("bad");
  });
  it("not moving back enough asks for more", () => {
    expect(judge("chin-tuck", "Tuck", s({}), base)?.tone).toBe("warn");
  });
  it("rest phases aren't judged", () => {
    expect(judge("chin-tuck", "Release", s({}), base)).toBeNull();
  });
  it("side tilt: enough tilt is good, twisting is flagged", () => {
    expect(judge("side-tilt", "Hold", s({ roll: 18 }), base)?.tone).toBe("good");
    expect(judge("side-tilt", "Hold", s({ roll: 18, yaw: 0.5 }), base)?.tone).toBe("warn");
  });
  it("turns and nods are judged by direction", () => {
    expect(judge("turn", "Look left", s({ yaw: -0.4 }), base)?.tone).toBe("good");
    expect(judge("nod", "Look up", s({ pitch: 0.05 }), base)?.tone).toBe("good");
    expect(judge("nod", "Look down", s({ pitch: 0.05 }), base)?.tone).toBe("warn");
  });
  it("a rep only counts after holding good form briefly", () => {
    const r = new RepScorer();
    r.begin(true);
    r.update({ tone: "good", text: "" }, 0.3);
    r.begin(true); // too short: not counted
    r.update({ tone: "good", text: "" }, 0.9);
    r.finish(); // long enough
    expect(r.total).toBe(2);
    expect(r.good).toBe(1);
  });
});

describe("helpers", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("side-photo head angle: ear straight over shoulder is 0°, forward is more", () => {
    expect(headAngle({ x: 0.5, y: 0.3 }, { x: 0.5, y: 0.6 }, 900, 1200)).toBe(0);
    expect(headAngle({ x: 0.6, y: 0.3 }, { x: 0.5, y: 0.6 }, 900, 1200)).toBeGreaterThan(10);
  });
});
