"use client";
import { useState, useEffect, useCallback, use } from "react";
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

function Thumbnail({ src, title }) {
  if (!src) {
    return (
      <div className={styles.heroPlaceholder}>
        <span>{title?.charAt(0) || "?"}</span>
      </div>
    );
  }
  return <img src={src} alt={title} className={styles.heroImg} />;
}

function TableOfContents({ toc, open, onClose }) {
  return (
    <div className={`${styles.tocDrawer} ${open ? styles.tocOpen : ""}`}>
      <div className={styles.tocInner}>
        <p className={styles.tocTitle}>目次</p>
        <ul className={styles.tocList}>
          {toc.map((item) => (
            <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 16}px` }}>
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
      <TableOfContents toc={toc} open={tocOpen} onClose={() => setTocOpen(false)} />

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
        <span>© 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>

      <Lightbox
        open={lightbox.open}
        close={() => setLightbox((v) => ({ ...v, open: false }))}
        slides={lightbox.slides}
        index={lightbox.index}
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