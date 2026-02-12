/**
 * ADMIN MODULE: ANALYSIS (DEV)
 * Menguruskan laporan DCS dan DELIMa.
 * * PENAMBAHBAIKAN KRITIKAL:
 * - Mengubah label "Lalu" kepada "Terdahulu" untuk keselarasan terminologi laporan Malaysia.
 * - Memaparkan perbandingan Tahun Semasa vs Tahun Terdahulu dalam jadual.
 * - Indikator trend automatik (↑/↓) berdasarkan perbezaan skor.
 */

import { DcsService } from '../services/dcs.service.js';
import { toggleLoading } from '../core/helpers.js';

let dcsDataList = [];
let currentFilteredDcs = []; // Simpan data yang telah ditapis untuk kegunaan eksport
let charts = { donut: null, bar: null };

/**
 * Memuatkan data DCS utama daripada perkhidmatan DcsService.
 */
window.loadDcsAdmin = async function() {
    try {
        dcsDataList = await DcsService.getAll();
        populateDcsYears();
        window.updateDashboardAnalisa();
    } catch (err) { 
        console.error("Ralat memuatkan data DCS:", err); 
    }
};

/**
 * Mengenalpasti tahun-tahun yang tersedia dalam dataset dan mengisi dropdown pilihan tahun.
 */
function populateDcsYears() {
    const select = document.getElementById('pilihTahunAnalisa');
    if (!select || dcsDataList.length === 0) return;

    const sample = dcsDataList[0];
    const years = [];
    Object.keys(sample).forEach(key => {
        const match = key.match(/^dcs_(\d{4})$/);
        if (match) years.push(parseInt(match[1]));
    });
    years.sort((a, b) => b - a);

    let html = '';
    years.forEach((y, index) => {
        html += `<option value="${y}">DATA TAHUN ${y} ${index===0 ? '(TERKINI)' : ''}</option>`;
    });
    select.innerHTML = html;
    select.value = years[0];
}

/**
 * Mengemaskini keseluruhan paparan dashboard analisa termasuk carta dan jadual terperinci.
 */
window.updateDashboardAnalisa = function() {
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value); 
    if (!currYear) return;
    const prevYear = currYear - 1; 

    const lblDcs = document.getElementById('lblYearDcs');
    const lblAktif = document.getElementById('lblYearAktif');
    
    // Kemaskini label header untuk menunjukkan konteks perbandingan
    if(lblDcs) lblDcs.innerHTML = `<small class="opacity-75">(${currYear} vs ${prevYear})</small>`;
    if(lblAktif) lblAktif.innerHTML = `<small class="opacity-75">(${currYear} vs ${prevYear})</small>`;
    
    document.querySelectorAll('.year-label').forEach(el => el.innerText = currYear);
    if(document.getElementById('modalDcsYearTitle')) document.getElementById('modalDcsYearTitle').innerText = currYear;

    processDcsPanel(`dcs_${currYear}`); 
    processActivePanel(`peratus_aktif_${currYear}`);
    
    // Jalankan penapisan jadual dengan parameter tahun yang betul
    window.filterAnalisaTable(currYear, prevYear);
};

/**
 * Menentukan kategori skor DCS berdasarkan julat nilai rasmi Google/KPM.
 */
function getKategoriDcs(score) {
    if (score === null || score === undefined || isNaN(score)) return { label: 'Tiada', color: '#6c757d', class: 'bg-secondary' };
    if (score < 2) return { label: 'Beginner', color: '#dc3545', class: 'bg-danger' };
    if (score <= 3) return { label: 'Novice', color: '#fd7e14', class: 'bg-warning text-dark' };
    if (score <= 4) return { label: 'Intermediate', color: '#ffc107', class: 'bg-warning' };
    if (score <= 4.74) return { label: 'Advance', color: '#0d6efd', class: 'bg-primary' };
    return { label: 'Innovator', color: '#198754', class: 'bg-success' };
}

/**
 * Memproses visualisasi dan statistik bagi bahagian Skor DCS.
 */
function processDcsPanel(field) {
    const ppdData = dcsDataList.find(d => d.kod_sekolah === 'M030');
    const ppdScore = ppdData?.[field] || 0;
    
    document.getElementById('kpiDcsScore').innerText = ppdScore.toFixed(2);
    const cat = getKategoriDcs(ppdScore);
    const lbl = document.getElementById('kpiDcsLabel');
    lbl.innerText = cat.label;
    lbl.className = `badge rounded-pill mt-2 px-3 py-2 ${cat.class}`;

    const schools = dcsDataList.filter(d => d.kod_sekolah !== 'M030');
    let cats = { 'Beginner':0, 'Novice':0, 'Intermediate':0, 'Advance':0, 'Innovator':0 };
    schools.forEach(d => { 
        const score = d[field];
        if (score !== null) cats[getKategoriDcs(score).label]++; 
    });

    const ctx = document.getElementById('chartDcsDonut');
    if(charts.donut) charts.donut.destroy();
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
            plugins: { 
                legend: { position: 'right' } 
            }, 
            maintainAspectRatio: false 
        }
    });

    const top5 = [...schools].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0,5);
    
    document.getElementById('tableTopDcs').innerHTML = `<tbody>${top5.map((d,i) => `<tr><td class="fw-bold align-middle">${i+1}</td><td class="text-wrap-safe align-middle">${d.nama_sekolah}</td><td class="text-end fw-bold text-primary align-middle">${d[field]?.toFixed(2) || '-'}</td></tr>`).join('')}</tbody>`;
}

/**
 * Memproses visualisasi dan statistik bagi bahagian Peratus Aktif DELIMa.
 */
function processActivePanel(field) {
    const ppdData = dcsDataList.find(d => d.kod_sekolah === 'M030');
    document.getElementById('kpiActiveScore').innerText = ppdData?.[field] || 0;

    const schools = dcsDataList.filter(d => d.kod_sekolah !== 'M030');
    let ranges = { 'Tinggi (>80%)':0, 'Sederhana':0, 'Rendah':0 };
    schools.forEach(d => {
        const v = d[field];
        if(v >= 80) ranges['Tinggi (>80%)']++;
        else if(v >= 50) ranges['Sederhana']++;
        else if(v > 0) ranges['Rendah']++;
    });

    const ctx = document.getElementById('chartActiveBar');
    if(charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: Object.keys(ranges), 
            datasets: [{ 
                data: Object.values(ranges), 
                backgroundColor: ['#198754', '#ffc107', '#dc3545'] 
            }] 
        },
        options: { 
            plugins: { 
                legend: { display: false } 
            }, 
            maintainAspectRatio: false 
        }
    });

    const top5 = [...schools].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0,5);
    
    document.getElementById('tableTopActive').innerHTML = `<tbody>${top5.map((d,i) => `<tr><td class="fw-bold align-middle">${i+1}</td><td class="text-wrap-safe align-middle">${d.nama_sekolah}</td><td class="text-end fw-bold text-success align-middle">${d[field] || '-'}%</td></tr>`).join('')}</tbody>`;
}

/**
 * MENGKEMASKINI JADUAL DATA TERPERINCI
 * Menampilkan perbandingan antara Tahun Semasa dan Tahun Terdahulu dengan label "Terdahulu".
 */
window.filterAnalisaTable = function(currYear, prevYear) {
    if(!currYear) currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    if(!prevYear) prevYear = currYear - 1;

    const keyword = document.getElementById('searchAnalisa').value.toUpperCase();
    const list = keyword ? dcsDataList.filter(d => d.nama_sekolah.includes(keyword) || d.kod_sekolah.includes(keyword)) : dcsDataList;
    
    currentFilteredDcs = list;

    const wrapper = document.getElementById('tableAnalisaBody');
    if(list.length === 0) return wrapper.innerHTML = `<tr><td colspan="5" class="text-center py-4">Tiada rekod sekolah dijumpai.</td></tr>`;

    wrapper.innerHTML = list.map(d => {
        // Data Tahun Semasa
        const valDcsCurr = d[`dcs_${currYear}`];
        const valActCurr = d[`peratus_aktif_${currYear}`];
        
        // Data Tahun Terdahulu
        const valDcsPrev = d[`dcs_${prevYear}`];
        const valActPrev = d[`peratus_aktif_${prevYear}`];

        const cat = getKategoriDcs(valDcsCurr);
        
        // Pengiraan Trend DCS (Ikon)
        let dcsTrendIcon = '';
        if (valDcsCurr !== null && valDcsPrev !== null) {
            if (valDcsCurr > valDcsPrev) dcsTrendIcon = '<i class="fas fa-arrow-up text-success ms-1" style="font-size: 0.7rem;"></i>';
            else if (valDcsCurr < valDcsPrev) dcsTrendIcon = '<i class="fas fa-arrow-down text-danger ms-1" style="font-size: 0.7rem;"></i>';
        }

        // Pengiraan Trend Aktif (Ikon)
        let actTrendIcon = '';
        if (valActCurr !== null && valActPrev !== null) {
            if (valActCurr > valActPrev) actTrendIcon = '<i class="fas fa-arrow-up text-success ms-1" style="font-size: 0.7rem;"></i>';
            else if (valActCurr < valActPrev) actTrendIcon = '<i class="fas fa-arrow-down text-danger ms-1" style="font-size: 0.7rem;"></i>';
        }

        // Templat Paparan DCS (Label: Terdahulu)
        const dcsCellHtml = `
            <div class="d-flex flex-column align-items-center">
                <div class="mb-1">
                    <span class="fw-bold text-primary" style="font-size: 0.95rem;">${valDcsCurr?.toFixed(2) || '-'}</span> 
                    ${dcsTrendIcon}
                </div>
                <div class="text-muted small" style="font-size: 0.65rem;">
                    (Terdahulu: ${valDcsPrev?.toFixed(2) || '-'})
                </div>
                <span class="badge ${cat.class} mt-1" style="font-size: 0.6rem; letter-spacing: 0.3px;">${cat.label.toUpperCase()}</span>
            </div>
        `;

        // Templat Paparan % Aktif (Label: Terdahulu)
        const actCellHtml = `
            <div class="d-flex flex-column align-items-center">
                <div class="mb-1">
                    <span class="fw-bold text-success" style="font-size: 0.95rem;">${valActCurr || 0}%</span> 
                    ${actTrendIcon}
                </div>
                <div class="text-muted small" style="font-size: 0.65rem;">
                    (Terdahulu: ${valActPrev || 0}%)
                </div>
            </div>
        `;
        
        return `
            <tr class="align-middle">
                <td class="fw-bold text-muted small">${d.kod_sekolah}</td>
                <td class="text-wrap-safe fw-semibold" style="font-size: 0.85rem;">${d.nama_sekolah}</td>
                <td class="text-center bg-primary bg-opacity-10 border-end border-white">${dcsCellHtml}</td>
                <td class="text-center bg-success bg-opacity-10">${actCellHtml}</td>
                <td class="text-center">
                    <button onclick="openEditDcs('${d.kod_sekolah}')" class="btn btn-sm btn-white border shadow-sm rounded-3" title="Kemas Kini Data">
                        <i class="fas fa-edit text-secondary"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');
};

/**
 * Membuka modal suntingan untuk sekolah terpilih.
 */
window.openEditDcs = function(kod) {
    const item = dcsDataList.find(d => d.kod_sekolah === kod);
    if (!item) return;
    const year = document.getElementById('pilihTahunAnalisa').value;
    
    document.getElementById('editKodSekolah').value = kod;
    document.getElementById('displayEditNama').value = item.nama_sekolah;
    document.getElementById('editDcsVal').value = item[`dcs_${year}`] || '';
    document.getElementById('editAktifVal').value = item[`peratus_aktif_${year}`] || '';
    
    new bootstrap.Modal(document.getElementById('modalEditDcs')).show();
};

/**
 * Menyimpan data DCS yang telah disunting ke pangkalan data.
 */
window.simpanDcs = async function() {
    const kod = document.getElementById('editKodSekolah').value;
    const year = document.getElementById('pilihTahunAnalisa').value;
    const payload = {};
    payload[`dcs_${year}`] = parseFloat(document.getElementById('editDcsVal').value) || null;
    payload[`peratus_aktif_${year}`] = parseFloat(document.getElementById('editAktifVal').value) || null;

    toggleLoading(true);
    try {
        await DcsService.update(kod, payload);
        toggleLoading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalEditDcs')).hide();
        Swal.fire({
            icon: 'success',
            title: 'Berjaya',
            text: 'Data sekolah telah dikemaskini.',
            timer: 1500,
            showConfirmButton: false
        }).then(() => window.loadDcsAdmin());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menyimpan perubahan. Sila cuba lagi.', 'error');
    }
};

/**
 * Mengeksport paparan semasa ke format CSV dengan butiran lengkap.
 */
window.eksportDcs = function() {
    if (!currentFilteredDcs || currentFilteredDcs.length === 0) {
        Swal.fire('Tiada Data', 'Tiada data untuk dieksport pada paparan semasa.', 'info');
        return;
    }

    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    const prevYear = currYear - 1;
    let csvContent = `BIL,KOD SEKOLAH,NAMA SEKOLAH,SKOR DCS ${currYear},SKOR DCS ${prevYear},PERATUS AKTIF ${currYear},PERATUS AKTIF ${prevYear},KATEGORI DCS ${currYear}\n`;

    currentFilteredDcs.forEach((d, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const valDcsCurr = d[`dcs_${currYear}`]?.toFixed(2) || '0.00';
        const valDcsPrev = d[`dcs_${prevYear}`]?.toFixed(2) || '0.00';
        const valActCurr = d[`peratus_aktif_${currYear}`] || '0';
        const valActPrev = d[`peratus_aktif_${prevYear}`] || '0';
        const cat = getKategoriDcs(d[`dcs_${currYear}`]).label;

        let row = [
            index + 1,
            clean(d.kod_sekolah),
            clean(d.nama_sekolah),
            valDcsCurr,
            valDcsPrev,
            valActCurr,
            valActPrev,
            cat
        ];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Analisa_DCS_DELIMa_Perbandingan_${currYear}_vs_${prevYear}.csv`;
    link.click();
};