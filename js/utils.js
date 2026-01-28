/**
 * SMPID CORE UTILITIES (js/utils.js)
 * Versi: 2.2 (Global Window Fix)
 * Fungsi: Konfigurasi Supabase, Helper Global & Keselamatan
 */

// ==========================================
// 1. KONFIGURASI PUSAT (Guna window untuk elak konflik)
// ==========================================
// Kita lekatkan variable ini ke window supaya boleh diakses oleh user.js dan admin.js
// tanpa perlu mengisytiharkan semula (yang menyebabkan error).
window.SUPABASE_URL = 'https://app.tech4ag.my';
window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';
window.DENO_API_URL = 'https://smpid-40.ppdag.deno.net';

// ==========================================
// 2. INISIALISASI SUPABASE
// ==========================================
let supabaseClient;
if (window.supabase) {
    // Gunakan window config yang baru didefinisikan di atas
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    console.log("✅ Supabase Client Ready (Utils v2.2)");
} else {
    console.error("❌ Ralat: Library Supabase tidak dimuatkan. Pastikan CDN diletakkan di <head>.");
}

// Expose client ke window supaya modul lain boleh guna (window.supabaseClient)
window.supabaseClient = supabaseClient;

// ==========================================
// 3. UI HELPER (LOADING & FORMATTING)
// ==========================================

/**
 * Papar/Sembunyi Overlay Loading
 * @param {boolean} show - True untuk papar, False untuk sembunyi
 */
function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}

/**
 * Bersihkan format nombor telefon (Buang sengkang, tambah 6)
 */
function cleanPhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return "";
    if (cleaned.startsWith('0')) cleaned = '6' + cleaned;
    return cleaned;
}

/**
 * Format input telefon secara automatik semasa menaip
 * @param {HTMLInputElement} input - Element input
 */
function autoFormatPhone(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length < 5) return;
    
    // Pastikan format +60...
    if (val.startsWith('60')) input.value = '+' + val;
    else if (val.startsWith('0')) input.value = '+6' + val;
    else input.value = '+6' + val;
}

/**
 * Semak domain emel (moe-dl.edu.my sahaja)
 */
function checkEmailDomain(email) {
    return email && email.includes("@moe-dl.edu.my");
}

/**
 * Tukar teks jadi Sentence Case (Huruf besar selepas titik)
 */
function formatSentenceCase(str) {
    if (!str) return "";
    return str.replace(/(?:^|[\.\!\?]\s+)([a-z])/g, function(match) {
        return match.toUpperCase();
    });
}

/**
 * Jana pautan WhatsApp (Raw atau dengan Template Mesej)
 */
function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej automatik SMPID.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// ==========================================
// 4. KESELAMATAN & SESI (SECURITY)
// ==========================================

/**
 * Semak Sesi Pengguna
 * Dijalankan automatik pada 'DOMContentLoaded' & 'pageshow'
 */
function runSecurityCheck() {
    const bodyId = document.body.id;
    const isAuth = sessionStorage.getItem('smpid_auth') === 'true';
    const userKod = sessionStorage.getItem('smpid_user_kod');

    // Jika di halaman User/Admin tapi tiada sesi, tendang keluar
    if ((bodyId === 'page-user' || bodyId === 'page-admin') && !isAuth && !userKod) {
        console.warn("🔒 Akses Tanpa Izin dikesan. Mengalih ke Login...");
        window.location.replace('index.html');
    }
}

/**
 * Fungsi Log Keluar Global
 */
function keluarSistem() {
    Swal.fire({
        title: 'Log Keluar?', 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33', 
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.clear();
            sessionStorage.removeItem('smpid_user_kod');
            sessionStorage.removeItem('smpid_auth');
            window.location.replace('index.html');
        }
    });
}

// ==========================================
// 5. GLOBAL EVENT LISTENERS & EXPORTS
// ==========================================

// Jalankan semakan keselamatan sebaik sahaja DOM sedia
document.addEventListener('DOMContentLoaded', () => {
    runSecurityCheck();
});

// Jalankan semakan jika pengguna tekan butang 'Back' browser (BFCache)
window.addEventListener('pageshow', function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        runSecurityCheck();
    }
});

// PENTING: Bind semua fungsi ke objek window supaya boleh dipanggil dalam HTML (onclick)
// Ini menyelesaikan masalah "function is not defined"
window.toggleLoading = toggleLoading;
window.cleanPhone = cleanPhone;
window.autoFormatPhone = autoFormatPhone;
window.checkEmailDomain = checkEmailDomain;
window.formatSentenceCase = formatSentenceCase;
window.generateWhatsAppLink = generateWhatsAppLink;
window.keluarSistem = keluarSistem;