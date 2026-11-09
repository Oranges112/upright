/**
 * The app can be built two ways:
 *  - normal (Vercel): served from "/", with server routes for sync + push reminders
 *  - static (GitHub Pages): plain files under "/upright", no server; everything stays on the device
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const STATIC = process.env.NEXT_PUBLIC_STATIC === "1";

/** Prefix an absolute app path ("/icons/192.png") with the base path. */
export const asset = (path: string) => `${BASE}${path}`;
