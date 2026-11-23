"use client";

import { useState } from "react";
import { Sheet } from "./ui";
import { apiBase, STATIC } from "@/lib/base";
import { setMeta } from "@/lib/store";

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Make the notification keys (VAPID) right here, so no one needs a terminal. */
async function makeKeys() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("raw", kp.publicKey);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const secret = new Uint8Array(24);
  crypto.getRandomValues(secret);
  return { pub: b64url(pub), priv: jwk.d!, cron: b64url(secret.buffer) };
}

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="copy-row">
      <code>{value}</code>
      <button
        className="btn ghost small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          } catch {}
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

/**
 * Step-by-step, inside the app: put your own free copy of Upright online so your phone and
 * computer can share progress (and get reminders when the app is closed). About 10 minutes.
 */
export default function LinkGuide({ onClose }: { onClose: () => void }) {
  // kept on this device until you're done, so closing the guide doesn't lose them
  const [keys, setKeysState] = useState<{ pub: string; priv: string; cron: string } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("upright:link-keys") || "null");
    } catch {
      return null;
    }
  });
  const setKeys = (k: { pub: string; priv: string; cron: string }) => {
    setKeysState(k);
    try {
      localStorage.setItem("upright:link-keys", JSON.stringify(k));
    } catch {}
  };
  const [server, setServer] = useState(apiBase());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = server.trim().replace(/\/+$/, "");
  const url = /^https?:\/\//.test(clean) ? clean : clean ? `https://${clean}` : "";

  async function connect() {
    if (!url) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await fetch(`${url}/api/config`, { cache: "no-store" });
      const c = r.ok ? await r.json() : null;
      if (!c) throw new Error();
      if (!c.sync) {
        setStatus("Found your server, but storage isn't connected yet (step 3).");
        return;
      }
      setMeta({ apiUrl: url });
      setStatus("Connected ✅ Reloading…");
      setTimeout(() => location.reload(), 900);
    } catch {
      setStatus("Couldn't reach that address. Check it and that the deploy finished.");
    } finally {
      setBusy(false);
    }
  }

  async function startReminders() {
    if (!url || !keys) return;
    setBusy(true);
    try {
      const r = await fetch(`${url}/api/setup-schedule`, { method: "POST", headers: { authorization: `Bearer ${keys.cron}` } });
      const j = await r.json().catch(() => ({}));
      setStatus(r.ok ? "Background reminders are on ✅" : `Not yet: ${j.error ?? r.status}`);
    } catch {
      setStatus("Couldn't reach your server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="guide-sheet">
        <h2>Link your phone and computer</h2>
        <p className="muted">
          Put your own free copy of Upright online. Then your phone and computer share progress, and reminders arrive even when the app is closed. About 10 minutes, once. Everything is free and stays yours.
        </p>

        <ol className="guide-steps">
          <li>
            <b>Make free accounts</b>
            <span>
              At <b>github.com</b> and <b>vercel.com</b> (on Vercel, choose &ldquo;Continue with GitHub&rdquo;).
            </span>
          </li>
          <li>
            <b>Copy Upright and put it online</b>
            <span>
              On GitHub, open <b>Oranges112/upright</b> and click <b>Fork</b>. Then on Vercel: <b>Add New → Project</b> → pick your copy → <b>Deploy</b>.
            </span>
          </li>
          <li>
            <b>Add free storage</b>
            <span>
              In your Vercel project: <b>Storage → Create Database → Upstash for Redis</b> → free plan → connect it. Do the same for <b>Upstash QStash</b> (it sends
              reminders when the app is closed).
            </span>
          </li>
          <li>
            <b>Add your keys</b>
            <span>
              Vercel project → <b>Settings → Environment Variables</b>. Add these four, then <b>Deployments → ⋯ → Redeploy</b>.
            </span>
            {keys ? (
              <div className="guide-keys">
                <small>VAPID_PUBLIC_KEY</small>
                <Copy value={keys.pub} />
                <small>VAPID_PRIVATE_KEY</small>
                <Copy value={keys.priv} />
                <small>CRON_SECRET</small>
                <Copy value={keys.cron} />
                <small>VAPID_SUBJECT</small>
                <Copy value="mailto:you@example.com" />
                <span className="row-hint">Keep the private key and secret to yourself. You can replace the email with yours.</span>
              </div>
            ) : (
              <button className="btn ghost" onClick={async () => setKeys(await makeKeys())}>
                🔑 Make my keys
              </button>
            )}
          </li>
          <li>
            <b>Connect this app to it</b>
            <span>Paste your Vercel address (it looks like your-name-upright.vercel.app).</span>
            <div className="link-row">
              <input placeholder="your-app.vercel.app" value={server} onChange={(e) => setServer(e.target.value)} />
              <button className="btn primary" disabled={!url || busy} onClick={connect}>
                Connect
              </button>
            </div>
            {keys && url && (
              <button className="btn ghost" disabled={busy} onClick={startReminders}>
                ⏰ Turn on reminders when the app is closed
              </button>
            )}
          </li>
          <li>
            <b>Link your phone</b>
            <span>Back in Settings, scan the QR code with your phone&apos;s camera. That&apos;s it: the phone connects to the same place automatically.</span>
          </li>
        </ol>
        {status && <p className="row-hint">{status}</p>}
        {!STATIC && <p className="row-hint">This copy already has its own server.</p>}
        <button className="btn primary wide" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
