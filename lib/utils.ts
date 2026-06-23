import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("ar-MR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("ar-MR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateISO(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getPlayerTitle(player: {
  lichessTitle?: string | null;
  fideTitle?: string | null;
}): string | null {
  return player.fideTitle || player.lichessTitle || null;
}

export function getDisplayRating(player: {
  fideRating?: number | null;
  lichessRapid?: number | null;
  lichessBlitz?: number | null;
  lichessClassical?: number | null;
}): number | null {
  return (
    player.fideRating ||
    player.lichessRapid ||
    player.lichessBlitz ||
    player.lichessClassical ||
    null
  );
}

export function pluralize(
  count: number,
  singular: string,
  plural: string
): string {
  return count === 1 ? singular : plural;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function getResultColor(result: string | null): string {
  switch (result) {
    case "1-0":
    case "1":
      return "text-green-600";
    case "0-1":
    case "-1":
      return "text-red-600";
    case "1/2-1/2":
    case "0.5":
      return "text-gray-600";
    default:
      return "text-gray-400";
  }
}

export function getResultBadgeVariant(
  result: string | null
): "default" | "destructive" | "outline" | "secondary" {
  switch (result) {
    case "1-0":
    case "1":
      return "default";
    case "0-1":
    case "-1":
      return "destructive";
    case "1/2-1/2":
    case "0.5":
      return "secondary";
    default:
      return "outline";
  }
}
