"use client";
import { useTheme } from "@/lib/useTheme";
import styles from "./page.module.css";

export default function HomeClient() {
  const { dark, toggle } = useTheme();

  return (
    <button className={styles.themeToggle} onClick={toggle}>
      {dark ? "Light" : "Dark"}
    </button>
  );
}
