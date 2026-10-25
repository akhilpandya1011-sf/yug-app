// Minimal service worker: makes the app installable; always fetches fresh from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if (e.request.method === 'GET') e.respondWith(fetch(e.request).catch(() => new Response('<h2 style="font-family:sans-serif;padding:20px">No connection. Check internet and reopen Yug Creation.</h2>', { headers: { 'Content-Type': 'text/html' } }))); });
