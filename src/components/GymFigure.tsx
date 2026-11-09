"use client";

import { useEffect, useRef, useState } from "react";
import { FLOOR, LEN, joints, sample, type Anim, type FrontPose, type Joints, type Key, type Pt, type SidePose } from "@/lib/gymAnim";

/**
 * Full-body animated figure for gym exercises.
 * Runs its own requestAnimationFrame loop, but only while it's on screen and the tab is visible.
 */
export default function GymFigure({ anim, showLabel = false, className }: { anim: Anim; showLabel?: boolean; className?: string }) {
  const host = useRef<SVGSVGElement>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // no looping motion: show the working position
      const k = anim.keys as Key<object>[];
      setTime(k.slice(0, -1).reduce((a, x) => a + x.move + x.hold, 0) + k[k.length - 1].move + 0.01);
      return;
    }
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      setTime(acc);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(el);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [anim]);

  const s = sample(anim.keys as Key<object>[], time);
  return (
    <svg ref={host} viewBox="0 0 260 200" className={`gym-figure ${className ?? ""}`} aria-hidden>
      <defs>
        <radialGradient id="gym-glow" cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="130" cy="110" rx="128" ry="96" fill="url(#gym-glow)" />
      <line x1="6" y1={FLOOR + 1} x2="254" y2={FLOOR + 1} className="g-floor" />
      {anim.view === "side" ? <SideScene scene={anim.scene} J={joints(s.pose as SidePose)} /> : <FrontScene pose={s.pose as FrontPose} />}
      {showLabel && s.label && (
        <text x="10" y="16" className="g-label">
          {s.label}
        </text>
      )}
    </svg>
  );
}

/* ---------------- drawing helpers ---------------- */

const P = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

function Limb({ a, b, w, c }: { a: Pt; b: Pt; w: number; c: string }) {
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" />;
}

function Arm({ root, elbow, hand, far }: { root: Pt; elbow: Pt; hand: Pt; far?: boolean }) {
  return (
    <g className={far ? "g-far" : undefined}>
      <Limb a={root} b={elbow} w={11} c="var(--fig-shirt-2)" />
      <Limb a={elbow} b={hand} w={9} c={far ? "var(--fig-skin-2)" : "var(--fig-skin)"} />
      <circle cx={hand[0]} cy={hand[1]} r={5.2} fill={far ? "var(--fig-skin-2)" : "var(--fig-skin)"} />
    </g>
  );
}

function Leg({ hip, knee, ankle, toe, far }: { hip: Pt; knee: Pt; ankle: Pt; toe: Pt; far?: boolean }) {
  return (
    <g className={far ? "g-far" : undefined}>
      <Limb a={knee} b={ankle} w={10.5} c={far ? "var(--fig-skin-2)" : "var(--fig-skin)"} />
      <Limb a={ankle} b={toe} w={7} c="var(--fig-ink)" />
      <Limb a={hip} b={knee} w={15} c="var(--g-shorts)" />
    </g>
  );
}

/** Head drawn facing +x in local space, then rotated so "up" matches the neck direction. */
function Head({ c, phi }: { c: Pt; phi: number }) {
  const r = LEN.head;
  return (
    <g transform={`translate(${P(c)}) rotate(${180 - phi})`}>
      <circle r={r} fill="var(--fig-skin)" />
      <path d={`M${r - 1} 0 Q${r + 4} 3 ${r - 1} 5 Z`} fill="var(--fig-skin)" />
      <ellipse cx={6} cy={-2} rx={1.4} ry={1.8} fill="var(--fig-ink)" />
      <path d="M4 -6 Q7 -7.5 10 -6" stroke="var(--fig-hair)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M6 7 Q8.5 8 10 6.5" stroke="var(--fig-ink)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <ellipse cx={-3} cy={1} rx={3} ry={4.2} fill="var(--fig-skin-2)" />
      <path d={`M${-r} 2 C${-r - 1} -10 -6 ${-r - 2} 4 ${-r - 1} C10 ${-r} ${r} -9 ${r - 1} -5 C8 -8 2 -8 -2 -5 C-5 -2 -7 3 -9 6 Z`} fill="var(--fig-hair)" />
    </g>
  );
}

function Body({ J }: { J: Joints }) {
  return (
    <g className="g-body">
      <Leg hip={J.hip} knee={J.knee2} ankle={J.ankle2} toe={J.toe2} far />
      <Arm root={J.arm} elbow={J.elbow2} hand={J.hand2} far />
      {/* torso: lower back + upper back so it can round or arch */}
      <path d={`M${P(J.hip)} L${P(J.mid)} L${P(J.sho)}`} stroke="var(--fig-shirt)" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Limb a={J.hip} b={J.hip} w={24} c="var(--g-shorts)" />
      <Limb a={J.sho} b={[J.headC[0] * 0.5 + J.sho[0] * 0.5, J.headC[1] * 0.5 + J.sho[1] * 0.5]} w={10} c="var(--fig-skin-2)" />
      <Head c={J.headC} phi={J.headPhi} />
      <Leg hip={J.hip} knee={J.knee} ankle={J.ankle} toe={J.toe} />
      <Arm root={J.arm} elbow={J.elbow} hand={J.hand} />
    </g>
  );
}

function Dumbbell({ at, light }: { at: Pt; light?: boolean }) {
  const r = light ? 4.5 : 7;
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={r} fill="var(--g-metal)" />
      <circle cx={at[0]} cy={at[1]} r={r * 0.45} fill="var(--g-eq-2)" />
    </g>
  );
}

function Cable({ from, to }: { from: Pt; to: Pt }) {
  return <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} className="g-cable" />;
}

function Stack({ x, top }: { x: number; top: number }) {
  return (
    <g>
      <rect x={x} y={top} width={8} height={FLOOR - top} rx={3} fill="var(--g-eq)" />
      <rect x={x + 24} y={top} width={8} height={FLOOR - top} rx={3} fill="var(--g-eq)" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={x + 9} y={FLOOR - 12 - i * 9} width={14} height={7.5} rx={1.5} fill="var(--g-metal)" />
      ))}
    </g>
  );
}

function InclineBench() {
  return (
    <g>
      <line x1={118} y1={124} x2={118} y2={FLOOR} stroke="var(--g-eq)" strokeWidth={6} strokeLinecap="round" />
      <line x1={84} y1={FLOOR} x2={150} y2={FLOOR} stroke="var(--g-eq)" strokeWidth={6} strokeLinecap="round" />
      <line x1={80} y1={154} x2={142} y2={110} stroke="var(--g-pad)" strokeWidth={12} strokeLinecap="round" />
    </g>
  );
}

function Mat() {
  return <rect x={28} y={FLOOR - 3} width={210} height={4} rx={2} fill="var(--g-mat)" />;
}

function SideScene({ scene, J }: { scene: string; J: Joints }) {
  switch (scene) {
    case "row": {
      const pulley: Pt = [214, 104];
      return (
        <g>
          <Stack x={214} top={40} />
          <circle cx={pulley[0]} cy={pulley[1]} r={5} fill="var(--g-metal)" />
          <rect x={48} y={140} width={84} height={8} rx={4} fill="var(--g-pad)" />
          <line x1={90} y1={148} x2={90} y2={FLOOR} stroke="var(--g-eq)" strokeWidth={6} />
          <line x1={168} y1={130} x2={176} y2={170} stroke="var(--g-eq)" strokeWidth={6} strokeLinecap="round" />
          <Cable from={pulley} to={J.hand} />
          <Body J={J} />
          <circle cx={J.hand[0]} cy={J.hand[1]} r={4} fill="none" stroke="var(--g-metal)" strokeWidth={2.5} />
        </g>
      );
    }
    case "face-pull": {
      const pulley: Pt = [222, 24];
      return (
        <g>
          <Stack x={214} top={14} />
          <circle cx={pulley[0]} cy={pulley[1]} r={5} fill="var(--g-metal)" />
          <Cable from={pulley} to={[J.hand[0] + 8, J.hand[1] + 2]} />
          <Body J={J} />
          <line x1={J.hand[0]} y1={J.hand[1]} x2={J.hand[0] + 8} y2={J.hand[1] + 2} stroke="var(--g-rope)" strokeWidth={3.5} strokeLinecap="round" />
        </g>
      );
    }
    case "incline-db":
    case "incline-db-light": {
      const light = scene === "incline-db-light";
      return (
        <g>
          <Dumbbell at={J.hand2} light={light} />
          <InclineBench />
          <Body J={J} />
          <Dumbbell at={J.hand} light={light} />
        </g>
      );
    }
    case "pulldown": {
      const pulley: Pt = [100, 8];
      return (
        <g>
          <rect x={52} y={0} width={8} height={FLOOR} rx={3} fill="var(--g-eq)" />
          <line x1={56} y1={4} x2={104} y2={4} stroke="var(--g-eq)" strokeWidth={6} strokeLinecap="round" />
          <circle cx={pulley[0]} cy={pulley[1]} r={4.5} fill="var(--g-metal)" />
          <rect x={64} y={141} width={58} height={8} rx={4} fill="var(--g-pad)" />
          <line x1={92} y1={149} x2={92} y2={FLOOR} stroke="var(--g-eq)" strokeWidth={6} />
          <Cable from={pulley} to={J.hand} />
          <Body J={J} />
          <circle cx={J.knee[0] + 2} cy={J.knee[1] - 11} r={6} fill="var(--g-pad)" />
          <circle cx={J.hand[0]} cy={J.hand[1]} r={3.6} fill="var(--g-metal)" />
        </g>
      );
    }
    case "door":
      return (
        <g>
          <rect x={70} y={0} width={9} height={FLOOR} rx={2} fill="var(--g-eq)" />
          <Body J={J} />
        </g>
      );
    case "roller":
      return (
        <g>
          <Mat />
          <circle cx={132} cy={174} r={7.5} fill="var(--g-roller)" />
          <Body J={J} />
        </g>
      );
    case "kneel":
      return (
        <g>
          <Mat />
          <rect x={86} y={FLOOR - 6} width={24} height={6} rx={3} fill="var(--g-pad)" />
          <Body J={J} />
        </g>
      );
    case "mat":
    default:
      return (
        <g>
          <Mat />
          <Body J={J} />
        </g>
      );
  }
}

/* ---------------- front view ---------------- */

function FrontScene({ pose }: { pose: FrontPose }) {
  const cx = 130;
  const shY = 52;
  const f = pose.f ?? 1;
  const armL = (side: -1 | 1, abd: number, elbow: number) => {
    const root: Pt = [cx + side * 21, shY + 4];
    const a = (abd * Math.PI) / 180;
    const ua = 30 * f;
    const e: Pt = [root[0] + side * Math.sin(a) * ua, root[1] + Math.cos(a) * ua];
    const a2 = a + (elbow * Math.PI) / 180;
    const h: Pt = [e[0] + side * Math.sin(a2) * 28 * f, e[1] + Math.cos(a2) * 28 * f];
    return { root, e, h };
  };
  const L = armL(-1, pose.la, pose.le ?? 0);
  const R = armL(1, pose.ra, pose.re ?? 0);
  // hands look bigger when they're closer to you (arms pointing forward)
  const hr = 5.2 * (1.5 - 0.5 * f);
  const band = Math.max(0, 1 - f) * 6;
  return (
    <g className="g-body">
      {/* legs */}
      <Limb a={[cx - 10, 112]} b={[cx - 12, 176]} w={14} c="var(--g-shorts)" />
      <Limb a={[cx + 10, 112]} b={[cx + 12, 176]} w={14} c="var(--g-shorts)" />
      <Limb a={[cx - 12, 150]} b={[cx - 12, 176]} w={10.5} c="var(--fig-skin)" />
      <Limb a={[cx + 12, 150]} b={[cx + 12, 176]} w={10.5} c="var(--fig-skin)" />
      <Limb a={[cx - 12, 179]} b={[cx - 22, 179]} w={7} c="var(--fig-ink)" />
      <Limb a={[cx + 12, 179]} b={[cx + 22, 179]} w={7} c="var(--fig-ink)" />
      <rect x={cx - 18} y={100} width={36} height={22} rx={8} fill="var(--g-shorts)" />
      {/* torso */}
      <path d={`M${cx - 24} 56 Q${cx - 25} 48 ${cx - 14} 46 L${cx + 14} 46 Q${cx + 25} 48 ${cx + 24} 56 L${cx + 19} 108 L${cx - 19} 108 Z`} fill="var(--fig-shirt)" />
      <rect x={cx - 5} y={34} width={10} height={14} rx={4} fill="var(--fig-skin-2)" />
      {/* head */}
      <circle cx={cx} cy={22} r={15} fill="var(--fig-skin)" />
      <ellipse cx={cx - 15} cy={24} rx={2.6} ry={4} fill="var(--fig-skin-2)" />
      <ellipse cx={cx + 15} cy={24} rx={2.6} ry={4} fill="var(--fig-skin-2)" />
      <ellipse cx={cx - 5.5} cy={22} rx={1.5} ry={1.9} fill="var(--fig-ink)" />
      <ellipse cx={cx + 5.5} cy={22} rx={1.5} ry={1.9} fill="var(--fig-ink)" />
      <path d={`M${cx - 4} 30 Q${cx} 32.5 ${cx + 4} 30`} stroke="var(--fig-ink)" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <path d={`M${cx - 15} 20 C${cx - 16} 6 ${cx - 6} 4 ${cx} 4 C${cx + 8} 4 ${cx + 17} 8 ${cx + 15} 20 C${cx + 10} 12 ${cx - 9} 11 ${cx - 15} 20 Z`} fill="var(--fig-hair)" />
      {/* band between the hands */}
      <line x1={L.h[0]} y1={L.h[1]} x2={R.h[0]} y2={R.h[1]} stroke="var(--g-band)" strokeWidth={3 + band * 0.3} strokeLinecap="round" />
      {/* arms */}
      {[L, R].map((A, i) => (
        <g key={i}>
          <Limb a={A.root} b={A.e} w={11} c="var(--fig-shirt-2)" />
          <Limb a={A.e} b={A.h} w={9} c="var(--fig-skin)" />
          <circle cx={A.h[0]} cy={A.h[1]} r={hr} fill="var(--fig-skin)" />
        </g>
      ))}
    </g>
  );
}
