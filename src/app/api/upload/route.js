export const maxDuration = 60;
export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/session";
import { uploadToR2 } from "@/lib/r2";

export async function POST(req) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const postId = formData.get("postId");

    if (!file) return Response.json({ error: "No file" }, { status: 400 });

    if (file.size > 4.5 * 1024 * 1024) {
      return Response.json({ error: "ファイルサイズは4.5MB以下にしてください" }, { status: 413 });
    }

    const ext = file.name.split(".").pop();
    const filename = `${Date.now()}.${ext}`;
    const key = `blog/${postId}/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToR2(key, buffer, file.type);

    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}