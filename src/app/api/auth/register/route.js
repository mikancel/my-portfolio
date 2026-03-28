import { generateRegistrationOptions } from "@simplewebauthn/server";
import { saveChallenge, hasCredentials } from "@/lib/db";
import crypto from "crypto";

const RP_NAME = "mikancel admin";
const RP_ID = process.env.WEBAUTHN_RP_ID || "admin.mikancel.com";

export async function POST() {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_REGISTRATION !== "1") {
      if (hasCredentials()) {
        return Response.json({ error: "Registration is closed" }, { status: 403 });
      }
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

    saveChallenge(challengeId, options.challenge);

    return Response.json({ ...options, challengeId });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}