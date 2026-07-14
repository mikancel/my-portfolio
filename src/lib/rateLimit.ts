import crypto from "crypto";

// インメモリのスライディングウィンドウ。サーバーレスではインスタンス単位なので
// 厳密な上限ではないが、単一IPからの総当たりを実用上成立させない程度には効く。
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { ok: false, retryAfter };
  }

  hits.push(now);
  buckets.set(key, hits);

  // 放置するとキーが際限なく増えるので、たまに期限切れを掃除する
  if (buckets.size > 500) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || "unknown";
}

// 文字列比較を長さで早期リターンさせない（トークンの一致文字数を推測されないため）
export function timingSafeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
