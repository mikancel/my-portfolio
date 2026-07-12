"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostEditor from "../PostEditor";
import styles from "../admin-blog.module.css";

export default function NewPostPage() {
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
        <span style={{ fontSize: 14, color: "var(--sub)" }}>新規記事</span>
      </header>
      <div style={{ flex: 1 }}>
        <PostEditor postId={null} />
      </div>
    </div>
  );
}
