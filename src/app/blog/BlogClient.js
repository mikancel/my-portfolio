"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./blog.module.css";
import { useTheme } from "@/lib/useTheme";
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

const LIMIT = 20;

export default function BlogClient({ posts: initialPosts, tags }) {
  const [posts, setPosts] = useState(initialPosts);
  const [activeTags, setActiveTags] = useState([]);
  const [offset, setOffset] = useState(initialPosts.length);
  const [hasMore, setHasMore] = useState(initialPosts.length === LIMIT);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const fetchSeq = useRef(0); // フィルタ切替と読み込みの競合を防ぐ

  const { dark, toggle } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();

  // サーバーからフィルタ済みの記事を取得する
  const fetchPosts = useCallback(async (tagIds, currentOffset, replace) => {
    const seq = ++fetchSeq.current;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(currentOffset),
      });
      if (tagIds.length) params.set("tags", tagIds.join(","));
      const res = await fetch(`/api/blog?${params}`);
      const data = await res.json();
      if (seq !== fetchSeq.current) return;
      const newPosts = data.posts || [];
      setPosts((prev) => (replace ? newPosts : [...prev, ...newPosts]));
      setOffset(currentOffset + newPosts.length);
      setHasMore(newPosts.length === LIMIT);
    } catch {
      if (seq === fetchSeq.current) setHasMore(false);
    } finally {
      if (seq === fetchSeq.current) setLoadingMore(false);
    }
  }, []);

  // URLの ?tag= を初期フィルタとして反映
  useEffect(() => {
    const ids = searchParams.getAll("tag").map(Number).filter(Boolean);
    if (ids.length > 0) {
      setActiveTags(ids);
      setPosts([]);
      fetchPosts(ids, 0, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTags = (next) => {
    setActiveTags(next);
    const params = new URLSearchParams();
    next.forEach((t) => params.append("tag", t));
    router.replace(`/blog${next.length > 0 ? `?${params}` : ""}`, { scroll: false });

    if (next.length === 0) {
      // フィルタ解除はサーバーレンダリング済みの初期一覧に戻す
      fetchSeq.current++;
      setPosts(initialPosts);
      setOffset(initialPosts.length);
      setHasMore(initialPosts.length === LIMIT);
      setLoadingMore(false);
    } else {
      setPosts([]);
      fetchPosts(next, 0, true);
    }
  };

  const toggleTag = (id) => {
    const numId = Number(id);
    applyTags(
      activeTags.includes(numId)
        ? activeTags.filter((s) => s !== numId)
        : [...activeTags, numId]
    );
  };

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPosts(activeTags, offset, false);
  }, [loadingMore, hasMore, offset, activeTags, fetchPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [loadMore]);

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
          {posts.length === 0 ? (
            <p className={styles.empty}>
              {loadingMore ? "読み込み中..." : "記事がまだありません"}
            </p>
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

        <div ref={sentinelRef} className={styles.sentinel}>
          {loadingMore && posts.length > 0 && (
            <div className={styles.loadingMore}>読み込み中...</div>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerHome}>
          <span className={styles.accent}>mikancel</span>.com
        </Link>
        <span className={styles.footerCopy}>© 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
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
