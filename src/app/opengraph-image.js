import { ImageResponse } from "next/og";
import { lineSeedFontsOption } from "@/lib/ogFont";

// サイト共通のOGP画像（/blog/[id] は個別に生成するため、それ以外のページで使われる）
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "mikancel.com";

export default async function OgImage() {
  const fontsOption = await lineSeedFontsOption("mikancel.comPORTFOLIO / BLOG");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f68827 0%, #e0731a 60%, #c85f0e 100%)",
          fontFamily: "LINESeedJP",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 100,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-2px",
          }}
        >
          mikancel<span style={{ color: "#1a1a1a" }}>.com</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 30,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "4px",
          }}
        >
          PORTFOLIO / BLOG
        </div>
      </div>
    ),
    { ...size, ...fontsOption }
  );
}
