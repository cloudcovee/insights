import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats any raw UUID or identifier into a standardized 15-character User ID:
 * Format: 5 chars - 4 chars - 4 chars (e.g. "98f15-8163-2fd3")
 * Total length = exactly 15 characters (13 alphanumeric characters + 2 hyphens).
 */
export function formatUserId(rawId?: string | null): string {
  if (!rawId) return "00000-0000-0000";

  // If already exactly in 5-4-4 format (15 characters)
  if (/^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}$/.test(rawId)) {
    return rawId.toLowerCase();
  }

  // Clean non-alphanumeric characters
  const clean = rawId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  if (clean.length === 0) {
    return "00000-0000-0000";
  }

  // Pad to at least 13 alphanumeric chars if too short
  let padded = clean;
  if (padded.length < 13) {
    padded = (padded + "0000000000000").slice(0, 13);
  }

  // Take the first 13 alphanumeric characters and split into 5-4-4
  const p1 = padded.slice(0, 5);
  const p2 = padded.slice(5, 9);
  const p3 = padded.slice(9, 13);

  return `${p1}-${p2}-${p3}`;
}
