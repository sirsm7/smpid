/**
 * js/core/idb.js
 * NADIM IndexedDB Cache Engine (Pro Web Caster - V3.1 SWR & In-Memory Fallback Edition)
 * Fungsi: Menguruskan storan pangkalan data tempatan pelayar web (IndexedDB)
 * dengan sandaran selamat ke memori (in-memory fallback) sekiranya mod penyamaran (Incognito) aktif.
 */

import { APP_CONFIG } from '../config/app.config.js';

const DB_NAME = 'nadim_cache_db';
const DB_VERSION = 2;
const STORE_NAME = 'query_cache';

let dbPromise = null;
let useMemoryFallback = false;

if (typeof window !== 'undefined') {
    window.__memoryCache = window.__memoryCache || {};
}

function checkIndexedDBSupport() {
    try {
        return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
    } catch (e) {
        return false;
    }
}

export const IDBCache = {
    generateSecureKey(baseKey, isGlobal = false) {
        if (isGlobal) return `GLOBAL_${baseKey}`;
        
        try {
            const role = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || 'ANON';
            const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'NOKOD';
            return `${baseKey}_${role}_${kod}`;
        } catch (e) {
            return `FALLBACK_${baseKey}`;
        }
    },

    async initDB() {
        if (useMemoryFallback || !checkIndexedDBSupport()) {
            useMemoryFallback = true;
            return null;
        }

        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                    }
                };

                request.onsuccess = () => {
                    const db = request.result;
                    setTimeout(() => this._sweepStaleCache(db), 1000);
                    resolve(db);
                };

                request.onerror = (event) => {
                    console.warn('[IDB] IndexedDB disekat atau gagal dimuatkan. Beralih ke in-memory cache:', event.target.error);
                    useMemoryFallback = true;
                    dbPromise = null;
                    resolve(null);
                };
            } catch (err) {
                console.warn('[IDB] Exception semasa inisialisasi IndexedDB. Menggunakan in-memory cache:', err);
                useMemoryFallback = true;
                dbPromise = null;
                resolve(null);
            }
        });

        return dbPromise;
    },

    async _sweepStaleCache(db) {
        if (!db || useMemoryFallback) return;
        try {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();
            const now = new Date().getTime();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    if (now > cursor.value.expiry) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        } catch (error) {}
    },

    async getCache(key) {
        const now = new Date().getTime();

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            const entry = window.__memoryCache ? window.__memoryCache[key] : null;
            if (!entry) return null;
            if (now > entry.expiry) {
                delete window.__memoryCache[key];
                return null;
            }
            return entry.data;
        }

        try {
            const db = await this.initDB();
            if (!db) {
                const entry = window.__memoryCache ? window.__memoryCache[key] : null;
                if (!entry) return null;
                if (now > entry.expiry) {
                    delete window.__memoryCache[key];
                    return null;
                }
                return entry.data;
            }

            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    if (!result) return resolve(null);

                    if (now > result.expiry) {
                        this.removeCache(key);
                        return resolve(null);
                    }
                    resolve(result.data);
                };

                request.onerror = () => resolve(null);
            });
        } catch (error) {
            const entry = window.__memoryCache ? window.__memoryCache[key] : null;
            return entry && now <= entry.expiry ? entry.data : null;
        }
    },

    async setCache(key, data, ttlMinutes = 60) {
        const now = new Date().getTime();
        const expiry = now + (ttlMinutes * 60 * 1000);
        
        const payload = {
            key: key,
            data: data,
            expiry: expiry,
            timestamp: now
        };

        if (window.__memoryCache) {
            window.__memoryCache[key] = payload;
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db) return true;

            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put(payload);
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    },

    async removeCache(key) {
        if (window.__memoryCache && window.__memoryCache[key]) {
            delete window.__memoryCache[key];
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db) return true;

            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.delete(key);
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    },

    async invalidateByPrefix(prefix) {
        if (window.__memoryCache) {
            Object.keys(window.__memoryCache).forEach((k) => {
                if (k.startsWith(prefix)) {
                    delete window.__memoryCache[k];
                }
            });
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db) return true;

            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAllKeys();

                request.onsuccess = (event) => {
                    const keys = event.target.result;
                    if (keys && keys.length > 0) {
                        keys.forEach((key) => {
                            if (typeof key === 'string' && key.startsWith(prefix)) {
                                store.delete(key);
                            }
                        });
                    }
                };

                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    },

    async staleWhileRevalidate(key, fetchPromiseFactory, onRevalidated = null, ttlMinutes = 60) {
        const cachedData = await this.getCache(key);

        const backgroundFetch = async () => {
            try {
                const freshData = await fetchPromiseFactory();
                const isChanged = !cachedData || JSON.stringify(cachedData) !== JSON.stringify(freshData);
                
                if (isChanged) {
                    await this.setCache(key, freshData, ttlMinutes);
                    if (onRevalidated && typeof onRevalidated === 'function') {
                        onRevalidated(freshData);
                    }
                }
            } catch (err) {
                console.warn(`[IDB SWR] Latar belakang fetch gagal untuk ${key}:`, err);
            }
        };

        if (cachedData) {
            backgroundFetch();
            return cachedData;
        } else {
            const freshData = await fetchPromiseFactory();
            await this.setCache(key, freshData, ttlMinutes);
            return freshData;
        }
    },

    async clearAll() {
        if (window.__memoryCache) {
            window.__memoryCache = {};
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db) return true;

            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.clear();
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => resolve(false);
                transaction.onabort = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    }
};