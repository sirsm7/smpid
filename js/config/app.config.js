/**
 * @file app.config.js
 * @description Core application configuration constants and default values.
 * @module AppConfig
 */

export const APP_CONFIG = {
    APP_NAME: 'Sistem Maklumat Pendidikan Islam Daerah (SMPID)',
    APP_VERSION: '2.5.0',
    
    // Konfigurasi Pangkalan Data Supabase (Data dirujuk dari utils.js sebagai fallback)
    SUPABASE: {
        URL: typeof window !== 'undefined' && window.SUPABASE_URL ? window.SUPABASE_URL : 'https://app.tech4ag.my',
        KEY: typeof window !== 'undefined' && window.SUPABASE_KEY ? window.SUPABASE_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY'
    },

    // Konfigurasi API & Endpoint (Deno Bot & GAS Microservices)
    API: {
        DENO_URL: typeof window !== 'undefined' && window.DENO_API_URL ? window.DENO_API_URL : 'https://smpid.ppdag.deno.net',
        GAS_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbyjmVnKMNa5KSSCdIWG00dmgrYFBsfRtkswlBXTZUL0cKJ8h15V3X71EsqGd4B1etdg/exec', // Gantikan dengan URL GAS Upload yang sah jika perlu
        GAS_EMAIL_URL: 'https://script.google.com/macros/s/AKfycbwALQrAcEO156fXzNim_8New_iOFFUHvPL5wOhILpJDMxB80_-4BhiK1x3UbNeK6_IrCg/exec'   // Gantikan dengan URL GAS Email yang sah jika perlu
    },

    // Kunci Sesi LocalStorage (Untuk Integriti Auth)
    SESSION: {
        AUTH_FLAG: 'smpid_auth',
        USER_ROLE: 'smpid_user_role',
        USER_KOD: 'smpid_user_kod',
        USER_ID: 'smpid_user_id',
        ACTIVE_SCHOOL: 'smpid_active_school'
    },

    // Pemetaan Daerah (Untuk RBAC & Filter Sistem)
    PPD_MAPPING: {
        'M010': 'JASIN',
        'M020': 'MELAKA TENGAH',
        'M030': 'ALOR GAJAH'
    },

    // Default values for system initializations, user creation, and resets
    DEFAULTS: {
        PASSWORD: 'jpnmel@12345', 
        AVATAR_URL: 'assets/img/default-avatar.png',
        ROLE: 'user',
        PPD: 'Alor Gajah',
        STATUS: 'active'
    },

    // API & Database Configurations (Table definitions for Supabase)
    DB_TABLES: {
        USERS: 'smpid_users',
        SCHOOLS: 'smpid_schools',
        ACHIEVEMENTS: 'smpid_achievements',
        GALLERY: 'smpid_gallery',
        BOOKINGS: 'smpid_bookings',
        PENATARAN: 'smpid_penataran',
        SETTINGS: 'smpid_settings'
    },

    // Pagination defaults for data tables and lists
    PAGINATION: {
        ITEMS_PER_PAGE: 10,
        MAX_PAGES_SHOWN: 5
    },

    // File upload limits and security parameters
    UPLOADS: {
        MAX_FILE_SIZE_MB: 5,
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
        ALLOWED_DOC_TYPES: [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
    },
    
    // UI/UX Notification settings (SweetAlert defaults)
    ALERTS: {
        TIMER_SHORT: 1500,
        TIMER_NORMAL: 3000,
        TIMER_LONG: 5000
    }
};

// Deep freeze the configuration object to prevent accidental runtime mutations
Object.freeze(APP_CONFIG);
Object.freeze(APP_CONFIG.SUPABASE);
Object.freeze(APP_CONFIG.API);
Object.freeze(APP_CONFIG.SESSION);
Object.freeze(APP_CONFIG.PPD_MAPPING);
Object.freeze(APP_CONFIG.DEFAULTS);
Object.freeze(APP_CONFIG.DB_TABLES);
Object.freeze(APP_CONFIG.PAGINATION);
Object.freeze(APP_CONFIG.UPLOADS);
Object.freeze(APP_CONFIG.ALERTS);