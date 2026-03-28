import { redirect } from "next/navigation";
import { getLatestPostId } from "@/lib/db";

export default function BlogNew() {
  const id = getLatestPostId();
  if (id) redirect(`/blog/${id}`);
  redirect("/blog");
}
