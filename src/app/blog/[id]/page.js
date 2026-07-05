import { getPostById } from "@/lib/db";
import { markdownToHtml, extractToc } from "@/lib/markdown";
import PostClient from "./PostClient";
import { notFound } from "next/navigation";

export const revalidate = false;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getPostById(Number(id), true);
  if (!post) return {};
  return {
    title: post.title,
    openGraph: {
      title: post.title,
      type: "article",
      ...(post.thumbnail ? { images: [post.thumbnail] } : {}),
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