"use client";

import Image from "next/image";
import { AlertCircle, CalendarDays, CircleHelp, ExternalLink, Eye, Film, Info, Play, Sparkles, Trophy, Users, WandSparkles } from "lucide-react";
import { formatDate, formatDuration, formatNumber } from "@/lib/youtube-format";
import type { CompetitorReport, KeywordInsight, KeywordSource } from "@/types/competitor";
import styles from "./competitor.module.css";

export type VideoSortKey = "views" | "subscribers" | "median" | "perDay" | "recent";

function compact(value: number | null): string {
  if (value === null) return "No disponible";
  return new Intl.NumberFormat("es-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function ratio(value: number | null): string {
  return value === null ? "No disponible" : `${value.toLocaleString("es-US", { maximumFractionDigits: 2 })}x`;
}

function percent(value: number | null): string {
  return value === null ? "No disponible" : `${value}%`;
}

function dateLabel(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "No disponible";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).filter((word) => !["de", "del", "la", "el", "the", "of", "and", "y"].includes(word.toLocaleLowerCase("es")));
  return (words.length ? words : [name]).slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase() || "YT";
}

function ImageWithFallback({ src, name, size }: { src: string | null; name: string; size: "avatar" | "thumbnail" }) {
  const imageClass = size === "avatar" ? styles.avatar : styles.thumb;
  return (
    <span className={imageClass}>
      <span className={styles.avatarFallback} aria-hidden="true">{size === "avatar" ? initials(name) : <Play size={17} fill="currentColor" />}</span>
      {src && <Image src={src} alt="" fill unoptimized sizes={size === "avatar" ? "72px" : "82px"} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function KeywordTable({ items, winnerMode = false }: { items: KeywordInsight[]; winnerMode?: boolean }) {
  if (!items.length) return <div className={styles.empty}>{winnerMode ? "Aún no hay términos compartidos por videos ganadores." : "La muestra no contiene términos repetidos suficientes."}</div>;
  const sourceLabel: Record<KeywordSource, string> = { título: "Título", descripción: "Descripción", tag_real_youtube: "Tag real de YouTube" };
  return (
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <thead><tr><th>Término</th><th>Categoría</th><th>Videos</th><th>En winners</th><th>Presencia</th><th>Origen</th><th>Promedios</th><th>Ejemplos</th></tr></thead>
        <tbody>{items.map((item) => (
          <tr key={`${item.term}-${item.category}`}>
            <td><span className={styles.term}>{item.term}</span><div className={styles.videoExamples}>{item.occurrences} apariciones</div></td>
            <td><span className={styles.category}>{item.category}</span></td>
            <td>{item.videoFrequency}</td>
            <td>{item.winnerFrequency}</td>
            <td>{winnerMode ? `${item.winnerLift ?? "—"}x vs muestra` : percent(item.baselineShare === null ? null : Math.round(item.baselineShare * 100))}</td>
            <td><div className={styles.sourceList}>{item.sources.map((source) => <span className={styles.sourceTag} key={source}>{sourceLabel[source]}</span>)}</div></td>
            <td><div className={styles.videoExamples}>Vistas: {compact(item.averageViews)}<br />Vistas/Subs: {ratio(item.averageViewsToSubscribers)}<br />Vistas/Median: {ratio(item.averageViewsVsMedian)}</div></td>
            <td><details><summary>{item.videoIds.length} videos</summary><ul>{item.exampleTitles.map((title, index) => <li key={`${item.term}-${index}`}>{title}</li>)}</ul></details></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className={styles.metricCard}><span className={styles.metricLabel}>{label}</span><strong className={styles.metricValue}>{value}</strong>{note && <small className={styles.metricNote}>{note}</small>}</div>;
}

export default function CompetitorReportView({ report, sortBy, onSortChange }: {
  report: CompetitorReport;
  sortBy: VideoSortKey;
  onSortChange: (value: VideoSortKey) => void;
}) {
  const patterns = report.titlePatterns;
  const groups: Array<[string, string[]]> = [
    ["Qué publica", report.fingerprint.whatItPublishes],
    ["Qué le funciona", report.fingerprint.whatWorks],
    ["Qué repite", report.fingerprint.whatItRepeats],
    ["Palabras frecuentes", report.fingerprint.commonWords],
    ["Palabras de winners", report.fingerprint.winnerWords],
    ["Estructuras de título", report.fingerprint.titleStructures],
    ["Duraciones", report.fingerprint.durations],
    ["Cadencia observada", report.fingerprint.cadence],
    ["Concentración de vistas", report.fingerprint.successConcentration],
  ];
  const sourceVideos = [...report.videos];
  sourceVideos.sort((a, b) => {
    if (sortBy === "recent") return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    const value = (video: typeof a) => sortBy === "views" ? video.views : sortBy === "subscribers" ? video.metrics.viewsToSubscribers : sortBy === "median" ? video.metrics.viewsVsMedian : video.metrics.viewsPerDay;
    return (value(b) ?? -1) - (value(a) ?? -1);
  });

  return (
    <div className={styles.report}>
      <section className={styles.identityCard} aria-label="Identidad del canal analizado">
        <ImageWithFallback src={report.channel.avatar} name={report.channel.name} size="avatar" />
        <div>
          <h2 className={styles.channelName}>{report.channel.name}</h2>
          <p className={styles.channelHandle}>{report.channel.handle ?? "Handle no disponible"} · ID: {report.channel.id}</p>
          {report.channel.description && <p className={styles.channelDescription}>{report.channel.description}</p>}
          <div className={styles.identityMeta}>
            <span><CalendarDays size={12} /> Creado: {dateLabel(report.channel.createdAt)} · {report.channelMetrics.ageLabel ?? "antigüedad no disponible"}</span>
            <span><Eye size={12} /> País: {report.channel.country ?? "No disponible"}</span>
          </div>
        </div>
        <a className={styles.channelExternal} href={report.channel.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} /> Abrir canal</a>
      </section>

      <section className={styles.metricGrid} aria-label="Métricas del canal y la muestra">
        <MetricCard label="Suscriptores" value={compact(report.channel.subscribers)} note="Actuales del canal" />
        <MetricCard label="Vistas totales" value={compact(report.channel.totalViews)} note="Histórico del canal" />
        <MetricCard label="Videos del canal" value={compact(report.channel.totalVideoCount)} note="Dato de YouTube" />
        <MetricCard label="Promedio de vistas" value={compact(report.sample.averageViews)} note={`${report.sample.videosWithViews} videos con dato de vistas`} />
        <MetricCard label="Mediana de vistas" value={compact(report.sample.medianViews)} note={`${report.sample.videosWithViews} videos con dato de vistas`} />
        <MetricCard label="Videos por semana" value={report.cadence.videosPerWeek === null ? "No disponible" : `≈${report.cadence.videosPerWeek}`} note="Estimación sobre la muestra reciente" />
      </section>

      <div className={styles.sampleNote}><Info size={14} /><span>Las métricas de rendimiento se calculan sobre <strong>{report.sample.analyzed} videos públicos recientes</strong>, no sobre todo el historial. Los promedios usan solo registros con la métrica disponible ({report.sample.videosWithViews} con vistas). Publicados entre {dateLabel(report.sample.firstPublishedAt)} y {dateLabel(report.sample.lastPublishedAt)}. La muestra inicial está limitada a 50 videos.</span></div>
      {report.warnings.length > 0 && <div className={styles.warningList}>{report.warnings.map((warning) => <div className={styles.warning} key={warning}><AlertCircle size={13} />{warning}</div>)}</div>}

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Videos de la muestra</h2><p className={styles.sectionSubtitle}>Ordena localmente. Los cambios de orden no consultan YouTube.</p></div><span className={styles.sectionBadge}>{report.sample.analyzed} analizados</span></div>
        <div className={styles.toolbar}>
          <span className={styles.toolbarNote}>Views/Subs y Views/Median usan suscriptores actuales y la mediana de esta muestra.</span>
          <label className={styles.sortField}>Ordenar por
            <select value={sortBy} onChange={(event) => onSortChange(event.target.value as VideoSortKey)}>
              <option value="views">Más vistas</option><option value="subscribers">Views/Subs</option><option value="median">Views/Median</option><option value="perDay">Views/Day</option><option value="recent">Más recientes</option>
            </select>
          </label>
        </div>
        {!sourceVideos.length ? <div className={styles.empty}>Este canal no tiene videos públicos disponibles en la muestra consultada.</div> : (
          <div className={styles.tableScroll}>
            <table className={styles.videoTable}>
              <thead><tr><th>Miniatura</th><th>Video</th><th>Fecha</th><th>Duración</th><th>Vistas</th><th>Vistas/Subs</th><th>Views/Median</th><th>Views/Day</th><th>Señal winner</th></tr></thead>
              <tbody>{sourceVideos.map((video) => (
                <tr key={video.id}>
                  <td><a href={video.videoUrl} target="_blank" rel="noreferrer noopener" aria-label={`Abrir video ${video.title}`}><ImageWithFallback src={video.thumbnail} name={video.title} size="thumbnail" /></a></td>
                  <td><a className={styles.videoTitle} href={video.videoUrl} target="_blank" rel="noreferrer noopener" title={video.title}>{video.title}</a><span className={styles.videoDate}>Likes: {compact(video.likes)} · Comentarios: {compact(video.comments)}</span><details className={styles.tagDetails}><summary>Tags reales de YouTube: {video.youtubeTags === null ? "no disponibles" : video.youtubeTags.length ? video.youtubeTags.length : "sin tags"}</summary>{video.youtubeTags && video.youtubeTags.length > 0 && <span className={styles.tagList}>{video.youtubeTags.join(", ")}</span>}</details></td>
                  <td>{dateLabel(video.publishedAt)}</td><td>{formatDuration(video.durationSeconds)}</td><td className={styles.number}>{formatNumber(video.views)}</td>
                  <td><span className={`${styles.ratio} ${video.metrics.viewsToSubscribers !== null && video.metrics.viewsToSubscribers >= 2 ? styles.ratioStrong : ""}`}>{ratio(video.metrics.viewsToSubscribers)}</span></td>
                  <td><span className={`${styles.ratio} ${video.metrics.viewsVsMedian !== null && video.metrics.viewsVsMedian >= 2 ? styles.ratioStrong : ""}`}>{ratio(video.metrics.viewsVsMedian)}</span></td>
                  <td className={styles.number}>{compact(video.metrics.viewsPerDay)}</td>
                  <td>{video.isWinner ? <span className={styles.winnerDot}><Trophy size={11} /> Winner</span> : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Videos ganadores</h2><p className={styles.sectionSubtitle}>Señales transparentes: ≥2x mediana de la muestra, ≥2x suscriptores o ≥2x mediana de vistas/día.</p></div><span className={styles.sectionBadge}>{report.winners.length} detectados</span></div>
        {!report.winners.length ? <div className={styles.empty}>Ningún video alcanzó las señales definidas con esta muestra.</div> : (
          <div className={styles.winnerGallery}>{report.winners.slice(0, 12).map((video) => (
            <article className={styles.winnerCard} key={video.id}>
              <a className={styles.winnerImage} href={video.videoUrl} target="_blank" rel="noreferrer noopener"><ImageWithFallback src={video.thumbnail} name={video.title} size="thumbnail" /></a>
              <div className={styles.winnerBody}><a href={video.videoUrl} target="_blank" rel="noreferrer noopener">{video.title}</a><p>{compact(video.views)} vistas · {ratio(video.metrics.viewsVsMedian)} mediana</p><div className={styles.winnerSignals}>{video.winnerSignals.map((signal) => <span key={signal}>{signal}</span>)}</div></div>
            </article>
          ))}</div>
        )}
      </section>

      <div className={styles.twoColumns}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Inteligencia de palabras</h2><p className={styles.sectionSubtitle}>Términos extraídos de títulos, descripciones y tags reales disponibles.</p></div><span className={styles.sectionBadge}>Muestra completa</span></div>
          <KeywordTable items={report.keywords} />
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Palabras de videos ganadores</h2><p className={styles.sectionSubtitle}>Lift compara la presencia entre winners y la muestra. No es una causalidad.</p></div><span className={styles.sectionBadge}>Solo winners</span></div>
          <KeywordTable items={report.winnerKeywords} winnerMode />
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Patrones de títulos</h2><p className={styles.sectionSubtitle}>Descriptores calculados sobre los títulos de la muestra.</p></div><WandSparkles size={16} color="#b32b30" /></div>
          <div className={styles.textMetrics}>
            <div className={styles.miniMetric}><span>Promedio de caracteres</span><strong>{patterns.averageCharacters ?? "—"}</strong></div>
            <div className={styles.miniMetric}><span>Promedio de palabras</span><strong>{patterns.averageWords ?? "—"}</strong></div>
            <div className={styles.miniMetric}><span>Con números</span><strong>{percent(patterns.titlesWithNumbersPercent)}</strong></div>
            <div className={styles.miniMetric}><span>Con uso alto de mayúsculas</span><strong>{percent(patterns.titlesWithUppercasePercent)}</strong></div>
            <div className={styles.miniMetric}><span>Con signos destacados</span><strong>{percent(patterns.titlesWithPunctuationPercent)}</strong></div>
            <div className={styles.miniMetric}><span>Términos frecuentes</span><strong>{patterns.frequentTitleTerms.slice(0, 4).join(", ") || "—"}</strong></div>
          </div>
          <div className={styles.twoColumns}>
            <div><p className={styles.toolbarNote}>Inicios recurrentes</p><div className={styles.phraseList}>{patterns.recurringOpeners.length ? patterns.recurringOpeners.map((item) => <div key={item.phrase}><div className={styles.phraseItem}><strong>{item.phrase}</strong><span>×{item.count}</span></div><div className={styles.phraseExamples}>{item.examples.join(" · ")}</div></div>) : <span className={styles.empty}>Sin repetición clara.</span>}</div></div>
            <div><p className={styles.toolbarNote}>Cierres recurrentes</p><div className={styles.phraseList}>{patterns.recurringEndings.length ? patterns.recurringEndings.map((item) => <div key={item.phrase}><div className={styles.phraseItem}><strong>{item.phrase}</strong><span>×{item.count}</span></div><div className={styles.phraseExamples}>{item.examples.join(" · ")}</div></div>) : <span className={styles.empty}>Sin repetición clara.</span>}</div></div>
          </div>
          <div className={styles.phraseList} style={{ marginTop: 12 }}>
            <p className={styles.toolbarNote}>Fórmulas genéricas detectadas</p>
            {patterns.formulaPatterns.length ? patterns.formulaPatterns.map((item) => <div key={item.phrase}><div className={styles.phraseItem}><strong>{item.phrase}</strong><span>×{item.count}</span></div><div className={styles.phraseExamples}>{item.examples.join(" · ")}</div></div>) : <span className={styles.empty}>No se repite una fórmula reconocible en la muestra.</span>}
          </div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Clusters de temas</h2><p className={styles.sectionSubtitle}>Agrupación heurística interpretable a partir de títulos y términos recurrentes.</p></div><CircleHelp size={16} color="#8b929c" /></div>
          {!report.topicClusters.length ? <div className={styles.empty}>No hay datos suficientes para agrupar temas.</div> : <div className={styles.clusterScroll}><table className={styles.dataTable}><thead><tr><th>Tema/cluster</th><th>Videos</th><th>Vistas promedio</th><th>Views/Subs</th><th>Views/Median</th></tr></thead><tbody>{report.topicClusters.map((cluster) => <tr key={cluster.topic}><td className={styles.term}>{cluster.topic}</td><td>{cluster.videoCount}</td><td>{compact(cluster.averageViews)}</td><td>{ratio(cluster.averageViewsToSubscribers)}</td><td>{ratio(cluster.averageViewsVsMedian)}</td></tr>)}</tbody></table></div>}
        </section>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Patrón de publicación</h2><p className={styles.sectionSubtitle}>Describe la muestra; no atribuye causalidad.</p></div><CalendarDays size={16} color="#8b929c" /></div>
          <div className={styles.textMetrics}>
            <div className={styles.miniMetric}><span>Videos por semana</span><strong>{report.cadence.videosPerWeek === null ? "—" : `≈${report.cadence.videosPerWeek}`}</strong></div>
            <div className={styles.miniMetric}><span>Intervalo medio</span><strong>{report.cadence.averageIntervalDays === null ? "—" : `${report.cadence.averageIntervalDays} días`}</strong></div>
            <div className={styles.miniMetric}><span>Últimos 30 días</span><strong>{report.cadence.videosLast30Days}</strong></div>
            <div className={styles.miniMetric}><span>Duración media</span><strong>{report.cadence.averageDurationMinutes === null ? "—" : `${report.cadence.averageDurationMinutes} min`}</strong></div>
            <div className={styles.miniMetric}><span>Duración media winners</span><strong>{report.cadence.winnersAverageDurationMinutes === null ? "—" : `${report.cadence.winnersAverageDurationMinutes} min`}</strong></div>
            <div className={styles.miniMetric}><span>Muestra analizada</span><strong>{report.sample.analyzed} videos</strong></div>
          </div>
          <div className={styles.weekdayGrid}>{report.cadence.byWeekday.length ? report.cadence.byWeekday.map((item) => <div className={styles.weekday} key={item.weekday}><span>{item.weekday.slice(0, 3)}</span><strong>{item.count}</strong></div>) : <span className={styles.empty}>Fechas de publicación no disponibles.</span>}</div>
        </section>
        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>Concentración del éxito</h2><p className={styles.sectionSubtitle}>Porcentaje de las vistas observadas que corresponde a los videos con más vistas.</p></div><Users size={16} color="#8b929c" /></div>
          <div className={styles.concentrationGrid}>
            <div className={styles.concentrationCard}><span>Top 3</span><strong>{percent(report.concentration.top3Percent)}</strong></div>
            <div className={styles.concentrationCard}><span>Top 5</span><strong>{percent(report.concentration.top5Percent)}</strong></div>
            <div className={styles.concentrationCard}><span>Top 10</span><strong>{percent(report.concentration.top10Percent)}</strong></div>
          </div>
          <p className={styles.sectionSubtitle} style={{ marginTop: 10 }}>Vistas contabilizadas en la muestra: {compact(report.concentration.sampleViews)}. No representa el historial completo del canal.</p>
        </section>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeading}><div><h2 className={styles.sectionTitle}>AD Competitive Fingerprint</h2><p className={styles.sectionSubtitle}>Radiografía descriptiva generada con las métricas de esta muestra; no contiene recomendaciones automáticas.</p></div><Sparkles size={16} color="#b32b30" /></div>
        <div className={styles.fingerprint}>{groups.map(([title, items]) => <section className={styles.fingerprintGroup} key={title}><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul> : <span className={styles.empty}>No disponible con estos datos.</span>}</section>)}</div>
      </section>
      <p className={styles.sectionSubtitle}><Film size={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} /> Tags reales de YouTube se muestran de forma independiente; las keywords y clasificaciones son extracción heurística local, no etiquetas oficiales ni análisis de IA.</p>
    </div>
  );
}
