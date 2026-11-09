"use client";

/**
 * Posture Guard: on-device slouch detection with the webcam.
 *
 * How it works: we track your face with MediaPipe's tiny face detector (runs locally,
 * nothing is uploaded). After you calibrate while sitting tall, two signals reveal tech neck:
 *  - your face gets BIGGER in the frame  -> head is pushed forward toward the screen
 *  - your face DROPS in the frame        -> you're sinking / slumping
 * If either holds for a while, you get a gentle nudge.
 */

import { addGuardTime, getMeta, setMeta, type GuardBase } from "./store";
import { sound } from "./sound";
import { detectFace, getFaceDetector, measureFace, median, type Sample } from "./face";
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
  | "looking" // turned away (second screen, talking): not counted
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
  /** true when the saved calibration predates the newer checks (chin-down, tilt) */
  oldCalibration: boolean;
  /** face is much further away than when calibrated: setup probably moved */
  moved: boolean;
  /** which screen you're looking at (2 = second monitor, if calibrated) */
  screen: 1 | 2;
  /** which screen the current calibration is for */
  calibratingScreen: 1 | 2;
  /** when the last nudge fired (widget flashes) */
  nudgedAt: number;
}

/**
 * Thresholds per sensitivity, as change from your calibrated posture.
 * size: face grows by this fraction  ·  drop: eyes sink by this fraction of the frame
 * pitch: nose drops relative to ears by this x eye distance  ·  roll: degrees of side tilt
 */
const THRESH: Record<1 | 2 | 3, { size: number; drop: number; pitch: number; roll: number }> = {
  1: { size: 0.2, drop: 0.12, pitch: 0.3, roll: 16 }, // relaxed
  2: { size: 0.13, drop: 0.08, pitch: 0.2, roll: 11 }, // normal
  3: { size: 0.08, drop: 0.05, pitch: 0.13, roll: 8 }, // strict
};
/** turned this far (nose vs eyes) = looking at another screen / person: don't judge */
const YAW_AWAY = 0.32;
/** once flagged, you must get back under this fraction of the threshold to be "good" (no flicker) */
const RELEASE = 0.75;
const WINDOW = 6; // samples in the rolling median (~3 s)


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
  private calibrating = false;
  private pending = { good: 0, total: 0, nudges: 0 };
  private lastFlush = 0;

  private fresh(): GuardState {
    return { status: "off", stream: null, w: 0, cy: 0, drift: 0, badFor: 0, sessionGood: 0, sessionTotal: 0, sessionNudges: 0, calibrateLeft: 0, nudgedAt: 0, oldCalibration: false, moved: false, screen: 1, calibratingScreen: 1 };
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
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

  /**
   * Sit tall, then call this: averages 3 seconds of measurements as your "good" posture.
   * screen 2 = while looking at your second monitor, so working there isn't "looking away".
   */
  calibrate(screen: 1 | 2 = 1) {
    if (!this.running) return;
    this.samples = [];
    this.calibrating = true;
    this.set({ status: "calibrating", calibrateLeft: 3, calibratingScreen: screen });
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
    const b: GuardBase = { w: med("w")!, cy: med("cy")!, cx: med("cx"), pitch: med("pitch"), roll: med("roll"), yaw: med("yaw"), at: Date.now() };
    setMeta(this.state.calibratingScreen === 2 ? { guardBase2: b } : { guardBase: b });
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
    const base1 = meta.guardBase;
    if (!base1) {
      this.set({ w: sw, cy: scy, status: "uncalibrated" });
      return;
    }

    const t = THRESH[(meta.guardSensitivity ?? 2) as 1 | 2 | 3];
    const yaw = pick("yaw");
    // Second monitor: judge you against whichever screen's calibration your head is turned toward.
    const base2 = meta.guardBase2;
    const near = (b?: GuardBase) => (b && yaw != null && b.yaw != null ? Math.abs(yaw - b.yaw) : Infinity);
    const screen: 1 | 2 = base2 && near(base2) < near(base1) ? 2 : 1;
    const base = screen === 2 ? base2! : base1;
    const pitch = pick("pitch");
    const roll = pick("roll");

    // Each check scores from 0 up: 1 = right at the threshold.
    const scores: [GuardStatus, number][] = [
      ["forward", (sw / base.w - 1) / t.size],
      ["low", (scy - base.cy) / t.drop],
      ["down", pitch != null && base.pitch != null ? (pitch - base.pitch) / t.pitch : 0],
      ["tilt", roll != null && base.roll != null ? Math.abs(roll - base.roll) / t.roll : 0],
    ];
    scores.sort((p, q) => q[1] - p[1]);
    const [worst, score] = scores[0];
    const turned = yaw != null && base.yaw != null && Math.abs(yaw - base.yaw) > YAW_AWAY;

    // Face much smaller than at calibration for a while = laptop or chair moved.
    this.movedFor = sw / base.w < 0.72 ? this.movedFor + dt : 0;

    const prev = this.state.status;
    let status: GuardStatus;
    if (turned) status = "looking";
    else if (score >= 1) status = worst;
    else if (BAD.includes(prev) && score > RELEASE) status = prev; // hysteresis: no flicker
    else status = "good";

    let { badFor, sessionGood, sessionTotal, sessionNudges } = this.state;
    if (status !== "looking") {
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
    } // while looking away the slouch timer just holds
    this.set({
      w: sw,
      cy: scy,
      drift: Math.min(Math.max(0, score), 2),
      status,
      badFor,
      sessionGood,
      sessionTotal,
      sessionNudges,
      oldCalibration: base1.pitch == null,
      screen,
      moved: this.movedFor > 20,
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
