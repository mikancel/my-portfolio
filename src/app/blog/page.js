import { getAllPosts, getAllTags } from "@/lib/db";
import BlogClient from "./BlogClient";

export const revalidate = false;

export default async function BlogPage() {
  const [posts, tags] = await Promise.all([
    getAllPosts(true, { limit: 20, offset: 0 }),
    getAllTags(),
  ]);
  return (
    <BlogClient
      posts={posts.map(p => ({ ...p }))}
      tags={tags.map(t => ({ ...t }))}
    />
  );
}