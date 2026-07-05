import { markdownToHtml, extractToc } from "@/lib/markdown";
import { requireAuth } from "@/lib/session";

export async function POST(req) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { content } = await req.json();
    const html = await markdownToHtml(content || "");
    const toc = extractToc(content || "");
    return Response.json({ html, toc });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
