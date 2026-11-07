"use client";

import { useEffect, useRef, useState } from "react";
import { BAD, ISSUE, guard } from "@/lib/guard";
import { useDoc, useMeta } from "@/lib/store";
import { useGuard } from "./GuardView";

const TITLE: Record<string, string> = {
  off: "Posture Guard",
  starting: "Starting…",
  uncalibrated: "Sit up tall",
  calibrating: "Hold still…",
  good: "Great posture",
  looking: "Looking away",
  away: "Paused",
  error: "Camera issue",
};

function fmtMin(sec: number) {
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Tiny always-on-top posture pill. */
export default function MiniWidget({ today }: { today: string }) {
  const g = useGuard();
  const doc = useDoc();
  const meta = useMeta();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // how long you've held good posture without slipping
  const goodSince = useRef<number | null>(null);
  if (g.status === "good") goodSince.current ??= now;
  else if (BAD.includes(g.status) || g.status === "off") goodSince.current = null;
  const goodFor = goodSince.current ? (now - goodSince.current) / 1000 : 0;

  const running = g.status !== "off" && g.status !== "error";
  const bad = BAD.includes(g.status);
  const issue = bad ? ISSUE[g.status] : undefined;
  const tone = bad ? "bad" : g.status === "good" ? "good" : g.status === "uncalibrated" || g.status === "calibrating" ? "warn" : "idle";
  const flash = now - g.nudgedAt < 4000;

  const rows = doc.guard.filter((x) => x.day === today);
  const good = rows.reduce((a, x) => a + x.goodSec, 0) + g.sessionGood;
  const total = rows.reduce((a, x) => a + x.totalSec, 0) + g.sessionTotal;
  const pct = total > 30 ? Math.round((good / total) * 100) : null;

  const delay = meta.guardDelaySec ?? 30;
  const chimeIn = Math.max(0, Math.ceil(delay - g.badFor));
  // ring: countdown to the chime while slouching, otherwise today's %
  const ring = bad ? Math.min(1, g.badFor / delay) : g.status === "calibrating" ? 1 - g.calibrateLeft / 3 : (pct ?? 0) / 100;
  const C = 2 * Math.PI * 15;

  // the little head leans, sinks, drops or tilts with you
  const k = Math.min(1, g.drift / 1.6);
  const head = {
    forward: { x: 3.5 * k, y: 0, r: 0 },
    low: { x: 0, y: 3.5 * k, r: 0 },
    down: { x: 1.5 * k, y: 2 * k, r: 25 * k },
    tilt: { x: 0, y: 0, r: -22 * k },
  }[g.status as "forward"] ?? { x: 0, y: 0, r: 0 };

  const title = issue ? issue.what : TITLE[g.status] ?? "";
  const sub = !running
    ? "Tap to start"
    : flash && issue
      ? `${issue.fix} 🙆`
      : issue
        ? issue.fix
        : g.status === "good"
          ? goodFor >= 60
            ? `Holding for ${fmtMin(goodFor)}`
            : pct != null
              ? `${pct}% good today`
              : "Keep it up"
          : g.status === "uncalibrated"
            ? "then tap here to calibrate"
            : g.status === "calibrating"
              ? `${Math.ceil(g.calibrateLeft)}…`
              : g.status === "looking"
                ? "Not counted"
                : g.status === "away"
                  ? "Come back when ready"
                  : "";

  const onMain = () => {
    if (!running) void guard.start();
    else if (g.status === "uncalibrated") guard.calibrate();
  };

  return (
    <div className={`mini-stage tone-${tone} ${flash ? "flash" : ""}`}>
      <div className="mini-pill" onClick={onMain} title={!running ? "Start Posture Guard" : undefined}>
        <svg className="mini-ring" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="15" className="track" />
          <circle cx="18" cy="18" r="15" className="arc" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform="rotate(-90 18 18)" />
          <g className="mini-body">
            <path d="M12 28 Q18 24.5 24 28" className="shoulders" />
            <g style={{ transform: `translate(${head.x}px, ${head.y}px) rotate(${head.r}deg)`, transformOrigin: "18px 24px", transition: "transform .5s ease" }}>
              <path d="M18 24 L18 19.5" className="neck" />
              <circle cx="18" cy="15" r="4.4" className="head" />
            </g>
          </g>
        </svg>
        <div className="mini-text">
          <b>{title}</b>
          <span>{sub}</span>
        </div>
        {bad && chimeIn > 0 && <span className="mini-count">{chimeIn}s</span>}
        {!bad && running && g.status !== "uncalibrated" && g.status !== "calibrating" && (
          <button
            className="mini-icon"
            title="Recalibrate (sit tall first)"
            onClick={(e) => {
              e.stopPropagation();
              guard.calibrate();
            }}
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
