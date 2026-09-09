import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface HudProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number;
  showLabel?: boolean;
}

export function HudProgress({
  value = 0,
  showLabel = false,
  className,
  ...rest
}: HudProgressProps): JSX.Element {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("hud-progress", className)} {...rest} aria-label={`progress ${pct}%`}>
      <div className="hud-progress__fill" style={{ width: `${pct}%` }} />
      {showLabel && (
        <div className="absolute right-0 top-[-1.2rem] text-xs font-bold tabular-nums text-c-cyan">
          {Math.round(pct)}%
        </div>
      )}
    </div>
  );
}
