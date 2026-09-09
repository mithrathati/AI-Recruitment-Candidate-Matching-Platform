import { cn } from "@/lib/utils";

export interface CategoryBarProps {
  label: string;
  weightLabel?: string;
  score: number;
  tone?: "cyan" | "magenta" | "violet" | "amber" | "green";
  compact?: boolean;
  className?: string;
}

export function CategoryBar({
  label,
  weightLabel,
  score,
  tone = "cyan",
  compact = false,
  className,
}: CategoryBarProps): JSX.Element {
  const barClass =
    tone === "cyan"
      ? "bg-gradient-to-r from-c-cyan/90 via-c-violet/80 to-c-magenta/80"
      : tone === "magenta"
        ? "bg-gradient-to-r from-c-magenta to-c-violet"
        : tone === "violet"
          ? "bg-gradient-to-r from-c-violet to-c-cyan"
          : tone === "amber"
            ? "bg-gradient-to-r from-c-amber to-c-magenta"
            : "bg-gradient-to-r from-c-green to-c-cyan";
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={compact ? "text-sm" : "text-sm font-semibold text-c-text-main"}>
            {label}
          </span>
          {weightLabel && (
            <span className="hud-chip hud-chip--violet !py-0 !px-2 !text-[0.65rem]">
              {weightLabel}
            </span>
          )}
        </div>
        <span className={compact ? "text-xs text-c-text-dim" : "text-sm font-bold text-c-cyan-2 tabular-nums"}>
          {pct.toFixed(0)}
          <span className="text-c-text-dim font-normal">/100</span>
        </span>
      </div>
      <div
        className={cn(
          "hud-progress",
          compact ? "!h-1.5" : "!h-2.5",
          "border-[rgba(138,43,226,0.25)]",
        )}
      >
        <div
          className={cn(
            "hud-progress__fill",
            "!bg-none",
            barClass,
            "shadow-[0_0_12px_rgba(0,240,255,0.35)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
