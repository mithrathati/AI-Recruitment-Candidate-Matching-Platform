import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  function NeonButton(
    {
      variant = "primary",
      size = "md",
      className,
      children,
      leftIcon,
      rightIcon,
      loading,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "neon-btn",
          `neon-btn--${variant}`,
          size === "sm" && "neon-btn--sm",
          size === "lg" && "neon-btn--lg",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
