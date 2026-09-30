import type { PatternDimension, PatternStatus, WinningPattern } from "@/types/winning-patterns";

type DisplaySignal = { dimension: PatternDimension; term: string };

const SEMANTIC_PRIORITY: PatternDimension[] = ["ENTIDAD", "TEMA", "BENEFICIO", "DOLOR", "INTENCIÓN", "CONTEXTO"];

function titleCaseFirst(value: string): string {
  return value.length ? value.charAt(0).toLocaleUpperCase("es") + value.slice(1) : value;
}

export function createDisplayLabel(signals: DisplaySignal[]): string {
  const semantic = SEMANTIC_PRIORITY.flatMap((dimension) => signals
    .filter((signal) => signal.dimension === dimension)
    .map((signal) => signal.term.trim())
    .filter(Boolean));
  const chosen = [...new Set(semantic)].slice(0, 3);
  if (chosen.length < 2) {
    const secondary = signals
      .filter((signal) => signal.dimension === "ESTRUCTURA" || signal.dimension === "DURACIÓN")
      .map((signal) => signal.term.trim())
      .filter(Boolean);
    for (const term of secondary) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(term)) chosen.push(term);
    }
  }
  return chosen.map(titleCaseFirst).join(" + ") || "Patrón semántico";
}

export function statusEvidence(pattern: Pick<WinningPattern, "supportingVideoCount" | "winnerCount" | "averageViewsVsMedian">): string {
  const median = pattern.averageViewsVsMedian === null
    ? "mediana sin dato"
    : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(pattern.averageViewsVsMedian)}x mediana`;
  return `${pattern.supportingVideoCount} videos · ${pattern.winnerCount} winners · ${median}`;
}

export function statusExplanation(status: PatternStatus): string | null {
  return status === "emerging"
    ? "Pocos videos, pero rendimiento relativo muy superior al comportamiento normal del canal."
    : null;
}

export function whyThisPattern(pattern: Pick<WinningPattern, "supportingVideoCount" | "winnerCount" | "averageViewsVsMedian" | "lift" | "durationRange">): string[] {
  const median = pattern.averageViewsVsMedian === null
    ? "No disponible"
    : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(pattern.averageViewsVsMedian)}x`;
  const lift = pattern.lift === null
    ? "No disponible"
    : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(pattern.lift)}x`;
  return [
    `${pattern.supportingVideoCount} videos comparten esta combinación.`,
    `${pattern.winnerCount} de esos videos son winners.`,
    `Promedio Views/Median: ${median}.`,
    `Lift observado: ${lift}.`,
    `Duración observada: ${pattern.durationRange.label}.`,
  ];
}
