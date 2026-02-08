/**
 * ADMIN MODULE: ANALYSIS (DEV)
 * Menguruskan laporan DCS dan DELIMa.
 * * FIXES:
 * - Removed truncation. Added text-wrap classes.
 * - NEW: Added CSV Export functionality based on current view.
 */

import { DcsService } from '../services/dcs.service.js';
import { toggleLoading } from '../core/helpers.js';

let dcsDataList = [];
let currentFilteredDcs = []; // Store currently filtered data for export
let charts = { donut: null, bar: null };

window.loadDcsAdmin = async function() {
    try {
        dcsDataList = await DcsService.getAll();
        populateDcsYears();
        window.updateDashboardAnalisa();
    } catch (err) { 
        console.error("DCS Err", err); 
    }
};

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

window.updateDashboardAnalisa = function() {
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value); 
    if (!currYear) return;
    const prevYear = currYear - 1; 

    const lblDcs = document.getElementById('lblYearDcs');
    const lblAktif = document.getElementById('lblYearAktif');
    if(lblDcs) lblDcs.innerHTML = `<small class="opacity-75">(${currYear} vs ${prevYear})</small>`;
    if(lblAktif) lblAktif.innerHTML = `<small class="opacity-75">(${currYear} vs ${prevYear})</small>`;
    document.querySelectorAll('.year-label').forEach(el => el.innerText = currYear);
    if(document.getElementById('modalDcsYearTitle')) document.getElementById('modalDcsYearTitle').innerText = currYear;

    processDcsPanel(`dcs_${currYear}`); 
    processActivePanel(`peratus_aktif_${currYear}`);
    window.filterAnalisaTable(currYear, prevYear);
};

function getKategoriDcs(score) {
    if (!score) return { label: 'Tiada', color: '#6c757d', class: 'bg-secondary' };
    if (score < 2) return { label: 'Beginner', color: '#dc3545', class: 'bg-danger' };
    if (score <= 3) return { label: 'Novice', color: '#fd7e14', class: 'bg-warning text-dark' };
    if (score <= 4) return { label: 'Intermediate', color: '#ffc107', class: 'bg-warning' };
    if (score <= 4.74) return { label: 'Advance', color: '#0d6efd', class: 'bg-primary' };
    return { label: 'Innovator', color: '#198754', class: 'bg-success' };
}

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
    schools.forEach(d => { if(d[field]) cats[getKategoriDcs(d[field]).label]++; });

    const ctx = document.getElementById('chartDcsDonut');
    if(charts.donut) charts.donut.destroy();
    charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.values(cats), backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#0d6efd', '#198754'], borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: 'right' } }, maintainAspectRatio: false }
    });

    const top5 = [...schools].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0,5);
    
    document.getElementById('tableTopDcs').innerHTML = `<tbody>${top5.map((d,i) => `<tr><td class="fw-bold align-middle">${i+1}</td><td class="text-wrap-safe align-middle">${d.nama_sekolah}</td><td class="text-end fw-bold text-primary align-middle">${d[field]?.toFixed(2) || '-'}</td></tr>`).join('')}</tbody>`;
}

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
        data: { labels: Object.keys(ranges), datasets: [{ data: Object.values(ranges), backgroundColor: ['#198754', '#ffc107', '#dc3545'] }] },
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false }
    });

    const top5 = [...schools].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0,5);
    
    document.getElementById('tableTopActive').innerHTML = `<tbody>${top5.map((d,i) => `<tr><td class="fw-bold align-middle">${i+1}</td><td class="text-wrap-safe align-middle">${d.nama_sekolah}</td><td class="text-end fw-bold text-success align-middle">${d[field] || '-'}%</td></tr>`).join('')}</tbody>`;
}

window.filterAnalisaTable = function(currYear, prevYear) {
    if(!currYear) currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    if(!prevYear) prevYear = currYear - 1;

    const keyword = document.getElementById('searchAnalisa').value.toUpperCase();
    const list = keyword ? dcsDataList.filter(d => d.nama_sekolah.includes(keyword) || d.kod_sekolah.includes(keyword)) : dcsDataList;
    
    // Update global filtered list for export
    currentFilteredDcs = list;

    const wrapper = document.getElementById('tableAnalisaBody');
    
    if(list.length === 0) return wrapper.innerHTML = `<tr><td colspan="5" class="text-center py-4">Tiada rekod.</td></tr>`;

    wrapper.innerHTML = list.map(d => {
        const valDcs = d[`dcs_${currYear}`]?.toFixed(2) || '-';
        const valAct = d[`peratus_aktif_${currYear}`] || 0;
        const cat = getKategoriDcs(d[`dcs_${currYear}`]);
        
        return `<tr><td class="fw-bold text-muted">${d.kod_sekolah}</td><td class="text-wrap-safe">${d.nama_sekolah}</td><td class="text-center"><span class="fw-bold">${valDcs}</span> <span class="badge ${cat.class}">${cat.label}</span></td><td class="text-center fw-bold text-success">${valAct}%</td><td class="text-center"><button onclick="openEditDcs('${d.kod_sekolah}')" class="btn btn-sm btn-light border"><i class="fas fa-edit"></i></button></td></tr>`;
    }).join('');
};

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
        Swal.fire('Berjaya', 'Data dikemaskini.', 'success').then(() => window.loadDcsAdmin());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menyimpan.', 'error');
    }
};

// --- NEW EXPORT FUNCTION ---
window.eksportDcs = function() {
    if (!currentFilteredDcs || currentFilteredDcs.length === 0) {
        Swal.fire('Tiada Data', 'Tiada data untuk dieksport pada paparan semasa.', 'info');
        return;
    }

    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    let csvContent = `BIL,KOD SEKOLAH,NAMA SEKOLAH,SKOR DCS ${currYear},PERATUS AKTIF ${currYear},KATEGORI DCS\n`;

    currentFilteredDcs.forEach((d, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const valDcs = d[`dcs_${currYear}`]?.toFixed(2) || '0.00';
        const valAct = d[`peratus_aktif_${currYear}`] || '0';
        const cat = getKategoriDcs(d[`dcs_${currYear}`]).label;

        let row = [
            index + 1,
            clean(d.kod_sekolah),
            clean(d.nama_sekolah),
            valDcs,
            valAct,
            cat
        ];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Laporan_DCS_DELIMa_${currYear}.csv`;
    link.click();
};