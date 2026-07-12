import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return Response.json({ isLoggedIn: !!session.isLoggedIn });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return Response.json({ ok: true });
}
