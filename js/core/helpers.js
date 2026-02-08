/**
 * SMPID HELPER UTILITIES
 * Fungsi bantuan umum untuk manipulasi data dan UI.
 */

/**
 * Papar atau Sembunyi Overlay Loading
 * @param {boolean} show - True untuk papar, False untuk sembunyi
 */
export function toggleLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}

/**
 * Bersihkan format nombor telefon (Buang sengkang, tambah 6)
 * @param {string} phone 
 * @returns {string}
 */
export function cleanPhone(phone) {
    if (!phone) return "";
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 0) return "";
    if (cleaned.startsWith('0')) cleaned = '6' + cleaned;
    return cleaned;
}

/**
 * Format input telefon secara automatik semasa menaip (Event Handler)
 * @param {HTMLInputElement} input 
 */
export function autoFormatPhone(input) {
    if (!input) return;
    let val = input.value.replace(/[^0-9]/g, '');
    if (val.length < 5) return;
    
    // Pastikan format +60...
    if (val.startsWith('60')) input.value = '+' + val;
    else if (val.startsWith('0')) input.value = '+6' + val;
    else input.value = '+6' + val;
}

/**
 * Tukar teks jadi Sentence Case (Huruf besar selepas titik)
 * @param {string} str 
 * @returns {string}
 */
export function formatSentenceCase(str) {
    if (!str) return "";
    return str.replace(/(?:^|[\.\!\?]\s+)([a-z])/g, function(match) {
        return match.toUpperCase();
    });
}

/**
 * Semak domain emel (moe-dl.edu.my sahaja)
 * @param {string} email 
 * @returns {boolean}
 */
export function checkEmailDomain(email) {
    return email && email.includes("@moe-dl.edu.my");
}

/**
 * Jana pautan WhatsApp
 * @param {string} nama 
 * @param {string} noTel 
 * @param {boolean} isRaw 
 * @returns {string|null}
 */
export function generateWhatsAppLink(nama, noTel, isRaw = false) {
    const cleanNum = cleanPhone(noTel);
    if (!cleanNum) return null;
    
    if (isRaw) return `https://wa.me/${cleanNum}`;
    
    const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ''}, ini adalah mesej automatik SMPID.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
    return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

/**
 * Fungsi Log Keluar Global
 */
export function keluarSistem() {
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
            window.location.replace('index.html');
        }
    });
}

// Expose ke global window untuk keserasian HTML `onclick="..."` legacy
window.toggleLoading = toggleLoading;
window.autoFormatPhone = autoFormatPhone;
window.cleanPhone = cleanPhone;
window.generateWhatsAppLink = generateWhatsAppLink;
window.formatSentenceCase = formatSentenceCase;
window.keluarSistem = keluarSistem;