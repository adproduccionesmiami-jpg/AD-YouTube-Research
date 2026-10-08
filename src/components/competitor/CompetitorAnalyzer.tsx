"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, LoaderCircle, Search } from "lucide-react";
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
          <div><h2 id="competitor-form-heading">Canal de referencia</h2><p>Analiza un canal público y descubre qué contenidos destacan dentro de su rendimiento reciente.</p></div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <label className={styles.field} htmlFor="competitor-channel">
              URL del canal, @handle o channel ID
              <span className={styles.inputWrap}><Search size={15} /><input id="competitor-channel" autoComplete="off" maxLength={1000} required value={channel} onChange={(event) => setChannel(event.target.value)} placeholder="youtube.com/@canal · @canal · UC…" /></span>
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
      {isLoading && <div className={styles.loadingBox} role="status" aria-live="polite"><LoaderCircle className={styles.spin} size={19} />Consultando la identidad del canal y su muestra reciente de videos…</div>}
      {report && <CompetitorReportView report={report} sortBy={sortBy} onSortChange={setSortBy} />}
    </>
  );
}
