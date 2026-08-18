// TOTP実装の検証。RFC 6238 の公式テストベクタで、自前実装が標準準拠であることを確かめる。
// ここがずれていると認証アプリのコードが一生通らない（または他人のコードが通る）。
import { describe, it, expect } from "vitest";
import { verifyTotp, base32Encode, base32Decode, generateSecret } from "@/lib/totp";

// RFC 6238 Appendix B のSHA-1用シード "12345678901234567890"
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("エンコードとデコードが往復する", () => {
    const buf = Buffer.from("12345678901234567890", "ascii");
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
  });

  it("生成される秘密鍵は160bit(base32で32文字)", () => {
    expect(generateSecret()).toMatch(/^[A-Z2-7]{32}$/);
  });
});

describe("verifyTotp（RFC 6238 テストベクタ）", () => {
  // 公式ベクタは8桁だが本実装は6桁なので、下6桁が一致するはず
  const vectors: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ];

  for (const [unixTime, code] of vectors) {
    it(`t=${unixTime} で ${code} を受理する`, () => {
      expect(verifyTotp(code, RFC_SECRET, unixTime * 1000)).not.toBeNull();
    });
  }

  it("誤ったコードは拒否する", () => {
    expect(verifyTotp("000000", RFC_SECRET, 59 * 1000)).toBeNull();
  });

  it("時計ずれ±30秒までは許容する", () => {
    const t = 1111111109 * 1000;
    expect(verifyTotp("081804", RFC_SECRET, t + 29_000)).not.toBeNull();
    expect(verifyTotp("081804", RFC_SECRET, t - 29_000)).not.toBeNull();
  });

  it("2分ずれたコードは拒否する", () => {
    const t = 1111111109 * 1000;
    expect(verifyTotp("081804", RFC_SECRET, t + 120_000)).toBeNull();
  });

  it("一致したステップ番号を返す（リプレイ検知に使う）", () => {
    const step = verifyTotp("081804", RFC_SECRET, 1111111109 * 1000);
    expect(step).toBe(Math.floor(1111111109 / 30));
  });

  it("6桁の数字以外は即座に拒否する", () => {
    expect(verifyTotp("12345", RFC_SECRET)).toBeNull();
    expect(verifyTotp("1234567", RFC_SECRET)).toBeNull();
    expect(verifyTotp("abcdef", RFC_SECRET)).toBeNull();
    expect(verifyTotp("", RFC_SECRET)).toBeNull();
  });

  it("秘密鍵が不正・空なら拒否する", () => {
    expect(verifyTotp("287082", "not-base32!!!")).toBeNull();
    expect(verifyTotp("287082", "")).toBeNull();
  });
});
