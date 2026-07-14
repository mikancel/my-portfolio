import { generateRegistrationOptions } from "@simplewebauthn/server";
import { saveChallenge } from "@/lib/db";
import { serverError } from "@/lib/apiError";
import { rateLimit, clientIp, timingSafeEqual } from "@/lib/rateLimit";
import crypto from "crypto";

const RP_NAME = "mikancel admin";
const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";

export async function POST(req: Request) {
  try {
    // パスキー登録はこのトークンだけが関門なので、総当たりを防ぐ
    const { ok, retryAfter } = rateLimit(`register:${clientIp(req)}`, {
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ok) {
      return Response.json(
        { error: "Too many attempts" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const { token } = (await req.json()) as { token?: string };
    const expected = process.env.REGISTRATION_TOKEN;

    if (!expected) {
      console.error("[POST /api/auth/register] REGISTRATION_TOKEN is not set");
      return Response.json({ error: "Registration disabled" }, { status: 403 });
    }
    if (!token || !timingSafeEqual(token, expected)) {
      return Response.json({ error: "Invalid token" }, { status: 403 });
    }

    const challengeId = crypto.randomUUID();

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: "admin",
      userDisplayName: "mikancel Admin",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    await saveChallenge(challengeId, options.challenge);
    return Response.json({ ...options, challengeId });
  } catch (e) {
    return serverError("POST /api/auth/register", e);
  }
}