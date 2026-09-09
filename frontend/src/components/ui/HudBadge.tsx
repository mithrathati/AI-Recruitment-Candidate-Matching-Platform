import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "match" | "missing" | "warn" | "violet" | "cyan" | "magenta" | "green" | "amber";

export interface HudBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
}

export function HudBadge({
  tone = "cyan",
  dot,
  icon,
  className,
  children,
  ...rest
}: HudBadgeProps): JSX.Element {
  const toneClass =
    tone === "match" || tone === "green"
      ? "hud-chip--match"
      : tone === "missing"
        ? "hud-chip--missing"
        : tone === "warn" || tone === "amber"
          ? "hud-chip--warn"
          : tone === "violet"
            ? "hud-chip--violet"
            : tone === "magenta"
              ? "hud-chip--magenta"
              : tone === "cyan"
                ? "hud-chip--cyan"
                : "hud-chip--neutral";
  return (
    <span className={cn("hud-chip", toneClass, className)} {...rest}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            (tone === "match" || tone === "green") && "bg-c-green shadow-[0_0_8px_rgba(0,255,163,0.7)]",
            tone === "missing" &&
              "bg-c-red shadow-[0_0_8px_rgba(255,56,96,0.7)]",
            (tone === "warn" || tone === "amber") &&
              "bg-c-amber shadow-[0_0_8px_rgba(255,176,0,0.7)]",
            tone === "violet" &&
              "bg-c-violet shadow-[0_0_8px_rgba(138,43,226,0.7)]",
            tone === "magenta" &&
              "bg-c-magenta shadow-[0_0_8px_rgba(255,0,170,0.7)]",
            tone === "neutral" && "bg-c-text-dim",
            tone === "cyan" &&
              "bg-c-cyan shadow-[0_0_8px_rgba(0,240,255,0.7)]",
          )}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
