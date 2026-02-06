/**
 * MAIN ADMIN CONTROLLER (js/admin/main.js)
 * Fungsi: Menguruskan inisialisasi dan pemuatan modul apabila halaman sedia.
 */

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

async function initAdminPanel() {
    // 1. Semakan Keselamatan Asas
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        window.location.replace('index.html');
        return;
    }

    // 2. Semakan Peranan (Role Based Access Control)
    const userRole = sessionStorage.getItem('smpid_user_role'); 
    const displayRole = document.getElementById('displayUserRole');

    if (userRole === 'PPD_UNIT') {
        console.log("🔒 Mod PPD_UNIT diaktifkan.");
        setupUnitView(displayRole);
    } else {
        console.log("🔓 Mod ADMIN penuh diaktifkan.");
        setupAdminView(displayRole);
    }

    // 3. Setup Global Event Listeners (Tabs)
    setupTabListeners();
}

function setupUnitView(displayRole) {
    if(displayRole) displayRole.innerHTML = "UNIT PPD VIEW";

    // Sorokkan Tab Yang Tidak Berkaitan (Kecuali Pencapaian & Galeri)
    const tabsToHide = ['dashboard-tab', 'analisa-tab', 'email-tab', 'helpdesk-tab', 'admin-users-tab'];
    tabsToHide.forEach(id => {
        const el = document.getElementById(id);
        if(el && el.parentElement) el.parentElement.classList.add('hidden'); 
    });

    // Sorokkan Butang Log Keluar Utama
    const btnMainLogout = document.getElementById('btnMainLogout');
    if(btnMainLogout) btnMainLogout.classList.add('hidden');
    
    // Tunjuk Butang Khas
    const btnUnitLogout = document.getElementById('btnLogoutUnitPPD');
    if(btnUnitLogout) btnUnitLogout.classList.remove('hidden');

    const btnUbahPass = document.getElementById('btnUbahPassUnitPPD');
    if(btnUbahPass) btnUbahPass.classList.remove('hidden');

    // Auto-Redirect ke Tab Pencapaian
    const tabPencapaianEl = document.getElementById('pencapaian-tab');
    if(tabPencapaianEl) {
        const tabPencapaian = new bootstrap.Tab(tabPencapaianEl);
        tabPencapaian.show();
    }

    // Muat data asas (diperlukan untuk mapping nama sekolah)
    if(window.fetchDashboardData) window.fetchDashboardData().then(() => {
        if(window.populateTahunFilter) window.populateTahunFilter();
    });
}

function setupAdminView(displayRole) {
    if(displayRole) displayRole.innerHTML = "MOD ADMIN";
    // Muat turun data dashboard sepenuhnya
    if(window.fetchDashboardData) window.fetchDashboardData(); 
}

function setupTabListeners() {
    // Tab Email
    const emailTabBtn = document.getElementById('email-tab');
    if (emailTabBtn) emailTabBtn.addEventListener('shown.bs.tab', function () { 
        if(window.generateList) window.generateList(); 
    });

    // Tab Helpdesk
    const helpdeskTabBtn = document.getElementById('helpdesk-tab');
    if (helpdeskTabBtn) helpdeskTabBtn.addEventListener('shown.bs.tab', function () { 
        if(window.loadTiketAdmin) window.loadTiketAdmin(); 
    });

    // Tab Admin Users
    const adminUsersTabBtn = document.getElementById('admin-users-tab');
    if (adminUsersTabBtn) adminUsersTabBtn.addEventListener('shown.bs.tab', function () { 
        if(window.loadAdminList) window.loadAdminList(); 
    });

    // Tab Analisa
    const analisaTabBtn = document.getElementById('analisa-tab');
    if (analisaTabBtn) analisaTabBtn.addEventListener('shown.bs.tab', function () { 
        if(window.loadDcsAdmin) window.loadDcsAdmin(); 
    });

    // Tab Pencapaian (Penting: Load Tahun dulu)
    const pencapaianTabBtn = document.getElementById('pencapaian-tab');
    if (pencapaianTabBtn) {
        pencapaianTabBtn.addEventListener('shown.bs.tab', function () { 
            if(window.populateTahunFilter) window.populateTahunFilter(); 
        });
    }

    // Tab Galeri (NEW)
    const galleryTabBtn = document.getElementById('gallery-tab');
    if (galleryTabBtn) {
        galleryTabBtn.addEventListener('shown.bs.tab', function () { 
            if(window.initAdminGallery) window.initAdminGallery(); 
        });
    }
}