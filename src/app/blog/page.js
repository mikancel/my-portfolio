"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./blog.module.css";

function Thumbnail({ thumbnail, title }) {
  if (thumbnail) {
    return <img src={thumbnail} alt={title} className={styles.thumbImg} />;
  }
  const char = title?.charAt(0) || "?";
  return (
    <div className={styles.thumbPlaceholder}>
      <span>{char}</span>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default function BlogIndex() {
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  const fetchPosts = useCallback(async (tag) => {
    setLoading(true);
    const url = tag ? `/api/blog?tag=${encodeURIComponent(tag)}` : "/api/blog";
    const res = await fetch(url);
    const data = await res.json();
    setPosts(data.posts || []);
    setTags(data.tags || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts(activeTag);
  }, [activeTag, fetchPosts]);

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
    <div className={styles.page}>
      <BlogHeader />

      <main className={styles.main}>
        <div className={styles.tagFilter}>
          <button
            className={`${styles.tagBtn} ${!activeTag ? styles.tagBtnActive : ""}`}
            onClick={() => setActiveTag(null)}
          >
            すべて
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              className={`${styles.tagBtn} ${activeTag === t.slug ? styles.tagBtnActive : ""}`}
              onClick={() => setActiveTag(activeTag === t.slug ? null : t.slug)}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className={styles.postList}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.postCardSkeleton}>
                <div className={styles.skeletonThumb} />
                <div className={styles.skeletonContent}>
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonMeta} />
                </div>
              </div>
            ))
          ) : posts.length === 0 ? (
            <p className={styles.empty}>記事がまだありません</p>
          ) : (
            posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.id}`} className={styles.postCard}>
                <Thumbnail thumbnail={post.thumbnail} title={post.title} />
                <div className={styles.postMeta}>
                  <h2 className={styles.postTitle}>{post.title}</h2>
                  <div className={styles.postBottom}>
                    <div className={styles.postTags}>
                      {post.tags?.map((t) => (
                        <span key={t.id} className={styles.tag}>{t.name}</span>
                      ))}
                    </div>
                    <time className={styles.postDate}>
                      {formatDate(post.updated_at || post.published_at)}
                    </time>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <a href="/" className={styles.footerHome}>
          <span className={styles.accent}>mikancel</span>.com
        </a>
        <span>© 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>
    </div>
  );
}

function BlogHeader() {
  const [visible, setVisible] = useState(true);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setVisible(y < lastY || y < 60);
      setLastY(y);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  return (
    <header className={`${styles.header} ${visible ? styles.headerVisible : styles.headerHidden}`}>
      <Link href="/blog" className={styles.headerLogo}>
        <span className={styles.accent}>mikancel</span>.com/blog
      </Link>
    </header>
  );
}