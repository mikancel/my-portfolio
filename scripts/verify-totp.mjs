#!/usr/bin/env node
// 認証アプリの6桁コードが ADMIN_TOTP_SECRET と一致するか手元で確認する。
//   node --env-file=.env.local scripts/verify-totp.mjs 123456
// 秘密鍵もコードも、この端末から外に出ない。
// デプロイ前の登録確認と、ログインできないときの切り分けに使う。
import crypto from "node:crypto";

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of s.toUpperCase().replace(/[=\s-]/g, "")) {
    const i = A.indexOf(c);
    if (i === -1) throw new Error(`base32として不正な文字が含まれています: ${c}`);
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin =
    ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

const secret = process.env.ADMIN_TOTP_SECRET;
if (!secret) {
  console.error(
    "\n❌ ADMIN_TOTP_SECRET が読めません。" +
      "\n   .env.local に設定したうえで、次のように実行してください:" +
      "\n   node --env-file=.env.local scripts/verify-totp.mjs 123456\n"
  );
  process.exit(1);
}

const code = (process.argv[2] || "").trim();
if (!/^\d{6}$/.test(code)) {
  console.error("\n❌ 6桁の数字を引数に渡してください。例: node --env-file=.env.local scripts/verify-totp.mjs 123456\n");
  process.exit(1);
}

const key = base32Decode(secret);
const counter = Math.floor(Date.now() / 1000 / 30);

// 実装と同じ許容幅(±30秒)で判定しつつ、ずれの大きさも出す
let matched = null;
for (let offset = -1; offset <= 1; offset++) {
  if (hotp(key, counter + offset) === code) matched = offset;
}

if (matched !== null) {
  const note =
    matched === 0
      ? "時刻ずれなし"
      : `時計が約${Math.abs(matched * 30)}秒${matched > 0 ? "進んで" : "遅れて"}います（許容範囲内）`;
  console.log(`\n✅ 一致しました。認証アプリの登録は正しいです。（${note}）\n`);
} else {
  console.log(
    "\n❌ 一致しませんでした。考えられる原因:" +
      "\n   ・認証アプリに登録した鍵が古い（作り直した鍵で登録し直す）" +
      "\n   ・.env.local の ADMIN_TOTP_SECRET が認証アプリのものと違う" +
      "\n   ・コードの有効期限(30秒)が切れた → 新しいコードで再実行" +
      "\n   ・端末の時計が大きくずれている\n"
  );
  process.exit(1);
}
