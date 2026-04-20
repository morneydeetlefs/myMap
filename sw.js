const CACHE_NAME = 'elysium-map-v4';
const MAX_AGE_DAYS = 30;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
                'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
            ]);
        })
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (url.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;

                    return fetch(event.request).then(networkResponse => {
                        if (networkResponse && networkResponse.status === 200) {
                            const cloned = networkResponse.clone();
                            const headers = new Headers(cloned.headers);
                            headers.set('X-Cache-Timestamp', Date.now().toString());

                            const timedResponse = new Response(cloned.body, {
                                status: cloned.status,
                                statusText: cloned.statusText,
                                headers: headers
                            });

                            cache.put(event.request, timedResponse);
                        }
                        return networkResponse;
                    });
                });
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request).then(cached => cached || fetch(event.request))
        );
    }
});

self.addEventListener('message', event => {
    if (event.data && event.data.action === 'clearOldCache') {
        cleanOldCache();
    }
});

async function cleanOldCache() {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const now = Date.now();
    let deleted = 0;

    for (const request of keys) {
        if (request.url.includes('tile.openstreetmap.org')) {
            const response = await cache.match(request);
            if (response) {
                const timestamp = parseInt(response.headers.get('X-Cache-Timestamp') || '0');
                if (timestamp && (now - timestamp > MAX_AGE_MS)) {
                    await cache.delete(request);
                    deleted++;
                }
            }
        }
    }
    console.log(`🧹 Cleared ${deleted} old map tiles (older than ${MAX_AGE_DAYS} days)`);
}

self.addEventListener('activate', event => {
    event.waitUntil(cleanOldCache());
});
