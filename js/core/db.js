/**
 * SMPID DATABASE CORE
 * Menguruskan sambungan ke Supabase Client.
 */

import { APP_CONFIG } from '../config/app.config.js';

let supabaseInstance = null;

/**
 * Menginisialisasi dan mengembalikan klien Supabase.
 * Memastikan library Supabase telah dimuatkan melalui CDN di HTML.
 */
export function getDatabaseClient() {
    if (supabaseInstance) {
        return supabaseInstance;
    }

    if (typeof window.supabase === 'undefined') {
        console.error("CRITICAL: Supabase library not found. Ensure the CDN script is in <head>.");
        return null;
    }

    try {
        supabaseInstance = window.supabase.createClient(
            APP_CONFIG.SUPABASE.URL,
            APP_CONFIG.SUPABASE.KEY
        );
        console.log("✅ [Core] Supabase Connected.");
    } catch (error) {
        console.error("❌ [Core] Supabase Init Error:", error);
    }

    return supabaseInstance;
}

// Untuk keserasian kod legacy (jika ada yang masih guna window.supabaseClient)
// Kita boleh buang ini setelah semua modul ditukar sepenuhnya.
window.supabaseClient = getDatabaseClient();