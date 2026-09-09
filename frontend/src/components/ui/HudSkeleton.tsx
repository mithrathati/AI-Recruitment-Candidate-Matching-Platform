import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export interface SkeletonProps {
  lines?: number;
  className?: string;
  style?: CSSProperties;
}

export function HudSkeleton({
  lines = 1,
  className,
  style,
}: SkeletonProps): JSX.Element {
  return (
    <div className={cn("space-y-2", className)} style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="hud-skeleton h-3.5 w-full"
          style={{ width: `${100 - (i % 3) * 18}%` }}
        />
      ))}
    </div>
  );
}
