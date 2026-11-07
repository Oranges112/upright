export type View = "side" | "front";

/** Numeric pose parameters for the animated figure. All default to 0. */
export interface Pose {
  /** head translate x / y (px in figure space) */
  hx?: number;
  hy?: number;
  /** head rotation in degrees (front: tilt to shoulder, side: nod; +down) */
  hr?: number;
  /** face feature offset (front view: turning the head left/right, nodding) */
  fx?: number;
  fy?: number;
  /** shrug (negative = up) */
  sy?: number;
  /** shoulders back (side view, negative = back) */
  sx?: number;
  /** torso lean (side view, negative = lean back) */
  tr?: number;
  /** front-view arms: upper arm angle & forearm angle (deg), left / right */
  la?: number;
  le?: number;
  ra?: number;
  re?: number;
  /** side-view arm swing (negative = behind) */
  arm?: number;
  /** hand resting on head (front view) */
  hand?: "left" | "right";
}

export interface Phase {
  label: string;
  sec: number;
  pose: Pose;
}

export interface Exercise {
  id: string;
  name: string;
  tagline: string;
  view: View;
  /** shown in the "get ready" card */
  howTo: string[];
  /** coaching cue spoken/shown while working */
  cue: string;
  /** done once for left side then mirrored for right */
  sides: boolean;
  reps: number;
  cycle: Phase[];
  /** can be done at a desk without anyone noticing */
  discreet: boolean;
  targets: string;
}

export interface Routine {
  id: string;
  name: string;
  blurb: string;
  emoji: string;
  exercises: string[];
  /** overrides for reps per exercise */
  reps?: Record<string, number>;
  /** overrides for "Hold" phase length per exercise */
  holdSec?: Record<string, number>;
  gradient: [string, string];
}

export interface SessionLog {
  id: string;
  routineId: string;
  startedAt: number;
  /** local YYYY-MM-DD */
  day: string;
  durationSec: number;
  completed: boolean;
}

export interface CheckIn {
  id: string;
  at: number;
  day: string;
  /** neck stiffness / discomfort 0 (none) - 10 (worst) */
  stiffness: number;
}

/** endurance: seconds held · wall: cm gap · angle: forward-head angle in degrees from photo (lower = better) */
export type TestType = "endurance" | "wall" | "angle";

/** One device's Posture Guard totals for one day. */
export interface GuardDay {
  id: string; // `${day}:${deviceId}`
  day: string;
  goodSec: number;
  totalSec: number;
  nudges: number;
  updatedAt: number;
}

export interface PostureTest {
  id: string;
  at: number;
  day: string;
  type: TestType;
  /** endurance: seconds held; wall: cm from back of head to wall */
  value: number;
}

export interface Settings {
  remindersOn: boolean;
  intervalMin: number;
  startHour: number; // 0-23, local
  endHour: number; // 0-24, local
  days: number[]; // 0=Sun ... 6=Sat
  dailyGoal: number;
  sound: boolean;
  ambient: boolean;
  voice: boolean;
  defaultRoutine: string;
  /** intensity 1 Gentle - 4 Athlete */
  level: 1 | 2 | 3 | 4;
  theme: "system" | "light" | "dark";
  tz: string;
  updatedAt: number;
}

export interface Doc {
  settings: Settings;
  sessions: SessionLog[];
  checkins: CheckIn[];
  tests: PostureTest[];
  guard: GuardDay[];
}
