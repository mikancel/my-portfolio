"use client";
import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostEditor from "../../PostEditor";
import styles from "../../admin-blog.module.css";

export default function EditPostPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(d => {
      if (!d.isLoggedIn) router.replace("/admin/login");
    });
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <header className={styles.header}>
        <Link href="/admin/blog" className={styles.logo}>
          ← ブログ管理
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link
            href={`https://mikancel.com/blog/${id}`}
            target="_blank"
            style={{ fontSize: 13, color: "var(--sub)", textDecoration: "none" }}
          >
            公開ページ →
          </Link>
          <span style={{ fontSize: 14, color: "var(--sub)" }}>記事 #{id} 編集</span>
        </div>
      </header>
      <div style={{ flex: 1 }}>
        <PostEditor postId={id} />
      </div>
    </div>
  );
}
