#!/usr/bin/env node
// 管理画面の2要素目(TOTP)を初期設定する。
//   npm run setup:totp
// 秘密鍵の生成 → .env.local への書き込み → 認証アプリ用QRの表示 までを一度に行う。
// 鍵はこの端末で生成され、外部には一切送信されない（QRもオフラインで描画する）。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
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

const KEY = "ADMIN_TOTP_SECRET";
const ENV_PATH = path.join(process.cwd(), ".env.local");

// 既存の値は置き換え、無ければ追記する。他の行には触らない。
function writeEnv(secret) {
  let content = "";
  try {
    content = fs.readFileSync(ENV_PATH, "utf8");
  } catch {
    // .env.local が無ければ新規作成
  }

  const line = `${KEY}=${secret}`;
  const pattern = new RegExp(`^${KEY}=.*$`, "m");
  let next;
  let replaced;
  if (pattern.test(content)) {
    next = content.replace(pattern, line);
    replaced = true;
  } else {
    // 直前の行と繋がらないよう改行を担保する
    const sep = content === "" || content.endsWith("\n") ? "" : "\n";
    next = `${content}${sep}${line}\n`;
    replaced = false;
  }
  fs.writeFileSync(ENV_PATH, next);
  return replaced;
}

const label = process.argv[2] || "admin.mikancel.com";
const secret = base32Encode(crypto.randomBytes(20)); // RFC 4226 推奨の160bit

const params = new URLSearchParams({
  secret,
  issuer: "mikancel.com",
  algorithm: "SHA1",
  digits: "6",
  period: "30",
});
const uri = `otpauth://totp/${encodeURIComponent(label)}?${params}`;

const replaced = writeEnv(secret);
const qr = await QRCode.toString(uri, { type: "terminal", small: true });

console.log(`
${qr}
 ① 上のQRを認証アプリ(Google Authenticator / 1Password など)で読み取る
    読み取れない場合は、この鍵を手入力:  ${secret}

 ② Vercel の環境変数に登録する（本番用・これだけは手作業）
    ${KEY} = ${secret}

 ③ 登録できたか確認する
    node --env-file=.env.local scripts/verify-totp.mjs 123456

 .env.local は${replaced ? "既存の値を上書きしました" : "自動で追記しました"}（手作業は不要）
 鍵はこの画面にしか出ません。控えたら画面を閉じてください。
`);
