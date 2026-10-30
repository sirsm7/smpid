/**
 * ADMIN MODULE: MAIN CONTROLLER & ROUTER (V3.0 - DYNAMIC IMPORT & HIGH PERFORMANCE)
 * Fungsi: Menguruskan navigasi tab, kawalan keselamatan sesi, peranan (RBAC),
 * serta pemuatan modul dinamik secara atas permintaan (Dynamic Code Splitting / Lazy Loading).
 * 
 * Pengoptimuman V3.0:
 * 1. Menghapuskan pembekuan muat awal dengan memuatkan fail modul (dashboard, penataran, analysis,
 *    impact, achievement, communication, gallery, booking, settings, delima, libat_urus)
 *    hanya apabila pengguna mengaktifkan tab yang berkaitan.
 * 2. Menguruskan cache modul dinamik melalui Map untuk mengelakkan muat turun skrip berulang.
 * 3. Menjamin integriti perkongsian data global (globalDashboardData) merentas semua sub-modul pentadbir.
 */

import { AuthService } from '../services/auth.service.js';
import { APP_CONFIG } from '../config/app.config.js';

// Peta memori bagi menjejak janji (promise) pemuatan modul dinamik
const moduleRegistry = new Map();

// --- GLOBAL VARIABLES & EXPORTS ---
window.switchAdminTab = switchAdminTab;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

/**
 * Fungsi Bantuan: Pemuatan Modul Dinamik Berasaskan Permintaan (Lazy Import)
 * @param {string} modulePath - Laluan fail modul relatif (cth: './dashboard.js')
 * @returns {Promise<any>}
 */
async function loadModule(modulePath) {
    if (!moduleRegistry.has(modulePath)) {
        const importPromise = import(modulePath).catch(err => {
            console.error(`[AdminMain] Gagal memuatkan modul dinamik: ${modulePath}`, err);
            moduleRegistry.delete(modulePath);
            throw err;
        });
        moduleRegistry.set(modulePath, importPromise);
    }
    return moduleRegistry.get(modulePath);
}

/**
 * Inisialisasi Utama Panel Pentadbir
 */
async function initAdminPanel() {
    // 1. Semakan Sesi (Auth Guard)
    const isAuth = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    if (!isAuth) {
        console.warn("⛔ [AdminMain] Sesi tidak sah. Mengalihkan ke landing page...");
        window.location.replace('index.html');
        return;
    }

    // 2. Paparan Label Peranan
    const displayRole = document.getElementById('displayUserRole');
    if (displayRole) {
        if (userRole === 'SUPER_ADMIN') {
            displayRole.innerText = 'SUPER ADMIN';
            displayRole.classList.add('text-red-400', 'font-black');
        } else if (userRole === 'JPNMEL') {
            displayRole.innerText = 'JPN MELAKA';
            displayRole.classList.add('text-fuchsia-400', 'font-black');
        } else if (userRole === 'PPD_UNIT') {
            displayRole.innerText = 'UNIT PPD';
        } else {
            displayRole.innerText = 'MOD ADMIN';
        }
    }

    // 3. Kawalan Paparan Tab Import Data (Khusus SUPER_ADMIN)
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
    let initialTab = window.location.hash.replace('#', '');
    
    // Jika Unit PPD cuba akses dashboard, halakan ke pencapaian
    if (userRole === 'PPD_UNIT' && (!initialTab || initialTab === 'dashboard')) {
        initialTab = 'pencapaian';
    } else if (!initialTab) {
        initialTab = 'dashboard';
    }

    // 6. Muatkan data teras Dashboard secara dinamik bagi admin biasa
    if (userRole !== 'PPD_UNIT') {
        loadModule('./dashboard.js').then(() => {
            if (window.fetchDashboardData) {
                window.fetchDashboardData();
            }
        }).catch(e => console.warn("[AdminMain] Prapemuatan dashboard ditangguhkan:", e));
    }

    // Aktifkan tab pertama
    switchAdminTab(initialTab);

    // Listener untuk perubahan hash pelayar (Back/Forward navigation)
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        switchAdminTab(hash);
    });
}

/**
 * Fungsi Navigasi Tab Utama
 * Menguruskan pertukaran paparan dan pemuatan dinamik modul.
 * @param {string} tabId - ID Tab (contoh: 'dashboard', 'analisa', 'tempahan', 'import-data')
 * @param {Event} event - (Opsional) Acara klik pengguna
 */
async function switchAdminTab(tabId, event) {
    if (event) {
        event.preventDefault();
        history.pushState(null, null, '#' + tabId);
    }

    // SEMAKAN KESELAMATAN (GATEKEEPER)
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const forbiddenForUnit = ['dashboard', 'analisa', 'impact', 'gallery', 'tempahan', 'email', 'helpdesk', 'import-data', 'libat-urus'];
    const forbiddenForMod = ['import-data'];

    if (userRole === 'PPD_UNIT' && forbiddenForUnit.includes(tabId)) {
        tabId = 'pencapaian'; 
        history.replaceState(null, null, '#pencapaian');
    } else if (['ADMIN', 'JPNMEL'].includes(userRole) && forbiddenForMod.includes(tabId)) {
        tabId = 'dashboard';
        history.replaceState(null, null, '#dashboard');
    }

    // 1. Sembunyikan semua kandungan tab
    const allContents = document.querySelectorAll('[id^="tab-"]');
    allContents.forEach(el => el.classList.add('hidden'));

    // 2. Paparkan kandungan tab sasaran
    const targetContent = document.getElementById('tab-' + tabId);
    if (targetContent) {
        targetContent.classList.remove('hidden');
    } else {
        console.warn(`[AdminMain] Tab ID 'tab-${tabId}' tidak ditemui.`);
        return;
    }

    // 3. Kemaskini gaya aktif pada butang tab
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

    // 4. Muatkan modul secara dinamik atas permintaan
    await loadModuleData(tabId);
}

/**
 * Memuatkan fail modul secara dinamik mengikut keperluan tab dan memulakan rendering
 * @param {string} tabId 
 */
async function loadModuleData(tabId) {
    try {
        switch (tabId) {
            case 'dashboard':
                await loadModule('./dashboard.js');
                if (window.fetchDashboardData) window.fetchDashboardData();
                break;

            case 'penataran':
                await loadModule('./penataran.js');
                if (window.muatSenaraiPenataran) window.muatSenaraiPenataran();
                break;

            case 'analisa':
                await loadModule('./analysis.js');
                if (window.loadDcsAdmin) window.loadDcsAdmin();
                break;

            case 'impact':
                await loadModule('./impact.js');
                if (window.loadImpactAdmin) window.loadImpactAdmin();
                break;

            case 'pencapaian':
                await loadModule('./achievement.js');
                if (window.populateTahunFilter) window.populateTahunFilter();
                break;

            case 'gallery':
                // Galeri bergantung pada senarai sekolah global dari dashboard
                await Promise.all([loadModule('./gallery_manager.js'), loadModule('./dashboard.js')]);
                if (!window.globalDashboardData && window.fetchDashboardData) {
                    await window.fetchDashboardData();
                }
                if (window.initAdminGallery) window.initAdminGallery();
                break;

            case 'tempahan':
                await loadModule('./booking_manager.js');
                if (window.initAdminBooking) window.initAdminBooking();
                break;

            case 'email':
                await loadModule('./communication.js');
                if (window.generateList) window.generateList();
                break;

            case 'helpdesk':
                // Pusat Sokongan merangkumi aduan (communication.js) dan ID DELIMa (delima_manager.js)
                await Promise.all([loadModule('./communication.js'), loadModule('./delima_manager.js')]);
                if (window.loadTiketAdmin) window.loadTiketAdmin();
                break;

            case 'admin-users':
                await loadModule('./settings.js');
                if (window.loadAdminList) window.loadAdminList();
                break;

            case 'import-data':
                await loadModule('./settings.js');
                break;

            case 'libat-urus':
                await loadModule('./libat_urus.js');
                if (window.loadAdminLibatUrus) window.loadAdminLibatUrus();
                break;
        }
    } catch (err) {
        console.error(`[AdminMain] Ralat semasa melaksanakan modul ${tabId}:`, err);
    }
}

/**
 * Konfigurasi Paparan Khas UNIT PPD
 * Menyembunyikan butang navigasi yang disekat daripada DOM.
 */
function setupUnitView() {
    const hideButtons = [
        'dashboard-tab', 
        'analisa-tab', 
        'impact-tab',
        'gallery-tab',
        'tempahan-tab',
        'email-tab', 
        'helpdesk-tab',
        'import-data-tab',
        'libat-urus-tab'
    ];

    hideButtons.forEach(btnId => {
        const el = document.getElementById(btnId);
        if (el) {
            el.classList.add('hidden', 'pointer-events-none');
            el.id = ""; 
        }
    });

    console.log("🔒 [AdminMain] Mod UNIT PPD diaktifkan. Akses dihadkan secara selamat.");
}