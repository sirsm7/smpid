/**
 * @file app.config.js
 * @description Core application configuration constants and default values.
 * @module AppConfig
 * 
 * Kemaskini V3.3:
 * - Menghapuskan URL terus dan anon key Supabase yang terdedah secara terbuka.
 * - Mengalihkan endpoint pangkalan data kepada laluan proksi tempatan Cloudflare Pages (`/api`).
 * - Menyokong perlindungan kunci persekitaran (Environment Variables) tanpa mendedahkan kelayakan asal kepada klien.
 */

export const APP_CONFIG = {
    APP_NAME: 'Nadi Analitik, Digital & Inovasi Melaka (NaDIM)',
    APP_VERSION: '2.5.0',
    
    // Had Berpusat Paparan Baris Jadual Pentadbir (Maksimum 50 baris untuk render DOM pantas)
    ADMIN_TABLE_LIMIT: 50,
    
    // Konfigurasi Pangkalan Data Supabase (Dilindungi melalui Cloudflare Edge Reverse Proxy)
    SUPABASE: {
        URL: typeof window !== 'undefined' && window.SUPABASE_URL ? window.SUPABASE_URL : (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api'),
        KEY: typeof window !== 'undefined' && window.SUPABASE_KEY ? window.SUPABASE_KEY : 'edge-proxy-managed'
    },

    // Konfigurasi API & Endpoint (Deno Bot & GAS Microservices)
    API: {
        DENO_URL: typeof window !== 'undefined' && window.DENO_API_URL ? window.DENO_API_URL : 'https://smpid.ppdag.deno.net',
        GAS_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbyjmVnKMNa5KSSCdIWG00dmgrYFBsfRtkswlBXTZUL0cKJ8h15V3X71EsqGd4B1etdg/exec',
        GAS_EMAIL_URL: 'https://script.google.com/macros/s/AKfycbwALQrAcEO156fXzNim_8New_iOFFUHvPL5wOhILpJDMxB80_-4BhiK1x3UbNeK6_IrCg/exec',
        GAS_LIBAT_URUS_URL: 'https://script.google.com/macros/s/AKfycbyIXpHGIm5kdXl2ecRG4c-JE99vcfC5xjfbvZMko0ab2cKuBRL1HDb1CFGmTLOUBFLJ/exec'
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
        SETTINGS: 'smpid_settings',
        LIBAT_URUS: 'smpid_libat_urus'
    },

    // Pagination defaults for data tables and lists
    PAGINATION: {
        ITEMS_PER_PAGE: 10,
        MAX_PAGES_SHOWN: 5,
        ADMIN_TABLE_LIMIT: 50
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