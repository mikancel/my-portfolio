import { redirect } from "next/navigation";
import { getLatestPostId } from "@/lib/db";

export default async function BlogNew() {
  const id = await getLatestPostId();
  if (id) redirect(`/blog/${id}`);
  redirect("/blog");
}