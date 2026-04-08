import type { OdsStatus } from "../types/api";

/** Derive ODS status from a numeric score. */
export function statusFromScore(score: number | null): OdsStatus | null {
  if (score === null) return null;
  if (score >= 70) return "verde";
  if (score >= 40) return "amarelo";
  return "vermelho";
}

/** Tailwind text color class for a status. */
export function statusTextColor(status: OdsStatus | null): string {
  if (!status) return "text-muted-foreground/60";
  const map: Record<OdsStatus, string> = {
    verde: "text-success",
    amarelo: "text-warning",
    vermelho: "text-danger",
  };
  return map[status];
}

/** Tailwind background color class for a progress bar. */
export function statusBarColor(status: OdsStatus | null): string {
  if (!status) return "bg-muted";
  const map: Record<OdsStatus, string> = {
    verde: "bg-success",
    amarelo: "bg-warning",
    vermelho: "bg-danger",
  };
  return map[status];
}
