import { getSession } from "@/lib/session";

export async function GET(req) {
  const session = await getSession(req, new Response());
  return Response.json({ isLoggedIn: !!session.isLoggedIn });
}

export async function DELETE(req) {
  const session = await getSession(req, new Response());
  session.destroy();
  return Response.json({ ok: true });
}
