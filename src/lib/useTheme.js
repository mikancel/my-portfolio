"use client";
import { useSyncExternalStore, useCallback } from "react";

// data-theme 属性を唯一の情報源とする。
// 初期値は layout.js のインラインスクリプトが設定済み。
function getSnapshot() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function getServerSnapshot() {
  return false;
}

function subscribe(callback) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMqChange = () => {
    // 手動選択（localStorage）がなければ OS 設定に追従
    if (!localStorage.getItem("theme")) {
      document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
    }
    callback();
  };
  mq.addEventListener("change", onMqChange);
  window.addEventListener("theme-change", callback);
  return () => {
    mq.removeEventListener("change", onMqChange);
    window.removeEventListener("theme-change", callback);
  };
}

// テーマ切替フック。手動選択は localStorage に永続化し、
// 未選択の場合のみ OS 設定（prefers-color-scheme）に追従する。
export function useTheme() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = getSnapshot() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    window.dispatchEvent(new Event("theme-change"));
  }, []);

  return { dark, toggle };
}
