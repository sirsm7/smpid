// --- KONFIGURASI SUPABASE ---
const SUPABASE_URL = 'https://hbanvnteyncwsnfprahz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IEcWCbBmqWLBOBU4rl0FPw_Z97Assvt';

// Inisialisasi Klien (Pastikan library supabase dimuatkan di HTML)
let supabaseClient;
if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// PIN Admin (Global)
const ADMIN_PIN = "pkgag";

// --- FUNGSI BANTUAN (UTILITIES) ---

// 1. Bersihkan Nombor Telefon
function cleanPhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return "";
    if (cleaned.startsWith('0')) {
        cleaned = '6' + cleaned;
    }
    return cleaned;
}

// 2. Jana Pautan WhatsApp (Digunakan di Dashboard & Profil)
function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;

    // Jika nak chat biasa sahaja (tanpa teks)
    if (isRaw) {
        return `https://wa.me/${cleanNum}`;
    }

    // Mesej standard (Arahan)
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej yang di jana secara automatik dari sistem.\n\nMohon kerjasama cikgu untuk aktifkan id tele di bot SMPID. Sila klik https://t.me/smpid_bot klik Start atau hantar /start, kemudian masukkan kod sekolah anda dan pilih peranan.\n\nBot akan rekodkan id telegram anda ke dalam sistem SMPID. Terima kasih.`;

    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

// 3. Auto Format Input Telefon (UX)
function autoFormatPhone(input) {
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length < 5) return;
    if (val.startsWith('60')) input.value = '+' + val;
    else if (val.startsWith('0')) input.value = '+6' + val;
    else input.value = '+6' + val;
}

// 4. Semak Domain Emel
function checkEmailDomain(email) {
    return email.includes("@moe-dl.edu.my");
}

// 5. Kawalan Loading Overlay
function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        show ? el.classList.remove('hidden') : el.classList.add('hidden');
    }
}