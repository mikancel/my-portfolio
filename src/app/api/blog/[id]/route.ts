import { getPostById, updatePost, deletePost, upsertTag } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { serverError } from "@/lib/apiError";
import { revalidatePath } from "next/cache";

type RouteContext = { params: Promise<{ id: string }> };

// 記事に依存する経路をまとめて再生成する。
// /api/og/[id] はルートハンドラだが Full Route Cache 対象なので、
// ここで purge しないとタイトル・サムネ変更後も最大1時間古い画像が配信される。
function revalidatePost(id: string) {
  revalidatePath("/blog");
  revalidatePath(`/blog/${id}`);
  revalidatePath(`/api/og/${id}`);
  revalidatePath("/");
}

export async function GET(req: Request, { params }: RouteContext) {
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
    return serverError("GET /api/blog/[id]", e);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = (await req.json()) as {
      title?: string;
      content?: string;
      thumbnail?: string | null;
      published?: boolean;
      tagNames?: string[];
    };
    const { tagNames, ...rest } = body;
    const tagIds =
      tagNames !== undefined
        ? await Promise.all(
            tagNames.map(async (name) => {
              const tag = await upsertTag(name);
              return tag.id;
            })
          )
        : undefined;
    const post = await updatePost(Number(id), { ...rest, tagIds });
    revalidatePost(id);
    return Response.json(post);
  } catch (e) {
    return serverError("PATCH /api/blog/[id]", e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await deletePost(Number(id));
    revalidatePost(id);
    return Response.json({ ok: true });
  } catch (e) {
    return serverError("DELETE /api/blog/[id]", e);
  }
}
