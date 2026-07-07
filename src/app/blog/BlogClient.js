"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./blog.module.css";
import ThemeMenu from "@/components/ThemeMenu";
import { getColor, formatDate } from "@/lib/format";

function Thumbnail({ thumbnail, title }) {
  if (thumbnail) {
    return <img src={thumbnail} alt={title} className={styles.thumbImg} />;
  }
  const char = title?.charAt(0) || "?";
  return (
    <div className={styles.thumbPlaceholder} style={{ background: getColor(title || "") }}>
      <span>{char}</span>
    </div>
  );
}

const PAGE = 20;

export default function BlogClient({ posts, tags }) {
  const [activeTags, setActiveTags] = useState([]);
  const [visible, setVisible] = useState(PAGE);
  const sentinelRef = useRef(null);
  const searchParams = useSearchParams();

  // URLの ?tag= を初期フィルタとして反映
  useEffect(() => {
    const ids = searchParams.getAll("tag").map(Number).filter(Boolean);
    if (ids.length > 0) setActiveTags(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 選択タグを全て持つ記事だけに絞る（クライアント側・メモリ内。DBアクセスなし＝瞬時）
  const filtered = useMemo(() => {
    if (activeTags.length === 0) return posts;
    return posts.filter((p) =>
      activeTags.every((id) => p.tags?.some((t) => Number(t.id) === id))
    );
  }, [posts, activeTags]);

  const applyTags = (next) => {
    setActiveTags(next);
    setVisible(PAGE);
    // URLだけ差し替える（history.replaceStateならRSCフェッチも発生せずネットワーク完全ゼロ）
    const params = new URLSearchParams();
    next.forEach((t) => params.append("tag", t));
    window.history.replaceState(null, "", `/blog${next.length > 0 ? `?${params}` : ""}`);
  };

  const toggleTag = (id) => {
    const numId = Number(id);
    applyTags(
      activeTags.includes(numId)
        ? activeTags.filter((s) => s !== numId)
        : [...activeTags, numId]
    );
  };

  // スクロールで表示件数を増やす（既にメモリ上にあるのでネットワーク不要）
  useEffect(() => {
    if (visible >= filtered.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => v + PAGE);
      },
      { rootMargin: "200px" }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [filtered.length, visible]);

  const shown = filtered.slice(0, visible);

  return (
    <div className={styles.page}>
      <BlogHeader />

      <main className={styles.main}>
        <div className={styles.tagFilter}>
          <button
            className={`${styles.tagBtn} ${activeTags.length === 0 ? styles.tagBtnActive : styles.tagBtnInactive}`}
            onClick={() => applyTags([])}
          >
            すべて
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              className={`${styles.tagBtn} ${activeTags.includes(Number(t.id)) ? styles.tagBtnActive : ""}`}
              onClick={() => toggleTag(Number(t.id))}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className={styles.postList}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>記事がまだありません</p>
          ) : (
            shown.map((post) => (
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

        <div ref={sentinelRef} className={styles.sentinel} />
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerHome}>
          <span className={styles.accent}>mikancel</span>.com
        </Link>
        <span className={styles.footerCopy}>© 2026 mikancel.</span>
        <div className={styles.themeMenuWrap}>
          <ThemeMenu />
        </div>
      </footer>
    </div>
  );
}

function BlogHeader() {
  // ガラス化に伴い常時表示（隠す挙動によるチラつきを廃止）
  return (
    <header className={styles.header}>
      <Link href="/blog" className={styles.headerLogo}>
        <span className={styles.accent}>mikancel</span>.com/blog
      </Link>
    </header>
  );
}
