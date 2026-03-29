"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./page.module.css";

const SKELETON_WIDTHS = [65, 85, 45, 75, 55, 90, 40];

export default function Home() {
  const [dark, setDark] = useState(false);
  const [langs, setLangs] = useState(null);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark) => {
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      setDark(isDark);
    };
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
  }, []);

  useEffect(() => {
    fetch("/api/languages").then((r) => r.json()).then((data) => {
      setLangs(typeof data === "object" ? data : {});
    });
  }, []);

  useEffect(() => {
    fetch("/api/blog")
      .then((r) => r.json())
      .then((d) => setRecentPosts(d.posts?.slice(0, 3) || []))
      .catch(() => {});
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    setDark(next);
  };

  const total = langs ? Object.values(langs).reduce((a, b) => a + b, 0) : 0;

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <a href="#" className={styles.navLogo}>
          <span className={styles.accent}>mikancel</span>.com
        </a>
      </nav>

      <section className={styles.hero}>
        <h1>Welcome to <span className={styles.accent}>mikancel</span>.com</h1>
      </section>

      {/* 言語 */}
      <section id="languages" className={styles.langs}>
        <p className={styles.sectionLabel}>Languages</p>
        <h2>使用言語</h2>
        {langs === null ? (
          SKELETON_WIDTHS.map((w, i) => (
            <div key={i} className={styles.skeletonLangItem}>
              <div className={styles.skeletonLangLabel}>
                <div className={`${styles.skeleton} ${styles.skeletonLangName}`} style={{ width: `${w}px` }} />
                <div className={`${styles.skeleton} ${styles.skeletonLangPct}`} />
              </div>
              <div className={`${styles.skeleton} ${styles.skeletonBar}`} />
            </div>
          ))
        ) : (
          Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, bytes]) => {
              const pct = Math.round((bytes / total) * 100);
              return (
                <div key={lang} className={styles.langItem}>
                  <div className={styles.langLabel}>
                    <span>{lang}</span><span>{pct}%</span>
                  </div>
                  <div className={styles.langBar}>
                    <div className={styles.langFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
        )}
      </section>

      {/* ブログ */}
      <section id="blog" className={styles.blogSection}>
        <p className={styles.sectionLabel}>Blog</p>
        <h2>ブログ</h2>
        <div className={styles.blogList}>
          {recentPosts.length === 0 ? (
            <p className={styles.blogEmpty}>記事はまだありません</p>
          ) : (
            recentPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.id}`} className={styles.blogCard}>
                <div className={styles.blogCardThumb}>
                  {post.thumbnail
                    ? <img src={post.thumbnail} alt={post.title} />
                    : <span>{post.title?.charAt(0)}</span>}
                </div>
                <span className={styles.blogCardTitle}>{post.title}</span>
              </Link>
            ))
          )}
        </div>
        <Link href="/blog">すべての記事を見る →</Link>
      </section>

      {/* ソーシャル */}
      <section id="social" className={styles.contact}>
        <p className={styles.sectionLabel}>Social</p>
        <h2>ソーシャル</h2>
        <a href="https://x.com/kankitsu_mikan" target="_blank" className={styles.contactLink}>
          <span>X</span><span>&#64;kankitsu_mikan</span>
        </a>
        <a href="https://github.com/mikancel" target="_blank" className={styles.contactLink}>
          <span>GitHub</span><span>mikancel</span>
        </a>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>
    </main>
  );
}
