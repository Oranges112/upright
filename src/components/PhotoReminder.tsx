"use client";

import { useEffect, useState } from "react";
import type { Doc } from "@/lib/types";
import PhotoTest from "./PhotoTest";
import { Sheet } from "./ui";

const SNOOZE_KEY = "upright:photo-snooze";
const DAY = 86_400_000;
/** retake roughly monthly */
export const PHOTO_EVERY_DAYS = 28;
/** first photo: once you've been using the app a few days */
export const FIRST_AFTER_DAYS = 3;

/** Whether it's time to (re)take the posture photo. Pure, for tests. */
export function photoDue(doc: Doc, now: number, snoozeUntil = 0): { due: boolean; days?: number; last?: number } {
  if (now < snoozeUntil) return { due: false };
  const angles = doc.tests.filter((t) => t.type === "angle");
  const last = angles[angles.length - 1];
  if (last) {
    const days = Math.floor((now - last.at) / DAY);
    return { due: days >= PHOTO_EVERY_DAYS, days, last: last.value };
  }
  const first = doc.sessions[0]?.startedAt ?? doc.guard[0]?.updatedAt;
  return { due: !!first && now - first >= FIRST_AFTER_DAYS * DAY };
}

/** Today-screen card: "time for your monthly posture photo". */
export default function PhotoReminder({ doc }: { doc: Doc }) {
  const [snooze, setSnooze] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setSnooze(Number(localStorage.getItem(SNOOZE_KEY) ?? 0));
    } catch {
      setSnooze(0);
    }
  }, []);
  if (snooze == null) return null;

  const s = photoDue(doc, Date.now(), snooze);
  if (!s.due && !open) return null;

  const later = () => {
    const until = Date.now() + 7 * DAY;
    setSnooze(until);
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {}
  };

  return (
    <>
      {s.due && (
        <section className="card photo-reminder">
          <span className="guide-emoji sm">📸</span>
          <div>
            <b>{s.days != null ? "Time for your monthly posture photo" : "Take your first posture photo"}</b>
            <small>
              {s.days != null
                ? `It's been ${s.days} days${s.last != null ? ` (last time: ${s.last}°)` : ""}. Same spot, same clothes, and see how far you've come.`
                : "A side-on photo now gives you a 'before' to compare against. Takes a minute, stays on your phone."}
            </small>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={() => setOpen(true)}>
              Take photo
            </button>
            <button className="btn ghost" onClick={later}>
              Later
            </button>
          </div>
        </section>
      )}
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <PhotoTest onClose={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}
