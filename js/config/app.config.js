/**
 * @file app.config.js
 * @description Core application configuration constants and default values.
 * @module AppConfig
 */

export const APP_CONFIG = {
    APP_NAME: 'Sistem Maklumat Pendidikan Islam Daerah (SMPID)',
    APP_VERSION: '1.0.0',
    
    // Default values for system initializations, user creation, and resets
    DEFAULTS: {
        // Kemaskini: Kata laluan lalai baharu untuk sistem
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
Object.freeze(APP_CONFIG.DEFAULTS);
Object.freeze(APP_CONFIG.DB_TABLES);
Object.freeze(APP_CONFIG.PAGINATION);
Object.freeze(APP_CONFIG.UPLOADS);
Object.freeze(APP_CONFIG.ALERTS);