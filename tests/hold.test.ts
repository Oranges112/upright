import { describe, expect, it } from "vitest";
import { GRACE_MS, NO_HOLD, holdGraceMs, nextHold, type Hold } from "@/lib/hold";

const run = (steps: [state: "good" | "bad" | "off" | "other", atSec: number][]) =>
  steps.reduce<Hold>((h, [st, t]) => nextHold(h, st, t * 1000), NO_HOLD);

describe("'Holding for' count", () => {
  it("counts from when good posture started", () => {
    expect(run([["good", 0], ["good", 120]]).since).toBe(0);
  });
  it("a short slip doesn't reset it", () => {
    const h = run([["good", 0], ["good", 120], ["bad", 121], ["bad", 130], ["good", 131]]);
    expect(h.since).toBe(0);
  });
  it("a real slouch (over the grace period) does", () => {
    const h = run([["good", 0], ["bad", 100], ["bad", 100 + GRACE_MS / 1000 + 1], ["good", 130]]);
    expect(h.since).toBe(130_000);
  });
  it("two separate short slips are each forgiven", () => {
    const h = run([["good", 0], ["bad", 60], ["bad", 70], ["good", 71], ["bad", 200], ["bad", 215], ["good", 216]]);
    expect(h.since).toBe(0);
  });
  it("by default it resets just after the nudge (30 s nudge -> 35 s), or at your own setting", () => {
    expect(holdGraceMs(undefined, 30)).toBe(35_000);
    expect(holdGraceMs(10, 30)).toBe(10_000);
    const slip = (grace: number) =>
      [["good", 0], ["bad", 100], ["bad", 133], ["good", 134]].reduce<Hold>((h, [st, t]) => nextHold(h, st as "good" | "bad", (t as number) * 1000, grace), NO_HOLD).since;
    expect(slip(35_000)).toBe(0); // 33 s slouch < 35 s: kept
    expect(slip(10_000)).toBe(134_000); // stricter 10 s: starts over
  });
  it("not being seen at all neither adds nor breaks it; turning Guard off does", () => {
    expect(run([["good", 0], ["other", 50], ["good", 60]]).since).toBe(0);
    expect(run([["good", 0], ["off", 50], ["good", 60]]).since).toBe(60_000);
  });
});
