import { NextResponse } from "next/server";
import { filterAndSortVideos, hasPostSearchFilters, isDateOnly, resolvePublishedAfter, validateNumericRange } from "@/lib/opportunity-filters";
import { matchesTargetLanguage } from "@/lib/language-filter";
import { parseDurationToSeconds } from "@/lib/youtube-format";
import type { DurationFilter, PublicationRange, ResultSort, ResearchVideo, TargetLanguage } from "@/types/research";

export const runtime = "nodejs";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const ALLOWED_RESULT_COUNTS = new Set([5, 10, 25, 50]);
const DATE_RANGES = new Set<PublicationRange>(["any", "7d", "30d", "90d", "12m", "custom"]);
const DURATION_FILTERS = new Set<DurationFilter>(["all", "short", "medium", "long", "custom"]);
const RESULT_SORTS = new Set<ResultSort>(["relevance", "views", "recent", "ratio"]);

type ApiErrorPayload = {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
    status?: string;
  };
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { channelId?: string; channelTitle?: string };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      channelId?: string;
      channelTitle?: string;
      categoryId?: string;
      defaultLanguage?: string;
      defaultAudioLanguage?: string;
      tags?: string[];
      thumbnails?: Record<string, { url?: string }>;
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
};

type YouTubeChannelsResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      country?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    statistics?: {
      subscriberCount?: string;
      hiddenSubscriberCount?: boolean;
      viewCount?: string;
      videoCount?: string;
    };
  }>;
};

class YouTubeApiError extends Error {
  constructor(
    readonly reason: string,
    readonly httpStatus: number,
  ) {
    super(reason);
  }
}

function count(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bestThumbnail(thumbnails: Record<string, { url?: string }> | undefined): string | null {
  if (!thumbnails) return null;
  const preferred = ["maxres", "standard", "high", "medium", "default"];
  for (const size of preferred) {
    const url = thumbnails[size]?.url;
    if (url) return url;
  }
  return null;
}

async function youtubeGet<T>(endpoint: string, params: URLSearchParams, apiKey: string): Promise<T> {
  const requestParams = new URLSearchParams(params);
  requestParams.set("key", apiKey);
  let response: Response;
  try {
    response = await fetch(YOUTUBE_API_BASE + "/" + endpoint + "?" + requestParams.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  const payload = await response.json().catch(() => ({})) as T & ApiErrorPayload;
  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason ?? payload.error?.status ?? "youtubeError";
    throw new YouTubeApiError(reason, response.status);
  }
  return payload;
}

function toPublicApiError(error: YouTubeApiError): { status: number; code: string; message: string } {
  if (["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded", "resourceExhausted"].includes(error.reason)) {
    return {
      status: 429,
      code: "QUOTA_EXCEEDED",
      message: "La cuota de YouTube Data API se agotó o está temporalmente limitada. Revisa la cuota del proyecto e inténtalo más tarde.",
    };
  }
  if (["keyInvalid", "API_KEY_INVALID", "invalidKey"].includes(error.reason) || error.httpStatus === 401) {
    return {
      status: 503,
      code: "INVALID_API_KEY",
      message: "La clave de la API no está configurada correctamente. Comprueba YOUTUBE_API_KEY en .env.local.",
    };
  }
  if (["accessNotConfigured", "SERVICE_DISABLED", "youtubeSignupRequired"].includes(error.reason)) {
    return {
      status: 503,
      code: "API_NOT_ENABLED",
      message: "La YouTube Data API v3 no está habilitada para el proyecto asociado a esta clave.",
    };
  }
  return {
    status: 502,
    code: "YOUTUBE_ERROR",
    message: "YouTube no pudo completar la consulta. Revisa la clave y la configuración del proyecto e inténtalo de nuevo.",
  };
}

function invalidInput(message: string, status = 400) {
  return NextResponse.json({ error: { code: "INVALID_INPUT", message } }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: "API_KEY_MISSING",
          message: "La clave de YouTube Data API no está configurada. Copia .env.example a .env.local y añade YOUTUBE_API_KEY.",
        },
      },
      { status: 503 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return invalidInput("La solicitud no tiene un formato válido.");
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return invalidInput("La solicitud no tiene un formato válido.");
  }
  const input = parsedBody as Record<string, unknown>;

  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const keywords = typeof input.keywords === "string" ? input.keywords.trim() : "";
  const language = input.language as TargetLanguage;
  const maxResults = Number(input.maxResults);

  if (!topic || topic.length > 200) return invalidInput("Escribe un tema de hasta 200 caracteres.");
  if (keywords.length > 500) return invalidInput("Las palabras clave no pueden superar 500 caracteres.");
  if (!["all", "en", "es"].includes(language)) return invalidInput("Selecciona un idioma válido.");
  if (!ALLOWED_RESULT_COUNTS.has(maxResults)) return invalidInput("Selecciona un máximo válido: 5, 10, 25 o 50.");

  // Keep accepting the v0.01 request shape while the UI uses the expanded date range controls.
  const rawDateRange = input.dateRange ?? (input.publishedAfter ? "custom" : "any");
  if (typeof rawDateRange !== "string" || !DATE_RANGES.has(rawDateRange as PublicationRange)) {
    return invalidInput("Selecciona un periodo de publicación válido.");
  }
  const dateRange = rawDateRange as PublicationRange;
  const customDateFrom = typeof input.customDateFrom === "string"
    ? input.customDateFrom
    : typeof input.publishedAfter === "string" ? input.publishedAfter : "";
  if (dateRange === "custom" && !isDateOnly(customDateFrom)) {
    return invalidInput("Selecciona una fecha desde válida.");
  }

  const rawDurationFilter = input.durationFilter ?? "all";
  if (typeof rawDurationFilter !== "string" || !DURATION_FILTERS.has(rawDurationFilter as DurationFilter)) {
    return invalidInput("Selecciona una duración válida.");
  }
  const durationFilter = rawDurationFilter as DurationFilter;

  const rawSort = input.sortBy ?? "relevance";
  if (typeof rawSort !== "string" || !RESULT_SORTS.has(rawSort as ResultSort)) {
    return invalidInput("Selecciona un orden válido.");
  }
  const sortBy = rawSort as ResultSort;

  const views = validateNumericRange(input.minViews, input.maxViews, {
    minKey: "minViews", maxKey: "maxViews", label: "las vistas",
  });
  const subscribers = validateNumericRange(input.minSubscribers, input.maxSubscribers, {
    minKey: "minSubscribers", maxKey: "maxSubscribers", label: "los suscriptores",
  });
  const durationMinutes = durationFilter === "custom"
    ? validateNumericRange(input.minDurationMinutes, input.maxDurationMinutes, {
      minKey: "minDurationMinutes", maxKey: "maxDurationMinutes", label: "la duración",
    })
    : { range: { min: null, max: null }, errors: {} };
  const ratio = validateNumericRange(input.minRatio, input.maxRatio, {
    minKey: "minRatio", maxKey: "maxRatio", label: "la relación Vistas/Subs", integerOnly: false,
  });
  const fieldErrors = {
    ...views.errors,
    ...subscribers.errors,
    ...durationMinutes.errors,
    ...ratio.errors,
  };
  if (Object.keys(fieldErrors).length > 0) {
    const firstMessage = Object.values(fieldErrors)[0];
    return NextResponse.json(
      { error: { code: "INVALID_FILTERS", message: firstMessage, fields: fieldErrors } },
      { status: 400 },
    );
  }

  const publishedAfter = resolvePublishedAfter(dateRange, customDateFrom);
  const durationSeconds = {
    min: durationMinutes.range.min === null ? null : durationMinutes.range.min * 60,
    max: durationMinutes.range.max === null ? null : durationMinutes.range.max * 60,
  };
  const filters = {
    publishedAfter,
    views: views.range,
    subscribers: subscribers.range,
    duration: durationFilter,
    durationSeconds,
    ratio: ratio.range,
    sortBy,
  };

  const keywordParts = keywords.split(",").map((part) => part.trim()).filter(Boolean);
  const query = [topic, ...keywordParts].join(" ").slice(0, 700);
  const overfetch = hasPostSearchFilters(language, filters);
  const candidateLimit = overfetch ? 50 : maxResults;
  const searchOrder = sortBy === "recent" ? "date" : sortBy === "views" ? "viewCount" : "relevance";
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(candidateLimit),
    order: searchOrder,
  });
  if (language !== "all") searchParams.set("relevanceLanguage", language);
  if (publishedAfter) searchParams.set("publishedAfter", publishedAfter);

  try {
    const search = await youtubeGet<YouTubeSearchResponse>("search", searchParams, apiKey);
    const seenIds = new Set<string>();
    const searchItems = (search.items ?? []).filter((item) => {
      const id = item.id?.videoId;
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });
    const videoIds = searchItems.map((item) => item.id?.videoId).filter((id): id is string => Boolean(id));
    if (videoIds.length === 0) {
      return NextResponse.json({ query, totalResults: 0, sortBy, items: [] });
    }

    const videoParams = new URLSearchParams({ part: "snippet,contentDetails,statistics", id: videoIds.join(",") });
    const channelIds = [...new Set(searchItems.map((item) => item.snippet?.channelId).filter((id): id is string => Boolean(id)))];
    const [videos, channels] = await Promise.all([
      youtubeGet<YouTubeVideosResponse>("videos", videoParams, apiKey),
      channelIds.length > 0
        ? youtubeGet<YouTubeChannelsResponse>("channels", new URLSearchParams({ part: "snippet,statistics", id: channelIds.join(",") }), apiKey)
        : Promise.resolve({ items: [] } as YouTubeChannelsResponse),
    ]);

    const videosById = new Map((videos.items ?? []).map((video) => [video.id, video]));
    const channelsById = new Map((channels.items ?? []).map((channel) => [channel.id, channel]));
    const candidates: ResearchVideo[] = [];

    for (const searchItem of searchItems) {
      const id = searchItem.id?.videoId;
      if (!id) continue;
      const video = videosById.get(id);
      const snippet = video?.snippet;
      if (!video || !snippet) continue;

      if (!matchesTargetLanguage(language, snippet.defaultAudioLanguage, snippet.defaultLanguage, snippet.title ?? "", snippet.description ?? "")) {
        continue;
      }

      const channelId = snippet.channelId ?? searchItem.snippet?.channelId ?? "";
      const channel = channelsById.get(channelId);
      const views = count(video.statistics?.viewCount);
      const channelStatistics = channel?.statistics;
      const subscribers = channelStatistics?.hiddenSubscriberCount === true
        ? null
        : count(channelStatistics?.subscriberCount);
      const duration = video.contentDetails?.duration ?? null;

      candidates.push({
        id,
        videoUrl: "https://www.youtube.com/watch?v=" + encodeURIComponent(id),
        thumbnail: bestThumbnail(snippet.thumbnails),
        title: snippet.title ?? "Video sin título",
        description: (snippet.description ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
        publishedAt: snippet.publishedAt ?? "",
        duration,
        durationSeconds: parseDurationToSeconds(duration),
        views,
        likes: count(video.statistics?.likeCount),
        comments: count(video.statistics?.commentCount),
        channelId,
        channelName: channel?.snippet?.title ?? snippet.channelTitle ?? searchItem.snippet?.channelTitle ?? "Canal sin nombre",
        channelUrl: channelId ? "https://www.youtube.com/channel/" + encodeURIComponent(channelId) : "https://www.youtube.com",
        channelThumbnail: bestThumbnail(channel?.snippet?.thumbnails),
        subscribers,
        channelViews: count(channelStatistics?.viewCount),
        channelVideoCount: count(channelStatistics?.videoCount),
        channelCreatedAt: channel?.snippet?.publishedAt ?? null,
        channelCountry: channel?.snippet?.country ?? null,
        language: snippet.defaultAudioLanguage ?? snippet.defaultLanguage ?? null,
        categoryId: snippet.categoryId ?? null,
        tags: snippet.tags ?? [],
        viewsToSubscribers: views !== null && subscribers !== null && subscribers > 0 ? views / subscribers : null,
      });
    }

    const eligible = filterAndSortVideos(candidates, filters);
    const items = eligible.slice(0, maxResults);
    return NextResponse.json({ query, totalResults: items.length, sortBy, items });
  } catch (error) {
    if (error instanceof YouTubeApiError) {
      const publicError = toPublicApiError(error);
      return NextResponse.json({ error: { code: publicError.code, message: publicError.message } }, { status: publicError.status });
    }
    const networkFailure = error instanceof Error && error.message === "NETWORK_ERROR";
    return NextResponse.json(
      {
        error: {
          code: networkFailure ? "NETWORK_ERROR" : "YOUTUBE_ERROR",
          message: networkFailure
            ? "No se pudo conectar con YouTube. Comprueba la conexión e inténtalo de nuevo."
            : "Ocurrió un error al consultar YouTube. Inténtalo de nuevo en unos momentos.",
        },
      },
      { status: 502 },
    );
  }
}
