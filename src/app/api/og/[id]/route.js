import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getPostById } from "@/lib/db";
import { lineSeedFontsOption } from "@/lib/ogFont";

export const revalidate = 3600;

// サムネイルはWebPで保存しているが、satori(next/og)はWebPを描画できないため
// PNGに変換してdata URIで埋め込む。失敗時はnull（タイトル1文字目にフォールバック）。
async function thumbnailDataUri(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const png = await sharp(buf)
      .resize(112, 112, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req, { params }) {
  const { id } = await params;
  const post = await getPostById(Number(id), true);
  if (!post) return new Response("Not found", { status: 404 });

  const title =
    post.title.length > 60 ? `${post.title.slice(0, 59)}…` : post.title;
  const brand = "mikancel.com/blog";

  // フォント取得に失敗しても画像自体は返す（欧文はデフォルトフォントで描画される）
  const [fontsOption, thumb] = await Promise.all([
    lineSeedFontsOption(title + brand),
    post.thumbnail ? thumbnailDataUri(post.thumbnail) : Promise.resolve(null),
  ]);

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
          fontFamily: "LINESeedJP",
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
          {thumb ? (
            <img
              src={thumb}
              width={56}
              height={56}
              style={{
                width: 56,
                height: 56,
                borderRadius: 6,
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 56,
                height: 56,
                borderRadius: 6,
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
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...fontsOption,
    }
  );
}
