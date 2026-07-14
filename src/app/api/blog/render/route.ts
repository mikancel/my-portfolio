import { markdownToHtml, extractToc } from "@/lib/markdown";
import { requireAuth } from "@/lib/session";
import { serverError } from "@/lib/apiError";

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { content } = (await req.json()) as { content?: string };
    const html = await markdownToHtml(content || "");
    const toc = extractToc(content || "");
    return Response.json({ html, toc });
  } catch (e) {
    return serverError("POST /api/blog/render", e);
  }
}
