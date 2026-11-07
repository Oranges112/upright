import { bad, envClean } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * One-time helper: creates (or replaces) an Upstash QStash schedule that calls
 * /api/cron every 5 minutes. Secrets stay server-side.
 * Call with: POST /api/setup-schedule  (Authorization: Bearer <CRON_SECRET>)
 */
export async function POST(req: Request) {
  const secret = envClean(process.env.CRON_SECRET);
  if (!secret) return bad("CRON_SECRET not set", 500);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return bad("Unauthorized", 401);

  const token = envClean(process.env.QSTASH_TOKEN);
  if (!token) return bad("QSTASH_TOKEN not set. Add Upstash QStash to the project first.", 501);
  const base = (envClean(process.env.QSTASH_URL) || "https://qstash.upstash.io").replace(/\/$/, "");

  const origin = new URL(req.url).origin;
  const destination = `${origin}/api/cron`;
  const auth = { Authorization: `Bearer ${token}` };

  // Remove any older schedules pointing at our cron endpoint, so we never double-send.
  const existing = await fetch(`${base}/v2/schedules`, { headers: auth });
  if (existing.ok) {
    const list = (await existing.json()) as { scheduleId: string; destination: string }[];
    for (const s of list.filter((s) => s.destination === destination)) {
      await fetch(`${base}/v2/schedules/${s.scheduleId}`, { method: "DELETE", headers: auth });
    }
  }

  const res = await fetch(`${base}/v2/schedules/${destination}`, {
    method: "POST",
    headers: {
      ...auth,
      "Upstash-Cron": "*/5 * * * *",
      "Upstash-Method": "POST",
      "Upstash-Retries": "0",
      "Upstash-Forward-Authorization": `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const text = await res.text();
  return Response.json({ ok: res.ok, status: res.status, destination, qstash: text.slice(0, 300) }, { status: res.ok ? 200 : 502 });
}
