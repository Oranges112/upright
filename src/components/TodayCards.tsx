"use client";

import { useState } from "react";
import { Card } from "./ui";
import { AREAS, PLAN_WEEKS, fmtDuration, getRoutine, planWeek, prefsOf, routineSeconds } from "@/lib/exercises";
import { addCheckin, setMeta, updateSettings, type Meta } from "@/lib/store";
import { addDays, weekdayOf } from "@/lib/stats";
import type { Area, Doc } from "@/lib/types";

const FACES = ["😌", "🙂", "😐", "😣", "😖"];
const FACE_VALUES = [0, 2, 5, 7, 9];

/** "How do your areas feel today?" when a check-in is due (Settings → Check-ins). */
export function CheckInCard({ doc, meta }: { doc: Doc; meta: Meta }) {
  const s = doc.settings;
  const [picks, setPicks] = useState<Partial<Record<Area, number>>>({});
  const areas = (s.areas.length ? s.areas : (["neck"] as Area[])).slice(0, 5);
  const last = meta.lastPainCheckAt ?? 0;
  const due = s.painCheckOn && s.painCheckDays > 0 && Date.now() - last >= s.painCheckDays * 86_400_000 - 3600_000;
  const done = areas.every((a) => picks[a] != null);
  if (!due && Object.keys(picks).length === 0) return null;

  return (
    <Card className="pain-card">
      <h3 className="card-title">{done ? "Thanks, logged ✅" : "How does it feel today?"}</h3>
      {!done && <p className="muted small">One tap each. Progress shows how it changes over the weeks.</p>}
      {areas.map((a) => {
        const info = AREAS.find((x) => x.id === a)!;
        return (
          <div key={a} className="feel-line">
            <span>
              {info.emoji} {info.name}
            </span>
            <div className="faces">
              {FACES.map((f, i) => (
                <button
                  key={f}
                  className={`face ${picks[a] === i ? "on" : ""}`}
                  disabled={picks[a] != null}
                  onClick={() => {
                    setPicks((x) => ({ ...x, [a]: i }));
                    addCheckin(FACE_VALUES[i], a);
                    setMeta({ lastPainCheckAt: Date.now() });
                  }}
                  aria-label={`${["Great", "Good", "OK", "Sore", "Really sore"][i]}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {!done && (
        <button className="link" style={{ marginTop: 8 }} onClick={() => setMeta({ lastPainCheckAt: Date.now() })}>
          Not today
        </button>
      )}
    </Card>
  );
}

/** Monday's look back at last week (Settings → Weekly summary). */
export function WeekCard({ doc, meta, today }: { doc: Doc; meta: Meta; today: string }) {
  if (!doc.settings.weeklyOn) return null;
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  if (meta.weeklySeen === monday) return null;
  const lastMon = addDays(monday, -7);
  const inWeek = (d: string) => d >= lastMon && d < monday;
  const sessions = doc.sessions.filter((x) => x.completed && inWeek(x.day));
  if (sessions.length === 0 && !doc.guard.some((g) => inWeek(g.day))) return null;
  const days = new Set(sessions.map((x) => x.day)).size;
  const g = doc.guard.filter((x) => inWeek(x.day));
  const good = g.reduce((a, x) => a + x.goodSec, 0);
  const total = g.reduce((a, x) => a + x.totalSec, 0);
  const sit = g.reduce((a, x) => a + (x.sitSec ?? 0), 0);
  const sitDays = new Set(g.filter((x) => (x.sitSec ?? 0) > 600).map((x) => x.day)).size;
  const longest = g.reduce((a, x) => Math.max(a, x.longestSitSec ?? 0), 0);
  const cs = doc.checkins.filter((c) => inWeek(c.day));
  const prev = doc.checkins.filter((c) => c.day >= addDays(lastMon, -7) && c.day < lastMon);
  const avg = (xs: typeof cs) => xs.reduce((a, c) => a + c.stiffness, 0) / Math.max(1, xs.length);
  const h = (sec: number) => `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;

  return (
    <Card className="week-card">
      <h3 className="card-title">📅 Your last week</h3>
      <div className="wk-grid">
        <div>
          <b>{sessions.length}</b>
          <small>sessions on {days} day{days === 1 ? "" : "s"}</small>
        </div>
        {total > 600 && (
          <div>
            <b>{Math.round((good / total) * 100)}%</b>
            <small>good posture (Guard)</small>
          </div>
        )}
        {sitDays > 0 && (
          <div>
            <b>{h(sit / sitDays)}</b>
            <small>at your desk per day</small>
          </div>
        )}
        {longest > 0 && (
          <div>
            <b>{h(longest)}</b>
            <small>longest without a break</small>
          </div>
        )}
        {cs.length > 0 && (
          <div>
            <b>{avg(cs).toFixed(1)}/10</b>
            <small>
              stiffness{prev.length ? (avg(cs) < avg(prev) - 0.4 ? " · better 🎉" : avg(cs) > avg(prev) + 0.4 ? " · a bit worse" : " · steady") : ""}
            </small>
          </div>
        )}
      </div>
      <p className="muted small">
        {days >= 5 ? "Brilliant consistency. Keep it going this week." : days >= 3 ? "Good week. One more day this week makes a real difference." : "A fresh week. Little and often beats long and rare."}
      </p>
      <button className="link" onClick={() => setMeta({ weeklySeen: monday })}>
        Got it
      </button>
    </Card>
  );
}

/** The 4-week plan: start it, or see this week's goal and today's session. */
export function PlanCard({ doc, today, onStart }: { doc: Doc; today: string; onStart: (id: string) => void }) {
  const s = doc.settings;
  const week = planWeek(s, today);
  if (!s.planOn || !s.planStart) {
    if (doc.sessions.length === 0 && !s.areas.length) return null;
    return (
      <Card className="plan-card">
        <h3 className="card-title">🗓️ Try the 4-week plan</h3>
        <p className="muted small">A session a day, built from your areas. It starts gentle and gets stronger each week, so you can feel the difference by week 4.</p>
        <div className="btn-row">
          <button className="btn primary" onClick={() => updateSettings({ planOn: true, planStart: today, defaultRoutine: "plan" })}>
            Start my plan
          </button>
        </div>
      </Card>
    );
  }
  // this plan week (after week 4: the last 7 days)
  const from = week >= 5 ? addDays(today, -6) : addDays(s.planStart, (week - 1) * 7);
  const done = new Set(doc.sessions.filter((x) => x.completed && x.day >= from && x.day < addDays(from, 7)).map((x) => x.day)).size;
  const r = getRoutine("plan", prefsOf(doc));
  const info = PLAN_WEEKS[Math.min(4, week) - 1];
  const doneToday = doc.sessions.some((x) => x.completed && x.day === today && x.routineId === "plan");
  return (
    <Card className="plan-card">
      <div className="plan-top">
        <div>
          <p className="eyebrow">{week >= 5 ? "Plan complete 🎉" : `Your plan · week ${week} of 4`}</p>
          <h3>{week >= 5 ? "Keep it going" : info.title.split(": ")[1]}</h3>
        </div>
        <div className="plan-weeks" aria-hidden>
          {[1, 2, 3, 4].map((w) => (
            <i key={w} className={w < week ? "done" : w === week ? "now" : ""} />
          ))}
        </div>
      </div>
      <p className="muted small">{week >= 5 ? "You finished the 4 weeks. Today's session uses your strongest version." : info.blurb}</p>
      <p className="small">
        This week: <b>{Math.min(done, s.planPerWeek)}</b> of {s.planPerWeek} days{done >= s.planPerWeek ? " ✅" : ""}
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={() => onStart("plan")}>
          {doneToday ? "▶ Do it again" : "▶ Today's session"} <em>{fmtDuration(routineSeconds(r, r.level))}</em>
        </button>
      </div>
    </Card>
  );
}
