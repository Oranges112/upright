import type { Area, Exercise, Phase, Pose, Routine, Settings } from "./types";
import type { SidePose } from "./gymAnim";
import { LOWER_EXERCISES, LOWER_KIND } from "./lower";

/* ---------------- body areas ---------------- */

export const AREAS: { id: Area; name: string; emoji: string; blurb: string }[] = [
  { id: "neck", name: "Neck", emoji: "🦒", blurb: "Stiff neck, tech neck, headaches" },
  { id: "upper-back", name: "Shoulders & upper back", emoji: "💪", blurb: "Rounded shoulders, tight between the blades" },
  { id: "lower-back", name: "Lower back", emoji: "🦴", blurb: "Aches after sitting" },
  { id: "hips", name: "Hips & glutes", emoji: "🍑", blurb: "Tight hips, numb bum" },
  { id: "legs", name: "Legs & calves", emoji: "🦵", blurb: "Tight or achy calves, heavy legs" },
];
export const AREA_NAME = Object.fromEntries(AREAS.map((a) => [a.id, a.name])) as Record<Area, string>;

/** Neck and upper-body exercises: which areas each helps, and a gentler swap for "This hurts". */
const UPPER_AREAS: Record<string, Area[]> = {
  "chin-tuck": ["neck"],
  "side-tilt": ["neck"],
  turn: ["neck"],
  levator: ["neck", "upper-back"],
  "upper-trap": ["neck", "upper-back"],
  nod: ["neck"],
  squeeze: ["upper-back"],
  rolls: ["upper-back", "neck"],
  "chest-opener": ["upper-back"],
  "w-to-y": ["upper-back"],
  thoracic: ["upper-back", "lower-back"],
  "tuck-hold": ["neck"],
};
const UPPER_EASIER: Record<string, string> = {
  "chin-tuck": "nod",
  "tuck-hold": "chin-tuck",
  "side-tilt": "rolls",
  turn: "nod",
  levator: "side-tilt",
  "upper-trap": "side-tilt",
  "chest-opener": "squeeze",
  "w-to-y": "squeeze",
  thoracic: "rolls",
};

const UPPER: Record<string, Exercise> = {
  "chin-tuck": {
    id: "chin-tuck",
    name: "Chin Tucks",
    tagline: "The #1 tech-neck fix",
    view: "side",
    howTo: [
      "Sit tall, eyes level, shoulders relaxed.",
      "Glide your head straight back, like making a double chin.",
      "Don't tip your head down. Think 'drawer closing'.",
    ],
    cue: "Slide your head straight back. Long neck.",
    sides: false,
    reps: 8,
    cycle: [
      { label: "Tuck", sec: 3, pose: { hx: -11, hr: 2 } },
      { label: "Release", sec: 2, pose: {} },
    ],
    discreet: true,
    targets: "Deep neck flexors",
  },
  "side-tilt": {
    id: "side-tilt",
    name: "Ear to Shoulder",
    tagline: "Side neck release",
    view: "front",
    howTo: [
      "Sit tall and let your shoulders drop.",
      "Tilt your ear toward your shoulder. Don't lift the shoulder.",
      "Breathe slowly into the stretch.",
    ],
    cue: "Shoulders heavy. Breathe into the stretch.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: { hr: 24 } }],
    discreet: true,
    targets: "Scalenes & upper traps",
  },
  turn: {
    id: "turn",
    name: "Look Over Your Shoulder",
    tagline: "Rotation mobility",
    view: "front",
    howTo: [
      "Chin level, sitting tall.",
      "Slowly turn to look over one shoulder, then the other.",
      "Move only as far as is comfortable.",
    ],
    cue: "Slow and smooth. Chin stays level.",
    sides: false,
    reps: 3,
    cycle: [
      { label: "Look left", sec: 3, pose: { fx: 15 } },
      { label: "Centre", sec: 1, pose: {} },
      { label: "Look right", sec: 3, pose: { fx: -15 } },
      { label: "Centre", sec: 1, pose: {} },
    ],
    discreet: true,
    targets: "Neck rotators",
  },
  levator: {
    id: "levator",
    name: "Nose to Armpit",
    tagline: "Levator scapulae stretch",
    view: "front",
    howTo: [
      "Turn your head about 45° to one side.",
      "Drop your nose down toward that armpit.",
      "Optional: rest that hand gently on the back of your head.",
    ],
    cue: "Gentle stretch down the back of the neck.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: { hr: 16, fx: 13, fy: 17, hand: "left" } }],
    discreet: false,
    targets: "Levator scapulae",
  },
  "upper-trap": {
    id: "upper-trap",
    name: "Upper Trap Stretch",
    tagline: "Melt the shoulder knots",
    view: "front",
    howTo: [
      "Tilt your ear toward your shoulder.",
      "Rest the same-side hand on top of your head. Let its weight assist.",
      "Never pull hard. Opposite shoulder stays down.",
    ],
    cue: "Let the hand rest. Don't pull.",
    sides: true,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: { hr: 27, sy: 2, hand: "left" } }],
    discreet: false,
    targets: "Upper trapezius",
  },
  nod: {
    id: "nod",
    name: "Slow Nods",
    tagline: "Gentle flexion & extension",
    view: "side",
    howTo: [
      "Sit tall, shoulders relaxed.",
      "Slowly look up toward the ceiling, then down toward your chest.",
      "Keep the movement smooth and pain-free.",
    ],
    cue: "Slow, smooth, breathe.",
    sides: false,
    reps: 4,
    cycle: [
      { label: "Look up", sec: 3, pose: { hr: -26 } },
      { label: "Look down", sec: 3, pose: { hr: 28 } },
    ],
    discreet: true,
    targets: "Neck mobility",
  },
  squeeze: {
    id: "squeeze",
    name: "Shoulder Blade Squeeze",
    tagline: "Pull the shoulders back",
    view: "side",
    howTo: [
      "Sit or stand tall, arms relaxed.",
      "Squeeze your shoulder blades back and down, like pinching a pencil between them.",
      "Don't shrug and don't arch your lower back.",
    ],
    cue: "Back and down. Open the chest.",
    sides: false,
    reps: 8,
    cycle: [
      { label: "Squeeze", sec: 3, pose: { sx: -12, tr: -3, arm: -12 } },
      { label: "Release", sec: 2, pose: {} },
    ],
    discreet: true,
    targets: "Rhomboids & mid traps",
  },
  rolls: {
    id: "rolls",
    name: "Shoulder Rolls",
    tagline: "Loosen up",
    view: "side",
    howTo: [
      "Arms relaxed by your sides.",
      "Roll your shoulders up, back, and down in big slow circles.",
    ],
    cue: "Up, back, and down.",
    sides: false,
    reps: 6,
    cycle: [
      { label: "Up", sec: 1, pose: { sy: -8 } },
      { label: "Back", sec: 1, pose: { sx: -8, sy: -3, arm: -6 } },
      { label: "Down", sec: 1, pose: { sx: -3, sy: 3 } },
    ],
    discreet: true,
    targets: "Shoulders & traps",
  },
  "chest-opener": {
    id: "chest-opener",
    name: "Chest Opener",
    tagline: "Undo the hunch",
    view: "side",
    howTo: [
      "Clasp your hands behind your back (or hold the chair back).",
      "Draw your shoulders back and lift your chest.",
      "Keep your chin gently tucked.",
    ],
    cue: "Proud chest. Long neck.",
    sides: false,
    reps: 2,
    cycle: [
      { label: "Hold", sec: 15, pose: { arm: -38, sx: -7, tr: -4, hr: -3 } },
      { label: "Release", sec: 3, pose: {} },
    ],
    discreet: false,
    targets: "Pecs & front shoulders",
  },
  "w-to-y": {
    id: "w-to-y",
    name: "W to Y Raises",
    tagline: "Posture muscle builder",
    view: "front",
    howTo: [
      "Arms in a 'W': elbows bent, by your sides at shoulder height.",
      "Squeeze shoulder blades and press arms up into a 'Y'.",
      "Keep ribs down and chin tucked.",
    ],
    cue: "Squeeze the blades as you reach.",
    sides: false,
    reps: 8,
    cycle: [
      { label: "W", sec: 2, pose: { la: 72, le: 108, ra: 72, re: 108 } },
      { label: "Y", sec: 2, pose: { la: 150, le: 0, ra: 150, re: 0 } },
    ],
    discreet: false,
    targets: "Lower traps & rotator cuff",
  },
  thoracic: {
    id: "thoracic",
    name: "Seated Back Extension",
    tagline: "Unlock the upper back",
    view: "side",
    howTo: [
      "Sit near the front of your chair. Hands behind your head.",
      "Lean your upper back gently over the top of the chair.",
      "Look slightly up as you open. Return slowly.",
    ],
    cue: "Open through the upper back.",
    sides: false,
    reps: 5,
    cycle: [
      { label: "Lean back", sec: 4, pose: { tr: -14, hr: -10, arm: -10 } },
      { label: "Return", sec: 2, pose: {} },
    ],
    discreet: false,
    targets: "Thoracic spine",
  },
  "tuck-hold": {
    id: "tuck-hold",
    name: "Chin-Tuck Hold",
    tagline: "Endurance finisher",
    view: "side",
    howTo: [
      "Do a chin tuck and hold it.",
      "Keep breathing and keep your eyes level.",
      "Relax your jaw and shoulders.",
    ],
    cue: "Hold it. Breathe. Stay tall.",
    sides: false,
    reps: 1,
    cycle: [{ label: "Hold", sec: 20, pose: { hx: -11, hr: 4 } }],
    discreet: true,
    targets: "Deep neck flexor endurance",
  },
};

export const EXERCISES: Record<string, Exercise> = {
  ...Object.fromEntries(Object.entries(UPPER).map(([id, ex]) => [id, { ...ex, areas: UPPER_AREAS[id], easier: UPPER_EASIER[id] }])),
  ...LOWER_EXERCISES,
};

export const ROUTINES: Routine[] = [
  {
    id: "quickie",
    areas: ["neck", "upper-back"],
    name: "Desk Quickie",
    blurb: "The essentials. Fast enough for any break.",
    emoji: "⚡",
    exercises: ["chin-tuck", "side-tilt", "squeeze", "turn"],
    reps: { squeeze: 6, turn: 2 },
    holdSec: { "side-tilt": 15 },
    gradient: ["#5eead4", "#38bdf8"],
  },
  {
    id: "stealth",
    areas: ["neck", "upper-back"],
    name: "Stealth Mode",
    blurb: "Seated and subtle. Nobody at work will notice.",
    emoji: "🥷",
    exercises: ["chin-tuck", "squeeze", "rolls", "turn", "tuck-hold"],
    reps: { "chin-tuck": 6, squeeze: 6, turn: 2 },
    holdSec: { "tuck-hold": 15 },
    gradient: ["#a78bfa", "#6366f1"],
  },
  {
    id: "reset",
    areas: ["neck", "upper-back"],
    name: "Desk Reset",
    blurb: "A slightly deeper release for stiff afternoons.",
    emoji: "🌿",
    exercises: ["chin-tuck", "side-tilt", "levator", "rolls", "squeeze"],
    reps: { "chin-tuck": 6, squeeze: 6 },
    holdSec: { "side-tilt": 15, levator: 15 },
    gradient: ["#86efac", "#14b8a6"],
  },
  {
    id: "full",
    areas: ["neck", "upper-back"],
    name: "Full Fix",
    blurb: "The complete tech-neck routine. Best done daily.",
    emoji: "🏆",
    exercises: [
      "chin-tuck",
      "nod",
      "side-tilt",
      "levator",
      "upper-trap",
      "turn",
      "rolls",
      "squeeze",
      "chest-opener",
      "w-to-y",
      "thoracic",
      "tuck-hold",
    ],
    gradient: ["#fdba74", "#f472b6"],
  },
];

ROUTINES.push(
  {
    id: "stretch",
    name: "Quick Stretch",
    blurb: "Stand up for a minute. Your whole body says thanks.",
    emoji: "🧍",
    standing: true,
    exercises: ["reach-up", "calf-raise", "standing-back-extension"],
    reps: { "calf-raise": 6, "standing-back-extension": 3 },
    gradient: ["#fde68a", "#fb923c"],
  },
  {
    id: "lower",
    name: "Hips & Lower Back",
    blurb: "Undo a day in the chair: hips, glutes and lower back.",
    emoji: "🍑",
    areas: ["hips", "lower-back"],
    exercises: ["seated-pelvic-tilt", "glute-squeeze", "figure-4", "standing-hip-flexor", "standing-back-extension"],
    reps: { "seated-pelvic-tilt": 4, "glute-squeeze": 6, "standing-back-extension": 3 },
    gradient: ["#f9a8d4", "#c084fc"],
  },
  {
    id: "legs",
    name: "Legs & Calves",
    blurb: "For tight, heavy or achy legs after sitting.",
    emoji: "🦵",
    areas: ["legs"],
    exercises: ["ankle-pumps", "seated-hamstring", "calf-raise", "calf-stretch"],
    reps: { "calf-raise": 8 },
    gradient: ["#93c5fd", "#34d399"],
  },
);

/** Your areas and the moves you've said hurt (Settings). */
export type Prefs = Pick<Settings, "areas" | "skip"> & { showAll?: boolean };

/** Does this routine / exercise help one of your areas? (No areas picked = everything is yours.) */
export function forYou(areas: Area[] | undefined, mine: Area[] | undefined) {
  if (!mine || mine.length === 0) return true;
  if (!areas || areas.length === 0) return true; // for everyone (e.g. the quick stretch)
  return areas.some((a) => mine.includes(a));
}

/** The best moves for each area, in the order they go into "My Mix". */
const MIX_PICKS: Record<Area, string[]> = {
  neck: ["chin-tuck", "side-tilt", "turn"],
  "upper-back": ["squeeze", "chest-opener", "w-to-y"],
  "lower-back": ["seated-pelvic-tilt", "standing-back-extension"],
  hips: ["figure-4", "standing-hip-flexor", "glute-squeeze"],
  legs: ["ankle-pumps", "calf-raise", "seated-hamstring"],
};

/** A short routine made from your areas: about 2 moves each, never more than 6 moves. */
export function myMix(prefs?: Partial<Prefs>): Routine {
  const areas = prefs?.areas?.length ? prefs.areas : (["neck", "upper-back"] as Area[]);
  const per = areas.length >= 4 ? 1 : 2;
  const ids: string[] = [];
  for (const a of areas) {
    let n = 0;
    for (const id of MIX_PICKS[a]) {
      const swap = resolveSkip(id, prefs?.skip);
      if (swap && !ids.includes(swap) && n < per) {
        ids.push(swap);
        n++;
      }
    }
  }
  return {
    id: "mix",
    name: "My Mix",
    blurb: `Made for you: ${areas.map((a) => AREA_NAME[a].toLowerCase()).join(", ")}.`,
    emoji: "✨",
    areas,
    exercises: ids.slice(0, 6),
    reps: { "chin-tuck": 6, squeeze: 6, "calf-raise": 8, "glute-squeeze": 6, "seated-pelvic-tilt": 4, "standing-back-extension": 3, turn: 2 },
    holdSec: { "side-tilt": 15, "figure-4": 20 },
    gradient: ["#fcd34d", "#f472b6"],
  };
}

/** A move you said hurts is swapped for its gentler version (or left out if that hurts too). */
export function resolveSkip(id: string, skip?: string[]): string | null {
  let cur: string | undefined = id;
  const seen = new Set<string>();
  while (cur && skip?.includes(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = EXERCISES[cur]?.easier;
  }
  return cur && !skip?.includes(cur) ? cur : null;
}

/** A routine with the moves you said hurt swapped out. */
export function withoutSkipped(r: Routine, skip?: string[]): Routine {
  if (!skip?.length) return r;
  const ids: string[] = [];
  for (const id of r.exercises) {
    const x = resolveSkip(id, skip);
    if (x && !ids.includes(x)) ids.push(x);
  }
  return ids.length ? { ...r, exercises: ids } : r;
}

export function getRoutine(id: string, prefs?: Partial<Prefs>): Routine {
  const r = id === "mix" ? myMix(prefs) : (ROUTINES.find((x) => x.id === id) ?? ROUTINES[0]);
  return withoutSkipped(r, prefs?.skip);
}

/** Routines for your areas first (then the rest, if you want to see everything). */
export function routinesFor(prefs: Partial<Prefs>): { mine: Routine[]; other: Routine[] } {
  const all = [...(prefs.areas && prefs.areas.length > 0 ? [myMix(prefs)] : []), ...ROUTINES];
  const mine = all.filter((r) => forYou(r.areas, prefs.areas)).map((r) => withoutSkipped(r, prefs.skip));
  const other = all.filter((r) => !forYou(r.areas, prefs.areas));
  return { mine, other };
}

export function mirrorPose(p: Pose): Pose {
  return {
    ...p,
    hr: p.hr ? -p.hr : p.hr,
    fx: p.fx ? -p.fx : p.fx,
    la: p.ra,
    le: p.re,
    ra: p.la,
    re: p.le,
    hand: p.hand === "left" ? "right" : p.hand === "right" ? "left" : undefined,
  };
}

export type StepKind = "prep" | "work" | "switch" | "done";

export interface Step {
  kind: StepKind;
  exerciseId: string;
  label: string;
  sec: number;
  pose: Pose;
  /** 1-based rep, and total reps for this exercise segment */
  rep: number;
  reps: number;
  side?: "left" | "right";
  /** index of exercise within routine */
  exIndex: number;
  /** full-body pose, for exercises drawn with the full-body figure */
  body?: SidePose;
}

export const PREP_SEC = 5;
export const SWITCH_SEC = 3;

/* ---------------- intensity ---------------- */

export type Level = 1 | 2 | 3 | 4;

export const LEVEL_INFO: Record<Level, { name: string; blurb: string }> = {
  1: { name: "Gentle", blurb: "Shorter holds. For sore days or just starting out." },
  2: { name: "Standard", blurb: "The default. Builds the habit." },
  3: { name: "Strong", blurb: "~6s chin tucks, longer holds. Real strength work." },
  4: { name: "Athlete", blurb: "10s chin tucks, extra reps. Deep-neck-flexor training." },
};

/**
 * What kind of work each exercise is. Only effort exercises get harder:
 * - strength: holding a contraction longer / more reps = more effective (progressive overload)
 * - stretch: holds lengthen a little, up to ~30s; pulling harder doesn't help
 * - mobility: smooth movement through range; "harder" adds nothing, so unchanged
 */
export const KIND: Record<string, "strength" | "stretch" | "mobility"> = {
  "chin-tuck": "strength",
  squeeze: "strength",
  "w-to-y": "strength",
  "tuck-hold": "strength",
  "side-tilt": "stretch",
  levator: "stretch",
  "upper-trap": "stretch",
  "chest-opener": "stretch",
  turn: "mobility",
  nod: "mobility",
  rolls: "mobility",
  thoracic: "mobility",
  ...LOWER_KIND,
};

const REST_LABELS = new Set(["Release", "Centre", "Return", "Down"]);
const REP_FACTOR = { 1: 0.7, 2: 1, 3: 2, 4: 3.4 } as const; // 3s tuck -> 2, 3, 6, 10
const REP_EXTRA = { 1: -2, 2: 0, 3: 0, 4: 2 } as const;
const STRENGTH_HOLD = { 1: 0.75, 2: 1, 3: 1.5, 4: 2 } as const; // 20s -> 15, 20, 30, 40
const STRETCH_HOLD = { 1: 0.75, 2: 1, 3: 1.35, 4: 1.5 } as const; // 20s -> 15, 20, 27, 30

function scalePhase(id: string, ph: Phase, level: Level): Phase {
  const kind = KIND[id] ?? "mobility";
  if (level === 2 || kind === "mobility" || REST_LABELS.has(ph.label)) return ph;
  let sec = ph.sec;
  if (ph.label === "Hold") {
    sec = ph.sec * (kind === "strength" ? STRENGTH_HOLD[level] : STRETCH_HOLD[level]);
    sec = Math.min(sec, kind === "strength" ? 45 : 30);
  } else if (kind === "strength") {
    sec = Math.min(ph.sec * REP_FACTOR[level], 10);
  }
  return { ...ph, sec: Math.max(1, Math.round(sec)) };
}

function scaleReps(id: string, reps: number, level: Level) {
  const kind = KIND[id] ?? "mobility";
  if (kind !== "strength" || reps <= 1) return reps;
  return Math.max(3, reps + REP_EXTRA[level]);
}

/** Expand a routine into a flat, timed list of steps that the player runs through. */
export function buildTimeline(routine: Routine, level: Level = 2): Step[] {
  const steps: Step[] = [];
  routine.exercises.forEach((id, exIndex) => {
    const ex = EXERCISES[id];
    if (!ex) return;
    const reps = scaleReps(id, routine.reps?.[id] ?? ex.reps, level);
    const hold = routine.holdSec?.[id];
    const cycle: Phase[] = ex.cycle
      .map((ph) => (hold && ph.label === "Hold" ? { ...ph, sec: hold } : ph))
      .map((ph) => scalePhase(id, ph, level));
    steps.push({
      kind: "prep",
      exerciseId: id,
      label: "Get ready",
      sec: exIndex === 0 ? PREP_SEC + 2 : PREP_SEC,
      pose: {},
      rep: 0,
      reps,
      exIndex,
    });
    const sides: ("left" | "right" | undefined)[] = ex.sides ? ["left", "right"] : [undefined];
    sides.forEach((side, si) => {
      if (si > 0) {
        steps.push({
          kind: "switch",
          exerciseId: id,
          label: "Switch sides",
          sec: SWITCH_SEC,
          pose: {},
          rep: 0,
          reps,
          side,
          exIndex,
        });
      }
      for (let r = 1; r <= reps; r++) {
        for (const ph of cycle) {
          steps.push({
            kind: "work",
            exerciseId: id,
            label: ph.label,
            sec: ph.sec,
            pose: side === "right" ? mirrorPose(ph.pose) : ph.pose,
            body: ph.body,
            rep: r,
            reps,
            side,
            exIndex,
          });
        }
      }
    });
  });
  return steps;
}

export function routineSeconds(routine: Routine, level: Level = 2): number {
  return buildTimeline(routine, level).reduce((a, s) => a + s.sec, 0);
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m} min`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
