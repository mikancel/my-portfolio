"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./admin.module.css";

export default function AdminTop() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((d) => {
      if (!d.isLoggedIn) router.replace("/admin/login");
    });
  }, [router]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.logo}>
          admin.<span className={styles.accent}>mikancel</span>.com
        </span>
        <LogoutBtn />
      </header>
      <main className={styles.main}>
        <h1 className={styles.heading}>管理メニュー</h1>
        <div className={styles.grid}>
          <Link href="/admin/blog" className={styles.menuCard}>
            <span className={styles.menuIcon}>✍️</span>
            <span className={styles.menuLabel}>ブログ</span>
            <span className={styles.menuDesc}>記事の作成・編集・削除</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

function LogoutBtn() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/admin/login");
  };
  return (
    <button className={styles.logoutBtn} onClick={logout}>
      ログアウト
    </button>
  );
}
