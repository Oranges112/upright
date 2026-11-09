"use client";

import { useId } from "react";
import type { Pose, View } from "@/lib/types";
import MoveArrows from "./MoveArrows";

interface Props {
  view: View;
  pose: Pose;
  /** seconds for the transition into this pose */
  speed?: number;
  size?: number;
  className?: string;
  /** show arrows for which way to move (during the exercise itself) */
  hints?: boolean;
}

const t = (x: number | undefined) => x ?? 0;

/** Transform helper: CSS transforms on SVG groups with an explicit origin in viewBox units. */
function tf(transform: string, ox: number, oy: number): React.CSSProperties {
  return {
    transform,
    transformOrigin: `${ox}px ${oy}px`,
    transformBox: "view-box",
  };
}

export default function Figure({ view, pose, speed = 0.9, size, className, hints = false }: Props) {
  const style = { ["--move" as string]: `${speed}s` } as React.CSSProperties;
  return (
    <svg
      viewBox="0 0 240 280"
      className={`figure ${className ?? ""}`}
      style={{ ...style, width: size, height: size ? (size * 280) / 240 : undefined }}
      aria-hidden
    >
      <defs>
        <radialGradient id="fig-glow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="140" rx="118" ry="130" fill="url(#fig-glow)" />
      <g className="breathe">{view === "side" ? <Side pose={pose} /> : <Front pose={pose} />}</g>
      {hints && <MoveArrows view={view} pose={pose} />}
    </svg>
  );
}

function Side({ pose }: { pose: Pose }) {
  return (
    <g>
      {/* chair back */}
      <rect x="58" y="150" width="14" height="140" rx="7" fill="var(--fig-chair)" />
      {/* torso lean (pivot at hips) */}
      <g className="mv" style={tf(`rotate(${t(pose.tr)}deg)`, 110, 270)}>
        {/* neck + head (shifted down so the neck isn't giraffe-length) */}
        <g transform="translate(0 14)">
        {/* ghost of the neutral head position, so movements are easy to read */}
        <circle
          cx="124"
          cy="96"
          r="31"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          strokeDasharray="4 5"
          className="ghost"
          style={{ opacity: t(pose.hx) !== 0 || Math.abs(t(pose.hr)) > 8 ? 0.55 : 0 }}
        />
        <g className="mv" style={tf(`translate(${t(pose.hx) * 1.45}px, ${t(pose.hy)}px)`, 0, 0)}>
          <path d="M103 164 L106 120 L126 120 L124 164 Z" fill="var(--fig-skin-2)" />
          <g className="mv" style={tf(`rotate(${t(pose.hr)}deg)`, 116, 124)}>
            <ellipse cx="118" cy="104" rx="5" ry="7" fill="var(--fig-skin-2)" />
            <circle cx="124" cy="96" r="31" fill="var(--fig-skin)" />
            {/* jaw / chin */}
            <path d="M118 120 Q138 134 150 116 L152 104 Z" fill="var(--fig-skin)" />
            {/* nose */}
            <path d="M152 92 Q163 101 153 107 Z" fill="var(--fig-skin)" />
            {/* eye */}
            <ellipse cx="143" cy="92" rx="2.6" ry="3.2" fill="var(--fig-ink)" />
            <path d="M137 84 Q143 81 149 84" stroke="var(--fig-hair)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            {/* mouth */}
            <path d="M141 113 Q146 115 149 112" stroke="var(--fig-ink)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            {/* ear */}
            <ellipse cx="117" cy="99" rx="6" ry="8.5" fill="var(--fig-skin-2)" />
            {/* hair */}
            <path
              d="M93 104 C88 74 104 60 126 61 C146 62 157 74 154 86 C146 78 132 76 124 80 C118 84 114 92 110 104 C106 112 100 118 96 118 Z"
              fill="var(--fig-hair)"
            />
          </g>
        </g>
        </g>
        {/* shirt / torso */}
        <path d="M78 290 C74 236 76 196 88 176 C98 162 124 160 134 170 C144 182 146 230 142 290 Z" fill="var(--fig-shirt)" />
        <path d="M100 168 Q112 176 126 168" stroke="var(--fig-shirt-2)" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* shoulder + arm */}
        <g className="mv" style={tf(`translate(${t(pose.sx)}px, ${t(pose.sy)}px)`, 0, 0)}>
          <g className="mv" style={tf(`rotate(${-t(pose.arm)}deg)`, 110, 182)}>
            <rect x="100" y="176" width="20" height="78" rx="10" fill="var(--fig-shirt-2)" />
            <circle cx="110" cy="258" r="9" fill="var(--fig-skin)" />
          </g>
          <ellipse cx="110" cy="182" rx="15" ry="12" fill="var(--fig-shirt-2)" />
        </g>
      </g>
    </g>
  );
}

function Front({ pose }: { pose: Pose }) {
  const clip = useId().replace(/:/g, "");
  const fx = t(pose.fx);
  const fy = t(pose.fy);
  return (
    <g>
      {/* neck */}
      <rect x="106" y="140" width="28" height="48" rx="11" fill="var(--fig-skin-2)" />

      {/* shoulders / torso / arms (shrug moves everything below the neck) */}
      <g className="mv" style={tf(`translate(0px, ${t(pose.sy)}px)`, 0, 0)}>
        <path
          d="M58 300 C58 238 62 202 84 190 C98 183 108 178 120 178 C132 178 142 183 156 190 C178 202 182 238 182 300 Z"
          fill="var(--fig-shirt)"
        />
        <path d="M106 180 Q120 194 134 180" stroke="var(--fig-shirt-2)" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* left arm (screen left) */}
        <g className="mv" style={tf(`rotate(${t(pose.la) + 7}deg)`, 76, 194)}>
          <rect x="65" y="186" width="22" height="52" rx="11" fill="var(--fig-shirt-2)" />
          <g className="mv" style={tf(`rotate(${t(pose.le)}deg)`, 76, 234)}>
            <rect x="68" y="228" width="16" height="44" rx="8" fill="var(--fig-skin-2)" />
            <circle cx="76" cy="274" r="9" fill="var(--fig-skin)" />
          </g>
        </g>
        {/* right arm (screen right) */}
        <g className="mv" style={tf(`rotate(${-t(pose.ra) - 7}deg)`, 164, 194)}>
          <rect x="153" y="186" width="22" height="52" rx="11" fill="var(--fig-shirt-2)" />
          <g className="mv" style={tf(`rotate(${-t(pose.re)}deg)`, 164, 234)}>
            <rect x="156" y="228" width="16" height="44" rx="8" fill="var(--fig-skin-2)" />
            <circle cx="164" cy="274" r="9" fill="var(--fig-skin)" />
          </g>
        </g>
      </g>

      {/* head (tilts around the base of the neck) */}
      <g transform="translate(0 14)">
      <g className="mv" style={tf(`rotate(${t(pose.hr)}deg)`, 120, 162)}>
        <g className="mv" style={tf(`translate(${-fx * 0.45}px, 0px)`, 0, 0)}>
          <ellipse cx="86" cy="104" rx="6.5" ry="10" fill="var(--fig-skin-2)" />
          <ellipse cx="154" cy="104" rx="6.5" ry="10" fill="var(--fig-skin-2)" />
        </g>
        <defs>
          <clipPath id={clip}>
            <ellipse cx="120" cy="100" rx="34" ry="40" />
          </clipPath>
        </defs>
        <ellipse cx="120" cy="100" rx="34" ry="40" fill="var(--fig-skin)" />
        <g clipPath={`url(#${clip})`}>
          <g className="mv" style={tf(`translate(${fx}px, ${fy}px)`, 0, 0)}>
            <ellipse cx="107" cy="101" rx="3" ry="3.6" fill="var(--fig-ink)" />
            <ellipse cx="133" cy="101" rx="3" ry="3.6" fill="var(--fig-ink)" />
            <path d="M101 92 Q107 89 113 92" stroke="var(--fig-hair)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M127 92 Q133 89 139 92" stroke="var(--fig-hair)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M120 104 L117 114 Q120 116 123 114" stroke="var(--fig-skin-3)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M112 123 Q120 129 128 123" stroke="var(--fig-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="101" cy="114" r="5" fill="var(--fig-blush)" />
            <circle cx="139" cy="114" r="5" fill="var(--fig-blush)" />
          </g>
          {/* hair */}
          <g className="mv" style={tf(`translate(${fx * 0.25}px, 0px)`, 0, 0)}>
            <path d="M82 96 C80 62 100 54 120 54 C142 54 162 64 158 98 C152 82 140 74 120 76 C102 76 90 84 82 96 Z" fill="var(--fig-hair)" />
          </g>
        </g>
        {pose.hand && (
          <g className="hand-in" transform={pose.hand === "left" ? "" : "translate(240 0) scale(-1 1)"}>
            <path
              d="M80 70 C84 58 98 56 104 64 L106 70 C100 70 94 74 90 82 C86 84 80 80 80 70 Z"
              fill="var(--fig-skin)"
              stroke="var(--fig-skin-3)"
              strokeWidth="1.5"
            />
            <path d="M76 82 L60 112" stroke="var(--fig-skin-2)" strokeWidth="14" strokeLinecap="round" />
          </g>
        )}
      </g>
      </g>
    </g>
  );
}
