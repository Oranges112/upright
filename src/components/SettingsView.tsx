"use client";

import DesktopDownload from "./DesktopDownload";
import DesktopUpdates from "./DesktopUpdates";
import NotifCheck from "./NotifCheck";
import PhoneLink from "./PhoneLink";
import { quietFor } from "@/lib/quiet";
import { useEffect, useState } from "react";
import { Card, Chips, Toggle, hourLabel } from "./ui";
import { AREAS, EXERCISES, LEVEL_INFO, ROUTINES, buildTimeline, getRoutine, myMix, type Level } from "@/lib/exercises";
import { appBridge, type DesktopPrefs } from "@/lib/desktop";
import { mergeDocs, normalize } from "@/lib/merge";
import type { Doc } from "@/lib/types";
import {
  cleanCode,
  getDoc,
  setMeta,
  importDoc,
  linkDevice,
  prettyCode,
  resetLocal,
  syncNow,
  updateSettings,
  type Meta,
  type ServerConfig,
} from "@/lib/store";
import { askPermission, disablePush, enablePush, isIOS, isStandalone, localNotify, notificationsSupported, sendTestPush } from "@/lib/push";
import { sound } from "@/lib/sound";
import { BASE, STATIC } from "@/lib/base";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SettingsView({
  doc,
  meta,
  config,
  installPrompt,
  onRedoSetup,
}: {
  doc: Doc;
  meta: Meta;
  config: ServerConfig | null;
  installPrompt: (() => void) | null;
  onRedoSetup: () => void;
}) {
  const s = doc.settings;
  const [desk, setDesk] = useState<DesktopPrefs | null>(null);
  useEffect(() => {
    void appBridge()?.getPrefs?.().then(setDesk);
  }, []);
  const setDeskPref = (p: Partial<DesktopPrefs>) => {
    if (desk) setDesk({ ...desk, ...p });
    appBridge()?.setPrefs?.(p);
  };
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [msg, setMsg] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [checkOpen, setCheckOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
  }, []);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };

  async function turnOnNotifications() {
    setBusy(true);
    try {
      if (config?.push && config.vapidPublicKey) {
        if (!meta.code) await syncNow();
        const r = await enablePush(config.vapidPublicKey);
        flash(r.ok ? "Reminders on for this device ✅" : r.error ?? "Couldn't enable reminders.");
      } else {
        const p = await askPermission();
        flash(p === "granted" ? "Notifications on. You'll be reminded while Upright is open." : "Notifications are blocked in your browser settings.");
      }
    } finally {
      setPerm(notificationsSupported() ? Notification.permission : "unsupported");
      setBusy(false);
    }
  }

  async function test() {
    if (config?.push && meta.pushOn) {
      const ok = await sendTestPush();
      flash(ok ? "Test sent. It should arrive in a few seconds." : "Test failed. Try re-enabling reminders.");
    } else {
      const ok = await localNotify("Time for a neck break 🧘", "2 minutes. Your future neck says thanks.");
      flash(ok ? "Test notification shown." : "Allow notifications first.");
    }
  }

  const link = typeof window !== "undefined" && meta.code ? `${location.origin}${BASE}/#link=${meta.code}` : "";

  return (
    <div className="view settings">
      <header className="view-head">
        <div>
          <p className="eyebrow">Make it yours</p>
          <h1>Settings</h1>
        </div>
      </header>

      {msg && <div className="toast">{msg}</div>}

      <Card>
        <h3 className="card-title">🎯 What bothers you</h3>
        <p className="muted small">You only see exercises for these. Tap to add or remove.</p>
        <div className="area-chips">
          {AREAS.map((a) => {
            const on = s.areas.includes(a.id);
            return (
              <button
                key={a.id}
                className={`chip ${on ? "on" : ""}`}
                onClick={() => {
                  const areas = on ? s.areas.filter((x) => x !== a.id) : [...s.areas, a.id];
                  updateSettings({ areas });
                }}
              >
                {a.emoji} {a.name}
              </button>
            );
          })}
        </div>
        <Toggle label="Also show exercises for other areas" on={s.showAll} onChange={(v) => updateSettings({ showAll: v })} />
        <Toggle
          label="Seated only"
          hint="No standing moves: each one is swapped for a seated version (also for the quick stretch)."
          on={s.seatedOnly}
          onChange={(v) => updateSettings({ seatedOnly: v })}
        />
        {s.areas.length > 0 && <span className="row-hint">My Mix right now: {myMix(s).exercises.map((id) => EXERCISES[id].name).join(", ")}.</span>}
        {s.skip.length > 0 && (
          <div className="field-block">
            <span className="row-label">Moves you said hurt (swapped for gentler ones)</span>
            <div className="skip-list">
              {s.skip.map((id) => (
                <span key={id} className="skip-item">
                  {EXERCISES[id]?.name ?? id}
                  <button className="link" onClick={() => updateSettings({ skip: s.skip.filter((x) => x !== id) })}>
                    Bring back
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn ghost" onClick={onRedoSetup}>
            Redo the setup
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="card-title">🗓️ 4-week plan</h3>
        <Toggle
          label="Follow the 4-week plan"
          hint="A session a day from your areas: gentle in week 1, stronger each week."
          on={s.planOn}
          onChange={(v) =>
            updateSettings(v ? { planOn: true, planStart: s.planStart ?? new Date().toISOString().slice(0, 10), defaultRoutine: "plan" } : { planOn: false, defaultRoutine: s.defaultRoutine === "plan" ? "mix" : s.defaultRoutine })
          }
        />
        <div className={s.planOn ? "" : "dim"}>
          <div className="field-block">
            <span className="row-label">Days a week to aim for</span>
            <Chips options={[3, 4, 5, 6, 7]} value={s.planPerWeek} onChange={(v) => updateSettings({ planPerWeek: v })} format={(v) => `${v} days`} />
          </div>
          {s.planOn && s.planStart && (
            <div className="btn-row">
              <button
                className="btn ghost"
                onClick={() => {
                  if (confirm("Start the plan again from week 1?")) updateSettings({ planStart: new Date().toISOString().slice(0, 10) });
                }}
              >
                Start again from week 1
              </button>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="card-title">🔕 Quiet times</h3>
        <Toggle
          label="Stay quiet during calls and presentations"
          hint="Desktop app: no reminders or pop-ups while another app uses your camera or microphone, or while you present or use a full-screen app. Posture is still measured."
          on={s.quietCalls}
          onChange={(v) => updateSettings({ quietCalls: v })}
        />
        <div className="field-block">
          <span className="row-label">Quiet right now</span>
          <Chips
            options={[0, 30, 60, 120]}
            value={meta.quietUntil && meta.quietUntil > Date.now() ? -1 : 0}
            onChange={(v) => quietFor(v || null)}
            format={(v) => (v === 0 ? (meta.quietUntil && meta.quietUntil > Date.now() ? "End quiet" : "Off") : v < 60 ? `${v} min` : `${v / 60} h`)}
          />
          {meta.quietUntil && meta.quietUntil > Date.now() && (
            <span className="row-hint">Quiet until {new Date(meta.quietUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</span>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="card-title">⏰ Reminders</h3>
        <p className="muted small">Each one has its own switch and timing. They only come on your days, between your hours.</p>
        <div className="field-block two" style={{ borderTop: 0, paddingTop: 0 }}>
          <label className="field">
            <span>From</span>
            <select value={s.startHour} onChange={(e) => updateSettings({ startHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h} disabled={h >= s.endHour}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Until</span>
            <select value={s.endHour} onChange={(e) => updateSettings({ endHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                <option key={h} value={h} disabled={h <= s.startHour}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field-block">
          <span className="row-label">On these days</span>
          <div className="days">
            {DAYS.map((d, i) => {
              const on = s.days.includes(i);
              return (
                <button key={d} className={`day ${on ? "on" : ""}`} onClick={() => updateSettings({ days: on ? s.days.filter((x) => x !== i) : [...s.days, i].sort() })}>
                  {d[0]}
                </button>
              );
            })}
          </div>
          <span className="row-hint">Days that are off never break your streak.</span>
        </div>

        <div className="rem-block">
          <Toggle label="🧘 Exercise breaks" hint="A guided routine (your main routine, below)." on={s.remindersOn} onChange={(v) => updateSettings({ remindersOn: v })} />
          <div className={s.remindersOn ? "" : "dim"}>
            <Chips options={[30, 45, 60, 90, 120, 180]} value={s.intervalMin} onChange={(v) => updateSettings({ intervalMin: v })} format={(v) => `every ${fmtEvery(v)}`} />
          </div>
        </div>

        <div className="rem-block">
          <Toggle
            label="🧍 Quick stretch"
            hint="Stand up and move for a minute."
            on={s.stretchOn}
            onChange={(v) => {
              updateSettings({ stretchOn: v });
              if (v) setMeta({ lastStretchReminderAt: Date.now() });
            }}
          />
          <div className={s.stretchOn ? "" : "dim"}>
            <Chips options={[30, 45, 60, 90, 120]} value={s.stretchMin} onChange={(v) => updateSettings({ stretchMin: v })} format={(v) => `every ${fmtEvery(v)}`} />
          </div>
        </div>

        <div className="rem-block">
          <Toggle
            label="👀 Eye breaks (20-20-20)"
            hint="Look about 6 m (20 ft) away for 20 seconds."
            on={s.eyeOn}
            onChange={(v) => {
              updateSettings({ eyeOn: v });
              if (v) setMeta({ lastEyeAt: Date.now() });
            }}
          />
          <div className={s.eyeOn ? "" : "dim"}>
            <Chips options={[15, 20, 30, 45, 60]} value={s.eyeMin} onChange={(v) => updateSettings({ eyeMin: v })} format={(v) => `every ${fmtEvery(v)}`} />
          </div>
        </div>

        <div className="rem-block">
          <Toggle
            label="🔁 Standing desk"
            hint="Switch between sitting and standing."
            on={s.standDeskOn}
            onChange={(v) => {
              updateSettings({ standDeskOn: v });
              if (v) setMeta({ lastStandSwitchAt: Date.now() });
            }}
          />
          <div className={s.standDeskOn ? "" : "dim"}>
            <Chips options={[30, 45, 60, 90]} value={s.standDeskMin} onChange={(v) => updateSettings({ standDeskMin: v })} format={(v) => `switch every ${fmtEvery(v)}`} />
          </div>
        </div>

        <div className="rem-block">
          <span className="row-label">📱 Phone posture check (on your phone)</span>
          <Chips options={[0, 30, 60, 120]} value={s.phoneCheckMin} onChange={(v) => updateSettings({ phoneCheckMin: v })} format={(v) => (v === 0 ? "Off" : `every ${fmtEvery(v)}`)} />
          <Toggle
            label="Lift-your-phone nudge"
            hint="On a phone, while Upright is open: if you hold it low for a minute, a gentle nudge. (Phones only let apps like this read the tilt while they're open.)"
            on={meta.phoneNudge !== false}
            onChange={(v) => setMeta({ phoneNudge: v })}
          />
        </div>

        <div className="field-block">
          <span className="row-label">Snooze lasts</span>
          <Chips options={[5, 10, 15, 30, 60]} value={s.snoozeMin} onChange={(v) => updateSettings({ snoozeMin: v })} format={(v) => fmtEvery(v)} />
        </div>
        <Toggle label="Play a chime with reminders" on={s.reminderSound} onChange={(v) => updateSettings({ reminderSound: v })} />

        <div className="field-block">
          <span className="row-label">Daily goal (exercise sessions)</span>
          <div className="stepper">
            <button onClick={() => updateSettings({ dailyGoal: Math.max(1, s.dailyGoal - 1) })}>−</button>
            <b>
              {s.dailyGoal} session{s.dailyGoal === 1 ? "" : "s"}
            </b>
            <button onClick={() => updateSettings({ dailyGoal: Math.min(12, s.dailyGoal + 1) })}>+</button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="card-title">🚶 Breaks & sitting time</h3>
        <div className="field-block" style={{ borderTop: 0, paddingTop: 0 }}>
          <span className="row-label">Count time away from the desk as a break, after</span>
          <Chips options={[0, 2, 3, 5, 10]} value={s.awayBreakMin} onChange={(v) => updateSettings({ awayBreakMin: v })} format={(v) => (v === 0 ? "Off" : `${v} min`)} />
          <span className="row-hint">
            When your computer is idle or locked (desktop app), or Posture Guard can&apos;t see you, for this long, your quick-stretch and eye-break timers start again. No reminders while you&apos;re away.
          </span>
        </div>
        <Toggle label="Track my sitting time" hint="Shows time at your desk and your longest stretch without a break on Today." on={s.sitTrackOn} onChange={(v) => updateSettings({ sitTrackOn: v })} />
      </Card>

      <Card>
        <h3 className="card-title">📈 Check-ins & summary</h3>
        <Toggle label="Ask how my areas feel" hint="A quick tap on a face, so Progress can show it getting better." on={s.painCheckOn} onChange={(v) => updateSettings({ painCheckOn: v })} />
        <div className={s.painCheckOn ? "" : "dim"}>
          <Chips
            options={[0, 1, 3, 7]}
            value={s.painCheckDays}
            onChange={(v) => updateSettings({ painCheckDays: v })}
            format={(v) => (v === 0 ? "After every session" : v === 1 ? "Once a day" : v === 7 ? "Once a week" : `Every ${v} days`)}
          />
        </div>
        <Toggle label="Weekly summary" hint="On Mondays: how last week went." on={s.weeklyOn} onChange={(v) => updateSettings({ weeklyOn: v })} />
      </Card>

      {desk && (
        <Card>
          <h3 className="card-title">🖥️ Desktop app</h3>
          <Toggle
            label={/Mac/i.test(navigator.userAgent) ? "Open at login" : "Start with Windows"}
            hint="Starts quietly as just the posture dot."
            on={desk.openAtLogin}
            onChange={(v) => setDeskPref({ openAtLogin: v })}
          />
          <Toggle label="Show the floating posture dot" hint="Posture Guard and reminders keep working when it's hidden." on={desk.showDot} onChange={(v) => setDeskPref({ showDot: v })} />
          <span className="row-hint">Posture Guard settings (sensitivity, chime, pop-ups) are on the Guard tab.</span>
        </Card>
      )}

      <Card>
        <h3 className="card-title">🔔 Notifications on this device</h3>
        {perm === "unsupported" ? (
          <p className="muted small">
            {isIOS() && !isStandalone()
              ? "On iPhone: tap the Share button in Safari, then 'Add to Home Screen'. Open Upright from your Home Screen to turn on reminders."
              : "This browser doesn't support notifications."}
          </p>
        ) : (
          <>
            <p className="muted small">
              {config?.push
                ? meta.pushOn && perm === "granted"
                  ? "✅ Background reminders are on. They arrive even when Upright is closed."
                  : "Turn on to get reminders on this device, even when the app is closed."
                : perm === "granted"
                  ? STATIC
                    ? "✅ On. Reminders show while Upright is open in a tab or installed window. Keep it open in the background during your workday."
                    : "✅ On. Reminders show while Upright is open in a tab or window (background push isn't configured on this server)."
                  : STATIC
                    ? "Allow notifications so Upright can nudge you while it's open in the background."
                    : "Allow notifications so Upright can nudge you."}
            </p>
            <div className="btn-row">
              {!(perm === "granted" && (!config?.push || meta.pushOn)) && (
                <button className="btn primary" disabled={busy} onClick={turnOnNotifications}>
                  {busy ? "Working…" : "Turn on notifications"}
                </button>
              )}
              {perm === "granted" && (
                <button className="btn ghost" onClick={test}>
                  Send test
                </button>
              )}
              {config?.push && meta.pushOn && (
                <button
                  className="btn ghost"
                  onClick={async () => {
                    await disablePush();
                    flash("Background reminders off for this device.");
                  }}
                >
                  Turn off here
                </button>
              )}
              <button className="btn ghost" onClick={() => setCheckOpen(true)}>
                🩺 Check my notifications
              </button>
            </div>
            {perm === "denied" && <p className="row-hint">Notifications are blocked. Re-enable them in your browser&apos;s site settings.</p>}
          </>
        )}
      </Card>

      <Card>
        <h3 className="card-title">💪 Intensity</h3>
        <Chips
          options={[1, 2, 3, 4] as Level[]}
          value={(s.level ?? 2) as Level}
          onChange={(v) => updateSettings({ level: v })}
          format={(v) => LEVEL_INFO[v].name}
        />
        <p className="muted small" style={{ marginTop: 10 }}>
          {LEVEL_INFO[(s.level ?? 2) as Level].blurb}
        </p>
        <div className="level-preview">
          {(() => {
            const l = (s.level ?? 2) as Level;
            const steps = buildTimeline({ ...getRoutine("full"), reps: undefined, holdSec: undefined }, l);
            const first = (id: string, label: string) => steps.find((x) => x.exerciseId === id && x.label === label);
            const tuck = first("chin-tuck", "Tuck");
            const hold = first("tuck-hold", "Hold");
            const stretch = first("side-tilt", "Hold");
            return (
              <>
                <span>
                  Chin tucks <b>{tuck?.sec}s × {tuck?.reps}</b>
                </span>
                <span>
                  Tuck hold <b>{hold?.sec}s</b>
                </span>
                <span>
                  Stretches <b>{stretch?.sec}s</b>
                </span>
                <span>
                  Mobility <b>unchanged</b>
                </span>
              </>
            );
          })()}
        </div>
        <span className="row-hint">Only strength moves get much harder. Stretches max out at 30s, and mobility moves stay the same, because pushing those harder doesn&apos;t help.</span>
      </Card>

      <Card>
        <h3 className="card-title">🌗 Appearance</h3>
        <Chips
          options={["system", "light", "dark"] as ("system" | "light" | "dark")[]}
          value={s.theme ?? "system"}
          onChange={(v) => updateSettings({ theme: v })}
          format={(v) => (v === "system" ? "Match device" : v === "light" ? "☀️ Light" : "🌙 Dark")}
        />
      </Card>

      <Card>
        <h3 className="card-title">🎧 Session</h3>
        <Toggle
          label="Sounds & chimes"
          hint="Soft bells for each move and countdown ticks"
          on={s.sound}
          onChange={(v) => {
            updateSettings({ sound: v });
            sound.enabled = v;
            if (v) {
              sound.unlock();
              sound.next();
            }
          }}
        />
        <Toggle label="Ambient music" hint="A calm, breathing pad under your session" on={s.ambient} onChange={(v) => updateSettings({ ambient: v })} />
        <Toggle label="Voice coach" hint="Spoken cues so you can close your eyes" on={s.voice} onChange={(v) => updateSettings({ voice: v })} />
        <div className="field-block">
          <span className="row-label">Main routine</span>
          <Chips
            options={[...(s.planOn ? ["plan"] : []), "mix", ...doc.custom.filter((r) => !r.deleted).map((r) => r.id), ...ROUTINES.map((r) => r.id)]}
            value={s.defaultRoutine}
            onChange={(v) => updateSettings({ defaultRoutine: v })}
            format={(id) =>
              id === "plan" ? "🗓️ My plan" : id === "mix" ? "✨ My Mix" : (doc.custom.find((r) => r.id === id)?.name ?? ROUTINES.find((r) => r.id === id)?.name ?? id)
            }
          />
          <span className="row-hint">What &ldquo;Start&rdquo; and the exercise-break reminder open. My Mix is built from your areas.</span>
        </div>
      </Card>

      <PhoneLink meta={meta} config={config} flash={flash} />

      <Card>
        <h3 className="card-title">📲 Install the app</h3>
        {isStandalone() ? (
          <p className="muted small">✅ You&apos;re using the installed app.</p>
        ) : installPrompt ? (
          <>
            <p className="muted small">Install Upright so it opens in its own window and feels like a native app.</p>
            <button className="btn primary" onClick={installPrompt}>
              Install Upright
            </button>
          </>
        ) : (
          <p className="muted small">
            {isIOS()
              ? "iPhone/iPad: in Safari tap Share → 'Add to Home Screen'. This is required for reminders on iOS."
              : "Use your browser's menu → 'Install app' (Chrome/Edge) or 'Add to Home Screen' (Android)."}
          </p>
        )}
      </Card>

      <DesktopDownload />
      <DesktopUpdates />
      {checkOpen && <NotifCheck onClose={() => setCheckOpen(false)} />}

      <Card>
        <h3 className="card-title">🗂 Data</h3>
        <div className="btn-row">
          <button
            className="btn ghost"
            onClick={() => {
              const blob = new Blob([JSON.stringify(getDoc(), null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `upright-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
            }}
          >
            Export backup
          </button>
          <label className="btn ghost">
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const incoming = normalize(JSON.parse(await f.text()));
                  importDoc(mergeDocs(getDoc(), incoming));
                  flash("Backup imported and merged with what's here ✅");
                } catch {
                  flash("That file isn't an Upright backup.");
                }
              }}
            />
          </label>
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm("Remove all Upright data from THIS device? (Synced data on the server stays.)")) {
                resetLocal();
                location.reload();
              }
            }}
          >
            Reset this device
          </button>
        </div>
        <p className="row-hint">Timezone: {s.tz}</p>
      </Card>

      <p className="disclaimer">
        Upright is a habit tool, not medical advice. Move gently and within comfort. If you have sharp pain, numbness, tingling, or dizziness, stop and see a
        physio or doctor.
      </p>
    </div>
  );
}

function fmtEvery(v: number) {
  return v < 60 ? `${v} min` : v % 60 ? `${Math.floor(v / 60)}½ h` : `${v / 60} h`;
}
