"use client";

/**
 * Posture Guard: on-device slouch detection with the webcam.
 *
 * How it works: we track your face with MediaPipe's tiny face detector (runs locally,
 * nothing is uploaded). After you calibrate while sitting tall, these signals reveal tech neck:
 *  - your face gets BIGGER in the frame  -> head is pushed forward toward the screen
 *  - your face DROPS in the frame        -> you're sinking / slumping
 *  - nose drops relative to ears          -> chin dropping
 *  - eye line tilts                       -> head tilted
 * If one holds for a while, you get a gentle nudge.
 *
 * Everything is measured against YOUR calibration, so a raised or tilted laptop is fine as
 * long as it stays put. If the camera moves (lid tilted, laptop raised or moved), we notice
 * and ask for a recalibration. Turning to look at another screen keeps being judged, using
 * measurements that don't change when you turn your head.
 */

import { addGuardTime, getMeta, setMeta, type GuardBase } from "./store";
import { sound } from "./sound";
import { detectFace, getFaceDetector, measureFace, median, openCamera, type Sample } from "./face";
import { asset } from "./base";

export type GuardStatus =
  | "off"
  | "starting"
  | "uncalibrated"
  | "calibrating"
  | "good"
  | "forward" // head pushed toward the screen
  | "low" // sinking into the chair
  | "down" // chin dropped / looking down
  | "tilt" // head tilted to one side
  | "looking" // no longer used: turning away is still judged (kept so old saved states still parse)
  | "moved" // the camera moved since calibrating: not counted until you recalibrate
  | "away"
  | "error";

export const BAD: GuardStatus[] = ["forward", "low", "down", "tilt"];


export interface GuardState {
  status: GuardStatus;
  error?: string;
  stream: MediaStream | null;
  /** live, smoothed measurements (fractions of the frame) */
  w: number;
  cy: number;
  /** 0..1 how far past the threshold you are (for the meter) */
  drift: number;
  badFor: number;
  sessionGood: number;
  sessionTotal: number;
  sessionNudges: number;
  calibrateLeft: number;
  /** true when the saved calibration predates the newer checks (turn-proof measures) */
  oldCalibration: boolean;
  /** the camera seems to have moved since calibrating (laptop moved, raised, or lid tilted) */
  moved: boolean;
  /** you're turned toward another screen, and still being checked */
  turned: boolean;
  /** a big slouch that hasn't budged for minutes: maybe the laptop was raised or tilted, not you */
  maybeMoved: boolean;
  /** when the last nudge fired (widget flashes) */
  nudgedAt: number;
}

/**
 * Thresholds per sensitivity, as change from your calibrated posture.
 * size: face grows by this fraction  ·  drop: eyes sink by this fraction of the frame
 * pitch: nose drops relative to ears by this x eye distance  ·  roll: degrees of side tilt
 */
export const THRESH: Record<1 | 2 | 3, { size: number; drop: number; pitch: number; roll: number }> = {
  1: { size: 0.2, drop: 0.12, pitch: 0.3, roll: 16 }, // relaxed
  2: { size: 0.13, drop: 0.08, pitch: 0.2, roll: 11 }, // normal
  3: { size: 0.08, drop: 0.05, pitch: 0.13, roll: 8 }, // strict
};
/**
 * Head turn, as nose offset / eye distance (about 0.55 x tan(angle)):
 *  - under TURN_SMALL (~15°) you're facing the screen: every measure is reliable
 *  - up to TURN_AWAY (~55°) you're looking at another screen: judged with turn-proof measures
 *  - beyond that you've turned right away: still judged, on the measures that survive a big turn
 *    (sinking, leaning in, chin dropping). Looking away is no excuse to slouch. Only head tilt is
 *    skipped, because a side-on face makes it unreliable. If the camera can't see your face at all,
 *    nothing can be measured, so that time isn't counted.
 */
const TURN_SMALL = 0.15;
const TURN_OLD = 0.32; // old calibrations (no turn-proof measures) stop judging here, as before
const TURN_AWAY = 0.8;
/** thresholds are this much looser while turned: the side-on face is harder to measure */
const TURNED_SLACK = 1.25;
/** once flagged, you must get back under this fraction of the threshold to be "good" (no flicker) */
const RELEASE = 0.75;
const WINDOW = 6; // samples in the rolling median (~3 s)
/** setup changed: you'd never be this much further away / higher in the frame from slouching */
const MOVED_FAR = 0.72;
const MOVED_UP = 2.5; // x the "sinking" threshold, upward
const MOVED_SEC = 20;
const STUCK_SCORE = 2;
const STUCK_SEC = 120;

export type Thresholds = (typeof THRESH)[1 | 2 | 3];
export type Measures = Pick<Sample, "w" | "cy" | "pitch" | "roll" | "yaw" | "em" | "pitchM" | "edm">;

export interface Assessment {
  scores: [GuardStatus, number][];
  /** turned toward another screen (still judged) */
  turned: boolean;
  /** turned right away: judged on fewer measures */
  away: boolean;
  /** how big your face is vs calibration (1 = same distance), turn-proof when possible */
  size: number | null;
  /** setup seems to have moved this tick */
  movedNow: boolean;
}

/**
 * Score your posture against your calibration. Pure, so it's easy to test.
 * Each score is 0 when you're as you calibrated and 1 right at the threshold.
 */
export function assess(m: Measures, base: GuardBase, t: Thresholds): Assessment {
  const turn = m.yaw != null && base.yaw != null ? Math.abs(m.yaw - base.yaw) : 0;
  const proof = base.em != null && m.em != null; // turn-proof measures available
  const away = turn > (proof ? TURN_AWAY : TURN_OLD);
  const turned = !away && turn >= TURN_SMALL;
  const k = turned || away ? TURNED_SLACK : 1;

  // distance to the camera: face width shrinks as you turn, eye-to-mouth doesn't
  const rW = m.w / base.w;
  const rEm = proof ? m.em! / base.em! : null;
  // turned right away both shrink, so the larger one is the fairest (never flags you for turning)
  const size = away ? (rEm == null ? null : Math.max(rW, rEm)) : rEm == null ? (turned ? null : rW) : turned ? rEm : (rW + rEm) / 2;

  // chin down: ear-to-nose height over eye-to-mouth survives turning; the old measure doesn't
  let down = 0;
  if (base.pitchM != null && m.pitchM != null) down = (m.pitchM - base.pitchM) / t.pitch;
  else if (!turned && !away && base.pitch != null && m.pitch != null) down = (m.pitch - base.pitch) / t.pitch;

  // tilt: turning squashes the eye line sideways, which exaggerates the angle; undo that
  let tilt = 0;
  if (!away && m.roll != null && base.roll != null) {
    let roll = m.roll;
    if (turned && m.edm != null && base.edm != null && base.edm > 0) {
      const squash = Math.min(1, m.edm / base.edm);
      roll = (Math.atan(Math.tan((roll * Math.PI) / 180) * squash) * 180) / Math.PI;
    }
    tilt = Math.abs(roll - base.roll) / t.roll;
  }

  const scores: [GuardStatus, number][] = [
    ["forward", size == null ? 0 : (size - 1) / (t.size * k)],
    ["low", (m.cy - base.cy) / (t.drop * k)],
    ["down", down / k],
    ["tilt", tilt / k],
  ];
  scores.sort((p, q) => q[1] - p[1]);

  const movedNow = (size != null && size < MOVED_FAR) || base.cy - m.cy > MOVED_UP * t.drop;
  return { scores, turned, away, size, movedNow };
}


/** What each problem means and how to fix it (widget, Guard screen and notifications). */
export const ISSUE: Partial<Record<GuardStatus, { what: string; fix: string; notify: string }>> = {
  forward: {
    what: "Head forward",
    fix: "Slide your chin back",
    notify: "Your head is creeping toward the screen. Slide your chin straight back, ears over shoulders.",
  },
  low: {
    what: "Slumping",
    fix: "Sit tall, lift your chest",
    notify: "You're sinking into your chair. Sit tall, lift your chest, shoulders back.",
  },
  down: {
    what: "Chin dropping",
    fix: "Lift your chin, eyes level",
    notify: "Your chin is dropping toward your chest. Lift it so your eyes are level, and raise the screen if you can.",
  },
  tilt: {
    what: "Head tilted",
    fix: "Level your head",
    notify: "Your head is tilted to one side. Level it and relax your shoulders.",
  },
};

const NUDGES = [
  ["Head back over your shoulders 🙆", "Quick chin tuck, sit tall."],
  ["Posture check ✨", "Your head's drifting toward the screen."],
  ["Long neck, proud chest 🌿", "Slide your head back and relax your shoulders."],
  ["Sneaky slouch spotted 👀", "Sit tall for a sec. Your neck will thank you."],
];

/**
 * Browsers throttle timers in background tabs (down to once a minute after a while),
 * which would stop the guard while you work in other apps. Timers inside a Web Worker
 * are not throttled that way, so we tick from one.
 */
function workerInterval(fn: () => void, ms: number): () => void {
  try {
    const src = `let t;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const w = new Worker(url);
    w.onmessage = () => fn();
    w.postMessage(ms);
    return () => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

class Guard {
  state: GuardState = this.fresh();
  private listeners = new Set<() => void>();
  private detector: any = null;
  private video: HTMLVideoElement | null = null;
  private timer: (() => void) | null = null;
  private lastTick = 0;
  private lastNudge = 0;
  private samples: Sample[] = [];
  private recent: Sample[] = [];
  private movedFor = 0;
  private stuckFor = 0;
  private calibrating = false;
  private pending = { good: 0, total: 0, nudges: 0 };
  private lastFlush = 0;

  private fresh(): GuardState {
    return { status: "off", stream: null, w: 0, cy: 0, drift: 0, badFor: 0, sessionGood: 0, sessionTotal: 0, sessionNudges: 0, calibrateLeft: 0, nudgedAt: 0, oldCalibration: false, moved: false, turned: false, maybeMoved: false };
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = () => this.state;
  private set(patch: Partial<GuardState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  get running() {
    return this.state.status !== "off" && this.state.status !== "error";
  }

  async start() {
    if (this.running) return;
    this.set({ ...this.fresh(), status: "starting" });
    try {
      const stream = await openCamera();
      // Keep a hidden <video> in the page so detection continues on every screen.
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.srcObject = stream;
      Object.assign(v.style, { position: "fixed", left: "-10px", top: "-10px", width: "2px", height: "2px", opacity: "0", pointerEvents: "none" });
      document.body.appendChild(v);
      await v.play().catch(() => {});
      this.video = v;

      if (!this.detector) this.detector = await getFaceDetector();

      this.set({ stream, status: getMeta().guardBase ? "away" : "uncalibrated" });
      this.lastTick = performance.now();
      this.lastFlush = Date.now();
      this.timer = workerInterval(() => this.tick(), 500);
      sound.unlock();
    } catch (e: any) {
      this.stop();
      const msg =
        e?.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow the camera for this site in your browser settings."
          : e?.name === "NotFoundError"
            ? "No camera found on this device."
            : e?.name === "NotReadableError"
              ? "Your camera is busy in another app (a video call, or Upright open in your browser). Close that, then try again."
            : "Couldn't start the camera or face tracker.";
      this.set({ status: "error", error: msg });
    }
  }

  stop() {
    this.timer?.();
    this.timer = null;
    this.flush(true);
    this.state.stream?.getTracks().forEach((t) => t.stop());
    if (this.video) {
      this.video.srcObject = null;
      this.video.remove();
    }
    this.video = null;
    this.calibrating = false;
    this.set({ ...this.fresh(), status: "off" });
  }

  /** Sit tall, facing your main screen, then call this: 3 seconds of measurements become your "good" posture. */
  calibrate() {
    if (!this.running) return;
    this.samples = [];
    this.calibrating = true;
    this.movedFor = 0;
    this.stuckFor = 0;
    this.set({ status: "calibrating", calibrateLeft: 3, moved: false, maybeMoved: false });
    sound.next();
  }

  private finishCalibration() {
    this.calibrating = false;
    if (this.samples.length < 3) {
      this.set({ status: "uncalibrated", calibrateLeft: 0 });
      return;
    }
    const med = (k: keyof Sample) => {
      const xs = this.samples.map((x) => x[k]).filter((x): x is number => x != null);
      return xs.length ? median(xs) : undefined;
    };
    const b: GuardBase = {
      w: med("w")!,
      cy: med("cy")!,
      cx: med("cx"),
      pitch: med("pitch"),
      roll: med("roll"),
      yaw: med("yaw"),
      em: med("em"),
      pitchM: med("pitchM"),
      edm: med("edm"),
      at: Date.now(),
    };
    setMeta({ guardBase: b });
    this.recent = [];
    this.set({ status: "good", calibrateLeft: 0, badFor: 0, oldCalibration: false, moved: false });
    sound.complete();
  }

  private paused = false;
  /** Paused during exercise sessions (neck movements would look like slouching). */
  setPaused(p: boolean) {
    this.paused = p;
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(5, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.paused) return;
    const v = this.video;
    if (!v || !this.detector || v.readyState < 2 || !v.videoWidth) return;

    const det = detectFace(this.detector, v);
    if (!det?.boundingBox) {
      // nobody in front of the camera: pause the clock
      if (!this.calibrating) this.set({ status: getMeta().guardBase ? "away" : "uncalibrated", badFor: 0, drift: 0 });
      return;
    }
    const smp = measureFace(det, v.videoWidth, v.videoHeight);
    if (!smp) return;
    this.recent.push(smp);
    if (this.recent.length > WINDOW) this.recent.shift();
    const pick = (k: keyof Sample) => {
      const xs = this.recent.map((x) => x[k]).filter((x): x is number => x != null);
      return xs.length ? median(xs) : null;
    };
    const sw = pick("w")!;
    const scy = pick("cy")!;

    if (this.calibrating) {
      this.samples.push(smp);
      const left = Math.max(0, this.state.calibrateLeft - dt);
      this.set({ w: sw, cy: scy, calibrateLeft: left });
      if (left <= 0) this.finishCalibration();
      return;
    }

    const meta = getMeta();
    const base = meta.guardBase;
    if (!base) {
      this.set({ w: sw, cy: scy, status: "uncalibrated" });
      return;
    }

    const t = THRESH[(meta.guardSensitivity ?? 2) as 1 | 2 | 3];
    const a = assess(
      { w: sw, cy: scy, pitch: pick("pitch"), roll: pick("roll"), yaw: pick("yaw"), em: pick("em"), pitchM: pick("pitchM"), edm: pick("edm") },
      base,
      t,
    );
    const [worst, score] = a.scores[0];

    // Much further away, or much higher in the frame, for a while = the camera moved
    // (laptop raised or moved, lid tilted back, chair moved). Don't nag about posture then.
    this.movedFor = a.movedNow && !a.away ? this.movedFor + dt : 0;
    const moved = this.movedFor > MOVED_SEC;
    // Raising the laptop (or tilting the screen back) without recalibrating looks like sinking or
    // a dropped chin that never lets up. Real slouches come and go, so ask after a couple of minutes.
    this.stuckFor = (worst === "low" || worst === "down") && score > STUCK_SCORE && !a.turned && !a.away ? this.stuckFor + dt : 0;

    const prev = this.state.status;
    let status: GuardStatus;
    if (moved) status = "moved";
    else if (score >= 1) status = worst;
    else if (BAD.includes(prev) && score > RELEASE) status = prev; // hysteresis: no flicker
    else status = "good";

    let { badFor, sessionGood, sessionTotal, sessionNudges } = this.state;
    if (status !== "looking" && status !== "moved") {
      sessionTotal += dt;
      this.pending.total += dt;
      if (status === "good") {
        badFor = 0;
        sessionGood += dt;
        this.pending.good += dt;
      } else {
        badFor += dt;
        const delay = getMeta().guardDelaySec ?? 30;
        if (badFor >= delay && Date.now() - this.lastNudge > 90_000) {
          this.lastNudge = Date.now();
          sessionNudges++;
          this.pending.nudges++;
          this.nudge(status);
          badFor = 0;
        }
      }
    }
    this.set({
      w: sw,
      cy: scy,
      drift: Math.min(Math.max(0, score), 2),
      status,
      badFor,
      sessionGood,
      sessionTotal,
      sessionNudges,
      oldCalibration: base.em == null,
      turned: (a.turned || a.away) && status !== "moved",
      maybeMoved: this.stuckFor > STUCK_SEC,
      moved,
    });
    if (Date.now() - this.lastFlush > 60_000) this.flush();
  }

  /** Seconds of slouching before a nudge (from settings). */
  get delaySec() {
    return getMeta().guardDelaySec ?? 30;
  }

  /** Fire a sample nudge so you can hear / see what it looks like. */
  testNudge() {
    sound.unlock();
    void this.nudge("forward");
  }

  private async nudge(status: GuardStatus) {
    sound.posture();
    this.set({ nudgedAt: Date.now() });
    try {
      navigator.vibrate?.([60, 40, 60]);
    } catch {}
    const [title, body] = NUDGES[Math.floor(Math.random() * NUDGES.length)];
    const text = ISSUE[status]?.notify ?? body;
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const reg = await navigator.serviceWorker?.getRegistration();
        const opts = { body: text, icon: asset("/icons/192.png"), badge: asset("/icons/96.png"), tag: "upright-guard", renotify: true, silent: false } as NotificationOptions;
        if (reg) await reg.showNotification(title, opts);
        else new Notification(title, opts);
      }
    } catch {}
  }

  private flush(force = false) {
    const p = this.pending;
    if (!force && p.total < 1) return;
    addGuardTime(p.good, p.total, p.nudges);
    this.pending = { good: 0, total: 0, nudges: 0 };
    this.lastFlush = Date.now();
  }
}

export const guard = new Guard();
