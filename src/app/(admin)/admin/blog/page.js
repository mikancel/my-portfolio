"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./admin-blog.module.css";

function formatDate(d) {
  if (!d) return "未公開";
  const dt = new Date(d);
  return `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,"0")}/${String(dt.getDate()).padStart(2,"0")}`;
}

export default function AdminBlog() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(d => {
      if (!d.isLoggedIn) router.replace("/admin/login");
    });
  }, [router]);

  const loadPosts = useCallback(() => {
    fetch("/api/blog?all=1")
      .then(r => r.json())
      .catch(() => ({}))
      .then(d => {
        setPosts(d.posts || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleDelete = async (id, title) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await fetch(`/api/blog/${id}`, { method: "DELETE" });
    loadPosts();
  };

  const handleTogglePublish = async (post) => {
    await fetch(`/api/blog/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    loadPosts();
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.logo}>
          admin.<span className={styles.accent}>mikancel</span>.com
        </Link>
        <div className={styles.headerActions}>
          <Link href="/admin/blog/new" className={styles.newBtn}>
            ＋ 新規記事
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <h1 className={styles.heading}>ブログ管理</h1>

        {loading ? (
          <div className={styles.loading}>読み込み中...</div>
        ) : posts.length === 0 ? (
          <div className={styles.empty}>
            <p>まだ記事がありません</p>
            <Link href="/admin/blog/new" className={styles.newBtn}>最初の記事を書く</Link>
          </div>
        ) : (
          <div className={styles.postList}>
            {posts.map(post => (
              <div key={post.id} className={styles.postRow} onClick={() => router.push(`/admin/blog/${post.id}/edit`)} style={{ cursor: "pointer" }}>
                <div className={styles.postInfo}>
                  <span className={`${styles.badge} ${post.published ? styles.badgePublished : styles.badgeDraft}`}>
                    {post.published ? "公開" : "下書き"}
                  </span>
                  <span className={styles.postId}>#{post.id}</span>
                  <span className={styles.postTitle}>{post.title}</span>
                </div>
                <div className={styles.postMeta}>
                  <div className={styles.postTags}>
                    {post.tags?.map(t => (
                      <span key={t.id} className={styles.tag}>{t.name}</span>
                    ))}
                  </div>
                  <time className={styles.postDate}>{formatDate(post.updated_at)}</time>
                  <div className={styles.postActions} onClick={e => e.stopPropagation()}>
                    <Link href={`/admin/blog/${post.id}/edit`} className={styles.actionBtn}>
                      編集
                    </Link>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleTogglePublish(post)}
                    >
                      {post.published ? "非公開" : "公開"}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDelete(post.id, post.title)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
