import { getPostById, updatePost, deletePost, upsertTag } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function GET(req, { params }) {
  const { id } = await params;
  const all = new URL(req.url).searchParams.get("all") === "1";
  // 下書きの取得は管理者のみ
  if (all) {
    const session = await requireAuth();
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const post = await getPostById(Number(id), !all);
    if (!post) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(post);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { tagNames, ...rest } = body;
    const tagIds = tagNames !== undefined
      ? await Promise.all(tagNames.map(async (name) => {
          const tag = await upsertTag(name);
          return tag.id;
        }))
      : undefined;
    const post = await updatePost(Number(id), { ...rest, tagIds });
    revalidatePath("/blog");
    revalidatePath(`/blog/${id}`);
    revalidatePath("/");
    return Response.json(post);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await deletePost(Number(id));
    revalidatePath("/blog");
    revalidatePath(`/blog/${id}`);
    revalidatePath("/");
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}