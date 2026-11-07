"use client";

import { useEffect, useState } from "react";
import Ring from "./Ring";
import { Card } from "./ui";
import { ROUTINES, fmtDuration, getRoutine, routineSeconds } from "@/lib/exercises";
import type { Doc } from "@/lib/types";
import { addDays, countsByDay, currentStreak, levelFor, totalXp, weekdayOf } from "@/lib/stats";
import { nextReminderAt } from "@/lib/schedule";
import { lastSessionEnd, type Meta } from "@/lib/store";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relTime(ms: number, at: number) {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 12) return `in ${h}h${mm ? ` ${mm}m` : ""}`;
  return new Date(at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export default function Today({
  doc,
  meta,
  today,
  onStart,
  onOpenSettings,
  setupCard,
}: {
  doc: Doc;
  meta: Meta;
  today: string;
  onStart: (routineId: string) => void;
  onOpenSettings: () => void;
  setupCard?: React.ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  const counts = countsByDay(doc);
  const done = counts.get(today) ?? 0;
  const goal = doc.settings.dailyGoal;
  const streak = currentStreak(doc, today);
  const lvl = levelFor(totalXp(doc));
  const main = getRoutine(doc.settings.defaultRoutine);
  const next = nextReminderAt(
    doc.settings,
    { lastSessionAt: lastSessionEnd(doc), lastReminderAt: meta.lastReminderAt, snoozeUntil: meta.snoozeUntil },
    now,
  );

  // week strip (Mon..Sun)
  const wd = weekdayOf(today);
  const monday = addDays(today, -((wd + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const goalHit = done >= goal;

  return (
    <div className="view today">
      <header className="view-head">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>{greeting()} 👋</h1>
        </div>
        <div className="streak-chip" title="Day streak">
          <span className="flame">🔥</span>
          <b>{streak}</b>
        </div>
      </header>

      <Card className="hero" style={{ ["--g1" as string]: main.gradient[0], ["--g2" as string]: main.gradient[1] }}>
        <div className="hero-ring">
          <Ring progress={done / goal} size={150} stroke={13} colors={[main.gradient[0], main.gradient[1]]} smooth>
            <div className="hero-count">
              <b>{done}</b>
              <span>/ {goal}</span>
            </div>
            <small>today</small>
          </Ring>
        </div>
        <div className="hero-copy">
          <h2>{goalHit ? (done > goal ? "Above and beyond ✨" : "Daily goal hit! 🎉") : done === 0 ? "Let's loosen that neck" : "Keep it rolling"}</h2>
          <p className="muted">
            {goalHit
              ? "Your neck thanks you. Extra sessions still earn XP."
              : `${goal - done} more ${goal - done === 1 ? "session" : "sessions"} to hit today's goal.`}
          </p>
          <button className="btn primary big" onClick={() => onStart(main.id)}>
            <span>▶</span> Start {main.name}
            <em>{fmtDuration(routineSeconds(main, doc.settings.level))}</em>
          </button>
          <button className="reminder-line" onClick={onOpenSettings}>
            {doc.settings.remindersOn ? (
              next ? (
                <>🔔 Next reminder {relTime(next - now, next)}</>
              ) : (
                <>🔔 No reminders scheduled</>
              )
            ) : (
              <>🔕 Reminders are off</>
            )}
            {meta.snoozeUntil && meta.snoozeUntil > now && <> · snoozed</>}
          </button>
        </div>
      </Card>

      {setupCard}

      <div className="week-strip">
        {week.map((d) => {
          const c = counts.get(d) ?? 0;
          const scheduled = doc.settings.days.includes(weekdayOf(d));
          const started = doc.sessions.length > 0 && d >= doc.sessions[0].day;
          const cls = c >= goal ? "full" : c > 0 ? "part" : d < today && scheduled && started ? "miss" : "";
          return (
            <div key={d} className={`wd ${cls} ${d === today ? "is-today" : ""} ${scheduled ? "" : "rest"}`}>
              <span>{DAY_LETTERS[weekdayOf(d)]}</span>
              <i>{c >= goal ? "✓" : c > 0 ? c : ""}</i>
            </div>
          );
        })}
      </div>

      <h3 className="section-title">Quick routines</h3>
      <div className="routine-grid">
        {ROUTINES.map((r) => (
          <button key={r.id} className="routine-tile" style={{ ["--g1" as string]: r.gradient[0], ["--g2" as string]: r.gradient[1] }} onClick={() => onStart(r.id)}>
            <span className="rt-emoji">{r.emoji}</span>
            <b>{r.name}</b>
            <small>{fmtDuration(routineSeconds(r, doc.settings.level))} · {r.exercises.length} moves</small>
          </button>
        ))}
      </div>

      <Card className="level-card">
        <div className="level-top">
          <div className="level-badge">{lvl.index}</div>
          <div>
            <p className="eyebrow">Level {lvl.index}</p>
            <h3>{lvl.name}</h3>
          </div>
          <div className="xp">{lvl.xp} XP</div>
        </div>
        <div className="lvl-bar">
          <i style={{ width: `${lvl.progress * 100}%` }} />
        </div>
        {lvl.next && (
          <p className="tiny muted">
            {lvl.next.xp - lvl.xp} XP to <b>{lvl.next.name}</b>
          </p>
        )}
      </Card>
    </div>
  );
}
