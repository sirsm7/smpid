/**
 * ADMIN MODULE: MAIN CONTROLLER & ROUTER
 * Fungsi: Menguruskan navigasi tab, keselamatan, dan peranan (RBAC).
 * --- UPDATE V2.1 (CONSOLIDATED CONTROLLER) ---
 * 1. Menyatukan logik switchAdminTab ke dalam fail ini.
 * 2. Menguatkuasakan sekatan UNIT PPD (Hanya Kemenjadian & Akses).
 * 3. Membuang kebergantungan inline script di HTML.
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
        } else if (userRole === 'PPD_UNIT') {
            displayRole.innerText = 'UNIT PPD';
        } else {
            displayRole.innerText = 'MOD ADMIN';
        }
    }

    // 3. Konfigurasi Modul Mengikut Peranan (Strict Mode)
    if (userRole === 'PPD_UNIT') {
        setupUnitView();
    } 

    // 4. Mulakan Routing (Hash Handler)
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

    // 5. Muat data Dashboard secara automatik (hanya jika bukan Unit PPD)
    if (userRole !== 'PPD_UNIT' && window.fetchDashboardData) {
        window.fetchDashboardData();
    }
}

/**
 * Fungsi Navigasi Tab Utama
 * Menguruskan pertukaran paparan dan lazy-loading modul.
 * @param {string} tabId - ID Tab (contoh: 'dashboard', 'analisa')
 * @param {Event} event - (Opsional) Event klik
 */
function switchAdminTab(tabId, event) {
    // Halang default anchor behavior jika diklik
    if (event) {
        event.preventDefault();
        history.pushState(null, null, '#' + tabId);
    }

    // SEMAKAN KESELAMATAN (GATEKEEPER)
    // Pastikan Unit PPD tidak boleh akses tab dilarang walaupun tukar hash manual
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const forbiddenForUnit = ['dashboard', 'analisa', 'gallery', 'email', 'helpdesk'];

    if (userRole === 'PPD_UNIT' && forbiddenForUnit.includes(tabId)) {
        // Redirect senyap ke pencapaian
        tabId = 'pencapaian'; 
        history.replaceState(null, null, '#pencapaian');
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
    const allButtons = document.querySelectorAll('[id$="-tab"]');
    allButtons.forEach(btn => {
        // Reset ke style inactive
        btn.className = "tab-inactive px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap";
    });

    const activeButton = document.getElementById(tabId + '-tab');
    if (activeButton) {
        // Set ke style active
        activeButton.className = "tab-active px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap";
    }

    // 4. Lazy Load Data (Muat data hanya bila tab dibuka)
    loadModuleData(tabId);
}

/**
 * Memanggil fungsi inisialisasi modul berkaitan
 */
function loadModuleData(tabId) {
    switch (tabId) {
        case 'analisa':
            if (window.loadDcsAdmin) window.loadDcsAdmin();
            break;
        case 'pencapaian':
            if (window.populateTahunFilter) window.populateTahunFilter();
            break;
        case 'gallery':
            if (window.initAdminGallery) window.initAdminGallery();
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
        'email-tab', 
        'helpdesk-tab'
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