import type {
  CadenceAnalysis,
  CompetitorChannelIdentity,
  CompetitorReport,
  CompetitorVideo,
  CompetitorVideoSource,
  KeywordCategory,
  KeywordInsight,
  KeywordSource,
  TitlePatternAnalysis,
  TitlePhrase,
  TopicCluster,
  ViewConcentration,
} from "@/types/competitor";

const STOP_WORDS = new Set((
  "a about above after again against all am an and any are as at be because been before being below " +
  "between both but by can could did do does doing down during each few for from further had has have " +
  "having he her here hers herself him himself his how i if in into is it its itself just me more most " +
  "my myself no nor not of off on once only or other our ours ourselves out over own same she should so " +
  "some such than that the their theirs them themselves then there these they this those through to too " +
  "under until up very was we were what when where which while who whom why will with would you your " +
  "yours yourself yourselves al algo algunos ante bajo cada como con contra cual cuando de del desde " +
  "donde durante e el ella ellas ellos en entre era es esa esas ese eso esos esta estaba estaban estas " +
  "este esto estos fue fueron ha hacia hasta hay la las le les lo los más mas me mi mis misma mismo " +
  "muy ni no nos nosotros nuestra nuestras nuestro nuestros o os otra otras otro otros para pero por " +
  "porque que quien se sea según si sin sobre son su sus te también tan tanto tu tus un una unas uno " +
  "unos usted ustedes y ya"
).split(/\s+/));

const INTENT_TERMS = ["how to", "how", "como", "cómo", "learn", "aprender", "tutorial", "sleep", "dormir", "pray", "orar", "oracion", "oración", "relax", "relajar", "discover", "descubrir", "review", "comparar", "compare", "make", "hacer", "solve", "resolver", "why", "por que", "por qué"];
const PAIN_TERMS = ["anxiety", "ansiedad", "fear", "miedo", "debt", "deuda", "loneliness", "soledad", "insomnia", "insomnio", "stress", "estres", "estrés", "pain", "dolor", "problem", "problema", "worry", "preocupacion", "preocupación"];
const BENEFIT_TERMS = ["peace", "paz", "protection", "proteccion", "protección", "rest", "descanso", "money", "dinero", "wealth", "riqueza", "health", "salud", "calm", "calma", "success", "exito", "éxito", "clarity", "claridad", "healing", "sanacion", "sanación"];
const CONTEXT_TERMS = ["night", "noche", "home", "hogar", "family", "familia", "before", "antes", "after", "despues", "después", "morning", "manana", "mañana", "work", "trabajo", "today", "hoy", "week", "semana"];
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const GENERIC_TITLE_FORMULAS: Array<{ label: string; pattern: RegExp }> = [
  { label: "[Tema] + para/for + [resultado o contexto]", pattern: /\b(para|for)\b/i },
  { label: "[Tema] + sin/without + [elemento]", pattern: /\b(sin|without)\b/i },
  { label: "[Tema] + antes de/before + [contexto]", pattern: /\b(antes de|before)\b/i },
  { label: "Cómo/how to + [acción]", pattern: /\b(cómo|como|how to)\b/i },
  { label: "Qué pasa si/what happens if + [situación]", pattern: /\b(qué pasa si|que pasa si|what happens if)\b/i },
  { label: "[Elemento] vs [elemento]", pattern: /\b(vs\.?|versus)\b/i },
];

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("es");
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return usable.length ? round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : null;
}

function median(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return round(usable.length % 2 ? usable[middle] : (usable[middle - 1] + usable[middle]) / 2);
}

function ratio(value: number | null, base: number | null): number | null {
  return value !== null && base !== null && base > 0 ? round(value / base) : null;
}

function parsedDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function tokenize(text: string): string[] {
  return (normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => !STOP_WORDS.has(word) && (word.length > 2 || /^\d{2,}$/.test(word)));
}

function isKeywordToken(word: string): boolean {
  return !STOP_WORDS.has(word) && (word.length > 2 || /^\d{2,}$/.test(word));
}

function isEntityPhrase(value: string): boolean {
  const pattern = /(?<![\p{L}\p{N}])[A-ZÁÉÍÓÚÜÑ][\p{L}\p{N}'’.-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}\p{N}'’.-]+){0,2}/gu;
  for (const match of value.matchAll(pattern)) {
    const phrase = match[0].trim();
    const start = match.index ?? 0;
    if (start > 0 && tokenize(phrase).length > 0) return true;
  }
  return false;
}

function classifyTerm(term: string, entities: Set<string>): KeywordCategory {
  const clean = normalize(term);
  if (entities.has(clean)) return "ENTIDAD";
  if (INTENT_TERMS.some((item) => clean.includes(normalize(item)))) return "INTENCIÓN";
  if (PAIN_TERMS.some((item) => clean.includes(normalize(item)))) return "DOLOR";
  if (BENEFIT_TERMS.some((item) => clean.includes(normalize(item)))) return "BENEFICIO";
  if (CONTEXT_TERMS.some((item) => clean.includes(normalize(item)))) return "CONTEXTO";
  return "TEMA";
}

type TermRecord = {
  occurrenceCount: number;
  sources: Set<KeywordSource>;
  perVideo: Map<string, number>;
};

type AnalyzedVideo = CompetitorVideo & { description: string };

function collectTermRecords(videos: CompetitorVideoSource[]): { records: Map<string, TermRecord>; entities: Set<string> } {
  const records = new Map<string, TermRecord>();
  const entities = new Set<string>();

  for (const video of videos) {
    const entityText = `${video.title}\n${video.description.slice(0, 5000)}`;
    if (isEntityPhrase(entityText)) {
      const pattern = /(?<![\p{L}\p{N}])[A-ZÁÉÍÓÚÜÑ][\p{L}\p{N}'’.-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}\p{N}'’.-]+){0,2}/gu;
      for (const match of entityText.matchAll(pattern)) {
        const start = match.index ?? 0;
        if (start > 0 && !/[.!?\n]\s*$/.test(entityText.slice(0, start))) entities.add(normalize(match[0].trim()));
      }
    }
    const sources: Array<{ source: KeywordSource; text: string }> = [
      { source: "título", text: video.title },
      { source: "descripción", text: video.description.slice(0, 5000) },
      ...(video.youtubeTags ?? []).map((tag) => ({ source: "tag_real_youtube" as const, text: tag })),
    ];
    for (const { source, text } of sources) {
      const rawWords = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
      const words = rawWords.filter(isKeywordToken);
      const terms = [...words];
      for (let index = 0; index < rawWords.length - 1; index += 1) {
        if (isKeywordToken(rawWords[index]) && isKeywordToken(rawWords[index + 1])) {
          terms.push(`${rawWords[index]} ${rawWords[index + 1]}`);
        }
      }
      for (const term of terms) {
        const record = records.get(term) ?? { occurrenceCount: 0, sources: new Set<KeywordSource>(), perVideo: new Map<string, number>() };
        record.occurrenceCount += 1;
        record.sources.add(source);
        record.perVideo.set(video.id, (record.perVideo.get(video.id) ?? 0) + 1);
        records.set(term, record);
      }
    }
  }
  return { records, entities };
}

function titlePhrases(videos: CompetitorVideoSource[], edge: "first" | "last"): TitlePhrase[] {
  const phrases = new Map<string, { count: number; examples: string[] }>();
  for (const video of videos) {
    const words = normalize(video.title).match(/[\p{L}\p{N}]+/gu) ?? [];
    if (words.length < 2) continue;
    const phrase = edge === "first" ? words.slice(0, 2).join(" ") : words.slice(-2).join(" ");
    const existing = phrases.get(phrase) ?? { count: 0, examples: [] };
    existing.count += 1;
    if (existing.examples.length < 3) existing.examples.push(video.title);
    phrases.set(phrase, existing);
  }
  return [...phrases.entries()]
    .filter(([, item]) => item.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([phrase, item]) => ({ phrase, count: item.count, examples: item.examples }));
}

function formulaTitlePatterns(videos: CompetitorVideoSource[]): TitlePhrase[] {
  return GENERIC_TITLE_FORMULAS.map(({ label, pattern }) => {
    const matching = videos.filter((video) => pattern.test(video.title));
    return { phrase: label, count: matching.length, examples: matching.slice(0, 3).map((video) => video.title) };
  }).filter((item) => item.count >= 2).sort((a, b) => b.count - a.count);
}

function analyzeTitlePatterns(videos: CompetitorVideoSource[]): TitlePatternAnalysis {
  if (!videos.length) {
    return { averageCharacters: null, averageWords: null, titlesWithNumbersPercent: null, titlesWithUppercasePercent: null, titlesWithPunctuationPercent: null, frequentTitleTerms: [], recurringOpeners: [], recurringEndings: [], formulaPatterns: [] };
  }
  const titleTokenCounts = new Map<string, number>();
  let numberCount = 0;
  let uppercaseCount = 0;
  let punctuationCount = 0;
  for (const video of videos) {
    if (/\p{N}/u.test(video.title)) numberCount += 1;
    const letters = video.title.match(/\p{L}/gu) ?? [];
    const uppercase = video.title.match(/\p{Lu}/gu) ?? [];
    if (letters.length && uppercase.length / letters.length >= 0.25) uppercaseCount += 1;
    if (/[?!¡¿:—–|]/u.test(video.title)) punctuationCount += 1;
    for (const word of tokenize(video.title)) titleTokenCounts.set(word, (titleTokenCounts.get(word) ?? 0) + 1);
  }
  return {
    averageCharacters: average(videos.map((video) => video.title.length)),
    averageWords: average(videos.map((video) => tokenize(video.title).length)),
    titlesWithNumbersPercent: round(numberCount / videos.length * 100),
    titlesWithUppercasePercent: round(uppercaseCount / videos.length * 100),
    titlesWithPunctuationPercent: round(punctuationCount / videos.length * 100),
    frequentTitleTerms: [...titleTokenCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([term]) => term),
    recurringOpeners: titlePhrases(videos, "first"),
    recurringEndings: titlePhrases(videos, "last"),
    formulaPatterns: formulaTitlePatterns(videos),
  };
}

function buildKeywordInsights(
  videos: AnalyzedVideo[],
  records: Map<string, TermRecord>,
  entities: Set<string>,
  winnerIds: Set<string>,
): KeywordInsight[] {
  const totalCount = videos.length;
  const winnerCount = winnerIds.size;
  const videosById = new Map(videos.map((video) => [video.id, video]));
  const insights: KeywordInsight[] = [];
  for (const [term, record] of records) {
    const videoIds = [...record.perVideo.keys()];
    const matchingVideos = videoIds.map((id) => videosById.get(id)).filter((video): video is AnalyzedVideo => video !== undefined);
    const winnerFrequency = videoIds.filter((id) => winnerIds.has(id)).length;
    const baselineShare = totalCount ? round(videoIds.length / totalCount, 3) : null;
    const winnerShare = winnerCount ? round(winnerFrequency / winnerCount, 3) : null;
    const winnerLift = baselineShare && winnerShare !== null ? round(winnerShare / baselineShare) : null;
    insights.push({
      term,
      category: classifyTerm(term, entities),
      videoFrequency: videoIds.length,
      winnerFrequency,
      baselineShare,
      winnerShare,
      winnerLift,
      occurrences: record.occurrenceCount,
      sources: [...record.sources],
      videoIds,
      exampleTitles: matchingVideos.slice(0, 5).map((video) => video.title),
      averageViews: average(matchingVideos.map((video) => video.views)),
      averageViewsToSubscribers: average(matchingVideos.map((video) => video.metrics.viewsToSubscribers)),
      averageViewsVsMedian: average(matchingVideos.map((video) => video.metrics.viewsVsMedian)),
    });
  }
  return insights;
}

function makeConcentration(videos: AnalyzedVideo[]): ViewConcentration {
  const ranked = videos.filter((video) => video.views !== null).sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const total = ranked.reduce((sum, video) => sum + (video.views ?? 0), 0);
  const share = (count: number): number | null => total > 0 ? round(ranked.slice(0, count).reduce((sum, video) => sum + (video.views ?? 0), 0) / total * 100) : null;
  return { sampleViews: ranked.length ? total : null, top3Percent: share(3), top5Percent: share(5), top10Percent: share(10) };
}

function makeCadence(videos: AnalyzedVideo[], winners: AnalyzedVideo[], now: number): CadenceAnalysis {
  const dates = videos.map((video) => parsedDate(video.publishedAt)).filter((date): date is number => date !== null).sort((a, b) => a - b);
  const spanDays = dates.length >= 2 ? (dates[dates.length - 1] - dates[0]) / 86_400_000 : 0;
  const averageIntervalDays = dates.length >= 2 ? round(spanDays / (dates.length - 1)) : null;
  const counts = new Map<number, number>();
  for (const date of dates) {
    const day = new Date(date).getUTCDay();
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return {
    videosPerWeek: spanDays > 0 ? round((dates.length - 1) / spanDays * 7) : null,
    averageIntervalDays,
    videosLast30Days: dates.filter((date) => now - date <= 30 * 86_400_000 && now >= date).length,
    averageDurationMinutes: average(videos.map((video) => video.metrics.durationMinutes)),
    winnersAverageDurationMinutes: average(winners.map((video) => video.metrics.durationMinutes)),
    byWeekday: WEEKDAYS.map((weekday, day) => ({ weekday, count: counts.get(day) ?? 0 })),
  };
}

function makeTopicClusters(videos: AnalyzedVideo[]): TopicCluster[] {
  const topics = new Map<string, CompetitorVideo[]>();
  for (const video of videos) {
    const list = topics.get(video.topicCluster) ?? [];
    list.push(video);
    topics.set(video.topicCluster, list);
  }
  return [...topics.entries()]
    .map(([topic, items]) => ({
      topic,
      videoCount: items.length,
      averageViews: average(items.map((video) => video.views)),
      averageViewsToSubscribers: average(items.map((video) => video.metrics.viewsToSubscribers)),
      averageViewsVsMedian: average(items.map((video) => video.metrics.viewsVsMedian)),
    }))
    .sort((a, b) => b.videoCount - a.videoCount || (b.averageViews ?? -1) - (a.averageViews ?? -1))
    .slice(0, 12);
}

function makeFingerprint(
  videos: AnalyzedVideo[],
  winners: AnalyzedVideo[],
  keywords: KeywordInsight[],
  winnerKeywords: KeywordInsight[],
  patterns: TitlePatternAnalysis,
  clusters: TopicCluster[],
  cadence: CadenceAnalysis,
  concentration: ViewConcentration,
): CompetitorReport["fingerprint"] {
  const percent = (value: number | null) => value === null ? "No disponible" : `${value}% de vistas de la muestra`;
  return {
    whatItPublishes: clusters.slice(0, 5).map((cluster) => `${cluster.topic} (${cluster.videoCount} videos)`),
    whatWorks: winners.slice(0, 5).map((video) => `${video.title} · ${video.winnerSignals.join("; ")}`),
    whatItRepeats: [...patterns.recurringOpeners.map((item) => `Inicio «${item.phrase}» (${item.count})`), ...patterns.recurringEndings.map((item) => `Cierre «${item.phrase}» (${item.count})`)].slice(0, 8),
    commonWords: keywords.slice(0, 8).map((item) => item.term),
    winnerWords: winnerKeywords.slice(0, 8).map((item) => `${item.term} (${item.winnerFrequency} winners)`),
    titleStructures: [...patterns.formulaPatterns.map((item) => `${item.phrase} (${item.count} títulos)`), ...patterns.recurringOpeners.map((item) => `«${item.phrase}» + [resto del título]`), ...patterns.recurringEndings.map((item) => `[inicio del título] + «${item.phrase}»`)].slice(0, 8),
    durations: [
      cadence.averageDurationMinutes === null ? "Duración media: no disponible" : `Duración media de la muestra: ${cadence.averageDurationMinutes} min`,
      cadence.winnersAverageDurationMinutes === null ? "Duración media de winners: no disponible" : `Duración media de winners: ${cadence.winnersAverageDurationMinutes} min`,
    ],
    cadence: [
      cadence.videosPerWeek === null ? "Frecuencia semanal: no disponible" : `≈${cadence.videosPerWeek} videos por semana en la muestra`,
      `Videos publicados en los últimos 30 días: ${cadence.videosLast30Days}`,
    ],
    successConcentration: [`Top 3: ${percent(concentration.top3Percent)}`, `Top 5: ${percent(concentration.top5Percent)}`, `Top 10: ${percent(concentration.top10Percent)}`],
  };
}

export function analyzeCompetitor(
  channel: CompetitorChannelIdentity,
  sourceVideos: CompetitorVideoSource[],
  now = new Date(),
): CompetitorReport {
  const nowMs = now.getTime();
  const views = sourceVideos.map((video) => video.views);
  const sampleAverage = average(views);
  const sampleMedian = median(views);
  const medianDailyViews = median(sourceVideos.map((video) => {
    const published = parsedDate(video.publishedAt);
    const ageDays = published === null ? null : Math.max(1, Math.floor((nowMs - published) / 86_400_000));
    return video.views === null || ageDays === null ? null : video.views / ageDays;
  }));
  const preliminary = sourceVideos.map((video): AnalyzedVideo => {
    const published = parsedDate(video.publishedAt);
    const ageDays = published === null ? null : Math.max(1, Math.floor((nowMs - published) / 86_400_000));
    const viewsPerDay = video.views === null || ageDays === null ? null : round(video.views / ageDays);
    const durationMinutes = video.durationSeconds === null ? null : round(video.durationSeconds / 60, 1);
    const signals: string[] = [];
    const viewsVsMedian = ratio(video.views, sampleMedian);
    const viewsToSubscribers = ratio(video.views, channel.subscribers);
    if (viewsVsMedian !== null && viewsVsMedian >= 2) signals.push("≥2x la mediana de la muestra");
    if (viewsToSubscribers !== null && viewsToSubscribers >= 2) signals.push("≥2x los suscriptores actuales");
    if (viewsPerDay !== null && medianDailyViews !== null && medianDailyViews > 0 && viewsPerDay >= medianDailyViews * 2) signals.push("≥2x la mediana de vistas/día");
    return {
      ...video,
      videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
      metrics: {
        viewsToSubscribers,
        viewsVsMedian,
        viewsVsAverage: ratio(video.views, sampleAverage),
        viewsPerDay,
        ageDays,
        durationMinutes,
      },
      isWinner: signals.length > 0,
      winnerSignals: signals,
      topicCluster: "Sin tema dominante",
    };
  });
  const winnerIds = new Set(preliminary.filter((video) => video.isWinner).map((video) => video.id));
  const { records, entities } = collectTermRecords(sourceVideos);
  const allInsights = buildKeywordInsights(preliminary, records, entities, winnerIds);
  const titleTermSet = new Set(analyzeTitlePatterns(sourceVideos).frequentTitleTerms);
  const keywords = allInsights
    .filter((item) => item.videoFrequency >= 2)
    .sort((a, b) => b.videoFrequency - a.videoFrequency || a.term.localeCompare(b.term))
    .slice(0, 30);
  const winnerKeywords = allInsights
    .filter((item) => item.winnerFrequency > 0)
    .sort((a, b) => (b.winnerLift ?? 0) - (a.winnerLift ?? 0) || b.winnerFrequency - a.winnerFrequency || a.term.localeCompare(b.term))
    .slice(0, 30);
  const topicCandidates = allInsights.filter((item) => item.category === "TEMA" && item.sources.includes("título"));
  const videos = preliminary.map((video) => {
    const candidates = topicCandidates.filter((item) => item.videoIds.includes(video.id));
    candidates.sort((a, b) => b.videoFrequency - a.videoFrequency || b.term.length - a.term.length);
    const fallbackTitleTerm = tokenize(video.title).find((term) => titleTermSet.has(term));
    return { ...video, topicCluster: candidates[0]?.term ?? fallbackTitleTerm ?? "Tema sin clasificar" };
  });
  const winners = videos.filter((video) => video.isWinner).sort((a, b) => (b.metrics.viewsVsMedian ?? -1) - (a.metrics.viewsVsMedian ?? -1));
  const patterns = analyzeTitlePatterns(sourceVideos);
  const clusters = makeTopicClusters(videos);
  const cadence = makeCadence(videos, winners, nowMs);
  const concentration = makeConcentration(videos);
  const dates = videos.map((video) => ({ value: video.publishedAt, time: parsedDate(video.publishedAt) })).filter((item) => item.time !== null).sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  const createdAt = parsedDate(channel.createdAt);
  const channelAgeDays = createdAt === null ? null : Math.max(0, Math.floor((nowMs - createdAt) / 86_400_000));
  const channelAgeLabel = channelAgeDays === null ? null : channelAgeDays >= 365
    ? `≈${round(channelAgeDays / 365, 1)} años`
    : channelAgeDays < 30
      ? "menos de 1 mes"
      : `≈${Math.round(channelAgeDays / 30)} meses`;
  const warningList: string[] = [];
  if (channel.subscribers === null) warningList.push("El canal oculta el número de suscriptores; Vistas/Subs no está disponible.");
  if (!videos.length) warningList.push("No se encontraron videos públicos en la muestra consultada.");
  if (videos.some((video) => video.youtubeTags === null)) warningList.push("YouTube no devolvió tags en algunos videos. Las keywords inferidas se calculan por separado.");
  if (videos.length < 10) warningList.push("La muestra tiene menos de 10 videos; interpreta los promedios con cautela.");
  const fullFingerprint = makeFingerprint(videos, winners, keywords, winnerKeywords, patterns, clusters, cadence, concentration);
  const publicVideos: CompetitorVideo[] = videos.map(({ description: _description, ...video }) => video);
  const publicWinners: CompetitorVideo[] = winners.map(({ description: _description, ...video }) => video);
  return {
    channel,
    channelMetrics: { ageDays: channelAgeDays, ageLabel: channelAgeLabel },
    sample: {
      requested: 50,
      analyzed: videos.length,
      videosWithViews: views.filter((value) => value !== null).length,
      firstPublishedAt: dates[0]?.value ?? null,
      lastPublishedAt: dates[dates.length - 1]?.value ?? null,
      averageViews: sampleAverage,
      medianViews: sampleMedian,
    },
    videos: publicVideos,
    winners: publicWinners,
    keywords,
    winnerKeywords,
    titlePatterns: patterns,
    topicClusters: clusters,
    cadence,
    concentration,
    fingerprint: fullFingerprint,
    warnings: warningList,
  };
}
