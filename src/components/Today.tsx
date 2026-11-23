"use client";

import { useEffect, useState } from "react";
import Ring from "./Ring";
import { Card } from "./ui";
import { fmtDuration, getRoutine, routineSeconds, routinesFor } from "@/lib/exercises";
import { nextIntervalAt } from "@/lib/schedule";
import { eyeReminder, standReminder, stretchReminder } from "@/lib/reminders";
import type { Doc } from "@/lib/types";
import { addDays, countsByDay, currentStreak, levelFor, totalXp, weekdayOf } from "@/lib/stats";
import { nextReminderAt } from "@/lib/schedule";
import { lastSessionEnd, type Meta } from "@/lib/store";
import PhotoReminder from "./PhotoReminder";

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
  const s = doc.settings;
  const main = getRoutine(s.defaultRoutine, s);
  const quick = routinesFor(s).mine;
  const next = nextReminderAt(
    doc.settings,
    { lastSessionAt: lastSessionEnd(doc), lastReminderAt: meta.lastReminderAt, snoozeUntil: meta.snoozeUntil },
    now,
  );
  // every reminder that's on, soonest first
  const upcoming = [
    { label: "exercise break", at: next, on: s.remindersOn },
    { label: "quick stretch", at: nextIntervalAt(s, stretchReminder(s, meta), now), on: s.stretchOn },
    { label: "eye break", at: nextIntervalAt(s, eyeReminder(s, meta), now), on: s.eyeOn },
    { label: meta.standing ? "time to sit" : "time to stand", at: nextIntervalAt(s, standReminder(s, meta), now), on: s.standDeskOn },
  ]
    .filter((x) => x.on && x.at)
    .sort((a, b) => a.at! - b.at!);
  const anyOn = s.remindersOn || s.stretchOn || s.eyeOn || s.standDeskOn;

  // time at the desk today (all devices)
  const rows = doc.guard.filter((g) => g.day === today);
  const sitSec = rows.reduce((a, g) => a + (g.sitSec ?? 0), 0);
  const longest = rows.reduce((a, g) => Math.max(a, g.longestSitSec ?? 0), 0);
  const fmtH = (sec: number) => {
    const m = Math.round(sec / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  };

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
          <h2>{goalHit ? (done > goal ? "Above and beyond ✨" : "Daily goal hit! 🎉") : done === 0 ? (s.areas.length === 0 || s.areas.includes("neck") ? "Let's loosen that neck" : "Let's get you moving") : "Keep it rolling"}</h2>
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
            {!anyOn ? (
              <>🔕 Reminders are off</>
            ) : upcoming.length ? (
              <>
                🔔 Next: {upcoming[0].label} {relTime(upcoming[0].at! - now, upcoming[0].at!)}
                {upcoming[1] && (
                  <>
                    {" "}
                    · {upcoming[1].label} {relTime(upcoming[1].at! - now, upcoming[1].at!)}
                  </>
                )}
              </>
            ) : (
              <>🔔 No reminders scheduled (outside your hours)</>
            )}
            {meta.snoozeUntil && meta.snoozeUntil > now && <> · snoozed</>}
          </button>
        </div>
      </Card>

      {setupCard}

      {s.sitTrackOn && sitSec >= 60 && (
        <Card className="sit-card">
          <span className="sit-icon">🪑</span>
          <div>
            <b>{fmtH(sitSec)} at your desk today</b>
            <small className="muted">
              Longest without a break: {fmtH(longest)}
              {longest >= 90 * 60 ? ". Try to get up at least every hour." : longest >= 50 * 60 ? "." : ". Nice, you're moving regularly."}
            </small>
          </div>
        </Card>
      )}

      <PhotoReminder doc={doc} />

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
        {quick.map((r) => (
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
