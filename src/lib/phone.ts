"use client";

import { useEffect, useState } from "react";

/** A phone or small tablet (where "text neck" happens). */
export function isPhone() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 600);
}

/**
 * How much your head "weighs" on your neck when you bend it forward (Hansraj, 2014):
 * about 5 kg upright, 12 kg at 15°, 18 kg at 30°, 22 kg at 45°, 27 kg at 60°.
 */
export function neckKg(headDeg: number) {
  const pts: [number, number][] = [
    [0, 5],
    [15, 12],
    [30, 18],
    [45, 22],
    [60, 27],
  ];
  const d = Math.max(0, Math.min(60, headDeg));
  for (let i = 1; i < pts.length; i++) {
    if (d <= pts[i][0]) {
      const [a, ka] = pts[i - 1];
      const [b, kb] = pts[i];
      return Math.round(ka + ((d - a) / (b - a)) * (kb - ka));
    }
  }
  return 27;
}

/**
 * Roughly how far your head bends to look at the phone, from how upright the phone is held
 * (beta: 90° = straight up at eye level, 0° = flat on your lap). Most of the tilt is taken up by
 * your neck when you look down at it.
 */
export function headBendFromPhone(beta: number) {
  const b = Math.max(0, Math.min(90, beta));
  return Math.round((90 - b) * 0.7);
}

/** Needs a tap on iPhone (Apple asks before sharing motion sensors). */
export async function askMotion(): Promise<boolean> {
  const D = (typeof window !== "undefined" ? (window as any).DeviceOrientationEvent : undefined) as any;
  if (!D) return false;
  if (typeof D.requestPermission === "function") {
    try {
      return (await D.requestPermission()) === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

/** The phone's front-back tilt (beta), live; null until the sensor reports. */
export function usePhoneTilt(on = true) {
  const [beta, setBeta] = useState<number | null>(null);
  useEffect(() => {
    if (!on || typeof window === "undefined") return;
    let last = 0;
    const h = (e: DeviceOrientationEvent) => {
      if (e.beta == null) return;
      const now = performance.now();
      if (now - last < 200) return;
      last = now;
      setBeta(Math.round(Math.abs(e.beta)));
    };
    window.addEventListener("deviceorientation", h);
    return () => window.removeEventListener("deviceorientation", h);
  }, [on]);
  return beta;
}
