#!/usr/bin/env node
// R2上の未参照画像（どの記事の本文にもサムネにも使われていないファイル）を掃除する。
//
// 使い方:
//   node scripts/sweep-orphan-images.mjs           # dry-run（削除対象を表示するだけ）
//   node scripts/sweep-orphan-images.mjs --delete  # 実際に削除する
//
// 必要な環境変数（.env.local と同じもの）:
//   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN,
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
//
// 例: node --env-file=.env.local scripts/sweep-orphan-images.mjs

import { createClient } from "@libsql/client";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const R2_BASE = "https://pic.mikancel.com/";
const DO_DELETE = process.argv.includes("--delete");

// アップロード直後でまだ保存されていない画像を誤削除しないための猶予（1時間）
const GRACE_MS = 60 * 60 * 1000;

const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`環境変数 ${k} が未設定です。--env-file=.env.local を付けて実行してください`);
    process.exit(1);
  }
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./db/blog.sqlite",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

// DBが参照している全キーを収集（下書き含む全記事の本文＋サムネ）
async function collectReferencedKeys() {
  const result = await db.execute("SELECT content, thumbnail FROM posts");
  const keys = new Set();
  const urlRe = /https:\/\/pic\.mikancel\.com\/[^\s)"']+/g;
  for (const row of result.rows) {
    for (const url of (row.content || "").match(urlRe) || []) {
      keys.add(url.replace(R2_BASE, ""));
    }
    if (typeof row.thumbnail === "string" && row.thumbnail.startsWith(R2_BASE)) {
      keys.add(row.thumbnail.replace(R2_BASE, ""));
    }
  }
  return keys;
}

// R2上の全オブジェクトを列挙
async function listAllR2Objects() {
  const objects = [];
  let token;
  do {
    const res = await r2.send(
      new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token })
    );
    for (const obj of res.Contents || []) {
      objects.push({ key: obj.Key, lastModified: obj.LastModified, size: obj.Size });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

const referenced = await collectReferencedKeys();
const objects = await listAllR2Objects();

const now = Date.now();
const orphans = objects.filter(
  (o) =>
    !referenced.has(o.key) &&
    now - new Date(o.lastModified).getTime() > GRACE_MS
);

console.log(`R2オブジェクト: ${objects.length}件 / DB参照: ${referenced.size}件`);
console.log(`未参照（1時間以上前にアップロード）: ${orphans.length}件`);

if (!orphans.length) {
  console.log("削除対象はありません");
  process.exit(0);
}

for (const o of orphans) {
  console.log(`  ${o.key}  (${(o.size / 1024).toFixed(1)}KB, ${o.lastModified.toISOString()})`);
}

if (!DO_DELETE) {
  console.log("\ndry-run のため削除していません。削除するには --delete を付けて実行してください");
  process.exit(0);
}

for (let i = 0; i < orphans.length; i += 1000) {
  const chunk = orphans.slice(i, i + 1000);
  await r2.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: chunk.map((o) => ({ Key: o.key })) },
    })
  );
}
console.log(`\n${orphans.length}件を削除しました`);
