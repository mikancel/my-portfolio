import Link from "next/link";
import PageShell from "@/components/PageShell";
import styles from "./map.module.css";

export const metadata = {
  title: "sitemap - mikancel.com",
  description: "mikancel.com のサイトマップ",
};

// tree風の行定義。prefix はツリーの罫線、href があればリンクにする
const TREE = [
  { prefix: "├─ ", href: "/", path: "/", label: "Home" },
  { prefix: "├─ ", href: "/aboutme", path: "/aboutme", label: "About me" },
  { prefix: "├─ ", href: "/blog", path: "/blog", label: "Blog" },
  { prefix: "│  ├─ ", path: "/blog/:id", label: "記事ページ" },
  { prefix: "│  └─ ", href: "/blog/new", path: "/blog/new", label: "最新記事へ" },
  { prefix: "├─ ", href: "/now", path: "/now", label: "いま" },
  { prefix: "└─ ", href: "/map", path: "/map", label: "サイトマップ（このページ）" },
];

export default function MapPage() {
  return (
    <PageShell>
      <p className={styles.cmd}>$ tree mikancel.com</p>

      <div className={styles.tree}>
        <p className={styles.root}>mikancel.com</p>
        {TREE.map((row) => (
          <p key={row.path} className={styles.row}>
            <span className={styles.branch}>{row.prefix}</span>
            {row.href ? (
              <Link href={row.href} className={styles.path}>
                {row.path}
              </Link>
            ) : (
              <span className={styles.pathDim}>{row.path}</span>
            )}
            <span className={styles.label}>{row.label}</span>
          </p>
        ))}
      </div>

      <p className={styles.summary}>
        {TREE.filter((r) => r.href).length} directories · 探索してみてください
      </p>
    </PageShell>
  );
}
