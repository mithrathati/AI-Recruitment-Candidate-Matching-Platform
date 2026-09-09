import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v > 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function scoreColor(score: number): { from: string; to: string; label: string } {
  if (score >= 85) return { from: "#00ffa3", to: "#00f0ff", label: "Excellent match" };
  if (score >= 70) return { from: "#00f0ff", to: "#8a2be2", label: "Strong match" };
  if (score >= 55) return { from: "#8a2be2", to: "#ffb000", label: "Moderate" };
  if (score >= 40) return { from: "#ffb000", to: "#ff00aa", label: "Weak" };
  return { from: "#ff3860", to: "#ff00aa", label: "Poor match" };
}

export function classNamesToArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(Boolean) as string[];
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
