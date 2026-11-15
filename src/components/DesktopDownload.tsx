"use client";

import { useEffect, useState } from "react";
import { DESKTOP_KEY, OPEN_DESKTOP_APP, appBridge, desktopBridge } from "@/lib/desktop";

/** Always point at the newest installers published on GitHub. */
export const WINDOWS_INSTALLER = "https://github.com/Oranges112/upright/releases/latest/download/Upright-Setup.exe";
export const MAC_INSTALLER = "https://github.com/Oranges112/upright/releases/latest/download/Upright-Mac.dmg";

type Platform = "windows" | "mac";

/** Which desktop app this computer can run, if any (never inside the desktop app itself). */
export function desktopPlatform(): Platform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Electron/i.test(ua) || desktopBridge() || appBridge()) return null;
  if (/Windows/i.test(ua)) return "windows";
  // iPads also say "Macintosh", but have a touch screen
  if (/Macintosh|Mac OS X/i.test(ua) && !(navigator.maxTouchPoints > 1)) return "mac";
  return null;
}

const COPY: Record<Platform, { name: string; url: string; size: string; steps: React.ReactNode[] }> = {
  windows: {
    name: "Windows",
    url: WINDOWS_INSTALLER,
    size: "~120 MB, Windows 10/11",
    steps: [
      <>
        Open <b>Upright-Setup.exe</b> from your downloads (bottom or top-right of your browser).
      </>,
      <>
        If Windows says it&apos;s from an unknown publisher, click <b>More info → Run anyway</b>.
      </>,
      <>It installs in a few seconds and the dot appears. Right-click it and choose Recalibrate while sitting tall.</>,
      <>Turn Posture Guard off here first. Windows lets only one app use the camera.</>,
    ],
  },
  mac: {
    name: "Mac",
    url: MAC_INSTALLER,
    size: "~230 MB, macOS 12 or newer, Intel and Apple Silicon",
    steps: [
      <>
        Open <b>Upright-Mac.dmg</b> from your Downloads and drag <b>Upright</b> into <b>Applications</b>.
      </>,
      <>
        Open Upright from Applications. The first time, macOS says it can&apos;t check it: click <b>Done</b>, then go to{" "}
        <b>System Settings → Privacy &amp; Security</b>, scroll down and click <b>Open Anyway</b>.
      </>,
      <>
        Click <b>OK</b> when it asks for the camera. The dot appears, with an Upright icon in the menu bar at the top. Right-click the dot (or
        click the menu-bar icon) and choose Recalibrate while sitting tall.
      </>,
      <>Turn Posture Guard off here first, so the camera is free for the app.</>,
    ],
  },
};

/** Card offering the desktop widget (the floating posture dot) for Windows or Mac. */
export default function DesktopDownload({ compact = false }: { compact?: boolean }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [clicked, setClicked] = useState(false);
  const [have, setHave] = useState(false);
  useEffect(() => {
    setPlatform(desktopPlatform());
    try {
      setHave(localStorage.getItem(DESKTOP_KEY) === "1");
    } catch {}
  }, []);
  if (!platform) return null;
  const c = COPY[platform];

  const remember = () => {
    setHave(true);
    try {
      localStorage.setItem(DESKTOP_KEY, "1");
    } catch {}
  };

  const download = (
    <a
      className={`btn ${have ? "ghost" : "primary"}`}
      href={c.url}
      onClick={() => {
        setClicked(true);
        remember();
      }}
      rel="noopener"
    >
      ⬇️ {have ? "Download again" : `Download for ${c.name}`}
    </a>
  );
  // the computer asks "Open Upright?" the first time; nothing happens if it isn't installed
  const open = (
    <a className={`btn ${have ? "primary" : "ghost"}`} href={OPEN_DESKTOP_APP} onClick={remember}>
      🖥️ {have ? "Open Upright" : "Already installed? Open it"}
    </a>
  );
  const button = (
    <>
      {have ? open : download}
      {have ? download : open}
    </>
  );

  if (compact) return have ? open : download;

  return (
    <div className="card desktop-dl">
      <div className="desktop-dl-head">
        <span className="desktop-dl-dot" aria-hidden />
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>
            {have ? `Upright for ${c.name}` : "Get the desktop widget"}
          </h3>
          <p className="row-hint" style={{ margin: "4px 0 0" }}>
            A tiny see-through dot that floats over every app: faded green when you&apos;re sitting well, popping out red with what to fix when you
            slouch. No browser tab needed.
          </p>
        </div>
      </div>
      {clicked ? (
        <ol className="howto desktop-dl-steps">
          {c.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : (
        <div className="btn-row">{button}</div>
      )}
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        Free, {c.size}. Everything runs on your computer. Opening it also gives you the full app with exercises and gym workouts, and the dot pauses
        itself while you exercise.{" "}
        {clicked && (
          <a href={c.url} rel="noopener">
            Download didn&apos;t start? Try again
          </a>
        )}
      </p>
    </div>
  );
}
