// Simple Service Worker for PWA installability
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle fetching as usual
  event.respondWith(fetch(event.request));
});
