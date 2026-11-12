/**
 * "Holding for 12 min": how long you've kept good posture, forgivingly.
 * A short slip doesn't reset the count; it just carries on once you sit back up. Only slouching
 * for longer than the grace period in a row (by default just past the nudge), or turning Guard
 * off, starts it again. You can set the grace period in Guard's settings.
 */

export const GRACE_MS = 20_000;
/** default: reset a few seconds after the nudge would fire */
export const AFTER_NUDGE_SEC = 5;

export function holdGraceMs(holdResetSec: number | undefined, nudgeDelaySec: number) {
  return (holdResetSec ?? nudgeDelaySec + AFTER_NUDGE_SEC) * 1000;
}

export interface Hold {
  /** when the current good stretch began */
  since: number | null;
  /** when the current slouch began (null while you're fine) */
  badSince: number | null;
}

export const NO_HOLD: Hold = { since: null, badSince: null };

export function nextHold(h: Hold, state: "good" | "bad" | "off" | "other", now: number, graceMs = GRACE_MS): Hold {
  if (state === "off") return NO_HOLD;
  if (state === "good") return { since: h.since ?? now, badSince: null };
  if (state === "bad") {
    const badSince = h.badSince ?? now;
    return now - badSince > graceMs ? { since: null, badSince } : { since: h.since, badSince };
  }
  // the camera can't see you (you got up), recalibrating, camera moved: pauses the count, doesn't break it
  return h;
}
