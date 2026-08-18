"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function LoginClient({ message }: { message: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 既にログイン済みなら管理画面へ飛ばす
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { isLoggedIn?: boolean }) => {
        if (d.isLoggedIn) router.replace("/admin/blog");
      })
      .catch(() => {});
  }, [router]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          admin.<span className={styles.accent}>mikancel</span>.com
        </div>
        <p className={styles.desc}>Googleアカウントで認証してください</p>

        <a
          className={styles.btn}
          href="/api/auth/google"
          onClick={() => setLoading(true)}
        >
          {loading ? <span className={styles.spinner} /> : "Googleでログイン"}
        </a>

        {message && <p className={styles.error}>{message}</p>}

        <p className={styles.note}>許可されたアカウントのみログインできます</p>
      </div>
    </div>
  );
}
