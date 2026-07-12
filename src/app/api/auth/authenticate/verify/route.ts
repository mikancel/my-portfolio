import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getCredentials, getAndDeleteChallenge, updateCredentialCounter } from "@/lib/db";
import { getSession } from "@/lib/session";

const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "https://admin.mikancel.com";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { challengeId: string } & Record<string, unknown>;
    const { challengeId, ...credential } = body;

    const expectedChallenge = await getAndDeleteChallenge(challengeId);
    if (!expectedChallenge) {
      return Response.json({ error: "Challenge expired" }, { status: 400 });
    }

    const credentials = await getCredentials();
    const storedCred = credentials.find((c) => c.credential_id === credential.id);
    if (!storedCred) {
      return Response.json({ error: "Credential not found" }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential as unknown as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCred.credential_id,
        publicKey: new Uint8Array(Buffer.from(storedCred.public_key, "base64url")),
        counter: storedCred.counter,
      },
    });

    if (!verification.verified) {
      return Response.json({ error: "Verification failed" }, { status: 401 });
    }

    await updateCredentialCounter(storedCred.credential_id, verification.authenticationInfo.newCounter);

    const session = await getSession();
    session.isLoggedIn = true;
    await session.save();

    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}