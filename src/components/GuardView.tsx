"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Card, Chips } from "./ui";
import { BAD, ISSUE, guard, type GuardState, type GuardStatus } from "@/lib/guard";
import { setMeta, useDoc, useMeta } from "@/lib/store";
import { addDays } from "@/lib/stats";
import { askPermission } from "@/lib/push";
import { closeWidget, openWidget, useWidgetWindow, widgetSupported } from "@/lib/widget";

const OFF: GuardState = guard.getState();

export function useGuard() {
  return useSyncExternalStore(guard.subscribe, guard.getState, () => OFF);
}

export const STATUS_UI: Record<GuardStatus, { label: string; tone: "good" | "warn" | "bad" | "idle" }> = {
  off: { label: "Off", tone: "idle" },
  starting: { label: "Starting camera…", tone: "idle" },
  uncalibrated: { label: "Sit tall and tap Calibrate", tone: "warn" },
  calibrating: { label: "Hold still, sitting tall…", tone: "warn" },
  good: { label: "Great posture", tone: "good" },
  forward: { label: "Head pushed forward", tone: "bad" },
  low: { label: "Sinking in your chair", tone: "bad" },
  down: { label: "Chin dropping", tone: "bad" },
  tilt: { label: "Head tilted", tone: "bad" },
  looking: { label: "Looking away (not counted)", tone: "idle" },
  away: { label: "Looking for you…", tone: "idle" },
  error: { label: "Camera problem", tone: "bad" },
};

export default function GuardView({ today }: { today: string }) {
  const g = useGuard();
  const meta = useMeta();
  const doc = useDoc();
  const videoRef = useRef<HTMLVideoElement>(null);
  const widgetWin = useWidgetWindow();
  const [canPop, setCanPop] = useState(false);
  useEffect(() => setCanPop(widgetSupported()), []);
  const [notifPerm, setNotifPerm] = useState<string>("default");
  useEffect(() => {
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, [g.status]);
  const bad = BAD.includes(g.status);
  const delay = meta.guardDelaySec ?? 30;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = g.stream;
  }, [g.stream]);

  const running = g.status !== "off" && g.status !== "error";
  const ui = STATUS_UI[g.status];

  // today's totals (all devices) + the unsaved bit from this session
  const todays = doc.guard.filter((x) => x.day === today);
  const tGood = todays.reduce((a, x) => a + x.goodSec, 0);
  const tTotal = todays.reduce((a, x) => a + x.totalSec, 0);
  const tNudges = todays.reduce((a, x) => a + x.nudges, 0);
  const pct = tTotal > 30 ? Math.round((tGood / tTotal) * 100) : null;

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((d) => {
    const rows = doc.guard.filter((x) => x.day === d);
    const tot = rows.reduce((a, x) => a + x.totalSec, 0);
    const good = rows.reduce((a, x) => a + x.goodSec, 0);
    return { d, pct: tot > 60 ? good / tot : null, min: Math.round(tot / 60) };
  });

  return (
    <div className="view guard">
      <header className="view-head">
        <div>
          <p className="eyebrow">Works while you work</p>
          <h1>Posture Guard</h1>
        </div>
      </header>

      <Card className={`guard-hero tone-${ui.tone}`}>
        {!running ? (
          <div className="guard-intro">
            <div className="guard-icon">🛡️</div>
            <h2>Your webcam spots the slouch</h2>
            <p className="muted">
              Leave Upright open while you work. If your head creeps toward the screen or you sink into your chair, you get a gentle nudge.
            </p>
            <ul className="guard-points">
              <li>🔒 Runs 100% on this device. No video is recorded or uploaded.</li>
              <li>💻 Best on your computer, with the camera straight in front of you.</li>
              <li>🔔 Allow notifications so nudges reach you in other apps.</li>
            </ul>
            {g.status === "error" && <p className="row-hint warn">{g.error}</p>}
            <button
              className="btn primary big"
              onClick={async () => {
                void askPermission();
                await guard.start();
              }}
            >
              🛡️ Start Posture Guard
            </button>
          </div>
        ) : (
          <>
            <div className="cam">
              <video ref={videoRef} autoPlay muted playsInline />
              <div className={`cam-status tone-${ui.tone}`}>
                <i />
                {g.status === "calibrating" ? `Calibrating… ${Math.ceil(g.calibrateLeft)}` : ui.label}
                {bad && <small className="cam-count">· chime in {Math.max(0, Math.ceil(delay - g.badFor))}s</small>}
              </div>
              {g.status !== "uncalibrated" && g.status !== "calibrating" && g.status !== "away" && g.status !== "starting" && (
                <div className="meter">
                  <span>Good</span>
                  <div className="meter-bar">
                    <i style={{ left: `${Math.min(100, (g.drift / 1.6) * 100)}%` }} />
                  </div>
                  <span>Slouch</span>
                </div>
              )}
            </div>
            <div className="btn-row center">
              <button className="btn primary" onClick={() => guard.calibrate()} disabled={g.status === "calibrating" || g.status === "starting"}>
                {meta.guardBase ? "Recalibrate" : "Calibrate (sit tall)"}
              </button>
              <button className="btn ghost" onClick={() => guard.stop()}>
                Stop
              </button>
            </div>
            <div className="guard-pop">
              {canPop &&
                (widgetWin ? (
                  <button className="btn ghost" onClick={closeWidget}>
                    Close floating widget
                  </button>
                ) : (
                  <button className="btn primary" onClick={() => void openWidget()}>
                    ⧉ Float on top of my screen
                  </button>
                ))}
              <button className="btn ghost" onClick={() => guard.testNudge()}>
                🔔 Test a nudge
              </button>
            </div>
            {notifPerm !== "granted" && (
              <p className="row-hint warn center-text">
                Notifications are {notifPerm === "denied" ? "blocked" : "not allowed yet"}, so you&apos;ll only hear the chime.{" "}
                {notifPerm === "default" && (
                  <button className="link" onClick={async () => setNotifPerm(await askPermission())}>
                    Allow notifications
                  </button>
                )}
                {notifPerm === "denied" && "Click the lock icon next to the web address to allow them."}
              </p>
            )}
            {bad && ISSUE[g.status] && <p className="guard-fix">👉 {ISSUE[g.status]!.fix}</p>}
            {g.oldCalibration && (
              <p className="row-hint warn center-text">New checks (chin dropping, head tilt) need a fresh calibration. Sit tall and tap Recalibrate.</p>
            )}
            {g.moved && <p className="row-hint warn center-text">Looks like your screen or chair moved. Sit tall and tap Recalibrate.</p>}
            <p className="tiny muted center-text">
              Calibrate while sitting tall: ears over shoulders, chin level. Recalibrate if you move your laptop or screen.
            </p>
          </>
        )}
      </Card>

      <div className="stat-grid three">
        <div className="stat">
          <span className="stat-icon">✅</span>
          <b>{pct == null ? "–" : `${pct}%`}</b>
          <small>good posture today</small>
        </div>
        <div className="stat">
          <span className="stat-icon">⏱</span>
          <b>{Math.round(tTotal / 60)}</b>
          <small>min guarded today</small>
        </div>
        <div className="stat">
          <span className="stat-icon">🔔</span>
          <b>{tNudges}</b>
          <small>nudges today</small>
        </div>
      </div>

      <Card>
        <h3 className="card-title">Last 7 days</h3>
        <div className="guard-week">
          {week.map((w) => (
            <div key={w.d} className="gw">
              <div className="gw-bar">
                <i style={{ height: `${(w.pct ?? 0) * 100}%`, opacity: w.pct == null ? 0 : 1 }} />
              </div>
              <b>{w.pct == null ? "–" : `${Math.round(w.pct * 100)}%`}</b>
              <small>{new Date(w.d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}</small>
            </div>
          ))}
        </div>
        <p className="tiny muted">% of guarded time in good posture. Watch it climb as your muscles get stronger.</p>
      </Card>

      <Card>
        <h3 className="card-title">Guard settings</h3>
        <div className="field-block" style={{ borderTop: 0, paddingTop: 0 }}>
          <span className="row-label">Sensitivity</span>
          <Chips
            options={[1, 2, 3] as (1 | 2 | 3)[]}
            value={meta.guardSensitivity ?? 2}
            onChange={(v) => setMeta({ guardSensitivity: v })}
            format={(v) => (v === 1 ? "Relaxed" : v === 2 ? "Normal" : "Strict")}
          />
        </div>
        <div className="field-block">
          <span className="row-label">Nudge me after slouching for</span>
          <Chips
            options={[15, 30, 60, 120]}
            value={meta.guardDelaySec ?? 30}
            onChange={(v) => setMeta({ guardDelaySec: v })}
            format={(v) => (v < 60 ? `${v}s` : `${v / 60} min`)}
          />
        </div>
        <p className="row-hint">
          <b>What it checks:</b> head pushed toward the screen, sinking into your chair, chin dropping, and head tilted to one side. Glancing at
          another screen or turning to talk isn&apos;t counted.
        </p>
        <p className="row-hint">
          <b>When do nudges happen?</b> If you slouch for {delay < 60 ? `${delay} seconds` : `${delay / 60} min`} in a row, you get a chime and a pop-up. Sitting
          back up resets the timer. After a nudge, it waits at least 90 seconds before the next one.
        </p>
        <p className="row-hint">Keep the Upright tab open (it can be behind other windows). Use “Float on top” to see your posture over any app.</p>
      </Card>
    </div>
  );
}
