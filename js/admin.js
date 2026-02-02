/**
 * SMPID ADMIN PANEL MODULE (js/admin.js)
 * Versi: 9.1 (Enhanced Table Comparison Layout)
 * Fungsi: Dashboard, Email Blaster, Helpdesk, User Management, DCS & Pencapaian V2
 */

// NOTA: Variable global diambil dari window (utils.js)

// State Management (Dashboard Utama)
let dashboardData = [];
let emailRawData = [];
let currentFilteredList = [];
let activeStatus = 'ALL';
let activeType = 'ALL';

// State Management (Analisa DCS/DELIMa)
let dcsDataList = [];
let charts = { donut: null, bar: null };

// State Management (Pencapaian) - BARU
let pencapaianList = [];

// Queue State (Tindakan Pantas)
let reminderQueue = [];
let qIndex = 0;

// ==========================================
// 1. INITIALIZATION & RBAC (ROLE CHECK)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

function initAdminPanel() {
    // 1. Semakan Keselamatan Asas
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        window.location.replace('index.html');
        return;
    }

    // 2. Semakan Peranan (Role Based Access Control)
    const userRole = sessionStorage.getItem('smpid_user_role'); // Diset dalam auth.js
    const displayRole = document.getElementById('displayUserRole');

    if (userRole === 'PPD_UNIT') {
        // --- LOGIK UNTUK PENGGUNA UNIT PPD (TERHAD) ---
        console.log("🔒 Mod PPD_UNIT diaktifkan. Menghadkan akses...");
        
        // Kemaskini Badge Header
        if(displayRole) displayRole.innerHTML = "UNIT PPD VIEW";

        // Sorokkan Tab Yang Tidak Berkaitan (Dashboard, Analisa, Email, Helpdesk, Admin Users)
        const tabsToHide = ['dashboard-tab', 'analisa-tab', 'email-tab', 'helpdesk-tab', 'admin-users-tab'];
        tabsToHide.forEach(id => {
            const el = document.getElementById(id);
            if(el && el.parentElement) el.parentElement.classList.add('hidden'); 
        });

        // Sorokkan Butang Log Keluar Utama (Bawah)
        const btnMainLogout = document.getElementById('btnMainLogout');
        if(btnMainLogout) btnMainLogout.classList.add('hidden');
        
        // Tunjuk Butang Khas di Header Pencapaian
        const btnUnitLogout = document.getElementById('btnLogoutUnitPPD');
        if(btnUnitLogout) btnUnitLogout.classList.remove('hidden');

        // UPDATE: Tunjuk Butang Tukar Password Khas
        const btnUbahPass = document.getElementById('btnUbahPassUnitPPD');
        if(btnUbahPass) btnUbahPass.classList.remove('hidden');

        // AUTO-REDIRECT: Paksa Buka Tab Pencapaian
        const tabPencapaianEl = document.getElementById('pencapaian-tab');
        if(tabPencapaianEl) {
            const tabPencapaian = new bootstrap.Tab(tabPencapaianEl);
            tabPencapaian.show();
        }

        // PENTING: Jangan fetchDashboardData() untuk Unit PPD
        populateTahunFilter();

    } else {
        // --- LOGIK UNTUK ADMIN PENUH ---
        console.log("🔓 Mod ADMIN penuh diaktifkan.");
        
        if(displayRole) displayRole.innerHTML = "MOD ADMIN";

        // Setup Event Listeners untuk Tab Lain
        setupAdminTabs();
        
        // Muat turun data dashboard sepenuhnya
        fetchDashboardData(); 
    }

    // Listener Tab Pencapaian (Perlu untuk kedua-dua role)
    const pencapaianTabBtn = document.getElementById('pencapaian-tab');
    if (pencapaianTabBtn) {
        pencapaianTabBtn.addEventListener('shown.bs.tab', function () { populateTahunFilter(); });
    }
}

function setupAdminTabs() {
    const emailTabBtn = document.getElementById('email-tab');
    if (emailTabBtn) emailTabBtn.addEventListener('shown.bs.tab', function () { generateList(); });

    const helpdeskTabBtn = document.getElementById('helpdesk-tab');
    if (helpdeskTabBtn) helpdeskTabBtn.addEventListener('shown.bs.tab', function () { loadTiketAdmin(); });

    const adminUsersTabBtn = document.getElementById('admin-users-tab');
    if (adminUsersTabBtn) adminUsersTabBtn.addEventListener('shown.bs.tab', function () { loadAdminList(); });

    const analisaTabBtn = document.getElementById('analisa-tab');
    if (analisaTabBtn) analisaTabBtn.addEventListener('shown.bs.tab', function () { loadDcsAdmin(); });
}

// ==========================================
// 2. FUNGSI UBAH PASSWORD (DIRI SENDIRI)
// ==========================================

async function ubahKataLaluanSendiri() {
    const userId = sessionStorage.getItem('smpid_user_id'); // Ambil ID unik dari sesi
    
    if (!userId) {
        Swal.fire('Ralat Sesi', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html:
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Lama</label>' +
            '<input id="swal-pass-old" type="password" class="swal2-input mb-3" placeholder="Masukan password semasa">' +
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Baru</label>' +
            '<input id="swal-pass-new" type="password" class="swal2-input" placeholder="Minima 6 aksara">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            return [
                document.getElementById('swal-pass-old').value,
                document.getElementById('swal-pass-new').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;

        if (!oldPass || !newPass) { 
            Swal.fire('Ralat', 'Sila isi kedua-dua ruang.', 'warning'); 
            return; 
        }
        if (newPass.length < 6) { 
            Swal.fire('Ralat', 'Kata laluan baru terlalu pendek (min 6).', 'warning'); 
            return; 
        }

        window.toggleLoading(true);

        try {
            // 1. Semak Kata Laluan Lama
            const { data: userData, error: fetchError } = await window.supabaseClient
                .from('smpid_users')
                .select('password')
                .eq('id', userId)
                .single();

            if (fetchError || !userData) throw new Error("Gagal mengesahkan pengguna.");

            if (userData.password !== oldPass) {
                window.toggleLoading(false);
                Swal.fire('Gagal', 'Kata laluan lama tidak sah.', 'error');
                return;
            }

            // 2. Kemaskini Kata Laluan Baru
            const { error: updateError } = await window.supabaseClient
                .from('smpid_users')
                .update({ password: newPass })
                .eq('id', userId);

            if (updateError) throw updateError;

            window.toggleLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Berjaya',
                text: 'Kata laluan telah ditukar. Sila log masuk semula.',
                confirmButtonText: 'OK'
            }).then(() => {
                window.keluarSistem(); // Paksa logout untuk keselamatan
            });

        } catch (err) {
            window.toggleLoading(false);
            console.error(err);
            Swal.fire('Ralat', 'Gagal menukar kata laluan.', 'error');
        }
    }
}

// ==========================================
// 3. DATA FETCHING & DASHBOARD (ADMIN ONLY)
// ==========================================

async function fetchDashboardData() {
    window.toggleLoading(true);
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('*')
            .order('nama_sekolah', { ascending: true });
            
        if (error) throw error;
        
        const processedData = data.map(i => {
            const requiredFields = [
                i.nama_gpict, i.no_telefon_gpict, i.emel_delima_gpict, 
                i.nama_admin_delima, i.no_telefon_admin_delima, i.emel_delima_admin_delima
            ];
            const isDataComplete = requiredFields.every(field => field && field.trim() !== "");
            
            const telG = window.cleanPhone(i.no_telefon_gpict);
            const telA = window.cleanPhone(i.no_telefon_admin_delima);
            const isSama = (telG && telA) && (telG === telA);
            const isBerbeza = (telG && telA) && (telG !== telA);

            return { 
                ...i, 
                jenis: i.jenis_sekolah || 'LAIN-LAIN', 
                is_lengkap: isDataComplete, 
                is_sama: isSama, 
                is_berbeza: isBerbeza 
            };
        });

        emailRawData = data; 
        dashboardData = processedData.filter(item => item.jenis !== 'PPD');
        
        renderFilters();
        runFilter();
        generateList(); 

        window.toggleLoading(false);
    } catch (err) { 
        console.error(err);
        window.toggleLoading(false); 
        Swal.fire('Ralat', 'Gagal memuatkan data dashboard.', 'error'); 
    }
}

// ==========================================
// 4. FILTERING & RENDERING (DASHBOARD)
// ==========================================

function renderFilters() {
    const types = [...new Set(dashboardData.map(i => i.jenis))].sort();
    let opts = `<option value="ALL">SEMUA JENIS SEKOLAH</option>`;
    types.forEach(t => opts += `<option value="${t}">${t}</option>`);
    
    const container = document.getElementById('filterContainer');
    if(container) {
        container.innerHTML = `
        <div class="row align-items-center g-3">
          <div class="col-md-9 col-12 d-flex flex-wrap gap-2">
            <span onclick="setFilter('ALL')" id="badgeAll" class="badge bg-secondary cursor-pointer filter-badge active p-2">Semua <span id="cntAll" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('LENGKAP')" id="badgeLengkap" class="badge bg-success cursor-pointer filter-badge p-2">Lengkap <span id="cntLengkap" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BELUM')" id="badgeBelum" class="badge bg-danger cursor-pointer filter-badge p-2">Belum <span id="cntBelum" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('SAMA')" id="badgeSama" class="badge bg-purple cursor-pointer filter-badge p-2">Jawatan Sama <span id="cntSama" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BERBEZA')" id="badgeBerbeza" class="badge bg-orange cursor-pointer filter-badge p-2">Jawatan Berbeza <span id="cntBerbeza" class="badge bg-light text-dark ms-1">0</span></span>
          </div>
          <div class="col-md-3"><select class="form-select rounded-pill shadow-sm" onchange="setType(this.value)">${opts}</select></div>
        </div>`;
    }
}

function setFilter(s) { activeStatus = s; runFilter(); }
function setType(t) { activeType = t; runFilter(); }

function runFilter() {
    const filtered = dashboardData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap) ||
                          (activeStatus === 'SAMA' && i.is_sama) ||
                          (activeStatus === 'BERBEZA' && i.is_berbeza); 
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        return statMatch && typeMatch;
    });

    currentFilteredList = filtered;
    updateBadgeCounts();
    renderGrid(filtered);
}

function updateBadgeCounts() {
    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    
    const map = {
        'ALL': 'badgeAll', 'LENGKAP': 'badgeLengkap', 'BELUM': 'badgeBelum', 
        'SAMA': 'badgeSama', 'BERBEZA': 'badgeBerbeza'
    };
    if (map[activeStatus]) document.getElementById(map[activeStatus])?.classList.add('active');
    
    const context = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    const setTxt = (id, count) => { if(document.getElementById(id)) document.getElementById(id).innerText = count; };
    
    setTxt('cntAll', context.length);
    setTxt('cntLengkap', context.filter(i => i.is_lengkap).length);
    setTxt('cntBelum', context.filter(i => !i.is_lengkap).length);
    setTxt('cntSama', context.filter(i => i.is_sama).length);
    setTxt('cntBerbeza', context.filter(i => i.is_berbeza).length);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data untuk paparan ini.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `<div class="mb-4 fade-up"><h6 class="category-header">${jenis} (${items.length})</h6><div class="row g-3">`;
        
        items.forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="badge bg-success status-badge p-2 shadow-sm" title="Data Lengkap"><i class="fas fa-check fa-lg"></i></span>` 
                : `<span class="badge bg-danger status-badge p-2 shadow-sm" title="Belum Lengkap"><i class="fas fa-times fa-lg"></i></span>`;
            
            const linkG_Raw = window.generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, true);
            const linkA_Raw = window.generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, true);
            const hasTeleG = s.telegram_id_gpict;
            const hasTeleA = s.telegram_id_admin;

            const renderActions = (hasTele, linkRaw) => {
                let buttonsHtml = '<div class="d-flex align-items-center gap-1 justify-content-end">';
                if (hasTele) buttonsHtml += `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="fas fa-check-circle"></i> OK</span>`;
                if (linkRaw) buttonsHtml += `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-light border text-secondary" title="Chat"><i class="fas fa-comment"></i></a>`;
                else buttonsHtml += `<span class="text-muted small">-</span>`;
                buttonsHtml += '</div>';
                return buttonsHtml;
            };

            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="card school-card h-100 position-relative" onclick="viewSchoolProfile('${s.kod_sekolah}')">
                
                <div class="dropdown position-absolute top-0 end-0 m-2" style="z-index: 5;">
                  <button class="btn btn-sm btn-light rounded-circle shadow-sm border-0 d-flex align-items-center justify-content-center" 
                          type="button" data-bs-toggle="dropdown" aria-expanded="false" 
                          onclick="event.stopPropagation()" 
                          style="width: 32px; height: 32px;">
                    <i class="fas fa-ellipsis-v text-secondary"></i>
                  </button>
                  <ul class="dropdown-menu dropdown-menu-end shadow border-0 rounded-3 p-2">
                    <li><h6 class="dropdown-header small text-muted text-uppercase fw-bold py-1" style="font-size: 0.7rem;">Tindakan Admin</h6></li>
                    <li><hr class="dropdown-divider my-1"></li>
                    <li>
                        <a class="dropdown-item text-danger small fw-bold rounded-2 py-2" href="#" onclick="event.stopPropagation(); resetPasswordSekolah('${s.kod_sekolah}')">
                            <i class="fas fa-key me-2"></i>Reset Password
                        </a>
                    </li>
                  </ul>
                </div>

                <div class="card-body p-3 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-center mb-2 pe-4">
                    <h6 class="fw-bold text-primary mb-0 text-truncate" style="max-width: 80%;">${s.kod_sekolah}</h6>
                    ${statusBadge}
                  </div>
                  <p class="school-name mb-auto" title="${s.nama_sekolah}">${s.nama_sekolah}</p>
                </div>
                <div class="tele-status-row bg-light border-top">
                   <div class="row-item p-2"><span class="small fw-bold text-muted">GPICT</span> ${renderActions(hasTeleG, linkG_Raw)}</div>
                   <div class="row-item p-2 border-top border-light"><span class="small fw-bold text-muted">Admin</span> ${renderActions(hasTeleA, linkA_Raw)}</div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
        wrapper.innerHTML += html;
    });
}

function viewSchoolProfile(kod) {
    sessionStorage.setItem('smpid_user_kod', kod);
    window.location.href = 'user.html'; 
}

// ==========================================
// 5. PENGURUSAN ADMIN & ROLE MANAGEMENT
// ==========================================

async function resetPasswordSekolah(kod) {
    Swal.fire({
        title: 'Reset Password?',
        text: `Anda pasti mahu menetapkan semula kata laluan untuk ${kod} kepada default?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Reset',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient
                    .from('smpid_users')
                    .update({ password: 'ppdag@12345' })
                    .eq('kod_sekolah', kod);
                
                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Berjaya', `Kata laluan ${kod} telah di-reset kepada: ppdag@12345`, 'success');
            } catch (err) {
                window.toggleLoading(false);
                console.error(err);
                Swal.fire('Ralat', 'Gagal reset password.', 'error');
            }
        }
    });
}

async function loadAdminList() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_users')
            .select('*')
            .in('role', ['ADMIN', 'PPD_UNIT']) 
            .order('email', { ascending: true });

        if (error) throw error;
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="alert alert-warning">Tiada data admin dijumpai.</div>`;
            return;
        }

        let html = `
        <table class="table table-hover table-bordered align-middle mb-0 bg-white">
            <thead class="bg-light">
                <tr>
                    <th class="small text-uppercase text-secondary">Emel</th>
                    <th class="small text-uppercase text-secondary">Peranan</th>
                    <th class="small text-uppercase text-secondary">Kata Laluan</th>
                    <th class="small text-uppercase text-secondary text-center" style="width: 150px;">Tindakan</th>
                </tr>
            </thead>
            <tbody>`;

        data.forEach(user => {
            const roleBadge = user.role === 'ADMIN' 
                ? `<span class="badge bg-primary">ADMIN</span>` 
                : `<span class="badge bg-indigo" style="background-color: #4b0082;">UNIT PPD</span>`;

            html += `
            <tr>
                <td class="fw-bold text-dark small">${user.email}</td>
                <td class="small">${roleBadge}</td>
                <td class="font-monospace text-muted small">${user.password}</td>
                <td class="text-center">
                    <button onclick="updateAdminRole('${user.id}', '${user.role}')" class="btn btn-sm btn-outline-primary me-1" title="Tukar Peranan">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="padamAdmin('${user.id}', '${user.email}')" class="btn btn-sm btn-outline-danger" title="Padam Akaun">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;
        });

        html += `</tbody></table>`;
        wrapper.innerHTML = html;

    } catch (err) {
        console.error(err);
        wrapper.innerHTML = `<div class="alert alert-danger">Gagal memuatkan senarai admin.</div>`;
    }
}

async function tambahAdmin() {
    const emailInput = document.getElementById('inputNewAdminEmail');
    const roleInput = document.getElementById('inputNewAdminRole');
    const passInput = document.getElementById('inputNewAdminPass');
    
    if (!emailInput || !passInput || !roleInput) return;
    
    const email = emailInput.value.trim();
    const role = roleInput.value;
    const password = passInput.value.trim();

    if (!email || !password) {
        Swal.fire('Ralat', 'Sila isi emel dan kata laluan.', 'warning');
        return;
    }

    window.toggleLoading(true);

    try {
        const newId = crypto.randomUUID();
        const { error } = await window.supabaseClient
            .from('smpid_users')
            .insert([{ 
                id: newId, 
                kod_sekolah: 'M030', 
                email: email, 
                password: password, 
                role: role 
            }]);

        if (error) throw error;

        window.toggleLoading(false);
        Swal.fire('Berjaya', `Pengguna (${role}) telah ditambah.`, 'success').then(() => {
            emailInput.value = '';
            passInput.value = '';
            loadAdminList(); 
        });

    } catch (err) {
        window.toggleLoading(false);
        console.error(err);
        Swal.fire('Ralat', 'Gagal menambah admin. Pastikan emel unik.', 'error');
    }
}

async function updateAdminRole(id, currentRole) {
    const { value: newRole } = await Swal.fire({
        title: 'Kemaskini Peranan',
        input: 'radio',
        inputOptions: {
            'ADMIN': 'ADMIN (Akses Penuh)',
            'PPD_UNIT': 'UNIT PPD (Pencapaian Sahaja)'
        },
        inputValue: currentRole,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal'
    });

    if (newRole && newRole !== currentRole) {
        window.toggleLoading(true);
        try {
            const { error } = await window.supabaseClient
                .from('smpid_users')
                .update({ role: newRole })
                .eq('id', id);

            if (error) throw error;

            window.toggleLoading(false);
            Swal.fire('Berjaya', 'Peranan pengguna dikemaskini.', 'success').then(() => loadAdminList());
        } catch (err) {
            window.toggleLoading(false);
            Swal.fire('Ralat', 'Gagal mengemaskini peranan.', 'error');
        }
    }
}

async function padamAdmin(id, email) {
    Swal.fire({
        title: 'Padam Admin?',
        text: `Anda pasti mahu memadam akses untuk ${email}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient
                    .from('smpid_users')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Berjaya', 'Akaun dipadam.', 'success').then(() => loadAdminList());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
}

// ==========================================
// 6. EXPORT & COPY TOOLS
// ==========================================

function eksportDataTapis() {
    if (!currentFilteredList || currentFilteredList.length === 0) { 
        Swal.fire('Tiada Data', 'Tiada data dalam paparan.', 'info'); 
        return; 
    }
    let csvContent = "BIL,KOD SEKOLAH,NAMA SEKOLAH,JENIS,NAMA GPICT,NO TEL GPICT,NAMA ADMIN DELIMA,NO TEL ADMIN,STATUS DATA,CATATAN\n";

    currentFilteredList.forEach((s, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        let statusStr = s.is_lengkap ? 'LENGKAP' : 'BELUM LENGKAP';
        let catatan = [];
        if (s.is_sama) catatan.push("Jawatan Sama");
        if (s.is_berbeza) catatan.push("Jawatan Berbeza");
        
        let row = [
            index + 1, clean(s.kod_sekolah), clean(s.nama_sekolah), clean(s.jenis),
            clean(s.nama_gpict), clean(s.no_telefon_gpict), clean(s.nama_admin_delima), clean(s.no_telefon_admin_delima),
            statusStr, clean(catatan.join(' & '))
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SMPID_Eksport_${activeStatus}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function janaSenaraiTelegram() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `**STATUS PENGISIAN SMPID (${activeType})**\n\n`;
    const pending = list.filter(i => !i.is_lengkap);
    
    if(pending.length === 0) { 
        Swal.fire('Hebat', 'Semua sekolah dah lengkap!', 'success'); 
        return; 
    }
    
    pending.forEach(i => txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`);
    txt += `\nMohon tindakan segera.`;
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', 'Senarai disalin.', 'success'));
}

// ==========================================
// 7. EMAIL BLASTER
// ==========================================

function generateList() {
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();
    
    if(!emailRawData || emailRawData.length === 0) {
        document.getElementById('countEmail').innerText = "0";
        document.getElementById('emailOutput').value = "";
        return;
    }

    emailRawData.forEach(row => {
        if (includeGpict && row.emel_delima_gpict) {
            const hasId = row.telegram_id_gpict;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) {
                uniqueEmails.add(row.emel_delima_gpict.trim());
            }
        }
        if (includeAdmin && row.emel_delima_admin_delima) {
            const hasId = row.telegram_id_admin;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) {
                uniqueEmails.add(row.emel_delima_admin_delima.trim());
            }
        }
    });

    const arr = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = arr.length;
    document.getElementById('emailOutput').value = arr.join(', ');
    
    const subject = encodeURIComponent(document.getElementById('msgSubject').value);
    const body = encodeURIComponent(document.getElementById('msgBody').value);
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${subject}&body=${body}`;
}

function copyEmails() { 
    const el = document.getElementById("emailOutput"); 
    if(!el.value) return; 
    el.select(); 
    navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', '', 'success')); 
}

function copyTemplate() { 
    navigator.clipboard.writeText(document.getElementById("msgBody").value).then(() => Swal.fire('Disalin', '', 'success')); 
}

// ==========================================
// 8. TINDAKAN PANTAS (QUEUE)
// ==========================================

function mulaTindakanPantas() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    
    list.forEach(i => {
        if (i.no_telefon_gpict && !i.telegram_id_gpict) {
            reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        }
        if (i.no_telefon_admin_delima && !i.telegram_id_admin) {
            reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
        }
    });
    
    if (reminderQueue.length === 0) { 
        Swal.fire('Tiada Sasaran', 'Semua lengkap/tiada no telefon.', 'info'); 
        return; 
    }
    
    qIndex = 0; 
    document.getElementById('queueModal').classList.remove('hidden'); 
    renderQueue();
}

function renderQueue() {
    if (qIndex >= reminderQueue.length) { 
        document.getElementById('queueModal').classList.add('hidden'); 
        Swal.fire('Selesai', 'Semakan tamat.', 'success'); 
        return; 
    }
    
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qRoleBadge').className = item.role === 'GPICT' ? 'badge bg-info text-dark mb-3' : 'badge bg-warning text-dark mb-3';
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "-";
    
    const link = window.generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    
    if (link) { 
        btn.href = link; 
        btn.classList.remove('disabled'); 
    } else { 
        btn.removeAttribute('href'); 
        btn.classList.add('disabled'); 
    }
}

function nextQueue() { qIndex++; renderQueue(); }
function prevQueue() { if(qIndex > 0) qIndex--; renderQueue(); }

// ==========================================
// 9. HELPDESK ADMIN
// ==========================================

async function loadTiketAdmin() {
    const wrapper = document.getElementById('adminTiketWrapper');
    const filter = document.getElementById('filterTiketAdmin')?.value || 'ALL';
    if(!wrapper) return;

    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

    try {
        let query = window.supabaseClient.from('smpid_aduan').select('*').order('created_at', { ascending: false });
        if (filter !== 'ALL') query = query.eq('status', filter);

        const { data, error } = await query;
        if (error) throw error;

        wrapper.innerHTML = "";
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="alert alert-light text-center">Tiada tiket dalam kategori ini.</div>`;
            return;
        }

        data.forEach(t => {
            const date = new Date(t.created_at).toLocaleString('ms-MY');
            const bgClass = t.status === 'SELESAI' ? 'bg-light opacity-75' : 'bg-white border-danger';
            
            let actionArea = "";
            if (t.status !== 'SELESAI') {
                actionArea = `
                <div class="mt-3 border-top pt-3 bg-light p-3 rounded">
                    <label class="small fw-bold mb-1">Balasan Admin PPD:</label>
                    <textarea id="reply-${t.id}" class="form-control form-control-sm mb-2" rows="2" placeholder="Tulis penyelesaian..." onblur="this.value = window.formatSentenceCase(this.value)"></textarea>
                    <div class="d-flex justify-content-between">
                        <button onclick="submitBalasanAdmin(${t.id}, '${t.kod_sekolah}', '${t.peranan_pengirim}', '${t.tajuk}')" class="btn btn-sm btn-primary">
                            <i class="fas fa-reply me-1"></i> Hantar & Tutup Tiket
                        </button>
                        <button onclick="padamTiket(${t.id})" class="btn btn-sm btn-outline-danger" title="Padam Tiket Ini"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>`;
            } else {
                actionArea = `
                <div class="d-flex justify-content-between align-items-end mt-2">
                    <div class="text-success small"><i class="fas fa-check-circle"></i> Diselesaikan pada: ${t.tarikh_balas ? new Date(t.tarikh_balas).toLocaleDateString() : '-'} <br> <b>Respon:</b> ${t.balasan_admin}</div>
                    <button onclick="padamTiket(${t.id})" class="btn btn-sm btn-outline-danger ms-2" title="Padam Tiket Ini"><i class="fas fa-trash-alt"></i></button>
                </div>`;
            }

            const card = `
            <div class="card mb-3 shadow-sm ${bgClass}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <span class="badge bg-dark me-2">${t.kod_sekolah}</span>
                            <span class="badge bg-secondary">${t.peranan_pengirim}</span>
                            <h6 class="mt-2 fw-bold text-dark">${t.tajuk}</h6>
                        </div>
                        <small class="text-muted">${date}</small>
                    </div>
                    <p class="text-secondary small mb-1 bg-light p-2 rounded">${t.butiran_masalah}</p>
                    ${actionArea}
                </div>
            </div>`;
            wrapper.innerHTML += card;
        });

    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="text-danger text-center">Ralat memuatkan tiket.</div>`;
    }
}

async function submitBalasanAdmin(id, kod, peranan, tajuk) {
    const replyText = document.getElementById(`reply-${id}`).value;
    if(!replyText) return Swal.fire('Kosong', 'Sila tulis balasan.', 'warning');
    
    const btn = event.currentTarget; 
    if(btn) btn.disabled = true;

    window.toggleLoading(true);
    try {
        const { error } = await window.supabaseClient
            .from('smpid_aduan')
            .update({ status: 'SELESAI', balasan_admin: replyText, tarikh_balas: new Date().toISOString() })
            .eq('id', id);
        
        if (error) throw error;

        // Notifikasi Balasan ke Telegram User
        if (window.DENO_API_URL) {
            fetch(`${window.DENO_API_URL}/reply-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: kod, peranan: peranan, tajuk: tajuk, balasan: replyText })
            }).catch(e => console.warn("Bot offline:", e));
        }

        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        Swal.fire('Selesai', 'Tiket ditutup & notifikasi dihantar.', 'success').then(() => loadTiketAdmin());

    } catch (e) {
        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
}

async function padamTiket(id) {
    Swal.fire({
        title: 'Padam Tiket Ini?',
        text: "Tindakan ini akan memadam rekod tiket secara kekal.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient.from('smpid_aduan').delete().eq('id', id);
                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Dipadam', 'Tiket telah dihapuskan.', 'success').then(() => loadTiketAdmin());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam tiket.', 'error');
            }
        }
    });
}

// ==========================================
// 10. MODUL ANALISA: DCS & DELIMA (AUTO DISCOVERY YEAR + GAP ANALYSIS)
// ==========================================

function getKategoriDcs(score) {
    if (score === null || score === 0) return { label: 'Tiada Data', color: '#6c757d', class: 'bg-secondary' };
    if (score < 2.00) return { label: 'Beginner', color: '#dc3545', class: 'bg-danger' };
    if (score <= 3.00) return { label: 'Novice', color: '#fd7e14', class: 'bg-warning text-dark' };
    if (score <= 4.00) return { label: 'Intermediate', color: '#ffc107', class: 'bg-warning' };
    if (score <= 4.74) return { label: 'Advance', color: '#0d6efd', class: 'bg-primary' };
    return { label: 'Innovator', color: '#198754', class: 'bg-success' };
}

async function loadDcsAdmin() {
    try {
        const { data, error } = await window.supabaseClient.from('smpid_dcs_analisa').select('*').order('nama_sekolah');
        if (error) throw error;
        dcsDataList = data;
        
        // AUTO-DISCOVERY YEAR: Panggil fungsi untuk kesan tahun
        populateDcsYears();

        // Update Dashboard (Guna tahun pertama dalam dropdown)
        updateDashboardAnalisa();
    } catch (err) { console.error("DCS Err", err); }
}

// NEW FUNCTION: KESAN TAHUN DARI DATABASE
function populateDcsYears() {
    const select = document.getElementById('pilihTahunAnalisa');
    if (!select || dcsDataList.length === 0) return;

    // Ambil sampel data pertama
    const sample = dcsDataList[0];
    const years = [];

    // Regex untuk cari 'dcs_2023', 'dcs_2024' dll.
    Object.keys(sample).forEach(key => {
        const match = key.match(/^dcs_(\d{4})$/);
        if (match) {
            years.push(parseInt(match[1]));
        }
    });

    // Susun Tahun (Descending: 2025, 2024...)
    years.sort((a, b) => b - a);

    // Jika tiada tahun dijumpai
    if (years.length === 0) {
        select.innerHTML = '<option value="" disabled>Tiada Data Tahun</option>';
        return;
    }

    // Bina HTML Options
    let html = '';
    years.forEach((y, index) => {
        const label = (index === 0) ? `DATA TAHUN ${y} (TERKINI)` : `DATA TAHUN ${y} (ARKIB)`;
        html += `<option value="${y}">${label}</option>`;
    });

    select.innerHTML = html;
    
    // Auto-select tahun terkini
    select.value = years[0];
}

function updateDashboardAnalisa() {
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value); 
    if (!currYear) return;

    const prevYear = currYear - 1; // Auto-calculate Previous Year

    const dcsFieldCurr = `dcs_${currYear}`;
    const activeFieldCurr = `peratus_aktif_${currYear}`;

    // Update Tajuk Lajur Table (DYNAMIC HEADER)
    const lblYearDcsPrev = document.getElementById('lblYearDcsPrev');
    const lblYearDcsCurr = document.getElementById('lblYearDcsCurr');
    
    if (lblYearDcsPrev) lblYearDcsPrev.innerText = `(${prevYear})`;
    if (lblYearDcsCurr) lblYearDcsCurr.innerText = `(${currYear})`;

    // Kemaskini Tajuk Modal Edit
    document.querySelectorAll('.year-label').forEach(el => el.innerText = currYear);
    if(document.getElementById('modalDcsYearTitle')) {
        document.getElementById('modalDcsYearTitle').innerText = currYear;
    }

    processDcsPanel(dcsFieldCurr); 
    processActivePanel(activeFieldCurr);
    
    // Render Table dengan Struktur Baru (7 Kolum)
    renderAnalisaTable(currYear, prevYear);
}

function processDcsPanel(field) {
    const ppdData = dcsDataList.find(d => d.kod_sekolah === 'M030');
    const ppdScore = (ppdData && ppdData[field]) ? ppdData[field] : 0;

    document.getElementById('kpiDcsScore').innerText = ppdScore.toFixed(2);
    const catPpd = getKategoriDcs(ppdScore);
    const lbl = document.getElementById('kpiDcsLabel');
    lbl.innerText = catPpd.label;
    lbl.className = `badge rounded-pill mt-2 px-3 py-2 ${catPpd.class}`;

    const schoolOnlyList = dcsDataList.filter(d => d.kod_sekolah !== 'M030');

    let cats = { 'Beginner': 0, 'Novice': 0, 'Intermediate': 0, 'Advance': 0, 'Innovator': 0 };
    schoolOnlyList.forEach(d => {
        const val = d[field];
        if (val !== null && val > 0) {
            const cat = getKategoriDcs(val).label;
            if (cats[cat] !== undefined) cats[cat]++;
        }
    });

    const ctx = document.getElementById('chartDcsDonut');
    if (charts.donut) charts.donut.destroy();
    charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{
                data: Object.values(cats),
                backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#0d6efd', '#198754'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } }
        }
    });

    const top5 = [...schoolOnlyList]
        .sort((a,b) => (b[field]||0) - (a[field]||0))
        .slice(0, 5);
        
    const top5HTML = top5.map((d,i) => `
        <tr>
            <td class="fw-bold">${i+1}</td>
            <td class="text-truncate" style="max-width:140px" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-end fw-bold text-primary">${d[field]?.toFixed(2) || '-'}</td>
        </tr>`).join('');
    document.getElementById('tableTopDcs').innerHTML = `<tbody>${top5HTML}</tbody>`;
}

function processActivePanel(field) {
    const ppdData = dcsDataList.find(d => d.kod_sekolah === 'M030');
    const ppdActive = (ppdData && ppdData[field]) ? ppdData[field] : 0;
    document.getElementById('kpiActiveScore').innerText = ppdActive;

    const schoolOnlyList = dcsDataList.filter(d => d.kod_sekolah !== 'M030');
    let ranges = { 'Tinggi (>80%)': 0, 'Sederhana (50-79%)': 0, 'Rendah (<50%)': 0 };
    schoolOnlyList.forEach(d => {
        const val = d[field];
        if (val !== null && val > 0) {
            if (val >= 80) ranges['Tinggi (>80%)']++;
            else if (val >= 50) ranges['Sederhana (50-79%)']++;
            else ranges['Rendah (<50%)']++;
        }
    });

    const ctx = document.getElementById('chartActiveBar');
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: 'Bilangan Sekolah',
                data: Object.values(ranges),
                backgroundColor: ['#198754', '#ffc107', '#dc3545'],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    const top5 = [...schoolOnlyList]
        .sort((a,b) => (b[field]||0) - (a[field]||0))
        .slice(0, 5);

    const top5HTML = top5.map((d,i) => `
        <tr>
            <td class="fw-bold">${i+1}</td>
            <td class="text-truncate" style="max-width:140px" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-end fw-bold text-success">${d[field] || '-'}%</td>
        </tr>`).join('');
    document.getElementById('tableTopActive').innerHTML = `<tbody>${top5HTML}</tbody>`;
}

function renderAnalisaTable(currYear, prevYear) {
    const wrapper = document.getElementById('tableAnalisaBody');
    if (!wrapper) return;
    
    const keyword = document.getElementById('searchAnalisa').value.toUpperCase();
    const list = keyword ? dcsDataList.filter(d => d.nama_sekolah.includes(keyword) || d.kod_sekolah.includes(keyword)) : dcsDataList;

    if(list.length === 0) return wrapper.innerHTML = `<tr><td colspan="7" class="text-center py-4">Tiada rekod.</td></tr>`;

    // Field Names
    const dcsC = `dcs_${currYear}`;
    const dcsP = `dcs_${prevYear}`;
    const actC = `peratus_aktif_${currYear}`;

    const html = list.map(d => {
        // --- 1. DATA PREPARATION ---
        const valDcsC = d[dcsC] !== null ? d[dcsC] : 0;
        const valDcsP = d[dcsP] !== null ? d[dcsP] : null; 
        
        // --- 2. TREND CALCULATION ---
        let trendBadge = `<span class="badge bg-light text-muted border">-</span>`;
        
        if (valDcsP !== null && valDcsC !== null) {
            const diff = valDcsC - valDcsP;
            const diffFixed = diff.toFixed(2);
            
            if (diff > 0.00) {
                trendBadge = `<span class="badge bg-success bg-opacity-10 text-success border border-success fw-bold"><i class="fas fa-arrow-up me-1"></i>+${diffFixed}</span>`;
            } else if (diff < 0.00) {
                trendBadge = `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger fw-bold"><i class="fas fa-arrow-down me-1"></i>${diffFixed}</span>`;
            } else {
                trendBadge = `<span class="badge bg-light text-dark border fw-bold">0.00</span>`;
            }
        } else if (valDcsP === null) {
             trendBadge = `<span class="badge bg-light text-muted border" title="Tiada data tahun lepas">Baru</span>`;
        }

        // --- 3. DCS DISPLAY ---
        const displayDcsC = valDcsC > 0 ? valDcsC.toFixed(2) : '-';
        const displayDcsP = valDcsP !== null ? valDcsP.toFixed(2) : '-';

        // --- 4. AKTIF DISPLAY ---
        const valActC = d[actC] !== null ? d[actC] : 0;
        const barColor = (valActC >= 80) ? 'bg-success' : (valActC >= 50 ? 'bg-warning' : 'bg-danger');

        return `
        <tr>
            <td class="fw-bold text-secondary align-middle text-center">${d.kod_sekolah}</td>
            <td class="align-middle">
                <div class="text-truncate fw-bold text-dark" style="max-width: 200px;" title="${d.nama_sekolah}">${d.nama_sekolah}</div>
            </td>
            
            <!-- KOLUM PREV YEAR -->
            <td class="text-center align-middle bg-light bg-opacity-50">
                <span class="text-muted fw-bold">${displayDcsP}</span>
            </td>

            <!-- KOLUM CURR YEAR -->
            <td class="text-center align-middle bg-primary bg-opacity-10">
                <span class="text-primary fw-bold fs-6">${displayDcsC}</span>
            </td>

            <!-- KOLUM TREND -->
            <td class="text-center align-middle">
                ${trendBadge}
            </td>

            <!-- KOLUM AKTIF -->
            <td class="text-center align-middle">
                <div class="d-flex align-items-center gap-2 justify-content-center">
                    <div class="progress flex-grow-1" style="height: 8px; max-width: 60px;">
                        <div class="progress-bar ${barColor}" role="progressbar" style="width: ${valActC}%"></div>
                    </div>
                    <span class="fw-bold small text-dark w-25 text-start">${valActC}%</span>
                </div>
            </td>

            <td class="text-center align-middle">
                <button onclick="openEditDcs('${d.kod_sekolah}')" class="btn btn-sm btn-light border text-primary shadow-sm rounded-circle" style="width: 32px; height: 32px;">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
    
    wrapper.innerHTML = html;
}

function filterAnalisaTable() {
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    const prevYear = currYear - 1;
    renderAnalisaTable(currYear, prevYear);
}

function openEditDcs(kod) {
    const item = dcsDataList.find(d => d.kod_sekolah === kod);
    if (!item) return;

    // Get current selected year from dropdown
    const year = document.getElementById('pilihTahunAnalisa').value;
    const dcsField = `dcs_${year}`;
    const activeField = `peratus_aktif_${year}`;

    document.getElementById('editKodSekolah').value = item.kod_sekolah;
    document.getElementById('displayEditNama').value = item.nama_sekolah;
    
    // Load data based on selected year dynamically
    document.getElementById('editDcsVal').value = (item[dcsField] !== null) ? item[dcsField] : '';
    document.getElementById('editAktifVal').value = (item[activeField] !== null) ? item[activeField] : '';

    const modal = new bootstrap.Modal(document.getElementById('modalEditDcs'));
    modal.show();
}

async function simpanDcs() {
    const kod = document.getElementById('editKodSekolah').value;
    const dcsVal = document.getElementById('editDcsVal').value;
    const aktifVal = document.getElementById('editAktifVal').value;
    const btn = document.querySelector('#formEditDcs button[type="submit"]');

    // Get current selected year
    const year = document.getElementById('pilihTahunAnalisa').value;
    if (!year) { Swal.fire('Ralat', 'Tahun tidak dipilih.', 'error'); return; }

    if (btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        // Construct payload with dynamic keys
        const payload = {};
        payload[`dcs_${year}`] = dcsVal ? parseFloat(dcsVal) : null;
        payload[`peratus_aktif_${year}`] = aktifVal ? parseFloat(aktifVal) : null;

        const { error } = await window.supabaseClient.from('smpid_dcs_analisa').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('modalEditDcs')).hide();
        window.toggleLoading(false);
        if (btn) btn.disabled = false;

        Swal.fire({ icon: 'success', title: 'Disimpan', timer: 1000, showConfirmButton: false });
        loadDcsAdmin(); // Reload data to reflect changes

    } catch (err) {
        window.toggleLoading(false);
        if (btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
}

// ==========================================
// 11. MODUL PENCAPAIAN & KEMENJADIAN (V2.1 - DYNAMIC YEAR)
// ==========================================

// NEW: Fungsi untuk populate dropdown tahun secara automatik dari DB
async function populateTahunFilter() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;

    // UI Loading state
    select.innerHTML = '<option value="" disabled selected>Memuatkan...</option>';
    select.disabled = true;

    try {
        // Fetch all distinct years from DB
        const { data, error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .select('tahun');

        if (error) throw error;

        // Extract unique years using Set & Sort Descending (2026, 2025...)
        const years = [...new Set(data.map(item => item.tahun))].sort((a, b) => b - a);

        select.innerHTML = ''; // Clear loading

        if (years.length === 0) {
            // Case: Empty DB
            select.innerHTML = '<option value="" disabled selected>TIADA REKOD</option>';
            select.disabled = true;
            
            // Clear table & stats manually since loadMasterPencapaian won't run
            const tbody = document.getElementById('tbodyPencapaianMaster');
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted fst-italic">Tiada rekod pencapaian dalam pangkalan data.</td></tr>`;
            
            // Reset Stats to 0
            ['statKebangsaan', 'statAntarabangsa', 'statGoogle', 'statApple', 'statMicrosoft', 'statLain'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).innerText = '-';
            });

        } else {
            // Option 1: SEMUA TAHUN
            const optAll = document.createElement('option');
            optAll.value = "ALL";
            optAll.innerText = "SEMUA TAHUN";
            select.appendChild(optAll);

            // Case: Years Found
            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.innerText = `TAHUN ${y}`;
                select.appendChild(opt);
            });
            select.disabled = false;
            
            // Select ALL as default
            select.value = "ALL";
            loadMasterPencapaian();
        }

    } catch (err) {
        console.error("Year Filter Error:", err);
        select.innerHTML = '<option value="" disabled selected>Ralat</option>';
    }
}

async function loadMasterPencapaian() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if (!tbody) return;
    
    // Safety check: Jika dropdown tahun disabled (tiada rekod), jangan fetch
    const tahunInput = document.getElementById('filterTahunPencapaian');
    if(tahunInput.disabled || !tahunInput.value) return;

    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>`;

    // Ambil Filter
    const tahun = tahunInput.value;
    const kategoriFilter = document.getElementById('filterKategoriPencapaian').value;
    const jenisFilter = document.getElementById('filterJenisPencapaian').value;

    try {
        let query = window.supabaseClient
            .from('smpid_pencapaian')
            .select('*');

        // Apply Year Filter (If not ALL)
        if (tahun !== 'ALL') {
            query = query.eq('tahun', tahun);
        }

        // Apply Ordering
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;
        pencapaianList = data;

        // --- 1. PENGIRAAN KPI STATISTIK UTAMA ---
        const totalKeb = data.filter(i => i.peringkat === 'KEBANGSAAN').length;
        const totalInt = data.filter(i => i.peringkat === 'ANTARABANGSA' || i.jenis_rekod === 'PENSIJILAN').length;
        
        document.getElementById('statKebangsaan').innerText = totalKeb;
        document.getElementById('statAntarabangsa').innerText = totalInt;

        // --- 2. PENGIRAAN KPI PENSIJILAN (LAPISAN 2) ---
        const countGoogle = data.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'GOOGLE').length;
        const countApple = data.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'APPLE').length;
        const countMicrosoft = data.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'MICROSOFT').length;
        const countLain = data.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'LAIN-LAIN').length;

        document.getElementById('statGoogle').innerText = countGoogle;
        document.getElementById('statApple').innerText = countApple;
        document.getElementById('statMicrosoft').innerText = countMicrosoft;
        document.getElementById('statLain').innerText = countLain;

        // --- 3. TAPIS UNTUK TABLE DISPLAY (FILTER TEMPATAN) ---
        let filteredData = data;
        
        if (kategoriFilter !== 'ALL') {
            filteredData = filteredData.filter(i => i.kategori === kategoriFilter);
        }
        
        if (jenisFilter !== 'ALL') {
             filteredData = filteredData.filter(i => i.jenis_rekod === jenisFilter);
        }

        if (filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted fst-italic">Tiada rekod untuk paparan ini.</td></tr>`;
            return;
        }

        let html = '';
        filteredData.forEach(item => {
            // LOGIK KHAS M030:
            let namaSekolah = "NAMA TIDAK DIJUMPAI";
            
            if (item.kod_sekolah === 'M030') {
                namaSekolah = '<span class="fw-bold text-indigo">PEJABAT PENDIDIKAN DAERAH ALOR GAJAH</span>';
            } else {
                const sekolahInfo = dashboardData.find(s => s.kod_sekolah === item.kod_sekolah);
                if (sekolahInfo) namaSekolah = sekolahInfo.nama_sekolah;
            }

            let badgeClass = 'bg-secondary';
            if (item.kategori === 'MURID') badgeClass = 'bg-info text-dark';
            else if (item.kategori === 'GURU') badgeClass = 'bg-warning text-dark';
            else if (item.kategori === 'SEKOLAH') badgeClass = 'bg-purple';
            else if (item.kategori === 'PEGAWAI') badgeClass = 'bg-dark text-white'; // Badge Pegawai
            else if (item.kategori === 'PPD') badgeClass = 'bg-primary text-white'; // Badge Unit

            let displayProgram = '';
            // let displayPeringkat = ''; // REMOVED as per request
            let displayPencapaian = '';

            if (item.jenis_rekod === 'PENSIJILAN') {
                let providerBadge = 'bg-secondary';
                if(item.penyedia === 'GOOGLE') providerBadge = 'bg-google';
                else if(item.penyedia === 'APPLE') providerBadge = 'bg-apple';
                else if(item.penyedia === 'MICROSOFT') providerBadge = 'bg-microsoft';

                displayProgram = `<span class="badge ${providerBadge} me-1 small"><i class="fas fa-certificate"></i></span> <span class="fw-bold small">${item.nama_pertandingan}</span>`;
                // displayPeringkat = `<span class="badge bg-dark small">PRO</span>`; // REMOVED
                displayPencapaian = `<span class="fw-bold text-dark small">${item.pencapaian}</span>`;

            } else {
                displayProgram = `<div class="small text-uppercase fw-bold text-primary">${item.nama_pertandingan}</div>`;
                // let rankBadge = item.peringkat === 'KEBANGSAAN' ? 'bg-primary' : 'bg-orange';
                // displayPeringkat = `<span class="badge ${rankBadge} small">${item.peringkat}</span>`; // REMOVED
                displayPencapaian = `<span class="fw-bold text-success small">${item.pencapaian}</span>`;
            }

            html += `
            <tr>
                <td class="fw-bold small">${item.kod_sekolah}</td>
                <td class="small text-truncate" style="max-width: 180px;" title="${namaSekolah.replace(/<[^>]*>?/gm, '')}">${namaSekolah}</td>
                <td class="text-center"><span class="badge ${badgeClass} shadow-sm" style="font-size: 0.7em">${item.kategori}</span></td>
                <td><div class="fw-bold text-dark small text-truncate" style="max-width: 150px;" title="${item.nama_peserta}">${item.nama_peserta}</div></td>
                <td>${displayProgram}</td>
                <!-- KOLUM TARAF DIBUANG DALAM HTML DAN JS -->
                <td class="text-center">${displayPencapaian}</td>
                <td class="text-center">
                    <a href="${item.pautan_bukti}" target="_blank" class="btn btn-sm btn-light border text-primary" title="Lihat Bukti">
                        <i class="fas fa-link"></i>
                    </a>
                </td>
                <td class="text-center">
                    <button onclick="hapusPencapaianAdmin(${item.id})" class="btn btn-sm btn-outline-danger" title="Padam Rekod">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-danger">Gagal memuatkan data.</td></tr>`;
    }
}

async function hapusPencapaianAdmin(id) {
    Swal.fire({
        title: 'Padam Rekod?',
        text: "Tindakan ini kekal dan tidak boleh dikembalikan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient.from('smpid_pencapaian').delete().eq('id', id);
                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Dipadam', 'Rekod berjaya dipadam.', 'success').then(() => loadMasterPencapaian());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
}

// ==========================================
// 12. LOGIK REKOD PPD (NEW MODULE)
// ==========================================

function openModalPPD() {
    const modal = new bootstrap.Modal(document.getElementById('modalRekodPPD'));
    modal.show();
}

function toggleKategoriPPD() {
    const isUnit = document.getElementById('radUnit').checked;
    const lbl = document.getElementById('lblPpdNamaPeserta');
    const inp = document.getElementById('ppdInputNama');
    
    if (isUnit) {
        lbl.innerText = "NAMA UNIT / SEKTOR";
        inp.placeholder = "Contoh: SEKTOR PEMBELAJARAN";
    } else {
        lbl.innerText = "NAMA PEGAWAI";
        inp.placeholder = "Taip nama penuh...";
    }
}

function toggleJenisPencapaianPPD() {
    const isPensijilan = document.getElementById('radPpdPensijilan').checked;
    
    // Elements
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const rowPeringkat = document.getElementById('rowPpdPeringkat');
    const divTahunOnly = document.getElementById('divPpdTahunOnly');
    
    const lblProgram = document.getElementById('lblPpdProgram');
    const inpProgram = document.getElementById('ppdInputProgram');
    
    const lblPencapaian = document.getElementById('lblPpdPencapaian');
    const inpPencapaian = document.getElementById('ppdInputPencapaian');

    // Update Hidden Input (Important for save logic)
    document.getElementById('ppdInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isPensijilan) {
        // UI MODE: PENSIJILAN
        divPenyedia.classList.remove('hidden');
        rowPeringkat.classList.add('hidden'); // Sembunyi dropdown peringkat
        divTahunOnly.classList.remove('hidden'); // Tunjuk input tahun sahaja

        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        
        lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2 / LEVEL 1";

    } else {
        // UI MODE: PERTANDINGAN (Default)
        divPenyedia.classList.add('hidden');
        rowPeringkat.classList.remove('hidden'); // Tunjuk dropdown peringkat
        divTahunOnly.classList.add('hidden');

        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }
}

async function simpanPencapaianPPD() {
    const btn = document.querySelector('#formPencapaianPPD button[type="submit"]');

    // Ambil Data Asas
    const radKategori = document.querySelector('input[name="radKatPPD"]:checked').value; // PEGAWAI atau PPD
    const jenisRekod = document.getElementById('ppdInputJenisRekod').value;
    const nama = document.getElementById('ppdInputNama').value.trim().toUpperCase();
    
    // Logic Data Dinamik
    let penyedia = 'LAIN-LAIN';
    let peringkat = 'KEBANGSAAN';
    let tahun = 2024;
    
    if (jenisRekod === 'PENSIJILAN') {
        penyedia = document.getElementById('ppdInputPenyedia').value;
        peringkat = 'ANTARABANGSA'; // Default Profesional
        tahun = document.getElementById('ppdInputTahun2').value; // Ambil dari input tahun standalone
    } else {
        penyedia = 'LAIN-LAIN';
        peringkat = document.getElementById('ppdInputPeringkat').value;
        tahun = document.getElementById('ppdInputTahun').value; // Ambil dari row peringkat
    }

    const program = document.getElementById('ppdInputProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('ppdInputPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('ppdInputLink').value.trim();

    // Validasi
    if (!nama || !program || !pencapaian || !link || !tahun) {
        Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
        return;
    }

    if (parseInt(tahun) < 2023) {
        Swal.fire('Tahun Tidak Sah', 'Rekod mestilah dari tahun 2023 dan ke atas.', 'warning');
        return;
    }

    if(btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: 'M030', // FIXED KOD
            kategori: radKategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: parseInt(tahun),
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        const { error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .insert([payload]);

        if (error) throw error;

        window.toggleLoading(false);
        if(btn) btn.disabled = false;

        // Tutup Modal & Refresh
        bootstrap.Modal.getInstance(document.getElementById('modalRekodPPD')).hide();
        document.getElementById('formPencapaianPPD').reset();

        Swal.fire('Berjaya', 'Rekod PPD telah disimpan.', 'success').then(() => {
            // Pastikan tab PPD dipilih dalam filter jika mahu lihat terus?
            // Atau sekadar reload list
            populateTahunFilter(); // Reload senarai
        });

    } catch (err) {
        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyimpan rekod PPD.', 'error');
    }
}

// Bind Global Functions
window.setFilter = setFilter;
window.setType = setType;
window.viewSchoolProfile = viewSchoolProfile;
window.mulaTindakanPantas = mulaTindakanPantas;
window.janaSenaraiTelegram = janaSenaraiTelegram;
window.eksportDataTapis = eksportDataTapis;
window.generateList = generateList;
window.copyEmails = copyEmails;
window.copyTemplate = copyTemplate;
window.nextQueue = nextQueue;
window.prevQueue = prevQueue;
window.loadTiketAdmin = loadTiketAdmin;
window.submitBalasanAdmin = submitBalasanAdmin;
window.padamTiket = padamTiket;

// Bind Fungsi Admin (Users)
window.loadAdminList = loadAdminList;
window.tambahAdmin = tambahAdmin;
window.updateAdminRole = updateAdminRole; 
window.padamAdmin = padamAdmin;
window.resetPasswordSekolah = resetPasswordSekolah;
window.ubahKataLaluanSendiri = ubahKataLaluanSendiri; // BIND FUNGSI BARU

// Bind Fungsi Analisa DCS
window.loadDcsAdmin = loadDcsAdmin;
window.updateDashboardAnalisa = updateDashboardAnalisa;
window.filterAnalisaTable = filterAnalisaTable;
window.openEditDcs = openEditDcs;
window.simpanDcs = simpanDcs;
window.populateDcsYears = populateDcsYears;

// Bind Fungsi Pencapaian (BARU)
window.loadMasterPencapaian = loadMasterPencapaian;
window.hapusPencapaianAdmin = hapusPencapaianAdmin;
window.populateTahunFilter = populateTahunFilter;

// Bind Fungsi PPD (NEW)
window.openModalPPD = openModalPPD;
window.toggleKategoriPPD = toggleKategoriPPD;
window.toggleJenisPencapaianPPD = toggleJenisPencapaianPPD;
window.simpanPencapaianPPD = simpanPencapaianPPD;