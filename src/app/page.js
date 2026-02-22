"use client";
import { useState, useEffect } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [dark, setDark] = useState(false);

useEffect(() => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = (isDark) => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    setDark(isDark);
  };
  apply(mq.matches);
  mq.addEventListener("change", (e) => apply(e.matches));
}, []);

const toggle = () => {
  const next = !dark;
  document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  setDark(next);
};

  return (
    <main className={styles.main}>

      <nav className={styles.nav}>
        <span className={styles.navLogo}>
          <span className={styles.accent}>mikancel</span>.com
        </span>
        <ul className={styles.navLinks}>
          <li><a href="#contact">Contact</a></li>
        </ul>
      </nav>

      <section className={styles.hero}>
        <h1>
          Welcome to <span className={styles.accent}>mikancel</span>.com
        </h1>
      </section>

      <section id="contact" className={styles.contact}>
        <p className={styles.sectionLabel}>Contact</p>
        <h2>連絡先</h2>
        <a href="https://x.com/kankitsu_mikan" target="_blank" className={styles.contactLink}>
          <span>X</span>
          <span>&#64;kankitsu_mikan</span>
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