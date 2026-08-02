"use client";
import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/lib/useTheme";
import styles from "./Comments.module.css";

// giscus の設定。repo/repoId/categoryId はいずれも公開情報なので秘匿不要。
// コメントはソースコードのリポジトリと混ざらないよう専用リポジトリに置く。
// repoId と categoryId は https://giscus.app の設定画面で発行される値を貼る。
// どちらかが空なら何も描画しない（未設定でもページは壊れない）。
const REPO = "mikancel/blog-comments";
const REPO_ID = "R_kgDOTqwZ-g";
const CATEGORY = "Announcements";
const CATEGORY_ID = "DIC_kwDOTqwZ-s4DCfwy";

const CONFIGURED = Boolean(REPO_ID && CATEGORY_ID);

const GISCUS_ORIGIN = "https://giscus.app";

// 自前の枠線・余白を持たせるため、giscus側は枠なしテーマを使う
const giscusTheme = (dark: boolean) => (dark ? "noborder_dark" : "noborder_light");

// useTheme の値はハイドレーション直後の1フレームだけ light に倒れるため、
// script生成やiframe初期化のように「その瞬間の正解」が要る箇所ではDOMを直接読む
const isDarkNow = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

export default function Comments() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { dark } = useTheme();

  const readyRef = useRef(false);

  const postTheme = useCallback((isDark: boolean) => {
    const iframe =
      containerRef.current?.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
    iframe?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: giscusTheme(isDark) } } },
      GISCUS_ORIGIN
    );
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!CONFIGURED || !el) return;

    const script = document.createElement("script");
    script.src = `${GISCUS_ORIGIN}/client.js`;
    script.async = true;
    script.crossOrigin = "anonymous";

    const attrs: Record<string, string> = {
      "data-repo": REPO,
      "data-repo-id": REPO_ID,
      "data-category": CATEGORY,
      "data-category-id": CATEGORY_ID,
      // 記事URLとDiscussionを1対1で対応させる（記事タイトルを変えても紐付けが切れない）
      "data-mapping": "pathname",
      "data-strict": "1",
      "data-reactions-enabled": "1",
      "data-emit-metadata": "0",
      "data-input-position": "top",
      "data-theme": giscusTheme(isDarkNow()),
      "data-lang": "ja",
      // 画面に入るまで iframe を読み込まない（記事表示の速度を落とさない）
      "data-loading": "lazy",
    };
    for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);

    el.appendChild(script);

    // StrictModeの二重実行やページ遷移で iframe が重複しないよう中身を捨てる
    return () => {
      el.innerHTML = "";
      readyRef.current = false;
    };
  }, []);

  // giscus からの最初の応答時点で現在のテーマを流し込む。
  // lazy読み込みのため、iframe生成前にテーマを切り替えられた場合の取りこぼしを防ぐ。
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== GISCUS_ORIGIN) return;
      if (typeof e.data !== "object" || !e.data?.giscus) return;
      if (readyRef.current) return;
      readyRef.current = true;
      postTheme(isDarkNow());
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postTheme]);

  // テーマ切り替えは再読み込みせず iframe に通知するだけ（コメント欄の状態を保つ）
  useEffect(() => {
    postTheme(dark);
  }, [dark, postTheme]);

  if (!CONFIGURED) return null;

  return (
    <section className={styles.section} aria-label="コメント">
      <h2 className={styles.heading}>コメント</h2>
      <p className={styles.note}>GitHubアカウントでログインすると投稿できます。</p>
      <div ref={containerRef} className={styles.giscus} />
    </section>
  );
}
