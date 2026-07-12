import { cache } from "react";
import { createClient, type Client, type Row } from "@libsql/client";
import { deleteManyFromR2 } from "@/lib/r2";
import type { Post, PostMeta, Tag, WebAuthnCredentialRow } from "@/lib/types";

const R2_BASE = "https://pic.mikancel.com/";
const isR2Url = (u: unknown): u is string =>
  typeof u === "string" && u.startsWith(R2_BASE);
const r2UrlToKey = (u: string) => u.replace(R2_BASE, "");

let _db: Client | null = null;

export function getDb(): Client {
  if (_db) return _db;
  _db = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:./db/blog.sqlite",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _db;
}

// ---- Posts ----

type PostRowBase = {
  id: number;
  title: string;
  thumbnail: string | null;
  published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  content?: string;
};

type AttachedPost = Omit<PostRowBase, "published"> & {
  published: boolean;
  tags: Tag[];
};

// 記事配列にタグを付与する（区切り文字に依存しない安全な方式）
async function attachTags(rows: Row[]): Promise<AttachedPost[]> {
  const posts: AttachedPost[] = rows.map((r) => {
    const base = r as unknown as PostRowBase;
    return { ...base, published: !!base.published, tags: [] };
  });
  if (!posts.length) return posts;

  const db = getDb();
  const ids = posts.map((p) => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT pt.post_id, t.id, t.name, t.slug
          FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id IN (${placeholders})
          ORDER BY t.name`,
    args: ids,
  });

  const byPost = new Map(posts.map((p) => [p.id, p.tags]));
  for (const row of result.rows as unknown as {
    post_id: number;
    id: number;
    name: string;
    slug: string;
  }[]) {
    byPost.get(row.post_id)?.push({ id: row.id, name: row.name, slug: row.slug });
  }
  return posts;
}

export async function getAllPosts(
  publishedOnly = true,
  {
    limit = 20,
    offset = 0,
    tagIds = [] as number[],
  }: { limit?: number; offset?: number; tagIds?: number[] } = {}
): Promise<Post[]> {
  const db = getDb();
  const where: string[] = [];
  const args: (number | string)[] = [];

  if (publishedOnly) where.push("p.published = 1");
  if (tagIds.length) {
    // 指定タグを全て持つ記事のみ
    where.push(
      `p.id IN (SELECT post_id FROM post_tags
                WHERE tag_id IN (${tagIds.map(() => "?").join(",")})
                GROUP BY post_id
                HAVING COUNT(DISTINCT tag_id) = ?)`
    );
    args.push(...tagIds, tagIds.length);
  }
  args.push(limit, offset);

  const result = await db.execute({
    sql: `SELECT p.* FROM posts p
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY COALESCE(p.published_at, p.created_at) DESC
          LIMIT ? OFFSET ?`,
    args,
  });
  return (await attachTags(result.rows)) as Post[];
}

// 公開記事の一覧メタデータ（本文contentを含まない軽量版）を全件返す。
// /blog ページはこれをキャッシュ済みHTMLに埋め込み、タグ絞り込みは
// クライアント側で行うため、タグクリックごとのDBアクセスが発生しない。
export async function getPublishedPostsMeta(): Promise<PostMeta[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT p.id, p.title, p.thumbnail, p.published,
            p.published_at, p.created_at, p.updated_at
     FROM posts p
     WHERE p.published = 1
     ORDER BY COALESCE(p.published_at, p.created_at) DESC`
  );
  return (await attachTags(result.rows)) as PostMeta[];
}

// React cache() でメモ化。同一リクエスト内（generateMetadata とページ本体）で
// 同じ getPostById(id) を呼んでもDBクエリは1回に統合される。
export const getPostById = cache(
  async (id: number, publishedOnly = true): Promise<Post | null> => {
    const db = getDb();
    const result = await db.execute({
      sql: `SELECT p.* FROM posts p
          WHERE p.id = ? ${publishedOnly ? "AND p.published = 1" : ""}`,
      args: [id],
    });
    if (!result.rows.length) return null;
    const [post] = (await attachTags(result.rows)) as Post[];
    return post;
  }
);

// 公開記事のIDを列挙（generateStaticParams 用）
export async function getPublishedPostIds(): Promise<number[]> {
  const db = getDb();
  const result = await db.execute("SELECT id FROM posts WHERE published = 1");
  return result.rows.map((r) => Number(r.id));
}

export async function getLatestPostId(): Promise<number | null> {
  const db = getDb();
  const result = await db.execute(
    `SELECT id FROM posts WHERE published = 1
     ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1`
  );
  const id = result.rows[0]?.id;
  return id == null ? null : Number(id);
}

export async function createPost({
  title,
  content,
  thumbnail,
  published = false,
  tagIds = [],
}: {
  title: string;
  content: string;
  thumbnail?: string | null;
  published?: boolean;
  tagIds?: number[];
}): Promise<Post | null> {
  const db = getDb();
  const publishedAt = published ? new Date().toISOString() : null;
  const result = await db.execute({
    sql: `INSERT INTO posts (title, content, thumbnail, published, published_at) VALUES (?,?,?,?,?)`,
    args: [title, content, thumbnail ?? null, published ? 1 : 0, publishedAt],
  });
  const id = Number(result.lastInsertRowid);
  if (tagIds.length) await syncPostTags(id, tagIds);
  return getPostById(id, false);
}

function extractR2Urls(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const regex = /https:\/\/pic\.mikancel\.com\/[^\s)"']+/g;
  return [...new Set(markdown.match(regex) || [])];
}

export async function updatePost(
  id: number,
  {
    title,
    content,
    thumbnail,
    published,
    tagIds,
  }: {
    title?: string;
    content?: string;
    thumbnail?: string | null;
    published?: boolean;
    tagIds?: number[];
  }
): Promise<Post | null> {
  const db = getDb();
  const current = await getPostById(id, false);
  if (!current) throw new Error("Post not found");

  const newPublished = published !== undefined ? published : current.published;
  const publishedAt =
    newPublished && !current.published_at
      ? new Date().toISOString()
      : current.published_at;

  await db.execute({
    sql: `UPDATE posts SET title=?, content=?, thumbnail=?, published=?, published_at=? WHERE id=?`,
    args: [
      title ?? current.title,
      content ?? current.content,
      thumbnail !== undefined ? thumbnail : current.thumbnail,
      newPublished ? 1 : 0,
      publishedAt,
      id,
    ],
  });
  if (tagIds !== undefined) await syncPostTags(id, tagIds);

  // 使われていないタグを削除
  await db.execute(
    `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM post_tags)`
  );

  // 使われなくなった画像（本文から消えた画像＋差し替えられた古いサムネ）を
  // R2から削除（DB更新成功後に実行）。ディレクトリ構造には依存しない
  const finalContent = content !== undefined ? content : current.content;
  const finalThumb = thumbnail !== undefined ? thumbnail : current.thumbnail;
  const oldUrls = new Set(extractR2Urls(current.content));
  if (isR2Url(current.thumbnail)) oldUrls.add(current.thumbnail);
  const newUrls = new Set(extractR2Urls(finalContent));
  if (isR2Url(finalThumb)) newUrls.add(finalThumb);
  const removed = [...oldUrls].filter((u) => !newUrls.has(u));
  if (removed.length) await deleteManyFromR2(removed.map(r2UrlToKey));

  return getPostById(id, false);
}

export async function deletePost(id: number): Promise<void> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT content, thumbnail FROM posts WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) throw new Error("Post not found");
  const row = result.rows[0] as unknown as {
    content: string;
    thumbnail: string | null;
  };

  // 記事の本文＋サムネが参照するR2画像を全て削除（ディレクトリ構造に依存しない）
  const urls = new Set(extractR2Urls(row.content));
  if (isR2Url(row.thumbnail)) urls.add(row.thumbnail);
  const keys = [...urls].map(r2UrlToKey);
  if (keys.length) await deleteManyFromR2(keys);

  await db.batch(
    [
      { sql: "DELETE FROM posts WHERE id = ?", args: [id] },
      {
        sql: "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM post_tags)",
        args: [],
      },
    ],
    "write"
  );
}

async function syncPostTags(postId: number, tagIds: number[]): Promise<void> {
  const db = getDb();
  await db.batch(
    [
      { sql: "DELETE FROM post_tags WHERE post_id = ?", args: [postId] },
      ...tagIds.map((tid) => ({
        sql: "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)",
        args: [postId, tid],
      })),
    ],
    "write"
  );
}

// ---- Tags ----

export async function getAllTags(): Promise<Tag[]> {
  const db = getDb();
  const result = await db.execute("SELECT id, name, slug FROM tags ORDER BY name");
  return result.rows as unknown as Tag[];
}

export async function upsertTag(name: string): Promise<Tag> {
  const db = getDb();
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  await db.execute({
    sql: "INSERT OR IGNORE INTO tags (name, slug) VALUES (?,?)",
    args: [name, slug],
  });
  const result = await db.execute({
    sql: "SELECT id, name, slug FROM tags WHERE name = ?",
    args: [name],
  });
  return result.rows[0] as unknown as Tag;
}

// ---- WebAuthn ----

export async function saveChallenge(
  id: string,
  challenge: string,
  ttlSeconds = 300
): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.execute({
    sql: "INSERT OR REPLACE INTO webauthn_challenges (id, challenge, expires_at) VALUES (?,?,?)",
    args: [id, challenge, expiresAt],
  });
}

export async function getAndDeleteChallenge(id: string): Promise<string | null> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, challenge, expires_at FROM webauthn_challenges WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0] as unknown as
    | { id: string; challenge: string; expires_at: string }
    | undefined;
  if (!row) return null;
  await db.execute({ sql: "DELETE FROM webauthn_challenges WHERE id = ?", args: [id] });
  if (new Date(row.expires_at) < new Date()) return null;
  return row.challenge;
}

export async function saveCredential({
  id,
  credentialId,
  publicKey,
  counter,
}: {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
}): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO webauthn_credentials (id, credential_id, public_key, counter) VALUES (?,?,?,?)",
    args: [id, credentialId, publicKey, counter],
  });
}

export async function getCredentials(): Promise<WebAuthnCredentialRow[]> {
  const db = getDb();
  const result = await db.execute(
    "SELECT id, credential_id, public_key, counter FROM webauthn_credentials"
  );
  return result.rows as unknown as WebAuthnCredentialRow[];
}

export async function updateCredentialCounter(
  credentialId: string,
  counter: number
): Promise<void> {
  const db = getDb();
  await db.execute({
    sql: "UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?",
    args: [counter, credentialId],
  });
}

export async function hasCredentials(): Promise<boolean> {
  const db = getDb();
  const result = await db.execute(
    "SELECT COUNT(*) as cnt FROM webauthn_credentials"
  );
  return Number(result.rows[0].cnt) > 0;
}
