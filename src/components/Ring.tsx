interface Props {
  progress: number; // 0..1
  size?: number;
  stroke?: number;
  colors?: [string, string];
  children?: React.ReactNode;
  track?: string;
  smooth?: boolean;
}

export default function Ring({ progress, size = 220, stroke = 12, colors = ["var(--accent)", "var(--accent-2)"], children, track, smooth }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = `rg-${colors.join("").replace(/[^a-z0-9]/gi, "")}`;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? "var(--track)"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: smooth ? "stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)" : undefined }}
        />
      </svg>
      <div className="ring-inner">{children}</div>
    </div>
  );
}
