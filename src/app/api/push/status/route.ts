import { CODE_RE, bad, getMeta, pushEnabled, redis } from "@/lib/server";

export const dynamic = "force-dynamic";

/** For the notification health check: does the server know this device, and when did it last send? */
export async function POST(req: Request) {
  if (!pushEnabled || !redis) return bad("Push not configured", 501);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  const endpoint = String(body?.endpoint ?? "");
  if (!CODE_RE.test(code)) return bad("Invalid code");
  const subs = (await redis.hkeys(`u:${code}:subs`)) as string[];
  const meta = await getMeta(code);
  return Response.json({
    known: endpoint ? subs.includes(endpoint) : false,
    devices: subs.length,
    lastReminderAt: meta.lastReminderAt ?? null,
  });
}
