import { generateRegistrationOptions } from "@simplewebauthn/server";
import { saveChallenge } from "@/lib/db";
import crypto from "crypto";

const RP_NAME = "mikancel admin";
const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";

export async function POST(req) {
  try {
    const { token } = await req.json();

    if (!token || token !== process.env.REGISTRATION_TOKEN) {
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
    return Response.json({ error: e.message }, { status: 500 });
  }
}