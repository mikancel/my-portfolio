import { cache } from "react";

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  siteName: string;
};

const TIMEOUT_MS = 3000;
// OGPタグは <head> にあるので、巨大なページ全体を読む必要はない
const MAX_BYTES = 256 * 1024;

// 記事を書けるのは管理者だけなので厳密なSSRF対策までは不要だが、
// 社内ネットワークや localhost を叩かせる事故は防いでおく
const BLOCKED_HOST =
  /^(localhost$|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

function isFetchable(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return !BLOCKED_HOST.test(url.hostname);
}

// レスポンスの先頭だけ読む（<head> さえ取れれば十分）
async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let html = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      html += decoder.decode(value, { stream: true });
      // </head> まで到達したらそれ以降は不要
      if (bytes >= MAX_BYTES || /<\/head>/i.test(html)) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return html;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// <meta property|name="..." content="..."> を属性順に依存せず拾う
function parseMeta(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const metaRe = /<meta\s+([^>]+?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html))) {
    const attrs = m[1];
    const key = attrs
      .match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]
      ?.toLowerCase();
    const content = attrs.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
    if (key && content != null && !map.has(key)) map.set(key, content);
  }
  return map;
}

function parseFavicon(html: string, base: URL): string | null {
  // 実在が確からしい場合だけ返す（/favicon.ico の当て推量はしない＝壊れ画像を出さない）
  const linkRe = /<link\s+([^>]+?)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const attrs = m[1];
    const rel = attrs.match(/rel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!rel || !/\bicon\b/.test(rel)) continue;
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      return new URL(decodeEntities(href), base).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function absolute(value: string | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    return new URL(decodeEntities(value), base).toString();
  } catch {
    return null;
  }
}

async function fetchPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isFetchable(url)) return null;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: {
        // OGPを返さないサイト向けに、一般的なブラウザとして振る舞う
        "User-Agent":
          "Mozilla/5.0 (compatible; mikancel-bot/1.0; +https://mikancel.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      // 外部サイトの情報は1日キャッシュ（ビルド毎に取り直さない）
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    if (!res.headers.get("content-type")?.includes("html")) return null;

    const html = await readHead(res);
    const meta = parseMeta(html);
    const base = new URL(res.url || url.toString());

    const title =
      meta.get("og:title") ||
      meta.get("twitter:title") ||
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ||
      base.hostname;

    const description =
      meta.get("og:description") ||
      meta.get("twitter:description") ||
      meta.get("description") ||
      "";

    return {
      url: base.toString(),
      title: decodeEntities(title).trim(),
      description: decodeEntities(description).trim(),
      image: absolute(
        meta.get("og:image") || meta.get("twitter:image"),
        base
      ),
      favicon: parseFavicon(html, base),
      siteName: decodeEntities(meta.get("og:site_name") || base.hostname),
    };
  } catch {
    // 取得失敗時はカード化せず通常リンクにフォールバックさせる
    return null;
  }
}

// 同一リクエスト内で同じURLを複数回踏んでも1回で済ませる
export const fetchLinkPreview = cache(fetchPreview);
