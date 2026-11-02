/**
 * @file app.config.js
 * @description Core application configuration constants, database definitions, and IndexedDB caching parameters.
 * @module AppConfig
 * 
 * Kemaskini V3.4 (IndexedDB Resilient Architecture):
 * - Menambah pengisytiharan konfigurasi storan IndexedDB berpusat (IDB_CONFIG).
 * - Menetapkan kunci penjejakan versi aplikasi (APP_VERSION_KEY) untuk automasi migrasi skema.
 * - Memelihara get laluan songsang Cloudflare Edge (/api) tanpa pendedahan kelayakan terbuka.
 */

export const APP_CONFIG = {
    APP_NAME: 'Nadi Analitik, Digital & Inovasi Melaka (NaDIM)',
    APP_VERSION: '2.6.0',
    
    // Had Berpusat Paparan Baris Jadual Pentadbir (Maksimum 50 baris untuk render DOM pantas)
    ADMIN_TABLE_LIMIT: 50,
    
    // Konfigurasi Pangkalan Data Tempatan IndexedDB (Resilient Client Storage)
    IDB: {
        DB_NAME: 'nadim_storage_v2',
        DB_VERSION: 1,
        CACHE_TTL_MS: 86400000, // 24 jam (tempoh hayat data sebelum semakan delta)
        STORES: {
            SCHOOLS: 'schools_cache',
            ACHIEVEMENTS: 'achievements_cache',
            META: 'system_meta'
        }
    },

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

    // Kunci Sesi LocalStorage (Untuk Integriti Auth & Penjejakan Versi Cache)
    SESSION: {
        AUTH_FLAG: 'smpid_auth',
        USER_ROLE: 'smpid_user_role',
        USER_KOD: 'smpid_user_kod',
        USER_ID: 'smpid_user_id',
        ACTIVE_SCHOOL: 'smpid_active_school',
        APP_VERSION_KEY: 'smpid_app_version',
        LAST_SYNC_KEY: 'smpid_last_sync'
    },

    // Pemetaan Daerah (Untuk RBAC & Filter Sistem)
    PPD_MAPPING: {
        'M010': 'JASIN',
        'M020': 'MELAKA TENGAH',
        'M030': 'ALOR GAJAH'
    },

    // Nilai Lalai Permulaan Sistem
    DEFAULTS: {
        PASSWORD: 'jpnmel@12345', 
        AVATAR_URL: 'assets/img/default-avatar.png',
        ROLE: 'user',
        PPD: 'Alor Gajah',
        STATUS: 'active'
    },

    // Definisi Nama Jadual Supabase
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

    // Parameter Penomboran Halaman (Pagination)
    PAGINATION: {
        ITEMS_PER_PAGE: 10,
        MAX_PAGES_SHOWN: 5,
        ADMIN_TABLE_LIMIT: 50
    },

    // Had Keselamatan Muat Naik Fail
    UPLOADS: {
        MAX_FILE_SIZE_MB: 5,
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
        ALLOWED_DOC_TYPES: [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
    },
    
    // Tetapan Masa Makluman SweetAlert
    ALERTS: {
        TIMER_SHORT: 1500,
        TIMER_NORMAL: 3000,
        TIMER_LONG: 5000
    }
};

// Penguatkuasaan Deep Freeze bagi menghalang mutasi runtime
Object.freeze(APP_CONFIG);
Object.freeze(APP_CONFIG.IDB);
Object.freeze(APP_CONFIG.IDB.STORES);
Object.freeze(APP_CONFIG.SUPABASE);
Object.freeze(APP_CONFIG.API);
Object.freeze(APP_CONFIG.SESSION);
Object.freeze(APP_CONFIG.PPD_MAPPING);
Object.freeze(APP_CONFIG.DEFAULTS);
Object.freeze(APP_CONFIG.DB_TABLES);
Object.freeze(APP_CONFIG.PAGINATION);
Object.freeze(APP_CONFIG.UPLOADS);
Object.freeze(APP_CONFIG.ALERTS);