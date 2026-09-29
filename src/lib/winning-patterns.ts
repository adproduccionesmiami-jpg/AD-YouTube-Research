import type { CompetitorReport, CompetitorVideo, KeywordCategory } from "@/types/competitor";
import type { PatternDimension, PatternEvidence, PatternStatus, WinningPattern, WinningPatternsAnalysis } from "@/types/winning-patterns";

type Signal = { dimension: PatternDimension; term: string };
type Candidate = { signals: Signal[]; ids: Set<string> };

const DIMENSIONS: KeywordCategory[] = ["TEMA", "INTENCIÓN", "DOLOR", "BENEFICIO", "CONTEXTO", "ENTIDAD"];
const CATEGORY_LABEL: Record<KeywordCategory, keyof Pick<WinningPattern, "topics" | "intents" | "pains" | "benefits" | "contexts" | "entities">> = {
  TEMA: "topics", "INTENCIÓN": "intents", DOLOR: "pains", BENEFICIO: "benefits", CONTEXTO: "contexts", ENTIDAD: "entities",
};
const round = (value: number): number => Math.round(value * 100) / 100;
const average = (values: Array<number | null | undefined>): number | null => {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};
const stableSort = (items: Signal[]): Signal[] => [...items].sort((a, b) => a.dimension.localeCompare(b.dimension, "es") || a.term.localeCompare(b.term, "es"));

function titleStructure(title: string): string | null {
  const normalized = title.toLocaleLowerCase("es");
  if (/^(?:cómo|how to)\b/u.test(normalized)) return "Cómo / How to + tema";
  if (/\b(?:antes de|before)\b/u.test(normalized)) return "Tema + antes de / before + contexto";
  if (/\b(?:para|for)\b/u.test(normalized)) return "Tema + para / for + beneficio";
  if (/\b(?:sin|without)\b/u.test(normalized)) return "Tema + sin / without + dolor";
  if (/\b(?:vs\.?|versus)\b/u.test(normalized)) return "Comparación (vs / versus)";
  return null;
}

function durationBand(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 4 * 60) return "Menos de 4 min";
  if (seconds <= 20 * 60) return "4–20 min";
  if (seconds <= 45 * 60) return "20–45 min";
  if (seconds <= 60 * 60) return "45–60 min";
  return "Más de 60 min";
}

function combinations<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  const visit = (start: number, current: T[]) => {
    if (current.length === size) { result.push(current); return; }
    for (let index = start; index < items.length; index += 1) visit(index + 1, [...current, items[index]]);
  };
  visit(0, []);
  return result;
}

function videoSignals(video: CompetitorVideo, report: CompetitorReport): Signal[] {
  const byCategory = new Map<KeywordCategory, string[]>();
  for (const category of DIMENSIONS) {
    const terms = report.titleKeywords
      .filter((item) => item.category === category && item.videoIds.includes(video.id))
      .sort((a, b) => b.videoFrequency - a.videoFrequency || b.winnerFrequency - a.winnerFrequency || a.term.length - b.term.length)
      .slice(0, category === "TEMA" ? 2 : 1)
      .map((item) => item.term);
    byCategory.set(category, terms);
  }
  // Preserve the already-computed central cluster as a topic signal if the keyword table omitted it.
  const topics = byCategory.get("TEMA") ?? [];
  if (video.primaryTopic !== "Tema sin clasificar" && !topics.includes(video.primaryTopic)) topics.unshift(video.primaryTopic);
  byCategory.set("TEMA", topics.slice(0, 2));

  const signals: Signal[] = [];
  for (const category of DIMENSIONS) {
    for (const term of byCategory.get(category) ?? []) signals.push({ dimension: category, term });
  }
  const structure = titleStructure(video.title);
  if (structure) signals.push({ dimension: "ESTRUCTURA", term: structure });
  const duration = durationBand(video.durationSeconds);
  if (duration) signals.push({ dimension: "DURACIÓN", term: duration });
  return signals;
}

function keyFor(signals: Signal[]): string {
  return stableSort(signals).map((signal) => `${signal.dimension}:${signal.term.toLocaleLowerCase("es")}`).join("|");
}

function candidateLabel(signals: Signal[]): string {
  return stableSort(signals).map(({ dimension, term }) => `${dimension.toLocaleLowerCase("es")}: ${term}`).join(" · ");
}

function classify(supportCount: number, winnerCount: number, avgMedian: number | null, lift: number | null): PatternStatus {
  if (supportCount <= 2 && winnerCount >= 1 && (avgMedian ?? 0) >= 3) return "emerging";
  if (supportCount >= 4 && winnerCount >= 2 && (lift ?? 0) >= 1.2) return "consolidated";
  return "promising";
}

function toPattern(candidate: Candidate, videosById: Map<string, CompetitorVideo>, sampleSize: number, report: CompetitorReport): WinningPattern | null {
  const evidence = [...candidate.ids].map((id) => videosById.get(id)).filter((video): video is CompetitorVideo => Boolean(video));
  if (evidence.length < 2) return null;
  const winnerCount = evidence.filter((video) => video.isWinner).length;
  if (winnerCount < 1) return null;
  const winnerShare = round(winnerCount / evidence.length);
  const baselineShare = sampleSize ? round(evidence.length / sampleSize) : null;
  const lift = baselineShare && baselineShare > 0 ? round(winnerShare / baselineShare) : null;
  const averageViewsVsMedian = average(evidence.map((video) => video.metrics.viewsVsMedian));
  const status = classify(evidence.length, winnerCount, averageViewsVsMedian, lift);
  const values: Record<string, string[]> = {};
  for (const signal of candidate.signals) {
    if (signal.dimension === "DURACIÓN") continue;
    const key = signal.dimension === "ESTRUCTURA" ? "titleStructures" : CATEGORY_LABEL[signal.dimension];
    values[key] ??= [];
    if (!values[key].includes(signal.term)) values[key].push(signal.term);
  }
  const durations = evidence.map((video) => video.durationSeconds).filter((value): value is number => value !== null && Number.isFinite(value));
  const bandOrder = ["Menos de 4 min", "4–20 min", "20–45 min", "45–60 min", "Más de 60 min"];
  const bands = [...new Set(evidence.map((video) => durationBand(video.durationSeconds)).filter((value): value is string => Boolean(value)))].sort((a, b) => bandOrder.indexOf(a) - bandOrder.indexOf(b));
  const selectedDuration = candidate.signals.find((signal) => signal.dimension === "DURACIÓN")?.term;
  const dimensions = Object.fromEntries(DIMENSIONS.map((dimension) => [CATEGORY_LABEL[dimension], values[CATEGORY_LABEL[dimension]] ?? []])) as Pick<WinningPattern, "topics" | "intents" | "pains" | "benefits" | "contexts" | "entities">;
  return {
    id: keyFor(candidate.signals), label: candidateLabel(candidate.signals), status,
    ...dimensions,
    titleStructures: values.titleStructures ?? [], recurringPhrases: candidate.signals.filter((signal) => signal.dimension !== "ESTRUCTURA" && signal.dimension !== "DURACIÓN" && signal.term.trim().split(/\s+/u).length > 1).map((signal) => signal.term),
    durationRange: { label: selectedDuration ?? (bands.length === 1 ? bands[0] : bands.length ? `${bands[0]}–${bands[bands.length - 1]}` : "Sin dato"), minSeconds: durations.length ? Math.min(...durations) : null, maxSeconds: durations.length ? Math.max(...durations) : null },
    supportingVideoIds: evidence.map((video) => video.id), supportingVideoCount: evidence.length, winnerCount,
    averageViews: average(evidence.map((video) => video.views)),
    averageViewsToSubscribers: average(evidence.map((video) => video.metrics.viewsToSubscribers)),
    averageViewsVsMedian,
    averageViewsPerDay: average(evidence.map((video) => video.metrics.viewsPerDay)),
    winnerShare, baselineShare, lift,
    evidence: evidence.map((video) => ({ id: video.id, title: video.title, videoUrl: video.videoUrl, isWinner: video.isWinner, views: video.views, durationSeconds: video.durationSeconds, metrics: video.metrics, semanticSignals: videoSignals(video, report) } satisfies PatternEvidence)),
  };
}

export function analyzeWinningPatterns(report: CompetitorReport): WinningPatternsAnalysis {
  const videos = report.videos ?? [];
  const candidates = new Map<string, Candidate>();
  const signalCounts = new Map<string, { dimension: PatternDimension; term: string; ids: Set<string> }>();
  for (const video of videos) {
    const signals = videoSignals(video, report);
    for (const signal of signals) {
      const signalKey = `${signal.dimension}:${signal.term}`;
      const current = signalCounts.get(signalKey) ?? { ...signal, ids: new Set<string>() };
      current.ids.add(video.id);
      signalCounts.set(signalKey, current);
    }
    const semantic = signals.filter((signal) => signal.dimension !== "ESTRUCTURA" && signal.dimension !== "DURACIÓN");
    for (const size of [2, 3]) {
      for (const combo of combinations(semantic, size)) {
        if (new Set(combo.map((item) => item.dimension)).size !== size) continue;
        const variants = [combo];
        const structure = signals.find((item) => item.dimension === "ESTRUCTURA");
        const duration = signals.find((item) => item.dimension === "DURACIÓN");
        if (structure) variants.push([...combo, structure]);
        if (duration) variants.push([...combo, duration]);
        if (structure && duration) variants.push([...combo, structure, duration]);
        for (const variant of variants) {
          const key = keyFor(variant);
          const current = candidates.get(key) ?? { signals: stableSort(variant), ids: new Set<string>() };
          current.ids.add(video.id);
          candidates.set(key, current);
        }
      }
    }
  }

  const videosById = new Map(videos.map((video) => [video.id, video]));
  const eligible = [...candidates.values()].map((candidate) => toPattern(candidate, videosById, videos.length, report)).filter((pattern): pattern is WinningPattern => Boolean(pattern));
  const emergingSignals = eligible.filter((pattern) => pattern.status === "emerging").sort(orderPatterns).slice(0, 12);
  const emergingIds = new Set(emergingSignals.map((pattern) => pattern.id));
  const patterns = eligible.filter((pattern) => pattern.status !== "emerging" && pattern.winnerCount >= 2).sort(orderPatterns).slice(0, 30);
  const observedSpace = [...signalCounts.values()].map((item) => ({ dimension: item.dimension, term: item.term, videoCount: item.ids.size })).sort((a, b) => b.videoCount - a.videoCount || a.term.localeCompare(b.term, "es")).slice(0, 12);
  return { channelName: report.channel.name, channelUrl: report.channel.url, sampleSize: videos.length, patterns, emergingSignals: emergingSignals.filter((pattern) => emergingIds.has(pattern.id)), observedSpace };
}

function orderPatterns(a: WinningPattern, b: WinningPattern): number {
  return b.winnerCount - a.winnerCount
    || (b.averageViewsVsMedian ?? -1) - (a.averageViewsVsMedian ?? -1)
    || (b.lift ?? -1) - (a.lift ?? -1)
    || b.supportingVideoCount - a.supportingVideoCount
    || a.label.localeCompare(b.label, "es");
}
