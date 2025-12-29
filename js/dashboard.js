let storedData = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let reminderQueue = [];
let qIndex = 0;

// Init Dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        alert("Akses Admin Sahaja."); window.location.href = 'index.html'; return;
    }
    fetchDashboardData();
});

async function fetchDashboardData() {
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient.from('sekolah_data').select('*').order('nama_sekolah', { ascending: true });
        if (error) throw error;
        
        storedData = data.map(i => ({...i, jenis: i.jenis_sekolah || 'LAIN-LAIN'}));
        renderFilters();
        runFilter();
        toggleLoading(false);
    } catch (err) { toggleLoading(false); Swal.fire('Ralat', 'Gagal memuatkan data.', 'error'); }
}

function renderFilters() {
    const types = [...new Set(storedData.map(i => i.jenis))].sort();
    let opts = `<option value="ALL">SEMUA JENIS SEKOLAH</option>`;
    types.forEach(t => opts += `<option value="${t}">${t}</option>`);
    
    const container = document.getElementById('filterContainer');
    if(container) {
        container.innerHTML = `
        <div class="row align-items-center g-3">
          <div class="col-md-8 col-12 d-flex flex-wrap gap-2">
            <span onclick="setFilter('ALL')" id="badgeAll" class="badge bg-secondary cursor-pointer filter-badge active p-2">Semua <span id="cntAll" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('LENGKAP')" id="badgeLengkap" class="badge bg-success cursor-pointer filter-badge p-2">Lengkap <span id="cntLengkap" class="badge bg-light text-dark ms-1">0</span></span>
            <span onclick="setFilter('BELUM')" id="badgeBelum" class="badge bg-danger cursor-pointer filter-badge p-2">Belum <span id="cntBelum" class="badge bg-light text-dark ms-1">0</span></span>
          </div>
          <div class="col-md-4"><select class="form-select rounded-pill" onchange="setType(this.value)">${opts}</select></div>
        </div>`;
    }
}

function setFilter(s) { activeStatus = s; runFilter(); }
function setType(t) { activeType = t; runFilter(); }

function runFilter() {
    const isComp = (i) => i.nama_gpict && i.nama_gpict.trim() !== "";
    const filtered = storedData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || (activeStatus === 'LENGKAP' && isComp(i)) || (activeStatus === 'BELUM' && !isComp(i));
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        return statMatch && typeMatch;
    });

    // Update Badges UI
    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    if(activeStatus === 'ALL') document.getElementById('badgeAll').classList.add('active');
    if(activeStatus === 'LENGKAP') document.getElementById('badgeLengkap').classList.add('active');
    if(activeStatus === 'BELUM') document.getElementById('badgeBelum').classList.add('active');
    
    // Update Counts
    const context = (activeType === 'ALL') ? storedData : storedData.filter(i => i.jenis === activeType);
    document.getElementById('cntAll').innerText = context.length;
    document.getElementById('cntLengkap').innerText = context.filter(isComp).length;
    document.getElementById('cntBelum').innerText = context.filter(i => !isComp(i)).length;

    renderGrid(filtered);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    wrapper.innerHTML = "";
    if (data.length === 0) { wrapper.innerHTML = `<div class="alert alert-light text-center">Tiada data.</div>`; return; }

    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `<div class="mb-4"><h5 class="category-header">${jenis} <span class="badge bg-secondary ms-2">${items.length}</span></h5><div class="row g-3">`;
        
        items.forEach(s => {
            const isComp = s.nama_gpict && s.nama_gpict.trim() !== "";
            const statusBadge = isComp ? `<span class="badge bg-success status-badge">DATA LENGKAP</span>` : `<span class="badge bg-danger status-badge">BELUM ISI</span>`;
            
            // Link Helper
            const linkG = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict);
            const linkA = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima);
            const icoG = s.telegram_id_gpict ? `<span class="status-active"><i class="fas fa-check-circle"></i></span>` : (linkG ? `<a href="${linkG}" target="_blank" class="wa-btn" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : `-`);
            const icoA = s.telegram_id_admin ? `<span class="status-active"><i class="fas fa-check-circle"></i></span>` : (linkA ? `<a href="${linkA}" target="_blank" class="wa-btn" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i></a>` : `-`);

            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="card school-card" onclick="sessionStorage.setItem('smpid_user_kod', '${s.kod_sekolah}'); window.location.href='profil.html'">
                <div class="card-body p-3">
                  <h6 class="fw-bold text-primary mb-1">${s.kod_sekolah}</h6>
                  <p class="school-name text-truncate" title="${s.nama_sekolah}">${s.nama_sekolah}</p>
                  ${statusBadge}
                </div>
                <div class="tele-status-row">
                   <div class="row-item"><span class="small fw-bold">GPICT</span> ${icoG}</div>
                   <div class="row-item border-top pt-1 mt-1 border-light"><span class="small fw-bold">Admin</span> ${icoA}</div>
                </div>
              </div>
            </div>`;
        });
        html += `</div></div>`;
        wrapper.innerHTML += html;
    });
}

function mulaTindakanPantas() {
    let list = (activeType === 'ALL') ? storedData : storedData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    list.forEach(i => {
        if (!i.telegram_id_gpict && cleanPhone(i.no_telefon_gpict)) reminderQueue.push({role:'GPICT', ...i, name: i.nama_gpict, tel: i.no_telefon_gpict});
        if (!i.telegram_id_admin && cleanPhone(i.no_telefon_admin_delima)) reminderQueue.push({role:'Admin', ...i, name: i.nama_admin_delima, tel: i.no_telefon_admin_delima});
    });

    if (reminderQueue.length === 0) { Swal.fire('Tahniah', 'Tiada sasaran peringatan.', 'success'); return; }
    qIndex = 0;
    document.getElementById('queueModal').classList.remove('hidden');
    renderQueue();
}

function renderQueue() {
    if (qIndex >= reminderQueue.length) { document.getElementById('queueModal').classList.add('hidden'); Swal.fire('Selesai', 'Senarai tamat.', 'success'); return; }
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.name || "Tiada Nama";
    document.getElementById('qWaBtn').href = generateWhatsAppLink(item.name, item.tel);
}

function nextQueue() { qIndex++; renderQueue(); }
function prevQueue() { if(qIndex > 0) qIndex--; renderQueue(); }
function janaSenaraiTelegram() { Swal.fire('Info', 'Fungsi senarai Telegram boleh ditambah di sini.', 'info'); } // Placeholder