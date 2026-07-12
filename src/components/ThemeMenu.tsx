"use client";
import { useState, useRef, useEffect } from "react";
import { useTheme, type ThemeMode } from "@/lib/useTheme";
import styles from "./ThemeMenu.module.css";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function ThemeMenu({ className = "" }: { className?: string }) {
  const { dark, theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // メニュー外クリック・Escで閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="テーマ切替"
      >
        {/* ボタンには実際に適用中のテーマを表示（System選択中もLight/Dark表記） */}
        <span className={styles.triggerLabel}>{dark ? "Dark" : "Light"}</span>
        <span className={styles.caret} aria-hidden="true">▴</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === o.value}
              className={`${styles.item} ${theme === o.value ? styles.itemActive : ""}`}
              onClick={() => {
                setTheme(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {theme === o.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
