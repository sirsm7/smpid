/**
 * SMPID AUTH BRIDGE (FIXED v2)
 * Fungsi: Memastikan modul dalam sub-folder hanya boleh diakses
 * jika pengguna telah log masuk melalui SMPID utama.
 */

(function() {
    // 1. Ambil data sesi
    const userKod = sessionStorage.getItem('smpid_user_kod');
    
    // 2. Semakan Keselamatan
    // Kita hanya perlu pastikan 'userKod' wujud dan tidak kosong.
    // Kita TIDAK BOLEH bergantung pada 'smpid_auth' == 'true' kerana 
    // dalam sistem SMPID, 'smpid_auth'='false' bermaksud User Sekolah yang sah.
    
    if (!userKod || userKod === 'null' || userKod === 'undefined') {
        console.warn("⛔ Akses Tanpa Izin ke Modul. Tiada Kod Sekolah dikesan.");
        
        // Peringatan mesra sebelum redirect
        alert("Sila log masuk melalui Portal SMPID dahulu.");
        
        // Redirect ke root (naik 2 level dari /modules/nama_modul/)
        window.location.href = '../../index.html';
    } else {
        // Akses Dibenarkan
        console.log("✅ Akses Modul Dibenarkan untuk: " + userKod);
    }
})();