import { getAllPosts, createPost, upsertTag, getAllTags } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const all = searchParams.get("all") === "1";

  try {
    let posts = getAllPosts(!all);
    if (tag) {
      posts = posts.filter((p) => p.tags.some((t) => t.slug === tag));
    }
    const tags = getAllTags();
    return Response.json({ posts, tags });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const session = await requireAuth(req, new Response());
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, content, thumbnail, published = false, tagNames = [] } = body;

    if (!title?.trim()) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const tagIds = tagNames.map((name) => upsertTag(name).id);
    const post = createPost({ title, content, thumbnail, published, tagIds });
    return Response.json(post, { status: 201 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
