import { CODE_RE, bad, pushEnabled, removeSub } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!pushEnabled) return bad("Push not configured", 501);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  if (!CODE_RE.test(code) || typeof body?.endpoint !== "string") return bad("Invalid request");
  await removeSub(code, body.endpoint);
  return Response.json({ ok: true });
}
