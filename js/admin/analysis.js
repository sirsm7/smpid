/**
 * MODUL ANALISA (js/admin/analysis.js)
 * Fungsi: Menguruskan Tab Analisa DCS & DELIMa (Charts & Tables)
 * Kemaskini: Text Wrapping Diaktifkan (Tiada Truncate)
 */

let dcsDataList = [];
let charts = { donut: null, bar: null };

async function loadDcsAdmin() {
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_dcs_analisa')
            .select('*')
            .order('nama_sekolah');
            
        if (error) throw error;
        dcsDataList = data;
        populateDcsYears();
        updateDashboardAnalisa();
    } catch (err) { 
        console.error("DCS Err", err); 
    }
}

function populateDcsYears() {
    const select = document.getElementById('pilihTahunAnalisa');
    if (!select || dcsDataList.length === 0) return;

    const sample = dcsDataList[0];
    const years = [];

    // Auto-detect columns dcs_XXXX
    Object.keys(sample).forEach(key => {
        const match = key.match(/^dcs_(\d{4})$/);
        if (match) {
            years.push(parseInt(match[1]));
        }
    });

    years.sort((a, b) => b - a); // Terkini di atas

    if (years.length === 0) {
        select.innerHTML = '<option value="" disabled>Tiada Data Tahun</option>';
        return;
    }

    let html = '';
    years.forEach((y, index) => {
        const label = (index === 0) ? `DATA TAHUN ${y} (TERKINI)` : `DATA TAHUN ${y} (ARKIB)`;
        html += `<option value="${y}">${label}</option>`;
    });

    select.innerHTML = html;
    select.value = years[0];
}

function updateDashboardAnalisa() {
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value); 
    if (!currYear) return;

    const prevYear = currYear - 1; 

    const dcsFieldCurr = `dcs_${currYear}`;
    const dcsFieldPrev = `dcs_${prevYear}`;
    const activeFieldCurr = `peratus_aktif_${currYear}`;
    const activeFieldPrev = `peratus_aktif_${prevYear}`;

    // Update UI Labels
    const lblYearDcs = document.getElementById('lblYearDcs');
    const lblYearAktif = document.getElementById('lblYearAktif');
    
    if (lblYearDcs) lblYearDcs.innerHTML = `<small class="text-dark opacity-75">(${currYear} vs ${prevYear})</small>`;
    if (lblYearAktif) lblYearAktif.innerHTML = `<small class="text-dark opacity-75">(${currYear} vs ${prevYear})</small>`;

    document.querySelectorAll('.year-label').forEach(el => el.innerText = currYear);
    if(document.getElementById('modalDcsYearTitle')) {
        document.getElementById('modalDcsYearTitle').innerText = currYear;
    }

    processDcsPanel(dcsFieldCurr); 
    processActivePanel(activeFieldCurr);
    renderAnalisaTable(currYear, prevYear);
}

// --- FUNGSI CHART & STATS ---
function getKategoriDcs(score) {
    if (score === null || score === 0) return { label: 'Tiada Data', color: '#6c757d', class: 'bg-secondary' };
    if (score < 2.00) return { label: 'Beginner', color: '#dc3545', class: 'bg-danger' };
    if (score <= 3.00) return { label: 'Novice', color: '#fd7e14', class: 'bg-warning text-dark' };
    if (score <= 4.00) return { label: 'Intermediate', color: '#ffc107', class: 'bg-warning' };
    if (score <= 4.74) return { label: 'Advance', color: '#0d6efd', class: 'bg-primary' };
    return { label: 'Innovator', color: '#198754', class: 'bg-success' };
}

function processDcsPanel(field) {
    // KPI PPD
    const ppdData = dcsDataList.find(d => d.kod_sekolah === 'M030');
    const ppdScore = (ppdData && ppdData[field]) ? ppdData[field] : 0;

    document.getElementById('kpiDcsScore').innerText = ppdScore.toFixed(2);
    const catPpd = getKategoriDcs(ppdScore);
    const lbl = document.getElementById('kpiDcsLabel');
    lbl.innerText = catPpd.label;
    lbl.className = `badge rounded-pill mt-2 px-3 py-2 ${catPpd.class}`;

    // Chart Data
    const schoolOnlyList = dcsDataList.filter(d => d.kod_sekolah !== 'M030');
    let cats = { 'Beginner': 0, 'Novice': 0, 'Intermediate': 0, 'Advance': 0, 'Innovator': 0 };
    
    schoolOnlyList.forEach(d => {
        const val = d[field];
        if (val !== null && val > 0) {
            const cat = getKategoriDcs(val).label;
            if (cats[cat] !== undefined) cats[cat]++;
        }
    });

    // Render Chart
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

    // Top 5 Table (UPDATED: Remove Truncate)
    const top5 = [...schoolOnlyList]
        .sort((a,b) => (b[field]||0) - (a[field]||0))
        .slice(0, 5);
        
    const top5HTML = top5.map((d,i) => `
        <tr>
            <td class="fw-bold align-middle">${i+1}</td>
            <td class="text-wrap align-middle" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-end fw-bold text-primary align-middle">${d[field]?.toFixed(2) || '-'}</td>
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

    // Top 5 Table (UPDATED: Remove Truncate)
    const top5 = [...schoolOnlyList]
        .sort((a,b) => (b[field]||0) - (a[field]||0))
        .slice(0, 5);

    const top5HTML = top5.map((d,i) => `
        <tr>
            <td class="fw-bold align-middle">${i+1}</td>
            <td class="text-wrap align-middle" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
            <td class="text-end fw-bold text-success align-middle">${d[field] || '-'}%</td>
        </tr>`).join('');
    document.getElementById('tableTopActive').innerHTML = `<tbody>${top5HTML}</tbody>`;
}

// --- FUNGSI TABLE UTAMA (UPDATED: Remove Truncate) ---
function renderAnalisaTable(currYear, prevYear) {
    const wrapper = document.getElementById('tableAnalisaBody');
    if (!wrapper) return;
    
    const keyword = document.getElementById('searchAnalisa').value.toUpperCase();
    const list = keyword ? dcsDataList.filter(d => d.nama_sekolah.includes(keyword) || d.kod_sekolah.includes(keyword)) : dcsDataList;

    if(list.length === 0) return wrapper.innerHTML = `<tr><td colspan="5" class="text-center py-4">Tiada rekod.</td></tr>`;

    const dcsC = `dcs_${currYear}`;
    const dcsP = `dcs_${prevYear}`;
    const actC = `peratus_aktif_${currYear}`;
    const actP = `peratus_aktif_${prevYear}`;

    const html = list.map(d => {
        const valDcsC = d[dcsC] !== null ? d[dcsC] : 0;
        const valDcsP = d[dcsP] !== null ? d[dcsP] : null;
        
        const cat = getKategoriDcs(valDcsC);
        let subTextDcs = `<span class="text-muted small">Tiada Data ${prevYear}</span>`;

        if (valDcsP !== null) {
            const diff = valDcsC - valDcsP;
            if (diff > 0) subTextDcs = `<span class="text-success small fw-bold" title="Meningkat"><i class="fas fa-arrow-up me-1"></i>${valDcsP.toFixed(2)}</span>`;
            else if (diff < 0) subTextDcs = `<span class="text-danger small fw-bold" title="Menurun"><i class="fas fa-arrow-down me-1"></i>${valDcsP.toFixed(2)}</span>`;
            else subTextDcs = `<span class="text-secondary small fw-bold" title="Kekal"><i class="fas fa-minus me-1"></i>${valDcsP.toFixed(2)}</span>`;
        }

        const valActC = d[actC] !== null ? d[actC] : 0;
        const valActP = d[actP] !== null ? d[actP] : null;

        let subTextAct = `<span class="text-muted small">Tiada Data ${prevYear}</span>`;
        if (valActP !== null) {
            const diffAct = valActC - valActP;
            if (diffAct > 0) subTextAct = `<span class="text-success small fw-bold"><i class="fas fa-arrow-up me-1"></i>${valActP}%</span>`;
            else if (diffAct < 0) subTextAct = `<span class="text-danger small fw-bold"><i class="fas fa-arrow-down me-1"></i>${valActP}%</span>`;
            else subTextAct = `<span class="text-secondary small fw-bold"><i class="fas fa-minus me-1"></i>${valActP}%</span>`;
        }

        const barColor = (valActC >= 80) ? 'bg-success' : (valActC >= 50 ? 'bg-warning' : 'bg-danger');

        return `
        <tr>
            <td class="fw-bold text-secondary align-middle">${d.kod_sekolah}</td>
            <td class="align-middle">
                <!-- Text Wrap Enabled -->
                <div class="text-wrap fw-bold text-dark" title="${d.nama_sekolah}">${d.nama_sekolah}</div>
            </td>
            <td class="text-center align-middle bg-light bg-opacity-25">
                <div class="d-flex flex-column align-items-center">
                    <span class="fw-black fs-6 text-dark">${valDcsC.toFixed(2)}</span>
                    <span class="badge ${cat.class} mb-1" style="font-size: 0.6rem;">${cat.label}</span>
                    <div class="border-top border-secondary w-50 my-1 opacity-25"></div>
                    ${subTextDcs}
                </div>
            </td>
            <td class="text-center align-middle">
                <div class="d-flex flex-column align-items-center">
                    <div class="d-flex align-items-center gap-2 mb-1 w-100 justify-content-center">
                        <span class="fw-bold fs-6">${valActC}%</span>
                        <div class="progress flex-grow-0" style="height: 6px; width: 50px;">
                            <div class="progress-bar ${barColor}" role="progressbar" style="width: ${valActC}%"></div>
                        </div>
                    </div>
                    ${subTextAct}
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

// --- FUNGSI EDIT DATA ---
function openEditDcs(kod) {
    const item = dcsDataList.find(d => d.kod_sekolah === kod);
    if (!item) return;

    const year = document.getElementById('pilihTahunAnalisa').value;
    const dcsField = `dcs_${year}`;
    const activeField = `peratus_aktif_${year}`;

    document.getElementById('editKodSekolah').value = item.kod_sekolah;
    document.getElementById('displayEditNama').value = item.nama_sekolah;
    
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

    const year = document.getElementById('pilihTahunAnalisa').value;
    if (!year) { Swal.fire('Ralat', 'Tahun tidak dipilih.', 'error'); return; }

    if (btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        const payload = {};
        payload[`dcs_${year}`] = dcsVal ? parseFloat(dcsVal) : null;
        payload[`peratus_aktif_${year}`] = aktifVal ? parseFloat(aktifVal) : null;

        const { error } = await window.supabaseClient.from('smpid_dcs_analisa').update(payload).eq('kod_sekolah', kod);
        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('modalEditDcs')).hide();
        window.toggleLoading(false);
        if (btn) btn.disabled = false;

        Swal.fire({ icon: 'success', title: 'Disimpan', timer: 1000, showConfirmButton: false });
        loadDcsAdmin(); // Refresh

    } catch (err) {
        window.toggleLoading(false);
        if (btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
}

// EXPORTS
window.loadDcsAdmin = loadDcsAdmin;
window.updateDashboardAnalisa = updateDashboardAnalisa;
window.filterAnalisaTable = filterAnalisaTable;
window.openEditDcs = openEditDcs;
window.simpanDcs = simpanDcs;