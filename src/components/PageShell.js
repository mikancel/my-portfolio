import Link from "next/link";
import ThemeMenu from "@/components/ThemeMenu";
import styles from "./PageShell.module.css";

// /uses /now /map など、コンテンツ系ページ共通の外枠（nav + footer）
export default function PageShell({ children }) {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.navLogo}>
          <span className={styles.accent}>mikancel</span>.com
        </Link>
      </nav>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <span>&#169; 2026 mikancel.</span>
        <div className={styles.themeMenuWrap}>
          <ThemeMenu />
        </div>
      </footer>
    </div>
  );
}
