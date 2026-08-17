// DBには published_at（ISO・UTC明示）と updated_at（SQLiteトリガの素の文字列）が
// 混在しており、後者をローカル時刻と誤解釈すると日付が前日にずれる。
// 「公開と同時刻なのに更新日が前日になる」事故が実際に起きたのでここで固定する。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { formatDate, parseDate } from "@/lib/format";

// 実運用と同じJST基準で検証する（UTC実行のCIでも結果が変わらないように）
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Asia/Tokyo";
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe("parseDate", () => {
  it("ISO形式(Z付き)はUTCとして解釈する", () => {
    expect(parseDate("2026-07-03T15:24:03.114Z")?.toISOString()).toBe(
      "2026-07-03T15:24:03.114Z"
    );
  });

  it("タイムゾーン表記のない形式もUTCとして解釈する", () => {
    expect(parseDate("2026-07-03 15:24:03")?.toISOString()).toBe(
      "2026-07-03T15:24:03.000Z"
    );
  });

  it("同一時刻なら両形式が同じ瞬間を指す", () => {
    const iso = parseDate("2026-07-03T15:24:03.000Z")!.getTime();
    const naive = parseDate("2026-07-03 15:24:03")!.getTime();
    expect(naive).toBe(iso);
  });

  it("空値・不正値は null", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("formatDate", () => {
  it("公開日と更新日が同一時刻なら同じ日付になる（更新が前日にならない）", () => {
    expect(formatDate("2026-07-03T15:24:03.114Z")).toBe(
      formatDate("2026-07-03 15:24:03")
    );
  });

  it("UTC 15:24 は JST では翌日として表示される", () => {
    expect(formatDate("2026-07-03 15:24:03")).toBe("2026/07/04");
  });

  it("空値は空文字", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });
});
