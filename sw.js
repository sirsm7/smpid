/**
 * SMPID Service Worker
 * Versi: 4.2 (Fix: Ignore External Beacons & Fetch Handling)
 */

const CACHE_NAME = 'smpid-cache-v4.2';

// Senarai fail kritikal yang perlu dicache
const ASSETS_TO_CACHE = [
  // --- ROOT FILES ---
  './',
  './index.html',
  './user.html',
  './admin.html',
  './css/style.css',
  
  // --- CORE JS ---
  './js/utils.js',
  './js/auth.js',
  './js/user.js',
  './js/admin.js',
  './js/auth-bridge.js', 
  
  // --- ASSETS ---
  './icoppdag.png',
  
  // --- MODUL: SPKA ---
  './modules/spka/index.html',
  './modules/spka/generator.html',
  './modules/spka/examples.html',
  './modules/spka/quiz.html',
  './modules/spka/css/style.css',
  './modules/spka/js/app.js',
  './modules/spka/js/data.js',
  './modules/spka/SirSM.png',

  // --- MODUL: BANK GEMINI ---
  './modules/bankgemini/index.html',
  './modules/bankgemini/ai-helper.html',
  './modules/bankgemini/style.css',
  './modules/bankgemini/script.js',
  './modules/bankgemini/questions.js',
  './modules/bankgemini/icoppdag.png',
  
  // --- EXTERNAL LIBRARIES (YANG STABIL SAHAJA) ---
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

// 1. INSTALL
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v4.2...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching Assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error("Gagal cache sebahagian fail:", err);
      });
    })
  );
});

// 2. ACTIVATE
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
  return self.clients.claim();
});

// 3. FETCH STRATEGY
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // FIX: Abaikan domain luaran yang bermasalah (Beacon, Supabase API, dll)
  // Ini mengelakkan ralat "Failed to convert value to 'Response'"
  if (
      url.href.includes('supabase') || 
      url.href.includes('tech4ag.my') || 
      url.href.includes('cloudflareinsights') ||
      url.href.includes('beacon.min.js')
  ) {
      return; // Biarkan browser uruskan secara langsung tanpa SW
  }

  if (event.request.method !== 'GET') return;

  // Mod Navigasi (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Mod Aset (JS, CSS, Images)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Strategy: Stale-While-Revalidate
      // Kita pulangkan cache jika ada, tapi kita fetch update di background
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseClone = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, responseClone);
             });
        }
        return networkResponse;
      }).catch(err => {
          // Jika network fail, kita abaikan sahaja (guna cache)
          // Jika tiada cache, ini akan return undefined yang boleh menyebabkan error,
          // tapi sebab kita return 'cachedResponse || fetchPromise', ia akan diuruskan browser
          console.warn('SW Fetch fail (offline?):', event.request.url);
      });
      
      return cachedResponse || fetchPromise;
    })
  );
});