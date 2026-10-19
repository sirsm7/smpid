/**
 * js/core/idb.js
 * NADIM IndexedDB Cache Engine (Pro Web Caster - V2.1 Robust Edition)
 * Fungsi: Menguruskan storan pangkalan data tempatan pelayar web (IndexedDB)
 * untuk menyimpan data yang ditarik dari Supabase. Menyokong ciri Singleton 
 * dan Active Background Garbage Collection untuk mengoptimumkan prestasi.
 * KEMASKINI: Logik pemadaman (invalidate) ditukar dari Cursor ke getAllKeys 
 * untuk jaminan 100% pembersihan cache lama merentas semua pelayar.
 */

const DB_NAME = 'nadim_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'query_cache';

// Singleton Instance Promise
let dbPromise = null;

export const IDBCache = {
    /**
     * Memulakan atau menyambung ke pangkalan data IndexedDB menggunakan corak Singleton
     * bagi mengelakkan bukaan sambungan berulang (multiple connections).
     */
    async initDB() {
        if (dbPromise) {
            return dbPromise;
        }

        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Gunakan 'key' sebagai primary key
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                
                // Mulakan pembersihan data usang (garbage collection) di latar belakang
                // Penangguhan 1 saat supaya tidak mengganggu pergerakan UI serentak
                setTimeout(() => {
                    this._sweepStaleCache(db);
                }, 1000);

                resolve(db);
            };

            request.onerror = (event) => {
                console.error('[IDB] Ralat memulakan pangkalan data:', event.target.error);
                dbPromise = null; // Reset jika gagal supaya boleh cuba lagi
                reject(event.target.error);
            };
        });

        return dbPromise;
    },

    /**
     * Fungsi Dalaman: Menyapu dan memadam cache yang telah melepasi tarikh luput 
     * secara pukal di latar belakang (Non-blocking Garbage Collection).
     * @param {IDBDatabase} db - Sambungan pangkalan data yang sedang aktif
     */
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
                        // Padam item luput
                        cursor.delete();
                    }
                    // Teruskan semakan ke item seterusnya
                    cursor.continue();
                }
            };

            // Ralat semasa sapuan latar belakang tidak ditangkap ke console.error
            // untuk mengelakkan pencemaran log (log spamming).
        } catch (error) {
            // Ignore (Silent fail for background operation)
        }
    },

    /**
     * Mengambil data dari cache berdasarkan kunci (key)
     * @param {string} key Kunci unik cache (cth: 'sekolah_ALL')
     * @returns {Promise<any|null>} Data cache atau null jika tiada/tamat tempoh
     */
    async getCache(key) {
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    if (!result) {
                        return resolve(null);
                    }

                    // Semak jika cap masa telah tamat tempoh (TTL)
                    const now = new Date().getTime();
                    if (now > result.expiry) {
                        // Walaupun ada background sweeper, double check di sini lebih selamat
                        this.removeCache(key);
                        return resolve(null);
                    }

                    resolve(result.data);
                };

                request.onerror = () => {
                    console.warn(`[IDB] Gagal membaca cache untuk ${key}`);
                    resolve(null); // Return null supaya sistem boleh fallback ke Supabase
                };
            });
        } catch (error) {
            console.warn('[IDB] Kegagalan enjin bacaan:', error);
            return null;
        }
    },

    /**
     * Menyimpan data ke dalam IndexedDB dengan cap masa tamat tempoh
     * @param {string} key Kunci unik cache
     * @param {any} data Data yang ingin disimpan (Array/Object)
     * @param {number} ttlMinutes Tempoh hayat cache dalam minit (Lalai: 30 minit)
     */
    async setCache(key, data, ttlMinutes = 30) {
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const now = new Date().getTime();
                const expiry = now + (ttlMinutes * 60 * 1000); // Tukar minit ke milisaat
                
                const payload = {
                    key: key,
                    data: data,
                    expiry: expiry,
                    timestamp: now
                };

                store.put(payload);

                // Menggunakan transaction events untuk hasil yang lebih tepat
                transaction.oncomplete = () => resolve(true);
                transaction.onerror = () => {
                    console.warn(`[IDB] Gagal menyimpan cache untuk ${key}`);
                    resolve(false);
                };
                transaction.onabort = () => resolve(false);
            });
        } catch (error) {
            console.warn('[IDB] Kegagalan enjin simpanan:', error);
            return false;
        }
    },

    /**
     * Memadam cache tertentu secara manual
     * @param {string} key Kunci unik cache
     */
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

    /**
     * Memadam cache yang bermula dengan kata kunci tertentu (Cth: 'pencapaian_')
     * Sangat berguna untuk 'Invalidation' selepas rekod baharu ditambah.
     * Menggunakan pendekatan getAllKeys untuk kebolehpercayaan maksimum.
     * @param {string} prefix Permulaan kunci cache
     */
    async invalidateByPrefix(prefix) {
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                // Ambil semua kunci dahulu untuk mengelakkan ralat 'cursor timeout/skip'
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
            console.error('[IDB] Ralat ketika memadam cache berkumpulan:', error);
            return false;
        }
    },

    /**
     * Dikosongkan semua cache (Contoh: Semasa log keluar)
     */
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