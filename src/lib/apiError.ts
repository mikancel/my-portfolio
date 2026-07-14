// 内部エラーの詳細（DB接続情報やSQL文が混ざりうる）をクライアントに返さない。
// 詳細はサーバーログにだけ残し、レスポンスは固定文言にする。
export function serverError(context: string, e: unknown): Response {
  console.error(`[${context}]`, e);
  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
