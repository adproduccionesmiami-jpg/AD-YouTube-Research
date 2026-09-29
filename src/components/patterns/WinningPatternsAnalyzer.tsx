"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, ArrowUpRight, LoaderCircle, Search, Sparkles, Trophy } from "lucide-react";
import type { CompetitorReport } from "@/types/competitor";
import type { WinningPatternsAnalysis, WinningPattern } from "@/types/winning-patterns";
import { analyzeWinningPatterns } from "@/lib/winning-patterns";
import styles from "./patterns.module.css";

type ApiFailure = { error?: { code?: string; message?: string } };
const number = (value: number | null, digits = 1) => value === null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits }).format(value);
const ratio = (value: number | null) => value === null ? "—" : `${number(value, 2)}x`;
const percent = (value: number | null) => value === null ? "—" : `${number(value * 100, 1)}%`;
const STATUS: Record<WinningPattern["status"], string> = { consolidated: "Patrón consolidado", promising: "Patrón prometedor", emerging: "Señal emergente" };

function PatternTable({ title, items, selected, onSelect, emerging = false }: { title: string; items: WinningPattern[]; selected: string | null; onSelect: (id: string) => void; emerging?: boolean }) {
  return <section className={styles.section}>
    <div className={styles.sectionHeading}><div><h2>{title}</h2><p>{emerging ? "Combinaciones de muestra pequeña con rendimiento relativo excepcional." : "Orden explícito: número de winners, Views/Median, lift y soporte."}</p></div><span className={styles.count}>{items.length}</span></div>
    {emerging && <div className={styles.emergingNote}><AlertTriangle size={15} />Muestra pequeña: señal prometedora, no patrón consolidado.</div>}
    {!items.length ? <div className={styles.empty}>Aún no hay combinaciones con soporte suficiente en esta muestra.</div> : <div className={styles.tableWrap}><table><thead><tr><th>Patrón</th><th>Videos</th><th>Winners</th><th>Views/Median</th><th>Views/Subs</th><th>Views/Day</th><th>Lift</th><th>Duración</th><th>Estado</th></tr></thead><tbody>{items.map((pattern) => <tr key={pattern.id} className={selected === pattern.id ? styles.selected : ""} onClick={() => onSelect(pattern.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(pattern.id); } }}>
      <td className={styles.patternName}>{pattern.label}</td><td>{pattern.supportingVideoCount}</td><td>{pattern.winnerCount}</td><td>{ratio(pattern.averageViewsVsMedian)}</td><td>{ratio(pattern.averageViewsToSubscribers)}</td><td>{number(pattern.averageViewsPerDay)}</td><td>{ratio(pattern.lift)}</td><td>{pattern.durationRange.label}</td><td><span className={`${styles.status} ${styles[pattern.status]}`}>{STATUS[pattern.status]}</span></td>
    </tr>)}</tbody></table></div>}
  </section>;
}

function PatternDetail({ pattern, report }: { pattern: WinningPattern; report: WinningPatternsAnalysis }) {
  const elements = [
    ["Tema", pattern.topics], ["Intención", pattern.intents], ["Dolor", pattern.pains], ["Beneficio", pattern.benefits], ["Contexto", pattern.contexts], ["Entidad", pattern.entities], ["Estructura", pattern.titleStructures], ["Frases recurrentes", pattern.recurringPhrases],
  ].filter(([, values]) => (values as string[]).length > 0) as Array<[string, string[]]>;
  const evidenceIds = new Set(pattern.supportingVideoIds);
  const evidence = pattern.evidence;
  const variation = new Map<string, Set<string>>();
  for (const item of evidence) for (const signal of item.semanticSignals) {
    const terms = variation.get(signal.dimension) ?? new Set<string>();
    terms.add(signal.term); variation.set(signal.dimension, terms);
  }
  const varied = [...variation.entries()].filter(([, terms]) => terms.size > 1).map(([dimension, terms]) => `${dimension.toLocaleLowerCase("es")}: ${[...terms].join(" / ")}`);
  return <section className={styles.section}>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}><Trophy size={13} /> DESGLOSE DE EVIDENCIA</p><h2>{pattern.label}</h2><p>{report.channelName} · {pattern.supportingVideoCount} videos de soporte, {pattern.winnerCount} winners.</p></div><a className={styles.channelLink} href={report.channelUrl} target="_blank" rel="noreferrer">Abrir canal <ArrowUpRight size={13} /></a></div>
    <div className={styles.metrics}>{[["Views promedio", number(pattern.averageViews)], ["Views/Median promedio", ratio(pattern.averageViewsVsMedian)], ["Views/Subs promedio", ratio(pattern.averageViewsToSubscribers)], ["Views/Day promedio", number(pattern.averageViewsPerDay)], ["Winner share", percent(pattern.winnerShare)], ["Baseline share", percent(pattern.baselineShare)], ["Lift", ratio(pattern.lift)], ["Duración observada", pattern.durationRange.label]].map(([label, value]) => <div className={styles.metric} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className={styles.detailGrid}><div className={styles.detailCard}><h3>Elementos compartidos</h3>{elements.length ? elements.map(([label, values]) => <p key={label}><b>{label}:</b> {values.join(" · ")}</p>) : <p>La muestra no aporta etiquetas semánticas suficientes.</p>}</div><div className={styles.detailCard}><h3>Espacio observado</h3><p>Descripción de señales presentes; no genera títulos ni recomienda una fórmula nueva.</p>{report.observedSpace.slice(0, 5).map((item) => <span className={styles.spaceTag} key={`${item.dimension}-${item.term}`}>{item.term} · {item.videoCount}</span>)}<p className={styles.muted}>{varied.length ? `Otras señales que varían entre los videos: ${varied.join("; ")}.` : "La muestra no detecta variaciones semánticas adicionales en los videos de soporte."}</p></div></div>
    <div className={styles.evidenceHeading}><h3>Videos que soportan el patrón</h3><span>{evidenceIds.size} evidencias</span></div>
    <div className={styles.evidenceList}>{evidence.map((video) => <article key={video.id} className={styles.evidence}><div><a href={video.videoUrl} target="_blank" rel="noreferrer">{video.title}<ArrowUpRight size={12} /></a><span>{video.isWinner ? "Winner" : "Video de soporte"} · {video.durationSeconds === null ? "Duración no disponible" : `${number(video.durationSeconds / 60, 0)} min`} · {number(video.views)} views</span></div><strong>{ratio(video.metrics.viewsVsMedian)} mediana · {ratio(video.metrics.viewsToSubscribers)} subs · {number(video.metrics.viewsPerDay)} / día</strong></article>)}</div>
  </section>;
}

export default function WinningPatternsAnalyzer() {
  const [channel, setChannel] = useState("");
  const [analysis, setAnalysis] = useState<WinningPatternsAnalysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<ApiFailure["error"] | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try {
      const response = await fetch("/api/youtube/competitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: channel.trim() }) });
      const payload = await response.json() as CompetitorReport & ApiFailure;
      if (!response.ok) { setAnalysis(null); setError(payload.error ?? { message: "No se pudo analizar el canal." }); return; }
      const next = analyzeWinningPatterns(payload);
      setAnalysis(next); setSelectedId(next.patterns[0]?.id ?? next.emergingSignals[0]?.id ?? null);
    } catch { setAnalysis(null); setError({ message: "No se pudo conectar con el servidor. Comprueba la conexión e inténtalo de nuevo." }); }
    finally { setLoading(false); }
  }

  const allPatterns = analysis ? [...analysis.patterns, ...analysis.emergingSignals] : [];
  const selected = allPatterns.find((item) => item.id === selectedId) ?? null;
  return <>
    <section className={styles.formCard}><div className={styles.formHeading}><span><Search size={16} /></span><div><h2>Canal de referencia</h2><p>Se reutiliza el mismo análisis de competencia y su muestra reciente.</p></div></div><form onSubmit={submit}><div className={styles.formRow}><label htmlFor="pattern-channel">URL YouTube, @handle o channel ID<input id="pattern-channel" required autoComplete="off" maxLength={1000} value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="youtube.com/@canal · @canal · UC…" /></label><button type="submit" disabled={loading || !channel.trim()}>{loading ? <LoaderCircle className={styles.spin} size={16} /> : <Sparkles size={16} />}{loading ? "Analizando…" : "Descubrir patrones"}</button></div><p className={styles.formHint}>Mismo coste de consulta que Analizar competencia: usa la muestra ya optimizada, sin búsquedas adicionales para extraer patrones. Las URL antiguas /c/ pueden requerir la búsqueda de resolución existente.</p></form>{error && <div className={styles.error} role="alert"><AlertTriangle size={15} />{error.message}</div>}</section>
    {loading && <div className={styles.loading} role="status"><LoaderCircle className={styles.spin} size={18} />Consultando el reporte existente y buscando combinaciones repetidas…</div>}
    {analysis && <div className={styles.report}><section className={styles.identity}><div><p className={styles.eyebrow}>CANAL ANALIZADO</p><h2>{analysis.channelName}</h2><p>{analysis.sampleSize} videos analizados · combinaciones derivadas del mismo reporte competitivo</p></div><a href={analysis.channelUrl} target="_blank" rel="noreferrer">Ver canal <ArrowUpRight size={13} /></a></section>
      <div className={styles.summary}><div><span>Patrones principales</span><strong>{analysis.patterns.length}</strong></div><div><span>Señales emergentes</span><strong>{analysis.emergingSignals.length}</strong></div><div><span>Muestra del canal</span><strong>{analysis.sampleSize}</strong></div></div>
      <PatternTable title="Patrones ganadores" items={analysis.patterns} selected={selectedId} onSelect={setSelectedId} />
      <PatternTable title="Señales emergentes" items={analysis.emergingSignals} selected={selectedId} onSelect={setSelectedId} emerging />
      {selected && <PatternDetail pattern={selected} report={analysis} />}
    </div>}
  </>;
}
