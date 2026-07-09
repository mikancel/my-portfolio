import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function getPresignedUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(r2, command, { expiresIn: 120 });
  return { url, publicUrl: `https://pic.mikancel.com/${key}` };
}

export async function deleteFromR2(key) {
  await r2.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

// 複数キーをまとめて削除（DeleteObjectsは最大1000件/回）
export async function deleteManyFromR2(keys) {
  if (!keys.length) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await r2.send(new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: chunk.map((Key) => ({ Key })) },
    }));
  }
}

export async function deleteFolderFromR2(prefix) {
  // ListObjectsV2は最大1000件/回のためページングする
  let continuationToken;
  do {
    const list = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    if (list.Contents?.length) {
      await r2.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: {
          Objects: list.Contents.map((obj) => ({ Key: obj.Key })),
        },
      }));
    }
    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}