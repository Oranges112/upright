"use client";

import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { Card } from "./ui";
import { BASE } from "@/lib/base";
import LinkGuide from "./LinkGuide";
import { cleanCode, linkDevice, prettyCode, syncNow, type Meta, type ServerConfig } from "@/lib/store";

/** The public web address of this copy of Upright (what a phone should open). */
function siteUrl() {
  if (typeof window === "undefined") return "";
  // the desktop app loads the website, so this is the website's address there too
  return `${location.origin}${BASE}/`;
}

function Qr({ text, label }: { text: string; label: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  return <div className="qr" role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}

/**
 * Phone ↔ computer, as simply as possible: scan a QR code with your phone's camera.
 * With a sync server, that links the two (no accounts, no files): streaks, sessions and
 * settings merge automatically. Without one, the QR just opens Upright on your phone.
 */
export default function PhoneLink({ meta, config, flash }: { meta: Meta; config: ServerConfig | null; flash: (m: string) => void }) {
  const [input, setInput] = useState("");
  const [showCode, setShowCode] = useState(false);
  const sync = !!config?.sync;

  // make sure there's a code to share
  useEffect(() => {
    if (sync && !meta.code) void syncNow();
  }, [sync, meta.code]);

  const [guide, setGuide] = useState(false);
  // a copy connected to its own server tells the phone where it is, too
  const link = meta.code ? `${siteUrl()}#link=${meta.code}${meta.apiUrl ? `&server=${encodeURIComponent(meta.apiUrl)}` : ""}` : "";

  return (
    <Card>
      <h3 className="card-title">📱 Phone & computer</h3>
      {sync ? (
        <>
          <div className="link-qr">
            {link ? <Qr text={link} label="QR code that links your phone" /> : <div className="qr placeholder">Setting up…</div>}
            <div>
              <b>Scan with your phone&apos;s camera</b>
              <p className="muted small">
                It opens Upright on your phone and links the two. Your streaks, sessions and settings then stay in step on both, automatically. No account, no password.
              </p>
              <p className="row-hint">Photos stay on the device that took them.</p>
            </div>
          </div>
          {meta.syncError ? (
            <p className="row-hint warn">Sync problem: {meta.syncError}</p>
          ) : meta.lastSyncAt ? (
            <p className="row-hint">✅ In sync · last {new Date(meta.lastSyncAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          ) : null}
          <div className="btn-row">
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
              Share the link instead
            </button>
            <button className="btn ghost" onClick={() => setShowCode((x) => !x)}>
              {showCode ? "Hide code" : "Type a code instead"}
            </button>
          </div>
          {showCode && (
            <>
              <p className="row-hint">
                This device&apos;s code: <code>{prettyCode(meta.code) || "…"}</code>. Keep it private: anyone with it can see your progress.
              </p>
              <div className="link-row">
                <input placeholder="Code from your other device" value={input} onChange={(e) => setInput(e.target.value)} />
                <button
                  className="btn primary"
                  onClick={async () => {
                    const c = cleanCode(input);
                    if (!c) return flash("That code doesn't look right (16 letters and numbers).");
                    await linkDevice(c);
                    setInput("");
                    flash("Linked! Everything is merged and in sync.");
                  }}
                >
                  Link
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="link-qr">
            <Qr text={siteUrl()} label="QR code that opens Upright on your phone" />
            <div>
              <b>Get Upright on your phone</b>
              <p className="muted small">Scan with your phone&apos;s camera to open it, then add it to your home screen. Great for gym workouts and reminders on the go.</p>
              <p className="row-hint">
                Linking phone and computer (so progress is shared) isn&apos;t switched on for this copy yet. Until then, use <b>Export backup</b> / <b>Import backup</b> below to move
                your progress.
              </p>
              <button className="btn ghost" onClick={() => setGuide(true)}>
                🔗 Set up linking (free, about 10 min)
              </button>
            </div>
          </div>
        </>
      )}
      {guide && <LinkGuide onClose={() => setGuide(false)} />}
    </Card>
  );
}
