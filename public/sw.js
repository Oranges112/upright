/* Upright service worker: offline shell + push reminders */
const CACHE = "upright-v2";
// "" on Vercel, "/upright" on GitHub Pages: worked out from where this worker lives
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const SHELL = [`${BASE}/`, `${BASE}/manifest.webmanifest`, `${BASE}/icons/192.png`, `${BASE}/icons/512.png`];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith(`${BASE}/api/`)) return;

  // Hashed build assets: cache-first
  if (url.pathname.startsWith(`${BASE}/_next/static/`) || url.pathname.startsWith(`${BASE}/icons/`)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network-first, fall back to cached shell when offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(`${BASE}/`, copy));
          return res;
        })
        .catch(() => caches.match(`${BASE}/`).then((r) => r || Response.error())),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Upright", body: event.data && event.data.text() };
  }
  const title = data.title || "Time for a neck break 🧘";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "A quick 2-minute routine. Sit tall and let's go.",
      icon: `${BASE}/icons/192.png`,
      badge: `${BASE}/icons/96.png`,
      tag: data.tag || "upright-reminder",
      renotify: true,
      requireInteraction: false,
      vibrate: [80, 60, 80],
      data: { url: data.url || `${BASE}/?start=default`, code: data.code },
      actions: [
        { action: "start", title: "▶ Start now" },
        { action: "snooze", title: "Snooze 30 min" },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  n.close();

  if (event.action === "snooze") {
    event.waitUntil(
      (async () => {
        const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        all.forEach((c) => c.postMessage({ type: "snooze", minutes: 30 }));
        if (data.code) {
          await fetch(`${BASE}/api/snooze`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: data.code, minutes: 30 }),
          }).catch(() => {});
        }
      })(),
    );
    return;
  }

  const target = data.url || `${BASE}/`;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if (target.includes("start=")) c.postMessage({ type: "start" });
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
