/**
 * SMPID Service Worker
 * Versi: 3.1 (Fix: Auto-Reload & Cache Busting)
 * Strategi: Cache-First untuk Aset Statik, Network-Only untuk API & Analytics
 */

// UPDATE: Versi dinaikkan ke v3.1 untuk memaksa kemaskini UI
const CACHE_NAME = 'smpid-cache-v3.1';

// Senarai fail yang WAJIB ada dalam cache untuk berfungsi offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './user.html',
  './admin.html',
  './css/style.css',
  
  // Modul JS
  './js/utils.js',
  './js/auth.js',
  './js/user.js',
  './js/admin.js',
  
  // Ikon
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
  console.log('[Service Worker] Installing v3.1...');
  self.skipWaiting(); // PENTING: Paksa SW baru aktif segera tanpa tunggu tab tutup
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE: Buang cache lama
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating & Cleaning Old Cache...');
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
  return self.clients.claim(); // Ambil alih kawalan klien dengan segera
});

// 3. FETCH: Pintas request network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // [CRITICAL FIX] ABAIKAN REQUEST KE SUPABASE, API LUAR, & TRACKERS
  if (
      url.href.includes('supabase') || 
      url.href.includes('tech4ag.my') ||
      url.href.includes('cloudflareinsights')
  ) {
      return; // Network only
  }

  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  // Strategi: Network First, Fallback to Cache (Untuk HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Strategi: Stale-While-Revalidate (Untuk Aset CSS/JS/Gambar Local)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Simpan copy baru dalam cache jika berjaya fetch
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