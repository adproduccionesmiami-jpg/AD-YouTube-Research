type ContentLanguage = "en" | "es";

const ENGLISH_MARKERS: Record<string, number> = {
  and: 2, but: 2, with: 2, from: 2, about: 2, into: 2, their: 2, there: 2, they: 2,
  this: 2, these: 2, those: 2, you: 2, your: 2, our: 2, have: 2, has: 2, had: 2,
  was: 2, were: 2, are: 2, been: 2, will: 2, would: 2, could: 2, should: 2,
  because: 2, while: 2, through: 2, how: 2, why: 2, what: 2, which: 2, who: 2,
  when: 2, where: 2, story: 1, today: 1, world: 1, life: 1, survived: 2,
  survivor: 2, english: 2, the: 1, of: 1, to: 1, for: 1, in: 1, on: 1,
  as: 1, by: 1, at: 1, it: 1, he: 1, she: 1, his: 1, her: 1, we: 1, not: 1,
  or: 1, an: 1, is: 1,
};

const SPANISH_MARKERS: Record<string, number> = {
  cómo: 3, qué: 3, quién: 3, quiénes: 3, cuál: 3, cuáles: 3, cuándo: 3, dónde: 3,
  porque: 2, aunque: 2, pero: 2, también: 2, ustedes: 2, ellos: 2, ellas: 2,
  nosotros: 2, nuestro: 2, nuestros: 2, fueron: 2, será: 2, había: 2, hay: 2,
  está: 2, están: 2, sido: 2, hacer: 2, hecho: 2, puede: 2, pueden: 2,
  para: 2, entre: 2, desde: 2, hacia: 2, durante: 2, según: 2, historia: 2,
  sobrevivió: 3, náufrago: 3, pacífico: 2, días: 2, español: 2,
  vídeo: 2, películas: 2, noticias: 2, mundo: 1, vida: 1, ahora: 1, aquí: 2,
  este: 1, esta: 1, estos: 1, estas: 1, la: 1, el: 1, los: 1, las: 1,
  del: 1, al: 1, un: 1, una: 1, unos: 1, unas: 1, de: 1, en: 1, es: 1,
  y: 1, por: 1, con: 1, se: 1, su: 1, sus: 1, como: 1, sobre: 1,
  más: 1, lo: 1, le: 1, les: 1,
};

function metadataLanguage(value: string | undefined): ContentLanguage | "other" | null {
  const code = value?.trim().toLowerCase();
  if (!code) return null;
  if (/^en(?:[-_][a-z0-9]+)*$/.test(code)) return "en";
  if (/^es(?:[-_][a-z0-9]+)*$/.test(code)) return "es";
  return "other";
}

function tokens(text: string): string[] {
  return text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function markerScore(text: string, markers: Record<string, number>): number {
  return [...new Set(tokens(text))].reduce((score, token) => score + (markers[token] ?? 0), 0);
}

function detectFromText(title: string, description: string): ContentLanguage | null {
  const shortDescription = description.slice(0, 900);
  const accentPattern = /[áéíóúñü¿¡]/iu;
  const englishScore =
    markerScore(title, ENGLISH_MARKERS) * 2 + markerScore(shortDescription, ENGLISH_MARKERS) * 0.75;
  const spanishScore =
    markerScore(title, SPANISH_MARKERS) * 2 + markerScore(shortDescription, SPANISH_MARKERS) * 0.75 +
    (accentPattern.test(title) ? 1.5 : 0) + (accentPattern.test(shortDescription) ? 0.5 : 0);

  if (englishScore >= 4 && englishScore - spanishScore >= 2) return "en";
  if (spanishScore >= 4 && spanishScore - englishScore >= 2) return "es";
  return null;
}

export function matchesTargetLanguage(
  target: "all" | ContentLanguage,
  defaultAudioLanguage: string | undefined,
  defaultLanguage: string | undefined,
  title: string,
  description: string,
): boolean {
  if (target === "all") return true;

  // Audio language describes the video's spoken content, so prefer it over
  // the language used for its title and description when both are present.
  const audioLanguage = metadataLanguage(defaultAudioLanguage);
  const snippetLanguage = metadataLanguage(defaultLanguage);
  const knownLanguage = audioLanguage ?? snippetLanguage;
  if (knownLanguage !== null) return knownLanguage === target;

  // Missing metadata is common. In that case, keep only a clear local text
  // classification; uncertain titles are excluded from strict-language runs.
  return detectFromText(title, description) === target;
}
