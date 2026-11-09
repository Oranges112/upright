"use client";

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "./ui";
import { STATIC } from "@/lib/base";
import { askPermission, enablePush, isIOS, isStandalone, localNotify, notificationsSupported, pushStatus, sendTestPush } from "@/lib/push";
import { nextReminderAt } from "@/lib/schedule";
import { getDoc, getMeta, lastSessionEnd, useConfig } from "@/lib/store";

type Result = "ok" | "warn" | "fail" | "info";
interface Check {
  label: string;
  result: Result;
  detail?: string;
  fix?: { label: string; run: () => Promise<void> };
}

function platform() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (isIOS()) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  return "other";
}

const OS_TIPS: Record<string, string[]> = {
  ios: [
    "iPhone Settings → Notifications → Upright → Allow Notifications.",
    "Check that a Focus mode (Do Not Disturb, Work, Sleep) isn't silencing it.",
    "Always open Upright from its Home Screen icon, not from Safari.",
  ],
  android: [
    "Android Settings → Apps → Chrome (or Upright) → Notifications: on.",
    "Settings → Apps → Chrome → Battery → Unrestricted, so Android doesn't put it to sleep.",
    "Check Do Not Disturb is off.",
  ],
  windows: [
    "Windows Settings → System → Notifications: turn on notifications for your browser.",
    "Make sure Do Not Disturb / Focus is off.",
  ],
  mac: ["System Settings → Notifications → your browser → Allow notifications.", "Check that a Focus mode isn't on."],
  other: ["Check your device's notification settings for this browser, and that Do Not Disturb is off."],
};

function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** Step-by-step check of everything that has to be right for reminders to reach this device. */
export default function NotifCheck({ onClose }: { onClose: () => void }) {
  const config = useConfig();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<"idle" | "sent" | "failed" | "yes" | "no">("idle");
  const os = platform();

  const run = useCallback(async () => {
    const out: Check[] = [];
    const doc = getDoc();
    const meta = getMeta();
    const supported = notificationsSupported();
    out.push(
      supported
        ? { label: "This browser can show notifications", result: "ok" }
        : {
            label: "This browser can show notifications",
            result: "fail",
            detail: isIOS() ? "On iPhone, notifications only work in the Home Screen app." : "Try Chrome, Edge, Safari or Firefox.",
          },
    );
    if (isIOS() && !isStandalone()) {
      out.push({
        label: "Installed on your Home Screen",
        result: "fail",
        detail: "In Safari tap Share → Add to Home Screen, then open Upright from the new icon and run this check again.",
      });
    }
    const perm = supported ? Notification.permission : "denied";
    out.push(
      perm === "granted"
        ? { label: "Notifications allowed for Upright", result: "ok" }
        : perm === "denied"
          ? {
              label: "Notifications allowed for Upright",
              result: "fail",
              detail: "They're blocked. Tap the lock or ⓘ next to the address (or the app's settings on your phone) and allow notifications.",
            }
          : {
              label: "Notifications allowed for Upright",
              result: "fail",
              fix: {
                label: "Allow",
                run: async () => {
                  await askPermission();
                },
              },
            },
    );

    if (STATIC || !config?.push) {
      out.push({
        label: "Reminders when the app is closed",
        result: "warn",
        detail: STATIC
          ? "This free web version can only remind you while it's open (a tab, or the installed app in the background). For reminders when it's closed, host your own copy (see GitHub)."
          : "Background push isn't set up on this server, so reminders only arrive while Upright is open.",
      });
    } else if (perm === "granted") {
      const st = await pushStatus();
      const signup = async () => {
        await enablePush(config.vapidPublicKey!);
      };
      if (!meta.pushOn) {
        out.push({ label: "Background reminders switched on here", result: "fail", fix: { label: "Turn on", run: signup } });
      } else if (!st) {
        out.push({ label: "Server reachable", result: "fail", detail: "Couldn't reach the server. Check your internet connection." });
      } else if (!st.subscribed || !st.known) {
        out.push({
          label: "This device is signed up for reminders",
          result: "fail",
          detail: "The connection between this device and the server was lost.",
          fix: { label: "Repair", run: signup },
        });
      } else {
        out.push({ label: "This device is signed up for reminders", result: "ok", detail: `${st.devices} device${st.devices === 1 ? "" : "s"} linked to your account.` });
      }
      if (st?.lastReminderAt) out.push({ label: "Last reminder sent", result: "info", detail: ago(st.lastReminderAt) });
    }

    const s = doc.settings;
    if (!s.remindersOn) {
      out.push({ label: "Reminder schedule", result: "fail", detail: "Reminders are switched off. Turn them on at the top of Settings." });
    } else {
      const next = nextReminderAt(s, { lastSessionAt: lastSessionEnd(doc), lastReminderAt: meta.lastReminderAt, snoozeUntil: meta.snoozeUntil }, Date.now());
      out.push({
        label: "Reminder schedule",
        result: next ? "ok" : "warn",
        detail: next
          ? `Every ${s.intervalMin} min, ${s.startHour}:00–${s.endHour}:00. Next: ${new Date(next).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.`
          : "No upcoming reminder. Check your active days and hours.",
      });
    }
    setChecks(out);
  }, [config]);

  useEffect(() => {
    void run();
  }, [run]);

  const allGood = checks?.every((c) => c.result === "ok" || c.result === "info");

  async function sendTest() {
    setTest("idle");
    const ok = !STATIC && config?.push && getMeta().pushOn ? await sendTestPush() : await localNotify("Upright test 🔔", "If you can see this, notifications work on this device.");
    setTest(ok ? "sent" : "failed");
  }

  return (
    <Sheet onClose={onClose}>
      <div className="notif-check">
        <h2>🩺 Notification check</h2>
        <p className="muted small">Everything that has to be right for reminders to reach this device.</p>

        {!checks ? (
          <p className="muted">Checking…</p>
        ) : (
          <ul className="nc-list">
            {checks.map((c) => (
              <li key={c.label} className={`nc-${c.result}`}>
                <span className="nc-icon">{c.result === "ok" ? "✅" : c.result === "fail" ? "❌" : c.result === "warn" ? "⚠️" : "ℹ️"}</span>
                <div>
                  <b>{c.label}</b>
                  {c.detail && <p>{c.detail}</p>}
                  {c.fix && (
                    <button
                      className="btn primary small"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await c.fix!.run();
                        await run();
                        setBusy(false);
                      }}
                    >
                      {busy ? "Working…" : c.fix.label}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {allGood && <p className="nc-allgood">Everything looks right. Send a test to be sure.</p>}

        <div className="btn-row">
          <button className="btn primary" onClick={sendTest}>
            🔔 Send a test notification
          </button>
          <button className="btn ghost" onClick={() => void run()}>
            Check again
          </button>
        </div>

        {test === "failed" && <p className="row-hint warn">Couldn&apos;t send the test. Fix the ❌ items above first.</p>}
        {test === "sent" && (
          <div className="nc-ask">
            <p>
              <b>Sent! Did a notification appear?</b> It can take up to a minute. Try locking your phone or switching apps.
            </p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setTest("yes")}>
                👍 Yes
              </button>
              <button className="btn ghost" onClick={() => setTest("no")}>
                👎 No
              </button>
            </div>
          </div>
        )}
        {test === "yes" && <p className="nc-allgood">🎉 Notifications work on this device.</p>}
        {test === "no" && (
          <div className="nc-ask">
            <p>
              <b>The app sent it, so your device is holding it back. Check:</b>
            </p>
            <ul>
              {OS_TIPS[os].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn ghost wide" onClick={onClose} style={{ marginTop: 12 }}>
          Close
        </button>
      </div>
    </Sheet>
  );
}
