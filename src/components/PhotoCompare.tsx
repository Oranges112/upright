"use client";

import { useEffect, useRef, useState } from "react";
import { allPhotos, type PhotoRecord } from "@/lib/photos";
import type { Doc } from "@/lib/types";

/** Container is 3:4. Units: width 100, height 133.33. Both photos are lined up on the shoulder. */
const CH = 133.33;
const SHOULDER = { x: 50, y: 58 };
/** ear-to-shoulder distance after scaling, so both photos are the same size */
const EAR_TO_SHOULDER = 20;

function facing(r: PhotoRecord) {
  const nose = r.body?.nose;
  const d = nose ? nose.x - r.ear.x : r.ear.x - r.shoulder.x;
  return d >= 0 ? 1 : -1;
}

/** Position an image so its shoulder sits at SHOULDER and every photo is the same scale. */
function place(r: PhotoRecord, flip: boolean) {
  const ex = (flip ? 1 - r.ear.x : r.ear.x) * r.w;
  const sx = (flip ? 1 - r.shoulder.x : r.shoulder.x) * r.w;
  const d = Math.max(1, Math.hypot(ex - sx, (r.ear.y - r.shoulder.y) * r.h));
  const k = EAR_TO_SHOULDER / d;
  return {
    left: `${SHOULDER.x - sx * k}%`,
    top: `${((SHOULDER.y - r.shoulder.y * r.h * k) / CH) * 100}%`,
    width: `${r.w * k}%`,
    transform: flip ? "scaleX(-1)" : undefined,
  } as React.CSSProperties;
}

const fmtDate = (at: number) => new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Before/after slider for the side-profile photos (stored only on this device). */
export default function PhotoCompare({ doc }: { doc: Doc }) {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [pos, setPos] = useState(70);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const angleCount = doc.tests.filter((t) => t.type === "angle").length;
  useEffect(() => {
    void allPhotos().then((ps) => {
      setPhotos(ps);
      setA(0);
      setB(Math.max(0, ps.length - 1));
    });
  }, [angleCount]);

  if (photos.length < 2) return null;
  const before = photos[Math.min(a, photos.length - 1)];
  const after = photos[Math.min(b, photos.length - 1)];
  // show both facing the same way as the first photo
  const dir = facing(before);
  const angleOf = (r: PhotoRecord) => doc.tests.find((t) => t.id === r.testId)?.value;
  const aDeg = angleOf(before);
  const bDeg = angleOf(after);

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <section className="card compare">
      <h3 className="card-title">Before &amp; after</h3>
      <div className="compare-pick">
        <label>
          Before
          <select value={a} onChange={(e) => setA(Number(e.target.value))}>
            {photos.map((p, i) => (
              <option key={p.testId} value={i}>
                {fmtDate(p.at)}
                {angleOf(p) != null ? ` · ${angleOf(p)}°` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          After
          <select value={b} onChange={(e) => setB(Number(e.target.value))}>
            {photos.map((p, i) => (
              <option key={p.testId} value={i}>
                {fmtDate(p.at)}
                {angleOf(p) != null ? ` · ${angleOf(p)}°` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        ref={box}
        className="compare-box"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after.dataUrl} alt="After" style={place(after, facing(after) !== dir)} draggable={false} />
        <div className="compare-top" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before.dataUrl} alt="Before" style={place(before, false)} draggable={false} />
        </div>
        <i className="compare-plumb" style={{ left: `${SHOULDER.x}%` }} />
        <i className="compare-handle" style={{ left: `${pos}%` }}>
          <b>‹ ›</b>
        </i>
        <span className="compare-tag left">
          Before{aDeg != null ? ` · ${aDeg}°` : ""}
        </span>
        <span className="compare-tag right">
          After{bDeg != null ? ` · ${bDeg}°` : ""}
        </span>
      </div>
      <input
        className="compare-range"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Slide between before and after"
      />
      <p className="tiny muted">
        Both photos are lined up on your shoulder and scaled to match. The dashed line runs straight up from your shoulder: the closer your ear is
        to it, the better.
        {aDeg != null && bDeg != null && aDeg !== bDeg && (
          <b className={bDeg < aDeg ? "up" : "down"}>
            {" "}
            {bDeg < aDeg ? `Your head is ${aDeg - bDeg}° further back. 🎉` : `${bDeg - aDeg}° more forward than before.`}
          </b>
        )}
      </p>
    </section>
  );
}
