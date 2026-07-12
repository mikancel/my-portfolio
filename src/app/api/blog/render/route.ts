import { markdownToHtml, extractToc } from "@/lib/markdown";
import { requireAuth } from "@/lib/session";

export async function POST(req: Request) {
  const session = await requireAuth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { content } = (await req.json()) as { content?: string };
    const html = await markdownToHtml(content || "");
    const toc = extractToc(content || "");
    return Response.json({ html, toc });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
