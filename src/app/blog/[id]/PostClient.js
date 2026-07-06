"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import styles from "./post.module.css";
import "highlight.js/styles/github-dark.css";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useTheme } from "@/lib/useTheme";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { getColor, formatDate } from "@/lib/format";

const HEADER_HEIGHT = 56;

function Thumbnail({ src, title }) {
  if (!src) {
    return (
      <div className={styles.heroPlaceholder} style={{ background: getColor(title || "") }}>
        <span>{title?.charAt(0) || "?"}</span>
      </div>
    );
  }
  return <img src={src} alt={title} className={styles.heroImg} />;
}

function TableOfContents({ toc, open, activeId, onClose, onTocClick, title }) {
  return (
    <div className={`${styles.tocDrawer} ${open ? styles.tocOpen : ""}`}>
      <div className={styles.tocInner}>
        <p className={styles.tocTitle}>目次</p>
        <ul className={styles.tocList}>
          <li>
            <a
              href="#"
              onClick={(e) => { onTocClick(e, null); onClose(); }}
              className={styles.tocLink}
              style={{ fontWeight: "bold" }}
            >
              {title}
            </a>
          </li>
          {toc.map((item) => (
            <li key={item.id} style={{ paddingLeft: `${item.level * 16}px` }}>
              <a
                href={`#${item.id}`}
                onClick={(e) => { onTocClick(e, item.id); onClose(); }}
                className={`${styles.tocLink} ${activeId === item.id ? styles.tocLinkActive : ""}`}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function useScrollHeader() {
  const translateY = useRef(0);
  const lastScrollY = useRef(0);
  const snapTimer = useRef(null);
  const headerRef = useRef(null);
  const forceVisible = useRef(false);
  const tocOpenRef = useRef(false);

  const applyTranslate = useCallback((val) => {
    translateY.current = val;
    if (headerRef.current) {
      headerRef.current.style.transform = `translateY(${val}px)`;
    }
  }, []);

  const snapToEdge = useCallback(() => {
    const snapped = translateY.current < -(HEADER_HEIGHT / 2) ? -HEADER_HEIGHT : 0;
    if (headerRef.current) {
      headerRef.current.style.transition = "transform 0.2s ease";
      applyTranslate(snapped);
      setTimeout(() => {
        if (headerRef.current) headerRef.current.style.transition = "";
      }, 200);
    }
  }, [applyTranslate]);

  // tocOpen の変化を ref に同期（リスナー再登録不要）
  const setTocOpenRef = useCallback((val) => {
    tocOpenRef.current = val;
    if (val) {
      // TOC を開いたらヘッダーを表示固定
      clearTimeout(snapTimer.current);
      applyTranslate(0);
    }
  }, [applyTranslate]);

  useEffect(() => {
    // iOSのラバーバンド（範囲外へのバウンス）でdeltaが暴れないようクランプする
    const getY = () => {
      const max = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        0
      );
      return Math.min(Math.max(window.scrollY, 0), max);
    };

    lastScrollY.current = getY();

    // scrollend対応ブラウザでは「スクロールが本当に止まった時」だけスナップし、
    // 慣性スクロール中にタイマーが発火してカクつくのを防ぐ
    const supportsScrollEnd = "onscrollend" in window;

    const onScroll = () => {
      if (tocOpenRef.current) return;

      if (forceVisible.current) {
        forceVisible.current = false;
        lastScrollY.current = getY();
        return;
      }

      const y = getY();
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (y < HEADER_HEIGHT) {
        applyTranslate(0);
        return;
      }

      const next = Math.min(0, Math.max(-HEADER_HEIGHT, translateY.current - delta));
      applyTranslate(next);

      if (!supportsScrollEnd) {
        clearTimeout(snapTimer.current);
        snapTimer.current = setTimeout(snapToEdge, 150);
      }
    };

    const onScrollEnd = () => {
      if (tocOpenRef.current) return;
      snapToEdge();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    if (supportsScrollEnd) {
      window.addEventListener("scrollend", onScrollEnd, { passive: true });
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (supportsScrollEnd) window.removeEventListener("scrollend", onScrollEnd);
      clearTimeout(snapTimer.current);
    };
  }, [applyTranslate, snapToEdge]);

  const handleTocClick = useCallback((e, headingId) => {
    if (headingId === null) {
      applyTranslate(0);
      return;
    }

    const target = document.getElementById(headingId);
    if (!target) return;

    const targetY = target.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT;
    const currentY = window.scrollY;

    if (targetY > currentY) {
      // 下方向ジャンプ → ヘッダー表示固定（次のスクロールで解除）
      forceVisible.current = true;
      applyTranslate(0);
    }
    // 上方向は scroll-margin-top で対応
  }, [applyTranslate]);

  return { headerRef, setTocOpenRef, handleTocClick };
}

export default function PostClient({ post, html, toc }) {
  const [tocOpen, setTocOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, slides: [], index: 0 });
  const [activeHeading, setActiveHeading] = useState(null);
  const { dark, toggle } = useTheme();
  const progressRef = useRef(null);
  // タッチ端末ではLightboxの前後ボタンを消してスワイプ操作に任せる
  const isTouch = useMediaQuery("(hover: none) and (pointer: coarse)");

  const { headerRef, setTocOpenRef, handleTocClick } = useScrollHeader();

  // 目次のスクロールスパイ（いま読んでいる見出しをハイライト）
  useEffect(() => {
    if (!toc.length) return;
    const onScroll = () => {
      const offset = HEADER_HEIGHT + 32;
      let current = null;
      for (const item of toc) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= offset) {
          current = item.id;
        } else {
          break;
        }
      }
      setActiveHeading(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [toc]);

  // 読書プログレスバー（stateを使わずDOM直接更新でスクロール負荷を抑える）
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${p})`;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleTocToggle = useCallback(() => {
    setTocOpen((v) => {
      setTocOpenRef(!v);
      return !v;
    });
  }, [setTocOpenRef]);

  const handleTocClose = useCallback(() => {
    setTocOpen(false);
    setTocOpenRef(false);
  }, [setTocOpenRef]);

  useEffect(() => {
    if (!html) return;
    const container = document.querySelector(`.${styles.content}`);
    if (!container) return;
    const imgs = container.querySelectorAll("img");
    const slides = Array.from(imgs).map((img) => ({ src: img.src }));
    const handler = (e) => {
      if (e.target.tagName === "IMG") {
        const idx = Array.from(imgs).indexOf(e.target);
        setLightbox({ open: true, slides, index: idx });
      }
      if (e.target.tagName === "VIDEO") {
        e.target.requestFullscreen?.();
      }
    };
    container.addEventListener("click", handler);
    return () => container.removeEventListener("click", handler);
  }, [html]);

  useEffect(() => {
    if (!html) return;
    const container = document.querySelector(`.${styles.content}`);
    if (!container) return;

    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".code-toolbar")) return;
      const code = pre.querySelector("code");
      const lang = code?.className.match(/language-(\w+)/)?.[1] || "";

      const toolbar = document.createElement("div");
      toolbar.className = "code-toolbar";
      toolbar.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 12px;
        background: rgba(255,255,255,0.08);
        border-bottom: 1px solid rgba(255,255,255,0.1);
        font-size: 12px;
        font-family: Consolas, monospace;
      `;

      const langLabel = document.createElement("span");
      langLabel.textContent = lang || "code";
      langLabel.style.color = "#8b949e";

      const buttons = document.createElement("div");
      buttons.style.cssText = "display:flex;gap:8px;";

      const wrapBtn = document.createElement("button");
      wrapBtn.textContent = "折り返し";
      wrapBtn.style.cssText = `background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#8b949e;font-size:11px;padding:2px 8px;cursor:pointer;font-family:inherit;`;
      let wrapped = false;
      wrapBtn.onclick = () => {
        wrapped = !wrapped;
        code.style.whiteSpace = wrapped ? "pre-wrap" : "pre";
        wrapBtn.style.color = wrapped ? "#f68827" : "#8b949e";
      };

      const copyBtn = document.createElement("button");
      copyBtn.textContent = "コピー";
      copyBtn.style.cssText = `background:none;border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#8b949e;font-size:11px;padding:2px 8px;cursor:pointer;font-family:inherit;min-width:55px;text-align:center;`;
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(code?.textContent || "");
        copyBtn.textContent = "完了";
        setTimeout(() => { copyBtn.textContent = "コピー"; }, 1500);
      };

      buttons.appendChild(wrapBtn);
      buttons.appendChild(copyBtn);
      toolbar.appendChild(langLabel);
      toolbar.appendChild(buttons);
      pre.insertBefore(toolbar, pre.firstChild);
      pre.style.padding = "0";
      if (code) code.style.cssText = "display:block;padding:16px;overflow-x:auto;";
    });
  }, [html]);

  return (
    <div className={styles.page}>
      {/* 読書プログレスバー（ヘッダから独立した固定表示） */}
      <div ref={progressRef} className={styles.progressBar} />

      <PostHeader
        headerRef={headerRef}
        hasToc={toc.length > 0}
        tocOpen={tocOpen}
        onTocToggle={handleTocToggle}
      />

      {tocOpen && (
        <div className={styles.tocOverlay} onClick={handleTocClose} />
      )}
      <TableOfContents
        toc={toc}
        open={tocOpen}
        activeId={activeHeading}
        onClose={handleTocClose}
        onTocClick={handleTocClick}
        title={post.title}
      />

      <article className={styles.article}>
        <Thumbnail src={post.thumbnail} title={post.title} />

        <div className={styles.articleBody}>
          <div className={styles.articleMeta}>
            {post.tags?.map((t) => (
              <Link key={t.id} href={`/blog?tag=${t.id}`} className={styles.tag}>
                {t.name}
              </Link>
            ))}
            <time className={styles.date}>
              {formatDate(post.updated_at || post.published_at)}
            </time>
          </div>

          <h1 className={styles.title}>{post.title}</h1>

          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerHome}>
          <span className={styles.accent}>mikancel</span>.com
        </Link>
        <span className={styles.footerCopy}>© 2026 mikancel.</span>
        <button className={styles.themeToggle} onClick={toggle}>
          {dark ? "Light" : "Dark"}
        </button>
      </footer>

      <Lightbox
        open={lightbox.open}
        close={() => setLightbox((v) => ({ ...v, open: false }))}
        slides={lightbox.slides}
        index={lightbox.index}
        controller={{
          closeOnBackdropClick: true,
          // Xのように上下スワイプで閉じる
          closeOnPullDown: true,
          closeOnPullUp: true,
        }}
        render={
          // タッチ端末では前後ボタンが画像に被るため非表示（スワイプで移動）
          isTouch
            ? { buttonPrev: () => null, buttonNext: () => null }
            : undefined
        }
        styles={{
          container: { backgroundColor: "rgba(0, 0, 0, 0.85)" },
        }}
      />
    </div>
  );
}

function PostHeader({ headerRef, hasToc, tocOpen, onTocToggle }) {
  return (
    <header ref={headerRef} className={styles.header}>
      <Link href="/blog" className={styles.headerLogo}>
        <span className={styles.accent}>mikancel</span>.com/blog
      </Link>
      {hasToc && (
        <button
          className={`${styles.tocToggle} ${tocOpen ? styles.tocToggleOpen : ""}`}
          onClick={onTocToggle}
          aria-label="目次"
        >
          目次
          <span className={styles.tocArrow}>▽</span>
        </button>
      )}
    </header>
  );
}