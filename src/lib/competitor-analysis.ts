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
  sourceVideoIds: Map<KeywordSource, Set<string>>;
};

type AnalyzedVideo = CompetitorVideo & { description: string };

const DESCRIPTION_BOILERPLATE = /\b(suscr[ií]bete|suscribirse|subscribe|subscription|activa la campana|notification bell|like y comparte|like and subscribe|aviso profesional|disclaimer|no sustituye|not a substitute|consulta a un profesional|consult (a|your) professional|gracias por ver|thanks for watching)\b/i;
const GENERIC_TOPIC_WORDS = new Set("dia día noche night day video videos canal channel oración oracion prayer prayers".split(/\s+/));

function isNumericToken(value: string): boolean {
  return /^\p{N}+$/u.test(value);
}

function addTerm(records: Map<string, TermRecord>, term: string, source: KeywordSource, videoId: string, occurrences = 1): void {
  const clean = normalize(term).trim();
  if (!clean || !clean.split(/\s+/).some((word) => /\p{L}/u.test(word))) return;
  const record = records.get(clean) ?? { occurrenceCount: 0, sourceVideoIds: new Map() };
  const videoIds = record.sourceVideoIds.get(source) ?? new Set<string>();
  videoIds.add(videoId);
  record.sourceVideoIds.set(source, videoIds);
  record.occurrenceCount += occurrences;
  records.set(clean, record);
}

/** Extract words and title phrases while retaining useful internal stop words (e.g. "sleep in peace"). */
function extractPhrases(text: string): string[] {
  const words = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  const numericEntities = new Set([...text.matchAll(/\p{Lu}[\p{L}\p{M}'’.-]*\s+\p{N}{1,4}/gu)].map((match) => normalize(match[0])));
  const terms = new Set<string>();
  for (let start = 0; start < words.length; start += 1) {
    for (let end = start; end < Math.min(words.length, start + 3); end += 1) {
      const raw = words.slice(start, end + 1);
      while (raw.length && STOP_WORDS.has(raw[0])) raw.shift();
      while (raw.length && STOP_WORDS.has(raw[raw.length - 1])) raw.pop();
      if (!raw.length) continue;
      const contentWords = raw.filter((word) => !STOP_WORDS.has(word));
      if (contentWords.length > 3) continue;
      if (raw.length === 1) {
        const [word] = raw;
        if (!isNumericToken(word) && (word.length > 2 || /^\p{L}\p{N}+$/u.test(word))) terms.add(word);
        continue;
      }
      const phrase = raw.join(" ");
      const containsNumber = raw.some(isNumericToken);
      const hasNumericEntity = [...numericEntities].some((entity) => phrase.includes(entity));
      if (contentWords.length >= 2 && raw.some((word) => /\p{L}/u.test(word)) && (!containsNumber || hasNumericEntity)) terms.add(phrase);
    }
  }
  return [...terms];
}

function cleanDescription(description: string): string {
  return description.slice(0, 5000)
    .split(/\r?\n|(?<=[.!?])\s+/u)
    .map((block) => block.replace(/https?:\/\/\S+|www\.\S+/giu, " ").replace(/#[\p{L}\p{N}_-]+/gu, " ").replace(/\s+/g, " ").trim())
    .filter((block) => block && !DESCRIPTION_BOILERPLATE.test(block))
    .join("\n\n");
}

function collectDescriptionTerms(videos: CompetitorVideoSource[]): Map<string, TermRecord> {
  const blocksByVideo = videos.map((video) => cleanDescription(video.description).split(/\r?\n+/).filter(Boolean));
  const blockFrequency = new Map<string, number>();
  for (const blocks of blocksByVideo) {
    for (const block of new Set(blocks)) {
      const signature = normalize(block).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      if (signature.length >= 24) blockFrequency.set(signature, (blockFrequency.get(signature) ?? 0) + 1);
    }
  }
  const boilerplateThreshold = Math.max(2, Math.ceil(videos.length * 0.6));
  const records = new Map<string, TermRecord>();
  videos.forEach((video, index) => {
    const usefulText = blocksByVideo[index].filter((block) => {
      const signature = normalize(block).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      return (blockFrequency.get(signature) ?? 0) < boilerplateThreshold;
    }).join(" ");
    for (const term of extractPhrases(usefulText)) addTerm(records, term, "descripción", video.id);
  });
  return records;
}

function collectSourceTerms(videos: CompetitorVideoSource[], source: "título" | "tag_real_youtube"): Map<string, TermRecord> {
  const records = new Map<string, TermRecord>();
  for (const video of videos) {
    if (source === "título") {
      for (const term of extractPhrases(video.title)) addTerm(records, term, source, video.id);
      continue;
    }
    for (const tag of video.youtubeTags ?? []) {
      // Keep each official tag as YouTube returned it; do not merge it with descriptive text.
      addTerm(records, tag, source, video.id);
    }
  }
  return records;
}

function mergeTermRecords(...sources: Map<string, TermRecord>[]): Map<string, TermRecord> {
  const merged = new Map<string, TermRecord>();
  for (const sourceRecords of sources) {
    for (const [term, sourceRecord] of sourceRecords) {
      const target = merged.get(term) ?? { occurrenceCount: 0, sourceVideoIds: new Map() };
      target.occurrenceCount += sourceRecord.occurrenceCount;
      for (const [source, ids] of sourceRecord.sourceVideoIds) {
        const targetIds = target.sourceVideoIds.get(source) ?? new Set<string>();
        for (const id of ids) targetIds.add(id);
        target.sourceVideoIds.set(source, targetIds);
      }
      merged.set(term, target);
    }
  }
  return merged;
}

function titleEntities(videos: CompetitorVideoSource[]): Set<string> {
  const entities = new Set<string>();
  const pattern = /(?<![\p{L}\p{N}])[A-ZÁÉÍÓÚÜÑ][\p{L}\p{N}'’.-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][\p{L}\p{N}'’.-]+){0,2}/gu;
  for (const video of videos) {
    for (const match of video.title.matchAll(pattern)) {
      const start = match.index ?? 0;
      if (start > 0 && !/[.!?]\s*$/.test(video.title.slice(0, start))) entities.add(normalize(match[0].trim()));
    }
  }
  return entities;
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
    const videoIds = [...new Set([...record.sourceVideoIds.values()].flatMap((ids) => [...ids]))];
    const matchingVideos = videoIds.map((id) => videosById.get(id)).filter((video): video is AnalyzedVideo => video !== undefined);
    const winnerFrequency = videoIds.filter((id) => winnerIds.has(id)).length;
    const baselineShare = totalCount ? round(videoIds.length / totalCount, 3) : null;
    const winnerShare = winnerCount ? round(winnerFrequency / winnerCount, 3) : null;
    const winnerLift = baselineShare && winnerShare !== null ? round(winnerShare / baselineShare) : null;
    const titleFrequency = record.sourceVideoIds.get("título")?.size ?? 0;
    const descriptionFrequency = record.sourceVideoIds.get("descripción")?.size ?? 0;
    const tagFrequency = record.sourceVideoIds.get("tag_real_youtube")?.size ?? 0;
    insights.push({
      term,
      category: classifyTerm(term, entities),
      videoFrequency: videoIds.length,
      winnerFrequency,
      baselineShare,
      winnerShare,
      winnerLift,
      occurrences: record.occurrenceCount,
      titleFrequency,
      descriptionFrequency,
      tagFrequency,
      sources: [...record.sourceVideoIds.keys()],
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

function topicWordCount(term: string): number {
  return term.split(/\s+/).filter((word) => !STOP_WORDS.has(word) && /[\p{L}\p{N}]/u.test(word)).length;
}

function isNamedNumberTopic(term: string): boolean {
  const [name, number] = term.split(/\s+/);
  return Boolean(name && number && !GENERIC_TOPIC_WORDS.has(name) && /\p{L}/u.test(name) && isNumericToken(number));
}

function assignTopics(videos: AnalyzedVideo[]): AnalyzedVideo[] {
  const frequencies = new Map<string, number>();
  const perVideo = new Map<string, Set<string>>();
  for (const video of videos) {
    const terms = new Set(extractPhrases(video.title).filter((term) => {
      const content = term.split(/\s+/).filter((word) => !STOP_WORDS.has(word));
      const lexical = content.filter((word) => /\p{L}/u.test(word));
      const supportedPhrase = lexical.length >= 2 || (lexical.length === 1 && content.some(isNumericToken) && !GENERIC_TOPIC_WORDS.has(lexical[0]));
      const genericNumberLabel = content.some(isNumericToken) && GENERIC_TOPIC_WORDS.has(lexical[0]);
      return supportedPhrase && !isNumericToken(content[0]) && !genericNumberLabel && !lexical.every((word) => GENERIC_TOPIC_WORDS.has(word));
    }));
    perVideo.set(video.id, terms);
    for (const term of terms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  }
  const ranked = [...frequencies.entries()]
    .filter(([, frequency]) => frequency >= 2)
    .map(([term, frequency]) => {
      const words = topicWordCount(term);
      const idf = 1 + Math.log((videos.length + 1) / (frequency + 1));
      // Interpretable specificity: recurring support, phrase length, and inverse document frequency.
      const specificity = frequency * (1 + Math.max(0, words - 1) * 0.35) * idf;
      return { term, frequency, specificity, namedNumber: isNamedNumberTopic(term) };
    })
    .sort((a, b) => b.specificity - a.specificity || b.frequency - a.frequency || Number(b.namedNumber) - Number(a.namedNumber) || b.term.length - a.term.length || a.term.localeCompare(b.term));

  return videos.map((video) => {
    const terms = perVideo.get(video.id) ?? new Set<string>();
    const candidates = ranked.filter((candidate) => terms.has(candidate.term));
    const primaryTopic = candidates[0]?.term ?? "Tema sin clasificar";
    const secondaryTopics = candidates.slice(1, 3).map((candidate) => candidate.term);
    return { ...video, primaryTopic, secondaryTopics, topicCluster: primaryTopic };
  });
}

function makeTopicClusters(videos: AnalyzedVideo[]): TopicCluster[] {
  const topics = new Map<string, CompetitorVideo[]>();
  for (const video of videos) {
    const labels = [video.primaryTopic, ...video.secondaryTopics].filter((topic) => topic !== "Tema sin clasificar");
    for (const topic of labels) {
      const list = topics.get(topic) ?? [];
      list.push(video);
      topics.set(topic, list);
    }
  }
  return [...topics.entries()]
    .map(([topic, items]) => ({
      topic,
      videoCount: items.length,
      averageViews: average(items.map((video) => video.views)),
      averageViewsToSubscribers: average(items.map((video) => video.metrics.viewsToSubscribers)),
      averageViewsVsMedian: average(items.map((video) => video.metrics.viewsVsMedian)),
    }))
    .sort((a, b) => b.videoCount - a.videoCount || (b.averageViews ?? -1) - (a.averageViews ?? -1) || a.topic.localeCompare(b.topic))
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
      primaryTopic: "Tema sin clasificar",
      secondaryTopics: [],
      topicCluster: "Sin tema dominante",
    };
  });
  const winnerIds = new Set(preliminary.filter((video) => video.isWinner).map((video) => video.id));
  const titleRecords = collectSourceTerms(sourceVideos, "título");
  const descriptionRecords = collectDescriptionTerms(sourceVideos);
  const tagRecords = collectSourceTerms(sourceVideos, "tag_real_youtube");
  const entities = titleEntities(sourceVideos);
  const titleKeywords = buildKeywordInsights(preliminary, titleRecords, entities, winnerIds)
    .filter((item) => item.videoFrequency >= 2)
    .sort((a, b) => b.videoFrequency - a.videoFrequency || b.titleFrequency - a.titleFrequency || topicWordCount(b.term) - topicWordCount(a.term) || a.term.localeCompare(b.term))
    .slice(0, 30);
  const descriptionTerms = buildKeywordInsights(preliminary, descriptionRecords, entities, winnerIds)
    .filter((item) => item.videoFrequency >= 2)
    .sort((a, b) => b.videoFrequency - a.videoFrequency || topicWordCount(b.term) - topicWordCount(a.term) || a.term.localeCompare(b.term))
    .slice(0, 30);
  const youtubeTags = buildKeywordInsights(preliminary, tagRecords, entities, winnerIds)
    .sort((a, b) => b.videoFrequency - a.videoFrequency || a.term.localeCompare(b.term))
    .slice(0, 30);
  const coreRecords = mergeTermRecords(titleRecords, tagRecords);
  const allInsights = buildKeywordInsights(preliminary, coreRecords, entities, winnerIds);
  // Main keywords combine titles and official tags only; descriptions are always reported separately.
  const keywords = allInsights
    .filter((item) => item.videoFrequency >= 2)
    .sort((a, b) => b.videoFrequency - a.videoFrequency || (b.titleFrequency + b.tagFrequency) - (a.titleFrequency + a.tagFrequency) || a.term.localeCompare(b.term))
    .slice(0, 30);
  // Require repeated winner support before lift is considered; the transparent tie-break order
  // is winner support, title/tag support, lift, then total video support.
  const winnerKeywords = allInsights
    .filter((item) => item.winnerFrequency >= 2 && item.videoFrequency >= 2 && item.titleFrequency + item.tagFrequency > 0)
    .sort((a, b) => b.winnerFrequency - a.winnerFrequency
      || (b.titleFrequency + b.tagFrequency) - (a.titleFrequency + a.tagFrequency)
      || (b.winnerLift ?? 0) - (a.winnerLift ?? 0)
      || b.videoFrequency - a.videoFrequency
      || topicWordCount(b.term) - topicWordCount(a.term)
      || a.term.localeCompare(b.term))
    .slice(0, 30);
  const videos = assignTopics(preliminary);
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
    titleKeywords,
    descriptionTerms,
    youtubeTags,
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
