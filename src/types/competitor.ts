export type CompetitorReferenceKind = "id" | "handle" | "username" | "custom";

export type CompetitorChannelReference = {
  kind: CompetitorReferenceKind;
  value: string;
};

export type KeywordCategory = "TEMA" | "INTENCIÓN" | "DOLOR" | "BENEFICIO" | "CONTEXTO" | "ENTIDAD";
export type KeywordSource = "título" | "descripción" | "tag_real_youtube";

export type CompetitorChannelIdentity = {
  id: string;
  name: string;
  handle: string | null;
  description: string;
  createdAt: string | null;
  country: string | null;
  subscribers: number | null;
  totalViews: number | null;
  totalVideoCount: number | null;
  avatar: string | null;
  url: string;
};

export type CompetitorVideoSource = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  thumbnail: string | null;
  /** null means the API did not return tags; [] means it returned none. */
  youtubeTags: string[] | null;
};

export type CompetitorVideo = Omit<CompetitorVideoSource, "description"> & {
  videoUrl: string;
  metrics: {
    viewsToSubscribers: number | null;
    viewsVsMedian: number | null;
    viewsVsAverage: number | null;
    viewsPerDay: number | null;
    ageDays: number | null;
    durationMinutes: number | null;
  };
  isWinner: boolean;
  winnerSignals: string[];
  topicCluster: string;
};

export type KeywordInsight = {
  term: string;
  category: KeywordCategory;
  videoFrequency: number;
  winnerFrequency: number;
  baselineShare: number | null;
  winnerShare: number | null;
  winnerLift: number | null;
  occurrences: number;
  sources: KeywordSource[];
  videoIds: string[];
  exampleTitles: string[];
  averageViews: number | null;
  averageViewsToSubscribers: number | null;
  averageViewsVsMedian: number | null;
};

export type TitlePhrase = {
  phrase: string;
  count: number;
  examples: string[];
};

export type TitlePatternAnalysis = {
  averageCharacters: number | null;
  averageWords: number | null;
  titlesWithNumbersPercent: number | null;
  titlesWithUppercasePercent: number | null;
  titlesWithPunctuationPercent: number | null;
  frequentTitleTerms: string[];
  recurringOpeners: TitlePhrase[];
  recurringEndings: TitlePhrase[];
  formulaPatterns: TitlePhrase[];
};

export type TopicCluster = {
  topic: string;
  videoCount: number;
  averageViews: number | null;
  averageViewsToSubscribers: number | null;
  averageViewsVsMedian: number | null;
};

export type CadenceAnalysis = {
  videosPerWeek: number | null;
  averageIntervalDays: number | null;
  videosLast30Days: number;
  averageDurationMinutes: number | null;
  winnersAverageDurationMinutes: number | null;
  byWeekday: Array<{ weekday: string; count: number }>;
};

export type ViewConcentration = {
  sampleViews: number | null;
  top3Percent: number | null;
  top5Percent: number | null;
  top10Percent: number | null;
};

export type CompetitiveFingerprint = {
  whatItPublishes: string[];
  whatWorks: string[];
  whatItRepeats: string[];
  commonWords: string[];
  winnerWords: string[];
  titleStructures: string[];
  durations: string[];
  cadence: string[];
  successConcentration: string[];
};

export type CompetitorReport = {
  channel: CompetitorChannelIdentity;
  channelMetrics: {
    ageDays: number | null;
    ageLabel: string | null;
  };
  sample: {
    requested: number;
    analyzed: number;
    videosWithViews: number;
    firstPublishedAt: string | null;
    lastPublishedAt: string | null;
    averageViews: number | null;
    medianViews: number | null;
  };
  videos: CompetitorVideo[];
  winners: CompetitorVideo[];
  keywords: KeywordInsight[];
  winnerKeywords: KeywordInsight[];
  titlePatterns: TitlePatternAnalysis;
  topicClusters: TopicCluster[];
  cadence: CadenceAnalysis;
  concentration: ViewConcentration;
  fingerprint: CompetitiveFingerprint;
  warnings: string[];
};

/** Future multi-channel comparison input; it intentionally contains no inferred demand score. */
export type CompetitorComparisonSet = {
  channels: Array<{
    channelId: string;
    channelName: string;
    topicCoverage: string[];
  }>;
};
