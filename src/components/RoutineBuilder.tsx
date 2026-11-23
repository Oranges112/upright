"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./ui";
import { AREAS, EXERCISES, fmtDuration, forYou, isStanding, routineSeconds } from "@/lib/exercises";
import { saveCustom, useDoc } from "@/lib/store";
import type { Area, Routine } from "@/lib/types";

const EMOJIS = ["⭐", "💪", "🌿", "🔥", "🧘", "☕", "🌙", "🎯"];
const GRADIENTS: [string, string][] = [
  ["#fcd34d", "#fb7185"],
  ["#5eead4", "#818cf8"],
  ["#86efac", "#22d3ee"],
  ["#f0abfc", "#a78bfa"],
];

/** Build (or edit) your own routine: pick moves, put them in order, name it. */
export default function RoutineBuilder({ edit, onClose }: { edit?: Routine; onClose: () => void }) {
  const doc = useDoc();
  const s = doc.settings;
  const [name, setName] = useState(edit?.name ?? "");
  const [emoji, setEmoji] = useState(edit?.emoji ?? "⭐");
  const [ids, setIds] = useState<string[]>(edit?.exercises ?? []);
  const [filter, setFilter] = useState<Area | "mine" | "all">(s.areas.length ? "mine" : "all");

  const list = useMemo(
    () =>
      Object.values(EXERCISES).filter((ex) => {
        if (s.seatedOnly && isStanding(ex.id)) return false;
        if (filter === "all") return true;
        if (filter === "mine") return forYou(ex.areas, s.areas);
        return ex.areas?.includes(filter);
      }),
    [filter, s.areas, s.seatedOnly],
  );

  const draft: Routine = {
    id: edit?.id ?? `my-${Date.now().toString(36)}`,
    name: name.trim() || "My routine",
    blurb: "Your own routine.",
    emoji,
    exercises: ids,
    gradient: edit?.gradient ?? GRADIENTS[(doc.custom.length ?? 0) % GRADIENTS.length],
    custom: true,
  };

  const move = (i: number, d: -1 | 1) =>
    setIds((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const n = [...xs];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <Sheet onClose={onClose}>
      <div className="builder">
        <h2>{edit ? "Edit your routine" : "Build your own routine"}</h2>
        <div className="builder-name">
          <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Icon">
            {EMOJIS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input placeholder="Name it (e.g. Morning reset)" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>

        <h3 className="ex-h">Your moves {ids.length > 0 && <small className="muted">· {fmtDuration(routineSeconds(draft, s.level))}</small>}</h3>
        {ids.length === 0 ? (
          <p className="muted small">Tap moves below to add them.</p>
        ) : (
          <ol className="builder-picked">
            {ids.map((id, i) => (
              <li key={id + i}>
                <span>{EXERCISES[id]?.name ?? id}</span>
                <span className="builder-btns">
                  <button className="icon-mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button className="icon-mini" onClick={() => move(i, 1)} disabled={i === ids.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button className="icon-mini" onClick={() => setIds((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove">
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}

        <h3 className="ex-h">Add moves</h3>
        <div className="chips">
          {(["mine", "all", ...AREAS.map((a) => a.id)] as (Area | "mine" | "all")[])
            .filter((f) => f !== "mine" || s.areas.length > 0)
            .map((f) => (
              <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
                {f === "mine" ? "My areas" : f === "all" ? "All" : AREAS.find((a) => a.id === f)!.name}
              </button>
            ))}
        </div>
        <div className="builder-list">
          {list.map((ex) => {
            const n = ids.filter((x) => x === ex.id).length;
            return (
              <button key={ex.id} className={`builder-item ${n ? "on" : ""}`} onClick={() => setIds((xs) => [...xs, ex.id])}>
                <b>{ex.name}</b>
                <small>{ex.targets}</small>
                <em>{n ? `✓${n > 1 ? ` ×${n}` : ""}` : "＋"}</em>
              </button>
            );
          })}
        </div>

        <div className="setup-actions">
          {edit ? (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (confirm(`Remove "${edit.name}"?`)) {
                  saveCustom({ ...edit, deleted: true });
                  onClose();
                }
              }}
            >
              Remove
            </button>
          ) : (
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            className="btn primary"
            disabled={ids.length === 0}
            onClick={() => {
              saveCustom(draft);
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
