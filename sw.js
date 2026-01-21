/**
 * SMPID Service Worker
 * Versi: 1.0 (Cache-First Strategy untuk Aset Statik)
 */

const CACHE_NAME = 'smpid-cache-v1';

// Senarai fail yang PERLU disimpan dalam cache supaya app laju & boleh buka offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './user.html',
  './admin.html',
  './css/style.css',
  './js/app.js',
  './icoppdag.png',
  
  // CDN Luar (Penting untuk UI tidak pecah bila offline)
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// 1. INSTALL: Download semua aset bila user mula-mula buka web
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing New Version...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Paksa SW baru aktif segera
});

// 2. ACTIVATE: Buang cache lama jika ada update version baru
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. FETCH: Pintas request network
self.addEventListener('fetch', (event) => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  // Strategi: Network First, Fallback to Cache (Untuk HTML)
  // Ini memastikan user dapat version terkini, tapi kalau offline, guna cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Strategi: Stale-While-Revalidate (Untuk Aset CSS/JS/Gambar)
  // Guna cache dulu (laju), lepas tu update cache di background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Simpan copy baru dalam cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseClone = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, responseClone);
             });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});