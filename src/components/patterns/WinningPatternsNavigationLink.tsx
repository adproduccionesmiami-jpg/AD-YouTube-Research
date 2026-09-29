import Link from "next/link";
import { Sparkles } from "lucide-react";
import styles from "./patterns.module.css";

export default function WinningPatternsNavigationLink() {
  return <Link className={styles.navLink} href="/patrones"><Sparkles size={15} aria-hidden="true" /><span>Patrones ganadores</span></Link>;
}
