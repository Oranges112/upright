"use client";

import { useEffect, useState } from "react";
import { guard } from "@/lib/guard";
import { initStore, useDoc } from "@/lib/store";
import { todayKey } from "@/lib/stats";
import MiniWidget from "./MiniWidget";
import { desktopBridge } from "@/lib/desktop";

/** The whole page inside the desktop app: starts Posture Guard and shows only the pill. */
export default function DesktopWidget() {
  const doc = useDoc();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("desktop-widget-body");
    const theme = doc.settings.theme;
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    void initStore();
    void guard.start();

    desktopBridge()?.onCommand((cmd) => {
      if (cmd === "calibrate") guard.calibrate(1);
      else if (cmd === "calibrate2") guard.calibrate(2);
      else if (cmd === "pause") guard.stop();
      else if (cmd === "resume") void guard.start();
      else if (cmd === "test") guard.testNudge();
    });
    return () => guard.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;
  return <MiniWidget today={todayKey(doc)} mode="desktop" />;
}
