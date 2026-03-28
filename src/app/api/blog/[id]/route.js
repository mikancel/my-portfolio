import { getPostById, updatePost, deletePost, upsertTag } from "@/lib/db";
import { requireAuth } from "@/lib/session";

export async function GET(req, { params }) {
  const { id } = await params;
  const all = new URL(req.url).searchParams.get("all") === "1";
  try {
    const post = getPostById(Number(id), !all);
    if (!post) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(post);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const session = await requireAuth(req, new Response());
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const { tagNames, ...rest } = body;
    const tagIds = tagNames !== undefined
      ? tagNames.map((name) => upsertTag(name).id)
      : undefined;
    const post = updatePost(Number(id), { ...rest, tagIds });
    return Response.json(post);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await requireAuth(req, new Response());
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    deletePost(Number(id));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
