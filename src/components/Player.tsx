"use client";

import { signalExercising } from "@/lib/desktop";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Figure from "./Figure";
import Ring from "./Ring";
import { EXERCISES, LEVEL_INFO, buildTimeline, fmtClock, type Level, type Step } from "@/lib/exercises";
import type { Routine } from "@/lib/types";
import { COACHING, workTips } from "@/lib/coaching";
import { Mirror, useFormCheck } from "./FormCheck";

import { sound, speak, stopSpeaking } from "@/lib/sound";
import { addCheckin, getDoc, logSession, updateSettings } from "@/lib/store";
import { currentStreak, levelFor, todayKey, totalXp } from "@/lib/stats";

interface Props {
  routine: Routine;
  onClose: () => void;
}

const SOFT_LABELS = new Set(["Release", "Centre", "Return", "Down"]);

export default function Player({ routine, onClose }: Props) {
  const [level] = useState<Level>(() => (getDoc().settings.level ?? 2) as Level);
  const steps = useMemo(() => buildTimeline(routine, level), [routine, level]);
  const totalSec = useMemo(() => steps.reduce((a, s) => a + s.sec, 0), [steps]);
  const exCount = routine.exercises.length;

  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(steps[0]?.sec ?? 0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(() => !getDoc().settings.sound);
  const [finished, setFinished] = useState<null | FinishResult>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [demoFlip, setDemoFlip] = useState(false);
  const [tipBump, setTipBump] = useState(0);

  const startedAt = useRef(Date.now());
  useEffect(signalExercising, []);
  const workedMs = useRef(0);
  const stepStart = useRef(performance.now());
  const pausedRef = useRef(false);
  const lastWhole = useRef<number>(Infinity);
  const idxRef = useRef(0);
  const lastKey = useRef(0);
  const settings = getDoc().settings;
  const voiceOn = settings.voice;

  const step: Step | undefined = steps[idx];
  const ex = step ? EXERCISES[step.exerciseId] : undefined;

  /* ---- mirror + camera form check ---- */
  const [mirrorOn, setMirrorOn] = useState(() => {
    try {
      return localStorage.getItem("upright:mirror") === "1";
    } catch {
      return false;
    }
  });
  const toggleMirror = () =>
    setMirrorOn((m) => {
      try {
        localStorage.setItem("upright:mirror", m ? "0" : "1");
      } catch {}
      return !m;
    });
  const fc = useFormCheck(mirrorOn, step, idx, paused);
  const formRef = useRef(fc.session);
  formRef.current = fc.session;
  // say it out loud when form slips (at most every 8 s)
  const lastSaid = useRef(0);
  useEffect(() => {
    const fb = fc.feedback;
    if (!fb || fb.tone !== "bad" || !voiceOn || muted || paused) return;
    if (Date.now() - lastSaid.current < 8000) return;
    lastSaid.current = Date.now();
    speak(fb.text);
  }, [fc.feedback, voiceOn, muted, paused]);

  /* ---- announce a step (sound + voice + haptics) ---- */
  const announce = useCallback(
    (s: Step, i: number) => {
      const e = EXERCISES[s.exerciseId];
      sound.enabled = !muted;
      try {
        navigator.vibrate?.(s.kind === "work" ? 25 : [20, 60, 20]);
      } catch {}
      if (s.kind === "prep") {
        i === 0 ? sound.start() : sound.next();
        if (voiceOn && !muted) {
          const lead = i === 0 ? `Let's go. First up, ${e.name}.` : `Next, ${e.name}.`;
          speak(`${lead} ${e.cue}`);
        }
      } else if (s.kind === "switch") {
        sound.switchSides();
        if (voiceOn && !muted) speak("Switch sides.");
      } else {
        SOFT_LABELS.has(s.label) ? sound.phaseOut() : sound.phaseIn();
        if (voiceOn && !muted && s.sec >= 2) {
          const tips = COACHING[e.id]?.tips ?? [];
          const tip = tips.length ? tips[(s.rep + (s.side === "right" ? 1 : 0) + i) % tips.length] : e.cue;
          if (s.label === "Hold") speak(`Hold for ${s.sec} seconds. ${tip}`);
          else if (s.rep === 3 && s.label === e.cycle[0].label && s.reps > 3) speak(`${s.label}. ${tip}`);
          else if (s.sec >= 3 || s.rep === 1) speak(s.label);
        }
      }
    },
    [muted, voiceOn],
  );

  const finish = useCallback(() => {
    stopSpeaking();
    sound.stopPad();
    const before = getDoc();
    const today = todayKey(before);
    const levelBefore = levelFor(totalXp(before));
    const worked = workedMs.current / 1000;
    // Only counts toward streaks if you actually did most of it (not just skipped through)
    const completed = worked >= totalSec * 0.5;
    logSession(routine.id, startedAt.current, Math.min(worked, totalSec * 1.2), completed);
    const after = getDoc();
    const levelAfter = levelFor(totalXp(after));
    const levelUp = levelAfter.index > levelBefore.index;
    setFinished({
      form: formRef.current.total ? { ...formRef.current } : undefined,
      completed,
      xp: levelAfter.xp - levelBefore.xp,
      streak: currentStreak(after, today),
      levelUp,
      level: levelAfter,
    });
    sound.enabled = !muted;
    levelUp ? sound.levelUp() : sound.complete();
    if (voiceOn && !muted) speak(levelUp ? `Beautiful work. You reached ${levelAfter.name}.` : "Beautiful. Session complete.");
    releaseWake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routine.id, totalSec, muted, voiceOn]);

  const goTo = useCallback(
    (i: number) => {
      if (i >= steps.length) {
        idxRef.current = steps.length;
        finish();
        return;
      }
      idxRef.current = i;
      setIdx(i);
      setRemaining(steps[i].sec);
      stepStart.current = performance.now();
      lastWhole.current = Infinity;
      announce(steps[i], i);
    },
    [steps, announce, finish],
  );

  /* ---- main clock ---- */
  useEffect(() => {
    if (finished) return;
    let raf = 0;
    const loop = () => {
      const s = steps[idxRef.current];
      if (s && !pausedRef.current) {
        const elapsed = (performance.now() - stepStart.current) / 1000;
        const rem = s.sec - elapsed;
        setRemaining(rem);
        const whole = Math.ceil(rem);
        if (whole !== lastWhole.current) {
          if (whole <= 3 && whole >= 1 && s.sec >= 4 && lastWhole.current !== Infinity) sound.tick(whole === 1);
          lastWhole.current = whole;
        }
        if (rem <= 0) {
          workedMs.current += s.sec * 1000;
          goTo(idxRef.current + 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [steps, goTo, finished]);

  /* ---- start ---- */
  useEffect(() => {
    sound.unlock();
    sound.enabled = !muted;
    if (settings.ambient && !muted) sound.startPad();
    goTo(0);
    requestWake();
    return () => {
      sound.stopPad();
      stopSpeaking();
      releaseWake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- pause when the tab is hidden ---- */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && !pausedRef.current) togglePause(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  });

  /* ---- demo loop on prep cards ---- */
  useEffect(() => {
    if (step?.kind !== "prep") return;
    const i = setInterval(() => setDemoFlip((f) => !f), 1300);
    return () => clearInterval(i);
  }, [step?.kind, idx]);

  /* ---- keyboard ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || e.repeat) return;
      const now = performance.now();
      if (now - lastKey.current < 250) return;
      lastKey.current = now;
      if (e.code === "Space") {
        e.preventDefault();
        togglePause();
      } else if (e.key === "ArrowRight") skipExercise(1);
      else if (e.key === "ArrowLeft") skipExercise(-1);
      else if (e.key === "Escape") setConfirmExit(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function togglePause(force?: boolean) {
    const next = force ?? !pausedRef.current;
    if (next) {
      pausedRef.current = true;
      setPaused(true);
      stopSpeaking();
      sound.stopPad();
    } else {
      // shift the step start so remaining time is preserved
      const s = steps[idxRef.current];
      stepStart.current = performance.now() - (s.sec - remaining) * 1000;
      pausedRef.current = false;
      setPaused(false);
      sound.unlock();
      if (settings.ambient && !muted) sound.startPad();
    }
  }

  function skipExercise(dir: 1 | -1) {
    const cur = steps[idxRef.current];
    if (!cur) return;
    let target: number;
    if (dir === 1) {
      target = steps.findIndex((s, i) => i > idxRef.current && s.exIndex > cur.exIndex);
      if (target === -1) target = steps.length;
    } else {
      const wanted = cur.kind === "prep" ? cur.exIndex - 1 : cur.exIndex;
      target = Math.max(0, steps.findIndex((s) => s.exIndex === wanted && s.kind === "prep"));
    }
    if (pausedRef.current) togglePause(false);
    goTo(target);
  }

  function toggleMute() {
    const m = !muted;
    setMuted(m);
    sound.enabled = !m;
    if (m) {
      sound.stopPad();
      stopSpeaking();
    } else if (settings.ambient && !pausedRef.current) sound.startPad();
  }

  function exit() {
    const worked = workedMs.current / 1000 + (step ? step.sec - remaining : 0);
    if (worked > 20) logSession(routine.id, startedAt.current, worked, false);
    onClose();
  }

  /* ---- wake lock: keep the screen on during a session ---- */
  const wake = useRef<any>(null);
  async function requestWake() {
    try {
      wake.current = await (navigator as any).wakeLock?.request("screen");
    } catch {}
  }
  function releaseWake() {
    try {
      wake.current?.release();
    } catch {}
    wake.current = null;
  }

  if (finished) return <Finish routine={routine} result={finished} onClose={onClose} />;
  if (!step || !ex) return null;

  const elapsedTotal = steps.slice(0, idx).reduce((a, s) => a + s.sec, 0) + (step.sec - remaining);
  // coaching cards rotate while you work, each shown long enough to read (tap the card to skip ahead)
  const exStart = steps.findIndex((s) => s.exIndex === step.exIndex);
  const prepSec = steps[exStart]?.kind === "prep" ? steps[exStart].sec : 0;
  const workElapsed = Math.max(0, elapsedTotal - steps.slice(0, exStart).reduce((a, s) => a + s.sec, 0) - prepSec);
  const tips = workTips(ex.id);
  const durs = tips.map((t) => Math.max(5, t.text.split(" ").length / 2.5));
  let tipIdx = 0;
  if (tips.length) {
    let t = workElapsed % durs.reduce((a, d) => a + d, 0);
    while (t >= durs[tipIdx]) t -= durs[tipIdx++];
    tipIdx = (tipIdx + tipBump) % tips.length;
  }
  const tip = tips[tipIdx];
  const phaseProgress = 1 - remaining / step.sec;
  const nextEx = EXERCISES[routine.exercises[step.exIndex + 1]];
  const demoPose = step.kind === "prep" ? (demoFlip ? ex.cycle[0].pose : {}) : step.pose;
  const moveSpeed = step.kind === "prep" ? 1 : Math.min(1.2, Math.max(0.45, step.sec * 0.55));
  const soft = SOFT_LABELS.has(step.label);

  return (
    <div className={`player ${paused ? "is-paused" : ""}`} style={{ ["--g1" as string]: routine.gradient[0], ["--g2" as string]: routine.gradient[1] }}>
      <div className="player-bg" />
      <header className="player-top">
        <button className="icon-btn" onClick={() => setConfirmExit(true)} aria-label="End session">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="player-progress">
          {routine.exercises.map((id, i) => (
            <span key={id + i} className={`seg ${i < step.exIndex ? "done" : i === step.exIndex ? "now" : ""}`}>
              {i === step.exIndex && <i style={{ width: `${Math.min(100, segProgress(steps, idx, remaining) * 100)}%` }} />}
            </span>
          ))}
        </div>
        <button
          className={`icon-btn ${mirrorOn ? "on" : ""}`}
          onClick={toggleMirror}
          aria-label={mirrorOn ? "Turn off mirror and form check" : "Turn on mirror and form check"}
          title={mirrorOn ? "Mirror & form check: on" : "Mirror & form check"}
        >
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />{mirrorOn && <circle cx="19" cy="5" r="3" fill="#34d399" stroke="none" />}</svg>
        </button>
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? (
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M17 9l4 6M21 9l-4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
          )}
        </button>
      </header>

      <div className="player-meta">
        <span className="pill">{step.exIndex + 1} / {exCount}</span>
        <span className="pill subtle">{fmtClock(totalSec - elapsedTotal)} left</span>
      </div>

      <main className={`player-main ${mirrorOn ? "has-mirror" : ""}`}>
        <div className={`stage-row ${mirrorOn ? "with-mirror" : ""}`}>
        <div className={`player-stage view-${ex.view}`}>
          <div className={`figure-wrap ${step.kind}`}>
            <Figure view={ex.view} pose={demoPose} speed={moveSpeed} hints={step.kind === "work"} />
          </div>
          <div className="stage-ring">
            <Ring progress={phaseProgress} size={132} stroke={9} colors={[routine.gradient[0], routine.gradient[1]]}>
              <div className={`count ${remaining <= 3.05 && step.sec >= 4 ? "pulse" : ""}`}>{Math.max(0, Math.ceil(remaining))}</div>
            </Ring>
          </div>
        </div>
        {mirrorOn && <Mirror fc={fc} exerciseId={ex.id} />}
        </div>

        <div className="player-text">
          <h1 className="ex-name">{ex.name}</h1>
          {step.kind === "prep" ? (
            <>
              <div className={`phase-label get-ready`}>Get ready</div>
              <ul className="howto">
                {ex.howTo.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          ) : step.kind === "switch" ? (
            <div className="phase-label switch">Switch sides ↔</div>
          ) : (
            <>
              <div key={idx} className={`phase-label ${soft ? "soft" : "strong"}`}>
                {step.label}
                {step.side && <span className="side-tag">{step.side === "left" ? "Left side" : "Right side"}</span>}
              </div>
              <div className="rep-row">
                {step.reps > 1 ? (
                  <div className="reps">
                    {Array.from({ length: step.reps }).map((_, i) => (
                      <span key={i} className={i < step.rep - 1 ? "on" : i === step.rep - 1 ? "cur" : ""} />
                    ))}
                    <b>
                      Rep {step.rep} of {step.reps}
                    </b>
                  </div>
                ) : (
                  <p className="cue">{ex.cue}</p>
                )}
              </div>
              {tip && (
                <button key={`${step.exIndex}-${tipIdx}`} className="tip-card" onClick={() => setTipBump((b) => b + 1)} title="Next tip">
                  <span className="tip-icon">{tip.icon}</span>
                  <span>{tip.text}</span>
                </button>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="player-controls">
        <button className="ctrl" onClick={() => skipExercise(-1)} aria-label="Previous exercise">
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 6v12M19 6l-9 6 9 6z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        </button>
        <button className="ctrl big" onClick={() => togglePause()} aria-label={paused ? "Resume" : "Pause"}>
          {paused ? (
            <svg viewBox="0 0 24 24" width="34" height="34"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="34" height="34"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
          )}
        </button>
        <button className="ctrl" onClick={() => skipExercise(1)} aria-label="Next exercise">
          <svg viewBox="0 0 24 24" width="26" height="26"><path d="M17 6v12M5 6l9 6-9 6z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
        </button>
      </footer>
      <div className="up-next">{nextEx ? <>Up next · <b>{nextEx.name}</b></> : <>Last one. Finish strong 💪</>}</div>

      {paused && !confirmExit && (
        <div className="paused-veil" onClick={() => togglePause(false)}>
          <div>Paused</div>
          <small>Tap to resume</small>
        </div>
      )}

      {confirmExit && (
        <div className="sheet-veil" onClick={() => setConfirmExit(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>End this session?</h3>
            <p>Unfinished sessions don&apos;t count toward your streak.</p>
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setConfirmExit(false)}>Keep going</button>
              <button className="btn danger" onClick={exit}>End session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function segProgress(steps: Step[], idx: number, remaining: number) {
  const cur = steps[idx];
  const seg = steps.filter((s) => s.exIndex === cur.exIndex);
  const total = seg.reduce((a, s) => a + s.sec, 0);
  const before = steps.slice(0, idx).filter((s) => s.exIndex === cur.exIndex).reduce((a, s) => a + s.sec, 0);
  return (before + (cur.sec - remaining)) / total;
}

/* ---------------- Completion screen ---------------- */

const FEEL = ["😌", "🙂", "😐", "😕", "😣"];

interface FinishResult {
  completed: boolean;
  xp: number;
  streak: number;
  levelUp: boolean;
  level: ReturnType<typeof levelFor>;
  /** reps the camera judged, if mirror was on */
  form?: { good: number; total: number };
}

function Finish({
  routine,
  result,
  onClose,
}: {
  routine: Routine;
  result: FinishResult;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.6,
        rot: Math.random() * 360,
        color: [routine.gradient[0], routine.gradient[1], "#fde68a", "#f9a8d4", "#ffffff"][i % 5],
      })),
    [routine.gradient],
  );

  function pick(level: number) {
    setPicked(level);
    // map 5 faces to 0-10 stiffness scale
    addCheckin([0, 2, 5, 7, 9][level]);
  }

  return (
    <div className="player finish" style={{ ["--g1" as string]: routine.gradient[0], ["--g2" as string]: routine.gradient[1] }}>
      <div className="player-bg" />
      <div className="confetti" aria-hidden>
        {confetti.map((c, i) => (
          <i key={i} style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`, background: c.color, transform: `rotate(${c.rot}deg)` }} />
        ))}
      </div>
      <div className="finish-body">
        <div className="finish-badge">{result.levelUp ? "🎉" : "✨"}</div>
        <h1>{result.levelUp ? "Level up!" : result.completed ? "Nice work!" : "Quick one!"}</h1>
        <p className="finish-sub">
          {result.completed ? `${routine.name} complete` : "You skipped most of it, so this one doesn't count toward your streak."}
        </p>

        <div className="finish-stats">
          <div>
            <b>🔥 {result.streak}</b>
            <span>day streak</span>
          </div>
          <div>
            <b>+{result.xp}</b>
            <span>XP</span>
          </div>
          <div>
            <b>Lv {result.level.index}</b>
            <span>{result.level.name}</span>
          </div>
        </div>
        {result.form && (
          <p className="finish-form">
            📷 Form check: <b>{result.form.good}</b> of {result.form.total} moves on point
            {result.form.total > 0 && result.form.good / result.form.total >= 0.8 ? " · great technique!" : ""}
          </p>
        )}

        <div className="lvl-bar">
          <i style={{ width: `${result.level.progress * 100}%` }} />
        </div>
        {result.level.next && (
          <p className="tiny muted">
            {result.level.next.xp - result.level.xp} XP to <b>{result.level.next.name}</b>
          </p>
        )}

        <div className="feel">
          <p>How does your neck feel right now?</p>
          <div className="feel-row">
            {FEEL.map((f, i) => (
              <button key={f} className={`feel-btn ${picked === i ? "on" : ""}`} onClick={() => pick(i)} disabled={picked !== null}>
                {f}
              </button>
            ))}
          </div>
          <div className="feel-scale">
            <span>Great</span>
            <span>Stiff / sore</span>
          </div>
          {picked !== null && <p className="tiny muted">Logged. This feeds your progress chart.</p>}
        </div>

        <Effort />

        <button className="btn primary wide" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

/** "How hard was that?" auto-progression: nudges the intensity level up/down. */
function Effort() {
  const [lvl] = useState<Level>(() => (getDoc().settings.level ?? 2) as Level);
  const [answer, setAnswer] = useState<null | "easy" | "right" | "hard">(null);
  const next: Level = answer === "easy" ? (Math.min(4, lvl + 1) as Level) : answer === "hard" ? (Math.max(1, lvl - 1) as Level) : lvl;

  function choose(a: "easy" | "right" | "hard") {
    setAnswer(a);
    const n: Level = a === "easy" ? (Math.min(4, lvl + 1) as Level) : a === "hard" ? (Math.max(1, lvl - 1) as Level) : lvl;
    if (n !== lvl) updateSettings({ level: n });
  }

  return (
    <div className="feel effort">
      <p>
        How hard was that? <span className="lvl-tag">{LEVEL_INFO[lvl].name}</span>
      </p>
      <div className="effort-row">
        {(
          [
            ["easy", "😴 Too easy"],
            ["right", "👌 Just right"],
            ["hard", "🥵 Too hard"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`chip ${answer === k ? "on" : ""}`} disabled={answer !== null} onClick={() => choose(k)}>
            {label}
          </button>
        ))}
      </div>
      {answer && (
        <p className="tiny muted" style={{ marginTop: 8 }}>
          {next !== lvl
            ? `Next session will be ${LEVEL_INFO[next].name}: ${LEVEL_INFO[next].blurb}`
            : answer === "easy" && lvl === 4
              ? "You're at the top level. Beast mode 💪"
              : answer === "hard" && lvl === 1
                ? "Already on Gentle. Move within comfort and it'll get easier."
                : "Staying where you are. That's the sweet spot."}
        </p>
      )}
    </div>
  );
}
