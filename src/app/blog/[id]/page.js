"use client";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import styles from "./post.module.css";
import "highlight.js/styles/github-dark.css";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

const THUMB_COLORS = [
  "#c4854a", "#7b9e6b", "#6b8fb5", "#9b7bb5",
  "#b5896b", "#6bb5a8", "#b56b7b", "#8fb56b",
  "#a07850", "#5b8c5a", "#4a7fa8", "#8a6aa8",
  "#c4956a", "#5aa898", "#a84a6b", "#7aa84a",
  "#d4956b", "#4a9e8b", "#8b4a9e", "#9e8b4a",
  "#6b9ed4", "#9ed46b", "#d46b9e", "#6bd4b5",
  "#d4a06b", "#6ba0d4", "#a0d46b", "#d46ba0",
  "#8b6bd4", "#6bd48b", "#d48b6b", "#6b8bd4",
  "#c47b7b", "#7bc47b", "#7b7bc4", "#c4b87b",
  "#7bc4b8", "#b87bc4", "#c4887b", "#7bc488",
];

function getColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return THUMB_COLORS[Math.abs(hash) % THUMB_COLORS.length];
}

function Thumbnail({ src, title }) {
  if (!src) {
    return (
      <div className={styles.heroPlaceholder} style={{ background: getColor(title || "") }}>
        <span>{title?.charAt(0) || "?"}</span>
      </div>
    );
  }
  return <img src={src} alt={title} className={styles.heroImg} />;
}

function TableOfContents({ toc, open, onClose, title }) {
  return (
    <div className={`${styles.tocDrawer} ${open ? styles.tocOpen : ""}`}>
      <div className={styles.tocInner}>
        <p className={styles.tocTitle}>目次</p>
        <ul className={styles.tocList}>
          <li>
            <a href="#" onClick={onClose} className={styles.tocLink} style={{ fontWeight: "bold" }}>
              {title}
            </a>
          </li>
          {toc.map((item) => (
            <li key={item.id} style={{ paddingLeft: `${item.level * 16}px` }}>
              <a href={`#${item.id}`} onClick={onClose} className={styles.tocLink}>
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PostPage({ params }) {
  const { id } = use(params);
  const [post, setPost] = useState(null);
  const [html, setHtml] = useState("");
  const [toc, setToc] = useState([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [lightbox, setLightbox] = useState({ open: false, slides: [], index: 0 });
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

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/blog/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setPost(data);
      document.title = data.title;

      const mdRes = await fetch("/api/blog/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: data.content }),
      });
      const mdData = await mdRes.json();
      setHtml(mdData.html || "");
      setToc(mdData.toc || []);
    }
    load();
  }, [id]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHeaderVisible(y < lastY || y < 60);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  useEffect(() => {
  const onScroll = () => {
    const y = window.scrollY;
    setHeaderVisible(tocOpen || y < lastY || y < 60);
    setLastY(y);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}, [lastY, tocOpen]);

  // lightbox
  useEffect(() => {
    if (!html) return;
    const container = document.querySelector(`.${styles.content}`);
    if (!container) return;
    const imgs = container.querySelectorAll("img");
    const slides = Array.from(imgs).map((img) => ({ src: img.src }));
    const handler = (e) => {
      if (e.target.tagName === "IMG") {
        const idx = Array.from(imgs).indexOf(e.target);
        setLightbox({ open: true, slides, index: idx });
      }
      if (e.target.tagName === "VIDEO") {
        e.target.requestFullscreen?.();
      }
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [html]);

  // コードブロックツールバー
  useEffect(() => {
    if (!html) return;
    const container = document.querySelector(`.${styles.content}`);
    if (!container) return;

    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".code-toolbar")) return;
      const code = pre.querySelector("code");
      const lang = code?.className.match(/language-(\w+)/)?.[1] || "";

      const toolbar = document.createElement("div");
      toolbar.className = "code-toolbar";
      toolbar.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 12px;
        background: rgba(255,255,255,0.08);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        font-size: 12px;
        font-family: Consolas, monospace;
      `;

      const langLabel = document.createElement("span");
      langLabel.textContent = lang || "code";
      langLabel.style.color = "#8b949e";

      const buttons = document.createElement("div");
      buttons.style.cssText = "display:flex;gap:8px;";

      const wrapBtn = document.createElement("button");
      wrapBtn.textContent = "折り返し";
      wrapBtn.style.cssText = `background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#8b949e;font-size:11px;padding:2px 8px;cursor:pointer;font-family:inherit;`;
      let wrapped = false;
      wrapBtn.onclick = () => {
        wrapped = !wrapped;
        code.style.whiteSpace = wrapped ? "pre-wrap" : "pre";
        wrapBtn.style.color = wrapped ? "#f68827" : "#8b949e";
      };

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "コピー";
      copyBtn.style.cssText = `background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#8b949e;font-size:11px;padding:2px 8px;cursor:pointer;font-family:inherit;min-width:55px;text-align:center;`;
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(code?.textContent || "");
        copyBtn.textContent = "完了";
        setTimeout(() => { copyBtn.textContent = "コピー"; }, 1500);
      };

      buttons.appendChild(wrapBtn);
      buttons.appendChild(copyBtn);
      toolbar.appendChild(langLabel);
      toolbar.appendChild(buttons);
      pre.insertBefore(toolbar, pre.firstChild);
      pre.style.padding = "0";
      if (code) code.style.cssText = "display:block;padding:16px;overflow-x:auto;";
    });
  }, [html]);

  if (!post) {
    return (
      <div className={styles.page}>
        <PostHeader visible={headerVisible} hasToc={false} onTocToggle={() => {}} />
        <div className={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PostHeader
        visible={headerVisible}
        hasToc={toc.length > 0}
        tocOpen={tocOpen}
        onTocToggle={() => setTocOpen((v) => !v)}
      />

      {tocOpen && (
        <div className={styles.tocOverlay} onClick={() => setTocOpen(false)} />
      )}
      <TableOfContents toc={toc} open={tocOpen} onClose={() => setTocOpen(false)} title={post?.title} />

      <article className={styles.article}>
        <Thumbnail src={post.thumbnail} title={post.title} />

        <div className={styles.articleBody}>
          <div className={styles.articleMeta}>
            {post.tags?.map((t) => (
              <Link key={t.id} href={`/blog?tag=${t.slug}`} className={styles.tag}>
                {t.name}
              </Link>
            ))}
            <time className={styles.date}>
              {formatDate(post.updated_at || post.published_at)}
            </time>
          </div>

          <h1 className={styles.title}>{post.title}</h1>

          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>

      <footer className={styles.footer}>
        <a href="/" className={styles.footerHome}>
          <span className={styles.accent}>mikancel</span>.com
        </a>
        <span className={styles.footerCopy}>© 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>

      <Lightbox
        open={lightbox.open}
        close={() => setLightbox((v) => ({ ...v, open: false }))}
        slides={lightbox.slides}
        index={lightbox.index}
        on={{
          backdropClick: () => setLightbox((v) => ({ ...v, open: false })),
        }}
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.75)" },
        }}
      />
    </div>
  );
}

function PostHeader({ visible, hasToc, tocOpen, onTocToggle }) {
  return (
    <header className={`${styles.header} ${visible ? styles.headerVisible : styles.headerHidden}`}>
      <Link href="/blog" className={styles.headerLogo}>
        <span className={styles.accent}>mikancel</span>.com/blog
      </Link>
      {hasToc && (
        <button
          className={`${styles.tocToggle} ${tocOpen ? styles.tocToggleOpen : ""}`}
          onClick={onTocToggle}
          aria-label="目次"
        >
          ▽
        </button>
      )}
    </header>
  );
}