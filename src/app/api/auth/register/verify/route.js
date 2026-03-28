import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getAndDeleteChallenge, saveCredential } from "@/lib/db";
import { getSession } from "@/lib/session";
import crypto from "crypto";

const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "https://admin.mikancel.com";

export async function POST(req) {
  try {
    const body = await req.json();
    const { challengeId, ...credential } = body;

    const expectedChallenge = getAndDeleteChallenge(challengeId);
    if (!expectedChallenge) {
      return Response.json({ error: "Challenge expired or invalid" }, { status: 400 });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return Response.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential: cred } = verification.registrationInfo;

    saveCredential({
      id: crypto.randomUUID(),
      credentialId: cred.id,
      publicKey: Buffer.from(cred.publicKey).toString("base64url"),
      counter: cred.counter,
    });

    const session = await getSession();
    session.isLoggedIn = true;
    await session.save();

    return Response.json({ ok: true });
  } catch (e) {
    console.error("register/verify error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}