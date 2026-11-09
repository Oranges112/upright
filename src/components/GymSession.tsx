"use client";

import { useEffect, useRef, useState } from "react";
import { planItem, planSets, type GymPlan } from "@/lib/gym";
import { logSession } from "@/lib/store";
import { sound } from "@/lib/sound";
import { fmtClock } from "@/lib/exercises";
import GymFigure from "./GymFigure";
import { GymDetail, prescription } from "./Learn";

type Phase = "work" | "hold" | "rest" | "done";

const WEIGHTS_KEY = "upright:gym-weights";

function loadWeights(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(WEIGHTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Runs a gym plan: one exercise at a time, tap when a set is done, then a rest timer. */
export default function GymSession({ plan, onClose }: { plan: GymPlan; onClose: () => void }) {
  const items = plan.items.map(planItem);
  const total = planSets(plan);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState<number[]>(() => items.map(() => 0));
  const [phase, setPhase] = useState<Phase>("work");
  const [endAt, setEndAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [info, setInfo] = useState(false);
  const startedAt = useRef(Date.now());
  const switched = useRef(false);
  const lastTick = useRef(0);

  const it = items[idx];
  const ex = it.ex;
  const setsDone = done.reduce((a, b) => a + b, 0);
  const left = Math.max(0, (endAt - now) / 1000);

  useEffect(() => setWeights(loadWeights()), []);

  /* keep the screen on */
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {}
    };
    void req();
    const onVis = () => !document.hidden && void req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        lock?.release();
      } catch {}
    };
  }, []);

  /* timers (rest and timed holds) */
  useEffect(() => {
    if (phase !== "rest" && phase !== "hold") return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "rest" && phase !== "hold") return;
    const secs = Math.ceil(left);
    if (left <= 0) {
      if (phase === "hold") finishSet();
      else {
        sound.next();
        setPhase("work");
      }
      return;
    }
    if (phase === "hold" && ex.perSide && !switched.current && left <= (ex.hold ?? 30)) {
      switched.current = true;
      sound.switchSides();
    }
    if (secs <= 3 && secs !== lastTick.current) {
      lastTick.current = secs;
      sound.tick();
    }
    if (secs > 3) lastTick.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase]);

  function setWeight(kg: number) {
    const w = { ...weights, [ex.id]: Math.max(0, Math.round(kg * 2) / 2) };
    setWeights(w);
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(w));
    } catch {}
  }

  function startHold() {
    sound.unlock();
    sound.start();
    switched.current = false;
    const sec = (ex.hold ?? 30) * (ex.perSide ? 2 : 1);
    setNow(Date.now());
    setEndAt(Date.now() + sec * 1000);
    setPhase("hold");
  }

  function finishSet() {
    sound.unlock();
    const d = [...done];
    d[idx] = Math.min(it.sets, d[idx] + 1);
    setDone(d);
    const allDone = d.every((n, i) => n >= items[i].sets);
    if (allDone) {
      sound.complete();
      setPhase("done");
      return;
    }
    if (d[idx] >= it.sets) {
      // move on to the next exercise that still has sets left
      const next = items.findIndex((x, i) => i > idx && d[i] < x.sets);
      setIdx(next >= 0 ? next : d.findIndex((n, i) => n < items[i].sets));
    }
    sound.phaseOut();
    setNow(Date.now());
    setEndAt(Date.now() + it.rest * 1000);
    setPhase("rest");
  }

  function jump(to: number) {
    if (to < 0 || to >= items.length) return;
    setIdx(to);
    setPhase("work");
  }

  function close() {
    if (phase !== "done" && setsDone > 0) logSession(plan.id, startedAt.current, (Date.now() - startedAt.current) / 1000, false);
    onClose();
  }

  if (phase === "done") {
    const mins = Math.round((Date.now() - startedAt.current) / 60000);
    return (
      <div className="player gym-session finish" style={{ ["--g1" as string]: plan.gradient[0], ["--g2" as string]: plan.gradient[1] }}>
        <div className="player-bg" />
        <div className="gym-finish">
          <div className="rt-emoji big">🏆</div>
          <h2>Workout done!</h2>
          <p className="muted">
            {plan.name} · {setsDone} sets · {mins} min
          </p>
          <p className="small">Your shoulders and neck thank you. Do a posture plan 2–3 times a week and retake your side photo every month to see the change.</p>
          <button
            className="btn primary big wide"
            onClick={() => {
              logSession(plan.id, startedAt.current, (Date.now() - startedAt.current) / 1000, true);
              onClose();
            }}
          >
            Save & finish
          </button>
        </div>
      </div>
    );
  }

  const nextItem = items.find((x, i) => done[i] < x.sets && (i !== idx || phase === "rest"));
  const timed = !!ex.hold;
  const kg = weights[ex.id];

  return (
    <div className="player gym-session" style={{ ["--g1" as string]: plan.gradient[0], ["--g2" as string]: plan.gradient[1] }}>
      <div className="player-bg" />
      <header className="player-top">
        <button className="icon-btn" onClick={close} aria-label="Close">
          ✕
        </button>
        <div className="player-progress">
          {items.map((x, i) => (
            <button key={i} className={`seg ${done[i] >= x.sets ? "done" : ""}`} onClick={() => jump(i)} aria-label={x.ex.name}>
              <i style={{ width: `${(done[i] / x.sets) * 100}%` }} />
            </button>
          ))}
        </div>
        <span className="gym-count">
          {setsDone}/{total}
        </span>
      </header>

      {phase === "rest" ? (
        <main className="gym-main rest">
          <p className="eyebrow">Rest</p>
          <div className="gym-clock">{fmtClock(left)}</div>
          <p className="muted">
            Up next: <b>{ex.name}</b> · set {Math.min(done[idx] + 1, it.sets)} of {it.sets}
          </p>
          <div className="gym-fig small">
            <GymFigure anim={ex.anim} />
          </div>
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setEndAt(endAt + 15000)}>
              +15s
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setPhase("work");
              }}
            >
              Skip rest
            </button>
          </div>
          <p className="tiny muted gym-tip">💡 {ex.tips[(done[idx] + idx) % ex.tips.length]}</p>
        </main>
      ) : (
        <main className="gym-main">
          <div className="gym-fig">
            <GymFigure anim={ex.anim} showLabel />
          </div>
          <p className="eyebrow">
            Exercise {idx + 1} of {items.length}
          </p>
          <h2 className="gym-name">{ex.name}</h2>
          <p className="gym-presc">
            Set <b>{Math.min(done[idx] + 1, it.sets)}</b> of {it.sets} · {timed ? `${ex.hold}s hold${ex.perSide ? " each side" : ""}` : `${it.reps} reps`}
          </p>
          <p className="gym-cue">“{ex.cue}”</p>

          {!timed && ex.group !== "neck" && ex.group !== "core" && (
            <div className="gym-weight">
              <button onClick={() => setWeight((kg ?? 0) - 2.5)} aria-label="Less weight">
                −
              </button>
              <span>{kg ? `${kg} kg` : "Weight?"}</span>
              <button onClick={() => setWeight((kg ?? 0) + 2.5)} aria-label="More weight">
                +
              </button>
            </div>
          )}

          {phase === "hold" ? (
            <div className="gym-hold">
              <div className="gym-clock">{fmtClock(left)}</div>
              {ex.perSide && <p className="muted small">{switched.current ? "Second side" : "First side · switch at the chime"}</p>}
            </div>
          ) : (
            <button className="btn primary big wide gym-go" onClick={timed ? startHold : finishSet}>
              {timed ? `▶ Start ${ex.hold}s hold` : "✓ Set done"}
            </button>
          )}

          <div className="gym-links">
            <button className="btn ghost" onClick={() => jump(idx - 1)} disabled={idx === 0}>
              ‹ Prev
            </button>
            <button className="btn ghost" onClick={() => setInfo(true)}>
              How to & mistakes
            </button>
            <button className="btn ghost" onClick={() => jump(idx + 1)} disabled={idx === items.length - 1}>
              Skip ›
            </button>
          </div>
          {nextItem && nextItem.ex.id !== ex.id && <p className="tiny muted">Then: {nextItem.ex.name} ({prescription(nextItem.ex, nextItem.sets, nextItem.reps)})</p>}
        </main>
      )}

      {info && <GymDetail ex={ex} onClose={() => setInfo(false)} />}
    </div>
  );
}
