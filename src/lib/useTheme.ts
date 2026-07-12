"use client";
import { useSyncExternalStore, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

const KEY = "theme"; // "light" | "dark"（OS追従時は保存しない）
const KEY_AT = "theme-saved-at"; // 最終アクセス時刻（アクセス毎に更新）
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7日間アクセスがなければOS追従に戻す

// 有効な手動設定を返す（期限切れ・未設定なら null = OS追従）
function readStoredMode(): "light" | "dark" | null {
  try {
    const m = localStorage.getItem(KEY);
    if (m !== "light" && m !== "dark") return null;
    const at = Number(localStorage.getItem(KEY_AT) || 0);
    if (!at || Date.now() - at > EXPIRY_MS) return null;
    return m;
  } catch {
    return null;
  }
}

function isDarkSnapshot(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function modeSnapshot(): ThemeMode {
  return readStoredMode() ?? "system";
}

function applyDark(dark: boolean): void {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMqChange = () => {
    // 手動設定が無い（=OS追従）ときだけOS設定に追従
    if (!readStoredMode()) applyDark(mq.matches);
    callback();
  };
  mq.addEventListener("change", onMqChange);
  window.addEventListener("theme-change", callback);
  return () => {
    mq.removeEventListener("change", onMqChange);
    window.removeEventListener("theme-change", callback);
  };
}

// テーマフック。theme: "light" | "dark" | "system"
export function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDarkSnapshot, () => false);
  const theme = useSyncExternalStore(subscribe, modeSnapshot, () => "system" as ThemeMode);

  const setTheme = useCallback((mode: ThemeMode) => {
    try {
      if (mode === "system") {
        localStorage.removeItem(KEY);
        localStorage.removeItem(KEY_AT);
      } else {
        localStorage.setItem(KEY, mode);
        localStorage.setItem(KEY_AT, String(Date.now()));
      }
    } catch {}
    const nextDark =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : mode === "dark";
    applyDark(nextDark);
    window.dispatchEvent(new Event("theme-change"));
  }, []);

  return { dark, theme, setTheme };
}
