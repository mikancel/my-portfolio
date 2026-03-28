import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getCredentials, getAndDeleteChallenge, updateCredentialCounter } from "@/lib/db";
import { getSession } from "@/lib/session";

const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "https://admin.mikancel.com";

export async function POST(req) {
  try {
    const body = await req.json();
    const { challengeId, ...credential } = body;

    const expectedChallenge = getAndDeleteChallenge(challengeId);
    if (!expectedChallenge) {
      return Response.json({ error: "Challenge expired" }, { status: 400 });
    }

    const credentials = getCredentials();
    const storedCred = credentials.find(
      (c) => c.credential_id === credential.id
    );
    if (!storedCred) {
      return Response.json({ error: "Credential not found" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(storedCred.credential_id, "base64url"),
        credentialPublicKey: Buffer.from(storedCred.public_key, "base64url"),
        counter: storedCred.counter,
      },
    });

    if (!verification.verified) {
      return Response.json({ error: "Verification failed" }, { status: 401 });
    }

    updateCredentialCounter(storedCred.credential_id, verification.authenticationInfo.newCounter);

    const session = await getSession(req, new Response());
    session.isLoggedIn = true;
    await session.save();

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
