/**
 * ADMIN MODULE: MAIN CONTROLLER & ROUTER (V2.5.1 - UI FIX)
 * Fungsi: Menguruskan navigasi tab, keselamatan, dan peranan (RBAC).
 * --- UPDATE V2.5.1 ---
 * 1. Pembaikan Bug UI: Menggantikan manipulasi statik className kepada classList
 * bagi memastikan kelas 'hidden' untuk tab sekuriti (cth: Import) tidak tertimpa.
 * 2. Integrasi Modul Import Data Pukal & Sokongan JPNMEL.
 */

import { AuthService } from '../services/auth.service.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- GLOBAL VARIABLES & EXPORTS ---
// Kita bind fungsi ke window supaya boleh dipanggil dari HTML onclick=""
window.switchAdminTab = switchAdminTab;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

/**
 * Inisialisasi Utama
 */
async function initAdminPanel() {
    // 1. Semakan Sesi (Auth Guard)
    // Gunakan localStorage untuk ketahanan antara tab
    const isAuth = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    if (!isAuth) {
        console.warn("⛔ [AdminMain] Sesi tidak sah. Mengalihkan ke landing page...");
        window.location.replace('index.html');
        return;
    }

    // 2. Paparan Label Peranan
    const displayRole = document.getElementById('displayUserRole');
    if(displayRole) {
        if (userRole === 'SUPER_ADMIN') {
            displayRole.innerText = 'SUPER ADMIN';
            displayRole.classList.add('text-red-400', 'font-black'); // Visual Khas
        } else if (userRole === 'JPNMEL') {
            displayRole.innerText = 'JPN MELAKA';
            displayRole.classList.add('text-fuchsia-400', 'font-black'); // Visual Khas JPN
        } else if (userRole === 'PPD_UNIT') {
            displayRole.innerText = 'UNIT PPD';
        } else {
            displayRole.innerText = 'MOD ADMIN';
        }
    }

    // 3. Kawalan Paparan Tab Import Data (Di awalkan ke initialization)
    const importTabBtn = document.getElementById('import-data-tab');
    if (importTabBtn) {
        if (userRole === 'SUPER_ADMIN') {
            importTabBtn.classList.remove('hidden');
        } else {
            importTabBtn.classList.add('hidden');
        }
    }

    // 4. Konfigurasi Modul Mengikut Peranan (Strict Mode)
    if (userRole === 'PPD_UNIT') {
        setupUnitView();
    } 

    // 5. Mulakan Routing (Hash Handler)
    // Semak hash URL semasa atau default ke 'dashboard' (atau 'pencapaian' untuk Unit PPD)
    let initialTab = window.location.hash.replace('#', '');
    
    // Jika Unit PPD cuba masuk dashboard, paksa ke pencapaian
    if (userRole === 'PPD_UNIT' && (!initialTab || initialTab === 'dashboard')) {
        initialTab = 'pencapaian';
    } else if (!initialTab) {
        initialTab = 'dashboard';
    }

    switchAdminTab(initialTab);

    // Listener untuk perubahan hash (Back/Forward browser)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        switchAdminTab(hash);
    });

    // 6. Muat data Dashboard secara automatik (hanya jika bukan Unit PPD)
    if (userRole !== 'PPD_UNIT' && window.fetchDashboardData) {
        window.fetchDashboardData();
    }
}

/**
 * Fungsi Navigasi Tab Utama
 * Menguruskan pertukaran paparan dan lazy-loading modul.
 * @param {string} tabId - ID Tab (contoh: 'dashboard', 'analisa', 'tempahan', 'import-data')
 * @param {Event} event - (Opsional) Event klik
 */
function switchAdminTab(tabId, event) {
    // Halang default anchor behavior jika diklik
    if (event) {
        event.preventDefault();
        history.pushState(null, null, '#' + tabId);
    }

    // SEMAKAN KESELAMATAN (GATEKEEPER)
    // Pastikan peranan tidak boleh akses tab dilarang walaupun tukar hash manual
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const forbiddenForUnit = ['dashboard', 'analisa', 'gallery', 'tempahan', 'email', 'helpdesk', 'import-data'];
    const forbiddenForMod = ['import-data']; // Hanya Super Admin boleh Import

    if (userRole === 'PPD_UNIT' && forbiddenForUnit.includes(tabId)) {
        // Redirect senyap ke pencapaian
        tabId = 'pencapaian'; 
        history.replaceState(null, null, '#pencapaian');
    } else if (['ADMIN', 'JPNMEL'].includes(userRole) && forbiddenForMod.includes(tabId)) {
        // Redirect senyap ke dashboard jika Mod Admin atau JPN cuba buka tab import
        tabId = 'dashboard';
        history.replaceState(null, null, '#dashboard');
    }

    // 1. Sembunyikan semua konten tab
    const allContents = document.querySelectorAll('[id^="tab-"]');
    allContents.forEach(el => el.classList.add('hidden'));

    // 2. Paparkan konten tab yang dipilih
    const targetContent = document.getElementById('tab-' + tabId);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    } else {
        console.warn(`[AdminMain] Tab ID 'tab-${tabId}' tidak ditemui.`);
        return;
    }

    // 3. Kemaskini butang navigasi (Active State)
    // PENYELESAIAN BUG: Menggunakan classList untuk mengekalkan kelas utiliti lain (spt 'hidden')
    const allButtons = document.querySelectorAll('[id$="-tab"]');
    allButtons.forEach(btn => {
        btn.classList.remove('tab-active');
        btn.classList.add('tab-inactive');
    });

    const activeButton = document.getElementById(tabId + '-tab');
    if (activeButton) {
        activeButton.classList.remove('tab-inactive');
        activeButton.classList.add('tab-active');
    }

    // 4. Lazy Load Data (Muat data hanya bila tab dibuka)
    loadModuleData(tabId);
}

/**
 * Memanggil fungsi inisialisasi modul berkaitan
 */
function loadModuleData(tabId) {
    switch (tabId) {
        case 'penataran':
            if (window.muatSenaraiPenataran) window.muatSenaraiPenataran();
            break;
        case 'analisa':
            if (window.loadDcsAdmin) window.loadDcsAdmin();
            break;
        case 'pencapaian':
            if (window.populateTahunFilter) window.populateTahunFilter();
            break;
        case 'gallery':
            if (window.initAdminGallery) window.initAdminGallery();
            break;
        case 'tempahan':
            if (window.initAdminBooking) window.initAdminBooking();
            break;
        case 'email':
            if (window.generateList) window.generateList();
            break;
        case 'helpdesk':
            if (window.loadTiketAdmin) window.loadTiketAdmin();
            break;
        case 'admin-users':
            if (window.loadAdminList) window.loadAdminList();
            break;
        // Tab import-data tidak mempunyai init automatik kerana ia adalah interaktif form manual
    }
}

/**
 * Konfigurasi Paparan Khas UNIT PPD
 * Menyembunyikan butang navigasi yang dilarang dari DOM.
 */
function setupUnitView() {
    // Senarai ID butang navigasi yang perlu disembunyikan
    // Hanya 'pencapaian-tab' dan 'admin-users-tab' yang DIBIARKAN.
    const hideButtons = [
        'dashboard-tab', 
        'analisa-tab', 
        'gallery-tab',
        'tempahan-tab',
        'email-tab', 
        'helpdesk-tab',
        'import-data-tab'
    ];

    hideButtons.forEach(btnId => {
        const el = document.getElementById(btnId);
        if (el) {
            // Tambah class hidden dan 'pointer-events-none' untuk keselamatan tambahan
            el.classList.add('hidden', 'pointer-events-none');
            // Alih keluar ID supaya tidak boleh diakses script lain
            el.id = ""; 
        }
    });

    console.log("🔒 [AdminMain] Mod UNIT PPD diaktifkan. Akses dihadkan.");
}