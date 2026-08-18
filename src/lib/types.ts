// ドメイン型定義

export type Tag = {
  id: number;
  name: string;
  slug: string;
};

/** 公開記事での使用件数を伴うタグ（一覧の絞り込みUI用） */
export type TagWithCount = Tag & { count: number };

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

