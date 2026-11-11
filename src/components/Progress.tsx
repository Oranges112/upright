"use client";

import { useEffect, useRef, useState } from "react";
import Ring from "./Ring";
import { Card, Sheet } from "./ui";
import type { Doc, TestType } from "@/lib/types";
import { addDays, bestStreak, consistency, countsByDay, currentStreak, postureScore, weekdayOf, weekly } from "@/lib/stats";
import { addTest } from "@/lib/store";
import { sound } from "@/lib/sound";
import PhotoTest from "./PhotoTest";
import Report from "./Report";

export default function Progress({ doc, today }: { doc: Doc; today: string }) {
  const [test, setTest] = useState<TestType | null>(null);
  const [report, setReport] = useState(false);
  const score = postureScore(doc, today);
  const cons = consistency(doc, today);
  const streak = currentStreak(doc, today);
  const best = bestStreak(doc, today);
  const completed = doc.sessions.filter((s) => s.completed);
  const minutes = Math.round(completed.reduce((a, s) => a + s.durationSec, 0) / 60);
  const weeks = weekly(doc, today, 8);

  return (
    <div className="view progress">
      <header className="view-head">
        <div>
          <p className="eyebrow">Your journey</p>
          <h1>Progress</h1>
        </div>
      </header>

      <Card className="score-card">
        <Ring progress={score / 100} size={150} stroke={13} colors={["#5eead4", "#a78bfa"]} smooth>
          <div className="hero-count">
            <b>{score}</b>
          </div>
          <small>posture score</small>
        </Ring>
        <div className="score-copy">
          <h3>{score >= 80 ? "Locked in 🔒" : score >= 55 ? "Building the habit 🌱" : score > 0 ? "Getting started 🚀" : "Your first session awaits"}</h3>
          <p className="muted">
            Based on how often you hit your daily goal over the last 2 weeks ({Math.round(cons * 100)}%) plus your streak. Consistency matters
            more than intensity for posture.
          </p>
        </div>
      </Card>

      <button className="report-cta" onClick={() => setReport(true)}>
        <span className="rc-icon">📄</span>
        <span>
          <b>Before & after report</b>
          <small>Your first week vs now: tests, photos, comfort. Save as PDF for your physio.</small>
        </span>
        <span className="rc-arrow">→</span>
      </button>

      <div className="stat-grid">
        <Stat label="Current streak" value={`${streak}`} unit="days" icon="🔥" />
        <Stat label="Best streak" value={`${best}`} unit="days" icon="🏅" />
        <Stat label="Sessions" value={`${completed.length}`} unit="total" icon="✅" />
        <Stat label="Time invested" value={`${minutes}`} unit="min" icon="⏱" />
      </div>

      <Card>
        <h3 className="card-title">Last 18 weeks</h3>
        <Heatmap doc={doc} today={today} />
      </Card>

      <Card className="half">
        <h3 className="card-title">Practice vs. how your neck feels</h3>
        <WeeklyChart weeks={weeks} />
        <Insight doc={doc} weeks={weeks} />
      </Card>

      <Card className="half">
        <h3 className="card-title">Posture tests</h3>
        <p className="muted small">
          Real-world checks that show whether the practice is working. Retest every 2–4 weeks.
        </p>
        <TestRow doc={doc} type="endurance" title="Neck endurance hold" unit="s" better="higher" onStart={() => setTest("endurance")} />
        <TestRow doc={doc} type="wall" title="Wall test (head-to-wall gap)" unit="cm" better="lower" onStart={() => setTest("wall")} />
        <TestRow doc={doc} type="angle" title="Side-profile photo (head angle)" unit="°" better="lower" onStart={() => setTest("angle")} />
      </Card>

      <p className="disclaimer">
        Upright is a habit tool, not medical advice. If you have sharp pain, numbness, tingling, or dizziness, stop and see a physio or doctor.
      </p>

      {test && <TestSheet type={test} onClose={() => setTest(null)} />}
      {report && <Report doc={doc} today={today} onClose={() => setReport(false)} />}
    </div>
  );
}

function Stat({ label, value, unit, icon }: { label: string; value: string; unit: string; icon: string }) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <b>{value}</b>
      <small>
        {unit} · {label}
      </small>
    </div>
  );
}

function Heatmap({ doc, today }: { doc: Doc; today: string }) {
  const counts = countsByDay(doc);
  const goal = doc.settings.dailyGoal;
  const wd = weekdayOf(today);
  const lastMonday = addDays(today, -((wd + 6) % 7));
  const start = addDays(lastMonday, -7 * 17);
  const cols = Array.from({ length: 18 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)));
  return (
    <div className="heatmap-wrap">
      <div className="heatmap">
        {cols.map((col, i) => (
          <div key={i} className="hm-col">
            {col.map((d) => {
              const c = counts.get(d) ?? 0;
              const lvl = d > today ? -1 : c === 0 ? 0 : Math.min(4, Math.ceil((c / goal) * 3) + (c > goal ? 1 : 0));
              return <i key={d} className={`hm l${lvl}`} title={`${d}: ${c} session${c === 1 ? "" : "s"}`} />;
            })}
          </div>
        ))}
      </div>
      <div className="hm-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className={`hm l${l}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function WeeklyChart({ weeks }: { weeks: ReturnType<typeof weekly> }) {
  const W = 320;
  const H = 150;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const maxS = Math.max(5, ...weeks.map((w) => w.sessions));
  const bw = (W - pad.l - pad.r) / weeks.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v);
  const pts = weeks
    .map((w, i) => (w.stiffness == null ? null : [pad.l + bw * i + bw / 2, y(1 - w.stiffness / 10)] as const))
    .filter(Boolean) as (readonly [number, number])[];
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="barg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--track)" strokeDasharray="2 4" />
        ))}
        {weeks.map((w, i) => {
          const h = (H - pad.t - pad.b) * (w.sessions / maxS);
          return (
            <g key={w.start}>
              <rect x={pad.l + bw * i + bw * 0.22} y={y(0) - h} width={bw * 0.56} height={Math.max(h, 0)} rx="5" fill="url(#barg)" opacity={i === weeks.length - 1 ? 1 : 0.75} />
              <text x={pad.l + bw * i + bw / 2} y={H - 6} textAnchor="middle" className="axis">
                {i === weeks.length - 1 ? "now" : `-${weeks.length - 1 - i}w`}
              </text>
              {w.sessions > 0 && (
                <text x={pad.l + bw * i + bw / 2} y={y(0) - h - 4} textAnchor="middle" className="axis strong">
                  {w.sessions}
                </text>
              )}
            </g>
          );
        })}
        {pts.length > 1 && <path d={line} fill="none" stroke="#f9a8d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#f9a8d4" stroke="var(--card)" strokeWidth="2" />
        ))}
      </svg>
      <div className="chart-legend">
        <span><i className="sw bar" /> Sessions per week</span>
        <span><i className="sw line" /> Neck comfort (higher = better)</span>
      </div>
    </div>
  );
}

function Insight({ doc, weeks }: { doc: Doc; weeks: ReturnType<typeof weekly> }) {
  const withFeel = weeks.filter((w) => w.stiffness != null);
  if (doc.checkins.length < 3) {
    return <p className="insight">💡 Rate how your neck feels after sessions. After a few check-ins you&apos;ll see how practice links to comfort.</p>;
  }
  const sorted = [...withFeel].sort((a, b) => a.sessions - b.sessions);
  const half = Math.ceil(sorted.length / 2);
  const low = sorted.slice(0, half);
  const high = sorted.slice(half);
  const avg = (xs: typeof weeks) => xs.reduce((a, w) => a + (w.stiffness ?? 0), 0) / Math.max(1, xs.length);
  if (high.length && low.length && avg(low) - avg(high) > 0.5) {
    return (
      <p className="insight">
        📈 In your busier weeks your stiffness averaged <b>{avg(high).toFixed(1)}/10</b> vs <b>{avg(low).toFixed(1)}/10</b> in quieter weeks. The
        practice is paying off.
      </p>
    );
  }
  const first = doc.checkins.slice(0, 5);
  const last = doc.checkins.slice(-5);
  const a = first.reduce((x, c) => x + c.stiffness, 0) / first.length;
  const b = last.reduce((x, c) => x + c.stiffness, 0) / last.length;
  if (a - b > 0.5)
    return (
      <p className="insight">
        📉 Stiffness is down from <b>{a.toFixed(1)}</b> to <b>{b.toFixed(1)}</b> since you started. Keep going.
      </p>
    );
  return <p className="insight">💡 Changes in posture usually show up after 3–6 weeks of consistent practice. Stick with it!</p>;
}

function TestRow({
  doc,
  type,
  title,
  unit,
  better,
  onStart,
}: {
  doc: Doc;
  type: TestType;
  title: string;
  unit: string;
  better: "higher" | "lower";
  onStart: () => void;
}) {
  const tests = doc.tests.filter((t) => t.type === type);
  const first = tests[0];
  const last = tests[tests.length - 1];
  const delta = first && last && tests.length > 1 ? last.value - first.value : null;
  const good = delta != null && (better === "higher" ? delta > 0 : delta < 0);
  const max = Math.max(1, ...tests.map((t) => t.value));
  return (
    <div className="test-row">
      <div className="test-info">
        <b>{title}</b>
        {last ? (
          <span className="muted small">
            Latest: <b>{last.value}{unit}</b>
            {delta != null && (
              <span className={good ? "up" : "down"}>
                {" "}
                ({delta > 0 ? "+" : ""}
                {Math.round(delta * 10) / 10}
                {unit} since first)
              </span>
            )}
          </span>
        ) : (
          <span className="muted small">No results yet</span>
        )}
        {tests.length > 1 && (
          <div className="spark">
            {tests.slice(-12).map((t) => (
              <i key={t.id} style={{ height: `${Math.max(8, (t.value / max) * 100)}%` }} title={`${t.day}: ${t.value}${unit}`} />
            ))}
          </div>
        )}
      </div>
      <button className="btn ghost" onClick={onStart}>
        {last ? "Retest" : "Take test"}
      </button>
    </div>
  );
}

function TestSheet({ type, onClose }: { type: TestType; onClose: () => void }) {
  return (
    <Sheet onClose={onClose}>
      {type === "endurance" ? <EnduranceTest onClose={onClose} /> : type === "wall" ? <WallTest onClose={onClose} /> : <PhotoTest onClose={onClose} />}
    </Sheet>
  );
}

function EnduranceTest({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [ms, setMs] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    if (state !== "running") return;
    let raf = 0;
    let lastS = 0;
    const loop = () => {
      const v = performance.now() - start.current;
      setMs(v);
      const s = Math.floor(v / 1000);
      if (s !== lastS && s % 10 === 0) sound.tick(false);
      lastS = s;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  const secs = Math.round(ms / 100) / 10;
  return (
    <div className="test-sheet">
      <p className="eyebrow">Deep neck flexor endurance</p>
      <h2>Neck endurance hold</h2>
      {state === "idle" && (
        <>
          <ol className="howto">
            <li>Lie on your back, knees bent.</li>
            <li>Tuck your chin (double chin) and lift your head about 2–3 cm off the floor.</li>
            <li>Tap start and hold. Stop when your chin pokes out, your head touches down, or you start shaking.</li>
          </ol>
          <p className="muted small">Roughly 30–40 seconds is typical for people without neck pain. Your number going up = progress.</p>
          <button
            className="btn primary wide"
            onClick={() => {
              sound.unlock();
              sound.phaseIn();
              start.current = performance.now();
              setState("running");
            }}
          >
            Start timer
          </button>
        </>
      )}
      {state !== "idle" && (
        <div className="stopwatch">
          <b>{secs.toFixed(1)}</b>
          <span>seconds</span>
        </div>
      )}
      {state === "running" && (
        <button
          className="btn danger wide"
          onClick={() => {
            sound.phaseOut();
            setState("done");
          }}
        >
          Stop
        </button>
      )}
      {state === "done" && (
        <div className="sheet-actions">
          <button className="btn ghost" onClick={() => { setMs(0); setState("idle"); }}>
            Redo
          </button>
          <button
            className="btn primary"
            onClick={() => {
              addTest("endurance", Math.round(secs));
              sound.complete();
              onClose();
            }}
          >
            Save {Math.round(secs)}s
          </button>
        </div>
      )}
    </div>
  );
}

function WallTest({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState("");
  const n = Number(v);
  return (
    <div className="test-sheet">
      <p className="eyebrow">Forward head posture</p>
      <h2>Wall test</h2>
      <ol className="howto">
        <li>Stand with heels, bum and upper back against a wall.</li>
        <li>Relax and look straight ahead. Don&apos;t force your head back.</li>
        <li>Have someone measure the gap between the back of your head and the wall.</li>
      </ol>
      <p className="muted small">Closer to 0 cm is better. A shrinking gap means your head is moving back over your shoulders.</p>
      <label className="field">
        <span>Gap (cm)</span>
        <input inputMode="decimal" type="number" min={0} max={30} step={0.5} value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. 4" />
      </label>
      <button
        className="btn primary wide"
        disabled={v === "" || isNaN(n) || n < 0 || n > 30}
        onClick={() => {
          addTest("wall", Math.round(n * 10) / 10);
          sound.unlock();
          sound.complete();
          onClose();
        }}
      >
        Save result
      </button>
    </div>
  );
}
