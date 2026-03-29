import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

export async function uploadToR2(key, body, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return `https://pic.mikancel.com/${key}`;
}

export async function deleteFromR2(key) {
  await r2.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

export async function deleteFolderFromR2(prefix) {
  const list = await r2.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
  }));
  if (!list.Contents || list.Contents.length === 0) return;
  await r2.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: {
      Objects: list.Contents.map((obj) => ({ Key: obj.Key })),
    },
  }));
}