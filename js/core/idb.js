/**
 * js/core/idb.js
 * NADIM IndexedDB Cache Engine (Pro Web Caster - V3.0 SWR & RBAC Edition)
 * Fungsi: Menguruskan storan pangkalan data tempatan pelayar web (IndexedDB).
 * KEMASKINI V3.0: 
 * 1. Pengasingan Cache Selamat (RBAC Key Generation) untuk mengelak kebocoran data.
 * 2. API Stale-While-Revalidate (SWR) untuk pemaparan UI serta-merta.
 * 3. Invalidasi bersasar yang lebih pintar.
 */

import { APP_CONFIG } from '../config/app.config.js';

const DB_NAME = 'nadim_cache_db';
const DB_VERSION = 2; // Naik taraf versi untuk memaksa reset struktur
const STORE_NAME = 'query_cache';

// Singleton Instance Promise
let dbPromise = null;

export const IDBCache = {
    /**
     * Membina kunci cache yang selamat berasaskan sesi pengguna (RBAC).
     * @param {string} baseKey Kunci asas (cth: 'school_list')
     * @param {boolean} isGlobal True jika data dikongsi semua pengguna
     * @returns {string} Kunci selamat (cth: 'school_list_ADMIN_M030')
     */
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
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
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
                console.error('[IDB] Ralat memulakan pangkalan data:', event.target.error);
                dbPromise = null; 
                reject(event.target.error);
            };
        });

        return dbPromise;
    },

    async _sweepStaleCache(db) {
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
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    if (!result) return resolve(null);

                    const now = new Date().getTime();
                    if (now > result.expiry) {
                        this.removeCache(key);
                        return resolve(null);
                    }
                    resolve(result.data);
                };

                request.onerror = () => resolve(null);
            });
        } catch (error) {
            return null;
        }
    },

    async setCache(key, data, ttlMinutes = 60) {
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const now = new Date().getTime();
                const expiry = now + (ttlMinutes * 60 * 1000);
                
                const payload = {
                    key: key,
                    data: data,
                    expiry: expiry,
                    timestamp: now
                };

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
        try {
            const db = await this.initDB();
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
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAllKeys();

                request.onsuccess = (event) => {
                    const keys = event.target.result;
                    if (keys && keys.length > 0) {
                        keys.forEach(key => {
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

    /**
     * API Stale-While-Revalidate (SWR) Pintar.
     * Mengembalikan data cache serta-merta (jika ada), kemudian menjalankan fetch
     * di latar belakang. Jika data baru berbeza (atau callback dibekalkan), ia akan 
     * mengemas kini cache dan memicu UI untuk segar semula.
     * 
     * @param {string} key Kunci cache unik
     * @param {function} fetchPromiseFactory Fungsi yang mengembalikan Promise data dari Supabase
     * @param {function} onRevalidated Callback yang dipanggil jika terdapat data baharu dari latar belakang
     * @param {number} ttlMinutes Tempoh hayat cache (Lalai: 60 minit)
     * @returns {Promise<any>} Memulangkan cache serta-merta atau menunggu fetch jika tiada cache
     */
    async staleWhileRevalidate(key, fetchPromiseFactory, onRevalidated = null, ttlMinutes = 60) {
        const cachedData = await this.getCache(key);

        // Fungsi latar belakang untuk menyegarkan data
        const backgroundFetch = async () => {
            try {
                const freshData = await fetchPromiseFactory();
                
                // Pengecaman perubahan asas (JSON stringify perbandingan ringkas)
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
            // Pulangkan cache, jalankan fetch di latar belakang tanpa block UI
            backgroundFetch();
            return cachedData;
        } else {
            // Jika tiada cache langsung, kita mesti tunggu fetch selesai
            const freshData = await fetchPromiseFactory();
            await this.setCache(key, freshData, ttlMinutes);
            return freshData;
        }
    },

    async clearAll() {
        try {
            const db = await this.initDB();
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