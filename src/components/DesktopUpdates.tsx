"use client";

import { useEffect, useState } from "react";
import { appBridge, type UpdateInfo } from "@/lib/desktop";

/** Inside the desktop app: the version you have, and checking for / installing updates. */
export default function DesktopUpdates() {
  const [u, setU] = useState<UpdateInfo | null>(null);
  useEffect(() => {
    const b = appBridge();
    if (!b?.getUpdate) return;
    void b.getUpdate().then(setU);
    return b.onUpdate?.(setU);
  }, []);
  if (!u) return null;

  const b = appBridge()!;
  const text =
    u.state === "checking"
      ? "Checking for updates…"
      : u.state === "downloading"
        ? `Downloading version ${u.version ?? ""}… ${u.pct}%`
        : u.state === "ready"
          ? u.manual
            ? `Version ${u.version} is out. Download it and drag it into Applications to replace this one.`
            : `Version ${u.version} is ready to install.`
          : u.state === "none"
            ? "You have the newest version."
            : u.state === "error"
              ? "Couldn't check for updates. Check your internet and try again."
              : u.manual
                ? "Upright checks for new versions by itself. Posture checks and screens always update on their own."
                : "Updates download automatically in the background.";

  return (
    <div className="card">
      <h3 className="card-title">Upright for {u.platform === "mac" ? "Mac" : "Windows"}</h3>
      <p className="row-hint" style={{ marginTop: 0 }}>
        Version {u.current}. {text}
      </p>
      {u.state === "downloading" && (
        <div className="update-bar">
          <i style={{ width: `${u.pct}%` }} />
        </div>
      )}
      <div className="btn-row">
        {u.state === "ready" ? (
          <button className="btn primary" onClick={() => b.installUpdate?.()}>
            {u.manual ? "⬇ Download update" : "⬆ Restart & update"}
          </button>
        ) : (
          <button className="btn ghost" disabled={u.state === "checking" || u.state === "downloading"} onClick={() => b.checkUpdates?.()}>
            Check for updates
          </button>
        )}
      </div>
    </div>
  );
}
