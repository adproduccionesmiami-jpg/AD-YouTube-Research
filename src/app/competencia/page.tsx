import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CompetitorAnalyzer from "@/components/competitor/CompetitorAnalyzer";
import styles from "@/components/competitor/competitor.module.css";

export const metadata = {
  title: "Analizar competencia | AD YouTube Research",
  description: "Análisis descriptivo de canales públicos y su rendimiento en YouTube.",
};

export default function CompetitorPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="AD YouTube Research, inicio">
          <span className={styles.brandMark}>AD</span>
          <span className={styles.brandName}>AD <strong>YouTube Research</strong></span>
        </Link>
        <Link className={styles.homeLink} href="/"><ArrowLeft size={14} /><span>Research de videos</span></Link>
      </header>
      <main className={styles.content}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}><span className={styles.eyebrowLine} /> INTELIGENCIA COMPETITIVA</p>
          <h1>Analizar <span>competencia.</span></h1>
          <p>Obtén una radiografía verificable de lo que publica un canal, qué rinde por encima de su propia muestra y qué patrones se repiten.</p>
        </section>
        <CompetitorAnalyzer />
      </main>
    </div>
  );
}
