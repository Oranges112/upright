/**
 * Form check: judges neck exercises from the front camera, using the same on-device face
 * tracking as Posture Guard. Each exercise is compared with how you sat during "Get ready".
 *
 * These are rough, camera-based checks (beta): good at catching the classic mistakes,
 * like nodding instead of gliding back in a chin tuck, not a replacement for a physio.
 */
import type { Sample } from "./face";

export type Tone = "good" | "warn" | "bad" | "info";
export interface Feedback {
  tone: Tone;
  text: string;
}

/** Your neutral position for this exercise (median of the "Get ready" seconds). */
export type Baseline = Pick<Sample, "w" | "pitch" | "roll" | "yaw">;

/** Exercises the camera can judge, and which phase labels are the "doing it" part. */
const CHECKED: Record<string, string[]> = {
  "chin-tuck": ["Tuck"],
  "tuck-hold": ["Hold"],
  "side-tilt": ["Hold"],
  "upper-trap": ["Hold"],
  levator: ["Hold"],
  turn: ["Look left", "Look right"],
  nod: ["Look up", "Look down"],
};

export function isChecked(exerciseId: string) {
  return exerciseId in CHECKED;
}

/** Is this phase one we score (vs. a rest phase like "Release" or "Centre")? */
export function isScoredPhase(exerciseId: string, label: string) {
  return CHECKED[exerciseId]?.includes(label) ?? false;
}

const d = (a: number | null, b: number | null | undefined) => (a == null || b == null ? null : a - b);

/**
 * Judge one moment. Returns null when there's nothing to say (rest phases).
 * Thresholds are deliberately forgiving: it's better to miss a small error than nag a good rep.
 */
export function judge(exerciseId: string, label: string, s: Sample, base: Baseline): Feedback | null {
  if (!isScoredPhase(exerciseId, label)) return null;
  const dPitch = d(s.pitch, base.pitch);
  const dRoll = d(s.roll, base.roll);
  const dYaw = d(s.yaw, base.yaw);
  const dSize = s.w / base.w - 1; // negative = head moved back, away from the screen

  switch (exerciseId) {
    case "chin-tuck":
    case "tuck-hold": {
      if (dPitch != null && dPitch > 0.15) return { tone: "bad", text: "You're nodding down. Glide straight back instead." };
      if (dRoll != null && Math.abs(dRoll) > 10) return { tone: "warn", text: "Keep your head level, not tilted." };
      if (dSize < -0.025) return { tone: "good", text: exerciseId === "tuck-hold" ? "Great hold. Keep breathing." : "Nice tuck ✓" };
      return { tone: "warn", text: "Glide your head a little further back." };
    }
    case "side-tilt":
    case "upper-trap": {
      if (dYaw != null && Math.abs(dYaw) > 0.3) return { tone: "warn", text: "Keep your nose pointing forward. Don't twist." };
      if (dRoll != null && Math.abs(dRoll) >= 12) return { tone: "good", text: `Good stretch ✓  ${Math.round(Math.abs(dRoll))}° tilt` };
      return { tone: "warn", text: "Tilt your ear a little further toward your shoulder." };
    }
    case "levator": {
      const turned = dYaw != null && Math.abs(dYaw) > 0.12;
      const down = dPitch != null && dPitch > 0.1;
      if (turned && down) return { tone: "good", text: "Good: nose toward your armpit ✓" };
      if (!turned) return { tone: "warn", text: "Turn your head a little to the side first." };
      return { tone: "warn", text: "Now look down toward your armpit." };
    }
    case "turn": {
      if (dPitch != null && Math.abs(dPitch) > 0.18) return { tone: "warn", text: "Keep your chin level as you turn." };
      if (dYaw != null && Math.abs(dYaw) > 0.3) return { tone: "good", text: "Good turn ✓" };
      return { tone: "warn", text: "Turn a little further, if it's comfortable." };
    }
    case "nod": {
      if (dPitch == null) return null;
      if (label === "Look up") return dPitch < -0.1 ? { tone: "good", text: "Good ✓" } : { tone: "warn", text: "Look up a little further." };
      return dPitch > 0.1 ? { tone: "good", text: "Good ✓" } : { tone: "warn", text: "Bring your chin down a little further." };
    }
  }
  return null;
}

/** Tracks whether each scored phase hit good form for long enough to count. */
export class RepScorer {
  good = 0;
  total = 0;
  private goodFor = 0;
  private active = false;

  /** call when a new step starts */
  begin(scored: boolean) {
    this.finish();
    this.active = scored;
    this.goodFor = 0;
  }
  /** call each time feedback is computed */
  update(fb: Feedback | null, dt: number) {
    if (this.active && fb?.tone === "good") this.goodFor += dt;
  }
  /** close out the current step */
  finish() {
    if (!this.active) return;
    this.total++;
    if (this.goodFor >= 0.6) this.good++;
    this.active = false;
  }
}
