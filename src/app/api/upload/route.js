export const dynamic = "force-dynamic";

import { requireAuth } from "@/lib/session";
import { getPresignedUploadUrl } from "@/lib/r2";

export async function POST(req) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { filename, contentType, postId, isThumbnail } = await req.json();

    if (!filename || !contentType || !postId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return Response.json({ error: "Invalid file type" }, { status: 400 });
    }

    const ext = filename.split(".").pop();
    const key = isThumbnail
      ? `blog/${postId}/thumbnail.${ext}`
      : `blog/${postId}/${Date.now()}.${ext}`;

    const { url, publicUrl } = await getPresignedUploadUrl(key, contentType);
    return Response.json({ url, publicUrl });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}