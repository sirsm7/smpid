/**
 * @file js/core/idb.js
 * @description NADIM Resilient IndexedDB Cache Engine (Pro Web Caster V3.4 - SWR & Auto-Migration Edition)
 * Menguruskan storan pangkalan data tempatan pelayar web (IndexedDB) dengan sandaran selamat ke memori
 * (in-memory fallback), pengurusan pelepasan kunci sambungan (connection lock & versionchange),
 * serta automasi pembersihan versi lapuk berpandukan APP_CONFIG.
 * @module IDBCache
 */

import { APP_CONFIG } from '../config/app.config.js';

const DB_NAME = (APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.DB_NAME) ? APP_CONFIG.IDB.DB_NAME : 'nadim_storage_v2';
const DB_VERSION = (APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.DB_VERSION) ? APP_CONFIG.IDB.DB_VERSION : 1;
const DEFAULT_STORE_NAME = 'query_cache';

let dbPromise = null;
let useMemoryFallback = false;
let versionCheckCompleted = false;

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

function checkAndMigrateAppVersion() {
    if (versionCheckCompleted) return;
    versionCheckCompleted = true;

    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const currentVersion = APP_CONFIG.APP_VERSION;
        const versionKey = (APP_CONFIG.SESSION && APP_CONFIG.SESSION.APP_VERSION_KEY) 
            ? APP_CONFIG.SESSION.APP_VERSION_KEY 
            : 'smpid_app_version';
        const storedVersion = localStorage.getItem(versionKey);

        if (storedVersion && storedVersion !== currentVersion) {
            console.warn(`[IDB] Versi aplikasi baharu dikesan (${currentVersion} vs ${storedVersion}). Menyegerakkan cache pangkalan data tempatan...`);
            
            if (checkIndexedDBSupport() && window.indexedDB.deleteDatabase) {
                try {
                    window.indexedDB.deleteDatabase('nadim_cache_db');
                    window.indexedDB.deleteDatabase('smpid_db');
                } catch (delErr) {
                    console.warn('[IDB] Nota: Pangkalan data lama tidak wujud atau telah dipadam.', delErr);
                }
            }
            if (window.__memoryCache) {
                window.__memoryCache = {};
            }
        }
        localStorage.setItem(versionKey, currentVersion);
    } catch (e) {
        console.warn('[IDB] Amaran semakan versi aplikasi:', e);
    }
}

export const IDBCache = {
    generateSecureKey(baseKey, isGlobal = false) {
        if (isGlobal) return `GLOBAL_${baseKey}`;
        
        try {
            const roleKey = (APP_CONFIG.SESSION && APP_CONFIG.SESSION.USER_ROLE) ? APP_CONFIG.SESSION.USER_ROLE : 'smpid_user_role';
            const kodKey = (APP_CONFIG.SESSION && APP_CONFIG.SESSION.USER_KOD) ? APP_CONFIG.SESSION.USER_KOD : 'smpid_user_kod';
            const role = localStorage.getItem(roleKey) || 'ANON';
            const kod = localStorage.getItem(kodKey) || 'NOKOD';
            return `${baseKey}_${role}_${kod}`;
        } catch (e) {
            return `FALLBACK_${baseKey}`;
        }
    },

    async initDB() {
        checkAndMigrateAppVersion();

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            useMemoryFallback = true;
            return null;
        }

        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve) => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onblocked = () => {
                    console.warn('[IDB] Pembukaan IndexedDB disekat oleh tab lain. Sambungan lama akan dilepaskan secara automatik.');
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    if (!db.objectStoreNames.contains(DEFAULT_STORE_NAME)) {
                        db.createObjectStore(DEFAULT_STORE_NAME, { keyPath: 'key' });
                    }

                    if (APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.STORES) {
                        Object.values(APP_CONFIG.IDB.STORES).forEach((storeName) => {
                            if (!db.objectStoreNames.contains(storeName)) {
                                db.createObjectStore(storeName, { keyPath: 'key' });
                            }
                        });
                    }
                };

                request.onsuccess = () => {
                    const db = request.result;

                    db.onversionchange = () => {
                        db.close();
                        dbPromise = null;
                        console.warn('[IDB] Versi IndexedDB baharu dikesan daripada deployment terkini. Sambungan lama ditutup secara selamat.');
                    };

                    setTimeout(() => this._sweepStaleCache(db), 1500);
                    resolve(db);
                };

                request.onerror = (event) => {
                    console.warn('[IDB] IndexedDB tidak dapat dibuka atau disekat oleh dasar pelayar. Beralih ke in-memory cache:', event.target.error);
                    useMemoryFallback = true;
                    dbPromise = null;
                    resolve(null);
                };
            } catch (err) {
                console.warn('[IDB] Ralat luar jangka semasa inisialisasi IndexedDB. Menggunakan in-memory cache:', err);
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
            const storesToCheck = [DEFAULT_STORE_NAME];
            if (APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.STORES) {
                Object.values(APP_CONFIG.IDB.STORES).forEach((s) => {
                    if (!storesToCheck.includes(s) && db.objectStoreNames.contains(s)) {
                        storesToCheck.push(s);
                    }
                });
            }

            const now = new Date().getTime();

            storesToCheck.forEach((storeName) => {
                if (!db.objectStoreNames.contains(storeName)) return;
                try {
                    const transaction = db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.openCursor();

                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor) {
                            if (cursor.value && cursor.value.expiry && now > cursor.value.expiry) {
                                cursor.delete();
                            }
                            cursor.continue();
                        }
                    };
                } catch (txErr) {
                    console.warn(`[IDB Sweep] Amaran sapuan bagi store ${storeName}:`, txErr);
                }
            });
        } catch (error) {
            console.warn('[IDB Sweep] Gagal menjalankan operasi sapuan cache lapuk:', error);
        }
    },

    async getCache(key, storeName = DEFAULT_STORE_NAME) {
        const now = new Date().getTime();

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            const entry = window.__memoryCache ? window.__memoryCache[`${storeName}_${key}`] : null;
            if (!entry) return null;
            if (now > entry.expiry) {
                delete window.__memoryCache[`${storeName}_${key}`];
                return null;
            }
            return entry.data;
        }

        try {
            const db = await this.initDB();
            if (!db || !db.objectStoreNames.contains(storeName)) {
                const entry = window.__memoryCache ? window.__memoryCache[`${storeName}_${key}`] : null;
                if (!entry) return null;
                if (now > entry.expiry) {
                    delete window.__memoryCache[`${storeName}_${key}`];
                    return null;
                }
                return entry.data;
            }

            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(storeName, 'readonly');
                    const store = transaction.objectStore(storeName);
                    const request = store.get(key);

                    request.onsuccess = () => {
                        const result = request.result;
                        if (!result) return resolve(null);

                        if (now > result.expiry) {
                            this.removeCache(key, storeName);
                            return resolve(null);
                        }
                        resolve(result.data);
                    };

                    request.onerror = () => {
                        const entry = window.__memoryCache ? window.__memoryCache[`${storeName}_${key}`] : null;
                        resolve(entry && now <= entry.expiry ? entry.data : null);
                    };
                } catch (readErr) {
                    dbPromise = null;
                    const entry = window.__memoryCache ? window.__memoryCache[`${storeName}_${key}`] : null;
                    resolve(entry && now <= entry.expiry ? entry.data : null);
                }
            });
        } catch (error) {
            const entry = window.__memoryCache ? window.__memoryCache[`${storeName}_${key}`] : null;
            return entry && now <= entry.expiry ? entry.data : null;
        }
    },

    async setCache(key, data, ttlMinutes = 60, storeName = DEFAULT_STORE_NAME) {
        const now = new Date().getTime();
        const ttlMs = ttlMinutes ? (ttlMinutes * 60 * 1000) : (APP_CONFIG.IDB ? APP_CONFIG.IDB.CACHE_TTL_MS : 3600000);
        const expiry = now + ttlMs;
        
        const payload = {
            key: key,
            data: data,
            expiry: expiry,
            timestamp: now
        };

        if (window.__memoryCache) {
            window.__memoryCache[`${storeName}_${key}`] = payload;
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db || !db.objectStoreNames.contains(storeName)) return true;

            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    store.put(payload);
                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => resolve(false);
                    transaction.onabort = () => resolve(false);
                } catch (txErr) {
                    dbPromise = null;
                    resolve(false);
                }
            });
        } catch (error) {
            return false;
        }
    },

    async removeCache(key, storeName = DEFAULT_STORE_NAME) {
        if (window.__memoryCache && window.__memoryCache[`${storeName}_${key}`]) {
            delete window.__memoryCache[`${storeName}_${key}`];
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db || !db.objectStoreNames.contains(storeName)) return true;

            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    store.delete(key);
                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => resolve(false);
                    transaction.onabort = () => resolve(false);
                } catch (txErr) {
                    resolve(false);
                }
            });
        } catch (error) {
            return false;
        }
    },

    async invalidateByPrefix(prefix, storeName = DEFAULT_STORE_NAME) {
        if (window.__memoryCache) {
            const fullPrefix = `${storeName}_${prefix}`;
            Object.keys(window.__memoryCache).forEach((k) => {
                if (k.startsWith(fullPrefix) || k.startsWith(prefix)) {
                    delete window.__memoryCache[k];
                }
            });
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db || !db.objectStoreNames.contains(storeName)) return true;

            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
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
                } catch (txErr) {
                    resolve(false);
                }
            });
        } catch (error) {
            return false;
        }
    },

    async staleWhileRevalidate(key, fetchPromiseFactory, onRevalidated = null, ttlMinutes = 60, storeName = DEFAULT_STORE_NAME) {
        const cachedData = await this.getCache(key, storeName);

        const backgroundFetch = async () => {
            try {
                const freshData = await fetchPromiseFactory();
                if (!freshData) return;

                const isChanged = !cachedData || JSON.stringify(cachedData) !== JSON.stringify(freshData);
                
                if (isChanged) {
                    await this.setCache(key, freshData, ttlMinutes, storeName);
                    if (onRevalidated && typeof onRevalidated === 'function') {
                        onRevalidated(freshData);
                    }
                }
            } catch (err) {
                console.warn(`[IDB SWR] Semakan latar belakang gagal bagi kunci ${key}:`, err);
            }
        };

        if (cachedData) {
            backgroundFetch();
            return cachedData;
        } else {
            const freshData = await fetchPromiseFactory();
            if (freshData) {
                await this.setCache(key, freshData, ttlMinutes, storeName);
            }
            return freshData;
        }
    },

    async clearAll(storeName = null) {
        if (window.__memoryCache) {
            if (storeName) {
                const prefix = `${storeName}_`;
                Object.keys(window.__memoryCache).forEach((k) => {
                    if (k.startsWith(prefix)) delete window.__memoryCache[k];
                });
            } else {
                window.__memoryCache = {};
            }
        }

        if (useMemoryFallback || !checkIndexedDBSupport()) {
            return true;
        }

        try {
            const db = await this.initDB();
            if (!db) return true;

            const targetStores = storeName 
                ? [storeName] 
                : Array.from(db.objectStoreNames);

            return new Promise((resolve) => {
                try {
                    const transaction = db.transaction(targetStores, 'readwrite');
                    targetStores.forEach((s) => {
                        if (db.objectStoreNames.contains(s)) {
                            transaction.objectStore(s).clear();
                        }
                    });
                    transaction.oncomplete = () => resolve(true);
                    transaction.onerror = () => resolve(false);
                    transaction.onabort = () => resolve(false);
                } catch (txErr) {
                    resolve(false);
                }
            });
        } catch (error) {
            return false;
        }
    },

    async purgeDatabase() {
        if (window.__memoryCache) {
            window.__memoryCache = {};
        }

        if (dbPromise) {
            try {
                const db = await dbPromise;
                if (db) db.close();
            } catch (e) {}
            dbPromise = null;
        }

        if (checkIndexedDBSupport() && window.indexedDB.deleteDatabase) {
            return new Promise((resolve) => {
                const request = window.indexedDB.deleteDatabase(DB_NAME);
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
                request.onblocked = () => {
                    console.warn('[IDB] Pemadaman pangkalan data terhalang. Memaksa set semula sesi...');
                    resolve(false);
                };
            });
        }
        return true;
    }
};