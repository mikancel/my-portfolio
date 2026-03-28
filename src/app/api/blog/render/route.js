import { markdownToHtml, extractToc } from "@/lib/markdown";

export async function POST(req) {
  try {
    const { content } = await req.json();
    const html = await markdownToHtml(content || "");
    const toc = extractToc(content || "");
    return Response.json({ html, toc });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
