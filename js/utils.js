// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = 'https://hbanvnteyncwsnfprahz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IEcWCbBmqWLBOBU4rl0FPw_Z97Assvt';
const ADMIN_PIN = "pkgag";

// Inisialisasi Klien (Singleton)
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase Client Initialized via utils.js");
} else {
    console.error("Library Supabase tidak dimuatkan! Pastikan tag script CDN ada di HTML.");
}

// --- FUNGSI BANTUAN ---

function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

function cleanPhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return "";
    if (cleaned.startsWith('0')) cleaned = '6' + cleaned;
    return cleaned;
}

function autoFormatPhone(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length < 5) return;
    if (val.startsWith('60')) input.value = '+' + val;
    else if (val.startsWith('0')) input.value = '+6' + val;
    else input.value = '+6' + val;
}

function checkEmailDomain(email) {
    return email.includes("@moe-dl.edu.my");
}

function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej yang di jana secara automatik dari sistem.\n\nMohon kerjasama cikgu untuk aktifkan id tele di bot SMPID. Sila klik https://t.me/smpid_bot klik Start atau hantar /start, kemudian masukkan kod sekolah anda dan pilih peranan.\n\nBot akan rekodkan id telegram anda ke dalam sistem SMPID. Terima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}