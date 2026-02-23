/**
 * ADMIN MODULE: ANALYSIS (TAILWIND EDITION - SORTING ENABLED)
 * Menguruskan laporan DCS dan DELIMa dengan UI Tailwind.
 * Menambah fungsi pengisihan dinamik (Dynamic Sorting) pada jadual terperinci.
 */

import { DcsService } from '../services/dcs.service.js';
import { toggleLoading } from '../core/helpers.js';

let dcsDataList = [];
let currentFilteredDcs = []; 
let charts = { donut: null, bar: null };

// State untuk pengisihan jadual (Sorting State)
let analisaSortState = { column: '', direction: 'desc' };

/**
 * Memuatkan data DCS utama
 */
window.loadDcsAdmin = async function() {
    // Papar loading dalam tab
    const wrapper = document.getElementById('tableAnalisaBody');
    if (wrapper) wrapper.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 font-medium">Memuatkan data analisa...</td></tr>`;

    try {
        dcsDataList = await DcsService.getAll();
        populateDcsYears();
        window.updateDashboardAnalisa();
    } catch (err) { 
        console.error("Ralat memuatkan data DCS:", err);
        if (wrapper) wrapper.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold">Gagal memuatkan data.</td></tr>`;
    }
};

/**
 * Isi dropdown tahun
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
 * Update Dashboard Utama
 */
window.updateDashboardAnalisa = function() {
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value); 
    if (!currYear) return;
    const prevYear = currYear - 1; 

    const lblDcs = document.getElementById('lblYearDcs');
    const lblAktif = document.getElementById('lblYearAktif');
    
    // Label Header
    if(lblDcs) lblDcs.innerHTML = `<span class="opacity-70 font-normal ml-1 text-[10px]">(${currYear} vs ${prevYear})</span>`;
    if(lblAktif) lblAktif.innerHTML = `<span class="opacity-70 font-normal ml-1 text-[10px]">(${currYear} vs ${prevYear})</span>`;
    
    const titleEl = document.getElementById('modalDcsYearTitle');
    if(titleEl) titleEl.innerText = currYear;

    processDcsPanel(`dcs_${currYear}`); 
    processActivePanel(`peratus_aktif_${currYear}`);
    
    window.filterAnalisaTable(currYear, prevYear);
};

/**
 * Kategori Skor DCS
 */
function getKategoriDcs(score) {
    if (score === null || score === undefined || isNaN(score)) return { label: 'TIADA', color: 'text-slate-400', bg: 'bg-slate-100 border-slate-200' };
    if (score < 2) return { label: 'BEGINNER', color: 'text-red-700', bg: 'bg-red-100 border-red-200' };
    if (score <= 3) return { label: 'NOVICE', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-200' };
    if (score <= 4) return { label: 'INTERMEDIATE', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200' };
    if (score <= 4.74) return { label: 'ADVANCE', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' };
    return { label: 'INNOVATOR', color: 'text-green-700', bg: 'bg-green-100 border-green-200' };
}

/**
 * Panel DCS (Tailwind)
 */
function processDcsPanel(field) {
    const ppdData = dcsDataList.find(d => d.kod_sekolah === 'M030');
    const ppdScore = ppdData?.[field] || 0;
    
    document.getElementById('kpiDcsScore').innerText = ppdScore.toFixed(2);
    const cat = getKategoriDcs(ppdScore);
    
    const lbl = document.getElementById('kpiDcsLabel');
    if (lbl) {
        lbl.innerText = cat.label;
        lbl.className = `inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 border ${cat.bg} ${cat.color}`;
    }

    const schools = dcsDataList.filter(d => d.kod_sekolah !== 'M030');
    let cats = { 'Beginner':0, 'Novice':0, 'Intermediate':0, 'Advance':0, 'Innovator':0 };
    schools.forEach(d => { 
        const score = d[field];
        if (score !== null) cats[getKategoriDcs(score).label.charAt(0) + getKategoriDcs(score).label.slice(1).toLowerCase()]++; 
        // Nota: Label 'ADVANCE' -> 'Advance' untuk key matching
    });
    // Betulkan keys manually sebab function return UPPERCASE
    const chartData = [
        cats['Beginner'] || 0,
        cats['Novice'] || 0,
        cats['Intermediate'] || 0,
        cats['Advance'] || 0,
        cats['Innovator'] || 0
    ];

    // Chart.js
    const ctx = document.getElementById('chartDcsDonut');
    if(charts.donut) charts.donut.destroy();
    charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Beginner', 'Novice', 'Intermediate', 'Advance', 'Innovator'],
            datasets: [{ 
                data: chartData, 
                backgroundColor: ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'], 
                borderWidth: 0 
            }]
        },
        options: { 
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } }, 
            maintainAspectRatio: false,
            cutout: '70%'
        }
    });

    // Top 5 Table (Tailwind)
    const top5 = [...schools].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0,5);
    const tbody = document.getElementById('tableTopDcs');
    if(tbody) {
        tbody.innerHTML = top5.map((d,i) => `
            <tr class="border-b border-blue-50 last:border-0">
                <td class="p-3 font-bold text-slate-500 w-8">${i+1}</td>
                <td class="p-3 text-xs font-semibold text-slate-700 truncate max-w-[150px]" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
                <td class="p-3 text-right font-bold text-blue-600">${d[field]?.toFixed(2) || '-'}</td>
            </tr>
        `).join('');
    }
}

/**
 * Panel Aktif (Tailwind)
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
                backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                borderRadius: 4
            }] 
        },
        options: { 
            plugins: { legend: { display: false } }, 
            maintainAspectRatio: false,
            scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
        }
    });

    // Top 5 Active (Tailwind)
    const top5 = [...schools].sort((a,b) => (b[field]||0) - (a[field]||0)).slice(0,5);
    const tbody = document.getElementById('tableTopActive');
    if(tbody) {
        tbody.innerHTML = top5.map((d,i) => `
            <tr class="border-b border-green-50 last:border-0">
                <td class="p-3 font-bold text-slate-500 w-8">${i+1}</td>
                <td class="p-3 text-xs font-semibold text-slate-700 truncate max-w-[150px]" title="${d.nama_sekolah}">${d.nama_sekolah}</td>
                <td class="p-3 text-right font-bold text-green-600">${d[field] || '-'}%</td>
            </tr>
        `).join('');
    }
}

/**
 * Logik Mengurus Penukaran Arah Susunan (Sort)
 */
window.sortAnalisa = function(col) {
    if (analisaSortState.column === col) {
        // Tukar arah jika klik lajur yang sama
        analisaSortState.direction = analisaSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Set lajur baharu, default: desc untuk nombor, asc untuk teks
        analisaSortState.column = col;
        analisaSortState.direction = (col === 'kod' || col === 'nama') ? 'asc' : 'desc';
    }
    
    // Panggil fungsi render semula (akan baca status sort ini)
    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    window.filterAnalisaTable(currYear, currYear - 1);
};

/**
 * Filter & Render Main Table
 */
window.filterAnalisaTable = function(currYear, prevYear) {
    if(!currYear) currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    if(!prevYear) prevYear = currYear - 1;

    const keyword = document.getElementById('searchAnalisa')?.value.toUpperCase() || '';
    
    // Asingkan PPD dari senarai untuk manipulasi data
    const listWithoutPPD = dcsDataList.filter(d => d.kod_sekolah !== 'M030');
    
    // 1. Tapis carian
    let list = keyword 
        ? listWithoutPPD.filter(d => d.nama_sekolah.includes(keyword) || d.kod_sekolah.includes(keyword)) 
        : [...listWithoutPPD];
    
    // 2. Laksana logik susunan (Sorting) yang dibaiki integriti datanya
    if (analisaSortState.column) {
        list.sort((a, b) => {
            let valA, valB;
            
            if (analisaSortState.column === 'kod') {
                // Menormalkan kepada huruf besar bagi teks
                valA = String(a.kod_sekolah || '').toUpperCase(); 
                valB = String(b.kod_sekolah || '').toUpperCase();
            } else if (analisaSortState.column === 'nama') {
                valA = String(a.nama_sekolah || '').toUpperCase(); 
                valB = String(b.nama_sekolah || '').toUpperCase();
            } else if (analisaSortState.column === 'dcs') {
                // Menukarkan string kepada nilai mutlak (nombor apung) untuk perbandingan logik
                valA = parseFloat(a[`dcs_${currYear}`]) || 0; 
                valB = parseFloat(b[`dcs_${currYear}`]) || 0;
            } else if (analisaSortState.column === 'aktif') {
                valA = parseFloat(a[`peratus_aktif_${currYear}`]) || 0; 
                valB = parseFloat(b[`peratus_aktif_${currYear}`]) || 0;
            }

            if (valA < valB) return analisaSortState.direction === 'asc' ? -1 : 1;
            if (valA > valB) return analisaSortState.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    currentFilteredDcs = list;

    // 3. Kemaskini UI Ikon (Anak Panah Sort)
    const columns = ['kod', 'nama', 'dcs', 'aktif'];
    columns.forEach(c => {
        const th = document.getElementById(`th-analisa-${c}`);
        if(th) {
            const icon = th.querySelector('i.fas');
            if(icon) {
                // Reset semua ke default
                icon.className = 'fas fa-sort ml-1 opacity-50';
                
                // Set aktif jika ia lajur semasa
                if (analisaSortState.column === c) {
                    const arrowDir = analisaSortState.direction === 'asc' ? 'up' : 'down';
                    icon.className = `fas fa-sort-${arrowDir} ml-1 text-brand-600 opacity-100`;
                }
            }
        }
    });

    // 4. Render ke jadual
    const wrapper = document.getElementById('tableAnalisaBody');
    if(list.length === 0) return wrapper.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400">Tiada rekod sekolah dijumpai.</td></tr>`;

    wrapper.innerHTML = list.map(d => {
        // Data
        const valDcsCurr = d[`dcs_${currYear}`];
        const valActCurr = d[`peratus_aktif_${currYear}`];
        const valDcsPrev = d[`dcs_${prevYear}`];
        const valActPrev = d[`peratus_aktif_${prevYear}`];

        const cat = getKategoriDcs(valDcsCurr);
        
        // Trend Icons
        let dcsTrend = '';
        if (valDcsCurr !== null && valDcsPrev !== null) {
            if (valDcsCurr > valDcsPrev) dcsTrend = '<i class="fas fa-arrow-up text-green-500 text-[10px] ml-1"></i>';
            else if (valDcsCurr < valDcsPrev) dcsTrend = '<i class="fas fa-arrow-down text-red-500 text-[10px] ml-1"></i>';
        }

        let actTrend = '';
        if (valActCurr !== null && valActPrev !== null) {
            if (valActCurr > valActPrev) actTrend = '<i class="fas fa-arrow-up text-green-500 text-[10px] ml-1"></i>';
            else if (valActCurr < valActPrev) actTrend = '<i class="fas fa-arrow-down text-red-500 text-[10px] ml-1"></i>';
        }

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 border-b border-slate-100 font-mono text-xs font-bold text-slate-500">${d.kod_sekolah}</td>
                <td class="px-6 py-4 border-b border-slate-100 font-semibold text-slate-700 text-xs md:text-sm leading-snug">${d.nama_sekolah}</td>
                
                <!-- Kolum DCS -->
                <td class="px-6 py-4 border-b border-slate-100 text-center bg-blue-50/30">
                    <div class="flex flex-col items-center">
                        <div class="font-bold text-blue-700 text-sm">
                            ${valDcsCurr?.toFixed(2) || '-'} ${dcsTrend}
                        </div>
                        <span class="text-[10px] text-slate-400 mb-1">Prev: ${valDcsPrev?.toFixed(2) || '-'}</span>
                        <span class="inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${cat.bg} ${cat.color}">${cat.label}</span>
                    </div>
                </td>

                <!-- Kolum Aktif -->
                <td class="px-6 py-4 border-b border-slate-100 text-center bg-green-50/30">
                    <div class="flex flex-col items-center">
                        <div class="font-bold text-green-700 text-sm">
                            ${valActCurr || 0}% ${actTrend}
                        </div>
                        <span class="text-[10px] text-slate-400">Prev: ${valActPrev || 0}%</span>
                    </div>
                </td>

                <!-- Kolum Aksi -->
                <td class="px-6 py-4 border-b border-slate-100 text-center">
                    <button onclick="openEditDcs('${d.kod_sekolah}')" class="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition shadow-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');
};

/**
 * Buka Modal Edit (Tailwind)
 */
window.openEditDcs = function(kod) {
    const item = dcsDataList.find(d => d.kod_sekolah === kod);
    if (!item) return;
    const year = document.getElementById('pilihTahunAnalisa').value;
    
    document.getElementById('editKodSekolah').value = kod;
    document.getElementById('displayEditNama').value = item.nama_sekolah;
    document.getElementById('editDcsVal').value = item[`dcs_${year}`] || '';
    document.getElementById('editAktifVal').value = item[`peratus_aktif_${year}`] || '';
    
    // Buka modal dengan buang class hidden
    document.getElementById('modalEditDcs').classList.remove('hidden');
};

/**
 * Simpan Data
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
        document.getElementById('modalEditDcs').classList.add('hidden');
        Swal.fire({
            icon: 'success',
            title: 'Disimpan',
            text: 'Data telah dikemaskini.',
            timer: 1500,
            showConfirmButton: false,
            confirmButtonColor: '#22c55e'
        }).then(() => window.loadDcsAdmin());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menyimpan data.', 'error');
    }
};

window.eksportDcs = function() {
    if (!currentFilteredDcs || currentFilteredDcs.length === 0) {
        Swal.fire('Tiada Data', '', 'info');
        return;
    }

    const currYear = parseInt(document.getElementById('pilihTahunAnalisa').value);
    const prevYear = currYear - 1;
    let csvContent = `BIL,KOD,NAMA SEKOLAH,SKOR DCS ${currYear},SKOR DCS ${prevYear},AKTIF ${currYear}%,AKTIF ${prevYear}%\n`;

    currentFilteredDcs.forEach((d, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const valDcsCurr = d[`dcs_${currYear}`]?.toFixed(2) || '0.00';
        const valDcsPrev = d[`dcs_${prevYear}`]?.toFixed(2) || '0.00';
        const valActCurr = d[`peratus_aktif_${currYear}`] || '0';
        const valActPrev = d[`peratus_aktif_${prevYear}`] || '0';

        let row = [index + 1, clean(d.kod_sekolah), clean(d.nama_sekolah), valDcsCurr, valDcsPrev, valActCurr, valActPrev];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Analisa_DCS_${currYear}.csv`;
    link.click();
};