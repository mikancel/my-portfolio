import { getSession } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";
import { serverError } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// 6桁＝100万通りしかないので、試行回数の制限が実質的な防御線になる
const LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 };

export async function POST(req: Request) {
  try {
    const session = await getSession();
    // Google認証を通っていない相手には、そもそもコードを試させない
    if (!session.pendingMfa || !session.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ok, retryAfter } = rateLimit(`mfa:${clientIp(req)}`, LIMIT);
    if (!ok) {
      return Response.json(
        { error: "試行回数が多すぎます。しばらく待ってください。" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const secret = process.env.ADMIN_TOTP_SECRET;
    if (!secret) {
      // 未設定なら通す、にすると2要素目が事実上無効になるので閉じる側に倒す
      console.error("[POST /api/auth/mfa] ADMIN_TOTP_SECRET is not set");
      return Response.json(
        { error: "サーバー側の設定が不足しています。" },
        { status: 500 }
      );
    }

    const { code } = (await req.json()) as { code?: string };
    const step = verifyTotp((code ?? "").trim(), secret);
    if (step === null) {
      return Response.json({ error: "コードが正しくありません。" }, { status: 401 });
    }

    // 同じコードの再利用を拒否する（盗み見られた1回分を使い回せないように）
    if (session.lastTotpStep !== undefined && step <= session.lastTotpStep) {
      return Response.json(
        { error: "このコードは使用済みです。次のコードを入力してください。" },
        { status: 401 }
      );
    }

    session.isLoggedIn = true;
    session.pendingMfa = false;
    session.lastTotpStep = step;
    await session.save();

    return Response.json({ ok: true });
  } catch (e) {
    return serverError("POST /api/auth/mfa", e);
  }
}
