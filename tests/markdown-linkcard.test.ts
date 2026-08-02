// 単独行の素URLだけをリンクカード化する変換の回帰テスト。
// 「文中のリンクまで巻き込む」「取得失敗でリンクごと消える」「タイトルからXSS」が主な事故なので、
// そこを重点的に固定する。
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ogp", () => ({ fetchLinkPreview: vi.fn() }));

import { markdownToHtml } from "@/lib/markdown";
import { fetchLinkPreview } from "@/lib/ogp";

const mockPreview = vi.mocked(fetchLinkPreview);

const preview = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    url: "https://example.com/article",
    title: "サンプル記事",
    description: "説明文です",
    image: "https://example.com/og.png",
    favicon: "https://example.com/favicon.ico",
    siteName: "example.com",
    ...over,
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mockPreview.mockResolvedValue(preview());
});

describe("リンクカード変換", () => {
  it("単独行の素URLはカードになる", async () => {
    const html = await markdownToHtml("本文\n\nhttps://example.com/article\n\n続き");
    expect(html).toContain('class="link-card"');
    expect(html).toContain("サンプル記事");
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("https://example.com/og.png");
  });

  it("[テキスト](URL) 形式はカード化しない（表記を書き手が指定しているため）", async () => {
    const html = await markdownToHtml("\n\n[詳しくはこちら](https://example.com/article)\n\n");
    expect(html).not.toContain("link-card");
    expect(html).toContain("詳しくはこちら");
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("文中に混ざったURLはカード化しない", async () => {
    const html = await markdownToHtml("参考: https://example.com/article を見てください");
    expect(html).not.toContain("link-card");
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("OGP取得に失敗したら通常のリンクとして残す", async () => {
    mockPreview.mockResolvedValue(null as never);
    const html = await markdownToHtml("\n\nhttps://example.com/article\n\n");
    expect(html).not.toContain("link-card");
    expect(html).toContain('href="https://example.com/article"');
  });

  it("画像・favicon・説明が無くてもカードは生成される", async () => {
    mockPreview.mockResolvedValue(
      preview({ image: null, favicon: null, description: "" })
    );
    const html = await markdownToHtml("\n\nhttps://example.com/article\n\n");
    expect(html).toContain('class="link-card"');
    expect(html).not.toContain("link-card-thumb");
    expect(html).not.toContain("link-card-favicon");
    expect(html).not.toContain("link-card-desc");
  });

  it("取得したタイトルはエスケープされる（リンク先由来のHTMLを実行させない）", async () => {
    mockPreview.mockResolvedValue(
      preview({ title: '<img src=x onerror="alert(1)">', description: "" })
    );
    const html = await markdownToHtml("\n\nhttps://example.com/article\n\n");
    // 実行可能なタグとして注入されていないこと（文字列として現れるのは無害）
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("複数のURL行をまとめて処理する", async () => {
    const html = await markdownToHtml(
      "\n\nhttps://example.com/a\n\nhttps://example.com/b\n\n"
    );
    expect(html.match(/class="link-card"/g)).toHaveLength(2);
    expect(mockPreview).toHaveBeenCalledTimes(2);
  });

  it("コードブロック内のURLには触れない", async () => {
    const html = await markdownToHtml("```\nhttps://example.com/article\n```");
    expect(html).not.toContain("link-card");
    expect(mockPreview).not.toHaveBeenCalled();
  });
});
