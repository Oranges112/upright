/**
 * "Holding for 12 min": how long you've kept good posture, forgivingly.
 * A short slip (under GRACE_MS of slouching in a row) doesn't reset the count; it just carries on
 * once you sit back up. Only a real, sustained slouch, or turning Guard off, starts it again.
 */

export const GRACE_MS = 20_000;

export interface Hold {
  /** when the current good stretch began */
  since: number | null;
  /** when the current slouch began (null while you're fine) */
  badSince: number | null;
}

export const NO_HOLD: Hold = { since: null, badSince: null };

export function nextHold(h: Hold, state: "good" | "bad" | "off" | "other", now: number): Hold {
  if (state === "off") return NO_HOLD;
  if (state === "good") return { since: h.since ?? now, badSince: null };
  if (state === "bad") {
    const badSince = h.badSince ?? now;
    return now - badSince > GRACE_MS ? { since: null, badSince } : { since: h.since, badSince };
  }
  return h; // looking away, recalibrating...: neither adds nor breaks the streak
}
