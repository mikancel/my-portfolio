import { getPostById } from "@/lib/db";
import { markdownToHtml, extractToc, extractExcerpt } from "@/lib/markdown";
import PostClient from "./PostClient";
import { notFound } from "next/navigation";

export const revalidate = false;

export async function generateMetadata({ params }) {
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

export default async function PostPage({ params }) {
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