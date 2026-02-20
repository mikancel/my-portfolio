"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    mq.addEventListener("change", (e) => setDark(e.matches));
  }, []);

  const toggle = () => setDark(!dark);

  const theme = {
    bg: dark ? "#1a1a1a" : "#ffffff",
    text: dark ? "#e8e8e8" : "#111111",
    sub: dark ? "#999999" : "#6b7280",
    border: dark ? "#2e2e2e" : "#f3f4f6",
    cardBg: dark ? "#222222" : "#ffffff",
    accent: dark ? "#c4854a" : "#f68827",
  };

  return (
    <main style={{ minHeight: "100vh", backgroundColor: theme.bg, color: theme.text, transition: "background 0.3s, color 0.3s" }}>

      {/* Nav */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 32px", borderBottom: `1px solid ${theme.border}` }}>
        <span style={{ fontWeight: "bold", fontSize: "18px", letterSpacing: "-0.5px" }}>
          <span style={{ color: theme.accent }}>mikancel</span>
          <span style={{ color: theme.text }}>.com</span>
        </span>
        <ul style={{ display: "flex", gap: "32px", fontSize: "14px", listStyle: "none", margin: 0, padding: 0 }}>
          <li><a href="#contact" style={{ color: theme.sub, textDecoration: "none" }}>Contact</a></li>
        </ul>
      </nav>

      {/* Hero */}
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "128px 32px" }}>
        <h1 style={{ fontSize: "48px", fontWeight: "bold", marginBottom: "40px", lineHeight: 1.2 }}>
          Welcome to <span style={{ color: theme.accent }}>mikancel</span><span style={{ color: theme.text }}>.com</span>
        </h1>
      </section>

      {/* Contact */}
      <section id="contact" style={{ padding: "96px 32px", maxWidth: "672px", margin: "0 auto" }}>
        <p style={{ fontSize: "12px", color: theme.sub, marginBottom: "8px" }}>Contact</p>
        <h2 style={{ fontSize: "30px", fontWeight: "bold", marginBottom: "32px" }}>連絡先</h2>
        <a href="https://x.com/kankitsu_mikan" target="_blank" style={{ display: "flex", alignItems: "center", gap: "12px", border: `1px solid ${theme.border}`, borderRadius: "16px", padding: "16px 24px", textDecoration: "none", color: theme.text, backgroundColor: theme.cardBg }}>
          <span style={{ fontWeight: "bold" }}>X</span>
          <span>&#64;kankitsu_mikan</span>
        </a>
      </section>

      {/* Footer */}
      <footer style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "14px", color: theme.sub, padding: "32px", borderTop: `1px solid ${theme.border}` }}>
        <span>© 2026 mikancel.</span>
        <button onClick={toggle} style={{ position: "absolute", right: "32px", background: "none", border: `1px solid ${theme.border}`, borderRadius: "20px", padding: "4px 12px", cursor: "pointer", fontSize: "14px", color: theme.sub }}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>
    </main>
  );
}