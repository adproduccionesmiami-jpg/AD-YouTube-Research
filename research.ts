export type TargetLanguage = "all" | "en" | "es";
export type PublicationRange = "any" | "7d" | "30d" | "90d" | "12m" | "custom";
export type DurationFilter = "all" | "short" | "medium" | "long" | "custom";
export type ResultSort = "relevance" | "views" | "recent" | "ratio";

export type ResearchFormValues = {
  topic: string;
  keywords: string;
  language: TargetLanguage;
  dateRange: PublicationRange;
  customDateFrom: string;
  minViews: string;
  maxViews: string;
  minSubscribers: string;
  maxSubscribers: string;
  durationFilter: DurationFilter;
  minDurationMinutes: string;
  maxDurationMinutes: string;
  minRatio: string;
  maxRatio: string;
  sortBy: ResultSort;
  maxResults: number;
};

export type ResearchRequest = {
  topic: string;
  keywords: string;
  language: TargetLanguage;
  dateRange: PublicationRange;
  customDateFrom: string;
  minViews: number | null;
  maxViews: number | null;
  minSubscribers: number | null;
  maxSubscribers: number | null;
  durationFilter: DurationFilter;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  minRatio: number | null;
  maxRatio: number | null;
  sortBy: ResultSort;
  maxResults: number;
};

export type ResearchVideo = {
  id: string;
  videoUrl: string;
  thumbnail: string | null;
  title: string;
  description: string;
  publishedAt: string;
  duration: string | null;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelThumbnail: string | null;
  subscribers: number | null;
  channelViews: number | null;
  channelVideoCount: number | null;
  channelCreatedAt: string | null;
  channelCountry: string | null;
  language: string | null;
  categoryId: string | null;
  tags: string[];
  viewsToSubscribers: number | null;
};

export type ResearchSuccess = {
  query: string;
  totalResults: number;
  sortBy: ResultSort;
  items: ResearchVideo[];
};

export type ResearchFailure = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};
