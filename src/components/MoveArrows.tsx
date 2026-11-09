"use client";

import { useId } from "react";
import type { Pose, View } from "@/lib/types";

const t = (x: number | undefined) => x ?? 0;

/**
 * Glowing arrows that show which way to move for the current step, worked out from the pose:
 * glide back, look up / down, tilt, turn, shrug, squeeze back, lean back, raise the arms.
 * Coordinates are in the figure's 240 × 280 space.
 */
export default function MoveArrows({ view, pose }: { view: View; pose: Pose }) {
  const id = useId().replace(/:/g, "");
  const arrows: string[] = [];

  if (view === "side") {
    const hx = t(pose.hx);
    const hr = t(pose.hr);
    if (hx < -3) arrows.push("M184 126 L160 126"); // chin glides straight back
    if (hr < -8) arrows.push("M176 100 Q186 76 168 58"); // look up
    if (hr > 8) arrows.push("M176 104 Q188 128 172 146"); // look down
    if (t(pose.sx) < -4) arrows.push("M136 168 L106 168"); // shoulders back
    if (t(pose.sy) < -4) arrows.push("M134 196 L134 172"); // shrug up
    if (t(pose.tr) < -6) arrows.push("M66 150 Q54 132 62 112"); // lean back over the chair
    if (t(pose.arm) < -20) arrows.push("M96 262 L70 262"); // hands reach back
  } else {
    const hr = t(pose.hr);
    const fx = t(pose.fx);
    if (Math.abs(hr) > 8) {
      // curved arrow on the side the head tilts toward
      arrows.push(hr > 0 ? "M168 74 Q186 98 176 126" : "M72 74 Q54 98 64 126");
    } else if (Math.abs(fx) > 6) {
      arrows.push(fx > 0 ? "M106 176 L138 176" : "M134 176 L102 176"); // turn
    }
    if (t(pose.fy) > 8 && Math.abs(hr) <= 8) arrows.push("M182 92 L182 122"); // look down
    if (t(pose.sy) < -4) arrows.push("M64 214 L64 188", "M176 214 L176 188"); // shrug
    if (t(pose.la) > 110) arrows.push("M40 150 L40 104", "M200 150 L200 104"); // reach up (W → Y)
  }

  if (!arrows.length) return null;
  return (
    <g className="move-arrows" key={arrows.join("|")}>
      <defs>
        <marker id={`ah-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>
      {arrows.map((d) => (
        <path key={d} d={d} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" markerEnd={`url(#ah-${id})`} />
      ))}
    </g>
  );
}
