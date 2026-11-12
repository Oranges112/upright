"use client";

import { useRef, useState } from "react";
import { addTest } from "@/lib/store";
import { angleVerdict, compressImage, headAngle, savePhoto, type PhotoRecord, type Pt } from "@/lib/photos";
import { bodyChecks, scanPhoto, type BodyPoints } from "@/lib/bodyscan";
import { sound } from "@/lib/sound";

/** Draws the ear/shoulder markers, plumb line and angle (plus hip, knee and ankle if found) on top of a photo. */
export function PhotoOverlay({ ear, shoulder, body }: { ear?: Pt | null; shoulder?: Pt | null; body?: PhotoRecord["body"] }) {
  const chain = [shoulder, body?.hip, body?.knee, body?.ankle].filter(Boolean) as Pt[];
  return (
    <svg className="photo-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
      {shoulder && <line x1={shoulder.x * 100} y1={0} x2={shoulder.x * 100} y2={100} className="plumb" vectorEffect="non-scaling-stroke" />}
      {chain.length > 1 && (
        <polyline points={chain.map((q) => `${q.x * 100},${q.y * 100}`).join(" ")} className="body-line" vectorEffect="non-scaling-stroke" />
      )}
      {ear && shoulder && <line x1={ear.x * 100} y1={ear.y * 100} x2={shoulder.x * 100} y2={shoulder.y * 100} className="ear-line" vectorEffect="non-scaling-stroke" />}
      {chain.slice(1).map((q, i) => (
        <circle key={i} cx={q.x * 100} cy={q.y * 100} r="1.3" className="dot body" vectorEffect="non-scaling-stroke" />
      ))}
      {ear && <circle cx={ear.x * 100} cy={ear.y * 100} r="1.6" className="dot ear" vectorEffect="non-scaling-stroke" />}
      {shoulder && <circle cx={shoulder.x * 100} cy={shoulder.y * 100} r="1.6" className="dot shoulder" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

type Scan = "idle" | "scanning" | "found" | "failed";

export default function PhotoTest({ onClose }: { onClose: () => void }) {
  const [img, setImg] = useState<{ dataUrl: string; w: number; h: number } | null>(null);
  const [ear, setEar] = useState<Pt | null>(null);
  const [shoulder, setShoulder] = useState<Pt | null>(null);
  const [body, setBody] = useState<BodyPoints | null>(null);
  const [scan, setScan] = useState<Scan>("idle");
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const angle = img && ear && shoulder ? headAngle(ear, shoulder, img.w, img.h) : null;
  const checks = img && ear && shoulder && body && !manual ? bodyChecks({ ...body, ear, shoulder }, img.w, img.h) : [];
  const extra = checks.filter((c) => c.id !== "head");

  async function pick(f: File) {
    const c = await compressImage(f, 1200);
    setImg(c);
    setEar(null);
    setShoulder(null);
    setBody(null);
    setManual(false);
    setScan("scanning");
    try {
      const pts = await scanPhoto(c.dataUrl);
      if (!pts) throw new Error("no person found");
      setBody(pts);
      setEar(pts.ear);
      setShoulder(pts.shoulder);
      setScan("found");
    } catch {
      setScan("failed");
      setManual(true);
    }
  }

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    if (!manual) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (!ear) setEar(p);
    else if (!shoulder) setShoulder(p);
  }

  async function save() {
    if (!img || !ear || !shoulder || angle == null) return;
    setBusy(true);
    const t = addTest("angle", angle);
    const extraPts = body && !manual ? { hip: body.hip, knee: body.knee, ankle: body.ankle, nose: body.nose } : undefined;
    await savePhoto({ testId: t.id, at: t.at, dataUrl: img.dataUrl, ear, shoulder, w: img.w, h: img.h, body: extraPts }).catch(() => {});
    sound.unlock();
    sound.complete();
    onClose();
  }

  const step =
    scan === "scanning"
      ? "Finding your ear, shoulder, hips and knees…"
      : manual
        ? !ear
          ? "1. Tap the middle of your ear"
          : !shoulder
            ? "2. Tap the top of your shoulder (the bony tip)"
            : "Looks good? Save it, or redo the taps."
        : "Found you. Check the dots look right, then save.";

  return (
    <div className="test-sheet">
      <p className="eyebrow">Posture photo</p>
      <h2>Side-profile photo</h2>

      {!img && (
        <>
          <ol className="howto">
            <li>
              Stand side-on to the camera in your <b>normal, relaxed</b> posture. Don&apos;t correct it, the point is to see the real you.
            </li>
            <li>
              Prop your phone at about waist height and use the timer (or ask someone), far enough back to get <b>head to feet</b>. Not a mirror
              selfie: holding the phone up twists your shoulder.
            </li>
            <li>Arms relaxed by your sides, ear visible (tie hair back), fitted top or none.</li>
          </ol>
          <p className="muted small">
            🔒 The photo is checked on this device and stays here. Only the head-angle number is synced. A head-and-shoulders photo works; a
            full-length one also checks your back, hips and knees.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />
          <button className="btn primary wide" onClick={() => fileRef.current?.click()}>
            📷 Take or choose photo
          </button>
        </>
      )}

      {img && (
        <>
          <p className="photo-step">{step}</p>
          {scan === "failed" && <p className="muted small">Couldn&apos;t find you automatically, so tap the points yourself.</p>}
          <div
            className={`photo-frame ${manual ? "" : "auto"} ${scan === "scanning" ? "scanning" : ""}`}
            onClick={tap}
            style={{ aspectRatio: `${img.w} / ${img.h}`, width: `min(100%, calc(60dvh * ${img.w / img.h}))` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="Side profile" />
            <PhotoOverlay ear={ear} shoulder={shoulder} body={manual ? undefined : body ?? undefined} />
          </div>

          {angle != null && (
            <div className={`angle-result tone-${angleVerdict(angle).tone}`}>
              <b>{angle}°</b>
              <span>{angleVerdict(angle).label}</span>
            </div>
          )}
          <p className="tiny muted">The head angle is how far your ear sits in front of your shoulder. Lower is better. Watch it drop month by month.</p>

          {!manual && scan === "found" && (
            <div className="body-checks">
              <b>Full-body check</b>
              {extra.length ? (
                extra.map((c) => (
                  <div key={c.id} className={`body-check tone-${c.tone}`}>
                    <i />
                    <span>
                      <b>{c.label}:</b> {c.verdict} <em>({Math.abs(c.deg)}°)</em>
                      {c.tip && <small>{c.tip}</small>}
                    </span>
                  </div>
                ))
              ) : (
                <p className="muted small">Only your head and shoulders are in the photo. Take a full-length one to also check your back, hips and knees.</p>
              )}
              {extra.length > 0 && <p className="tiny muted">A rough guide from one photo, not a medical assessment.</p>}
            </div>
          )}

          <div className="sheet-actions">
            <button
              className="btn ghost"
              disabled={scan === "scanning"}
              onClick={() => {
                setManual(true);
                setEar(null);
                setShoulder(null);
              }}
            >
              {manual ? "Redo taps" : "Adjust points"}
            </button>
            <button className="btn primary" disabled={angle == null || busy} onClick={save}>
              Save {angle != null ? `${angle}°` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
