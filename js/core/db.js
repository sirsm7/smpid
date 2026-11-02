/**
 * @file js/core/db.js
 * @description Core Database Client (Supabase Singleton & Local Cache Synchronizer)
 * Menguruskan inisialisasi Supabase Client melalui Cloudflare Edge Proxy (/api)
 * serta mengintegrasikan penyegerakan awal enjin storan tempatan IndexedDB.
 * @module DatabaseCore
 */

import { APP_CONFIG } from '../config/app.config.js';
import { IDBCache } from './idb.js';

let supabaseInstance = null;
let idbInitialized = false;

/**
 * Memulakan penyegerakan awal cache tempatan IndexedDB di latar belakang
 */
function ensureStorageLayer() {
    if (idbInitialized) return;
    idbInitialized = true;
    try {
        IDBCache.initDB().catch(err => {
            console.warn('[Core DB] Peringatan inisialisasi storan tempatan:', err);
        });
    } catch (e) {
        console.warn('[Core DB] Ralat pembukaan storan tempatan:', e);
    }
}

/**
 * Menginisialisasi dan mengembalikan klien Supabase singleton.
 * Mengelakkan kemalangan aplikasi sekiranya pustaka CDN disekat.
 */
export function getDatabaseClient() {
    ensureStorageLayer();

    if (supabaseInstance) {
        return supabaseInstance;
    }

    if (typeof window === 'undefined' || typeof window.supabase === 'undefined') {
        console.error("CRITICAL: window.supabase is undefined. Network blocker or CDN failure detected.");
        return null;
    }

    try {
        supabaseInstance = window.supabase.createClient(
            APP_CONFIG.SUPABASE.URL,
            APP_CONFIG.SUPABASE.KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false
                }
            }
        );
    } catch (error) {
        console.error("❌ [Core] Supabase Init Error:", error);
        return null;
    }

    return supabaseInstance;
}

/**
 * Pembantu untuk memastikan sambungan pangkalan data telah sedia sebelum pertanyaan dijalankan.
 */
export function requireDb() {
    const db = getDatabaseClient();

    if (!db) {
        throw new Error("Sambungan Pangkalan Data Disekat. Sila matikan AdBlocker atau periksa sambungan internet anda.");
    }
    return db;
}