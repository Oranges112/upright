"use client";

import { Card } from "./ui";
import { AREAS } from "@/lib/exercises";
import type { Area, Doc } from "@/lib/types";

const avg = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);

/** How each of your areas has felt over time (from the faces you tap after sessions). */
export default function AreaFeel({ doc }: { doc: Doc }) {
  const mine = doc.settings.areas;
  const rows = AREAS.map((a) => {
    const cs = doc.checkins.filter((c) => (c.area ?? "neck") === a.id).sort((x, y) => x.at - y.at);
    return { ...a, cs };
  }).filter((r) => r.cs.length > 0 && (mine.length === 0 || mine.includes(r.id as Area) || r.cs.length >= 2));
  if (rows.length === 0) return null;

  return (
    <Card>
      <h3 className="card-title">How it feels</h3>
      <div className="area-feel">
        {rows.map((r) => {
          const vals = r.cs.map((c) => c.stiffness);
          const first = avg(vals.slice(0, 2));
          const now = avg(vals.slice(-2));
          const days = Math.max(1, Math.round((r.cs[r.cs.length - 1].at - r.cs[0].at) / 86_400_000));
          const diff = now - first;
          const recent = vals.slice(-12);
          const W = 120;
          const H = 30;
          const pts = recent.map((v, i) => `${recent.length === 1 ? W / 2 : (i / (recent.length - 1)) * W},${2 + (v / 10) * (H - 4)}`).join(" ");
          return (
            <div key={r.id} className="af-row">
              <span className="af-name">
                {r.emoji} {r.name}
              </span>
              <svg viewBox={`0 0 ${W} ${H}`} className="af-spark" aria-hidden>
                <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={`af-trend ${vals.length < 2 ? "" : diff <= -1 ? "good" : diff >= 1 ? "bad" : ""}`}>
                {vals.length < 2
                  ? `${now.toFixed(0)}/10 so far`
                  : diff <= -1
                    ? `${first.toFixed(0)} → ${now.toFixed(0)} in ${days} day${days === 1 ? "" : "s"} ↓`
                    : diff >= 1
                      ? `${first.toFixed(0)} → ${now.toFixed(0)}, a bit worse`
                      : `steady at ${now.toFixed(0)}/10`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="tiny muted">0 = feels great, 10 = really stiff or sore. Lower line = feeling better. If an area keeps getting worse, check in with a doctor or physio.</p>
    </Card>
  );
}
