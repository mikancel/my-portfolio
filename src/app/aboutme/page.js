"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./aboutme.module.css";

const TIMELINE = [
  { hash: "dec2001", message: "init: born" },
  { hash: "apr2020", message: "feat: started university" },
  { hash: "oct2022", message: "feat: studied abroad in Canada" },
  { hash: "mar2025", message: "feat: graduated from university" },
  { hash: "apr2026", message: "chore: working as a systems engineer" },
];

const SCRIPT = [
  { type: "prompt", text: "whoami" },
  { type: "out",    text: "mikancel" },
  { type: "prompt", text: "echo $ROLE" },
  { type: "out",    text: "SE / Developer" },
  { type: "prompt", text: "echo $LOCATION" },
  { type: "out",    text: "Aichi, Japan" },
  { type: "prompt", text: "" },
];

function useFadeIn(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, visible];
}

function CmdWindow({ onWhoami }) {
  const [lines, setLines] = useState([]);
  const [step, setStep] = useState(0);
  const [typing, setTyping] = useState("");
  const [phase, setPhase] = useState("typing");
  const [closed, setClosed] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (phase !== "typing") return;
    const current = SCRIPT[step];
    if (!current) return;

    if (current.type === "prompt") {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setTyping(current.text.slice(0, i));
        if (i >= current.text.length) {
          clearInterval(iv);
          setTimeout(() => {
            setLines(prev => [...prev, { type: "prompt", text: current.text }]);
            setTyping("");
            if (current.text === "whoami") onWhoami("name");
            if (current.text === "echo $ROLE") onWhoami("role");
            if (current.text === "echo $LOCATION") onWhoami("location");
            if (current.text === "") { setPhase("waiting"); return; }
            setStep(s => s + 1);
          }, current.text === "" ? 0 : 300);
        }
      }, current.text === "" ? 0 : 55);
      return () => clearInterval(iv);
    } else if (current.type === "blank") {
      setTimeout(() => {
        setLines(prev => [...prev, { type: "blank" }]);
        setStep(s => s + 1);
      }, 80);
    } else {
      setTimeout(() => {
        setLines(prev => [...prev, { type: "out", text: current.text }]);
        setStep(s => s + 1);
      }, 120);
    }
  }, [step, phase]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines, typing]);

  const onMouseDown = useCallback((e) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      setPos({
        x: dragStart.current.px + e.clientX - dragStart.current.mx,
        y: dragStart.current.py + e.clientY - dragStart.current.my,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  if (closed) return null;

  return (
    <div
      className={styles.cmdWin}
      style={{ transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)` }}
    >
      <div className={styles.cmdBar} onMouseDown={onMouseDown} style={{ cursor: "move" }}>
        <span className={styles.cmdBarTitle}>mikancel.exe</span>
        <div className={styles.cmdBtns}>
          <button className={`${styles.cmdBtn} ${styles.cmdClose}`} onClick={() => setClosed(true)}>&#10005;</button>
        </div>
      </div>
      <div className={styles.cmdBody} ref={bodyRef}>
        <p className={styles.cmdLine}>mikancel</p>
        <p className={styles.cmdLine}>&copy; 2026 mikancel. All rights reserved.</p>
        <p className={styles.cmdLine}>&nbsp;</p>
        {lines.map((l, i) => (
          <p key={i} className={styles.cmdLine}>
            {l.type === "prompt"
              ? <><span className={styles.cmdDir}>mikancel&#64;mikancel&#58;&#126;&#36;&nbsp;</span>{l.text}</>
              : l.type === "blank" ? <>&nbsp;</> : l.text}
          </p>
        ))}
        {phase === "typing" && SCRIPT[step]?.type === "prompt" && (
          <p className={styles.cmdLine}>
            <span className={styles.cmdDir}>mikancel&#64;mikancel&#58;&#126;&#36;&nbsp;</span>
            {typing}<span className={styles.cmdCursor}>&#9608;</span>
          </p>
        )}
        {phase === "waiting" && (
          <p className={styles.cmdLine}>
            <span className={styles.cmdDir}>mikancel&#64;mikancel&#58;&#126;&#36;&nbsp;</span>
            <span className={styles.cmdCursor}>&#9608;</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function AboutMe() {
  const [dark, setDark] = useState(false);
  const [showName, setShowName] = useState(false);
  const [showRole, setShowRole] = useState(false);
  const [showLocation, setShowLocation] = useState(false);

  const [refProfile,   visProfile]   = useFadeIn();
  const [refStack,     visStack]     = useFadeIn();
  const [refInterests, visInterests] = useFadeIn();
  const [refTimeline,  visTimeline]  = useFadeIn();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark) => {
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
      setDark(isDark);
    };
    apply(mq.matches);
    mq.addEventListener("change", (e) => apply(e.matches));
  }, []);

  const handleWhoami = useCallback((what) => {
    if (what === "name")     setTimeout(() => setShowName(true), 200);
    if (what === "role")     setTimeout(() => setShowRole(true), 200);
    if (what === "location") setTimeout(() => setShowLocation(true), 200);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <div className={styles.page}>

      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          <span className={styles.accent}>mikancel</span>.com
        </a>
      </nav>

      {/* ── 01: Hero ── */}
      <section className={styles.hero}>
        <CmdWindow onWhoami={handleWhoami} />

        <div className={styles.heroBottom}>
          <div className={`${styles.heroName} ${showName ? styles.heroNameIn : ""}`}>
            mikancel
          </div>
          <div className={styles.heroMeta}>
            <span className={`${styles.heroMetaItem} ${showRole ? styles.heroMetaIn : ""}`}>
              SE &#47; Developer
            </span>
            <span className={`${styles.heroMetaItem} ${showLocation ? styles.heroMetaIn : ""}`} style={{ transitionDelay: "0.1s" }}>
              Aichi,&nbsp;Japan
            </span>
          </div>
        </div>

        <p className={styles.heroScroll}>scroll &#8595;</p>
      </section>

      {/* ── 01: Profile — オレンジ ── */}
      <section className={styles.sectionOrange}>
        <div ref={refProfile} className={`${styles.fade} ${visProfile ? styles.fadeIn : ""}`}>
          <p className={styles.labelDark}>&#8212; 01 &#47; Profile</p>
          {[
            ["location",  "Aichi, Japan"],
            ["role",      "SE &#47; Developer"],
            ["work",      "業務システムの保守"],
            ["personal",  "Webアプリ開発"],
            ["languages", "日本語 &#47; English &#47; Français"],
            ["fav_lang",  "Java / Kotlin / Swift"],
          ].map(([k, v]) => (
            <div key={k} className={styles.profileRow}>
              <span className={styles.profileKey}>{k}</span>
              <span className={styles.profileVal} dangerouslySetInnerHTML={{ __html: v }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── 02: Stack — 黒 ── */}
      <section className={styles.sectionBlack}>
        <div ref={refStack} className={`${styles.fade} ${visStack ? styles.fadeIn : ""}`}>
          <p className={styles.labelLight}>&#8212; 02 &#47; Stack</p>
          {[
            ["frontend", "Next.js / React / Tailwind"],
            ["backend",  "JavaScript"],
            ["storage",  "Turso / Cloudflare R2"],
            ["auth",     "WebAuthn / iron-session"],
            ["deploy",   "Vercel"],
          ].map(([category, techs]) => (
            <div key={category} className={styles.stackItem}>
              <span className={styles.stackCategory}>{category}</span>
              <span className={styles.stackTechs}>{techs}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 03: Interests — ライム ── */}
      <section className={styles.sectionLime}>
        <div ref={refInterests} className={`${styles.fade} ${visInterests ? styles.fadeIn : ""}`}>
          <p className={styles.labelDark}>&#8212; 03 &#47; Interests</p>
          {[
            ["Game",     "ゼンレスゾーンゼロ"],
            ["Anime",    "響け！ユーフォニアム"],
            ["Learning", "Java / Kotlin"],
          ].map(([k, v]) => (
            <div key={k} className={styles.interestItem}>
              <span className={styles.interestKey}>{k}</span>
              <span className={styles.interestVal}>{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 04: Timeline — 黒・git風 ── */}
      <section className={styles.sectionBlack}>
        <div ref={refTimeline} className={`${styles.fade} ${visTimeline ? styles.fadeIn : ""}`}>
          <p className={styles.labelLight}>&#8212; 04 &#47; Timeline</p>
          <p className={styles.gitCmd}>&#36; git log &#45;&#45;oneline &#45;&#45;graph</p>
          <div className={styles.gitLog}>
            {TIMELINE.map((entry, i) => (
              <div
                key={entry.hash}
                className={`${styles.gitItem} ${visTimeline ? styles.gitIn : ""}`}
                style={{ transitionDelay: `${i * 90 + 150}ms` }}
              >
                <span className={styles.gitTree}>&#42;</span>
                <span className={styles.gitHash}>{entry.hash}</span>
                <span className={styles.gitMsg}>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>&#169; 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>

    </div>
  );
}