/**
 * js/core/idb.js
 * NADIM IndexedDB Cache Engine
 * Fungsi: Menguruskan storan pangkalan data tempatan pelayar web (IndexedDB)
 * untuk menyimpan data yang ditarik dari Supabase. Ini mengelakkan kelewatan 
 * muat turun dan mencegah masalah 'QuotaExceededError' localStorage (menyokong sehingga ratusan MB).
 */

const DB_NAME = 'nadim_cache_db';
const DB_VERSION = 1;
const STORE_NAME = 'query_cache';

export const IDBCache = {
    /**
     * Memulakan atau menyambung ke pangkalan data IndexedDB
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    // Gunakan 'key' sebagai primary key
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('[IDB] Ralat memulakan pangkalan data:', event.target.error);
                reject(event.target.error);
            };
        });
    },

    /**
     * Mengambil data dari cache berdasarkan kunci (key)
     * @param {string} key Kunci unik cache (cth: 'sekolah_ALL')
     * @returns {Promise<any|null>} Data cache atau null jika tiada/tamat tempoh
     */
    async getCache(key) {
        try {
            const db = await this.initDB();
            return new Promise((resolve, reject) => {
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
                        this.removeCache(key); // Bersihkan cache lama secara senyap
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
            return new Promise((resolve, reject) => {
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

                const request = store.put(payload);

                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                    console.warn(`[IDB] Gagal menyimpan cache untuk ${key}`);
                    resolve(false);
                };
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
                const request = store.delete(key);

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    },

    /**
     * Memadam cache yang bermula dengan kata kunci tertentu (Cth: 'pencapaian_')
     * Sangat berguna untuk 'Invalidation' selepas rekod baharu ditambah
     * @param {string} prefix Permulaan kunci cache
     */
    async invalidateByPrefix(prefix) {
        try {
            const db = await this.initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.openCursor();

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        if (cursor.key.startsWith(prefix)) {
                            cursor.delete();
                        }
                        cursor.continue();
                    } else {
                        resolve(true); // Selesai
                    }
                };

                request.onerror = () => resolve(false);
            });
        } catch (error) {
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
                const request = store.clear();

                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    }
};