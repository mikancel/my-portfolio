"use client";
import { useState, useEffect } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [dark, setDark] = useState(false);
  const [langs, setLangs] = useState({});

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
    async function fetchLangs() {
      const repos = await fetch("https://api.github.com/users/mikancel/repos").then(r => r.json());
      const totals = {};
      await Promise.all(repos.map(async (repo) => {
        const data = await fetch(repo.languages_url).then(r => r.json());
        Object.entries(data).forEach(([lang, bytes]) => {
          totals[lang] = (totals[lang] || 0) + bytes;
        });
      }));
      setLangs(totals);
    }
    fetchLangs();
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    setDark(next);
  };

  const total = Object.values(langs).reduce((a, b) => a + b, 0);

  return (
    <main className={styles.main}>

      <nav className={styles.nav}>
        <span className={styles.navLogo}>
          <span className={styles.accent}>mikancel</span>.com
        </span>
        <ul className={styles.navLinks}>
          <li><a href="#languages">Languages</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      <section className={styles.hero}>
        <h1>
          Welcome to <span className={styles.accent}>mikancel</span>.com
        </h1>
      </section>

      {Object.keys(langs).length > 0 && (
        <section id="languages"  className={styles.langs}>
          <p className={styles.sectionLabel}>Languages</p>
          <h2>使用言語</h2>
          {Object.entries(langs)
            .sort((a, b) => b[1] - a[1])
            .map(([lang, bytes]) => {
              const pct = Math.round((bytes / total) * 100);
              return (
                <div key={lang} className={styles.langItem}>
                  <div className={styles.langLabel}>
                    <span>{lang}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className={styles.langBar}>
                    <div className={styles.langFill} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
        </section>
      )}

      <section id="contact" className={styles.contact}>
        <p className={styles.sectionLabel}>Contact</p>
        <h2>連絡先</h2>
        <a href="https://x.com/kankitsu_mikan" target="_blank" className={styles.contactLink}>
          <span>X</span>
          <span>&#64;kankitsu_mikan</span>
        </a>
        <a href="https://github.com/mikancel" target="_blank" className={styles.contactLink}>
          <span>GitHub</span>
          <span>mikancel</span>
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