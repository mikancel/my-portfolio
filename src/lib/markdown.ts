import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

export type TocItem = {
  level: number;
  text: string;
  id: string;
};

// AST ノードの必要最小限の型（unified の複雑な型階層に依存しない）
type AstNode = {
  type: string;
  depth?: number;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: AstNode[];
};

// mdast（Markdown AST）から h1-h3 を出現順に抽出して連番IDを振る。
// 行単位の正規表現と違い、コードブロック内の「# ...」を誤検出しない。
function collectHeadings(markdown: string): TocItem[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown || "") as unknown as AstNode;
  const counters: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const prefixes: Record<number, string> = { 1: "alpha", 2: "bravo", 3: "charlie" };
  const headings: TocItem[] = [];

  const textOf = (node: AstNode): string =>
    node.value ?? (node.children || []).map(textOf).join("");

  const walk = (node: AstNode): void => {
    if (node.type === "heading" && node.depth != null && node.depth <= 3) {
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
  return (tree: AstNode) => {
    const walk = (node: AstNode): void => {
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
function rehypeHeadingIds(ids: TocItem[]) {
  return (tree: AstNode) => {
    let idx = 0;
    const walk = (node: AstNode): void => {
      if (node.type === "element" && /^h[1-3]$/.test(node.tagName ?? "")) {
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

export async function markdownToHtml(markdown: string): Promise<string> {
  const ids = collectHeadings(markdown);

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(() => rehypeHeadingIds(ids) as never)
    .use(() => rehypeImageLazy() as never)
    .use(rehypeHighlight)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown || "");

  return String(result);
}

export function extractToc(markdown: string): TocItem[] {
  return collectHeadings(markdown);
}

// OGP説明文用に本文からプレーンテキストの抜粋を作る
export function extractExcerpt(markdown: string, maxLength = 120): string {
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
