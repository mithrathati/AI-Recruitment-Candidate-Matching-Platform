import type { CSSProperties } from "react";
import { cn, scoreColor } from "@/lib/utils";

export interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ScoreRing({
  score,
  size = 180,
  strokeWidth = 14,
  showLabel = true,
  label: overrideLabel,
  className,
}: ScoreRingProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, score));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const gradientId = `sg-${Math.floor(Math.random() * 1e6)}`;
  const { from, to, label: defaultLabel } = scoreColor(clamped);
  const label = overrideLabel ?? defaultLabel;

  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
  };

  return (
    <div className={cn("score-ring relative inline-flex items-center justify-center", className)} style={wrapperStyle}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          className="track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-black tracking-tight">
            <span className="neon-text">{Math.round(clamped)}</span>
            <span className="text-c-text-dim text-xl">%</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.22em] text-c-text-dim">
            {label}
          </div>
        </div>
      )}
    </div>
  );
}
