/**
 * SMPID AUTH GUARD
 * Middleware keselamatan untuk menyemak sesi pengguna.
 */

import { APP_CONFIG } from '../config/app.config.js';

export function runSecurityCheck() {
    const isAuth = sessionStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
    const userKod = sessionStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    
    // Tentukan konteks halaman berdasarkan ID body
    const bodyId = document.body.id;

    // Logik 1: Halaman Login & Public (Bebas)
    if (bodyId === 'page-login' || bodyId === 'page-public' || bodyId === 'page-landing') {
        return; // Tiada sekatan
    }

    // Logik 2: Halaman Admin/User (Perlu Sesi)
    // Sesi sah jika 'isAuth' TRUE (Admin) ATAU 'userKod' wujud (User Sekolah)
    const hasValidSession = isAuth || (userKod && userKod !== 'null' && userKod !== 'undefined');

    if (!hasValidSession) {
        console.warn("⛔ [AuthGuard] Akses Tanpa Izin. Mengalih keluar...");
        // Simpan URL asal untuk redirect balik selepas login (Feature masa depan)
        window.location.replace('index.html');
    } else {
        console.log(`✅ [AuthGuard] Akses Dibenarkan: ${userKod || 'ADMIN'}`);
    }
}

// Jalankan semakan serta-merta
runSecurityCheck();