"use client";

export function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="row toggle-row">
      <span>
        <span className="row-label">{label}</span>
        {hint && <span className="row-hint">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={on} className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
        <i />
      </button>
    </label>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  format,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o)} type="button" className={`chip ${o === value ? "on" : ""}`} onClick={() => onChange(o)}>
          {format ? format(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

export function Card({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`card ${className ?? ""}`} style={style}>
      {children}
    </section>
  );
}

export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-veil" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function hourLabel(h: number) {
  if (h === 0 || h === 24) return "12 am";
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}
