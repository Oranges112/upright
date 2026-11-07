import { CODE_RE, addSub, bad, pushEnabled } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!pushEnabled) return bad("Push not configured", 501);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  const sub = body?.subscription;
  if (!CODE_RE.test(code)) return bad("Invalid code");
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return bad("Invalid subscription");
  if (!/^https:\/\//.test(sub.endpoint)) return bad("Invalid endpoint");
  await addSub(code, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return Response.json({ ok: true });
}
