"use client";

import { useState } from "react";
import { Card } from "./ui";
import { AREA_NAME, EXERCISES, forYou, fmtDuration, prefsOf, routineSeconds, routinesFor } from "@/lib/exercises";
import { GYM, GYM_PLANS, PLAN_AREAS, planItem, planSets, type GymExercise } from "@/lib/gym";
import type { Exercise, Routine } from "@/lib/types";
import { updateSettings, useDoc } from "@/lib/store";
import { DeskDetail, GymDetail, type LearnSection } from "./Learn";
import RoutineBuilder from "./RoutineBuilder";

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
  const [builder, setBuilder] = useState<Routine | "new" | null>(null);
  const [where, setWhere] = useState<"desk" | "gym">(() => {
    try {
      return localStorage.getItem("upright:routines-where") === "gym" ? "gym" : "desk";
    } catch {
      return "desk";
    }
  });
  const doc = useDoc();
  const settings = doc.settings;
  const level = settings.level;
  const showAll = settings.showAll || settings.areas.length === 0;
  const { mine, other } = routinesFor(prefsOf(doc));
  const routines: Routine[] = showAll ? [...mine, ...other] : mine;
  const plans = GYM_PLANS.filter((p) => showAll || forYou(PLAN_AREAS[p.id], settings.areas));

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

      {settings.areas.length > 0 && (
        <div className="area-filter">
          <span>
            {showAll ? "Showing everything" : <>For your {settings.areas.map((a) => AREA_NAME[a].toLowerCase()).join(", ")}</>}
          </span>
          <button className="link" onClick={() => updateSettings({ showAll: !settings.showAll })}>
            {showAll ? "Only show mine" : "Show other areas too"}
          </button>
        </div>
      )}

      {where === "desk" && (
        <div className="routine-list">
          <button className="card build-card" onClick={() => setBuilder("new")}>
            <span className="rt-emoji big">＋</span>
            <span>
              <b>Build your own routine</b>
              <small>Pick the moves you like, in your order.</small>
            </span>
          </button>
          {routines.map((r) => (
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
                <span className="btn-row" style={{ margin: 0 }}>
                  {r.custom && (
                    <button className="btn ghost" onClick={() => setBuilder(doc.custom.find((x) => x.id === r.id) ?? r)}>
                      Edit
                    </button>
                  )}
                  <button className="btn primary" onClick={() => onStart(r.id)}>
                    ▶ Start
                  </button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
      {builder && <RoutineBuilder edit={builder === "new" ? undefined : builder} onClose={() => setBuilder(null)} />}

      {where === "gym" && (
        <>
          <p className="muted small">
            Gym plans for posture. Do one 2–3 times a week, alternating A and B. Tap any move to see how to do it.{" "}
            <button className="link" onClick={() => onLearn("guides")}>
              Read the gym rules →
            </button>
          </p>
          <div className="routine-list">
            {plans.length === 0 && <p className="muted small">No gym plans for your areas yet. Tap &ldquo;Show other areas too&rdquo; to see them all.</p>}
            {plans.map((p) => (
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
