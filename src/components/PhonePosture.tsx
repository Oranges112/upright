"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./ui";
import { askMotion, headBendFromPhone, isPhone, neckKg, usePhoneTilt } from "@/lib/phone";
import { getMeta, setMeta, useMeta } from "@/lib/store";

/** The trainer: hold your phone and watch what it does to your neck. */
export function PhoneTrainer({ onClose }: { onClose: () => void }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const beta = usePhoneTilt(allowed === true);
  useEffect(() => {
    // Android doesn't ask; iPhone needs a tap (the button below)
    const D = (window as any).DeviceOrientationEvent;
    if (D && typeof D.requestPermission !== "function") setAllowed(true);
  }, []);
  const bend = beta == null ? null : headBendFromPhone(beta);
  const kg = bend == null ? null : neckKg(bend);
  const good = bend != null && bend <= 15;

  return (
    <Sheet onClose={onClose}>
      <div className="phone-trainer">
        <h2>📱 Phone posture</h2>
        <p className="muted small">Hold your phone the way you usually do. Then lift it toward eye level and watch the weight on your neck drop.</p>
        {allowed !== true ? (
          <button className="btn primary wide" onClick={async () => setAllowed(await askMotion())}>
            Start (uses your phone&apos;s motion sensor)
          </button>
        ) : beta == null ? (
          <p className="row-hint">Waiting for the motion sensor… (this only works on a phone or tablet)</p>
        ) : (
          <div className={`phone-gauge ${good ? "good" : bend! > 30 ? "bad" : "warn"}`}>
            <svg viewBox="0 0 120 120" aria-hidden>
              <circle cx="60" cy="40" r="16" className="pg-head" style={{ transform: `rotate(${bend}deg)`, transformOrigin: "60px 80px" }} />
              <line x1="60" y1="80" x2="60" y2="112" className="pg-body" />
              <line x1="60" y1="80" x2={60 + Math.sin((bend! * Math.PI) / 180) * 24} y2={80 - Math.cos((bend! * Math.PI) / 180) * 24} className="pg-neck" />
            </svg>
            <div>
              <b>{kg} kg</b>
              <span>on your neck (head bent about {bend}°)</span>
              <small>{good ? "Great: that's about as light as it gets." : "Lift the phone a little and tuck your chin: it gets lighter fast."}</small>
            </div>
          </div>
        )}
        <ul className="phone-tips">
          <li>Bring the phone up to your eyes, rather than your eyes down to the phone.</li>
          <li>Rest your elbow on your other hand, or on a table, so lifting isn&apos;t tiring.</li>
          <li>Long reads and videos: prop it up at eye level.</li>
        </ul>
        <button className="btn primary wide" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  );
}

/** Today card on phones. */
export function PhoneCard() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(isPhone()), []);
  if (!phone) return null;
  return (
    <>
      <button className="learn-link card" onClick={() => setOpen(true)}>
        <span className="guide-emoji sm">📱</span>
        <span>
          <b>How heavy is your phone habit?</b>
          <small>See how much weight your neck carries the way you hold your phone.</small>
        </span>
        <em>›</em>
      </button>
      {open && <PhoneTrainer onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * While Upright is open on a phone: if it's held low for a while, a gentle "lift your phone"
 * (Settings → Phone posture). Phones only let websites read the motion sensor while they're open.
 */
export function PhoneNudge() {
  const meta = useMeta();
  const on = meta.phoneNudge !== false;
  const [phone, setPhone] = useState(false);
  useEffect(() => setPhone(isPhone()), []);
  const beta = usePhoneTilt(on && phone);
  const lowSince = useRef<number | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (beta == null || document.hidden) return;
    const low = headBendFromPhone(beta) > 30;
    if (!low) {
      lowSince.current = null;
      setShow(false);
      return;
    }
    if (lowSince.current == null) lowSince.current = Date.now();
    const last = getMeta().lastPhoneNudgeAt ?? 0;
    if (Date.now() - lowSince.current > 60_000 && Date.now() - last > 10 * 60_000) {
      setShow(true);
      setMeta({ lastPhoneNudgeAt: Date.now() });
    }
  }, [beta]);
  if (!show) return null;
  return (
    <div className="phone-nudge" role="status" onClick={() => setShow(false)}>
      📱 Lift your phone up a little and tuck your chin. Your neck will thank you.
    </div>
  );
}
