/**
 * SMPID DATABASE CORE
 * Menguruskan sambungan ke Supabase Client.
 * Refactored: Anti-Crash Mechanism dengan Amaran UI.
 */

import { APP_CONFIG } from '../config/app.config.js';

let supabaseInstance = null;

/**
 * Menginisialisasi dan mengembalikan klien Supabase.
 * Mengelakkan 'Crash' jika CDN disekat.
 */
export function getDatabaseClient() {
    // 1. Return existing instance if available (Singleton)
    if (supabaseInstance) {
        return supabaseInstance;
    }

    // 2. Check if window.supabase exists (CDN Loaded)
    if (typeof window.supabase === 'undefined') {
        // Jangan crash terus, return null dan biar 'requireDb' handle error message
        console.error("CRITICAL: window.supabase is undefined. Network blocker detected.");
        return null;
    }

    // 3. Create new instance
    try {
        supabaseInstance = window.supabase.createClient(
            APP_CONFIG.SUPABASE.URL,
            APP_CONFIG.SUPABASE.KEY
        );
    } catch (error) {
        console.error("❌ [Core] Supabase Init Error:", error);
        return null;
    }

    return supabaseInstance;
}

// Helper untuk memastikan DB wujud sebelum query
export function requireDb() {
    const db = getDatabaseClient();
    
    if (!db) {
        // Buang error standard, ganti dengan mesej mesra pengguna
        // Ini akan ditangkap oleh try-catch di service layer
        throw new Error("Sambungan Pangkalan Data Disekat. Sila matikan AdBlocker atau tukar rangkaian internet anda.");
    }
    return db;
}