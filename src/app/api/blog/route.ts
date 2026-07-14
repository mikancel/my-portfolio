import { getAllPosts, createPost, upsertTag, getAllTags } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { serverError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const tagIds = (searchParams.get("tags") || "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

  // 下書きを含む一覧は管理者のみ
  if (all) {
    const session = await requireAuth();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const posts = await getAllPosts(!all, { limit, offset, tagIds });
    const tags = await getAllTags();
    return Response.json({ posts, tags });
  } catch (e) {
    return serverError("GET /api/blog", e);
  }
}

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      title?: string;
      content?: string;
      thumbnail?: string | null;
      published?: boolean;
      tagNames?: string[];
    };
    const { title, content = "", thumbnail, published = false, tagNames = [] } = body;

    if (!title?.trim()) {
      return Response.json({ error: "title is required" }, { status: 400 });
    }

    const tagIds = await Promise.all(
      tagNames.map(async (name) => {
        const tag = await upsertTag(name);
        return tag.id;
      })
    );
    const post = await createPost({ title, content, thumbnail, published, tagIds });
    revalidatePath("/blog");
    revalidatePath("/");
    return Response.json(post, { status: 201 });
  } catch (e) {
    return serverError("POST /api/blog", e);
  }
}
