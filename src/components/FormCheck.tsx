"use client";

import { useEffect, useRef, useState } from "react";
import type { Step } from "@/lib/exercises";
import { detectFace, getFaceDetector, measureFace, median, type Sample } from "@/lib/face";
import { RepScorer, isChecked, isScoredPhase, judge, type Baseline, type Feedback } from "@/lib/formcheck";
import { guard } from "@/lib/guard";

type CamState = "off" | "starting" | "ready" | "noface" | "error";

export interface FormCheck {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cam: CamState;
  error?: string;
  feedback: Feedback | null;
  /** this exercise's scored reps */
  score: { good: number; total: number };
  /** whole session */
  session: { good: number; total: number };
}

const TICK_MS = 150;

/**
 * Mirror + form check during a session. Uses Posture Guard's camera if it's already on,
 * otherwise opens the front camera itself (and closes it again when you turn mirror off).
 */
export function useFormCheck(on: boolean, step: Step | undefined, idx: number, paused: boolean): FormCheck {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cam, setCam] = useState<CamState>("off");
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState({ good: 0, total: 0 });
  const [session, setSession] = useState({ good: 0, total: 0 });

  const recent = useRef<Sample[]>([]);
  const base = useRef<Baseline | null>(null);
  const exScorer = useRef(new RepScorer());
  const allScorer = useRef(new RepScorer());
  const stepRef = useRef(step);
  const pausedRef = useRef(paused);
  stepRef.current = step;
  pausedRef.current = paused;

  /* ---- camera on / off ---- */
  useEffect(() => {
    if (!on) {
      setCam("off");
      setFeedback(null);
      return;
    }
    let own: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    setCam("starting");
    (async () => {
      try {
        const shared = guard.state.stream;
        const stream =
          shared && shared.active
            ? shared
            : (own = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false }));
        if (cancelled) return;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        const detector = await getFaceDetector();
        if (cancelled) return;
        setCam("noface");
        timer = setInterval(() => tick(detector), TICK_MS);
      } catch (e: any) {
        if (cancelled) return;
        setCam("error");
        setError(
          e?.name === "NotAllowedError"
            ? "Camera permission is blocked for this site."
            : e?.name === "NotReadableError"
              ? /Windows/i.test(navigator.userAgent) && !(window as any).uprightApp
                ? "Camera busy. If the Upright desktop dot is running, right-click it → Open full app, and exercise there."
                : "Your camera is busy in another app."
              : e?.name === "NotFoundError"
                ? "No camera found."
                : "Couldn't start the camera.",
        );
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      own?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  /* ---- each new step: set the baseline and score reps ---- */
  const lastEx = useRef<number>(-1);
  useEffect(() => {
    if (!step) return;
    const exId = step.exerciseId;
    if (step.exIndex !== lastEx.current) {
      lastEx.current = step.exIndex;
      exScorer.current = new RepScorer();
      setScore({ good: 0, total: 0 });
      base.current = null;
    }
    // first moment of real work: whatever you were doing during "Get ready" is your neutral position
    if (step.kind === "work" && !base.current) base.current = baselineFrom(recent.current);
    const scored = step.kind === "work" && isScoredPhase(exId, step.label);
    exScorer.current.begin(scored);
    allScorer.current.begin(scored);
    setScore({ good: exScorer.current.good, total: exScorer.current.total });
    setSession({ good: allScorer.current.good, total: allScorer.current.total });
    if (!scored) setFeedback(null);
  }, [idx, step]);

  function tick(detector: any) {
    const v = videoRef.current;
    if (!v) return;
    const det = detectFace(detector, v);
    const s = det ? measureFace(det, v.videoWidth, v.videoHeight) : null;
    if (!s) {
      setCam("noface");
      return;
    }
    setCam("ready");
    recent.current.push(s);
    if (recent.current.length > 20) recent.current.shift(); // ~3 s
    const st = stepRef.current;
    if (!st || pausedRef.current || st.kind !== "work" || !base.current || !isChecked(st.exerciseId)) return;
    const smooth = baselineFrom(recent.current.slice(-4));
    if (!smooth) return;
    const fb = judge(st.exerciseId, st.label, { ...s, ...smooth }, base.current);
    exScorer.current.update(fb, TICK_MS / 1000);
    allScorer.current.update(fb, TICK_MS / 1000);
    setFeedback(fb);
  }

  return { videoRef, cam, error, feedback, score, session };
}

function baselineFrom(xs: Sample[]): Baseline | null {
  if (xs.length < 3) return null;
  const med = (k: "w" | "pitch" | "roll" | "yaw") => {
    const v = xs.map((x) => x[k]).filter((n): n is number => n != null);
    return v.length ? median(v) : null;
  };
  return { w: med("w")!, pitch: med("pitch"), roll: med("roll"), yaw: med("yaw") };
}

/** The mirror box: your camera (mirrored) with live feedback on top. */
export function Mirror({ fc, exerciseId }: { fc: FormCheck; exerciseId: string }) {
  const checked = isChecked(exerciseId);
  const msg =
    fc.cam === "error"
      ? { tone: "bad", text: fc.error ?? "Camera problem" }
      : fc.cam === "starting"
        ? { tone: "info", text: "Starting camera…" }
        : fc.cam === "noface"
          ? { tone: "warn", text: "Face the camera so I can see you." }
          : !checked
            ? { tone: "info", text: "Watch your shoulders in the mirror." }
            : fc.feedback ?? { tone: "info", text: "Sit tall. I'm watching your form." };
  return (
    <div className="mirror">
      <video ref={fc.videoRef} autoPlay muted playsInline />
      <div className={`mirror-fb tone-${msg.tone}`}>{msg.text}</div>
      {checked && fc.score.total > 0 && (
        <span className="mirror-score" title="Reps with good form">
          ✓ {fc.score.good}/{fc.score.total}
        </span>
      )}
    </div>
  );
}
