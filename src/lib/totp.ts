import crypto from "crypto";

// RFC 6238 (TOTP) / RFC 4226 (HOTP) の最小実装。
// 認証アプリ(Google Authenticator, 1Password等)が生成する6桁コードを検証する。
// 追加ライブラリは入れない（依存を増やすほど攻撃面が広がるため）。

const STEP_SECONDS = 30;
const DIGITS = 6;
// 端末とサーバーの時計ずれを吸収する許容幅（前後1ステップ＝±30秒）
const WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[=\s-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function hotp(key: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  // 動的切り出し（RFC 4226 5.4）
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

// 桁数・内容を推測されないよう、比較は常に同じ時間で行う
function equals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * コードを検証し、成功したら「どの時間ステップで一致したか」を返す。
 * 呼び出し側はこの値を記録して、同じコードの使い回し（リプレイ）を弾く。
 */
export function verifyTotp(
  token: string,
  secret: string,
  now: number = Date.now()
): number | null {
  if (!/^\d{6}$/.test(token)) return null;

  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return null;
  }
  if (!key.length) return null;

  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    if (equals(hotp(key, counter + offset), token)) return counter + offset;
  }
  return null;
}

// ---- 初期設定（scripts/setup-totp.mjs から使う） ----

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // RFC 4226 推奨の160bit
}

export function buildOtpauthUri(secret: string, label: string): string {
  const params = new URLSearchParams({
    secret,
    issuer: "mikancel.com",
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params}`;
}
