import { CODE_RE, bad, setMeta, syncEnabled } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!syncEnabled) return bad("Sync not configured", 501);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  if (!CODE_RE.test(code)) return bad("Invalid code");
  const minutes = Math.min(240, Math.max(5, Number(body?.minutes) || 30));
  await setMeta(code, { snoozeUntil: Date.now() + minutes * 60_000 });
  return Response.json({ ok: true });
}
