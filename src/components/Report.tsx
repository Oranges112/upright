"use client";

import { useEffect, useState } from "react";
import type { Doc, TestType } from "@/lib/types";
import { addDays, bestStreak, currentStreak, levelFor, totalXp } from "@/lib/stats";
import { getPhoto, type PhotoRecord } from "@/lib/photos";
import { PhotoOverlay } from "./PhotoTest";
import { LEVEL_INFO, type Level } from "@/lib/exercises";

interface Row {
  label: string;
  before: string;
  now: string;
  better: boolean | null;
  note?: string;
}

function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function windowStats(doc: Doc, from: string, to: string) {
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
  const s = doc.sessions.filter((x) => x.completed && x.day >= from && x.day < to);
  const c = doc.checkins.filter((x) => x.day >= from && x.day < to).map((x) => x.stiffness);
  const g = doc.guard.filter((x) => x.day >= from && x.day < to);
  const gTot = g.reduce((a, x) => a + x.totalSec, 0);
  const gGood = g.reduce((a, x) => a + x.goodSec, 0);
  return {
    perWeek: (s.length / days) * 7,
    minutesPerWeek: (s.reduce((a, x) => a + x.durationSec, 0) / 60 / days) * 7,
    stiffness: avg(c),
    guardPct: gTot > 300 ? gGood / gTot : null,
  };
}

export default function Report({ doc, today, onClose }: { doc: Doc; today: string; onClose: () => void }) {
  const start = doc.sessions[0]?.day ?? today;
  const daysIn = Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
  const first = windowStats(doc, start, addDays(start, 7));
  const recent = windowStats(doc, addDays(today, -6), addDays(today, 1));

  const test = (type: TestType) => {
    const t = doc.tests.filter((x) => x.type === type);
    return { first: t[0], last: t.length > 1 ? t[t.length - 1] : undefined };
  };
  const end = test("endurance");
  const wall = test("wall");
  const ang = test("angle");

  const fmt = (v: number | null | undefined, unit = "", d = 0) => (v == null ? "–" : `${v.toFixed(d)}${unit}`);
  const cmp = (a: number | null | undefined, b: number | null | undefined, higherBetter: boolean) =>
    a == null || b == null || Math.abs(b - a) < 1e-9 ? null : higherBetter ? b > a : b < a;

  const rows: Row[] = [
    { label: "Sessions per week", before: fmt(first.perWeek, "", 1), now: fmt(recent.perWeek, "", 1), better: cmp(first.perWeek, recent.perWeek, true) },
    { label: "Minutes per week", before: fmt(first.minutesPerWeek), now: fmt(recent.minutesPerWeek), better: cmp(first.minutesPerWeek, recent.minutesPerWeek, true) },
    { label: "Neck stiffness (0–10)", before: fmt(first.stiffness, "", 1), now: fmt(recent.stiffness, "", 1), better: cmp(first.stiffness, recent.stiffness, false) },
    {
      label: "Neck endurance hold",
      before: fmt(end.first?.value, "s"),
      now: fmt(end.last?.value, "s"),
      better: cmp(end.first?.value, end.last?.value, true),
      note: "Typical without neck pain: ~30–40s",
    },
    { label: "Wall test gap", before: fmt(wall.first?.value, " cm", 1), now: fmt(wall.last?.value, " cm", 1), better: cmp(wall.first?.value, wall.last?.value, false) },
    { label: "Forward head angle", before: fmt(ang.first?.value, "°"), now: fmt(ang.last?.value, "°"), better: cmp(ang.first?.value, ang.last?.value, false) },
    {
      label: "Good posture at desk (Guard)",
      before: first.guardPct == null ? "–" : `${Math.round(first.guardPct * 100)}%`,
      now: recent.guardPct == null ? "–" : `${Math.round(recent.guardPct * 100)}%`,
      better: cmp(first.guardPct, recent.guardPct, true),
    },
  ];

  const [photos, setPhotos] = useState<{ a: PhotoRecord | null; b: PhotoRecord | null }>({ a: null, b: null });
  useEffect(() => {
    (async () => {
      setPhotos({
        a: ang.first ? await getPhoto(ang.first.id) : null,
        b: ang.last ? await getPhoto(ang.last.id) : null,
      });
    })();
  }, [ang.first?.id, ang.last?.id]);

  const lvl = levelFor(totalXp(doc));
  const wins = rows.filter((r) => r.better === true).length;

  return (
    <div className="report-veil">
      <div className="report">
        <div className="report-actions no-print">
          <button className="btn ghost" onClick={onClose}>
            ← Back
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            🖨 Save as PDF / print
          </button>
        </div>

        <header className="report-head">
          <p className="eyebrow">Upright · progress report</p>
          <h1>Before & after</h1>
          <p className="muted">
            {new Date(start + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} →{" "}
            {new Date(today + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · {daysIn} day
            {daysIn === 1 ? "" : "s"}
          </p>
          {wins > 0 && (
            <div className="report-win">
              ✨ Improved on <b>{wins}</b> of {rows.length} measures
            </div>
          )}
        </header>

        <section className="report-photos">
          {[photos.a, photos.b].map((p, i) => {
            const t = i === 0 ? ang.first : ang.last;
            return (
              <figure key={i}>
                <figcaption>{i === 0 ? "Before" : "Now"}</figcaption>
                {p ? (
                  <div className="photo-frame small" style={{ aspectRatio: `${p.w} / ${p.h}`, width: `min(100%, ${Math.round(340 * (p.w / p.h))}px)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.dataUrl} alt={i === 0 ? "Before" : "Now"} />
                    <PhotoOverlay ear={p.ear} shoulder={p.shoulder} />
                  </div>
                ) : (
                  <div className="photo-empty">
                    {t ? "Photo is on another device" : i === 0 ? "Take your first side-profile photo in Progress → Posture tests" : "Retake the photo in a few weeks"}
                  </div>
                )}
                {t && (
                  <p>
                    <b>{t.value}°</b> · {new Date(t.at).toLocaleDateString()}
                  </p>
                )}
              </figure>
            );
          })}
        </section>

        <table className="report-table">
          <thead>
            <tr>
              <th>Measure</th>
              <th>First week</th>
              <th>Last 7 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>
                  {r.label}
                  {r.note && <small>{r.note}</small>}
                </td>
                <td>{r.before}</td>
                <td className={r.better === true ? "up" : r.better === false ? "down" : ""}>
                  {r.now} {r.better === true ? "▲" : r.better === false ? "▼" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="report-summary">
          <div>
            <b>{doc.sessions.filter((s) => s.completed).length}</b>
            <span>sessions total</span>
          </div>
          <div>
            <b>{bestStreak(doc, today)}</b>
            <span>best streak (days)</span>
          </div>
          <div>
            <b>{currentStreak(doc, today)}</b>
            <span>current streak</span>
          </div>
          <div>
            <b>{LEVEL_INFO[(doc.settings.level ?? 2) as Level].name}</b>
            <span>intensity</span>
          </div>
          <div>
            <b>Lv {lvl.index}</b>
            <span>{lvl.name}</span>
          </div>
        </section>

        <p className="disclaimer">
          Self-tracked with Upright. Measurements are home self-tests, not a clinical assessment. Share with your physio or doctor for context.
        </p>
      </div>
    </div>
  );
}
