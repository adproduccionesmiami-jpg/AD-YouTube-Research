import type { CompetitorVideo, KeywordCategory } from "@/types/competitor";

export type PatternStatus = "consolidated" | "promising" | "emerging";
export type PatternDimension = KeywordCategory | "ESTRUCTURA" | "DURACIÓN";

export type PatternEvidence = Pick<CompetitorVideo, "id" | "title" | "videoUrl" | "isWinner" | "views" | "durationSeconds" | "metrics"> & {
  semanticSignals: Array<{ dimension: PatternDimension; term: string }>;
};

export type WinningPattern = {
  id: string;
  label: string;
  status: PatternStatus;
  topics: string[];
  intents: string[];
  pains: string[];
  benefits: string[];
  contexts: string[];
  entities: string[];
  titleStructures: string[];
  recurringPhrases: string[];
  durationRange: { label: string; minSeconds: number | null; maxSeconds: number | null };
  supportingVideoIds: string[];
  supportingVideoCount: number;
  winnerCount: number;
  averageViews: number | null;
  averageViewsToSubscribers: number | null;
  averageViewsVsMedian: number | null;
  averageViewsPerDay: number | null;
  winnerShare: number | null;
  baselineShare: number | null;
  lift: number | null;
  evidence: PatternEvidence[];
};

export type WinningPatternsAnalysis = {
  channelName: string;
  channelUrl: string;
  sampleSize: number;
  patterns: WinningPattern[];
  emergingSignals: WinningPattern[];
  observedSpace: Array<{ dimension: PatternDimension; term: string; videoCount: number }>;
};
