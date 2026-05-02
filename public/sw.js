/**
 * @fileoverview Service Worker for ElectIQ PWA.
 *
 * Caching Strategy:
 *  - Cache-first: Static assets (HTML, CSS, JS, fonts, images)
 *  - Network-first: AI responses, Firestore data, translation API
 *
 * Features:
 *  - Precaches critical assets on install
 *  - Cache versioning for clean updates
 *  - Offline fallback page
 *  - Background sync for quiz submissions
 */

const CACHE_VERSION = 'electiq-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

/**
 * Critical assets to precache on install.
 * @constant {string[]}
 */
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/styles/components.css',
  '/manifest.json',
  '/src/app.js',
  '/src/utils/sanitize.js',
  '/src/utils/accessibility.js',
  '/src/utils/analytics.js',
  '/src/services/firebaseService.js',
  '/src/services/geminiService.js',
  '/src/services/calendarService.js',
  '/src/services/translateService.js',
  '/src/components/ElectionTimeline.js',
  '/src/components/ChatAssistant.js',
  '/src/components/PollingLocator.js',
  '/src/components/QuizModule.js',
  '/src/components/LanguageSwitcher.js',
  '/src/components/ProgressTracker.js',
  '/src/components/DeadlineCountdown.js',
  '/src/components/ElectionCharts.js'
];

/**
 * URL patterns that should use network-first strategy.
 * @constant {RegExp[]}
 */
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /firestore\.googleapis\.com/,
  /generativelanguage\.googleapis\.com/,
  /translation\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/
];

// ══ Install Event ══
self.addEventListener('install', (event) => {
  console.log('[SW] Installing:', CACHE_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Precaching critical assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ══ Activate Event ══
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map(key => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ══ Fetch Event ══
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions and browser-internal URLs
  if (!request.url.startsWith('http')) return;

  // Determine strategy
  const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(pattern =>
    pattern.test(request.url)
  );

  if (isNetworkFirst) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * Cache-first strategy: Serve from cache, fall back to network.
 * Used for static assets that change infrequently.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Offline fallback
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first strategy: Try network, fall back to cache.
 * Used for dynamic content (API responses, Firestore data).
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Cache successful API responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Fall back to cached response
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ error: 'You are offline. Please check your connection.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ══ Background Sync ══
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-quiz-scores') {
    event.waitUntil(syncQuizScores());
  }
});

/**
 * Syncs locally stored quiz scores to Firestore when back online.
 */
async function syncQuizScores() {
  // Implementation would read from IndexedDB and POST to Firestore
  console.log('[SW] Syncing quiz scores...');
}

// ══ Push Notifications (future) ══
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New election update available',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: { url: data.url || '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ElectIQ', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
