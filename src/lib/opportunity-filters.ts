import type {
  DurationFilter,
  PublicationRange,
  ResearchFormValues,
  ResearchVideo,
  ResultSort,
} from "@/types/research";

export type NumericRange = {
  min: number | null;
  max: number | null;
};

export type OpportunityFilters = {
  publishedAfter: string | null;
  views: NumericRange;
  subscribers: NumericRange;
  duration: DurationFilter;
  durationSeconds: NumericRange;
  ratio: NumericRange;
  sortBy: ResultSort;
};

export type NumberParseResult = {
  valid: boolean;
  value: number | null;
};

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseOptionalNumber(value: unknown, integerOnly: boolean): NumberParseResult {
  if (value === null || value === undefined || value === "") return { valid: true, value: null };
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (integerOnly && !Number.isInteger(value))) return { valid: false, value: null };
    return { valid: true, value };
  }
  if (typeof value !== "string") return { valid: false, value: null };

  const compact = value.trim().replace(/[\s\u00a0]/g, "");
  if (!compact) return { valid: true, value: null };

  let normalized = compact;
  if (integerOnly) {
    if (!/^-?(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(compact)) return { valid: false, value: null };
    normalized = compact.replace(/[.,]/g, "");
  } else {
    const lastComma = compact.lastIndexOf(",");
    const lastDot = compact.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
      const decimalMark = lastComma > lastDot ? "," : ".";
      const groupingMark = decimalMark === "," ? /\./g : /,/g;
      normalized = compact.replace(groupingMark, "").replace(decimalMark, ".");
    } else if (lastComma >= 0) {
      normalized = compact.replace(",", ".");
    }
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { valid: false, value: null };
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? { valid: true, value: parsed } : { valid: false, value: null };
}

export function validateNumericRange(
  minInput: unknown,
  maxInput: unknown,
  options: {
    minKey: string;
    maxKey: string;
    label: string;
    integerOnly?: boolean;
  },
): { range: NumericRange; errors: Record<string, string> } {
  const integerOnly = options.integerOnly ?? true;
  const min = parseOptionalNumber(minInput, integerOnly);
  const max = parseOptionalNumber(maxInput, integerOnly);
  const errors: Record<string, string> = {};

  if (!min.valid) errors[options.minKey] = `Escribe un mínimo válido para ${options.label}.`;
  else if (min.value !== null && min.value < 0) errors[options.minKey] = `El mínimo de ${options.label} no puede ser negativo.`;

  if (!max.valid) errors[options.maxKey] = `Escribe un máximo válido para ${options.label}.`;
  else if (max.value !== null && max.value < 0) errors[options.maxKey] = `El máximo de ${options.label} no puede ser negativo.`;

  if (min.valid && max.valid && min.value !== null && max.value !== null && min.value > max.value) {
    errors[options.maxKey] = `El máximo de ${options.label} debe ser mayor o igual que el mínimo.`;
  }

  return {
    range: { min: min.valid ? min.value : null, max: max.valid ? max.value : null },
    errors,
  };
}

export function getFormFilterErrors(form: ResearchFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.dateRange === "custom" && !isDateOnly(form.customDateFrom)) {
    errors.customDateFrom = "Selecciona una fecha desde válida.";
  }

  const ranges = [
    validateNumericRange(form.minViews, form.maxViews, {
      minKey: "minViews", maxKey: "maxViews", label: "las vistas",
    }),
    validateNumericRange(form.minSubscribers, form.maxSubscribers, {
      minKey: "minSubscribers", maxKey: "maxSubscribers", label: "los suscriptores",
    }),
    validateNumericRange(form.minRatio, form.maxRatio, {
      minKey: "minRatio", maxKey: "maxRatio", label: "la relación Vistas/Subs", integerOnly: false,
    }),
  ];

  for (const range of ranges) Object.assign(errors, range.errors);
  if (form.durationFilter === "custom") {
    Object.assign(errors, validateNumericRange(form.minDurationMinutes, form.maxDurationMinutes, {
      minKey: "minDurationMinutes", maxKey: "maxDurationMinutes", label: "la duración",
    }).errors);
  }
  return errors;
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
}

function subtractUtcMonths(date: Date, months: number): Date {
  const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12;
  const day = clampDay(year, month, date.getUTCDate());
  return new Date(Date.UTC(
    year,
    month,
    day,
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
}

export function resolvePublishedAfter(
  dateRange: PublicationRange,
  customDateFrom: string,
  now = new Date(),
): string | null {
  switch (dateRange) {
    case "any":
      return null;
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case "12m":
      return subtractUtcMonths(now, 12).toISOString();
    case "custom":
      return isDateOnly(customDateFrom) ? `${customDateFrom}T00:00:00.000Z` : null;
  }
}

function matchesRange(value: number | null, range: NumericRange): boolean {
  if (range.min === null && range.max === null) return true;
  if (value === null || !Number.isFinite(value)) return false;
  return (range.min === null || value >= range.min) && (range.max === null || value <= range.max);
}

function publishedTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesDuration(video: ResearchVideo, filters: OpportunityFilters): boolean {
  const seconds = video.durationSeconds;
  if (filters.duration === "all" && filters.durationSeconds.min === null && filters.durationSeconds.max === null) return true;
  if (filters.duration === "custom" && filters.durationSeconds.min === null && filters.durationSeconds.max === null) return true;
  if (seconds === null || !Number.isFinite(seconds)) return false;

  switch (filters.duration) {
    case "short":
      return seconds < 4 * 60;
    case "medium":
      return seconds >= 4 * 60 && seconds <= 20 * 60;
    case "long":
      return seconds > 20 * 60;
    case "custom":
    case "all":
      return matchesRange(seconds, filters.durationSeconds);
  }
}

function matchesVideo(video: ResearchVideo, filters: OpportunityFilters): boolean {
  if (filters.publishedAfter) {
    const threshold = Date.parse(filters.publishedAfter);
    const publishedAt = publishedTimestamp(video.publishedAt);
    if (!Number.isFinite(threshold) || publishedAt === null || publishedAt < threshold) return false;
  }

  return matchesRange(video.views, filters.views) &&
    matchesRange(video.subscribers, filters.subscribers) &&
    matchesRange(video.viewsToSubscribers, filters.ratio) &&
    matchesDuration(video, filters);
}

function compareDescending(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return b - a;
}

export function filterAndSortVideos(videos: ResearchVideo[], filters: OpportunityFilters): ResearchVideo[] {
  const eligible = videos.filter((video) => matchesVideo(video, filters));
  if (filters.sortBy === "relevance") return eligible;

  return eligible
    .map((video, index) => ({ video, index }))
    .sort((left, right) => {
      let comparison = 0;
      if (filters.sortBy === "views") comparison = compareDescending(left.video.views, right.video.views);
      if (filters.sortBy === "ratio") comparison = compareDescending(left.video.viewsToSubscribers, right.video.viewsToSubscribers);
      if (filters.sortBy === "recent") {
        comparison = compareDescending(publishedTimestamp(left.video.publishedAt), publishedTimestamp(right.video.publishedAt));
      }
      return comparison || left.index - right.index;
    })
    .map(({ video }) => video);
}

export function hasPostSearchFilters(
  language: "all" | "en" | "es",
  filters: OpportunityFilters,
): boolean {
  return language !== "all" ||
    filters.views.min !== null || filters.views.max !== null ||
    filters.subscribers.min !== null || filters.subscribers.max !== null ||
    filters.duration !== "all" ||
    filters.durationSeconds.min !== null || filters.durationSeconds.max !== null ||
    filters.ratio.min !== null || filters.ratio.max !== null ||
    filters.sortBy === "ratio";
}
