"use client";

import DesktopDownload from "./DesktopDownload";
import NotifCheck from "./NotifCheck";
import { useEffect, useState } from "react";
import { Card, Chips, Toggle, hourLabel } from "./ui";
import { LEVEL_INFO, ROUTINES, buildTimeline, getRoutine, type Level } from "@/lib/exercises";
import type { Doc } from "@/lib/types";
import {
  cleanCode,
  getDoc,
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

export default function SettingsView({ doc, meta, config, installPrompt }: { doc: Doc; meta: Meta; config: ServerConfig | null; installPrompt: (() => void) | null }) {
  const s = doc.settings;
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
        <h3 className="card-title">⏰ Reminders</h3>
        <Toggle label="Remind me to do my exercises" on={s.remindersOn} onChange={(v) => updateSettings({ remindersOn: v })} />
        <div className={s.remindersOn ? "" : "dim"}>
          <div className="field-block">
            <span className="row-label">Every</span>
            <Chips
              options={[30, 45, 60, 90, 120, 180]}
              value={s.intervalMin}
              onChange={(v) => updateSettings({ intervalMin: v })}
              format={(v) => (v < 60 ? `${v} min` : `${v / 60} h`.replace(".5 h", "½ h"))}
            />
          </div>
          <div className="field-block two">
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
                  <button
                    key={d}
                    className={`day ${on ? "on" : ""}`}
                    onClick={() => updateSettings({ days: on ? s.days.filter((x) => x !== i) : [...s.days, i].sort() })}
                  >
                    {d[0]}
                  </button>
                );
              })}
            </div>
            <span className="row-hint">Days that are off never break your streak.</span>
          </div>
        </div>
        <div className="field-block">
          <span className="row-label">Daily goal</span>
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
          <Chips options={ROUTINES.map((r) => r.id)} value={s.defaultRoutine} onChange={(v) => updateSettings({ defaultRoutine: v })} format={(id) => ROUTINES.find((r) => r.id === id)!.name} />
        </div>
      </Card>

      <Card>
        <h3 className="card-title">📱 Your devices</h3>
        {config?.sync ? (
          <>
            <p className="muted small">Your streaks and progress sync between your phone and computer. Open this link on your other device to connect it:</p>
            <div className="code-box">
              <code>{prettyCode(meta.code) || "Setting up…"}</code>
              <button
                className="btn ghost"
                disabled={!link}
                onClick={async () => {
                  try {
                    if (navigator.share) await navigator.share({ title: "Upright", text: "Link my Upright", url: link });
                    else {
                      await navigator.clipboard.writeText(link);
                      flash("Link copied. Open it on your other device.");
                    }
                  } catch {}
                }}
              >
                Share link
              </button>
            </div>
            <p className="row-hint">Keep this code private. Anyone with it can see your progress.</p>
            <div className="link-row">
              <input placeholder="Or enter a code from your other device" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} />
              <button
                className="btn primary"
                onClick={async () => {
                  const c = cleanCode(linkInput);
                  if (!c) return flash("That code doesn't look right (16 characters).");
                  await linkDevice(c);
                  setLinkInput("");
                  flash("Linked! Your data is merged and synced.");
                }}
              >
                Link
              </button>
            </div>
            {meta.syncError ? (
              <p className="row-hint warn">Sync issue: {meta.syncError}</p>
            ) : meta.lastSyncAt ? (
              <p className="row-hint">Last synced {new Date(meta.lastSyncAt).toLocaleTimeString()}</p>
            ) : null}
          </>
        ) : (
          <p className="muted small">
            {STATIC ? (
              <>
                Your progress is saved privately in this browser on this device. Nothing is sent anywhere. Use <b>Export backup</b> below to keep a
                copy. Want phone and computer to share progress?{" "}
                <a href="https://github.com/Oranges112/upright#host-your-own-copy-about-10-minutes-free-tiers" target="_blank" rel="noreferrer">
                  Host your own copy
                </a>
                .
              </>
            ) : (
              "Sync isn't configured on this server yet, so data stays on this device. See the README to switch on Upstash."
            )}
          </p>
        )}
      </Card>

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
