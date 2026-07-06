"use client";
import ThemeMenu from "@/components/ThemeMenu";
import styles from "./page.module.css";

export default function HomeClient() {
  return (
    <div className={styles.themeMenuWrap}>
      <ThemeMenu />
    </div>
  );
}
