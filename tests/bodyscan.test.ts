import { describe, expect, it } from "vitest";
import { bodyChecks, pickPerson, plausible, pointsFromLandmarks, type BodyPoints } from "@/lib/bodyscan";

const W = 900;
const H = 1200;
// a person standing side-on, facing right, in normalised coordinates
const upright: BodyPoints = {
  nose: { x: 0.56, y: 0.12 },
  ear: { x: 0.5, y: 0.13 },
  shoulder: { x: 0.5, y: 0.24 },
  hip: { x: 0.5, y: 0.52 },
  knee: { x: 0.5, y: 0.72 },
  ankle: { x: 0.5, y: 0.92 },
};
const get = (p: BodyPoints, id: string) => bodyChecks(p, W, H).find((c) => c.id === id)!;

describe("full-body check from a side photo", () => {
  it("a stacked, upright stance is all good", () => {
    for (const c of bodyChecks(upright, W, H)) expect(c.tone, c.id).toBe("good");
  });
  it("head forward of the shoulders is flagged", () => {
    expect(get({ ...upright, ear: { x: 0.56, y: 0.15 }, nose: { x: 0.62, y: 0.14 } }, "head").tone).not.toBe("good");
  });
  it("hips pushed forward over the feet is flagged (the 'sway' stance)", () => {
    const c = get({ ...upright, hip: { x: 0.55, y: 0.52 }, knee: { x: 0.525, y: 0.72 } }, "hips");
    expect(c.deg).toBeGreaterThan(4);
    expect(c.verdict).toMatch(/forward/);
  });
  it("knees bowed back behind the hip–ankle line are 'locked back'", () => {
    const c = get({ ...upright, knee: { x: 0.47, y: 0.72 } }, "knees");
    expect(c.deg).toBeLessThan(-4);
    expect(c.verdict).toMatch(/locked/);
  });
  it("works the same when facing left (mirror image)", () => {
    const flip = (q?: { x: number; y: number }) => (q ? { x: 1 - q.x, y: q.y } : undefined);
    const p = { ...upright, hip: { x: 0.55, y: 0.52 } };
    const m = { nose: flip(p.nose), ear: flip(p.ear)!, shoulder: flip(p.shoulder)!, hip: flip(p.hip), knee: flip(p.knee), ankle: flip(p.ankle) };
    expect(get(m, "hips").deg).toBe(get(p, "hips").deg);
  });
  it("head-and-shoulders photos only get the head check", () => {
    expect(bodyChecks({ ear: upright.ear, shoulder: upright.shoulder, nose: upright.nose }, W, H).map((c) => c.id)).toEqual(["head"]);
  });
});

describe("finding the right person", () => {
  const lm = (p: BodyPoints, vis = 0.9) => {
    const arr = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
    const set = (i: number, q?: { x: number; y: number }) => q && (arr[i] = { ...q, visibility: vis });
    set(0, p.nose);
    set(7, p.ear);
    set(11, p.shoulder);
    set(23, p.hip);
    set(25, p.knee);
    set(27, p.ankle);
    return arr;
  };
  it("impossible results are rejected (ear below the shoulder)", () => {
    expect(plausible({ ...upright, ear: { x: 0.5, y: 0.9 } })).toBe(false);
    expect(pointsFromLandmarks(lm({ ...upright, ear: { x: 0.5, y: 0.9 } }))).toBeNull();
  });
  it("picks the person standing tall over someone lying in the background", () => {
    const lying: BodyPoints = { ear: { x: 0.2, y: 0.5 }, shoulder: { x: 0.25, y: 0.52 }, hip: { x: 0.4, y: 0.53 } };
    const p = pickPerson([lm(lying), lm(upright)]);
    expect(p?.ankle?.y).toBeCloseTo(0.92);
  });
});

import { photoDue } from "@/components/PhotoReminder";
import { emptyDoc } from "@/lib/merge";

describe("monthly photo reminder", () => {
  const DAY = 86_400_000;
  const now = Date.UTC(2026, 10, 13);
  const withPhoto = (daysAgo: number) => {
    const d = emptyDoc();
    d.tests = [{ id: "a", at: now - daysAgo * DAY, day: "x", type: "angle", value: 22 }];
    return d;
  };
  it("asks again after about a month", () => {
    expect(photoDue(withPhoto(10), now).due).toBe(false);
    expect(photoDue(withPhoto(30), now)).toMatchObject({ due: true, days: 30, last: 22 });
  });
  it("asks for a first photo once you've used the app a few days", () => {
    const d = emptyDoc();
    expect(photoDue(d, now).due).toBe(false);
    d.sessions = [{ id: "s", routineId: "quickie", startedAt: now - 5 * DAY, day: "x", durationSec: 120, completed: true }];
    expect(photoDue(d, now).due).toBe(true);
  });
  it("'Later' hides it for a while", () => {
    expect(photoDue(withPhoto(30), now, now + 1000).due).toBe(false);
  });
});
