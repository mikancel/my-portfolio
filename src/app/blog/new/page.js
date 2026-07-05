import { redirect } from "next/navigation";
import { getLatestPostId } from "@/lib/db";

// リダイレクト先（最新記事）を毎リクエスト評価する。
// これがないとビルド時点の最新記事IDで静的に固定されてしまう。
export const dynamic = "force-dynamic";

export default async function BlogNew() {
  const id = await getLatestPostId();
  if (id) redirect(`/blog/${id}`);
  redirect("/blog");
}