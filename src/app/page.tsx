"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  ExternalLink,
  Globe2,
  Hash,
  LoaderCircle,
  ListFilter,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { classifyDuration, formatDate, formatDuration, formatNumber, formatRatio } from "@/lib/youtube-format";
import { getFormFilterErrors, parseOptionalNumber } from "@/lib/opportunity-filters";
import type { ResearchFailure, ResearchFormValues, ResearchRequest, ResearchSuccess, ResearchVideo } from "@/types/research";
import CompetitorNavigationLink from "@/components/competitor/CompetitorNavigationLink";
import WinningPatternsNavigationLink from "@/components/patterns/WinningPatternsNavigationLink";

const DEFAULT_FORM: ResearchFormValues = {
  topic: "",
  keywords: "",
  language: "all",
  dateRange: "any",
  customDateFrom: "",
  minViews: "",
  maxViews: "",
  minSubscribers: "",
  maxSubscribers: "",
  durationFilter: "all",
  minDurationMinutes: "",
  maxDurationMinutes: "",
  minRatio: "",
  maxRatio: "",
  sortBy: "relevance",
  maxResults: 10,
};

const FILTER_ERROR_GROUPS: Partial<Record<keyof ResearchFormValues, string[]>> = {
  minViews: ["maxViews"],
  maxViews: ["minViews"],
  minSubscribers: ["maxSubscribers"],
  maxSubscribers: ["minSubscribers"],
  minDurationMinutes: ["maxDurationMinutes"],
  maxDurationMinutes: ["minDurationMinutes"],
  minRatio: ["maxRatio"],
  maxRatio: ["minRatio"],
  dateRange: ["customDateFrom"],
  durationFilter: ["minDurationMinutes", "maxDurationMinutes"],
};

type ViewState = "idle" | "loading" | "success" | "error";

function DurationBadge({ seconds }: { seconds: number | null }) {
  const kind = classifyDuration(seconds);
  if (!kind) return <span className="duration-kind duration-unknown">Sin dato</span>;
  return <span className={"duration-kind duration-" + kind.toLowerCase()}>{kind}</span>;
}

function RatioBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="ratio-badge ratio-empty">Sin dato</span>;
  const tone = value >= 2 ? "ratio-high" : value >= 1 ? "ratio-mid" : "ratio-low";
  return <span className={"ratio-badge " + tone}>{formatRatio(value)}</span>;
}

function ChannelAvatar({ name, src }: { name: string; src: string | null }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const meaningfulWords = words.filter((word) => !["de", "del", "la", "el", "los", "las", "the", "of", "and", "y"].includes(word.toLocaleLowerCase("es")));
  const initials = (meaningfulWords.length > 0 ? meaningfulWords : words).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "YT";

  return (
    <span className="channel-avatar" aria-hidden="true">
      <span className="channel-avatar-initials">{initials}</span>
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes="28px"
          unoptimized
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      )}
    </span>
  );
}

function FilterNumber({
  id,
  label,
  value,
  onChange,
  error,
  decimal = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  decimal?: boolean;
}) {
  return (
    <label className="filter-number-field" htmlFor={id}>
      <span>{label}</span>
      <span className={"filter-input-wrap" + (error ? " has-error" : "")}>
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + "-error" : undefined}
        />
      </span>
      {error && <span className="filter-error" id={id + "-error"}>{error}</span>}
    </label>
  );
}

function sortLabel(sortBy: ResearchSuccess["sortBy"]): string {
  switch (sortBy) {
    case "views": return "más vistas";
    case "recent": return "más recientes";
    case "ratio": return "mayor Vistas/Subs";
    default: return "relevancia";
  }
}

function ResultRow({ item }: { item: ResearchVideo }) {
  const tags = item.tags.slice(0, 2);
  const extraTags = item.tags.length - tags.length;

  return (
    <tr>
      <td className="thumbnail-cell">
        <a className="video-thumbnail" href={item.videoUrl} target="_blank" rel="noreferrer noopener" aria-label={"Abrir video: " + item.title}>
          {item.thumbnail ? (
            <Image src={item.thumbnail} alt="" fill sizes="84px" unoptimized />
          ) : (
            <span className="thumbnail-fallback"><Play size={18} fill="currentColor" /></span>
          )}
          <span className="thumbnail-open"><ArrowUpRight size={13} /></span>
        </a>
      </td>
      <td className="video-cell">
        <a className="video-title" href={item.videoUrl} target="_blank" rel="noreferrer noopener" title={item.title}>{item.title}</a>
        {item.description && <p className="video-description">{item.description}</p>}
        {(item.language || item.categoryId || tags.length > 0) && (
          <div className="video-metadata" aria-label="Metadatos del video">
            {item.language && <span className="metadata-pill">{item.language.toUpperCase()}</span>}
            {item.categoryId && <span className="metadata-pill">Cat. {item.categoryId}</span>}
            {tags.map((tag) => <span className="metadata-tag" key={tag} title={tag}>{tag}</span>)}
            {extraTags > 0 && <span className="metadata-tag" title={item.tags.slice(2).join(", ")}>+{extraTags}</span>}
          </div>
        )}
      </td>
      <td className="channel-cell">
        <a className="channel-link" href={item.channelUrl} target="_blank" rel="noreferrer noopener" title={item.channelName}>
          <ChannelAvatar name={item.channelName} src={item.channelThumbnail} />
          <span className="channel-name">{item.channelName}</span>
          <ExternalLink className="channel-external" size={12} />
        </a>
        {item.channelCountry && <span className="channel-country">{item.channelCountry}</span>}
      </td>
      <td className="date-cell">{formatDate(item.publishedAt)}</td>
      <td className="duration-cell">
        <span className="duration-time">{formatDuration(item.durationSeconds)}</span>
        <DurationBadge seconds={item.durationSeconds} />
      </td>
      <td className="number-cell emphasis-number">{formatNumber(item.views)}</td>
      <td className="number-cell">{formatNumber(item.likes)}</td>
      <td className="number-cell">{formatNumber(item.comments)}</td>
      <td className="number-cell emphasis-number">{formatNumber(item.subscribers)}</td>
      <td className="ratio-cell"><RatioBadge value={item.viewsToSubscribers} /></td>
    </tr>
  );
}

function EmptyState() {
  return (
    <section className="empty-state" aria-live="polite">
      <div className="empty-art" aria-hidden="true">
        <div className="empty-orbit orbit-one" />
        <div className="empty-orbit orbit-two" />
        <div className="empty-icon"><Search size={25} strokeWidth={1.7} /></div>
        <span className="empty-spark spark-one"><Sparkles size={14} /></span>
        <span className="empty-spark spark-two"><Play size={12} fill="currentColor" /></span>
      </div>
      <p className="eyebrow empty-eyebrow">TU ESPACIO DE INVESTIGACIÓN</p>
      <h2>Una búsqueda clara.<br /><span>Mejores señales.</span></h2>
      <p className="empty-copy">Define un tema y consulta videos y canales públicos con datos reales de YouTube.</p>
      <div className="empty-footnote"><ShieldCheck size={15} /> La clave de API permanece protegida en el servidor</div>
    </section>
  );
}

export default function Home() {
  const [form, setForm] = useState<ResearchFormValues>(DEFAULT_FORM);
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [results, setResults] = useState<ResearchSuccess | null>(null);
  const [error, setError] = useState<ResearchFailure | null>(null);
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});

  function update<K extends keyof ResearchFormValues>(key: K, value: ResearchFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFilterErrors((current) => {
      const keysToClear = [String(key), ...(FILTER_ERROR_GROUPS[key] ?? [])];
      if (!keysToClear.some((field) => field in current)) return current;
      const next = { ...current };
      for (const field of keysToClear) delete next[field];
      return next;
    });
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.topic.trim()) return;

    const errors = getFormFilterErrors(form);
    setFilterErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setViewState("loading");
    setError(null);
    setResults(null);

    const parseNumber = (value: string, integerOnly = true) => parseOptionalNumber(value, integerOnly).value;
    const requestBody: ResearchRequest = {
      topic: form.topic.trim(),
      keywords: form.keywords,
      language: form.language,
      dateRange: form.dateRange,
      customDateFrom: form.customDateFrom,
      minViews: parseNumber(form.minViews),
      maxViews: parseNumber(form.maxViews),
      minSubscribers: parseNumber(form.minSubscribers),
      maxSubscribers: parseNumber(form.maxSubscribers),
      durationFilter: form.durationFilter,
      minDurationMinutes: form.durationFilter === "custom" ? parseNumber(form.minDurationMinutes) : null,
      maxDurationMinutes: form.durationFilter === "custom" ? parseNumber(form.maxDurationMinutes) : null,
      minRatio: parseNumber(form.minRatio, false),
      maxRatio: parseNumber(form.maxRatio, false),
      sortBy: form.sortBy,
      maxResults: form.maxResults,
    };

    try {
      const response = await fetch("/api/youtube/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json() as ResearchSuccess & { error?: ResearchFailure };
      if (!response.ok || payload.error) {
        throw payload.error ?? { code: "REQUEST_FAILED", message: "Ocurrió un error al consultar YouTube. Inténtalo de nuevo." };
      }
      setResults(payload);
      setViewState("success");
    } catch (caught) {
      const failure = caught as ResearchFailure;
      setError({
        code: failure?.code ?? "NETWORK_ERROR",
        message: failure?.message ?? "No se pudo conectar con YouTube. Comprueba la conexión e inténtalo de nuevo.",
        fields: failure?.fields,
      });
      setFilterErrors(failure?.fields ?? {});
      setViewState("error");
    }
  }

  function clearForm() {
    setForm(DEFAULT_FORM);
    setResults(null);
    setError(null);
    setFilterErrors({});
    setViewState("idle");
  }

  const submittedCount = results?.items.length ?? 0;
  const isLoading = viewState === "loading";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="AD YouTube Research, inicio">
          <span className="brand-mark"><span>AD</span><i /></span>
          <span className="brand-name">AD <b>YouTube Research</b></span>
        </a>
        <div className="topbar-right">
          <CompetitorNavigationLink />
          <WinningPatternsNavigationLink />
          <span className="workspace-tag"><span className="workspace-dot" /> ESPACIO PRIVADO</span>
          <span className="topbar-divider" />
          <span className="api-mark"><Play size={14} fill="currentColor" /> API v3</span>
        </div>
      </header>

      <div className="page-content" id="inicio">
        <section className="intro-row">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> INTELIGENCIA DE CONTENIDO</p>
            <h1>Investiga con <span>datos reales.</span></h1>
            <p className="intro-description">Encuentra señales de demanda, entiende el contexto de cada canal y valida tus ideas antes de producir.</p>
          </div>
          <div className="live-indicator"><span className="live-icon"><Play size={15} fill="currentColor" /></span><span><b>Datos públicos</b><small>Conexión en tiempo real</small></span><span className="live-dot" /></div>
        </section>

        <section className="search-panel" aria-labelledby="search-heading">
          <div className="panel-heading">
            <div className="panel-heading-left">
              <span className="panel-icon"><Search size={17} /></span>
              <div><h2 id="search-heading">Configura tu búsqueda</h2><p>Delimita el campo de análisis para obtener resultados útiles.</p></div>
            </div>
            <div className="panel-context"><span className="context-dot" /> BÚSQUEDA DE VIDEOS</div>
          </div>

          <form onSubmit={handleSearch}>
            <div className="form-grid primary-fields">
              <label className="field field-topic">
                <span className="field-label">Tema <span className="required-mark">*</span></span>
                <span className="input-wrap"><Search className="input-icon" size={17} /><input autoComplete="off" maxLength={200} placeholder="Ej. historias reales de supervivencia" value={form.topic} onChange={(event) => update("topic", event.target.value)} required /></span>
              </label>
              <label className="field field-keywords">
                <span className="field-label">Palabras clave <span className="optional-mark">Opcional</span></span>
                <span className="input-wrap"><Hash className="input-icon" size={17} /><input autoComplete="off" maxLength={500} placeholder="true survival stories, stranded at sea" value={form.keywords} onChange={(event) => update("keywords", event.target.value)} /><CircleHelp className="field-help" size={15} aria-label="Separa las palabras clave con comas" /></span>
              </label>
              <label className="field field-language">
                <span className="field-label">Idioma objetivo</span>
                <span className="select-wrap"><Globe2 className="input-icon" size={17} /><select value={form.language} onChange={(event) => update("language", event.target.value as ResearchFormValues["language"])}><option value="all">Todos los idiomas</option><option value="en">Inglés</option><option value="es">Español</option></select><ChevronDown className="select-chevron" size={15} /></span>
              </label>
            </div>

            <section className="opportunity-filters" aria-labelledby="opportunity-filter-heading">
              <div className="filter-section-heading">
                <div><h3 id="opportunity-filter-heading">Filtros de oportunidad</h3><p>Acota los resultados con rangos cuantitativos.</p></div>
                <span>OPCIONAL</span>
              </div>
              <div className="opportunity-filter-grid">
                <div className="opportunity-filter-card">
                  <label className="filter-select-field" htmlFor="filter-date-range">
                    <span className="filter-card-label"><CalendarDays size={14} /> Fecha de publicación</span>
                    <span className="filter-select-wrap"><select id="filter-date-range" value={form.dateRange} onChange={(event) => update("dateRange", event.target.value as ResearchFormValues["dateRange"])}><option value="any">Cualquier fecha</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="90d">Últimos 90 días</option><option value="12m">Últimos 12 meses</option><option value="custom">Fecha personalizada</option></select><ChevronDown size={14} /></span>
                  </label>
                  {form.dateRange === "custom" && <label className="filter-custom-date" htmlFor="filter-custom-date"><span>Fecha desde</span><input id="filter-custom-date" type="date" value={form.customDateFrom} onChange={(event) => update("customDateFrom", event.target.value)} aria-invalid={Boolean(filterErrors.customDateFrom)} aria-describedby={filterErrors.customDateFrom ? "filter-custom-date-error" : undefined} />{filterErrors.customDateFrom && <span className="filter-error" id="filter-custom-date-error">{filterErrors.customDateFrom}</span>}</label>}
                </div>

                <div className="opportunity-filter-card">
                  <p className="filter-card-label"><Play size={13} /> Vistas del video</p>
                  <div className="filter-range-fields">
                    <FilterNumber id="min-views" label="Mínimo" value={form.minViews} onChange={(value) => update("minViews", value)} error={filterErrors.minViews} />
                    <FilterNumber id="max-views" label="Máximo" value={form.maxViews} onChange={(value) => update("maxViews", value)} error={filterErrors.maxViews} />
                  </div>
                </div>

                <div className="opportunity-filter-card">
                  <p className="filter-card-label"><Globe2 size={14} /> Suscriptores del canal</p>
                  <div className="filter-range-fields">
                    <FilterNumber id="min-subscribers" label="Mínimo" value={form.minSubscribers} onChange={(value) => update("minSubscribers", value)} error={filterErrors.minSubscribers} />
                    <FilterNumber id="max-subscribers" label="Máximo" value={form.maxSubscribers} onChange={(value) => update("maxSubscribers", value)} error={filterErrors.maxSubscribers} />
                  </div>
                </div>

                <div className="opportunity-filter-card">
                  <label className="filter-select-field" htmlFor="filter-duration">
                    <span className="filter-card-label"><Clock3 size={14} /> Duración del video</span>
                    <span className="filter-select-wrap"><select id="filter-duration" value={form.durationFilter} onChange={(event) => update("durationFilter", event.target.value as ResearchFormValues["durationFilter"])}><option value="all">Cualquier duración</option><option value="short">Corto · menos de 4 min</option><option value="medium">Medio · 4 a 20 min</option><option value="long">Largo · más de 20 min</option><option value="custom">Rango personalizado</option></select><ChevronDown size={14} /></span>
                  </label>
                  {form.durationFilter === "custom" && <div className="filter-range-fields"><FilterNumber id="min-duration" label="Mín. min" value={form.minDurationMinutes} onChange={(value) => update("minDurationMinutes", value)} error={filterErrors.minDurationMinutes} /><FilterNumber id="max-duration" label="Máx. min" value={form.maxDurationMinutes} onChange={(value) => update("maxDurationMinutes", value)} error={filterErrors.maxDurationMinutes} /></div>}
                </div>

                <div className="opportunity-filter-card">
                  <p className="filter-card-label"><Sparkles size={14} /> Relación Vistas / subs</p>
                  <div className="filter-range-fields">
                    <FilterNumber id="min-ratio" label="Mínimo (x)" value={form.minRatio} onChange={(value) => update("minRatio", value)} error={filterErrors.minRatio} decimal />
                    <FilterNumber id="max-ratio" label="Máximo (x)" value={form.maxRatio} onChange={(value) => update("maxRatio", value)} error={filterErrors.maxRatio} decimal />
                  </div>
                </div>

                <div className="opportunity-filter-card">
                  <label className="filter-select-field" htmlFor="filter-sort">
                    <span className="filter-card-label"><ListFilter size={14} /> Ordenar resultados</span>
                    <span className="filter-select-wrap"><select id="filter-sort" value={form.sortBy} onChange={(event) => update("sortBy", event.target.value as ResearchFormValues["sortBy"])}><option value="relevance">Relevancia</option><option value="views">Más vistas</option><option value="recent">Más recientes</option><option value="ratio">Mayor Vistas / subs</option></select><ChevronDown size={14} /></span>
                  </label>
                </div>
              </div>
            </section>

            <div className="form-bottom-row">
              <div className="result-limit-field">
                <label className="field">
                  <span className="field-label">Máximo de resultados</span>
                  <span className="select-wrap"><span className="select-number">#</span><select value={form.maxResults} onChange={(event) => update("maxResults", Number(event.target.value))}><option value={5}>5 videos</option><option value={10}>10 videos</option><option value={25}>25 videos</option><option value={50}>50 videos</option></select><ChevronDown className="select-chevron" size={15} /></span>
                </label>
              </div>
              <div className="form-actions">
                <button className="clear-button" type="button" onClick={clearForm} disabled={isLoading}><RotateCcw size={15} /> Limpiar</button>
                <button className="search-button" type="submit" disabled={isLoading || !form.topic.trim()}>
                  {isLoading ? <LoaderCircle size={17} className="spin" /> : <Search size={17} />}
                  {isLoading ? "Buscando en YouTube…" : "Buscar en YouTube"}
                  {!isLoading && <ArrowUpRight size={15} className="button-arrow" />}
                </button>
              </div>
            </div>
          </form>
          <div className="panel-footer"><span><ShieldCheck size={14} /> La consulta se procesa en el servidor; la clave no se expone</span><span className="footer-separator" /><span>Una página por búsqueda · hasta 50 videos</span></div>
        </section>

        {viewState === "idle" && <EmptyState />}

        {viewState === "loading" && (
          <section className="loading-panel" aria-live="polite" aria-busy="true">
            <span className="loading-icon"><LoaderCircle size={23} className="spin" /></span>
            <div className="loading-copy"><h2>Buscando datos en YouTube…</h2><p>Consultando videos y enriqueciendo la información de sus canales.</p><div className="loading-track"><span /></div></div>
            <span className="loading-step">Esto suele tardar unos segundos</span>
          </section>
        )}

        {viewState === "error" && error && (
          <section className="error-panel" role="alert">
            <div className="error-symbol"><AlertTriangle size={19} /></div>
            <div className="error-copy"><p className="eyebrow">NO SE COMPLETÓ LA BÚSQUEDA <span>{error.code}</span></p><h2>{error.message}</h2><p>La búsqueda no guardó datos. Corrige la configuración o vuelve a intentarlo.</p></div>
            <button className="retry-button" type="button" onClick={() => setViewState("idle")}><RotateCcw size={15} /> Revisar búsqueda</button>
          </section>
        )}

        {viewState === "success" && results && (
          <section className="results-section" aria-live="polite">
            <div className="results-heading">
              <div><p className="eyebrow"><span className="eyebrow-line" /> RESULTADOS DE INVESTIGACIÓN</p><h2>{submittedCount === 0 ? "No encontramos videos." : "Datos listos para analizar."}</h2><p className="results-subtitle">Consulta: <strong>{results.query}</strong></p></div>
              <div className="results-total"><span className="total-icon"><Check size={16} /></span><span><b>{formatNumber(submittedCount)}</b><small>{submittedCount === 1 ? "video analizado" : "videos analizados"}</small></span></div>
            </div>

            {submittedCount === 0 ? (
              <div className="no-results"><div className="no-results-icon"><Search size={22} /></div><div><h3>No encontramos videos que cumplan todos los filtros actuales.</h3><p>Prueba ampliando alguno de los rangos.</p></div></div>
            ) : (
              <div className="table-card">
                <div className="table-toolbar"><span className="table-caption"><span className="table-live-dot" /> Videos públicos · ordenados por {sortLabel(results.sortBy)}</span><span className="table-result-count">{formatNumber(submittedCount)} de hasta {formatNumber(form.maxResults)}</span></div>
                <div className="table-scroll">
                  <table>
                    <thead><tr>
                      <th className="th-thumbnail">Vista previa</th><th className="th-video">Video</th><th className="th-channel">Canal</th><th className="th-published">Publicado</th><th className="th-duration">Duración</th><th className="th-number th-views">Vistas</th><th className="th-number th-likes">Me gusta</th><th className="th-number th-comments">Comentarios</th><th className="th-number th-subscribers">Suscriptores</th><th className="th-ratio">Vistas / subs</th>
                    </tr></thead>
                    <tbody>{results.items.map((item) => <ResultRow key={item.id} item={item} />)}</tbody>
                  </table>
                </div>
                <div className="table-note"><Clock3 size={14} /> Las vistas/suscriptores usan los datos públicos visibles al momento de esta consulta. El recuento de suscriptores puede estar redondeado u oculto por YouTube.</div>
              </div>
            )}
          </section>
        )}

        <footer className="page-footer"><span>AD YOUTUBE RESEARCH <i>·</i> V0.02</span><span>Investigación interna de oportunidades en YouTube <ArrowUpRight size={12} /></span></footer>
      </div>
    </main>
  );
}
