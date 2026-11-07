"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MiniWidget from "./MiniWidget";
import { syncWidgetTheme, useWidgetWindow } from "@/lib/widget";
import Today from "./Today";
import Routines from "./Routines";
import Progress from "./Progress";
import SettingsView from "./SettingsView";
import Player from "./Player";
import GuardView, { STATUS_UI, useGuard } from "./GuardView";
import { guard } from "@/lib/guard";
import { Card } from "./ui";
import { getRoutine, fmtDuration, routineSeconds } from "@/lib/exercises";
import { getDoc, getMeta, initStore, lastSessionEnd, linkDevice, cleanCode, setMeta, snooze, useConfig, useDoc, useMeta } from "@/lib/store";
import { isReminderDue } from "@/lib/schedule";
import { todayKey } from "@/lib/stats";
import { localNotify, notificationsSupported, registerSW, isIOS, isStandalone } from "@/lib/push";
import { sound } from "@/lib/sound";
import type { Routine } from "@/lib/types";

type Tab = "today" | "routines" | "guard" | "progress" | "settings";

const NAV: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "today",
    label: "Today",
    icon: <svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" /></svg>,
  },
  {
    id: "routines",
    label: "Routines",
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.5" /><path d="M12 8v6M8 21l4-7 4 7M6 11h12" /></svg>,
  },
  {
    id: "guard",
    label: "Guard",
    icon: <svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  },
  {
    id: "progress",
    label: "Progress",
    icon: <svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>,
  },
];

export default function App() {
  const doc = useDoc();
  const meta = useMeta();
  const config = useConfig();
  const [tab, setTab] = useState<Tab>("today");
  const [playing, setPlaying] = useState<Routine | null>(null);
  const [ready, setReady] = useState<Routine | null>(null);
  const [due, setDue] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const installEvt = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  const today = todayKey(doc);
  const guardState = useGuard();
  const widgetWin = useWidgetWindow();

  useEffect(() => guard.setPaused(!!playing), [playing]);

  /* ---- theme ---- */
  const theme = doc.settings.theme ?? "system";
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") delete el.dataset.theme;
    else el.dataset.theme = theme;
    syncWidgetTheme(el.dataset.theme);
  }, [theme]);

  /* ---- boot ---- */
  useEffect(() => {
    setMounted(true);
    void initStore();
    void registerSW();
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");

    // deep links: /?start=quickie  |  /#link=CODE
    const url = new URL(location.href);
    const start = url.searchParams.get("start");
    if (start) {
      setReady(getRoutine(start === "default" ? getDoc().settings.defaultRoutine : start));
      url.searchParams.delete("start");
      history.replaceState(null, "", url.pathname + url.hash);
    }
    const m = location.hash.match(/link=([A-Za-z0-9-]+)/);
    if (m) {
      const c = cleanCode(m[1]);
      history.replaceState(null, "", location.pathname);
      if (c && c !== getMeta().code && confirm("Link this device to your Upright account? Your progress will be merged.")) {
        // wait for config to load before syncing
        setTimeout(() => void linkDevice(c), 800);
      }
    }

    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "snooze") setMeta({ snoozeUntil: Date.now() + (e.data.minutes ?? 30) * 60_000 });
      if (e.data?.type === "start") setReady(getRoutine(getDoc().settings.defaultRoutine));
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);

    const onInstall = (e: Event) => {
      e.preventDefault();
      installEvt.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMsg);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  /* ---- in-app reminder clock ---- */
  useEffect(() => {
    const check = () => {
      const d = getDoc();
      const m = getMeta();
      const now = Date.now();
      if (isReminderDue(d.settings, { lastSessionAt: lastSessionEnd(d), lastReminderAt: m.lastReminderAt, snoozeUntil: m.snoozeUntil }, now)) {
        setMeta({ lastReminderAt: now, snoozeUntil: undefined });
        setDue(true);
        if (!playing) sound.gentle();
        // Background push (if on) already notifies this device; otherwise notify from the page.
        if (!(config?.push && m.pushOn)) {
          const r = getRoutine(d.settings.defaultRoutine);
          void localNotify("Time for a neck break 🧘", `${r.name} · ${fmtDuration(routineSeconds(r, d.settings.level))}. Sit tall and let's go.`);
        }
      }
    };
    check();
    const i = setInterval(check, 30_000);
    return () => clearInterval(i);
  }, [config, playing]);

  function start(id: string) {
    sound.unlock(); // user gesture → audio allowed
    setReady(null);
    setDue(false);
    setPlaying(getRoutine(id));
  }

  const showSetup = mounted && !meta.welcomed;

  const setupCard = showSetup ? (
    <Card className="setup">
      <h3>Welcome to Upright 🌿</h3>
      <p className="muted small">
        Short, guided neck & posture breaks that fit into a workday. Set how often you want nudging, and Upright does each exercise with you: timers,
        chimes and voice.
      </p>
      <ul className="setup-list">
        <li className={perm === "granted" ? "ok" : ""}>{perm === "granted" ? "✅" : "1."} Allow notifications so we can remind you</li>
        <li>{isStandalone() ? "✅" : "2."} {isIOS() ? "Add to Home Screen (Share → Add to Home Screen)" : "Install the app for a native feel"}</li>
        <li>3. Do your first 2-minute session</li>
      </ul>
      <div className="btn-row">
        <button className="btn primary" onClick={() => setTab("settings")}>
          Set up reminders
        </button>
        <button className="btn ghost" onClick={() => setMeta({ welcomed: true })}>
          Got it
        </button>
      </div>
    </Card>
  ) : null;

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32"><circle cx="16" cy="9" r="5" /><path d="M16 15v13" /></svg>
          </span>
          <b>Upright</b>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-btn ${tab === n.id ? "on" : ""}`} onClick={() => setTab(n.id)}>
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="content">
        {due && !playing && (
          <div className="due-banner">
            <div>
              <b>Time for a neck break 🧘</b>
              <span>Sit tall. Two minutes, that&apos;s all.</span>
            </div>
            <div className="btn-row">
              <button className="btn primary" onClick={() => start(doc.settings.defaultRoutine)}>
                Start
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  void snooze(30);
                  setDue(false);
                }}
              >
                Snooze 30m
              </button>
            </div>
          </div>
        )}

        {mounted && tab === "today" && (
          <Today doc={doc} meta={meta} today={today} onStart={start} onOpenSettings={() => setTab("settings")} setupCard={setupCard} />
        )}
        {mounted && tab === "routines" && <Routines onStart={start} />}
        {mounted && tab === "guard" && <GuardView today={today} />}
        {mounted && tab === "progress" && <Progress doc={doc} today={today} />}
        {mounted && tab === "settings" && (
          <SettingsView
            doc={doc}
            meta={meta}
            config={config}
            installPrompt={
              canInstall
                ? async () => {
                    installEvt.current?.prompt();
                    await installEvt.current?.userChoice;
                    installEvt.current = null;
                    setCanInstall(false);
                  }
                : null
            }
          />
        )}
        {!mounted && <div className="loading-dot" />}
      </div>

      {ready && !playing && (
        <div className="sheet-veil" onClick={() => setReady(null)}>
          <div className="sheet ready-sheet" onClick={(e) => e.stopPropagation()} style={{ ["--g1" as string]: ready.gradient[0], ["--g2" as string]: ready.gradient[1] }}>
            <div className="rt-emoji big">{ready.emoji}</div>
            <h2>Neck break time</h2>
            <p className="muted">
              {ready.name} · {fmtDuration(routineSeconds(ready, doc.settings.level))}
            </p>
            <button className="btn primary big wide" onClick={() => start(ready.id)}>
              ▶ Let&apos;s go
            </button>
            <button
              className="btn ghost wide"
              onClick={() => {
                void snooze(30);
                setReady(null);
              }}
            >
              Snooze 30 min
            </button>
          </div>
        </div>
      )}

      {mounted && tab !== "guard" && guardState.status !== "off" && guardState.status !== "error" && (
        <button className={`guard-pill tone-${STATUS_UI[guardState.status].tone}`} onClick={() => setTab("guard")}>
          <i />
          🛡️ {STATUS_UI[guardState.status].label}
        </button>
      )}
      {widgetWin && createPortal(<MiniWidget today={today} />, widgetWin.document.body)}

      {playing && <Player key={playing.id} routine={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
