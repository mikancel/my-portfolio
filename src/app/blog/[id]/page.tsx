import { getPostById, getPublishedPostIds } from "@/lib/db";
import { markdownToHtml, extractToc, extractExcerpt } from "@/lib/markdown";
import PostClient from "./PostClient";
import { notFound } from "next/navigation";

export const revalidate = false;

// 公開記事をビルド時に静的生成（CDN配信＝クリックがほぼ瞬時に）。
// publish/更新時は revalidatePath("/blog/:id") で再生成される。
// ここに無い新規記事も dynamicParams(デフォルトtrue) で初回オンデマンド生成→以後キャッシュ。
export async function generateStaticParams() {
  const ids = await getPublishedPostIds();
  return ids.map((id) => ({ id: String(id) }));
}

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const post = await getPostById(Number(id), true);
  if (!post) return {};

  const description = extractExcerpt(post.content, 120) || "mikancel のブログ記事";
  // サムネイルが無い記事はタイトル入りのOG画像を動的生成する
  const image = post.thumbnail || `/api/og/${post.id}`;

  return {
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      images: [image],
      ...(post.published_at ? { publishedTime: post.published_at } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [image],
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const post = await getPostById(Number(id), true);
  if (!post) notFound();

  const [html, toc] = await Promise.all([
    markdownToHtml(post.content || ""),
    Promise.resolve(extractToc(post.content || "")),
  ]);

  return (
    <PostClient
      post={{ ...post }}
      html={html}
      toc={toc}
    />
  );
}