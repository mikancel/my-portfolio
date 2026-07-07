import { getPublishedPostsMeta, getAllTags } from "@/lib/db";
import BlogClient from "./BlogClient";

// 公開記事の全メタデータを静的にキャッシュ（publish時に revalidatePath で再生成）。
// タグ絞り込みはクライアント側で行うのでDBへの追加クエリは発生しない。
export const revalidate = false;

export default async function BlogPage() {
  const [posts, tags] = await Promise.all([
    getPublishedPostsMeta(),
    getAllTags(),
  ]);
  return (
    <BlogClient
      posts={posts.map(p => ({ ...p }))}
      tags={tags.map(t => ({ ...t }))}
    />
  );
}