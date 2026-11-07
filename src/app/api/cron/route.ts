import { bad, envClean, redis, getMeta, listUsers, loadDoc, pushEnabled, pushToUser, setMeta } from "@/lib/server";
import { isReminderDue } from "@/lib/schedule";
import { fmtDuration, getRoutine, routineSeconds } from "@/lib/exercises";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MESSAGES = [
  ["Time for a neck break 🧘", "Chin tucks are calling. {r} · {d}."],
  ["Heads up! Literally. 🙆", "Roll those shoulders back. {r} · {d}."],
  ["Your neck called 📞", "It'd love {d} of attention. Tap to start {r}."],
  ["Posture check ✨", "Sit tall, ears over shoulders. {r} · {d}."],
  ["Screen break 🌿", "Look up, breathe, reset. {r} · {d}."],
  ["Streak alert 🔥", "Keep it alive with a quick {r} ({d})."],
];

/**
 * Called every ~5 minutes by an external scheduler (cron-job.org, Upstash QStash, GitHub Actions…).
 * Auth: `Authorization: Bearer <CRON_SECRET>` header or `?key=<CRON_SECRET>`.
 */
async function handle(req: Request) {
  const secret = envClean(process.env.CRON_SECRET);
  if (!secret) return bad("CRON_SECRET not set", 500);
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}` && url.searchParams.get("key") !== secret) return bad("Unauthorized", 401);
  if (!pushEnabled) return bad("Push not configured", 501);

  const now = Date.now();
  await redis!.set("lastTickAt", now);
  const users = await listUsers();
  let sent = 0;
  for (const code of users) {
    try {
      const doc = await loadDoc(code);
      if (!doc) continue;
      const meta = await getMeta(code);
      const last = doc.sessions[doc.sessions.length - 1];
      const lastSessionAt = last ? last.startedAt + last.durationSec * 1000 : undefined;
      if (!isReminderDue(doc.settings, { lastSessionAt, lastReminderAt: meta.lastReminderAt, snoozeUntil: meta.snoozeUntil }, now)) continue;

      const r = getRoutine(doc.settings.defaultRoutine);
      const [title, body] = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const n = await pushToUser(code, {
        title,
        body: body.replace("{r}", r.name).replace("{d}", fmtDuration(routineSeconds(r, doc.settings.level))),
        url: "/?start=default",
        tag: "upright-reminder",
      });
      await setMeta(code, { lastReminderAt: now, snoozeUntil: undefined });
      sent += n;
    } catch (e) {
      console.error("cron user failed", code, e);
    }
  }
  return Response.json({ ok: true, users: users.length, sent });
}

export const GET = handle;
export const POST = handle;
