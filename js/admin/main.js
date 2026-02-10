/**
 * ADMIN MODULE: MAIN CONTROLLER (DEV)
 * Fungsi: Menguruskan logik permulaan admin, keselamatan, dan peranan.
 */

import { AuthService } from '../services/auth.service.js';
import { APP_CONFIG } from '../config/app.config.js';
// Tidak perlu import keluarSistem secara manual kerana helpers.js telah di-load di admin.html
// dan ia mendedahkan window.keluarSistem yang betul (dengan Swal).

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

async function initAdminPanel() {
    const isAuth = sessionStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
    const userRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    // 1. Security Check
    if (!isAuth) {
        window.location.replace('index.html');
        return;
    }

    // 2. Role Setup
    const displayRole = document.getElementById('displayUserRole');
    
    if (userRole === 'PPD_UNIT') {
        setupUnitView(displayRole);
    } else if (userRole === 'SUPER_ADMIN') {
        setupSuperAdminView(displayRole);
    } else {
        // Default ADMIN
        setupAdminView(displayRole);
    }

    // 3. Global Listeners
    setupTabListeners();
}

function setupUnitView(displayRole) {
    if(displayRole) displayRole.innerHTML = "UNIT PPD VIEW";
    
    // Sembunyikan Tab & Fungsi yang tidak relevan (Strict Mode)
    const tabsToHide = ['dashboard-tab', 'analisa-tab', 'email-tab', 'helpdesk-tab', 'admin-users-tab'];
    tabsToHide.forEach(id => {
        const el = document.getElementById(id);
        if(el && el.parentElement) el.parentElement.classList.add('hidden');
    });

    // Butang Log Keluar Khas
    document.getElementById('btnMainLogout')?.classList.add('hidden');
    document.getElementById('btnLogoutUnitPPD')?.classList.remove('hidden');
    document.getElementById('btnUbahPassUnitPPD')?.classList.remove('hidden');

    // Auto-Redirect ke Tab Pencapaian
    const tabPencapaianEl = document.getElementById('pencapaian-tab');
    if(tabPencapaianEl) {
        const tabPencapaian = new bootstrap.Tab(tabPencapaianEl);
        tabPencapaian.show();
    }

    // Muat data asas (Tahun) untuk dropdown
    if(window.populateTahunFilter) window.populateTahunFilter();
}

function setupAdminView(displayRole) {
    if(displayRole) displayRole.innerHTML = "MOD ADMIN";
    // Trigger dashboard load
    if(window.fetchDashboardData) window.fetchDashboardData();
}

function setupSuperAdminView(displayRole) {
    if(displayRole) {
        displayRole.innerHTML = "SUPER ADMIN";
        displayRole.classList.remove('text-primary');
        displayRole.classList.add('text-danger', 'fw-black'); // Merah untuk Super Admin
        displayRole.parentElement.classList.replace('border-primary', 'border-danger');
        displayRole.parentElement.classList.replace('text-primary', 'text-danger');
    }
    // Super Admin akses semua, sama seperti Admin
    if(window.fetchDashboardData) window.fetchDashboardData();
}

function setupTabListeners() {
    // Listener untuk load data hanya bila tab dibuka (Lazy Load)
    
    // Tab Analisa
    const analisaTab = document.getElementById('analisa-tab');
    if (analisaTab) analisaTab.addEventListener('shown.bs.tab', () => { if(window.loadDcsAdmin) window.loadDcsAdmin(); });

    // Tab Pencapaian
    const pencapaianTab = document.getElementById('pencapaian-tab');
    if (pencapaianTab) pencapaianTab.addEventListener('shown.bs.tab', () => { if(window.populateTahunFilter) window.populateTahunFilter(); });

    // Tab Galeri
    const galleryTab = document.getElementById('gallery-tab');
    if (galleryTab) galleryTab.addEventListener('shown.bs.tab', () => { if(window.initAdminGallery) window.initAdminGallery(); });

    // Tab Email
    const emailTab = document.getElementById('email-tab');
    if (emailTab) emailTab.addEventListener('shown.bs.tab', () => { if(window.generateList) window.generateList(); });

    // Tab Helpdesk
    const helpdeskTab = document.getElementById('helpdesk-tab');
    if (helpdeskTab) helpdeskTab.addEventListener('shown.bs.tab', () => { if(window.loadTiketAdmin) window.loadTiketAdmin(); });

    // Tab Admin Users
    const usersTab = document.getElementById('admin-users-tab');
    if (usersTab) usersTab.addEventListener('shown.bs.tab', () => { if(window.loadAdminList) window.loadAdminList(); });
}