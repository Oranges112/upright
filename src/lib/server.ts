import { Redis } from "@upstash/redis";
import * as webpush from "web-push";
import type { PushSubscription } from "web-push";
import type { Doc } from "./types";
import { mergeDocs, normalize } from "./merge";

/* ---------------- storage ---------------- */

const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)?.trim();
const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)?.trim();

export const syncEnabled = Boolean(url && token);
export const redis = syncEnabled ? new Redis({ url: url!, token: token! }) : null;

/** Env values pasted/piped in can carry stray BOMs, quotes or whitespace. */
export function envClean(v: string | undefined): string | undefined {
  const s = v?.replace(/^﻿/, "").trim().replace(/^["']|["']$/g, "");
  return s ? s : undefined;
}

const VAPID_PUBLIC = envClean(process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const VAPID_PRIVATE = envClean(process.env.VAPID_PRIVATE_KEY);
let vapidOk = false;
if (syncEnabled && VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(envClean(process.env.VAPID_SUBJECT) || "mailto:upright@example.com", VAPID_PUBLIC, VAPID_PRIVATE);
    vapidOk = true;
  } catch (e) {
    console.error("Invalid VAPID configuration", e);
  }
}
export const pushEnabled = vapidOk;
export const vapidPublicKey = VAPID_PUBLIC;

export const CODE_RE = /^[A-Z2-9]{16}$/;

const k = {
  doc: (c: string) => `u:${c}:doc`,
  subs: (c: string) => `u:${c}:subs`,
  meta: (c: string) => `u:${c}:meta`,
  users: "users",
};

export interface ServerMeta {
  lastReminderAt?: number;
  snoozeUntil?: number;
}

export async function loadDoc(code: string): Promise<Doc | null> {
  const raw = await redis!.get<Doc | string>(k.doc(code));
  if (!raw) return null;
  return normalize(typeof raw === "string" ? JSON.parse(raw) : raw);
}

export async function saveMerged(code: string, incoming: Doc): Promise<Doc> {
  const current = await loadDoc(code);
  const merged = mergeDocs(current, normalize(incoming));
  await redis!.set(k.doc(code), JSON.stringify(merged));
  await redis!.sadd(k.users, code);
  return merged;
}

export async function getMeta(code: string): Promise<ServerMeta> {
  const m = await redis!.get<ServerMeta | string>(k.meta(code));
  if (!m) return {};
  return typeof m === "string" ? JSON.parse(m) : m;
}

export async function setMeta(code: string, patch: ServerMeta) {
  const m = { ...(await getMeta(code)), ...patch };
  await redis!.set(k.meta(code), JSON.stringify(m));
}

export async function addSub(code: string, sub: PushSubscription) {
  await redis!.hset(k.subs(code), { [sub.endpoint]: JSON.stringify(sub) });
  await redis!.sadd(k.users, code);
}

export async function removeSub(code: string, endpoint: string) {
  await redis!.hdel(k.subs(code), endpoint);
}

export async function listUsers(): Promise<string[]> {
  return (await redis!.smembers(k.users)) as string[];
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Send to every device subscribed under this code. Dead subscriptions are cleaned up. */
export async function pushToUser(code: string, payload: PushPayload): Promise<number> {
  const subs = (await redis!.hgetall<Record<string, PushSubscription | string>>(k.subs(code))) ?? {};
  let sent = 0;
  await Promise.all(
    Object.entries(subs).map(async ([endpoint, raw]) => {
      const sub: PushSubscription = typeof raw === "string" ? JSON.parse(raw) : raw;
      try {
        await webpush.sendNotification(sub, JSON.stringify({ ...payload, code }), { TTL: 60 * 30, urgency: "normal" });
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await removeSub(code, endpoint);
      }
    }),
  );
  return sent;
}

export function bad(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}
