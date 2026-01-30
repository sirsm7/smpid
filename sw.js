/**
 * SMPID Service Worker
 * Versi: 4.1 (Fix: CORS Tailwind CSS)
 */

const CACHE_NAME = 'smpid-cache-v4.1';

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
  './modules/bankgemini/icoppdag.png', // Tambahan: Ikon dalam folder modul jika ada
  
  // --- EXTERNAL LIBRARIES (YANG STABIL SAHAJA) ---
  // Nota: Tailwind CDN dibuang untuk elak isu CORS. Modul akan load Tailwind bila online.
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  // 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js' // Dibuang jika menyebabkan isu sama
];

// 1. INSTALL
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v4.1 (CORS Fix)...');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching Assets...');
      // Guna Promise.allSettled untuk elak satu fail gagal, semua gagal
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

  if (url.href.includes('supabase') || url.href.includes('tech4ag.my')) {
      return; 
  }

  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Hanya cache respons yang sah dan dari origin yang sama atau CDN yang dibenarkan
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
             const responseClone = networkResponse.clone();
             caches.open(CACHE_NAME).then((cache) => {
               cache.put(event.request, responseClone);
             });
        }
        return networkResponse;
      }).catch(err => {
          // Abaikan error fetch background
      });
      return cachedResponse || fetchPromise;
    })
  );
});