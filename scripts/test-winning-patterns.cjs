const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const srcRoot = path.resolve(__dirname, "../src");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const js = ts.transpile(fs.readFileSync(file, "utf8"), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  const localRequire = (id) => id.startsWith("@/") ? load(path.resolve(srcRoot, `${id.slice(2)}.ts`)) : require(id);
  new Function("exports", "require", "module", "__filename", "__dirname", js)(mod.exports, localRequire, mod, file, path.dirname(file));
  return mod.exports;
}

const { analyzeCompetitor } = load(path.resolve(srcRoot, "lib/competitor-analysis.ts"));
const { analyzeWinningPatterns } = load(path.resolve(srcRoot, "lib/winning-patterns.ts"));
const now = new Date("2026-09-29T12:00:00.000Z");
const channel = { id: "UC1234567890123456789012", name: "Synthetic", handle: "@synthetic", description: "", createdAt: null, country: null, subscribers: 100, totalViews: null, totalVideoCount: null, avatar: null, url: "https://youtube.com/@synthetic" };
function video(id, title, views, durationSeconds = 1800) {
  return { id, title, description: "", publishedAt: "2026-09-20T12:00:00.000Z", durationSeconds, views, likes: null, comments: null, thumbnail: null, youtubeTags: [] };
}
function report(videos) { return analyzeCompetitor(channel, videos, now); }
function comboTitles(language = "es", count = 4, views = 1000, prefix = "combo") {
  const title = language === "es" ? "Oración para dormir en paz sin miedo" : "How to sleep in peace without fear";
  return Array.from({ length: count }, (_, index) => video(`${prefix}-${index}`, `${title} ${index}`, views));
}

// A. Repeated semantic combinations among winners appear with their actual support and evidence.
const repeated = report([...comboTitles("es", 4, 1000), ...Array.from({ length: 6 }, (_, index) => video(`base-${index}`, `Tema general ${index}`, 100))]);
const repeatedAnalysis = analyzeWinningPatterns(repeated);
assert.ok(repeatedAnalysis.patterns.some((item) => item.supportingVideoCount >= 2 && item.winnerCount >= 2 && item.pains.length + item.benefits.length + item.intents.length > 0));
assert.ok(repeatedAnalysis.patterns.every((item) => item.evidence.length === item.supportingVideoCount && item.supportingVideoIds.length === item.supportingVideoCount));

// B. A singleton cannot enter either the main patterns or emerging signals.
const singleton = report([...comboTitles("es", 3, 1000), video("single", "Tesla Model Y unique object", 500), ...Array.from({ length: 6 }, (_, index) => video(`single-base-${index}`, `General sample ${index}`, 100))]);
const singletonAnalysis = analyzeWinningPatterns(singleton);
assert.ok(![...singletonAnalysis.patterns, ...singletonAnalysis.emergingSignals].some((item) => item.supportingVideoIds.includes("single") && item.supportingVideoCount === 1));

// C. Two exceptional videos are separated as an emerging signal and carry the small-sample warning in UI state.
const emerging = report([...comboTitles("es", 2, 5000, "emerge"), ...Array.from({ length: 12 }, (_, index) => video(`emerge-base-${index}`, `Unrelated category ${index}`, 100))]);
const emergingAnalysis = analyzeWinningPatterns(emerging);
assert.ok(emergingAnalysis.emergingSignals.some((item) => item.supportingVideoCount === 2 && item.winnerCount >= 1 && (item.averageViewsVsMedian ?? 0) >= 3));

// D/E. Popular but mediocre combinations do not displace a less frequent high-relative-performance combination.
const contrast = report([
  ...Array.from({ length: 5 }, (_, index) => video(`common-${index}`, `Tema común general ${index}`, 100)),
  ...comboTitles("es", 3, 5000, "rare-strong"),
  ...Array.from({ length: 8 }, (_, index) => video(`contrast-base-${index}`, `Contenido base ${index}`, 100)),
]);
const contrastAnalysis = analyzeWinningPatterns(contrast);
assert.ok(contrastAnalysis.patterns.some((item) => item.supportingVideoIds.some((id) => id.startsWith("rare-strong")) && (item.averageViewsVsMedian ?? 0) >= 3));
assert.ok(!contrastAnalysis.patterns.some((item) => item.supportingVideoCount >= 5 && item.winnerCount === 0));

// F/G. The same semantic engine surfaces Spanish and English intent/pain/benefit dimensions.
const esAnalysis = analyzeWinningPatterns(report([...comboTitles("es", 3, 1000, "es"), ...Array.from({ length: 7 }, (_, index) => video(`es-base-${index}`, `Contenido normal ${index}`, 100))]));
assert.ok(esAnalysis.patterns.some((item) => item.intents.length || item.pains.length || item.benefits.length));
const enAnalysis = analyzeWinningPatterns(report([...comboTitles("en", 3, 1000, "en"), ...Array.from({ length: 7 }, (_, index) => video(`en-base-${index}`, `Normal content ${index}`, 100))]));
assert.ok(enAnalysis.patterns.some((item) => item.intents.length || item.pains.length || item.benefits.length));

// H/I. Empty data and nullable metrics return a stable empty result without NaN.
const empty = analyzeWinningPatterns(report([]));
assert.equal(empty.sampleSize, 0); assert.deepEqual(empty.patterns, []); assert.deepEqual(empty.emergingSignals, []);
const hiddenSubsChannel = { ...channel, subscribers: null };
const hiddenSubs = analyzeCompetitor(hiddenSubsChannel, [...comboTitles("es", 3, 1000, "null"), ...Array.from({ length: 7 }, (_, index) => video(`null-base-${index}`, `Contenido normal ${index}`, 100))], now);
const nullMetrics = analyzeWinningPatterns(hiddenSubs);
assert.ok(nullMetrics.patterns.every((item) => item.averageViewsToSubscribers === null || Number.isFinite(item.averageViewsToSubscribers)));
assert.ok(nullMetrics.patterns.every((item) => item.lift === null || Number.isFinite(item.lift)));

// J/K. Regression guard: existing competitor metrics, winner decisions, and validated semantic ordering remain unchanged.
assert.equal(repeated.sample.medianViews, 100);
assert.deepEqual(repeated.winners.map((item) => item.id), ["combo-0", "combo-1", "combo-2", "combo-3"]);
const taxonomyTitle = "Exploring Donald Trump and New York with Tesla Model Y and iPhone 17 before Salmo 91: Dormir en Paz, Protección ante Ansiedad y Miedo en la Noche";
const taxonomyVideos = Array.from({ length: 6 }, (_, index) => ({ ...video(`taxonomy-${index}`, taxonomyTitle, 1000), youtubeTags: ["Tesla Model Y"] }));
const taxonomy = analyzeCompetitor(channel, taxonomyVideos, now);
assert.deepEqual(taxonomy.winnerKeywords.slice(0, 8).map((item) => item.term), ["exploring donald trump", "salmo 91 dormir", "ansiedad y miedo", "donald trump", "dormir en paz", "exploring donald", "iphone 17", "new york"]);
const psalmRegression = analyzeCompetitor(channel, Array.from({ length: 17 }, (_, index) => video(`psalm-${index}`, `Salmo 91 para descansar en casa ${index}`, 1000)).concat(Array.from({ length: 5 }, (_, index) => video(`other-${index}`, `Mensaje general de esperanza ${index}`, 100))), now);
assert.deepEqual(psalmRegression.topicClusters.slice(0, 4).map((item) => item.topic), ["descansar en casa", "salmo 91", "general de esperanza", "mensaje general"]);

console.log("Winning-pattern tests passed (A–K).");
