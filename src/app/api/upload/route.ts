export const dynamic = "force-dynamic";

import crypto from "crypto";
import { requireAuth } from "@/lib/session";
import { serverError } from "@/lib/apiError";
import { getPresignedUploadUrl } from "@/lib/r2";

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { filename, contentType } = (await req.json()) as {
      filename?: string;
      contentType?: string;
    };

    if (!filename || !contentType) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
      return Response.json({ error: "Invalid file type" }, { status: 400 });
    }

    const ext = (filename.split(".").pop() || "").toLowerCase();
    if (!/^[a-z0-9]{1,10}$/.test(ext)) {
      return Response.json({ error: "Invalid file extension" }, { status: 400 });
    }

    // すべての画像・動画にUUIDを付与し、ディレクトリ分けしないフラットなキーにする
    const key = `${crypto.randomUUID()}.${ext}`;

    const { url, publicUrl } = await getPresignedUploadUrl(key, contentType);
    return Response.json({ url, publicUrl });
  } catch (e) {
    return serverError("POST /api/upload", e);
  }
}
