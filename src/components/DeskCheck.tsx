"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./ui";
import { detectFace, getFaceDetector, measureFace, median, openCamera, type Sample } from "@/lib/face";
import { guard } from "@/lib/guard";

type Verdict = { ok: boolean | null; title: string; tip: string };

/**
 * Rough, camera-based desk check (the camera sits at the top of your screen):
 *  - distance: how big your face is → roughly how far you sit from the screen
 *  - height: where your eyes are in the picture → whether the top of the screen is near eye level
 *  - straight ahead: whether the screen is in front of you, not off to one side
 */
export function judge(s: Pick<Sample, "w" | "cy" | "cx">): { distance: Verdict; height: Verdict; centre: Verdict } {
  // a typical webcam sees ~70° across, and a face is ~14 cm wide: distance ≈ 10 / w cm
  const cm = Math.round(10 / Math.max(0.03, s.w));
  const distance: Verdict =
    s.w > 0.22
      ? { ok: false, title: `About ${cm} cm away: a bit close`, tip: "Sit back or push the screen away to about an arm's length (50–75 cm)." }
      : s.w < 0.12
        ? { ok: false, title: `About ${cm} cm away: a bit far`, tip: "If you lean in to read, bring the screen closer or make the text bigger." }
        : { ok: true, title: `About ${cm} cm away`, tip: "Good: about an arm's length." };
  const height: Verdict =
    s.cy < 0.36
      ? { ok: false, title: "Screen too low", tip: "Raise it so the top of the screen is at eye level. A laptop stand or a stack of books works, with a separate keyboard." }
      : s.cy > 0.64
        ? { ok: false, title: "Screen a little high", tip: "Lower it so the top of the screen is at or just below eye level, so you look slightly down." }
        : { ok: true, title: "Screen height looks right", tip: "The top of the screen is about at eye level." };
  const centre: Verdict =
    Math.abs(s.cx - 0.5) > 0.17
      ? { ok: false, title: "Screen off to one side", tip: "Put the screen straight in front of you so you don't twist your neck all day." }
      : { ok: true, title: "Straight in front of you", tip: "No twisting. Nice." };
  return { distance, height, centre };
}

const CHECKLIST = [
  "Feet flat on the floor (or a footrest), knees about level with your hips",
  "Your lower back touches the chair back (a cushion helps)",
  "Elbows bent at about 90°, shoulders relaxed, keyboard close",
  "Mouse right next to the keyboard",
  "No bright window behind the screen or glare on it",
];

export default function DeskCheck({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "looking" | "ready" | "error">("starting");
  const [s, setS] = useState<Pick<Sample, "w" | "cy" | "cx"> | null>(null);
  const [ticks, setTicks] = useState<boolean[]>(CHECKLIST.map(() => false));

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stop = false;
    const recent: Sample[] = [];
    // don't let this look like slouching to Posture Guard
    guard.setPaused(true);
    (async () => {
      try {
        stream = guard.engine.state.stream?.active ? guard.engine.state.stream : await openCamera();
        if (stop) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const det = await getFaceDetector();
        setState("looking");
        timer = setInterval(() => {
          if (!v.videoWidth) return;
          const d = detectFace(det, v);
          const m = d && measureFace(d, v.videoWidth, v.videoHeight);
          if (!m) return;
          recent.push(m);
          if (recent.length > 8) recent.shift();
          if (recent.length >= 4) {
            setS({ w: median(recent.map((x) => x.w)), cy: median(recent.map((x) => x.cy)), cx: median(recent.map((x) => x.cx)) });
            setState("ready");
          }
        }, 400);
      } catch {
        setState("error");
      }
    })();
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
      if (stream && stream !== guard.engine.state.stream) stream.getTracks().forEach((t) => t.stop());
      guard.setPaused(false);
    };
  }, []);

  const v = s ? judge(s) : null;

  return (
    <Sheet onClose={onClose}>
      <div className="desk-check">
        <h2>📐 Desk setup check</h2>
        <p className="muted small">Sit the way you normally work, looking at the middle of your screen. This is a rough guide using your camera, at the top of your screen. Nothing is saved.</p>
        <div className="cam desk-cam">
          <video ref={video} autoPlay muted playsInline />
          {state !== "ready" && <div className="desk-cam-note">{state === "error" ? "Couldn't start the camera." : "Looking for you…"}</div>}
        </div>
        {v && (
          <ul className="desk-results">
            {[v.distance, v.height, v.centre].map((r) => (
              <li key={r.title} className={r.ok ? "ok" : "warn"}>
                <span>{r.ok ? "✅" : "⚠️"}</span>
                <div>
                  <b>{r.title}</b>
                  <small>{r.tip}</small>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h3 className="ex-h">And without the camera</h3>
        <ul className="desk-list">
          {CHECKLIST.map((c, i) => (
            <li key={c}>
              <label>
                <input type="checkbox" checked={ticks[i]} onChange={() => setTicks((t) => t.map((x, j) => (j === i ? !x : x)))} />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="row-hint">Moved your screen? Posture Guard will notice and recalibrate.</p>
        <button className="btn primary wide" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
