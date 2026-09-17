import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUserId(rawId?: string | null): string {
  if (!rawId) return "00000-0000-0000";
  if (/^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/.test(rawId)) {
    return rawId.toLowerCase();
  }
  const clean = rawId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (clean.length === 0) {
    return "00000-0000-0000";
  }
  let padded = clean;
  if (padded.length < 13) {
    padded = (padded + "0000000000000").slice(0, 13);
  }
  return `${padded.slice(0, 5)}-${padded.slice(5, 9)}-${padded.slice(9, 13)}`;
}

