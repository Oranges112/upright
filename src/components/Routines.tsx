"use client";

import { useEffect, useState } from "react";
import Figure from "./Figure";
import { Card, Sheet } from "./ui";
import { EXERCISES, ROUTINES, fmtDuration, routineSeconds } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";
import { useDoc } from "@/lib/store";

/** A figure that loops through the exercise's phases forever. */
export function LoopFigure({ ex, size }: { ex: Exercise; size?: number }) {
  const [i, setI] = useState(0);
  const poses = ex.cycle.length > 1 ? ex.cycle.map((c) => c.pose) : [{}, ex.cycle[0].pose];
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % poses.length), 1400);
    return () => clearInterval(t);
  }, [poses.length]);
  return <Figure view={ex.view} pose={poses[i]} speed={1} size={size} />;
}

export default function Routines({ onStart }: { onStart: (id: string) => void }) {
  const [openEx, setOpenEx] = useState<Exercise | null>(null);
  const level = useDoc().settings.level;

  return (
    <div className="view routines">
      <header className="view-head">
        <div>
          <p className="eyebrow">Pick your fix</p>
          <h1>Routines</h1>
        </div>
      </header>

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

      <h3 className="section-title">Exercise library</h3>
      <div className="ex-grid">
        {Object.values(EXERCISES).map((ex) => (
          <button key={ex.id} className="ex-tile" onClick={() => setOpenEx(ex)}>
            <div className="ex-fig">
              <LoopFigure ex={ex} />
            </div>
            <b>{ex.name}</b>
            <small>{ex.targets}</small>
          </button>
        ))}
      </div>

      {openEx && (
        <Sheet onClose={() => setOpenEx(null)}>
          <div className="ex-detail">
            <div className="ex-fig large">
              <LoopFigure ex={openEx} />
            </div>
            <p className="eyebrow">{openEx.tagline}</p>
            <h2>{openEx.name}</h2>
            <p className="muted">Targets: {openEx.targets}{openEx.discreet ? " · can be done discreetly at your desk" : ""}</p>
            <ol className="howto">
              {openEx.howTo.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ol>
            <button className="btn ghost wide" onClick={() => setOpenEx(null)}>
              Close
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
