// OG画像用に LINE Seed JP を必要なグリフだけサブセット取得する。
// satori(ImageResponse)は woff2 非対応のため、旧UAを名乗って ttf を返させる。
// Google Fonts が応答しない場合に関数タイムアウトまでぶら下がらないよう上限を切る
const FETCH_TIMEOUT_MS = 3000;

export async function loadLineSeedFont(text: string): Promise<ArrayBuffer | null> {
  const url =
    "https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@700&text=" +
    encodeURIComponent(text);
  const css = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534.30 (KHTML, like Gecko)",
    },
  }).then((r) => r.text());
  const match = css.match(
    /src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/
  );
  if (!match) return null;
  return fetch(match[1], {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  }).then((r) => r.arrayBuffer());
}

type FontsOption = {
  fonts?: { name: string; data: ArrayBuffer; weight: 700; style: "normal" }[];
};

// 取得失敗時は fonts 指定なし（デフォルトフォント）で描画を続行するためのヘルパ
export async function lineSeedFontsOption(text: string): Promise<FontsOption> {
  try {
    const data = await loadLineSeedFont(text);
    if (!data) return {};
    return {
      fonts: [{ name: "LINESeedJP", data, weight: 700, style: "normal" }],
    };
  } catch {
    return {};
  }
}
