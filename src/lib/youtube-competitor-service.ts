import { parseDurationToSeconds } from "@/lib/youtube-format";
import type { CompetitorChannelIdentity, CompetitorChannelReference, CompetitorVideoSource } from "@/types/competitor";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const CACHE_SECONDS = 15 * 60;

type ApiErrorPayload = {
  error?: {
    errors?: Array<{ reason?: string }>;
    status?: string;
  };
};

type ThumbnailSet = Record<string, { url?: string }>;

type ChannelItem = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    country?: string;
    customUrl?: string;
    thumbnails?: ThumbnailSet;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  statistics?: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    viewCount?: string;
    videoCount?: string;
  };
};

type ChannelsResponse = { items?: ChannelItem[] };
type SearchResponse = { items?: Array<{ id?: { channelId?: string } }> };
type PlaylistItemsResponse = { items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { resourceId?: { videoId?: string } } }> };
type VideosResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      tags?: string[];
      thumbnails?: ThumbnailSet;
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
};

export class CompetitorApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function validHandle(value: string): boolean {
  return /^@[\p{L}\p{N}._-]{3,30}$/u.test(value);
}

function validAlias(value: string): boolean {
  return /^[\p{L}\p{N}._-]{1,100}$/u.test(value);
}

export function parseCompetitorReference(raw: string): CompetitorChannelReference | null {
  const input = raw.trim();
  if (!input || input.length > 1000) return null;
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) return { kind: "id", value: input };
  if (validHandle(input)) return { kind: "handle", value: input };

  let url: URL;
  try {
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    url = new URL(normalized);
  } catch {
    return null;
  }
  if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
  let segments: string[];
  try {
    segments = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
  if (!segments.length) return null;
  if (validHandle(segments[0])) return { kind: "handle", value: segments[0] };
  if (segments[0] === "channel" && segments[1] && /^UC[a-zA-Z0-9_-]{22}$/.test(segments[1])) {
    return { kind: "id", value: segments[1] };
  }
  if (segments[0] === "user" && segments[1] && validAlias(segments[1])) {
    return { kind: "username", value: segments[1] };
  }
  if (segments[0] === "c" && segments[1] && validAlias(segments[1])) {
    return { kind: "custom", value: segments[1] };
  }
  return null;
}

function count(value: string | undefined): number | null {
  if (value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function bestThumbnail(thumbnails: ThumbnailSet | undefined): string | null {
  if (!thumbnails) return null;
  for (const size of ["maxres", "standard", "high", "medium", "default"]) {
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
    response = await fetch(`${YOUTUBE_API_BASE}/${endpoint}?${requestParams.toString()}`, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new CompetitorApiError("NETWORK_ERROR", 502, "No se pudo conectar con YouTube. Comprueba la conexión e inténtalo de nuevo.");
  }
  const payload = await response.json().catch(() => ({})) as T & ApiErrorPayload;
  if (!response.ok) {
    const reason = payload.error?.errors?.[0]?.reason ?? payload.error?.status ?? "youtubeError";
    if (["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded", "resourceExhausted"].includes(reason)) {
      throw new CompetitorApiError("QUOTA_EXCEEDED", 429, "La cuota de YouTube Data API está agotada o limitada. Inténtalo más tarde.");
    }
    if (["keyInvalid", "API_KEY_INVALID", "invalidKey"].includes(reason) || response.status === 401) {
      throw new CompetitorApiError("INVALID_API_KEY", 503, "La clave de YouTube Data API no está configurada correctamente.");
    }
    if (["accessNotConfigured", "SERVICE_DISABLED", "youtubeSignupRequired"].includes(reason)) {
      throw new CompetitorApiError("API_NOT_ENABLED", 503, "YouTube Data API v3 no está habilitada para el proyecto asociado a esta clave.");
    }
    throw new CompetitorApiError("YOUTUBE_ERROR", 502, "YouTube no pudo completar el análisis. Inténtalo de nuevo en unos momentos.");
  }
  return payload;
}

async function fetchChannels(params: URLSearchParams, apiKey: string): Promise<ChannelItem[]> {
  const response = await youtubeGet<ChannelsResponse>("channels", params, apiKey);
  return response.items ?? [];
}

async function resolveChannel(reference: CompetitorChannelReference, apiKey: string): Promise<{ channel: ChannelItem; usedSearchFallback: boolean }> {
  if (reference.kind !== "custom") {
    const params = new URLSearchParams({ part: "snippet,statistics,contentDetails" });
    if (reference.kind === "id") params.set("id", reference.value);
    if (reference.kind === "handle") params.set("forHandle", reference.value);
    if (reference.kind === "username") params.set("forUsername", reference.value);
    const channel = (await fetchChannels(params, apiKey))[0];
    if (!channel) throw new CompetitorApiError("CHANNEL_NOT_FOUND", 404, "No se encontró un canal con ese enlace, @handle o channel ID.");
    return { channel, usedSearchFallback: false };
  }

  // Legacy /c/ URLs have no direct channels.list parameter. This one-off fallback costs 100 units.
  const search = await youtubeGet<SearchResponse>("search", new URLSearchParams({
    part: "snippet",
    type: "channel",
    q: reference.value,
    maxResults: "10",
  }), apiKey);
  const ids = [...new Set((search.items ?? []).map((item) => item.id?.channelId).filter((id): id is string => Boolean(id)))];
  if (!ids.length) throw new CompetitorApiError("CHANNEL_NOT_FOUND", 404, "No se encontró el canal asociado a esa URL antigua. Prueba con su @handle o channel ID.");
  const candidates = await fetchChannels(new URLSearchParams({ part: "snippet,statistics,contentDetails", id: ids.join(",") }), apiKey);
  const wanted = reference.value.toLocaleLowerCase("es");
  const channel = candidates.find((item) => {
    const customUrl = item.snippet?.customUrl?.replace(/^@/, "").replace(/^\//, "").toLocaleLowerCase("es");
    return customUrl === wanted;
  });
  if (!channel) throw new CompetitorApiError("CHANNEL_NOT_FOUND", 404, "YouTube no pudo confirmar esa URL antigua. Prueba con el @handle o channel ID del canal.");
  return { channel, usedSearchFallback: true };
}

export async function loadCompetitorData(reference: CompetitorChannelReference, apiKey: string): Promise<{
  channel: CompetitorChannelIdentity;
  videos: CompetitorVideoSource[];
  quotaWarnings: string[];
}> {
  const { channel: apiChannel, usedSearchFallback } = await resolveChannel(reference, apiKey);
  const uploadsPlaylistId = apiChannel.contentDetails?.relatedPlaylists?.uploads;
  let apiVideos: VideosResponse["items"] = [];
  if (uploadsPlaylistId) {
    const playlist = await youtubeGet<PlaylistItemsResponse>("playlistItems", new URLSearchParams({
      part: "contentDetails,snippet",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    }), apiKey);
    const videoIds = [...new Set((playlist.items ?? [])
      .map((item) => item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId)
      .filter((id): id is string => Boolean(id)))].slice(0, 50);
    if (videoIds.length) {
      const response = await youtubeGet<VideosResponse>("videos", new URLSearchParams({
        part: "snippet,contentDetails,statistics",
        id: videoIds.join(","),
      }), apiKey);
      const rank = new Map(videoIds.map((id, index) => [id, index]));
      apiVideos = (response.items ?? []).sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
    }
  }
  const channelId = apiChannel.id;
  const stats = apiChannel.statistics;
  const customUrl = apiChannel.snippet?.customUrl ?? "";
  const handle = customUrl.startsWith("@") ? customUrl : reference.kind === "handle" ? reference.value : null;
  const channel: CompetitorChannelIdentity = {
    id: channelId,
    name: apiChannel.snippet?.title ?? "Canal sin nombre",
    handle,
    description: (apiChannel.snippet?.description ?? "").slice(0, 1500),
    createdAt: apiChannel.snippet?.publishedAt ?? null,
    country: apiChannel.snippet?.country ?? null,
    subscribers: stats?.hiddenSubscriberCount === true ? null : count(stats?.subscriberCount),
    totalViews: count(stats?.viewCount),
    totalVideoCount: count(stats?.videoCount),
    avatar: bestThumbnail(apiChannel.snippet?.thumbnails),
    url: `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`,
  };
  const videos: CompetitorVideoSource[] = (apiVideos ?? []).map((video) => ({
    id: video.id,
    title: video.snippet?.title ?? "Video sin título",
    description: (video.snippet?.description ?? "").slice(0, 5000),
    publishedAt: video.snippet?.publishedAt ?? "",
    durationSeconds: parseDurationToSeconds(video.contentDetails?.duration),
    views: count(video.statistics?.viewCount),
    likes: count(video.statistics?.likeCount),
    comments: count(video.statistics?.commentCount),
    thumbnail: bestThumbnail(video.snippet?.thumbnails),
    youtubeTags: video.snippet?.tags === undefined ? null : video.snippet.tags,
  }));
  return {
    channel,
    videos,
    quotaWarnings: usedSearchFallback ? ["La URL antigua /c/ requirió una búsqueda de canal (100 unidades de cuota); las búsquedas por @handle o channel ID evitan ese coste."] : [],
  };
}
