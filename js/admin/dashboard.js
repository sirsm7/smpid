/**
 * MODUL DASHBOARD (js/admin/dashboard.js)
 * Fungsi: Menguruskan paparan grid sekolah, filter status, dan tindakan pantas.
 * Kemaskini: Tambah Sorting Kod, Search Bar & Butang Reset Password
 */

// State Tempatan
let dashboardData = [];
let currentFilteredList = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let searchTerm = ''; // Variable carian
let reminderQueue = [];
let qIndex = 0;

// --- FUNGSI UTAMA: LOAD DATA ---
async function fetchDashboardData() {
    window.toggleLoading(true);
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('*')
            // SORTING: Kod Sekolah (A-Z)
            .order('kod_sekolah', { ascending: true }); 
            
        if (error) throw error;
        
        // Proses Data: Tambah flag status (Lengkap/Sama/Berbeza)
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

        // Simpan ke variable global (jika perlu diakses modul lain)
        window.globalDashboardData = processedData; 
        
        // Filter out PPD untuk paparan dashboard
        dashboardData = processedData.filter(item => item.jenis !== 'PPD');
        
        renderFilters();
        runFilter();

        window.toggleLoading(false);
    } catch (err) { 
        console.error("Dashboard Error:", err);
        window.toggleLoading(false); 
        Swal.fire('Ralat', 'Gagal memuatkan data dashboard.', 'error'); 
    }
}

// --- FUNGSI FILTER & RENDER ---
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

// FUNGSI CARIAN
function handleSearch(val) {
    searchTerm = val.toUpperCase().trim();
    runFilter();
}

function runFilter() {
    const filtered = dashboardData.filter(i => {
        // Filter 1: Status Badge
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap) ||
                          (activeStatus === 'SAMA' && i.is_sama) ||
                          (activeStatus === 'BERBEZA' && i.is_berbeza); 
        
        // Filter 2: Jenis Sekolah
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        
        // Filter 3: Carian Teks (Kod atau Nama)
        const searchMatch = !searchTerm || 
                            i.kod_sekolah.includes(searchTerm) || 
                            i.nama_sekolah.includes(searchTerm);

        return statMatch && typeMatch && searchMatch;
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
    
    const context = dashboardData.filter(i => {
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        const searchMatch = !searchTerm || i.kod_sekolah.includes(searchTerm) || i.nama_sekolah.includes(searchTerm);
        return typeMatch && searchMatch;
    });
    
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
                <div class="card-body p-3 d-flex flex-column">
                  
                  <!-- HEADER KAD (Kod & Reset Button) -->
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <h6 class="fw-bold text-primary mb-0 text-truncate" style="max-width: 100%;">${s.kod_sekolah}</h6>
                        <!-- BUTANG RESET: stopPropagation() penting supaya tak buka profil -->
                        <button onclick="event.stopPropagation(); window.resetPasswordSekolah('${s.kod_sekolah}')" 
                                class="btn btn-sm btn-link text-warning p-0 text-decoration-none small fw-bold mt-1" 
                                title="Reset Kata Laluan Kepada Default">
                            <i class="fas fa-key me-1"></i>Reset
                        </button>
                    </div>
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

// --- FUNGSI EKSPORT & COPY ---
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

// --- FUNGSI QUEUE (TINDAKAN PANTAS) ---
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

// EXPORTS (Untuk HTML)
window.fetchDashboardData = fetchDashboardData;
window.setFilter = setFilter;
window.setType = setType;
window.handleSearch = handleSearch;
window.viewSchoolProfile = viewSchoolProfile;
window.eksportDataTapis = eksportDataTapis;
window.janaSenaraiTelegram = janaSenaraiTelegram;
window.mulaTindakanPantas = mulaTindakanPantas;
window.nextQueue = nextQueue;
window.prevQueue = prevQueue;