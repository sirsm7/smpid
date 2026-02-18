/**
 * SMPID CORE UTILITIES (js/utils.js)
 * Versi: 2.3 (Full Production & Cross-Tab Support)
 * Fungsi: Konfigurasi Supabase, Helper Global & Keselamatan Sesi
 * * UPDATE V2.3:
 * 1. Migrasi DENO_API_URL ke domain utama (smpid.ppdag.deno.net).
 * 2. Penukaran sessionStorage ke localStorage bagi menyokong integriti silang tab.
 * 3. Pembaikan logik pembersihan sesi semasa log keluar.
 */

// ==========================================
// 1. KONFIGURASI PUSAT (Global Window)
// ==========================================
window.SUPABASE_URL = 'https://app.tech4ag.my';
window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYzMzczNjQ1LCJleHAiOjIwNzg3MzM2NDV9.vZOedqJzUn01PjwfaQp7VvRzSm4aRMr21QblPDK8AoY';

// Domain baharu untuk integrasi Bot Telegram & API Deno
window.DENO_API_URL = 'https://smpid.ppdag.deno.net';

// ==========================================
// 2. INISIALISASI SUPABASE
// ==========================================
let supabaseClient;
if (window.supabase) {
    try {
        supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        console.log("✅ Supabase Client Ready (Utils v2.3)");
    } catch (e) {
        console.error("❌ Gagal memulakan Supabase Client:", e);
    }
} else {
    console.error("❌ Ralat: Library Supabase tidak dikesan. Pastikan CDN diletakkan di <head>.");
}

// Akses global untuk modul legasi
window.supabaseClient = supabaseClient;

// ==========================================
// 3. UI HELPER (LOADING & FORMATTING)
// ==========================================

/**
 * Mengawal paparan overlay pemuatan (loading)
 * @param {boolean} show - Papar jika true
 */
function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}

/**
 * Membersihkan format nombor telefon kepada standard +60
 * @param {string} phone 
 */
function cleanPhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return "";
    if (cleaned.startsWith('0')) cleaned = '6' + cleaned;
    return cleaned;
}

/**
 * Format input telefon secara masa-nyata (Real-time)
 * @param {HTMLInputElement} input 
 */
function autoFormatPhone(input) {
    if (!input) return;
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length < 5) return;
    
    if (val.startsWith('60')) input.value = '+' + val;
    else if (val.startsWith('0')) input.value = '+6' + val;
    else input.value = '+6' + val;
}

/**
 * Pengesahan domain emel rasmi DELIMa
 */
function checkEmailDomain(email) {
    return email && email.toLowerCase().includes("@moe-dl.edu.my");
}

/**
 * Menukar teks kepada format Ayat (Sentence Case)
 */
function formatSentenceCase(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/(?:^|[\.\!\?]\s+)([a-z])/g, function(match) {
        return match.toUpperCase();
    });
}

/**
 * Menjana pautan pantas ke WhatsApp Web/App
 */
function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej automatik SMPID.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// ==========================================
// 4. KESELAMATAN & PENGURUSAN SESI
// ==========================================

/**
 * Menyemak kebenaran akses halaman berdasarkan status log masuk
 * Menggunakan localStorage untuk memastikan sesi kekal dalam tab baharu
 */
function runSecurityCheck() {
    const bodyId = document.body.id;
    
    // Ambil data dari localStorage (Migration dari sessionStorage)
    const isAuth = localStorage.getItem('smpid_auth') === 'true';
    const userKod = localStorage.getItem('smpid_user_kod');

    // Senarai halaman yang memerlukan perlindungan akses
    const protectedPages = ['page-user', 'page-admin'];

    if (protectedPages.includes(bodyId)) {
        if (!isAuth && (!userKod || userKod === 'null')) {
            console.warn("🔒 Akses Tanpa Izin: Sesi tidak dikesan. Mengalih ke Portal...");
            window.location.replace('index.html');
        } else {
            console.log(`✅ Sesi Sah: ${userKod || 'PENTADBIR'}`);
        }
    }
}

/**
 * Menghapuskan semua data sesi dan kembali ke halaman utama
 */
function keluarSistem() {
    Swal.fire({
        title: 'Log Keluar?', 
        text: 'Anda perlu log masuk semula untuk mengakses sistem.',
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444', 
        confirmButtonText: 'Ya, Log Keluar',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then((result) => {
        if (result.isConfirmed) {
            // Bersihkan kedua-dua storan untuk keselamatan
            localStorage.clear();
            sessionStorage.clear();
            window.location.replace('index.html');
        }
    });
}

// ==========================================
// 5. GLOBAL INITIALIZATION & EXPORTS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    runSecurityCheck();
});

// Menangani isu navigasi butang 'Back' pelayar
window.addEventListener('pageshow', function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        runSecurityCheck();
    }
});

// Mengeksport fungsi ke skop global window (Kritikal untuk onclick HTML)
window.toggleLoading = toggleLoading;
window.cleanPhone = cleanPhone;
window.autoFormatPhone = autoFormatPhone;
window.checkEmailDomain = checkEmailDomain;
window.formatSentenceCase = formatSentenceCase;
window.generateWhatsAppLink = generateWhatsAppLink;
window.keluarSistem = keluarSistem;
window.runSecurityCheck = runSecurityCheck;