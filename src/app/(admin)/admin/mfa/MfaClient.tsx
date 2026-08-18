"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../login/login.module.css";

export default function MfaClient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (value: string) => {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const data: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !data.ok) {
        // Google認証からやり直しが必要な状態
        if (res.status === 401 && !data.error) {
          router.replace("/admin/login");
          return;
        }
        throw new Error(data.error || "認証に失敗しました");
      }
      router.replace("/admin/blog");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "認証に失敗しました");
      setCode("");
      inputRef.current?.focus();
    }
  };

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    // 6桁揃った時点で自動送信（コピペ・オートフィルにも対応）
    if (digits.length === 6 && status !== "loading") submit(digits);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          admin.<span className={styles.accent}>mikancel</span>.com
        </div>
        <p className={styles.desc}>認証アプリの6桁コードを入力してください</p>

        <input
          ref={inputRef}
          className={styles.tokenInput}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          value={code}
          disabled={status === "loading"}
          onChange={(e) => handleChange(e.target.value)}
          style={{ textAlign: "center", letterSpacing: "0.4em", fontSize: 20 }}
        />

        <button
          className={styles.btn}
          onClick={() => submit(code)}
          disabled={code.length !== 6 || status === "loading"}
        >
          {status === "loading" ? <span className={styles.spinner} /> : "認証する"}
        </button>

        {status === "error" && <p className={styles.error}>{message}</p>}

        <p className={styles.note}>Googleログイン後の2段階目の認証です</p>
      </div>
    </div>
  );
}
