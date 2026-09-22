// Minimal service worker — its only real job is satisfying the browser's
// "Add to Home Screen" installability requirement (a registered SW with a
// fetch handler). Desmoche is a live multiplayer game: stale cached game
// state would be actively harmful, so this deliberately does NOT cache or
// serve anything offline. Every request just goes straight to the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
