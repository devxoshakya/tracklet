/** Small display formatters — IST-only product, dates render in Asia/Kolkata. */

const TZ = "Asia/Kolkata";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: TZ,
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  });
}

/** Cycle time in minutes → human summary (e.g. "2d 4h", "35m"). */
export function formatCycleTime(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (minutes < 24 * 60) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
