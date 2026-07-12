// ドメイン型定義

export type Tag = {
  id: number;
  name: string;
  slug: string;
};

export type Post = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
};

// 一覧用（本文なし）
export type PostMeta = Omit<Post, "content">;

export type WebAuthnCredentialRow = {
  id: string;
  credential_id: string;
  public_key: string;
  counter: number;
};
