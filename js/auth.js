/**
 * AUTHENTICATION CONTROLLER
 * Menguruskan interaksi UI untuk halaman log masuk.
 * Menggunakan: AuthService, toggleLoading
 * * UPDATE V1.1: Migrasi dari sessionStorage ke localStorage untuk sokongan cross-tab.
 * * UPDATE V1.2: Pembersihan hardcode M030, menyokong UI mod=admin.
 * * UPDATE V1.3: Sokongan laluan log masuk untuk peranan JPNMEL (Akses Negeri).
 */

import { AuthService } from './services/auth.service.js';
import { toggleLoading } from './core/helpers.js';
import { APP_CONFIG } from './config/app.config.js';

// Bind event listeners bila DOM sedia
document.addEventListener('DOMContentLoaded', () => {
    // Bersihkan sesi lama jika masuk ke halaman login
    // Nota: Penggunaan localStorage membolehkan perkongsian sesi antara tab baharu.
    // Namun, jika pengguna sengaja ke login.html, kita anggap mereka ingin memulakan sesi segar.
    localStorage.clear();
    
    // Halang butang 'Back'
    window.history.replaceState(null, null, window.location.href);
    console.log("🔒 [Auth] Sesi localStorage dibersihkan.");

    // Auto-detect Parameter dari URL
    const params = new URLSearchParams(window.location.search);
    const kod = params.get('kod');
    const mod = params.get('mod');
    
    const titleEl = document.getElementById('loginTitle');
    if (titleEl) {
        if (mod === 'admin') {
            titleEl.innerHTML = `<i class="fas fa-user-shield mr-2"></i>LOG MASUK PENTADBIR`;
        } else if (kod) {
            titleEl.innerHTML = `LOG MASUK <span class="text-brand-600">${kod.toUpperCase()}</span>`;
        }
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

        // Simpan Sesi (Guna localStorage untuk sokongan Open in New Tab)
        localStorage.setItem(APP_CONFIG.SESSION.USER_KOD, user.kod_sekolah);
        localStorage.setItem(APP_CONFIG.SESSION.USER_ROLE, user.role);
        localStorage.setItem(APP_CONFIG.SESSION.USER_ID, user.id);

        toggleLoading(false);
        if (btnLogin) btnLogin.disabled = false;

        // Redirect Logic - PPD, JPN & ADMIN
        if (user.role === 'ADMIN' || user.role === 'PPD_UNIT' || user.role === 'SUPER_ADMIN' || user.role === 'JPNMEL') {
            localStorage.setItem(APP_CONFIG.SESSION.AUTH_FLAG, 'true');
            
            let welcomeTitle = 'Admin Disahkan';
            let welcomeMsg = 'Selamat kembali, Admin PPD.';

            if (user.role === 'PPD_UNIT') {
                welcomeTitle = 'Akses Unit PPD';
                welcomeMsg = 'Log masuk sebagai Unit PPD.';
            } else if (user.role === 'SUPER_ADMIN') {
                welcomeTitle = 'Akses Super Admin';
                welcomeMsg = 'Log masuk dengan kuasa penuh.';
            } else if (user.role === 'JPNMEL') {
                welcomeTitle = 'Akses JPN Melaka';
                welcomeMsg = 'Log masuk pentadbir peringkat negeri.';
            }

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
            localStorage.setItem(APP_CONFIG.SESSION.AUTH_FLAG, 'false'); 
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