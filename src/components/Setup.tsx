"use client";

import { useEffect, useState } from "react";
import { Chips, Toggle, hourLabel } from "./ui";
import { AREAS, myMix } from "@/lib/exercises";
import { addCheckin, setMeta, updateSettings, useDoc } from "@/lib/store";
import { askPermission, notificationsSupported } from "@/lib/push";
import { appBridge, type DesktopPrefs } from "@/lib/desktop";
import type { Area } from "@/lib/types";

/** Signs that need a doctor or physio before (or instead of) exercises. */
export const RED_FLAGS = [
  "Numbness, tingling or pins and needles in your arms, hands, legs or feet",
  "Pain that shoots down an arm or a leg",
  "Weakness in an arm or a leg, or trouble with balance",
  "Pain after a fall, accident or injury",
  "Severe pain, or pain that keeps getting worse",
  "Pain with fever, unexplained weight loss, or trouble controlling your bladder or bowels",
];

const FACES = ["😌", "🙂", "😐", "😣", "😖"];
const FACE_VALUES = [0, 2, 5, 7, 9];

const every = (v: number) => (v === 0 ? "Off" : v < 60 ? `${v} min` : v % 60 ? `${Math.floor(v / 60)}½ h` : `${v / 60} h`);

/**
 * First-time setup: what bothers you, a quick safety check, how it feels today (so Progress can
 * show it getting better), and which reminders you want and how often. Everything here can be
 * changed later in Settings.
 */
export default function Setup({ onDone }: { onDone: (startFirst: boolean) => void }) {
  const doc = useDoc();
  const s = doc.settings;
  const [step, setStep] = useState(0);
  const [areas, setAreas] = useState<Area[]>(s.areas.length ? s.areas : []);
  const [flags, setFlags] = useState<number[]>([]);
  const [feel, setFeel] = useState<Partial<Record<Area, number>>>({});
  const [breakMin, setBreakMin] = useState(s.remindersOn ? s.intervalMin : 0);
  const [stretchMin, setStretchMin] = useState(s.stretchOn ? s.stretchMin : 0);
  const [eye, setEye] = useState(s.eyeOn);
  const [standDesk, setStandDesk] = useState(s.standDeskOn);
  const [startHour, setStartHour] = useState(s.startHour);
  const [endHour, setEndHour] = useState(s.endHour);
  const [perm, setPerm] = useState<string>("default");
  const [desk, setDesk] = useState<DesktopPrefs | null>(null);
  const [plan4, setPlan4] = useState(true);

  useEffect(() => {
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
    void appBridge()?.getPrefs?.().then(setDesk);
  }, []);

  const toggleArea = (a: Area) => setAreas((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));
  const steps = ["areas", "safety", "feel", "reminders", "done"] as const;
  const id = steps[step];
  const next = () => setStep((x) => Math.min(steps.length - 1, x + 1));
  const back = () => setStep((x) => Math.max(0, x - 1));

  function finish(startFirst: boolean) {
    const upperOnly = areas.length > 0 && areas.every((a) => a === "neck" || a === "upper-back");
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    updateSettings({
      areas,
      ...(plan4 && areas.length ? { planOn: true, planStart: s.planOn && s.planStart ? s.planStart : today } : {}),
      defaultRoutine:
        plan4 && areas.length ? "plan" : areas.length === 0 || upperOnly ? (s.defaultRoutine === "mix" ? "quickie" : s.defaultRoutine) : "mix",
      remindersOn: breakMin > 0,
      intervalMin: breakMin || s.intervalMin,
      stretchOn: stretchMin > 0,
      stretchMin: stretchMin || s.stretchMin,
      eyeOn: eye,
      standDeskOn: standDesk,
      startHour,
      endHour,
    });
    for (const a of areas) if (feel[a] != null) addCheckin(feel[a]!, a);
    setMeta({ setupDone: true, welcomed: true, lastStretchReminderAt: now, lastEyeAt: now, lastStandSwitchAt: now, lastPainCheckAt: now });
    onDone(startFirst);
  }

  const plan = myMix({ areas });

  return (
    <div className="setup-veil">
      <div className="setup-sheet" role="dialog" aria-label="Set up Upright">
        <div className="setup-dots" aria-hidden>
          {steps.map((x, i) => (
            <i key={x} className={i <= step ? "on" : ""} />
          ))}
        </div>

        {id === "areas" && (
          <>
            <h2>What bothers you? 🌿</h2>
            <p className="muted">Pick everything that applies. You&apos;ll only see exercises for these (you can change it any time in Settings).</p>
            <div className="area-grid">
              {AREAS.map((a) => (
                <button key={a.id} className={`area-card ${areas.includes(a.id) ? "on" : ""}`} onClick={() => toggleArea(a.id)} aria-pressed={areas.includes(a.id)}>
                  <span className="area-emoji">{a.emoji}</span>
                  <b>{a.name}</b>
                  <small>{a.blurb}</small>
                  <span className="area-tick">{areas.includes(a.id) ? "✓" : ""}</span>
                </button>
              ))}
            </div>
            <div className="setup-actions">
              <button className="btn ghost" onClick={() => finish(false)}>
                Skip setup
              </button>
              <button className="btn primary" onClick={next} disabled={areas.length === 0}>
                Next
              </button>
            </div>
          </>
        )}

        {id === "safety" && (
          <>
            <h2>A quick safety check 🩺</h2>
            <p className="muted">Do any of these apply to you right now?</p>
            <div className="flag-list">
              {RED_FLAGS.map((f, i) => (
                <label key={f} className={`flag ${flags.includes(i) ? "on" : ""}`}>
                  <input type="checkbox" checked={flags.includes(i)} onChange={() => setFlags((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]))} />
                  <span>{f}</span>
                </label>
              ))}
            </div>
            {flags.length > 0 ? (
              <p className="setup-warn">
                <b>Please see a doctor or physiotherapist first.</b> These can be signs of something exercises won&apos;t fix. You can still use Upright&apos;s
                reminders and Posture Guard, and only do exercises once you&apos;ve been checked and told they&apos;re fine.
              </p>
            ) : (
              <p className="row-hint">None of these? Great. Keep every stretch gentle, and stop anything that hurts. Upright will swap it for an easier one.</p>
            )}
            <div className="setup-actions">
              <button className="btn ghost" onClick={back}>
                Back
              </button>
              <button className="btn primary" onClick={next}>
                {flags.length > 0 ? "I understand" : "None of these"}
              </button>
            </div>
          </>
        )}

        {id === "feel" && (
          <>
            <h2>How does it feel today?</h2>
            <p className="muted">So you can watch it get better in Progress.</p>
            <div className="feel-list">
              {areas.map((a) => {
                const info = AREAS.find((x) => x.id === a)!;
                return (
                  <div key={a} className="feel-line">
                    <span>
                      {info.emoji} {info.name}
                    </span>
                    <div className="faces">
                      {FACES.map((f, i) => (
                        <button key={f} className={`face ${feel[a] === FACE_VALUES[i] ? "on" : ""}`} onClick={() => setFeel((x) => ({ ...x, [a]: FACE_VALUES[i] }))} aria-label={`${i * 25}% bad`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="row-hint">😌 fine · 😖 really bad</p>
            <div className="setup-actions">
              <button className="btn ghost" onClick={back}>
                Back
              </button>
              <button className="btn primary" onClick={next}>
                Next
              </button>
            </div>
          </>
        )}

        {id === "reminders" && (
          <>
            <h2>Your reminders ⏰</h2>
            <p className="muted">Turn each one on or off, and choose how often. They only come during your working hours.</p>
            <div className="field-block" style={{ borderTop: 0 }}>
              <span className="row-label">🧘 Exercise break, every</span>
              <Chips options={[0, 30, 45, 60, 90, 120, 180]} value={breakMin} onChange={setBreakMin} format={every} />
            </div>
            <div className="field-block">
              <span className="row-label">🧍 Quick stretch (stand up and move), every</span>
              <Chips options={[0, 30, 45, 60, 90, 120]} value={stretchMin} onChange={setStretchMin} format={every} />
            </div>
            <Toggle label="👀 Eye breaks (20-20-20)" hint={`Every ${s.eyeMin} min, look far away for 20 seconds.`} on={eye} onChange={setEye} />
            <Toggle label="🔁 I have a standing desk" hint={`Reminds you to switch between sitting and standing every ${s.standDeskMin} min.`} on={standDesk} onChange={setStandDesk} />
            <div className="field-block two">
              <label className="field">
                <span>From</span>
                <select value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h} disabled={h >= endHour}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Until</span>
                <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                    <option key={h} value={h} disabled={h <= startHour}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="setup-actions">
              <button className="btn ghost" onClick={back}>
                Back
              </button>
              <button className="btn primary" onClick={next}>
                Next
              </button>
            </div>
          </>
        )}

        {id === "done" && (
          <>
            <h2>You&apos;re all set ✨</h2>
            <p className="muted">
              Your plan: <b>{plan.name}</b>, {plan.exercises.length} moves for {areas.length === 0 ? "everything" : areas.map((a) => AREAS.find((x) => x.id === a)!.name.toLowerCase()).join(", ")}.
              {flags.length > 0 && " Remember: get checked before doing the exercises."}
            </p>
            <Toggle
              label="🗓️ Follow the 4-week plan"
              hint="A session a day from your areas: gentle in week 1, stronger each week."
              on={plan4}
              onChange={setPlan4}
            />
            {perm !== "granted" && perm !== "unsupported" && !desk && (
              <button
                className="btn ghost wide"
                onClick={async () => {
                  setPerm(await askPermission());
                }}
              >
                🔔 Allow notifications (so reminders reach you)
              </button>
            )}
            {perm === "granted" && <p className="row-hint">🔔 Notifications are on.</p>}
            {desk && (
              <>
                <Toggle
                  label="Start Upright with my computer"
                  hint="Just the little posture dot, quietly. The app opens when you click it."
                  on={desk.openAtLogin}
                  onChange={(v) => {
                    setDesk({ ...desk, openAtLogin: v });
                    appBridge()?.setPrefs?.({ openAtLogin: v });
                  }}
                />
                <Toggle
                  label="Show the floating posture dot"
                  on={desk.showDot}
                  onChange={(v) => {
                    setDesk({ ...desk, showDot: v });
                    appBridge()?.setPrefs?.({ showDot: v });
                  }}
                />
              </>
            )}
            <div className="setup-actions">
              <button className="btn ghost" onClick={() => finish(false)}>
                Maybe later
              </button>
              <button className="btn primary" onClick={() => finish(flags.length === 0)}>
                {flags.length === 0 ? "▶ Try my first session" : "Finish"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
