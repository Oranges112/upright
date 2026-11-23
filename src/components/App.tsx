"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MiniWidget from "./MiniWidget";
import { syncWidgetTheme, useWidgetWindow } from "@/lib/widget";
import Today from "./Today";
import Setup from "./Setup";
import Routines from "./Routines";
import Progress from "./Progress";
import SettingsView from "./SettingsView";
import Player from "./Player";
import Learn, { type LearnSection } from "./Learn";
import GymSession from "./GymSession";
import { getPlan } from "@/lib/gym";
import GuardView, { STATUS_UI, useGuard } from "./GuardView";
import { guard } from "@/lib/guard";
import { Card } from "./ui";
import { getRoutine, fmtDuration, routineSeconds } from "@/lib/exercises";
import { getConfig, getDoc, getMeta, initStore, linkDevice, cleanCode, setMeta, useConfig, useDoc, useMeta } from "@/lib/store";
import { REMINDER_TEXT, onReminder, reminderDone, snoozeReminder, standText, startReminders, type ReminderKind } from "@/lib/reminders";
import { todayKey } from "@/lib/stats";
import { healPush, notificationsSupported, registerSW, isIOS, isStandalone } from "@/lib/push";
import { sound } from "@/lib/sound";
import type { Routine } from "@/lib/types";
import type { GymPlan } from "@/lib/gym";

type Tab = "today" | "routines" | "learn" | "guard" | "progress" | "settings";

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
    id: "learn",
    label: "Learn",
    icon: <svg viewBox="0 0 24 24"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 014 18.5z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 001.5-1.5z" /></svg>,
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
  const [gymPlan, setGymPlan] = useState<GymPlan | null>(null);
  const [learnSection, setLearnSection] = useState<LearnSection>("desk");
  const [ready, setReady] = useState<Routine | null>(null);
  const [due, setDue] = useState<ReminderKind | null>(null);
  const [mounted, setMounted] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const installEvt = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  const today = todayKey(doc);
  const guardState = useGuard();
  const widgetWin = useWidgetWindow();

  useEffect(() => guard.setPaused(!!playing || !!gymPlan), [playing, gymPlan]);

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
    void initStore().then(() => {
      // keep background reminders working if the phone dropped this device's subscription
      const c = getConfig();
      if (c?.push && c.vapidPublicKey) void healPush(c.vapidPublicKey);
    });
    void registerSW();
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");

    // deep links: /?start=quickie  |  /#link=CODE
    const url = new URL(location.href);
    const start = url.searchParams.get("start");
    if (start) {
      setReady(getRoutine(start === "default" ? getDoc().settings.defaultRoutine : start, getDoc().settings));
      url.searchParams.delete("start");
      history.replaceState(null, "", url.pathname + url.hash);
    }
    // a link from another device can carry its server: use the same one
    const srv = location.hash.match(/server=([^&]+)/);
    if (srv) {
      try {
        const u = new URL(decodeURIComponent(srv[1]));
        if (u.protocol === "https:" && u.origin !== location.origin && !getMeta().apiUrl) {
          setMeta({ apiUrl: u.origin });
          location.reload();
          return;
        }
      } catch {}
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

    // buttons on a browser notification (see sw.js)
    const onMsg = (e: MessageEvent) => {
      const kind = (e.data?.kind ?? "break") as ReminderKind;
      if (e.data?.type === "snooze") snoozeReminder(kind);
      if (e.data?.type === "start") setReady(getRoutine(kind === "stretch" ? "stretch" : getDoc().settings.defaultRoutine, getDoc().settings));
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

  /* ---- reminders (neck breaks, quick stretch, eye breaks, standing desk): one window runs the clock ---- */
  useEffect(() => {
    startReminders();
    return onReminder((kind, done) => {
      if (kind) setDue(kind);
      else setDue((cur) => (cur === done ? null : cur));
    });
  }, []);

  function start(id: string) {
    sound.unlock(); // user gesture → audio allowed
    setReady(null);
    setDue(null);
    const r = getRoutine(id, getDoc().settings);
    if (r.id === "stretch") reminderDone("stretch");
    setPlaying(r);
  }

  // first time: the setup (what bothers you, safety check, your reminders)
  const showSetup = mounted && !meta.setupDone;

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
        {due && !playing && <DueBanner kind={due} standing={!!meta.standing} onStart={start} defaultRoutine={doc.settings.defaultRoutine} snoozeMin={doc.settings.snoozeMin || 15} />}

        {mounted && tab === "today" && (
          <Today doc={doc} meta={meta} today={today} onStart={start} onOpenSettings={() => setTab("settings")} />
        )}
        {mounted && tab === "routines" && (
          <Routines
            onStart={start}
            onStartGym={(id) => {
              sound.unlock();
              setGymPlan(getPlan(id) ?? null);
            }}
            onLearn={(s) => {
              setLearnSection(s);
              setTab("learn");
            }}
          />
        )}
        {mounted && tab === "learn" && <Learn section={learnSection} onSection={setLearnSection} />}
        {mounted && tab === "guard" && <GuardView today={today} />}
        {mounted && tab === "progress" && <Progress doc={doc} today={today} />}
        {mounted && tab === "settings" && (
          <SettingsView
            onRedoSetup={() => setMeta({ setupDone: false })}
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
            <h2>{ready.id === "stretch" ? "Quick stretch" : "Neck break time"}</h2>
            <p className="muted">
              {ready.name} · {fmtDuration(routineSeconds(ready, doc.settings.level))}
            </p>
            <button className="btn primary big wide" onClick={() => start(ready.id)}>
              ▶ Let&apos;s go
            </button>
            <button
              className="btn ghost wide"
              onClick={() => {
                snoozeReminder(ready.id === "stretch" ? "stretch" : "break");
                setReady(null);
              }}
            >
              Snooze {doc.settings.snoozeMin || 15} min
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

      {showSetup && (
        <Setup
          onDone={(first) => {
            setTab("today");
            if (first) start(getDoc().settings.defaultRoutine);
          }}
        />
      )}

      {gymPlan && <GymSession key={gymPlan.id} plan={gymPlan} onClose={() => setGymPlan(null)} />}
      {playing && <Player key={playing.id} routine={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/** The reminder banner at the top of the app (shows in every open window at once). */
function DueBanner({ kind, standing, onStart, defaultRoutine, snoozeMin }: { kind: ReminderKind; standing: boolean; onStart: (id: string) => void; defaultRoutine: string; snoozeMin: number }) {
  // the stand reminder already flipped "standing" when it fired, so show what it asked for
  const text = kind === "stand" ? standText(!standing) : REMINDER_TEXT[kind];
  return (
    <div className={`due-banner due-${kind}`}>
      <div>
        <b>{text.title}</b>
        <span>{text.body}</span>
      </div>
      <div className="btn-row">
        {kind === "break" && (
          <button className="btn primary" onClick={() => onStart(defaultRoutine)}>
            Start
          </button>
        )}
        {kind === "stretch" && (
          <button className="btn primary" onClick={() => onStart("stretch")}>
            Start (1 min)
          </button>
        )}
        {kind !== "break" && (
          <button className={`btn ${kind === "stretch" ? "ghost" : "primary"}`} onClick={() => reminderDone(kind)}>
            {kind === "stand" ? "Done" : "Done it"}
          </button>
        )}
        {kind !== "stand" && (
          <button className="btn ghost" onClick={() => snoozeReminder(kind)}>
            Snooze {snoozeMin} min
          </button>
        )}
      </div>
    </div>
  );
}
