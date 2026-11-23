"use client";

import { useEffect, useState } from "react";
import { guard } from "@/lib/guard";
import { getMeta, initStore, useDoc } from "@/lib/store";
import { todayKey } from "@/lib/stats";
import MiniWidget from "./MiniWidget";
import { desktopBridge } from "@/lib/desktop";
import { startReminders } from "@/lib/reminders";
import { quietFor } from "@/lib/quiet";

/**
 * The whole page inside the desktop app's floating dot. It runs Posture Guard and the reminders
 * for every Upright window on this computer: the app window shows and controls the same guard.
 */
export default function DesktopWidget() {
  const doc = useDoc();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("desktop-widget-body");
    const theme = doc.settings.theme;
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    guard.setHost("widget");
    void initStore();
    // paused with "Pause for 1 hour" before a restart? stay paused for the rest of it
    const until = getMeta().guardPausedUntil ?? 0;
    if (until > Date.now()) guard.pause(Math.ceil((until - Date.now()) / 60_000));
    else void guard.start();
    startReminders();

    desktopBridge()?.onCommand((cmd) => {
      // "calibrate2" comes from older desktop app versions (second-screen mode is gone)
      if (cmd === "calibrate" || cmd === "calibrate2") guard.calibrate();
      else if (cmd === "pause") guard.pause();
      else if (cmd.startsWith("pause:")) guard.pause(Number(cmd.slice(6)) || undefined);
      else if (cmd === "resume") void guard.start();
      else if (cmd === "test") guard.testNudge();
      else if (cmd === "exercise-on") guard.setPaused(true);
      else if (cmd === "exercise-off") guard.setPaused(false);
      else if (cmd.startsWith("quiet:")) quietFor(Number(cmd.slice(6)) || null);
    });
    return () => guard.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // follow theme changes made in the app window
  const theme = doc.settings.theme;
  useEffect(() => {
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  if (!mounted) return null;
  return <MiniWidget today={todayKey(doc)} mode="desktop" />;
}
