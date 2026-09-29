export type DurationClass = "Corto" | "Medio" | "Largo";

export function parseDurationToSeconds(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match || !match.slice(1).some(Boolean)) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const remainder = total % 60;
  if (hours > 0) {
    return [hours, String(minutes).padStart(2, "0"), String(remainder).padStart(2, "0")].join(":");
  }
  return [minutes, String(remainder).padStart(2, "0")].join(":");
}

export function classifyDuration(seconds: number | null): DurationClass | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 4 * 60) return "Corto";
  if (seconds <= 20 * 60) return "Medio";
  return "Largo";
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date).replaceAll(" de ", " ");
}

export function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + "x";
}
