"use client";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/useTheme";
import styles from "./ThemeMenu.module.css";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "OS追従" },
];

export default function ThemeMenu({ className = "" }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // メニュー外クリック・Escで閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];

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
        {current.label}
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
