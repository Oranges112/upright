"use client";

import { useEffect, useState } from "react";
import { COACHING } from "@/lib/coaching";
import { EXERCISES, KIND } from "@/lib/exercises";
import { GROUPS, GYM, type GymExercise, type GymGroup } from "@/lib/gym";
import { GUIDES, type Guide } from "@/lib/guides";
import type { Exercise } from "@/lib/types";
import GymFigure from "./GymFigure";
import Figure from "./Figure";
import { Sheet } from "./ui";

export type LearnSection = "desk" | "gym" | "guides";

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

const KIND_LABEL = { strength: "Strength", stretch: "Stretch", mobility: "Mobility" } as const;

/* ---------------- detail sheets (also used from Routines) ---------------- */

export function DeskDetail({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const c = COACHING[ex.id];
  return (
    <Sheet onClose={onClose}>
      <div className="ex-detail">
        <div className="ex-fig large">
          <LoopFigure ex={ex} />
        </div>
        <p className="eyebrow">{ex.tagline}</p>
        <h2>{ex.name}</h2>
        <div className="ex-pills">
          <span>{KIND_LABEL[KIND[ex.id] ?? "mobility"]}</span>
          <span>🎯 {ex.targets}</span>
          {ex.discreet && <span>🤫 Desk-friendly</span>}
          {ex.sides && <span>↔ Both sides</span>}
        </div>
        <h3 className="ex-h">How to do it</h3>
        <ol className="howto">
          {ex.howTo.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
        {c && (
          <div className="ex-coach">
            <p>
              <b>💡 Why it helps</b>
              {c.why}
            </p>
            <p>
              <b>🎯 Where you should feel it</b>
              {c.feel}
            </p>
            <div>
              <b>✅ Get the most out of it</b>
              <ul>
                {c.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <p className="ex-avoid">
              <b>⚠️ Common mistake</b>
              {c.avoid}
            </p>
          </div>
        )}
        <button className="btn ghost wide" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}

export function prescription(ex: GymExercise, sets = ex.sets, reps = ex.reps) {
  return `${sets} × ${reps}${ex.perSide ? " each side" : ""}`;
}

export function GymDetail({ ex, onClose }: { ex: GymExercise; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <div className="ex-detail">
        <div className="ex-fig large gym">
          <GymFigure anim={ex.anim} showLabel />
        </div>
        <p className="eyebrow">{ex.tagline}</p>
        <h2>{ex.name}</h2>
        <div className="ex-pills">
          <span>
            {GROUPS[ex.group].emoji} {GROUPS[ex.group].name}
          </span>
          <span>🔁 {prescription(ex)}</span>
          <span>⏸ Rest {ex.rest}s</span>
        </div>
        <p className="muted small ex-meta">
          <b>Targets:</b> {ex.targets}
          <br />
          <b>You need:</b> {ex.equipment}
        </p>

        <h3 className="ex-h">How to do it</h3>
        <ol className="howto">
          {ex.steps.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>

        <div className="ex-coach">
          <p>
            <b>💡 Why it helps your posture</b>
            {ex.why}
          </p>
          <p>
            <b>🎯 Where you should feel it</b>
            {ex.feel}
          </p>
          <div>
            <b>✅ Tips</b>
            <ul>
              {ex.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="ex-avoid">
            <b>⚠️ Common mistakes</b>
            <ul>
              {ex.mistakes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="ex-vary">
            <p>
              <b>🪶 Easier</b>
              {ex.easier}
            </p>
            <p>
              <b>🔥 Harder</b>
              {ex.harder}
            </p>
          </div>
        </div>
        <button className="btn ghost wide" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  );
}

export function GuideDetail({ g, onClose }: { g: Guide; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <article className="guide">
        <div className="guide-emoji">{g.emoji}</div>
        <p className="eyebrow">{g.minutes} min read</p>
        <h2>{g.title}</h2>
        {g.sections.map((s, i) => (
          <section key={i}>
            {s.h && <h3>{s.h}</h3>}
            {s.p && <p>{s.p}</p>}
            {s.list && (
              <ul>
                {s.list.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <button className="btn ghost wide" onClick={onClose}>
          Close
        </button>
      </article>
    </Sheet>
  );
}

/* ---------------- the Learn tab ---------------- */

export default function Learn({ section, onSection }: { section: LearnSection; onSection: (s: LearnSection) => void }) {
  const [desk, setDesk] = useState<Exercise | null>(null);
  const [gym, setGym] = useState<GymExercise | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [group, setGroup] = useState<GymGroup | "all">("all");

  const gymList = Object.values(GYM).filter((g) => group === "all" || g.group === group);

  return (
    <div className="view learn">
      <header className="view-head">
        <div>
          <p className="eyebrow">Read up, no workout needed</p>
          <h1>Learn</h1>
        </div>
      </header>

      <div className="seg-tabs" role="tablist">
        {(
          [
            ["desk", "🪑 Desk moves"],
            ["gym", "🏋️ Gym moves"],
            ["guides", "📚 Guides"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={section === id} className={section === id ? "on" : ""} onClick={() => onSection(id)}>
            {label}
          </button>
        ))}
      </div>

      {section === "desk" && (
        <>
          <p className="muted small">All {Object.keys(EXERCISES).length} desk exercises. Tap one to see how to do it, why it helps and what to watch out for.</p>
          <div className="ex-grid">
            {Object.values(EXERCISES).map((ex) => (
              <button key={ex.id} className="ex-tile" onClick={() => setDesk(ex)}>
                <div className="ex-fig">
                  <LoopFigure ex={ex} />
                </div>
                <b>{ex.name}</b>
                <small>{ex.targets}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {section === "gym" && (
        <>
          <div className="chips">
            <button className={`chip ${group === "all" ? "on" : ""}`} onClick={() => setGroup("all")}>
              All
            </button>
            {(Object.keys(GROUPS) as GymGroup[]).map((g) => (
              <button key={g} className={`chip ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>
                {GROUPS[g].emoji} {GROUPS[g].name}
              </button>
            ))}
          </div>
          <div className="ex-grid">
            {gymList.map((ex) => (
              <button key={ex.id} className="ex-tile" onClick={() => setGym(ex)}>
                <div className="ex-fig gym">
                  <GymFigure anim={ex.anim} />
                </div>
                <b>{ex.name}</b>
                <small>{ex.targets}</small>
                <small className="ex-presc">{prescription(ex)}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {section === "guides" && (
        <div className="guide-list">
          {GUIDES.map((g) => (
            <button key={g.id} className="guide-card" onClick={() => setGuide(g)}>
              <span className="guide-emoji sm">{g.emoji}</span>
              <span>
                <b>{g.title}</b>
                <small>{g.blurb}</small>
              </span>
              <em>{g.minutes} min</em>
            </button>
          ))}
        </div>
      )}

      {desk && <DeskDetail ex={desk} onClose={() => setDesk(null)} />}
      {gym && <GymDetail ex={gym} onClose={() => setGym(null)} />}
      {guide && <GuideDetail g={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}
