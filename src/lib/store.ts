"use client";

import { useSyncExternalStore } from "react";
import type { CheckIn, Doc, GuardDay, PostureTest, SessionLog, Settings, TestType } from "./types";
import { emptyDoc, mergeDocs, normalize } from "./merge";
import { dayKey } from "./schedule";
import { STATIC } from "./base";

const KEY = "upright:v1";
const META_KEY = "upright:meta";

/** Your "sitting tall" measurements for one screen. */
export interface GuardBase {
  w: number;
  cy: number;
  at: number;
  pitch?: number;
  roll?: number;
  yaw?: number;
  cx?: number;
}

export interface Meta {
  code?: string;
  lastReminderAt?: number;
  snoozeUntil?: number;
  pushOn?: boolean;
  welcomed?: boolean;
  lastSyncAt?: number;
  syncError?: string;
  deviceId?: string;
  /** Posture Guard calibration for this device's camera */
  guardBase?: GuardBase;
  /** optional calibration while looking at a second monitor */
  guardBase2?: GuardBase;
  guardSensitivity?: 1 | 2 | 3;
  guardDelaySec?: number;
}

export interface ServerConfig {
  sync: boolean;
  push: boolean;
  vapidPublicKey?: string;
}

const SERVER_DOC = emptyDoc();
const SERVER_META: Meta = {};

let doc: Doc | null = null;
let meta: Meta | null = null;
let config: ServerConfig | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function getDoc(): Doc {
  if (typeof window === "undefined") return SERVER_DOC;
  if (!doc) {
    doc = normalize(read<Doc>(KEY));
    if (!doc.settings.updatedAt) {
      // first run: capture this device's timezone
      doc.settings.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
  }
  return doc;
}

export function getMeta(): Meta {
  if (typeof window === "undefined") return SERVER_META;
  if (!meta) meta = read<Meta>(META_KEY) ?? {};
  return meta;
}

export function useDoc(): Doc {
  return useSyncExternalStore(subscribe, getDoc, () => SERVER_DOC);
}

export function useMeta(): Meta {
  return useSyncExternalStore(subscribe, getMeta, () => SERVER_META);
}

export function useConfig(): ServerConfig | null {
  return useSyncExternalStore(
    subscribe,
    () => config,
    () => null,
  );
}

function setDoc(next: Doc, opts: { sync?: boolean } = {}) {
  doc = next;
  write(KEY, next);
  emit();
  if (opts.sync !== false) scheduleSync();
}

export function setMeta(patch: Partial<Meta>) {
  meta = { ...getMeta(), ...patch };
  write(META_KEY, meta);
  emit();
}

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

/* ---------------- actions ---------------- */

export function logSession(routineId: string, startedAt: number, durationSec: number, completed: boolean): SessionLog {
  const d = getDoc();
  const s: SessionLog = {
    id: uid(),
    routineId,
    startedAt,
    day: dayKey(startedAt, d.settings.tz),
    durationSec: Math.round(durationSec),
    completed,
  };
  setDoc({ ...d, sessions: [...d.sessions, s] });
  setMeta({ snoozeUntil: undefined });
  return s;
}

export function addCheckin(stiffness: number) {
  const d = getDoc();
  const now = Date.now();
  const c: CheckIn = { id: uid(), at: now, day: dayKey(now, d.settings.tz), stiffness };
  setDoc({ ...d, checkins: [...d.checkins, c] });
}

export function addTest(type: TestType, value: number): PostureTest {
  const d = getDoc();
  const now = Date.now();
  const t: PostureTest = { id: uid(), at: now, day: dayKey(now, d.settings.tz), type, value };
  setDoc({ ...d, tests: [...d.tests, t] });
  return t;
}

export function deviceId(): string {
  let id = getMeta().deviceId;
  if (!id) {
    id = uid().slice(0, 8);
    setMeta({ deviceId: id });
  }
  return id;
}

/** Add Posture Guard time to today's record for this device. */
export function addGuardTime(goodSec: number, totalSec: number, nudges: number) {
  if (totalSec <= 0 && nudges <= 0) return;
  const d = getDoc();
  const day = dayKey(Date.now(), d.settings.tz);
  const id = `${day}:${deviceId()}`;
  const cur = d.guard.find((g) => g.id === id);
  const next: GuardDay = {
    id,
    day,
    goodSec: Math.round((cur?.goodSec ?? 0) + goodSec),
    totalSec: Math.round((cur?.totalSec ?? 0) + totalSec),
    nudges: (cur?.nudges ?? 0) + nudges,
    updatedAt: Date.now(),
  };
  setDoc({ ...d, guard: [...d.guard.filter((g) => g.id !== id), next] });
}

export function updateSettings(patch: Partial<Settings>) {
  const d = getDoc();
  setDoc({ ...d, settings: { ...d.settings, ...patch, updatedAt: Date.now() } });
}

export function lastSessionEnd(d: Doc): number | undefined {
  const s = d.sessions[d.sessions.length - 1];
  return s ? s.startedAt + s.durationSec * 1000 : undefined;
}

export async function snooze(minutes: number) {
  const until = Date.now() + minutes * 60_000;
  setMeta({ snoozeUntil: until });
  const m = getMeta();
  if (config?.sync && m.code) {
    try {
      await fetch("/api/snooze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: m.code, minutes }),
      });
    } catch {}
  }
}

export function resetLocal() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(META_KEY);
  } catch {}
  doc = null;
  meta = null;
  emit();
}

/* ---------------- sync ---------------- */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function prettyCode(code?: string) {
  return code ? code.match(/.{1,4}/g)!.join("-") : "";
}

export function cleanCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z2-9]{16}$/.test(c) ? c : null;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;

function scheduleSync(delay = 1200) {
  if (!config?.sync) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  if (!config?.sync || syncing) return;
  const m = getMeta();
  let code = m.code;
  if (!code) {
    code = newCode();
    setMeta({ code });
  }
  syncing = true;
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, doc: getDoc() }),
    });
    if (!res.ok) throw new Error(`Sync failed (${res.status})`);
    const { doc: remote } = (await res.json()) as { doc: Doc };
    const merged = mergeDocs(getDoc(), remote);
    if (JSON.stringify(merged) !== JSON.stringify(getDoc())) setDoc(merged, { sync: false });
    setMeta({ lastSyncAt: Date.now(), syncError: undefined });
  } catch (e) {
    setMeta({ syncError: e instanceof Error ? e.message : "Sync failed" });
  } finally {
    syncing = false;
  }
}

export async function linkDevice(code: string) {
  setMeta({ code });
  await syncNow();
}

export async function initStore() {
  getDoc();
  getMeta();
  try {
    if (STATIC) throw new Error("no server in the static build");
    const res = await fetch("/api/config", { cache: "no-store" });
    config = res.ok ? ((await res.json()) as ServerConfig) : { sync: false, push: false };
  } catch {
    config = { sync: false, push: false };
  }
  emit();
  if (config.sync) {
    await syncNow();
    // Re-sync when coming back to the app (e.g. after training on another device)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncNow();
    });
  }
}
