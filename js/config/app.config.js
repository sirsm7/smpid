/**
 * SMPID CONFIGURATION MODULE
 * Pusat kawalan untuk pembolehubah persekitaran dan tetapan global.
 * Versi: 1.2 (URL API Dikemaskini)
 */

export const APP_CONFIG = {
    // Supabase Credentials (Production)
    SUPABASE: {
        URL: 'https://app.tech4ag.my',
        // Kunci awam (anon key)
        KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY'
    },

    // External Services (Deno Deploy)
    API: {
        // DIKEMASKINI: URL baharu untuk bot Telegram & API servis
        DENO_URL: 'https://smpid.ppdag.deno.net'
    },

    // Session Keys (LocalStorage)
    SESSION: {
        USER_KOD: 'smpid_user_kod',
        USER_ROLE: 'smpid_user_role',
        USER_ID: 'smpid_user_id',
        AUTH_FLAG: 'smpid_auth',
        ACTIVE_SCHOOL: 'smpid_active_school_code'
    },

    // Default Values
    DEFAULTS: {
        PASSWORD: 'ppdag@12345'
    }
};