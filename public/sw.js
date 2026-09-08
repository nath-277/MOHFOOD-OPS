// Moh Foods Operations Platform (MOH-OPS) Service Worker v2
const CACHE_NAME = "moh-ops-pwa-cache-v2";

const STATIC_SHELL_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/Moh-Logo.png",
  "/offline.html"
];

// 1. Install Event: Pre-cache static shell assets safely
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use allSettled to ensure installation never fails on transient network drops
      const cachePromises = STATIC_SHELL_ASSETS.map((url) =>
        fetch(url, { cache: "no-cache" })
          .then((response) => {
            if (response && response.status === 200) {
              return cache.put(url, response);
            }
          })
          .catch((err) => {
            console.warn(`[MOH-OPS SW] Failed to pre-cache ${url}:`, err);
          })
      );
      await Promise.allSettled(cachePromises);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event: Clean up legacy caches & claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log(`[MOH-OPS SW] Removing old cache: ${key}`);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Network-First for Navigations, Stale-While-Revalidate for Assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, API endpoints, Chrome extensions, and Next dev websockets/HMR
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.protocol.startsWith("chrome-extension")
  ) {
    return;
  }

  // A. Page Navigation Requests (HTML) -> Network-First with Offline Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Clone and cache the successful page response
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If network failed, check cache for the page
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If page not in cache, fallback to offline shell
          const offlineShell = await caches.match("/offline.html");
          if (offlineShell) {
            return offlineShell;
          }
          return new Response("Offline - MOH OPS Platform", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/plain" }
          });
        })
    );
    return;
  }

  // B. Static Assets (JS, CSS, Images, Fonts, Icons) -> Cache-First / Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".json");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (networkResponse.type === "basic" || networkResponse.type === "cors")
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // C. Default: Direct Network Fetch
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
