"use client";

import { useEffect, useState } from "react";
import { desktopBridge } from "@/lib/desktop";

/** Always points at the newest installer published on GitHub. */
export const WINDOWS_INSTALLER = "https://github.com/Oranges112/upright/releases/latest/download/Upright-Setup.exe";

/** Only on a Windows computer, and not when we're already inside the desktop app. */
function useShow() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    setShow(/Windows/i.test(ua) && !/Electron/i.test(ua) && !desktopBridge());
  }, []);
  return show;
}

/** Card offering the Windows desktop widget (the floating posture dot). */
export default function DesktopDownload({ compact = false }: { compact?: boolean }) {
  const show = useShow();
  const [clicked, setClicked] = useState(false);
  if (!show) return null;

  const button = (
    <a className="btn primary" href={WINDOWS_INSTALLER} onClick={() => setClicked(true)} rel="noopener">
      ⬇️ Download for Windows
    </a>
  );

  if (compact) return button;

  return (
    <div className="card desktop-dl">
      <div className="desktop-dl-head">
        <span className="desktop-dl-dot" aria-hidden />
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>
            Get the desktop widget
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
        Free, ~120 MB, Windows 10/11. Everything runs on your computer.{" "}
        {clicked && (
          <a href={WINDOWS_INSTALLER} rel="noopener">
            Download didn&apos;t start? Try again
          </a>
        )}
      </p>
    </div>
  );
}
