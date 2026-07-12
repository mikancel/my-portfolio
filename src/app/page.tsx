import { getAllPosts } from "@/lib/db";
import Link from "next/link";
import styles from "./page.module.css";
import HomeClient from "./HomeClient";

// 言語グラフ（GitHub API）を1時間ごとに再生成する。
// ブログ更新時は revalidatePath("/") でも再生成される。
export const revalidate = 3600;

async function getLanguages(): Promise<Record<string, number>> {
  const token = process.env.GITHUB_TOKEN;
  const repos: unknown = await fetch(
    "https://api.github.com/users/mikancel/repos?per_page=100",
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    }
  ).then((r) => r.json());

  if (!Array.isArray(repos)) return {};

  const totals: Record<string, number> = {};
  await Promise.all(
    (repos as { languages_url: string }[]).map(async (repo) => {
      const data = (await fetch(repo.languages_url, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
      }).then((r) => r.json())) as Record<string, number>;
      Object.entries(data).forEach(([lang, bytes]) => {
        totals[lang] = (totals[lang] || 0) + bytes;
      });
    })
  );

  return totals;
}

export default async function Home() {
  const [posts, langs] = await Promise.all([
    getAllPosts(true),
    getLanguages(),
  ]);

  const recentPosts = posts.slice(0, 3);
  const total = Object.values(langs).reduce((a, b) => a + b, 0);

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <a href="#" className={styles.navLogo}>
          <span className={styles.accent}>mikancel</span>.com
        </a>
      </nav>

      <section className={styles.hero}>
        <p className={styles.heroLabel}>SE / Developer — Aichi, Japan</p>
        <h1>Welcome to <span className={styles.accent}>mikancel</span>.com</h1>
        <div className={styles.heroActions}>
          <Link href="/aboutme" className={styles.heroBtnPrimary}>About me →</Link>
          {/* 折り返す時は Blog / GitHub がまとまって下段へ行く */}
          <div className={styles.heroActionsGroup}>
            <Link href="/blog" className={styles.heroBtn}>Blog</Link>
            <a
              href="https://github.com/mikancel"
              target="_blank"
              rel="noreferrer"
              className={styles.heroBtn}
            >
              GitHub
            </a>
          </div>
        </div>
      </section>
      <section id="languages" className={styles.langs}>
        <p className={styles.sectionLabel}>— 01 / Languages</p>
        <h2>言語</h2>
        {Object.entries(langs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([lang, bytes]) => {
            const pct = Math.round((bytes / total) * 100);
            return (
              <div key={lang} className={styles.langItem}>
                <div className={styles.langLabel}>
                  <span>{lang}</span><span>{pct}%</span>
                </div>
                <div className={styles.langBar}>
                  <div className={styles.langFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
      </section>

      <section id="blog" className={styles.blogSection}>
        <p className={styles.sectionLabel}>— 02 / Blog</p>
        <h2>ブログ</h2>
        <div className={styles.blogList}>
          {recentPosts.length === 0 ? (
            <p className={styles.blogEmpty}>記事はまだありません</p>
          ) : (
            recentPosts.map((post) => (
              <Link key={post.id} href={`/blog/${post.id}`} className={styles.blogCard}>
                <div className={`${styles.blogCardThumb} ${post.thumbnail ? "" : styles.blogCardThumbPlaceholder}`}>
                  {post.thumbnail
                    ? <img src={post.thumbnail} alt={post.title} />
                    : <span>{post.title?.charAt(0)}</span>}
                </div>
                <span className={styles.blogCardTitle}>{post.title}</span>
              </Link>
            ))
          )}
        </div>
        <Link href="/blog">すべての記事を見る →</Link>
      </section>

      <section id="social" className={styles.contact}>
        <p className={styles.sectionLabel}>— 03 / Social</p>
        <h2>ソーシャル</h2>
        <a href="https://x.com/kankitsu_mikan" target="_blank" className={styles.contactLink}>
          <span>X</span><span>&#64;kankitsu_mikan</span>
        </a>
        <a href="https://github.com/mikancel" target="_blank" className={styles.contactLink}>
          <span>GitHub</span><span>mikancel</span>
        </a>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 mikancel.</span>
        <HomeClient />
      </footer>
    </main>
  );
}