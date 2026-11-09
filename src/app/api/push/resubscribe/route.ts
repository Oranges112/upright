import { addSub, bad, listUsers, pushEnabled, redis, removeSub } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Called by the service worker when the browser silently replaces a push subscription
 * (phones do this now and then). Swaps the old endpoint for the new one so reminders keep arriving.
 */
export async function POST(req: Request) {
  if (!pushEnabled || !redis) return bad("Push not configured", 501);
  const body = await req.json().catch(() => null);
  const oldEndpoint = String(body?.oldEndpoint ?? "");
  const sub = body?.subscription;
  if (!/^https:\/\//.test(oldEndpoint)) return bad("Invalid old endpoint");
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !/^https:\/\//.test(sub.endpoint)) return bad("Invalid subscription");
  for (const code of await listUsers()) {
    if (await redis.hexists(`u:${code}:subs`, oldEndpoint)) {
      await removeSub(code, oldEndpoint);
      await addSub(code, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
      return Response.json({ ok: true });
    }
  }
  return bad("Unknown subscription", 404);
}
