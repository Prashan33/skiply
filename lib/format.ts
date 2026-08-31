/**
 * Pure display formatters. No dependencies — safe on server or client.
 */

/** `4230` -> `"1h 10m"`, `350` -> `"5m"`, `0`/nullish -> `"0m"`. */
export function formatDurationFromSeconds(totalSeconds: number | null | undefined): string {
  const secs = Math.max(0, Math.round(totalSeconds ?? 0));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** `350` -> `"5:50"`, `65` -> `"1:05"`. Used for individual lesson lengths. */
export function formatClock(totalSeconds: number | null | undefined): string {
  const secs = Math.max(0, Math.round(totalSeconds ?? 0));
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** `18240` -> `"18.2k"`, `2100` -> `"2.1k"`, `950` -> `"950"`. */
export function formatCompactCount(value: number | null | undefined): string {
  const n = Math.max(0, Math.round(value ?? 0));
  if (n < 1000) return String(n);
  const thousands = n / 1000;
  const rounded = thousands >= 100 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
  return `${rounded}k`;
}

/** `"intermediate"` -> `"Intermediate"`. */
export function capitalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
