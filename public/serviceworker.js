const CACHE_NAME = 'aurio-v3';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/firebase.js',
    '/cloudinary.js',
    'https://res.cloudinary.com/ddyj2njes/image/upload/v1770220405/aurio_branding_nvrbwx.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.error('Service worker cache install failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Use stale-while-revalidate for app shell assets:
    // serve from cache immediately, then update cache in background
    if (event.request.destination === 'document' ||
        event.request.destination === 'script' ||
        event.request.destination === 'style') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const networkFetch = fetch(event.request).then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => {
                    if (event.request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                });
                return cached || networkFetch;
            })
        );
        return;
    }

    // Cache-first for images (with background update for Cloudinary images)
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) {
                    // Background update for Cloudinary-hosted images
                    if (url.hostname.includes('cloudinary')) {
                        fetch(event.request).then(response => {
                            if (response && response.ok) {
                                caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                            }
                        }).catch(() => {});
                    }
                    return cached;
                }
                return fetch(event.request).then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => {});
            })
        );
        return;
    }

    // Network-first for all other requests (API calls, etc.)
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
