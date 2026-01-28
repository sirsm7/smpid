/**
 * SMPID ADMIN PANEL MODULE (js/admin.js)
 * Versi: 7.0 (Restored Filters + Analisa DCS Integrated)
 * Fungsi: Dashboard Penuh (Grid/Reset Pass), Email, Helpdesk, Admin Mgmt & Analisa DCS/DELIMa
 */

// Global State
let dashboardData = [];
let emailRawData = [];
let currentFilteredList = [];
let activeStatus = 'ALL';
let activeType = 'ALL';

// Analisa State
let dcsDataList = [];
let charts = { donut: null, bar: null };

// Queue State
let reminderQueue = [];
let qIndex = 0;

// ==========================================
// 1. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initAdminPanel();
});

function initAdminPanel() {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        window.location.replace('index.html');
        return;
    }
    
    // Tab Listeners
    const tabMap = {
        'email-tab': generateList,
        'helpdesk-tab': loadTiketAdmin,
        'admin-users-tab': loadAdminList,
        'analisa-tab': loadDcsAdmin // Load data analisa bila tab dibuka
    };

    for (const [id, func] of Object.entries(tabMap)) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('shown.bs.tab', func);
    }
    
    // Muat data dashboard utama (Grid Sekolah) secara default
    fetchDashboardData(); 
}

// ==========================================
// 2. DASHBOARD UTAMA (Grid Sekolah)
// ==========================================

async function fetchDashboardData() {
    window.toggleLoading(true);
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('*')
            .order('nama_sekolah', { ascending: true });
            
        if (error) throw error;
        
        dashboardData = data.map(i => {
            const requiredFields = [i.nama_gpict, i.no_telefon_gpict, i.emel_delima_gpict, i.nama_admin_delima, i.no_telefon_admin_delima, i.emel_delima_admin_delima];
            const isDataComplete = requiredFields.every(f => f && f.trim() !== "");
            const telG = window.cleanPhone(i.no_telefon_gpict);
            const telA = window.cleanPhone(i.no_telefon_admin_delima);

            return { 
                ...i, 
                jenis: i.jenis_sekolah || 'LAIN-LAIN', 
                is_lengkap: isDataComplete, 
                is_sama: (telG && telA) && (telG === telA), 
                is_berbeza: (telG && telA) && (telG !== telA) 
            };
        });
        
        emailRawData = data; 
        renderFilters();
        runFilter();
        generateList(); 

        window.toggleLoading(false);
    } catch (err) { 
        console.error(err);
        window.toggleLoading(false); 
        Swal.fire('Ralat', 'Gagal memuatkan data pendaftaran.', 'error'); 
    }
}

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
            <!-- RESTORED FILTERS: JAWATAN SAMA & BERBEZA -->
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
                          (activeStatus === 'SAMA' && i.is_sama) ||      // Added Logic
                          (activeStatus === 'BERBEZA' && i.is_berbeza);   // Added Logic
        
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        return statMatch && typeMatch;
    });
    currentFilteredList = filtered;
    updateBadgeCounts();
    renderGrid(filtered);
}

function updateBadgeCounts() {
    // 1. Reset Active Class
    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    
    // 2. Set Active Badge Highlight
    let badgeId = 'badgeAll';
    if (activeStatus === 'LENGKAP') badgeId = 'badgeLengkap';
    else if (activeStatus === 'BELUM') badgeId = 'badgeBelum';
    else if (activeStatus === 'SAMA') badgeId = 'badgeSama';
    else if (activeStatus === 'BERBEZA') badgeId = 'badgeBerbeza';
    
    if (document.getElementById(badgeId)) {
        document.getElementById(badgeId).classList.add('active');
    }

    // 3. Update Numbers
    const context = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    
    const safeSetText = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };

    safeSetText('cntAll', context.length);
    safeSetText('cntLengkap', context.filter(i => i.is_lengkap).length);
    safeSetText('cntBelum', context.filter(i => !i.is_lengkap).length);
    safeSetText('cntSama', context.filter(i => i.is_sama).length);
    safeSetText('cntBerbeza', context.filter(i => i.is_berbeza).length);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    if (data.length === 0) return wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data untuk paparan ini.</div>`; 

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

            // Logik butang WhatsApp
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
                
                <!-- DROPDOWN MENU KEBAB -->
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

// Fungsi viewSchoolProfile
function viewSchoolProfile(kod) {
    sessionStorage.setItem('smpid_user_kod', kod);
    window.location.href = 'user.html'; 
}

// Fungsi Reset Password Sekolah
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
                    .update({ password: 'ppdag@12345' }) // Default Password
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

// ==========================================
// 3. MODUL ANALISA: DCS & DELIMA (TERPISAH)
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
        updateDashboardAnalisa();
    } catch (err) { console.error("DCS Err", err); }
}

function updateDashboardAnalisa() {
    const year = document.getElementById('pilihTahunAnalisa').value; 
    const dcsField = `dcs_${year}`;
    const aktifField = `peratus_aktif_${year}`;

    document.getElementById('lblYearDcs').innerText = year;
    document.getElementById('lblYearAktif').innerText = year;

    processDcsPanel(dcsField);
    processActivePanel(aktifField);
    renderAnalisaTable(year);
}

function processDcsPanel(field) {
    let totalScore = 0, count = 0;
    const cats = { 'Beginner': 0, 'Novice': 0, 'Intermediate': 0, 'Advance': 0, 'Innovator': 0 };

    dcsDataList.forEach(d => {
        const val = d[field];
        if (val !== null && val > 0) {
            totalScore += val;
            count++;
            const cat = getKategoriDcs(val).label;
            if(cats[cat] !== undefined) cats[cat]++;
        }
    });

    const avg = count > 0 ? (totalScore / count).toFixed(2) : "0.00";
    const catAvg = getKategoriDcs(parseFloat(avg));
    document.getElementById('kpiDcsScore').innerText = avg;
    const lbl = document.getElementById('kpiDcsLabel');
    lbl.innerText = catAvg.label;
    lbl.className = `badge rounded-pill mt-2 px-3 py-2 ${catAvg.class}`;

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

    const top5 = [...dcsDataList].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0, 5);
    const top5HTML = top5.map((d,i) => `
        <tr>
            <td class="fw-bold">${i+1}</td>
            <td class="text-truncate" style="max-width:140px" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-end fw-bold text-primary">${d[field]?.toFixed(2) || '-'}</td>
        </tr>`).join('');
    document.getElementById('tableTopDcs').innerHTML = `<tbody>${top5HTML}</tbody>`;
}

function processActivePanel(field) {
    let totalPct = 0, count = 0;
    const ranges = { 'Tinggi (>80%)': 0, 'Sederhana (50-79%)': 0, 'Rendah (<50%)': 0 };

    dcsDataList.forEach(d => {
        const val = d[field];
        if (val !== null && val > 0) {
            totalPct += val;
            count++;
            if (val >= 80) ranges['Tinggi (>80%)']++;
            else if (val >= 50) ranges['Sederhana (50-79%)']++;
            else ranges['Rendah (<50%)']++;
        }
    });

    const avg = count > 0 ? (totalPct / count).toFixed(0) : "0";
    document.getElementById('kpiActiveScore').innerText = avg;

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

    const top5 = [...dcsDataList].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0, 5);
    const top5HTML = top5.map((d,i) => `
        <tr>
            <td class="fw-bold">${i+1}</td>
            <td class="text-truncate" style="max-width:140px" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-end fw-bold text-success">${d[field] || '-'}%</td>
        </tr>`).join('');
    document.getElementById('tableTopActive').innerHTML = `<tbody>${top5HTML}</tbody>`;
}

function renderAnalisaTable(year) {
    const wrapper = document.getElementById('tableAnalisaBody');
    if (!wrapper) return;
    
    const keyword = document.getElementById('searchAnalisa').value.toUpperCase();
    const list = keyword ? dcsDataList.filter(d => d.nama_sekolah.includes(keyword) || d.kod_sekolah.includes(keyword)) : dcsDataList;

    if(list.length === 0) return wrapper.innerHTML = `<tr><td colspan="5" class="text-center py-4">Tiada rekod.</td></tr>`;

    const dcsField = `dcs_${year}`;
    const activeField = `peratus_aktif_${year}`;

    const html = list.map(d => {
        const dcsVal = d[dcsField];
        const activeVal = d[activeField];
        const cat = getKategoriDcs(dcsVal);
        const barColor = (activeVal >= 80) ? 'bg-success' : (activeVal >= 50 ? 'bg-warning' : 'bg-danger');
        const width = activeVal || 0;

        return `
        <tr>
            <td class="fw-bold text-secondary">${d.kod_sekolah}</td>
            <td class="text-truncate" style="max-width: 250px;" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-center">
                <div class="fw-bold text-dark">${dcsVal?.toFixed(2) || '-'}</div>
                <span class="badge ${cat.class} d-block mt-1" style="font-size:0.65rem">${cat.label}</span>
            </td>
            <td class="text-center align-middle">
                <div class="d-flex align-items-center">
                    <span class="fw-bold me-2" style="width: 30px;">${activeVal || 0}%</span>
                    <div class="progress flex-grow-1" style="height: 6px;">
                        <div class="progress-bar ${barColor}" role="progressbar" style="width: ${width}%"></div>
                    </div>
                </div>
            </td>
            <td class="text-center">
                <button onclick="openEditDcs('${d.kod_sekolah}')" class="btn btn-sm btn-light border text-primary shadow-sm">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
    
    wrapper.innerHTML = html;
}

function filterAnalisaTable() {
    renderAnalisaTable(document.getElementById('pilihTahunAnalisa').value);
}

// ==========================================
// 4. FUNGSI SUNTINGAN (EDIT)
// ==========================================

function openEditDcs(kod) {
    const item = dcsDataList.find(d => d.kod_sekolah === kod);
    if (!item) return;

    document.getElementById('editKodSekolah').value = item.kod_sekolah;
    document.getElementById('displayEditNama').value = item.nama_sekolah;
    
    document.getElementById('editDcsVal').value = item.dcs_2025 !== null ? item.dcs_2025 : '';
    document.getElementById('editAktifVal').value = item.peratus_aktif_2025 !== null ? item.peratus_aktif_2025 : '';

    const modal = new bootstrap.Modal(document.getElementById('modalEditDcs'));
    modal.show();
}

async function simpanDcs() {
    const kod = document.getElementById('editKodSekolah').value;
    const dcsVal = document.getElementById('editDcsVal').value;
    const aktifVal = document.getElementById('editAktifVal').value;
    const btn = document.querySelector('#formEditDcs button[type="submit"]');

    if (btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        const payload = {
            dcs_2025: dcsVal ? parseFloat(dcsVal) : null,
            peratus_aktif_2025: aktifVal ? parseFloat(aktifVal) : null
        };

        const { error } = await window.supabaseClient.from('smpid_dcs_analisa').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('modalEditDcs')).hide();
        window.toggleLoading(false);
        if (btn) btn.disabled = false;

        Swal.fire({ icon: 'success', title: 'Disimpan', timer: 1000, showConfirmButton: false });
        loadDcsAdmin(); 

    } catch (err) {
        window.toggleLoading(false);
        if (btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
}

// ==========================================
// 5. HELPER LAIN (Admin, Email, Queue)
// ==========================================

function mulaTindakanPantas() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    list.forEach(i => {
        if (i.no_telefon_gpict && !i.telegram_id_gpict) reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        if (i.no_telefon_admin_delima && !i.telegram_id_admin) reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
    });
    if (reminderQueue.length === 0) return Swal.fire('Tiada Sasaran', 'Semua lengkap.', 'info'); 
    qIndex = 0; document.getElementById('queueModal').classList.remove('hidden'); renderQueue();
}
function renderQueue() {
    if (qIndex >= reminderQueue.length) { document.getElementById('queueModal').classList.add('hidden'); return Swal.fire('Selesai', '', 'success'); }
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "-";
    const link = window.generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    if (link) { btn.href = link; btn.classList.remove('disabled'); } else { btn.removeAttribute('href'); btn.classList.add('disabled'); }
}
function nextQueue() { qIndex++; renderQueue(); }
function prevQueue() { if(qIndex > 0) qIndex--; renderQueue(); }

function generateList() { 
    const includeGpict = document.getElementById('checkGpict').checked;
    const includeAdmin = document.getElementById('checkAdmin').checked;
    const filterStatus = document.getElementById('statusFilter').value;
    const uniqueEmails = new Set();
    if(!emailRawData) return;
    emailRawData.forEach(row => {
        if (includeGpict && row.emel_delima_gpict) {
            const hasId = row.telegram_id_gpict;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) uniqueEmails.add(row.emel_delima_gpict.trim());
        }
        if (includeAdmin && row.emel_delima_admin_delima) {
            const hasId = row.telegram_id_admin;
            if (filterStatus === 'all' || (filterStatus === 'unregistered' && !hasId) || (filterStatus === 'registered' && hasId)) uniqueEmails.add(row.emel_delima_admin_delima.trim());
        }
    });
    const arr = Array.from(uniqueEmails);
    document.getElementById('countEmail').innerText = arr.length;
    document.getElementById('emailOutput').value = arr.join(', ');
    document.getElementById('mailtoLink').href = `mailto:?bcc=${arr.join(',')}&subject=${encodeURIComponent(document.getElementById('msgSubject').value)}&body=${encodeURIComponent(document.getElementById('msgBody').value)}`;
}
function copyEmails() { const el = document.getElementById("emailOutput"); if(el.value) { el.select(); navigator.clipboard.writeText(el.value).then(() => Swal.fire('Disalin', '', 'success')); }}
function copyTemplate() { navigator.clipboard.writeText(document.getElementById("msgBody").value).then(() => Swal.fire('Disalin', '', 'success')); }
function janaSenaraiTelegram() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `**STATUS PENGISIAN SMPID (${activeType})**\n\n`;
    const pending = list.filter(i => !i.is_lengkap);
    if(pending.length === 0) return Swal.fire('Hebat', 'Semua lengkap!', 'success'); 
    pending.forEach(i => txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`);
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', '', 'success'));
}
function eksportDataTapis() {
    if (!currentFilteredList || currentFilteredList.length === 0) return Swal.fire('Tiada Data', '', 'info');
    let csvContent = "BIL,KOD SEKOLAH,NAMA SEKOLAH,JENIS,STATUS DATA\n";
    currentFilteredList.forEach((s, index) => csvContent += `${index+1},"${s.kod_sekolah}","${s.nama_sekolah}","${s.jenis}",${s.is_lengkap ? 'LENGKAP' : 'BELUM'}\n`);
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `SMPID_List.csv`; link.click();
}

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
        if (data.length === 0) return wrapper.innerHTML = `<div class="alert alert-light text-center">Tiada tiket.</div>`;
        data.forEach(t => {
            const actionArea = t.status !== 'SELESAI' ? 
                `<button onclick="submitBalasanAdmin(${t.id}, '${t.kod_sekolah}', '${t.peranan_pengirim}', '${t.tajuk}')" class="btn btn-sm btn-primary w-100 mt-2">Tutup Tiket</button>` : 
                `<div class="text-success small mt-2"><i class="fas fa-check"></i> Selesai</div>`;
            wrapper.innerHTML += `<div class="card mb-3 shadow-sm p-3"><h6 class="fw-bold">${t.tajuk}</h6><p class="small mb-1">${t.butiran_masalah}</p>${actionArea}</div>`;
        });
    } catch (e) { wrapper.innerHTML = 'Ralat tiket.'; }
}
async function submitBalasanAdmin(id, kod, peranan, tajuk) {
    const { value: text } = await Swal.fire({ input: 'textarea', inputPlaceholder: 'Tulis balasan...', showCancelButton: true });
    if(text) {
        await window.supabaseClient.from('smpid_aduan').update({ status: 'SELESAI', balasan_admin: text, tarikh_balas: new Date().toISOString() }).eq('id', id);
        if (window.DENO_API_URL) fetch(`${window.DENO_API_URL}/reply-ticket`, { method: 'POST', body: JSON.stringify({ kod, peranan, tajuk, balasan: text }) }).catch(()=>{});
        loadTiketAdmin();
    }
}
async function loadAdminList() { 
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    try {
        const { data } = await window.supabaseClient.from('smpid_users').select('*').eq('role', 'ADMIN');
        wrapper.innerHTML = data.length ? data.map(u => `<div class="d-flex justify-content-between border-bottom py-2"><span>${u.email}</span><button onclick="padamAdmin('${u.id}', '${u.email}')" class="btn btn-sm btn-outline-danger"><i class="fas fa-trash"></i></button></div>`).join('') : '<div class="alert alert-warning">Tiada admin.</div>';
    } catch (err) {}
}
async function tambahAdmin() {
    const email = document.getElementById('inputNewAdminEmail').value.trim();
    const password = document.getElementById('inputNewAdminPass').value.trim();
    if(email && password) {
        await window.supabaseClient.from('smpid_users').insert([{ id: crypto.randomUUID(), kod_sekolah: 'M030', email, password, role: 'ADMIN' }]);
        Swal.fire('Berjaya', '', 'success'); loadAdminList();
    }
}
async function padamAdmin(id, email) {
    if(confirm(`Padam ${email}?`)) { await window.supabaseClient.from('smpid_users').delete().eq('id', id); loadAdminList(); }
}

// Bind Global Functions
window.mulaTindakanPantas = mulaTindakanPantas;
window.nextQueue = nextQueue;
window.prevQueue = prevQueue;
window.generateList = generateList;
window.copyEmails = copyEmails;
window.copyTemplate = copyTemplate;
window.janaSenaraiTelegram = janaSenaraiTelegram;
window.eksportDataTapis = eksportDataTapis;
window.loadTiketAdmin = loadTiketAdmin;
window.submitBalasanAdmin = submitBalasanAdmin;
window.loadAdminList = loadAdminList;
window.tambahAdmin = tambahAdmin;
window.padamAdmin = padamAdmin;
window.setFilter = setFilter;
window.setType = setType;
window.viewSchoolProfile = viewSchoolProfile; // DIKEMBALIKAN
window.resetPasswordSekolah = resetPasswordSekolah; // DIKEMBALIKAN

// Bind Fungsi Analisa Baru
window.loadDcsAdmin = loadDcsAdmin;
window.updateDashboardAnalisa = updateDashboardAnalisa;
window.filterAnalisaTable = filterAnalisaTable;
window.openEditDcs = openEditDcs;
window.simpanDcs = simpanDcs;