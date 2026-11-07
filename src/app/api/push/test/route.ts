import { CODE_RE, bad, pushEnabled, pushToUser } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!pushEnabled) return bad("Push not configured", 501);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  if (!CODE_RE.test(code)) return bad("Invalid code");
  const sent = await pushToUser(code, {
    title: "Upright is working 🎉",
    body: "This is what your neck-break reminders will look like.",
    url: "/",
    tag: "upright-test",
  });
  return Response.json({ ok: sent > 0, sent }, { status: sent > 0 ? 200 : 404 });
}
