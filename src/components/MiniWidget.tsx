"use client";

import { useEffect, useRef, useState } from "react";
import { BAD, ISSUE, guard } from "@/lib/guard";
import { useMeta } from "@/lib/store";
import { NO_HOLD, holdGraceMs, nextHold, type Hold } from "@/lib/hold";
import { claimRecentSlot, recentLabel, recentSummary, trackRecent } from "@/lib/recent";
import { useGuard } from "./GuardView";
import { desktopBridge } from "@/lib/desktop";

const TITLE: Record<string, string> = {
  off: "Posture Guard",
  starting: "Starting…",
  uncalibrated: "Sit up tall",
  calibrating: "Hold still…",
  good: "Great posture",
  looking: "Looking away",
  moved: "Camera moved",
  away: "Paused",
  error: "Camera issue",
};

function fmtMin(sec: number) {
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * The floating posture widget.
 *  - "pip": inside the browser's floating window (fixed size): always the full pill
 *  - "desktop": inside the Upright desktop app: just a small see-through dot while you're fine,
 *    popping out into a solid pill with the reason when something's wrong (or when you hover)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function MiniWidget({ today, mode = "pip" }: { today: string; mode?: "pip" | "desktop" }) {
  const g = useGuard();
  const meta = useMeta();
  useEffect(trackRecent, []);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // how long you've held good posture without slipping
  // (forgiving: a short slip doesn't reset it; how long counts as "not short" is a Guard setting, see lib/hold.ts)
  const hold = useRef<Hold>(NO_HOLD);
  const grace = holdGraceMs(meta.holdResetSec, meta.guardDelaySec ?? 30);
  hold.current = nextHold(hold.current, g.status === "good" ? "good" : BAD.includes(g.status) ? "bad" : g.status === "off" ? "off" : "other", now, grace);
  const goodFor = hold.current.since ? (now - hold.current.since) / 1000 : 0;

  const running = g.status !== "off" && g.status !== "error";
  const bad = BAD.includes(g.status);
  const issue = bad ? ISSUE[g.status] : undefined;
  const tone = bad ? "bad" : g.status === "good" ? "good" : g.status === "uncalibrated" || g.status === "calibrating" || g.status === "moved" ? "warn" : "idle";
  const flash = now - g.nudgedAt < 4000;

  // When a slouch starts, sometimes (at most once an hour) show how upright you've been lately.
  const [stat, setStat] = useState<{ text: string; until: number } | null>(null);
  // only for a real slouch (2 s+), not a momentary blip, so the hourly slot isn't wasted
  const settled = bad && g.badFor >= 2;
  useEffect(() => {
    if (!settled) return;
    const r = recentSummary();
    if (r && claimRecentSlot()) setStat({ text: recentLabel(r), until: Date.now() + 7000 });
  }, [settled]);
  const showStat = bad && !!stat && now < stat.until;

  const delay = meta.guardDelaySec ?? 30;
  const chimeIn = Math.max(0, Math.ceil(delay - g.badFor));
  // ring = how good your posture is right now (the same live score as the Good ↔ Slouch meter in Guard)
  const live = running && !["uncalibrated", "calibrating", "away", "looking", "moved", "starting"].includes(g.status);
  const ring = g.status === "calibrating" ? 1 - g.calibrateLeft / 3 : live ? Math.max(0.04, 1 - Math.min(1, g.drift / 1.6)) : 0;
  // green → amber → red as you drift toward the slouch threshold
  const hue = Math.round(152 * (1 - Math.min(1, g.drift)));
  const ringColor = live ? `hsl(${hue} 72% ${bad ? 55 : 46}%)` : undefined;
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
    ? g.status === "error" && g.error?.includes("busy")
      ? "Camera busy in another app · tap to retry"
      : "Tap to start"
    : flash && issue
      ? `${issue.fix} 🙆`
      : showStat
        ? stat!.text
        : issue
        ? issue.fix
        : g.status === "good"
          ? goodFor >= 60
            ? `Holding for ${fmtMin(goodFor)}`
            : "Keep it up"
          : g.status === "uncalibrated"
            ? "then tap here to calibrate"
            : g.status === "moved"
            ? "Sit tall, tap to recalibrate"
            : g.status === "calibrating"
              ? `${Math.ceil(g.calibrateLeft)}…`
              : g.status === "looking"
                ? "Not counted"
                : g.status === "away"
                  ? "Come back when ready"
                  : "";

  /* ---- desktop: dot vs. pill ---- */
  const desktop = mode === "desktop";
  const [hover, setHover] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsAttention = bad || flash || !running || g.status === "uncalibrated" || g.status === "moved" || g.status === "calibrating" || g.status === "starting";
  const expanded = !desktop || needsAttention || hover;
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    void desktopBridge()
      ?.resize(expanded)
      .then((r) => setFlip(!!r?.flip));
  }, [desktop, expanded]);

  useEffect(() => {
    if (desktop) desktopBridge()?.setStatus({ tone, label: issue ? `${issue.what}: ${issue.fix}` : title });
  }, [desktop, tone, title, issue]);

  // desktop: drag the widget anywhere (a click that doesn't move still counts as a click)
  const drag = useRef<{ sx: number; sy: number; x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const onPointerDown = async (e: React.PointerEvent) => {
    const b = desktopBridge();
    if (!desktop || !b || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const start = { sx: e.screenX, sy: e.screenY, x: 0, y: 0, moved: false };
    drag.current = start;
    const pos = await b.getPos();
    start.x = pos.x;
    start.y = pos.y;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !desktop) return;
    const dx = e.screenX - d.sx;
    const dy = e.screenY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    desktopBridge()?.moveTo(Math.round(d.x + dx), Math.round(d.y + dy));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      justDragged.current = true;
      desktopBridge()?.dragEnd();
      setTimeout(() => (justDragged.current = false), 50);
    }
  };

  const onMain = () => {
    if (justDragged.current) return;
    if (!running) void guard.start();
    else if (g.status === "uncalibrated" || g.status === "moved") guard.calibrate();
  };

  // the small dot shows how long you've held good posture, once it's a minute or more
  const showCount = desktop && !expanded && g.status === "good" && goodFor >= 60;
  const mins = Math.floor(goodFor / 60);
  const countBig = mins < 60 ? `${mins}` : `${Math.floor(mins / 60)}h`;
  const countSmall = mins < 60 ? "min" : `${mins % 60}m`;

  const ringSvg = (
    <svg className="mini-ring" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="15" className="track" />
      <circle
        cx="18"
        cy="18"
        r="15"
        className="arc"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - ring)}
        transform="rotate(-90 18 18)"
        style={ringColor ? { stroke: ringColor } : undefined}
      />
      {showCount ? (
        <g className="mini-count-text">
          <text x="18" y="20.5" textAnchor="middle" className="big">
            {countBig}
          </text>
          <text x="18" y="27.5" textAnchor="middle" className="small">
            {countSmall}
          </text>
        </g>
      ) : (
      <g className="mini-body">
        <path d="M12 28 Q18 24.5 24 28" className="shoulders" />
        <g style={{ transform: `translate(${head.x}px, ${head.y}px) rotate(${head.r}deg)`, transformOrigin: "18px 24px", transition: "transform .5s ease" }}>
          <path d="M18 24 L18 19.5" className="neck" />
          <circle cx="18" cy="15" r="4.4" className="head" />
        </g>
      </g>
      )}
    </svg>
  );

  return (
    <div
      className={`mini-stage tone-${tone} ${showCount ? "counting" : ""} ${flash ? "flash" : ""} ${desktop ? "desk" : ""} ${expanded ? "open" : "dot"} ${flip ? "flip" : ""}`}
      onMouseEnter={() => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        setHover(true);
      }}
      onMouseLeave={() => {
        leaveTimer.current = setTimeout(() => setHover(false), 500);
      }}
    >
      <div
        className="mini-pill"
        onClick={onMain}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => {
          if (!desktop) return;
          e.preventDefault();
          desktopBridge()?.contextMenu();
        }}
        title={!running ? "Start Posture Guard" : desktop ? "Drag to move · right-click for options" : undefined}
      >
        {ringSvg}
        {expanded && (
          <>
            <div className="mini-text">
              <b>{title}</b>
              <span className={showStat ? "mini-stat" : undefined}>{sub}</span>
            </div>
            {bad && chimeIn > 0 && <span className="mini-count">{chimeIn}s</span>}
            {!bad && running && g.status !== "uncalibrated" && g.status !== "moved" && g.status !== "calibrating" && (
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
          </>
        )}
      </div>
    </div>
  );
}
