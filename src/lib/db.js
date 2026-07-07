import { createClient } from "@libsql/client";
import { deleteFolderFromR2, deleteFromR2 } from "@/lib/r2";

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:./db/blog.sqlite",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _db;
}

// ---- Posts ----

// 記事配列にタグを付与する（区切り文字に依存しない安全な方式）
async function attachTags(rows) {
  const posts = rows.map((r) => ({ ...r, published: !!r.published, tags: [] }));
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
  for (const row of result.rows) {
    byPost.get(row.post_id)?.push({ id: row.id, name: row.name, slug: row.slug });
  }
  return posts;
}

export async function getAllPosts(
  publishedOnly = true,
  { limit = 20, offset = 0, tagIds = [] } = {}
) {
  const db = getDb();
  const where = [];
  const args = [];

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
  return attachTags(result.rows);
}

// 公開記事の一覧メタデータ（本文contentを含まない軽量版）を全件返す。
// /blog ページはこれをキャッシュ済みHTMLに埋め込み、タグ絞り込みは
// クライアント側で行うため、タグクリックごとのDBアクセスが発生しない。
export async function getPublishedPostsMeta() {
  const db = getDb();
  const result = await db.execute(
    `SELECT p.id, p.title, p.thumbnail, p.published,
            p.published_at, p.created_at, p.updated_at
     FROM posts p
     WHERE p.published = 1
     ORDER BY COALESCE(p.published_at, p.created_at) DESC`
  );
  return attachTags(result.rows);
}

export async function getPostById(id, publishedOnly = true) {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT p.* FROM posts p
          WHERE p.id = ? ${publishedOnly ? "AND p.published = 1" : ""}`,
    args: [id],
  });
  if (!result.rows.length) return null;
  const [post] = await attachTags(result.rows);
  return post;
}

export async function getLatestPostId() {
  const db = getDb();
  const result = await db.execute(
    `SELECT id FROM posts WHERE published = 1
     ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1`
  );
  return result.rows[0]?.id ?? null;
}

export async function createPost({ title, content, thumbnail, published = false, tagIds = [] }) {
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

function extractR2Urls(markdown) {
  if (!markdown) return [];
  const regex = /https:\/\/pic\.mikancel\.com\/[^\s)"']+/g;
  return [...new Set(markdown.match(regex) || [])];
}

export async function updatePost(id, { title, content, thumbnail, published, tagIds }) {
  const db = getDb();
  const current = await getPostById(id, false);
  if (!current) throw new Error("Post not found");

  const newPublished = published !== undefined ? published : current.published;
  const publishedAt =
    newPublished && !current.published_at ? new Date().toISOString() : current.published_at;

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

  // 本文から消えた画像をR2から削除（DB更新成功後に実行）
  if (content !== undefined) {
    const oldUrls = extractR2Urls(current.content);
    const newUrls = extractR2Urls(content);
    const deleted = oldUrls.filter((url) => !newUrls.includes(url));
    await Promise.all(
      deleted.map((url) => deleteFromR2(url.replace("https://pic.mikancel.com/", "")))
    );
  }

  return getPostById(id, false);
}

export async function deletePost(id) {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id FROM posts WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) throw new Error("Post not found");

  await deleteFolderFromR2(`blog/${id}/`);
  await db.batch(
    [
      { sql: "DELETE FROM posts WHERE id = ?", args: [id] },
      { sql: "DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM post_tags)", args: [] },
    ],
    "write"
  );
}

async function syncPostTags(postId, tagIds) {
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

export async function getAllTags() {
  const db = getDb();
  const result = await db.execute("SELECT id, name, slug FROM tags ORDER BY name");
  return result.rows;
}

export async function upsertTag(name) {
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
  return result.rows[0];
}

// ---- WebAuthn ----

export async function saveChallenge(id, challenge, ttlSeconds = 300) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.execute({
    sql: "INSERT OR REPLACE INTO webauthn_challenges (id, challenge, expires_at) VALUES (?,?,?)",
    args: [id, challenge, expiresAt],
  });
}

export async function getAndDeleteChallenge(id) {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, challenge, expires_at FROM webauthn_challenges WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  await db.execute({ sql: "DELETE FROM webauthn_challenges WHERE id = ?", args: [id] });
  if (new Date(row.expires_at) < new Date()) return null;
  return row.challenge;
}

export async function saveCredential({ id, credentialId, publicKey, counter }) {
  const db = getDb();
  await db.execute({
    sql: "INSERT OR REPLACE INTO webauthn_credentials (id, credential_id, public_key, counter) VALUES (?,?,?,?)",
    args: [id, credentialId, publicKey, counter],
  });
}

export async function getCredentials() {
  const db = getDb();
  const result = await db.execute("SELECT id, credential_id, public_key, counter FROM webauthn_credentials");
  return result.rows;
}

export async function updateCredentialCounter(credentialId, counter) {
  const db = getDb();
  await db.execute({
    sql: "UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?",
    args: [counter, credentialId],
  });
}

export async function hasCredentials() {
  const db = getDb();
  const result = await db.execute("SELECT COUNT(*) as cnt FROM webauthn_credentials");
  return result.rows[0].cnt > 0;
}
