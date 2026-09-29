import Link from "next/link";
import { Radar } from "lucide-react";
import styles from "./competitor.module.css";

export default function CompetitorNavigationLink() {
  return (
    <Link className={styles.navLink} href="/competencia" aria-label="Analizar competencia">
      <Radar size={15} aria-hidden="true" />
      <span className={styles.navLabel}>Analizar competencia</span>
    </Link>
  );
}
