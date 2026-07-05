import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getCredentials, saveChallenge } from "@/lib/db";
import crypto from "crypto";

const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";

export async function POST() {
  try {
    const credentials = await getCredentials();
    if (!credentials.length) {
      return Response.json({ error: "No credentials registered" }, { status: 400 });
    }

    const challengeId = crypto.randomUUID();
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credentials.map((c) => ({
        id: c.credential_id,
      })),
      userVerification: "preferred",
    });

    await saveChallenge(challengeId, options.challenge);
    return Response.json({ ...options, challengeId });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}