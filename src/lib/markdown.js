import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

// mdast（Markdown AST）から h1-h3 を出現順に抽出して連番IDを振る。
// 行単位の正規表現と違い、コードブロック内の「# ...」を誤検出しない。
function collectHeadings(markdown) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown || "");
  const counters = { 1: 0, 2: 0, 3: 0 };
  const prefixes = { 1: "alpha", 2: "bravo", 3: "charlie" };
  const headings = [];

  const textOf = (node) =>
    node.value ?? (node.children || []).map(textOf).join("");

  const walk = (node) => {
    if (node.type === "heading" && node.depth <= 3) {
      counters[node.depth]++;
      headings.push({
        level: node.depth,
        text: textOf(node).trim(),
        id: `${prefixes[node.depth]}${counters[node.depth]}`,
      });
    }
    (node.children || []).forEach(walk);
  };
  walk(tree);
  return headings;
}

// 本文内の画像を遅延読み込みにする（初期表示と転送量の削減）
function rehypeImageLazy() {
  return (tree) => {
    const walk = (node) => {
      if (node.type === "element" && node.tagName === "img") {
        node.properties = {
          ...node.properties,
          loading: "lazy",
          decoding: "async",
        };
      }
      (node.children || []).forEach(walk);
    };
    walk(tree);
  };
}

// hast（HTML AST）の h1-h3 に、collectHeadings と同じ順序でIDを割り当てる
function rehypeHeadingIds(ids) {
  return (tree) => {
    let idx = 0;
    const walk = (node) => {
      if (node.type === "element" && /^h[1-3]$/.test(node.tagName)) {
        if (ids[idx]) {
          node.properties = { ...node.properties, id: ids[idx].id };
        }
        idx++;
      }
      (node.children || []).forEach(walk);
    };
    walk(tree);
  };
}

export async function markdownToHtml(markdown) {
  const ids = collectHeadings(markdown);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(() => rehypeHeadingIds(ids))
    .use(rehypeImageLazy)
    .use(rehypeHighlight)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown || "");

  return String(result);
}

export function extractToc(markdown) {
  return collectHeadings(markdown);
}

// OGP説明文用に本文からプレーンテキストの抜粋を作る
export function extractExcerpt(markdown, maxLength = 120) {
  if (!markdown) return "";
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")          // コードブロック
    .replace(/`[^`]*`/g, " ")                  // インラインコード
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")    // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // リンク → テキストのみ
    .replace(/<[^>]+>/g, " ")                  // HTMLタグ
    .replace(/^#{1,6}\s+/gm, "")              // 見出し記号
    .replace(/[*_~>|]/g, "")                   // 装飾記号
    .replace(/^[-+]\s+/gm, "")                // リスト記号
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
