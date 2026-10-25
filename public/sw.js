/*
 * VYBZ service worker: makes VYBZ installable, gives it an offline screen and
 * shows phone/computer notifications (push).
 *
 * It deliberately caches almost nothing:
 *  - Pages, Supabase data, photos and login requests always go to the network.
 *    They're private and change all the time, so a stored copy could show old
 *    or someone else's content (e.g. after logging out on a shared phone).
 *  - The only things stored are the offline page and the app icon.
 *  - Next.js's own code files (/_next/static) are already cached by the
 *    browser forever (their names change on every update), so we leave them be.
 *
 * When a page can't load because there's no connection, the offline page is
 * shown instead. Bump VERSION whenever the offline page changes.
 */
const VERSION = "vybz-v3";
const CACHE = `${VERSION}-offline`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // "reload" skips the browser cache so we always store the newest copy.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove caches from older versions of this file.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("vybz-") && name !== CACHE).map((name) => caches.delete(name)));
      // Lets page loads start while the service worker wakes up (faster).
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

// ----------------------------------------------------- phone notifications ---
// Sent by the Supabase Edge Function `send-push` (supabase/functions/send-push).
// The message is encrypted end-to-end: only this device can read it.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "VYBZ", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || undefined,
      // Only our own pages can be opened from a notification.
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/notifications" },
    }),
  );
});

// Tapping a notification opens VYBZ on the right screen (reusing an open window if there is one).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        return open.navigate(url);
      }
      return self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only full page loads are handled. Everything else (data, images, Supabase,
  // form posts, other websites) goes straight to the network as normal.
  if (request.mode !== "navigate" || request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        return preloaded || (await fetch(request));
      } catch {
        // No connection: show the offline page (never an old copy of a real page).
        const cache = await caches.open(CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })(),
  );
});
