import { describe, expect, it } from "vitest";
import { addTo, summarize, type Bucket } from "@/lib/recent";

const H = 3600_000;
const T0 = Date.UTC(2026, 10, 11, 10, 0, 0); // started Guard at 10:00

function track(list: Bucket[], fromMs: number, toMs: number, goodShare: number) {
  for (let t = fromMs; t < toMs; t += 60_000) addTo(list, t, 60 * goodShare, 60);
  return list;
}

describe("recent upright %", () => {
  it("shows nothing until there's 30 min of tracked time", () => {
    const l = track([], T0, T0 + 20 * 60_000, 1);
    expect(summarize(l, T0 + 20 * 60_000)).toBeNull();
  });
  it("covers only the hours since you started (e.g. 'last 2 hrs' at noon)", () => {
    const l = track([], T0, T0 + 2 * H, 0.75);
    const s = summarize(l, T0 + 2 * H)!;
    expect(s.hours).toBe(2);
    expect(s.pct).toBe(75);
  });
  it("time away from the desk doesn't count", () => {
    const l = track([], T0, T0 + H, 1); // 10–11 at the desk
    track(l, T0 + 4 * H, T0 + 5 * H, 0.5); // back at 14:00
    const s = summarize(l, T0 + 5 * H)!;
    expect(s.hours).toBe(2);
    expect(s.pct).toBe(75);
  });
  it("never looks back more than 12 hours", () => {
    const l = track([], T0, T0 + 20 * H, 0.5);
    track(l, T0 + 20 * H, T0 + 21 * H, 1);
    const s = summarize(l, T0 + 21 * H)!;
    expect(s.hours).toBe(12);
    expect(s.pct).toBeGreaterThan(50);
    expect(s.pct).toBeLessThan(60);
  });
});
