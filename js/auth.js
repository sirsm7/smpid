/**
 * AUTHENTICATION CONTROLLER
 * Menguruskan interaksi UI untuk halaman log masuk.
 * Menggunakan: AuthService, toggleLoading
 */

import { AuthService } from './services/auth.service.js';
import { toggleLoading } from './core/helpers.js';
import { APP_CONFIG } from './config/app.config.js';

// Bind event listeners bila DOM sedia
document.addEventListener('DOMContentLoaded', () => {
    // Bersihkan sesi lama
    sessionStorage.clear();
    // Halang butang 'Back'
    window.history.replaceState(null, null, window.location.href);
    console.log("🔒 [Auth] Sesi dibersihkan.");

    // Auto-detect Kod Sekolah dari URL (?kod=M030)
    const params = new URLSearchParams(window.location.search);
    const kod = params.get('kod');
    if (kod) {
        const titleEl = document.getElementById('loginTitle');
        if (titleEl) titleEl.innerHTML = `LOG MASUK <span class="text-primary">${kod.toUpperCase()}</span>`;
    }
});

// Fungsi Toggle Password (UI Sahaja)
window.togglePass = function() {
    const input = document.getElementById('inputPassword');
    const icon = document.getElementById('iconEye');
    
    if (!input || !icon) return;

    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

// Fungsi Proses Login
window.prosesLogin = async function() {
    const inputEmail = document.getElementById('inputEmail');
    const inputPass = document.getElementById('inputPassword');
    const btnLogin = document.querySelector('button[onclick="prosesLogin()"]');
    
    if (!inputEmail || !inputPass) return;

    const email = inputEmail.value.trim();
    const password = inputPass.value.trim();

    if (!email || !password) { 
        Swal.fire('Ralat', 'Sila masukkan emel dan kata laluan.', 'warning'); 
        return; 
    }

    if (btnLogin) btnLogin.disabled = true;
    toggleLoading(true);

    try {
        // Panggil Service (Backend Logic)
        const user = await AuthService.login(email, password);

        // Simpan Sesi (Frontend Logic)
        sessionStorage.setItem(APP_CONFIG.SESSION.USER_KOD, user.kod_sekolah);
        sessionStorage.setItem(APP_CONFIG.SESSION.USER_ROLE, user.role);
        sessionStorage.setItem(APP_CONFIG.SESSION.USER_ID, user.id);

        toggleLoading(false);
        if (btnLogin) btnLogin.disabled = false;

        // Redirect Logic
        if (user.role === 'ADMIN' || user.role === 'PPD_UNIT') {
            sessionStorage.setItem(APP_CONFIG.SESSION.AUTH_FLAG, 'true');
            
            let welcomeTitle = (user.role === 'PPD_UNIT') ? 'Akses Unit PPD' : 'Admin Disahkan';
            let welcomeMsg = (user.role === 'PPD_UNIT') ? 'Log masuk sebagai Unit PPD.' : 'Selamat kembali, Admin PPD.';

            Swal.fire({
                icon: 'success', 
                title: welcomeTitle, 
                text: welcomeMsg,
                timer: 800, 
                showConfirmButton: false
            }).then(() => {
                window.location.replace('admin.html');
            });
        } else {
            // Sekolah
            sessionStorage.setItem(APP_CONFIG.SESSION.AUTH_FLAG, 'false'); 
            Swal.fire({
                icon: 'success', 
                title: 'Log Masuk Berjaya', 
                text: `Kod Sekolah: ${user.kod_sekolah}`,
                timer: 800, 
                showConfirmButton: false
            }).then(() => {
                window.location.replace('user.html'); 
            });
        }

    } catch (err) {
        toggleLoading(false);
        if (btnLogin) btnLogin.disabled = false;
        
        console.error("Login Error:", err);
        Swal.fire('Gagal', err.message || 'Ralat sistem.', 'error');
    }
};