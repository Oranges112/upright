// Removes empty sync records: codes that were created (e.g. by opening the app once, or by tests)
// but never logged a session, check-in, test or Guard time, and have no device signed up for reminders.
//
//   node scripts/cleanup-empty-users.mjs          -> dry run: only lists what it would remove
//   node scripts/cleanup-empty-users.mjs --yes    -> actually removes them
//
// Needs KV_REST_API_URL and KV_REST_API_TOKEN (read from .env.local if present).
import fs from "node:fs";
import { Redis } from "@upstash/redis";

const env = { ...process.env };
try {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0 && !env[line.slice(0, i).trim()]) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
} catch {}
const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token) {
  console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN");
  process.exit(1);
}
const redis = new Redis({ url, token });
const apply = process.argv.includes("--yes");

const users = await redis.smembers("users");
let empty = 0;
let kept = 0;
for (const code of users) {
  const [doc, devices] = await Promise.all([redis.get(`u:${code}:doc`), redis.hlen(`u:${code}:subs`)]);
  const used = doc && (doc.sessions?.length || doc.checkins?.length || doc.tests?.length || doc.guard?.length);
  if (used || devices > 0) {
    kept++;
    continue;
  }
  empty++;
  if (apply) {
    await redis.del(`u:${code}:doc`, `u:${code}:subs`, `u:${code}:meta`);
    await redis.srem("users", code);
  }
}
console.log(`${users.length} records: ${kept} in use (kept), ${empty} empty ${apply ? "(removed)" : "(would be removed; run with --yes)"}`);
