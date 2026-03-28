import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "db", "blog.sqlite");

let _db = null;
export function getDb() {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
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

export function getAllPosts(publishedOnly = true) {
  const db = getDb();
  const rows = db
    .prepare(
      `${POST_SELECT}
       ${publishedOnly ? "WHERE p.published = 1" : ""}
       GROUP BY p.id
       ORDER BY COALESCE(p.published_at, p.created_at) DESC`
    )
    .all();
  return rows.map(parsePostRow);
}

export function getPostById(id, publishedOnly = true) {
  const db = getDb();
  const row = db
    .prepare(
      `${POST_SELECT}
       WHERE p.id = ? ${publishedOnly ? "AND p.published = 1" : ""}
       GROUP BY p.id`
    )
    .get(id);
  return parsePostRow(row);
}

export function getLatestPostId() {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id FROM posts WHERE published = 1
       ORDER BY COALESCE(published_at, created_at) DESC LIMIT 1`
    )
    .get();
  return row?.id ?? null;
}

export function createPost({ title, content, thumbnail, published = false, tagIds = [] }) {
  const db = getDb();
  const publishedAt = published ? new Date().toISOString() : null;
  const result = db
    .prepare(`INSERT INTO posts (title, content, thumbnail, published, published_at) VALUES (?,?,?,?,?)`)
    .run(title, content, thumbnail ?? null, published ? 1 : 0, publishedAt);
  const id = result.lastInsertRowid;
  if (tagIds.length) syncPostTags(id, tagIds);
  return getPostById(id, false);
}

export function updatePost(id, { title, content, thumbnail, published, tagIds }) {
  const db = getDb();
  const current = getPostById(id, false);
  if (!current) throw new Error("Post not found");

  const newPublished = published !== undefined ? published : current.published;
  const publishedAt =
    newPublished && !current.published_at ? new Date().toISOString() : current.published_at;

  db.prepare(
    `UPDATE posts SET title=?, content=?, thumbnail=?, published=?, published_at=? WHERE id=?`
  ).run(
    title ?? current.title,
    content ?? current.content,
    thumbnail !== undefined ? thumbnail : current.thumbnail,
    newPublished ? 1 : 0,
    publishedAt,
    id
  );
  if (tagIds !== undefined) syncPostTags(id, tagIds);
  return getPostById(id, false);
}

export function deletePost(id) {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

function syncPostTags(postId, tagIds) {
  const db = getDb();
  db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(postId);
  const ins = db.prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?,?)");
  for (const tid of tagIds) ins.run(postId, tid);
}

// ---- Tags ----

export function getAllTags() {
  return getDb().prepare("SELECT * FROM tags ORDER BY name").all();
}

export function upsertTag(name) {
  const db = getDb();
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
  db.prepare("INSERT OR IGNORE INTO tags (name, slug) VALUES (?,?)").run(name, slug);
  return db.prepare("SELECT * FROM tags WHERE slug = ?").get(slug);
}

// ---- WebAuthn ----

export function saveChallenge(id, challenge, ttlSeconds = 300) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  db.prepare(
    "INSERT OR REPLACE INTO webauthn_challenges (id, challenge, expires_at) VALUES (?,?,?)"
  ).run(id, challenge, expiresAt);
}

export function getAndDeleteChallenge(id) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM webauthn_challenges WHERE id = ?").get(id);
  if (!row) return null;
  db.prepare("DELETE FROM webauthn_challenges WHERE id = ?").run(id);
  if (new Date(row.expires_at) < new Date()) return null;
  return row.challenge;
}

export function saveCredential({ id, credentialId, publicKey, counter }) {
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO webauthn_credentials (id, credential_id, public_key, counter) VALUES (?,?,?,?)"
    )
    .run(id, credentialId, publicKey, counter);
}

export function getCredentials() {
  return getDb().prepare("SELECT * FROM webauthn_credentials").all();
}

export function updateCredentialCounter(credentialId, counter) {
  getDb()
    .prepare("UPDATE webauthn_credentials SET counter = ? WHERE credential_id = ?")
    .run(counter, credentialId);
}

export function hasCredentials() {
  const row = getDb().prepare("SELECT COUNT(*) as cnt FROM webauthn_credentials").get();
  return row.cnt > 0;
}
