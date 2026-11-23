/**
 * The app can be built two ways:
 *  - normal (Vercel): served from "/", with server routes for sync + push reminders
 *  - static (GitHub Pages): plain files under "/upright", no server; everything stays on the device
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

/** Prefix an absolute app path ("/icons/192.png") with the base path. */
export const asset = (path: string) => `${BASE}${path}`;

/**
 * Where the sync / reminder server lives. Empty = this same site (the Vercel build).
 * The GitHub Pages copy (and the desktop app, which loads it) can point at a Vercel copy
 * with NEXT_PUBLIC_API_URL, so phone and computer sync wherever you opened Upright.
 */
export const API = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
/** Full address of a server route, e.g. api("/api/sync"). */
export const api = (path: string) => `${API}${path}`;
/** Is there a server to sync with? */
export const HAS_SERVER = !STATIC || API !== "";
