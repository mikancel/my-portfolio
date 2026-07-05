import { ImageResponse } from "next/og";
import { getPostById } from "@/lib/db";

export const revalidate = 3600;

// 日本語グリフを含むフォントを、必要な文字だけのサブセットで取得する。
// satori は woff2 非対応のため、旧UAを名乗って ttf を返させる。
async function loadJapaneseFont(text) {
  const url =
    "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=" +
    encodeURIComponent(text);
  const css = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534.30 (KHTML, like Gecko)",
    },
  }).then((r) => r.text());
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(?:truetype|opentype)['"]?\)/);
  if (!match) return null;
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

export async function GET(req, { params }) {
  const { id } = await params;
  const post = await getPostById(Number(id), true);
  if (!post) return new Response("Not found", { status: 404 });

  const title =
    post.title.length > 60 ? `${post.title.slice(0, 59)}…` : post.title;
  const brand = "mikancel.com/blog";

  let fonts;
  try {
    const data = await loadJapaneseFont(title + brand);
    if (data) {
      fonts = [{ name: "NotoSansJP", data, weight: 700, style: "normal" }];
    }
  } catch {
    // フォント取得に失敗しても画像自体は返す（欧文はデフォルトフォントで描画される）
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0f0f0f",
          fontFamily: "NotoSansJP",
        }}
      >
        {/* オレンジのアクセントバー */}
        <div
          style={{
            display: "flex",
            width: 120,
            height: 12,
            background: "linear-gradient(90deg, #f68827, #e0731a)",
            borderRadius: 6,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: title.length > 30 ? 54 : 68,
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.35,
            letterSpacing: "-1px",
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 32, fontWeight: 700 }}>
            <span style={{ color: "#f68827" }}>mikancel</span>
            <span style={{ color: "#ffffff" }}>.com/blog</span>
          </div>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#f68827",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {post.title.charAt(0)}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts ? { fonts } : {}),
    }
  );
}
