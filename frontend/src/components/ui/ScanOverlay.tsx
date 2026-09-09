import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function ScanOverlay({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none scanlines", className)}
      {...rest}
    />
  );
}
