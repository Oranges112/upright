"use client";

import { useState } from "react";
import { Card } from "./ui";
import { EXERCISES, ROUTINES, fmtDuration, routineSeconds } from "@/lib/exercises";
import { GYM, GYM_PLANS, planItem, planSets, type GymExercise } from "@/lib/gym";
import type { Exercise } from "@/lib/types";
import { useDoc } from "@/lib/store";
import { DeskDetail, GymDetail, type LearnSection } from "./Learn";

export default function Routines({
  onStart,
  onStartGym,
  onLearn,
}: {
  onStart: (id: string) => void;
  onStartGym: (id: string) => void;
  onLearn: (s: LearnSection) => void;
}) {
  const [openEx, setOpenEx] = useState<Exercise | null>(null);
  const [openGym, setOpenGym] = useState<GymExercise | null>(null);
  const [where, setWhere] = useState<"desk" | "gym">(() => {
    try {
      return localStorage.getItem("upright:routines-where") === "gym" ? "gym" : "desk";
    } catch {
      return "desk";
    }
  });
  const level = useDoc().settings.level;

  function pick(w: "desk" | "gym") {
    setWhere(w);
    try {
      localStorage.setItem("upright:routines-where", w);
    } catch {}
  }

  return (
    <div className="view routines">
      <header className="view-head">
        <div>
          <p className="eyebrow">Pick your fix</p>
          <h1>Routines</h1>
        </div>
      </header>

      <div className="seg-tabs" role="tablist">
        <button role="tab" aria-selected={where === "desk"} className={where === "desk" ? "on" : ""} onClick={() => pick("desk")}>
          🪑 At your desk
        </button>
        <button role="tab" aria-selected={where === "gym"} className={where === "gym" ? "on" : ""} onClick={() => pick("gym")}>
          🏋️ At the gym
        </button>
      </div>

      {where === "desk" && (
        <div className="routine-list">
          {ROUTINES.map((r) => (
            <Card key={r.id} className="routine-card" style={{ ["--g1" as string]: r.gradient[0], ["--g2" as string]: r.gradient[1] }}>
              <div className="rc-head">
                <span className="rt-emoji big">{r.emoji}</span>
                <div>
                  <h3>{r.name}</h3>
                  <p className="muted">{r.blurb}</p>
                </div>
              </div>
              <div className="rc-chips">
                {r.exercises.map((id, i) => (
                  <button key={id + i} className="ex-chip" onClick={() => setOpenEx(EXERCISES[id])}>
                    {EXERCISES[id].name}
                  </button>
                ))}
              </div>
              <div className="rc-foot">
                <span className="muted">
                  ⏱ {fmtDuration(routineSeconds(r, level))} · {r.exercises.length} moves
                  {r.exercises.every((id) => EXERCISES[id].discreet) && " · office-friendly"}
                </span>
                <button className="btn primary" onClick={() => onStart(r.id)}>
                  ▶ Start
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {where === "gym" && (
        <>
          <p className="muted small">
            Gym plans for posture. Do one 2–3 times a week, alternating A and B. Tap any move to see how to do it.{" "}
            <button className="link" onClick={() => onLearn("guides")}>
              Read the gym rules →
            </button>
          </p>
          <div className="routine-list">
            {GYM_PLANS.map((p) => (
              <Card key={p.id} className="routine-card" style={{ ["--g1" as string]: p.gradient[0], ["--g2" as string]: p.gradient[1] }}>
                <div className="rc-head">
                  <span className="rt-emoji big">{p.emoji}</span>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="muted">{p.blurb}</p>
                  </div>
                </div>
                <div className="rc-chips">
                  {p.items.map((it, i) => {
                    const x = planItem(it);
                    return (
                      <button key={it.id + i} className="ex-chip" onClick={() => setOpenGym(GYM[it.id])}>
                        {x.ex.name} <em>{x.sets}×{x.ex.hold ? `${x.ex.hold}s` : x.reps.split(" ")[0]}</em>
                      </button>
                    );
                  })}
                </div>
                <div className="rc-foot">
                  <span className="muted">
                    ⏱ ~{p.minutes} min · {p.items.length} moves · {planSets(p)} sets
                  </span>
                  <button className="btn primary" onClick={() => onStartGym(p.id)}>
                    ▶ Start
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <button className="learn-link card" onClick={() => onLearn(where)}>
        <span className="guide-emoji sm">📚</span>
        <span>
          <b>Read about every exercise</b>
          <small>How to do them, why they help, and common mistakes. No workout needed.</small>
        </span>
        <em>›</em>
      </button>

      {openEx && <DeskDetail ex={openEx} onClose={() => setOpenEx(null)} />}
      {openGym && <GymDetail ex={openGym} onClose={() => setOpenGym(null)} />}
    </div>
  );
}
