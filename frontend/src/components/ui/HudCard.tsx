import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HudCardGlow = "cyan" | "magenta" | "violet" | "green" | "amber" | "none";

export interface HudCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  cornerBrackets?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  glow?: HudCardGlow;
  soft?: boolean;
}

export function HudCard({
  cornerBrackets = true,
  title,
  subtitle,
  actions,
  glow = "cyan",
  soft = false,
  className,
  children,
  ...rest
}: HudCardProps): JSX.Element {
  const glowClass =
    glow === "cyan"
      ? "[&]:before:shadow-[0_0_60px_-22px_rgba(0,240,255,0.7)]"
      : glow === "magenta"
        ? "[&]:before:shadow-[0_0_60px_-22px_rgba(255,0,170,0.7)]"
        : glow === "violet"
          ? "[&]:before:shadow-[0_0_60px_-22px_rgba(138,43,226,0.7)]"
          : glow === "green"
            ? "[&]:before:shadow-[0_0_60px_-22px_rgba(0,255,163,0.7)]"
            : glow === "amber"
              ? "[&]:before:shadow-[0_0_60px_-22px_rgba(255,176,0,0.65)]"
              : "";
  return (
    <div
      className={cn(
        "glass-panel relative overflow-hidden",
        soft && "glass-panel--soft",
        glow !== "none" &&
          "before:absolute before:inset-0 before:-z-10 before:pointer-events-none before:rounded-[inherit]",
        glowClass,
        cornerBrackets && "corner-brackets",
        className,
      )}
      {...rest}
    >
      {cornerBrackets && <span className="cb-tl" aria-hidden />}
      {cornerBrackets && <span className="cb-br" aria-hidden />}
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 border-b border-c-border-soft">
          <div>
            {typeof title === "string" ? (
              <h3 className="text-base font-bold tracking-wide text-c-text-main">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && (
              <div className="mt-1 text-[0.78rem] text-c-text-dim">{subtitle}</div>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={title || actions ? "p-5 pt-4" : "p-5"}>{children}</div>
    </div>
  );
}
