/**
 * A tiny skeletal animation engine for the gym figures.
 *
 * Side view, figure faces right (+x). SVG coordinates (y grows downward).
 * Angles use one convention everywhere: dir(φ) = (sin φ, cos φ) in degrees,
 * so φ=0 points down, 90 points forward (+x), 180 points up, -90/270 points back.
 *
 * A pose is a handful of numbers (hip position, torso lean, joint angles). Limbs can
 * instead be given a target point ("put the foot here") and are solved with 2-bone IK,
 * which keeps feet planted and hands on a handle while the body moves.
 * Poses are interpolated number-by-number, so any two poses blend smoothly.
 */

export type Pt = [number, number];

export const LEN = {
  lower: 30, // hip → mid-back
  upper: 28, // mid-back → shoulder
  neck: 21, // shoulder → head centre
  head: 14, // head radius
  ua: 30, // upper arm
  fa: 28, // forearm
  th: 40, // thigh
  sh: 40, // shin
  foot: 13,
  armDrop: 6, // arm hangs from a little below the top of the torso
};

export const FLOOR = 182;

/** A limb is either joint angles or an IK target (point + which way the middle joint bends). */
export interface SidePose {
  x: number;
  y: number;
  /** torso lean from vertical (+ forward). Lying on your back (head left) is -90. */
  t: number;
  /** upper-back bend relative to lower back (+ rounding forward, - arching back) */
  b?: number;
  /** head relative to the torso line (+ = nod forward / chin down) */
  n?: number;
  /** near arm: shoulder angle relative to torso (0 = hanging along torso, 90 = forward), elbow flex */
  s?: number;
  e?: number;
  /** far arm (defaults to the near arm) */
  s2?: number;
  e2?: number;
  /** IK targets for hands; "hip" / "head" are special anchors */
  hand?: Pt | "hip" | "head";
  hand2?: Pt | "hip" | "head";
  /** +1 / -1: which side the elbow goes */
  ed?: number;
  ed2?: number;
  /** upper arm / forearm foreshortening (pointing in/out of the screen), 0..1 */
  ua?: number;
  ua2?: number;
  /** near leg: hip angle relative to torso (0 = in line, 90 = sitting), knee flex */
  h?: number;
  k?: number;
  h2?: number;
  k2?: number;
  foot?: Pt;
  foot2?: Pt;
  /** +1 / -1: which side the knee goes */
  kd?: number;
  kd2?: number;
  /** absolute foot angle for the near leg (e.g. -90 = laid flat behind you when kneeling) */
  ft?: number;
}

/** Front view (used for moves that happen out to the sides). */
export interface FrontPose {
  /** arm abduction from hanging (deg, 90 = straight out to the side) */
  la: number;
  ra: number;
  /** elbow flex */
  le?: number;
  re?: number;
  /** foreshortening of the arms (0 = pointing at you, 1 = flat to the screen) */
  f?: number;
  /** body squat / lean shift */
  dy?: number;
}

export interface Key<P> {
  pose: P;
  /** seconds to move INTO this pose */
  move: number;
  /** seconds to hold it */
  hold: number;
  label?: string;
}

export interface Anim {
  view: "side" | "front";
  scene: string;
  keys: Key<SidePose>[] | Key<FrontPose>[];
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const dir = (phi: number, len = 1): Pt => [Math.sin(rad(phi)) * len, Math.cos(rad(phi)) * len];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const angleTo = (a: Pt, b: Pt) => deg(Math.atan2(b[0] - a[0], b[1] - a[1]));
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** 2-bone IK: from root to target with bone lengths a, b. Returns the absolute angle of the first bone and the middle joint. */
export function solve2(root: Pt, target: Pt, a: number, b: number, bend: number): { phi1: number; mid: Pt; end: Pt } {
  const d = Math.min(a + b - 0.01, Math.max(Math.abs(a - b) + 0.01, dist(root, target)));
  const base = angleTo(root, target);
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const alpha = deg(Math.acos(Math.max(-1, Math.min(1, cos))));
  const phi1 = base + (bend >= 0 ? 1 : -1) * alpha;
  const mid = add(root, dir(phi1, a));
  const phi2 = angleTo(mid, target);
  return { phi1, mid, end: add(mid, dir(phi2, b)) };
}

export interface Joints {
  hip: Pt;
  mid: Pt;
  sho: Pt;
  arm: Pt; // where the arms hang from
  headC: Pt;
  /** absolute angle the head's "up" points to (for drawing the face) */
  headPhi: number;
  torsoUp: number;
  upperUp: number;
  elbow: Pt;
  hand: Pt;
  elbow2: Pt;
  hand2: Pt;
  knee: Pt;
  ankle: Pt;
  toe: Pt;
  knee2: Pt;
  ankle2: Pt;
  toe2: Pt;
}

function arm(J: { arm: Pt; hip: Pt; headC: Pt }, t: number, s: number | undefined, e: number | undefined, target: SidePose["hand"], ed: number | undefined, ua = 1) {
  const a = LEN.ua * ua;
  if (target) {
    const p: Pt = target === "hip" ? add(J.hip, [9, -10]) : target === "head" ? add(J.headC, [-4, 0]) : target;
    const r = solve2(J.arm, p, a, LEN.fa, ed ?? 1);
    return { elbow: r.mid, hand: r.end };
  }
  const phiU = -t + (s ?? 0);
  const elbow = add(J.arm, dir(phiU, a));
  return { elbow, hand: add(elbow, dir(phiU + (e ?? 0), LEN.fa)) };
}

function leg(hip: Pt, t: number, h: number | undefined, k: number | undefined, foot: Pt | undefined, kd: number | undefined, ft?: number) {
  if (foot) {
    const r = solve2(hip, foot, LEN.th, LEN.sh, kd ?? 1);
    const shin = angleTo(r.mid, r.end);
    // feet planted on the floor stay flat; otherwise the foot follows the shin
    const flat = foot[1] >= FLOOR - 6;
    return { knee: r.mid, ankle: r.end, toe: add(r.end, flat ? [LEN.foot, 0] : dir(shin + 90, LEN.foot)) };
  }
  const phiT = -t + (h ?? 0);
  const knee = add(hip, dir(phiT, LEN.th));
  const phiS = phiT - (k ?? 0);
  const ankle = add(knee, dir(phiS, LEN.sh));
  return { knee, ankle, toe: add(ankle, dir(ft ?? phiS + 90, LEN.foot)) };
}

/** Forward kinematics: pose numbers → joint positions. */
export function joints(p: SidePose): Joints {
  const hip: Pt = [p.x, p.y];
  const torsoUp = 180 - p.t;
  const upperUp = torsoUp - (p.b ?? 0);
  const mid = add(hip, dir(torsoUp, LEN.lower));
  const sho = add(mid, dir(upperUp, LEN.upper));
  const headPhi = upperUp - (p.n ?? 0);
  const headC = add(sho, dir(headPhi, LEN.neck));
  const armRoot = add(sho, dir(upperUp + 180, LEN.armDrop));
  const base = { arm: armRoot, hip, headC };
  const tUpper = 180 - upperUp; // arms hang relative to the upper back
  const a1 = arm(base, tUpper, p.s, p.e, p.hand, p.ed, p.ua);
  // the far arm copies the near arm unless it's given its own angles or target
  const hand2 = p.hand2 ?? (p.s2 === undefined ? p.hand : undefined);
  const a2 = arm(base, tUpper, p.s2 ?? p.s, p.e2 ?? p.e, hand2, p.ed2 ?? p.ed, p.ua2 ?? p.ua);
  const l1 = leg(hip, p.t, p.h, p.k, p.foot, p.kd, p.ft);
  const foot2 = p.foot2 ?? (p.h2 === undefined ? p.foot : undefined);
  const l2 = leg(hip, p.t, p.h2 ?? p.h, p.k2 ?? p.k, foot2, p.kd2 ?? p.kd);
  return {
    hip,
    mid,
    sho,
    arm: armRoot,
    headC,
    headPhi,
    torsoUp,
    upperUp,
    elbow: a1.elbow,
    hand: a1.hand,
    elbow2: a2.elbow,
    hand2: a2.hand,
    knee: l1.knee,
    ankle: l1.ankle,
    toe: l1.toe,
    knee2: l2.knee,
    ankle2: l2.ankle,
    toe2: l2.toe,
  };
}

/* ---------------- interpolation ---------------- */

const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;

function lerpVal(a: unknown, b: unknown, u: number): unknown {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * u;
  if (Array.isArray(a) && Array.isArray(b)) return [lerpVal(a[0], b[0], u), lerpVal(a[1], b[1], u)];
  return u < 0.5 ? a : b;
}

export function lerpPose<P extends object>(a: P, b: P, u: number): P {
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = (a as Record<string, unknown>)[k];
    const vb = (b as Record<string, unknown>)[k];
    out[k] = va === undefined ? vb : vb === undefined ? va : lerpVal(va, vb, u);
  }
  return out as P;
}

export function cycleLength(keys: Key<object>[]) {
  return keys.reduce((a, k) => a + k.move + k.hold, 0);
}

/** The pose (and current phase label) at time `time` seconds into the looping animation. */
export function sample<P extends object>(keys: Key<P>[], time: number): { pose: P; label?: string } {
  if (keys.length === 1) return { pose: keys[0].pose, label: keys[0].label };
  const total = cycleLength(keys as Key<object>[]);
  let t = ((time % total) + total) % total;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const prev = keys[(i - 1 + keys.length) % keys.length];
    if (t < k.move) return { pose: lerpPose(prev.pose, k.pose, ease(t / k.move)), label: k.label };
    t -= k.move;
    if (t < k.hold) return { pose: k.pose, label: k.label };
    t -= k.hold;
  }
  return { pose: keys[0].pose, label: keys[0].label };
}
