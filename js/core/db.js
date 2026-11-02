/**
 * SMPID DATABASE CORE
 * Menguruskan inisialisasi Supabase Client melalui Cloudflare Edge Proxy.
 * Mengelakkan pendedahan kunci API terus ke pelayar dan menyediakan mekanisme anti-crash.
 */

import { APP_CONFIG } from '../config/app.config.js';

let supabaseInstance = null;

/**
 * Menginisialisasi dan mengembalikan klien Supabase singleton.
 * Mengelakkan kemalangan aplikasi sekiranya pustaka CDN disekat.
 */
export function getDatabaseClient() {
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