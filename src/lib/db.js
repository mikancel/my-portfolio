import { createClient } from "@libsql/client";

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

function parsePostRow(row) {
  if (!row) return null;
  const tags = row.tag_data
    ? row.tag_data.split("||").map((s) => {
        const [id, name, slug] = s.split("::");
        return { id: Number(id), name, slug };
      })
    : [];
  return { ...row, published: !!row.published, tags };
}

const POST_SELECT = `
  SELECT p.*,
    GROUP_CONCAT(t.id || '::' || t.name || '::' || t.slug, '||') AS tag_data
  FROM posts p
  LEFT JOIN post_tags pt ON pt.post_id = p.id
  LEFT JOIN tags t ON t.id = pt.tag_id
`;

export async function getAllPosts(publishedOnly = true) {
  const db = getDb();
  const result = await db.execute(
    `${POST_SELECT}
     ${publishedOnly ? "WHERE p.published = 1" : ""}
     GROUP BY p.id
     ORDER BY COALESCE(p.published_at, p.created_at) DESC`
  );
  return result.rows.map(parsePostRow);
}

export async function getPostById(id, publishedOnly = true) {
  const db = getDb();
  const result = await db.execute({
    sql: `${POST_SELECT}
     WHERE p.id = ? ${publishedOnly ? "AND p.published = 1" : ""}
     GROUP BY p.id`,
    args: [id],
  });
  return parsePostRow(result.rows[0] || null);
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
  const id = result.lastInsertRowid;
  if (tagIds.length) await syncPostTags(id, tagIds);
  return getPostById(id, false);
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
  return getPostById(id, false);
}

export async function deletePost(id) {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM posts WHERE id = ?", args: [id] });
  // 使われていないタグを削除
  await db.execute({
    sql: `DELETE FROM tags WHERE id NOT IN (SELECT DISTINCT tag_id FROM post_tags)`,
    args: [],
  });
}

async function syncPostTags(postId, tagIds) {
  const db = getDb();
  await db.execute({ sql: "DELETE FROM post_tags WHERE post_id = ?", args: [postId] });
  for (const tid of tagIds) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)",
      args: [postId, tid],
    });
  }
}

// ---- Tags ----

export async function getAllTags() {
  const db = getDb();
  const result = await db.execute("SELECT * FROM tags ORDER BY name");
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
    sql: "SELECT * FROM tags WHERE name = ?",
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
    sql: "SELECT * FROM webauthn_challenges WHERE id = ?",
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
  const result = await db.execute("SELECT * FROM webauthn_credentials");
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