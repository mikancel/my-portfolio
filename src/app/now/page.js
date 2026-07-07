import PageShell from "@/components/PageShell";
import styles from "./now.module.css";

export const metadata = {
  title: "now - mikancel.com",
  description: "mikancel が今やっていること",
};

// TODO: 近況が変わったらここを編集（LAST_UPDATED も忘れずに）
const LAST_UPDATED = "2026-07-06";

const SECTIONS = [
  { icon: "📍", label: "拠点", body: "愛知県。SE として業務システムの保守をしています。" },
  { icon: "🛠", label: "作っているもの", body: "このポートフォリオサイト（mikancel.com）を少しずつ育てています。" },
  { icon: "📚", label: "学んでいること", body: "Java / Kotlin。静的型付けの世界を深掘り中。" },
  { icon: "🎮", label: "遊んでいる", body: "ゼンレスゾーンゼロ" },
  { icon: "📺", label: "観ている", body: "響け！ユーフォニアム" },
];

export default function NowPage() {
  return (
    <PageShell>
      <p className={styles.cmd}>$ cat now.md</p>

      <header className={styles.header}>
        <h1 className={styles.title}>いま、していること</h1>
        <p className={styles.updated}>
          <span className={styles.dot} />
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className={styles.list}>
        {SECTIONS.map((s) => (
          <section key={s.label} className={styles.item}>
            <span className={styles.icon}>{s.icon}</span>
            <div>
              <p className={styles.label}>{s.label}</p>
              <p className={styles.body}>{s.body}</p>
            </div>
          </section>
        ))}
      </div>

      <p className={styles.note}>
        これは <a href="https://nownownow.com/about" target="_blank" rel="noreferrer">now page</a> です。
        いま何をしているかのスナップショットで、不定期に更新します。
      </p>
    </PageShell>
  );
}
