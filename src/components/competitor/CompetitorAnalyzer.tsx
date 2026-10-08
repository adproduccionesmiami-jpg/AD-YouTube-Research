"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, BarChart3, LoaderCircle, Search, Sparkles, Trophy } from "lucide-react";
import type { CompetitorReport } from "@/types/competitor";
import CompetitorReportView, { type VideoSortKey } from "./CompetitorReportView";
import styles from "./competitor.module.css";

type ApiFailure = { error?: { code?: string; message?: string } };

export default function CompetitorAnalyzer() {
  const [channel, setChannel] = useState("");
  const [report, setReport] = useState<CompetitorReport | null>(null);
  const [error, setError] = useState<ApiFailure["error"] | null>(null);
  const [sortBy, setSortBy] = useState<VideoSortKey>("views");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/youtube/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channel.trim() }),
      });
      const payload = await response.json() as CompetitorReport & ApiFailure;
      if (!response.ok) {
        setReport(null);
        setError(payload.error ?? { code: "YOUTUBE_ERROR", message: "No se pudo analizar el canal. Inténtalo de nuevo." });
        return;
      }
      setReport(payload);
      setSortBy("views");
    } catch {
      setReport(null);
      setError({ code: "NETWORK_ERROR", message: "No se pudo completar el análisis. Comprueba la conexión e inténtalo de nuevo." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <section className={styles.formCard} aria-labelledby="competitor-form-heading">
        <div className={styles.formHeading}>
          <span className={styles.formIcon}><Search size={16} /></span>
          <div><h2 id="competitor-form-heading">Canal a analizar</h2><p>Pega un canal público para analizar su rendimiento reciente, videos ganadores y patrones detectados.</p></div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <label className={styles.field} htmlFor="competitor-channel">
              Canal de YouTube
              <span className={styles.inputWrap}><Search size={15} /><input id="competitor-channel" autoComplete="off" maxLength={1000} required value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="Pega una URL, @handle o ID del canal" /></span>
            </label>
            <button className={styles.submitButton} type="submit" disabled={isLoading || !channel.trim()}>
              {isLoading ? <LoaderCircle className={styles.spin} size={16} /> : <Search size={16} />}
              {isLoading ? "Analizando canal…" : "Analizar competencia"}
            </button>
          </div>
          <p className={styles.formHint}>Analiza hasta <strong>50 videos públicos recientes</strong> para entender el rendimiento y las señales que se repiten.</p>
        </form>
        {error && <div className={styles.errorBox} role="alert"><AlertTriangle size={15} /><span><strong>{error.code ?? "ERROR"}:</strong> {error.message ?? "No se pudo completar el análisis."}</span></div>}
      </section>
      {!report && !isLoading && (
        <section className={styles.entryPreview} aria-label="Qué obtendrás del análisis">
          <article className={styles.entryPreviewCard}>
            <span className={styles.entryPreviewIcon}><BarChart3 size={17} /></span>
            <div><h3>Rendimiento</h3><p>Compara el comportamiento reciente del canal.</p></div>
          </article>
          <article className={styles.entryPreviewCard}>
            <span className={styles.entryPreviewIcon}><Trophy size={17} /></span>
            <div><h3>Videos ganadores</h3><p>Identifica contenidos que superan su línea base.</p></div>
          </article>
          <article className={styles.entryPreviewCard}>
            <span className={styles.entryPreviewIcon}><Sparkles size={17} /></span>
            <div><h3>Patrones detectados</h3><p>Descubre señales que aparecen repetidamente entre los mejores videos.</p></div>
          </article>
        </section>
      )}
      {isLoading && <div className={styles.loadingBox} role="status" aria-live="polite"><LoaderCircle className={styles.spin} size={19} />Consultando la identidad del canal y su muestra reciente de videos…</div>}
      {report && <CompetitorReportView report={report} sortBy={sortBy} onSortChange={setSortBy} />}
    </>
  );
}
