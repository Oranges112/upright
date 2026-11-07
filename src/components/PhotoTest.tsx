"use client";

import { useRef, useState } from "react";
import { addTest } from "@/lib/store";
import { angleVerdict, compressImage, headAngle, savePhoto, type Pt } from "@/lib/photos";
import { sound } from "@/lib/sound";

/** Draws the ear/shoulder markers, plumb line and angle on top of a photo. */
export function PhotoOverlay({ ear, shoulder }: { ear?: Pt | null; shoulder?: Pt | null }) {
  return (
    <svg className="photo-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
      {shoulder && <line x1={shoulder.x * 100} y1={0} x2={shoulder.x * 100} y2={100} className="plumb" vectorEffect="non-scaling-stroke" />}
      {ear && shoulder && <line x1={ear.x * 100} y1={ear.y * 100} x2={shoulder.x * 100} y2={shoulder.y * 100} className="ear-line" vectorEffect="non-scaling-stroke" />}
      {ear && <circle cx={ear.x * 100} cy={ear.y * 100} r="1.6" className="dot ear" vectorEffect="non-scaling-stroke" />}
      {shoulder && <circle cx={shoulder.x * 100} cy={shoulder.y * 100} r="1.6" className="dot shoulder" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export default function PhotoTest({ onClose }: { onClose: () => void }) {
  const [img, setImg] = useState<{ dataUrl: string; w: number; h: number } | null>(null);
  const [ear, setEar] = useState<Pt | null>(null);
  const [shoulder, setShoulder] = useState<Pt | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const angle = img && ear && shoulder ? headAngle(ear, shoulder, img.w, img.h) : null;

  function tap(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (!ear) setEar(p);
    else if (!shoulder) setShoulder(p);
  }

  async function save() {
    if (!img || !ear || !shoulder || angle == null) return;
    setBusy(true);
    const t = addTest("angle", angle);
    await savePhoto({ testId: t.id, at: t.at, dataUrl: img.dataUrl, ear, shoulder, w: img.w, h: img.h }).catch(() => {});
    sound.unlock();
    sound.complete();
    onClose();
  }

  return (
    <div className="test-sheet">
      <p className="eyebrow">Forward head posture</p>
      <h2>Side-profile photo</h2>

      {!img && (
        <>
          <ol className="howto">
            <li>Stand side-on to the camera in your <b>normal, relaxed</b> posture. Don&apos;t correct it, the point is to see the real you.</li>
            <li>Ask someone to take the photo at shoulder height, or prop your phone up and use the timer.</li>
            <li>Make sure your ear and shoulder are visible (tie hair back, wear a fitted top).</li>
          </ol>
          <p className="muted small">🔒 The photo stays on this device. Only the angle number is synced.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImg(await compressImage(f));
            }}
          />
          <button className="btn primary wide" onClick={() => fileRef.current?.click()}>
            📷 Take or choose photo
          </button>
        </>
      )}

      {img && (
        <>
          <p className="photo-step">
            {!ear ? "1. Tap the middle of your ear" : !shoulder ? "2. Tap the top of your shoulder (the bony tip)" : "Looks good? Save it, or redo the taps."}
          </p>
          <div className="photo-frame" onClick={tap} style={{ aspectRatio: `${img.w} / ${img.h}`, width: `min(100%, calc(60dvh * ${img.w / img.h}))` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="Side profile" />
            <PhotoOverlay ear={ear} shoulder={shoulder} />
          </div>
          {angle != null && (
            <div className={`angle-result tone-${angleVerdict(angle).tone}`}>
              <b>{angle}°</b>
              <span>{angleVerdict(angle).label}</span>
            </div>
          )}
          <p className="tiny muted">The angle measures how far your ear sits in front of your shoulder. Lower is better. Watch it drop month by month.</p>
          <div className="sheet-actions">
            <button
              className="btn ghost"
              onClick={() => {
                setEar(null);
                setShoulder(null);
              }}
            >
              Redo taps
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
