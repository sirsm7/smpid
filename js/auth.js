/**
 * SMPID AUTHENTICATION MODULE (js/auth.js)
 * Versi: 2.2 (Added User ID Storage for Password Reset)
 * Fungsi: Logik Log Masuk & Pengurusan Sesi Login dengan Sokongan PPD_UNIT
 * Halaman: index.html
 */

// Pastikan Utils dah load dulu
if (typeof window.supabaseClient === 'undefined') {
    console.error("CRITICAL: Utils.js belum dimuatkan!");
}

document.addEventListener('DOMContentLoaded', () => {
    // Bersihkan sesi lama bila masuk page login
    sessionStorage.clear();
    // Reset history supaya user tak boleh tekan 'Back' untuk masuk semula
    window.history.replaceState(null, null, window.location.href);
    console.log("🔒 Sesi dibersihkan. Sedia untuk log masuk.");
});

/**
 * Papar/Sembunyi Kata Laluan
 */
function togglePass() {
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
}

/**
 * Proses Log Masuk Utama
 */
async function prosesLogin() {
    const inputEmail = document.getElementById('inputEmail');
    const inputPass = document.getElementById('inputPassword');
    const btnLogin = document.querySelector('button[onclick="prosesLogin()"]');
    
    if (!inputEmail || !inputPass) return;

    const email = inputEmail.value.trim().toLowerCase(); 
    const password = inputPass.value.trim();

    // Validasi Input
    if (!email || !password) { 
        Swal.fire('Ralat', 'Sila masukkan emel dan kata laluan.', 'warning'); 
        return; 
    }

    // UI Loading
    if (btnLogin) btnLogin.disabled = true;
    window.toggleLoading(true); // Dari utils.js

    try {
        // Query Database (UPDATE: Tambah 'id' dalam select)
        const { data, error } = await window.supabaseClient
            .from('smpid_users')
            .select('id, kod_sekolah, role, password')
            .eq('email', email)
            .single();
            
        // UI Reset
        window.toggleLoading(false);
        if (btnLogin) btnLogin.disabled = false;

        // Ralat: User Tak Jumpa
        if (error || !data) { 
            Swal.fire('Gagal', 'Emel pengguna tidak ditemui dalam sistem.', 'error'); 
            return; 
        }

        // Ralat: Password Salah
        if (data.password !== password) {
            Swal.fire('Maaf', 'Kata laluan salah.', 'error');
            return;
        }
        
        // LOGIN BERJAYA: Simpan Sesi
        sessionStorage.setItem('smpid_user_kod', data.kod_sekolah);
        sessionStorage.setItem('smpid_user_role', data.role); 
        
        // UPDATE PENTING: Simpan User ID (UUID) untuk fungsi tukar password
        sessionStorage.setItem('smpid_user_id', data.id);
        
        // Redirect Logic
        if (data.role === 'ADMIN' || data.role === 'PPD_UNIT') {
            // Kedua-dua role ini masuk ke admin.html, tapi paparan akan berbeza (diuruskan oleh admin.js)
            sessionStorage.setItem('smpid_auth', 'true');
            
            let welcomeTitle = (data.role === 'PPD_UNIT') ? 'Akses Unit PPD' : 'Admin Disahkan';
            let welcomeMsg = (data.role === 'PPD_UNIT') ? 'Log masuk sebagai Unit PPD.' : 'Selamat kembali, Admin PPD.';

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
            sessionStorage.setItem('smpid_auth', 'false'); 
            Swal.fire({
                icon: 'success', 
                title: 'Log Masuk Berjaya', 
                text: `Kod Sekolah: ${data.kod_sekolah}`,
                timer: 800, 
                showConfirmButton: false
            }).then(() => {
                window.location.replace('user.html'); 
            });
        }

    } catch (err) {
        window.toggleLoading(false); 
        if (btnLogin) btnLogin.disabled = false;
        
        console.error("Login Error:", err);
        Swal.fire('Ralat Sistem', 'Gagal menyambung ke server. Sila cuba sebentar lagi.', 'error');
    }
}

// Expose fungsi ke global scope untuk HTML onclick
window.togglePass = togglePass;
window.prosesLogin = prosesLogin;