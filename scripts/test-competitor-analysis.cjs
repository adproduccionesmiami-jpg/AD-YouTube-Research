const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const srcRoot = path.resolve(__dirname, "../src");
const moduleCache = new Map();
function loadTypeScript(sourcePath) {
  if (moduleCache.has(sourcePath)) return moduleCache.get(sourcePath).exports;
  const loaded = { exports: {} };
  moduleCache.set(sourcePath, loaded);
  const compiled = ts.transpile(fs.readFileSync(sourcePath, "utf8"), {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  });
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/")) return loadTypeScript(path.resolve(srcRoot, `${specifier.slice(2)}.ts`));
    return require(specifier);
  };
  new Function("exports", "require", "module", "__filename", "__dirname", compiled)(
    loaded.exports,
    localRequire,
    loaded,
    sourcePath,
    path.dirname(sourcePath),
  );
  return loaded.exports;
}

const { analyzeCompetitor } = loadTypeScript(path.resolve(srcRoot, "lib/competitor-analysis.ts"));
const { loadCompetitorData, parseCompetitorReference } = loadTypeScript(path.resolve(srcRoot, "lib/youtube-competitor-service.ts"));
const { filterAndSortVideos, hasPostSearchFilters } = loadTypeScript(path.resolve(srcRoot, "lib/opportunity-filters.ts"));
const { matchesTargetLanguage } = loadTypeScript(path.resolve(srcRoot, "lib/language-filter.ts"));

assert.deepEqual(parseCompetitorReference("@Canal_DePrueba"), { kind: "handle", value: "@Canal_DePrueba" });
assert.deepEqual(parseCompetitorReference("https://www.youtube.com/@canal"), { kind: "handle", value: "@canal" });
assert.deepEqual(parseCompetitorReference("youtube.com/channel/UC1234567890123456789012"), { kind: "id", value: "UC1234567890123456789012" });
assert.deepEqual(parseCompetitorReference("https://youtube.com/user/legacy_name"), { kind: "username", value: "legacy_name" });
assert.deepEqual(parseCompetitorReference("youtube.com/c/legacy-channel"), { kind: "custom", value: "legacy-channel" });
assert.equal(parseCompetitorReference("https://youtube.com/watch?v=video123"), null);
assert.equal(parseCompetitorReference("https://youtube.com.evil.example/@channel"), null);
assert.equal(matchesTargetLanguage("en", "en-US", undefined, "A clear English title", ""), true);
assert.equal(matchesTargetLanguage("en", "es-ES", undefined, "Título claramente en español", ""), false);
assert.equal(matchesTargetLanguage("all", undefined, undefined, "Título en español", ""), true);

const oldResearchVideos = [
  { id: "low", title: "Low views", publishedAt: "2026-09-01T00:00:00Z", durationSeconds: 500, views: 100, subscribers: 100, viewsToSubscribers: 1 },
  { id: "high", title: "High views", publishedAt: "2026-09-20T00:00:00Z", durationSeconds: 1200, views: 900, subscribers: 100, viewsToSubscribers: 9 },
];
const oldResearchFilters = { publishedAfter: null, views: { min: 200, max: null }, subscribers: { min: null, max: null }, duration: "all", durationSeconds: { min: null, max: null }, ratio: { min: 2, max: null }, sortBy: "views" };
assert.deepEqual(filterAndSortVideos(oldResearchVideos, oldResearchFilters).map((item) => item.id), ["high"]);
assert.equal(hasPostSearchFilters("all", oldResearchFilters), true);

const now = new Date("2026-09-29T12:00:00.000Z");
const channel = {
  id: "UC1234567890123456789012",
  name: "Canal de prueba",
  handle: "@canaldeprueba",
  description: "Descripción de prueba",
  createdAt: "2020-01-01T00:00:00.000Z",
  country: null,
  subscribers: 500,
  totalViews: 10000,
  totalVideoCount: 4,
  avatar: null,
  url: "https://www.youtube.com/channel/UC1234567890123456789012",
};
const videos = [
  { id: "one", title: "Cómo aliviar la ansiedad y dormir en paz 2026", description: "La ansiedad puede mejorar con descanso.", publishedAt: "2026-09-28T12:00:00.000Z", durationSeconds: 600, views: 1000, likes: 20, comments: 3, thumbnail: null, youtubeTags: ["ansiedad", "descanso"] },
  { id: "two", title: "Dormir en paz sin miedo", description: "Consejos para dormir y descansar.", publishedAt: "2026-09-24T12:00:00.000Z", durationSeconds: 900, views: 600, likes: 10, comments: 2, thumbnail: null, youtubeTags: null },
  { id: "three", title: "Aprender fotografía paso a paso", description: "Guía para empezar a tomar fotos.", publishedAt: "2026-09-19T12:00:00.000Z", durationSeconds: 1200, views: 200, likes: 4, comments: 1, thumbnail: null, youtubeTags: [] },
  { id: "four", title: "Cuidar plantas en casa", description: "Rutina sencilla para tus plantas.", publishedAt: "2026-09-14T12:00:00.000Z", durationSeconds: 300, views: 300, likes: 5, comments: 0, thumbnail: null, youtubeTags: [] },
];

const report = analyzeCompetitor(channel, videos, now);
assert.equal(report.sample.analyzed, 4);
assert.equal(report.sample.videosWithViews, 4);
assert.equal(report.sample.averageViews, 525);
assert.equal(report.sample.medianViews, 450);
assert.equal(report.videos[0].metrics.viewsToSubscribers, 2);
assert.equal(report.videos[0].metrics.viewsVsMedian, 2.22);
assert.equal(report.videos[0].metrics.viewsPerDay, 1000);
assert.equal(report.videos[0].isWinner, true);
assert.equal(report.winners[0].id, "one");
assert.equal(Object.hasOwn(report.videos[0], "description"), false, "descriptions stay server-side after keyword extraction");
assert.ok(report.youtubeTags.some((item) => item.term === "ansiedad" && item.sources.includes("tag_real_youtube")));
assert.ok(report.winnerKeywords.every((item) => item.winnerFrequency >= 2), "winner terms require support from at least two winners");
assert.equal(report.cadence.byWeekday.length, 7);
assert.equal(report.cadence.videosLast30Days, 4);
assert.equal(report.concentration.top3Percent, 90.48);
assert.ok(report.warnings.some((warning) => warning.includes("tags")));
const zeroViewsReport = analyzeCompetitor(channel, videos.map((video) => ({ ...video, views: 0 })), now);
assert.equal(zeroViewsReport.sample.averageViews, 0);
assert.equal(zeroViewsReport.concentration.sampleViews, 0);
assert.equal(zeroViewsReport.concentration.top3Percent, null);

function syntheticVideo(id, title, views, description = "", youtubeTags = []) {
  return { id, title, description, publishedAt: "2026-09-28T12:00:00.000Z", durationSeconds: 600, views, likes: 0, comments: 0, thumbnail: null, youtubeTags };
}

const semanticChannel = { ...channel, subscribers: 100 };
const semanticVideos = [
  ...Array.from({ length: 5 }, (_, index) => syntheticVideo(`winner-${index}`, `Strong topic restful night prayer ${index}`, 1000, `Unique winner opening ${index}.\n\nRepeated editorial block for search indexing and audience discovery at https://example.com #repeatedmeta.`)),
  ...Array.from({ length: 5 }, (_, index) => syntheticVideo(`base-${index}`, `General subject ${index}`, 100, `Unique sample opening ${index}.\n\nRepeated editorial block for search indexing and audience discovery at https://example.com #repeatedmeta.`)),
];
semanticVideos[0].description += "\n\nQuiet harbor reflection appears in descriptions.";
semanticVideos[1].description += "\n\nQuiet harbor reflection appears in descriptions.";
semanticVideos[0].title += " rare quasar signal 2026";
semanticVideos[1].title += " rare quasar signal 2026";
semanticVideos[0].youtubeTags = ["official-tag", "strong topic"];
semanticVideos[1].youtubeTags = ["official-tag"];
const semanticReport = analyzeCompetitor(semanticChannel, semanticVideos, now);

// A. Repeated description blocks, links, and hashtags are excluded from the secondary signal and never enter winners.
assert.ok(!semanticReport.descriptionTerms.some((item) => item.term.includes("editorial block") || item.term.includes("repeatedmeta")));
assert.ok(semanticReport.descriptionTerms.some((item) => item.term === "quiet harbor reflection"));
assert.ok(!semanticReport.winnerKeywords.some((item) => item.term.includes("indexing")));

// B. Repeated winner support sorts ahead of a rare phrase even when that phrase has high lift.
const strongIndex = semanticReport.winnerKeywords.findIndex((item) => item.term === "strong topic");
const rareIndex = semanticReport.winnerKeywords.findIndex((item) => item.term === "rare quasar signal");
assert.ok(strongIndex >= 0 && rareIndex >= 0 && strongIndex < rareIndex);

// C. Standalone numeric tokens are not emitted as winner keywords.
assert.ok(!semanticReport.winnerKeywords.some((item) => /^\d+$/u.test(item.term)));
assert.ok(!semanticReport.winnerKeywords.some((item) => item.term === "2026"));

// D. General n-gram extraction retains useful two- and three-word title phrases.
assert.ok(semanticReport.titleKeywords.some((item) => item.term === "restful night"));
assert.ok(semanticReport.titleKeywords.some((item) => item.term === "restful night prayer"));

// E. Clusters prefer repeated, specific phrases to generic single words.
assert.ok(semanticReport.topicClusters.every((item) => item.topic !== "day" && item.topic !== "noche"));
assert.ok(semanticReport.videos.every((video) => Array.isArray(video.secondaryTopics)));
const genericDayReport = analyzeCompetitor(semanticChannel, Array.from({ length: 8 }, (_, index) => syntheticVideo(`day-${index}`, `Día 12 mensaje general ${index}`, 1000, "")), now);
assert.ok(genericDayReport.topicClusters.every((item) => !item.topic.startsWith("día 12")));

// F. Repeated Salmo 91 labels emerge from titles without a religion-specific rule.
const psalmVideos = [
  ...Array.from({ length: 17 }, (_, index) => syntheticVideo(`psalm-${index}`, `Salmo 91 para descansar en casa ${index}`, 1000, "")),
  ...Array.from({ length: 5 }, (_, index) => syntheticVideo(`other-${index}`, `Mensaje general de esperanza ${index}`, 100, "")),
];
const psalmReport = analyzeCompetitor(semanticChannel, psalmVideos, now);
assert.ok(psalmReport.topicClusters.some((item) => item.topic.startsWith("salmo 91") && item.videoCount >= 17));
assert.ok(psalmReport.videos.filter((video) => video.title.startsWith("Salmo 91")).every((video) => video.primaryTopic.startsWith("salmo 91")));

// G. Official tags remain a distinct source and never leak into title-only keywords.
assert.ok(semanticReport.youtubeTags.some((item) => item.term === "official-tag" && item.tagFrequency === 2));
assert.ok(!semanticReport.titleKeywords.some((item) => item.term === "official-tag"));

const hiddenSubscribersReport = analyzeCompetitor({ ...channel, subscribers: null }, videos, now);
assert.equal(hiddenSubscribersReport.videos[0].metrics.viewsToSubscribers, null);
assert.ok(hiddenSubscribersReport.warnings.some((warning) => warning.includes("oculta")));

const noVideosReport = analyzeCompetitor(channel, [], now);
assert.equal(noVideosReport.sample.averageViews, null);
assert.equal(noVideosReport.sample.medianViews, null);
assert.equal(noVideosReport.concentration.top3Percent, null);
assert.equal(noVideosReport.titlePatterns.averageCharacters, null);
assert.ok(noVideosReport.warnings.some((warning) => warning.includes("No se encontraron videos")));

(async () => {
  const originalFetch = global.fetch;
  const requests = [];
  const queued = [
    { items: [{
      id: channel.id,
      snippet: { title: "Canal de prueba", description: "Descripción pública", publishedAt: "2020-01-01T00:00:00.000Z", country: "US", customUrl: "@canaldeprueba", thumbnails: { medium: { url: "https://yt3.ggpht.com/avatar.jpg" } } },
      contentDetails: { relatedPlaylists: { uploads: "UU1234567890123456789012" } },
      statistics: { subscriberCount: "500", viewCount: "10000", videoCount: "2" },
    }] },
    { items: [{ contentDetails: { videoId: "one" } }, { contentDetails: { videoId: "two" } }] },
    { items: [
      { id: "one", snippet: { title: "Video uno", description: "Descripción uno", publishedAt: "2026-09-28T12:00:00.000Z", tags: ["tag-real"], thumbnails: { high: { url: "https://i.ytimg.com/one.jpg" } } }, contentDetails: { duration: "PT10M" }, statistics: { viewCount: "1000", likeCount: "20", commentCount: "3" } },
      { id: "two", snippet: { title: "Video dos", description: "Descripción dos", publishedAt: "2026-09-24T12:00:00.000Z" }, contentDetails: { duration: "PT5M" }, statistics: { viewCount: "600" } },
    ] },
  ];
  global.fetch = async (input, options) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    requests.push({ url, options });
    const body = queued.shift();
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const reference = parseCompetitorReference("@canaldeprueba");
    const data = await loadCompetitorData(reference, "unit-test-placeholder");
    assert.equal(data.channel.id, channel.id);
    assert.equal(data.channel.subscribers, 500);
    assert.equal(data.channel.handle, "@canaldeprueba");
    assert.equal(data.videos.length, 2);
    assert.equal(data.videos[0].durationSeconds, 600);
    assert.deepEqual(data.videos[0].youtubeTags, ["tag-real"]);
    assert.equal(data.videos[1].youtubeTags, null);
    assert.deepEqual(requests.map((request) => request.url.pathname.split("/").pop()), ["channels", "playlistItems", "videos"]);
    assert.ok(requests.every((request) => request.options.next.revalidate === 900));
    assert.equal(data.quotaWarnings.length, 0);

    global.fetch = async () => new Response(JSON.stringify({ error: { errors: [{ reason: "quotaExceeded" }] } }), { status: 403, headers: { "content-type": "application/json" } });
    await assert.rejects(loadCompetitorData(reference, "unit-test-placeholder"), (error) => error.code === "QUOTA_EXCEEDED" && error.status === 429);
  } finally {
    global.fetch = originalFetch;
  }
  console.log("Competitor tests passed (reference parsing, v0.02 language/opportunity regression, 3-call data batching/cache, metrics, winners, tag/keyword separation, missing data and quota errors).");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
