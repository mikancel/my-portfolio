import LoginClient from "./LoginClient";

// エラー種別はサーバー側で受け取る（useSearchParamsを使うとSuspense必須になるため）
export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "セッションの検証に失敗しました。もう一度お試しください。",
  exchange_failed:
    "Googleとの通信に失敗しました。時間をおいて再度お試しください。",
  unverified: "このGoogleアカウントはメールアドレスが未確認です。",
  forbidden: "このアカウントには管理権限がありません。",
  cancelled: "ログインがキャンセルされました。",
  rate_limited: "試行回数が多すぎます。しばらく待ってから再度お試しください。",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? (ERROR_MESSAGES[error] ?? "ログインに失敗しました。")
    : "";
  return <LoginClient message={message} />;
}
