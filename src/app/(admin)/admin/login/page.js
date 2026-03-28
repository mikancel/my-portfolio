"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";
import styles from "./login.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [status, setStatus] = useState("idle"); // idle | loading | error | success
  const [message, setMessage] = useState("");
  const [hasCredentials, setHasCredentials] = useState(null);

  useEffect(() => {
    // すでにログイン済みか確認
    fetch("/api/auth/session").then((r) => r.json()).then((d) => {
      if (d.isLoggedIn) router.replace("/admin/blog");
    });
    // パスキー登録済みか確認
    fetch("/api/auth/authenticate", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setHasCredentials(!d.error))
      .catch(() => setHasCredentials(false));
  }, [router]);

  const handleAuth = async () => {
    setStatus("loading");
    setMessage("");
    try {
      if (hasCredentials) {
        // 認証フロー
        const optRes = await fetch("/api/auth/authenticate", { method: "POST" });
        const opts = await optRes.json();
        if (opts.error) throw new Error(opts.error);

        const credential = await startAuthentication({ optionsJSON: opts });
        const verRes = await fetch("/api/auth/authenticate/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: opts.challengeId, ...credential }),
        });
        const ver = await verRes.json();
        if (!ver.ok) throw new Error(ver.error || "認証失敗");
      } else {
        // 登録フロー（初回）
        const optRes = await fetch("/api/auth/register", { method: "POST" });
        const opts = await optRes.json();
        if (opts.error) throw new Error(opts.error);

        const credential = await startRegistration({ optionsJSON: opts });
        const verRes = await fetch("/api/auth/register/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: opts.challengeId, ...credential }),
        });
        const ver = await verRes.json();
        if (!ver.ok) throw new Error(ver.error || "登録失敗");
      }

      setStatus("success");
      setTimeout(() => router.replace("/admin/blog"), 500);
    } catch (e) {
      setStatus("error");
      setMessage(e.message || "エラーが発生しました");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          admin.<span className={styles.accent}>mikancel</span>.com
        </div>
        <p className={styles.desc}>
          {hasCredentials === false
            ? "パスキーを登録してください"
            : "パスキーで認証してください"}
        </p>

        <button
          className={styles.btn}
          onClick={handleAuth}
          disabled={status === "loading" || hasCredentials === null}
        >
          {status === "loading" ? (
            <span className={styles.spinner} />
          ) : hasCredentials === false ? (
            "🔑 パスキーを登録"
          ) : (
            "🔐 パスキーでログイン"
          )}
        </button>

        {status === "error" && (
          <p className={styles.error}>{message}</p>
        )}
        {status === "success" && (
          <p className={styles.success}>認証成功！リダイレクト中...</p>
        )}

        <p className={styles.note}>
          WebAuthn / パスキー認証のみ対応しています
        </p>
      </div>
    </div>
  );
}
