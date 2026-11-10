"use client";

import { useEffect, useState } from "react";
import { DESKTOP_KEY, OPEN_DESKTOP_APP, appBridge, desktopBridge } from "@/lib/desktop";

/** Always points at the newest installer published on GitHub. */
export const WINDOWS_INSTALLER = "https://github.com/Oranges112/upright/releases/latest/download/Upright-Setup.exe";

/** Only on a Windows computer, and not when we're already inside the desktop app. */
function useShow() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setShow(/Windows/i.test(ua) && !/Electron/i.test(ua) && !desktopBridge() && !appBridge());
  }, []);
  return show;
}

/** Card offering the Windows desktop widget (the floating posture dot). */
export default function DesktopDownload({ compact = false }: { compact?: boolean }) {
  const show = useShow();
  const [clicked, setClicked] = useState(false);
  const [have, setHave] = useState(false);
  useEffect(() => {
    try {
      setHave(localStorage.getItem(DESKTOP_KEY) === "1");
    } catch {}
  }, []);
  if (!show) return null;

  const remember = () => {
    setHave(true);
    try {
      localStorage.setItem(DESKTOP_KEY, "1");
    } catch {}
  };

  const download = (
    <a
      className={`btn ${have ? "ghost" : "primary"}`}
      href={WINDOWS_INSTALLER}
      onClick={() => {
        setClicked(true);
        remember();
      }}
      rel="noopener"
    >
      ⬇️ {have ? "Download again" : "Download for Windows"}
    </a>
  );
  // Windows asks "Open Upright?" the first time; nothing happens if it isn't installed
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
            {have ? "Upright for Windows" : "Get the desktop widget"}
          </h3>
          <p className="row-hint" style={{ margin: "4px 0 0" }}>
            A tiny see-through dot that floats over every app: faded green when you&apos;re sitting well, popping out red with what to fix when you
            slouch. No browser tab needed.
          </p>
        </div>
      </div>
      {clicked ? (
        <ol className="howto desktop-dl-steps">
          <li>
            Open <b>Upright-Setup.exe</b> from your downloads (bottom or top-right of your browser).
          </li>
          <li>
            If Windows says it&apos;s from an unknown publisher, click <b>More info → Run anyway</b>.
          </li>
          <li>It installs in a few seconds and the dot appears. Right-click it and choose Recalibrate while sitting tall.</li>
          <li>Turn Posture Guard off here first. Windows lets only one app use the camera.</li>
        </ol>
      ) : (
        <div className="btn-row">{button}</div>
      )}
      <p className="tiny muted" style={{ marginBottom: 0 }}>
        Free, ~120 MB, Windows 10/11. Everything runs on your computer. Opening it also gives you the full app with exercises and gym workouts, and the
        dot pauses itself while you exercise.{" "}
        {clicked && (
          <a href={WINDOWS_INSTALLER} rel="noopener">
            Download didn&apos;t start? Try again
          </a>
        )}
      </p>
    </div>
  );
}
