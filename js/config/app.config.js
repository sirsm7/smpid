/**
 * SMPID CONFIGURATION MODULE
 * Pusat kawalan untuk pembolehubah persekitaran dan tetapan global.
 * UPDATE V2.0: Menambah pemetaan kod PPD (PPD_MAPPING) bagi menyokong akses pelbagai daerah.
 */

export const APP_CONFIG = {
    // Supabase Credentials
    SUPABASE: {
        URL: 'https://app.tech4ag.my',
        // Kunci awam (anon key) dari persekitaran produksi
        KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY'
    },

    // External Services (Telegram Bot & Edge Functions)
    API: {
        DENO_URL: 'https://smpid.ppdag.deno.net',
        // Integrasi Google Apps Script untuk Email Blaster
        GAS_EMAIL_URL: 'https://script.google.com/macros/s/AKfycbxGWS7aa1pH8A_8KZjhqz9wCv8xcOsTQekc_H3zriwNWYl4P1N-BlWlPQagPYEwS4HX/exec',
        // Integrasi Google Apps Script untuk Upload Fail Bukti
        GAS_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbw1gV5IniPgCY69RafvNTKe6ZOF2eP9twIQT1Fidj84wmCPD4d-iUyjkVQDsDap6aTP/exec'
    },

    // Session Keys (Kekunci storan lokal untuk konsistensi data)
    SESSION: {
        USER_KOD: 'smpid_user_kod',
        USER_ROLE: 'smpid_user_role',
        USER_ID: 'smpid_user_id',
        AUTH_FLAG: 'smpid_auth',
        ACTIVE_SCHOOL: 'smpid_active_school_code'
    },

    // Nilai Lalai Sistem
    DEFAULTS: {
        PASSWORD: 'ppdag@12345'
    },

    // Pemetaan Kod PPD Daerah Negeri Melaka
    PPD_MAPPING: {
        'M010': 'JASIN',
        'M020': 'MELAKA TENGAH',
        'M030': 'ALOR GAJAH'
    }
};