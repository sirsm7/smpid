let storedData = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let reminderQueue = [];
let qIndex = 0;

// --- INIT DASHBOARD ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Semakan Keselamatan Session
    if (sessionStorage.getItem('smpid_auth') !== 'true') {
        Swal.fire('Akses Ditolak', 'Sila log masuk semula.', 'error').then(() => {
            window.location.href = 'index.html';
        });
        return;
    }
    // 2. Mula ambil data
    fetchDashboardData();
});

// --- DATA FETCHING ---
async function fetchDashboardData() {
    toggleLoading(true);
    try {
        const { data, error } = await supabaseClient
            .from('sekolah_data')
            .select('*')
            .order('nama_sekolah', { ascending: true });
            
        if (error) throw error;
        
        // Mapping data dengan Validasi Ketat (6 Medan Wajib)
        storedData = data.map(i => {
            // Senarai medan yang wajib diisi
            const requiredFields = [
                i.nama_gpict, 
                i.no_telefon_gpict, 
                i.emel_delima_gpict,
                i.nama_admin_delima, 
                i.no_telefon_admin_delima, 
                i.emel_delima_admin_delima
            ];

            // Semak jika semua medan wujud dan tidak kosong
            const isDataComplete = requiredFields.every(field => field && field.trim() !== "");

            return {
                ...i, 
                jenis: i.jenis_sekolah || 'LAIN-LAIN',
                is_lengkap: isDataComplete
            };
        });

        renderFilters();
        runFilter();
        toggleLoading(false);
    } catch (err) { 
        toggleLoading(false); 
        console.error(err);
        Swal.fire('Ralat', 'Gagal memuatkan data database.', 'error'); 
    }
}

// --- FILTERING ---
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
          <div class="col-md-4"><select class="form-select rounded-pill shadow-sm" onchange="setType(this.value)">${opts}</select></div>
        </div>`;
    }
}

function setFilter(s) { activeStatus = s; runFilter(); }
function setType(t) { activeType = t; runFilter(); }

function runFilter() {
    const filtered = storedData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap);
        
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        
        return statMatch && typeMatch;
    });

    document.querySelectorAll('.filter-badge').forEach(e => e.classList.remove('active'));
    if(activeStatus === 'ALL') document.getElementById('badgeAll').classList.add('active');
    if(activeStatus === 'LENGKAP') document.getElementById('badgeLengkap').classList.add('active');
    if(activeStatus === 'BELUM') document.getElementById('badgeBelum').classList.add('active');
    
    const context = (activeType === 'ALL') ? storedData : storedData.filter(i => i.jenis === activeType);
    document.getElementById('cntAll').innerText = context.length;
    document.getElementById('cntLengkap').innerText = context.filter(i => i.is_lengkap).length;
    document.getElementById('cntBelum').innerText = context.filter(i => !i.is_lengkap).length;

    renderGrid(filtered);
}

// --- RENDERING GRID (FIXED: Event Bubbling & Button Logic) ---
function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="alert alert-light text-center w-100 mt-4">Tiada data dijumpai untuk kriteria ini.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { 
        (acc[i.jenis] = acc[i.jenis] || []).push(i); 
        return acc; 
    }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        let html = `
        <div class="mb-4 fade-up">
            <h5 class="category-header">${jenis} <span class="badge bg-white text-dark ms-2 border">${items.length}</span></h5>
            <div class="row g-3">`;
        
        items.forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="badge bg-success status-badge"><i class="fas fa-check me-1"></i>LENGKAP</span>` 
                : `<span class="badge bg-danger status-badge"><i class="fas fa-times me-1"></i>BELUM ISI</span>`;
            
            // Logic Pautan WhatsApp (Templat & Personal)
            const linkG_Template = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, false);
            const linkG_Raw = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, true);
            
            const linkA_Template = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, false);
            const linkA_Raw = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, true);
            
            const hasTeleG = s.telegram_id_gpict && s.telegram_id_gpict.toString().trim() !== "";
            const hasTeleA = s.telegram_id_admin && s.telegram_id_admin.toString().trim() !== "";

            // --- FUNGSI HELPER (DIPERBAIKI) ---
            const renderActions = (hasTele, linkTemplate, linkRaw) => {
                let buttonsHtml = '<div class="d-flex align-items-center gap-1">';

                // 1. Jika ada Telegram ID, papar lencana OK
                if (hasTele) {
                    buttonsHtml += `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="fas fa-check-circle"></i> OK</span>`;
                }

                // 2. Butang Personal Chat (Sentiasa ada jika nombor telefon wujud)
                // Guna event.stopPropagation() untuk elak buka profil sekolah
                if (linkRaw) {
                    buttonsHtml += `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-light border text-secondary" title="Mesej Personal"><i class="fas fa-comment"></i></a>`;
                }

                // 3. Butang Ingatkan (Hanya jika belum ada Telegram ID)
                if (!hasTele && linkTemplate) {
                     buttonsHtml += `<a href="${linkTemplate}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm btn-outline-success" title="Hantar Arahan Bot"><i class="fab fa-whatsapp"></i> Ingatkan</a>`;
                } else if (!linkRaw) {
                    // Jika tiada no telefon langsung
                    buttonsHtml += `<span class="text-muted small">-</span>`;
                }

                buttonsHtml += '</div>';
                return buttonsHtml;
            };

            const actionsGpict = renderActions(hasTeleG, linkG_Template, linkG_Raw);
            const actionsAdmin = renderActions(hasTeleA, linkA_Template, linkA_Raw);

            html += `
            <div class="col-6 col-md-4 col-lg-3">
              <!-- Kad Utama: onclick untuk buka profil -->
              <div class="card school-card h-100 cursor-pointer" onclick="viewSchoolProfile('${s.kod_sekolah}')">
                <div class="card-body p-3 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="fw-bold text-primary mb-0">${s.kod_sekolah}</h6>
                    ${statusBadge}
                  </div>
                  <p class="school-name mb-auto" title="${s.nama_sekolah}">${s.nama_sekolah}</p>
                </div>
                <div class="tele-status-row bg-light border-top">
                   <div class="row-item p-2"><span class="small fw-bold text-muted d-block mb-1">GPICT</span> ${actionsGpict}</div>
                   <div class="row-item p-2 border-top border-light"><span class="small fw-bold text-muted d-block mb-1">Admin</span> ${actionsAdmin}</div>
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
    window.location.href = 'profil.html';
}

function janaSenaraiTelegram() {
    let contextData = (activeType === 'ALL') ? storedData : storedData.filter(item => item.jenis === activeType);
    const belumIsi = contextData.filter(item => !item.is_lengkap);

    if (belumIsi.length === 0) { 
        Swal.fire('Tahniah!', 'Semua sekolah dalam paparan ini telah mengisi maklumat.', 'success'); 
        return; 
    }

    const groups = belumIsi.reduce((acc, item) => {
        const key = item.jenis || "LAIN-LAIN";
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    const tarikh = new Date().toLocaleDateString('ms-MY');
    let teks = `**STATUS PENGISIAN MAKLUMAT SMPID**\n`;
    teks += `Tarikh: ${tarikh}\n`;
    if(activeType !== 'ALL') teks += `Kategori: ${activeType}\n`;
    teks += `\nMohon perhatian sekolah-sekolah berikut untuk mengemaskini maklumat GPICT dan Admin DELIMa dengan segera:\n`;

    Object.keys(groups).sort().forEach(jenis => {
        teks += `\n*${jenis}*\n`; 
        groups[jenis].forEach((school, index) => { 
            teks += `${index + 1}. \`${school.kod_sekolah}\` - ${school.nama_sekolah}\n`; 
        });
    });

    teks += `\nSila kemaskini di sistem segera.\nTerima kasih.`;

    navigator.clipboard.writeText(teks).then(() => {
        Swal.fire({
            title: 'Berjaya Disalin!',
            html: 'Senarai sekolah yang belum isi telah disalin.<br>Boleh terus <b>Paste</b> di Telegram.',
            icon: 'success'
        });
    }).catch(err => {
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyalin teks.', 'error');
    });
}

// --- TINDAKAN PANTAS (QUEUE) ---
function mulaTindakanPantas() {
    let list = (activeType === 'ALL') ? storedData : storedData.filter(i => i.jenis === activeType);
    
    reminderQueue = [];
    
    list.forEach(i => {
        const telGpict = cleanPhone(i.no_telefon_gpict);
        const telAdmin = cleanPhone(i.no_telefon_admin_delima);
        const hasTeleG = i.telegram_id_gpict && i.telegram_id_gpict.toString().trim() !== "";
        const hasTeleA = i.telegram_id_admin && i.telegram_id_admin.toString().trim() !== "";

        if (telGpict && !hasTeleG) {
            reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        }
        if (telAdmin && !hasTeleA) {
            reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
        }
    });

    if (reminderQueue.length === 0) { 
        Swal.fire('Tiada Sasaran', 'Tiada staf yang memerlukan peringatan (sama ada sudah daftar bot atau tiada no telefon).', 'info'); 
        return; 
    }
    
    qIndex = 0;
    document.getElementById('queueModal').classList.remove('hidden');
    renderQueue();
}

function renderQueue() {
    if (qIndex >= reminderQueue.length) { 
        document.getElementById('queueModal').classList.add('hidden'); 
        Swal.fire('Selesai', 'Semua peringatan telah disemak.', 'success'); 
        return; 
    }
    
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `Sasaran ${qIndex + 1} / ${reminderQueue.length}`;
    
    const badge = document.getElementById('qRoleBadge');
    badge.innerText = item.role;
    badge.className = item.role === 'GPICT' ? 'badge bg-info text-dark mb-3' : 'badge bg-warning text-dark mb-3';

    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "Tiada Nama";
    
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
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

function confirmLogout() {
    Swal.fire({
        title: 'Log Keluar Admin?',
        text: "Anda akan kembali ke halaman log masuk utama.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Keluar'
    }).then((result) => {
        if (result.isConfirmed) {
            keluarSistem(true); 
        }
    });
}