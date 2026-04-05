import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

function generateIds(markdown) {
  const counters = { 1: 0, 2: 0, 3: 0 };
  const prefixes = { 1: "alpha", 2: "bravo", 3: "charlie" };
  const map = [];

  const lines = markdown.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)/);
    if (m) {
      const level = m[1].length;
      const text = m[2].replace(/[*_`]/g, "").trim();
      counters[level]++;
      const id = `${prefixes[level]}${counters[level]}`;
      map.push({ level, text, id });
    }
  }
  return map;
}

export async function markdownToHtml(markdown) {
  const ids = generateIds(markdown);
  let idx = 0;

  const processed = markdown.replace(
    /^(#{1,3})\s+(.+)$/gm,
    (_, hashes, text) => {
      const id = ids[idx]?.id || "heading";
      idx++;
      return `${hashes} ${text} {#${id}}`;
    }
  );

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(processed);

  const html = String(result).replace(
    /<(h[1-3])>(.+?)\s*\{#([\w-]+)\}<\/h[1-3]>/g,
    (_, tag, text, id) => `<${tag} id="${id}">${text}</${tag}>`
  );

  return html;
}

export function extractToc(markdown) {
  const ids = generateIds(markdown);
  return ids.map(({ level, text, id }) => ({ id, text, level }));
}