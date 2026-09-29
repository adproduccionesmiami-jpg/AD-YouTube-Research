import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WinningPatternsAnalyzer from "@/components/patterns/WinningPatternsAnalyzer";
import styles from "@/components/patterns/patterns.module.css";

export const metadata = {
  title: "Patrones ganadores | AD YouTube Research",
  description: "Descubre combinaciones que se repiten en los videos que superan el rendimiento normal de un canal.",
};

export default function WinningPatternsPage() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/" aria-label="AD YouTube Research, inicio"><span className={styles.brandMark}>AD</span><span className={styles.brandName}>AD <strong>YouTube Research</strong></span></Link>
      <Link className={styles.homeLink} href="/"><ArrowLeft size={14} /><span>Research de videos</span></Link>
    </header>
    <main className={styles.content}>
      <section className={styles.intro}><p className={styles.eyebrow}><span className={styles.eyebrowLine} /> INTELIGENCIA DE PATRONES</p><h1>Patrones <span>ganadores.</span></h1><p>Descubre qué combinaciones se repiten detrás de los videos que superan el rendimiento normal del nicho.</p></section>
      <WinningPatternsAnalyzer />
    </main>
  </div>;
}
