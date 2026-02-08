/**
 * modules/pppdm/script.js
 * Logik Papan Pemuka Analisa PPPDM (Modular Version - Fixed Scope)
 */

import { getDatabaseClient } from '../../js/core/db.js';

// CONFIG & STATE
const db = getDatabaseClient();
let globalData = [];
let filteredDataForCSV = []; 
let processedSchools = {};

// Filter State (Default: Tunjuk Semua)
let activeCardFilter = 'ALL'; 
let yearCurrent = new Date().getFullYear();
let yearPrev = yearCurrent - 1;

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    if(!db) { 
        console.error("Supabase client failed to initialize.");
        Swal.fire("Ralat Sistem", "Gagal menyambung ke pangkalan data. Sila muat semula.", "error");
        return; 
    }
    await fetchData();
});

// 1. FETCH DATA & TENTUKAN TAHUN
async function fetchData() {
    try {
        const { data, error } = await db.from('view_smpid_pppdm_analisa').select('*');
        if (error) throw error;
        
        const years = [...new Set(data.map(d => d.tahun))].filter(y => y).sort((a,b) => b - a);
        if (years.length > 0) yearCurrent = years[0];
        if (years.length > 1) yearPrev = years[1];

        updateYearLabels();
        processData(data);
        renderDashboard();

    } catch (e) {
        console.error("Fetch Error:", e);
        const tableBody = document.getElementById('comparisonTableBody');
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-red-500 font-bold">Ralat memuatkan data. Sila semak sambungan internet.</td></tr>`;
    }
}

function updateYearLabels() {
    const ids = {
        'header-year-curr': `${yearCurrent} (Terkini)`,
        'header-year-prev': `${yearPrev} (Terdahulu)`,
        'label-year-curr': `Aktif ${yearCurrent}`,
        'detail-lbl-curr': `Tahun ${yearCurrent}`,
        'detail-lbl-prev': `Tahun ${yearPrev}`
    };

    for (const [id, text] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if(el) el.innerText = text;
    }
}

// 2. PROSES DATA (PENTING: FILTER M030 DI SINI)
function processData(rawData) {
    processedSchools = {};
    
    rawData.forEach(row => {
        if (row.kod_sekolah === 'M030') return; 

        if (!processedSchools[row.kod_sekolah]) {
            processedSchools[row.kod_sekolah] = {
                kod: row.kod_sekolah,
                nama: row.nama_sekolah,
                parlimen: row.parlimen || "LAIN-LAIN",
                scores: {}, 
                activities: []
            };
            processedSchools[row.kod_sekolah].scores[yearCurrent] = 0;
            processedSchools[row.kod_sekolah].scores[yearPrev] = 0;
        }
        
        if (row.nama_program) {
            if (row.tahun) {
                processedSchools[row.kod_sekolah].scores[row.tahun] = (processedSchools[row.kod_sekolah].scores[row.tahun] || 0) + 1;
            }
            processedSchools[row.kod_sekolah].activities.push({
                tahun: row.tahun,
                program: row.nama_program
            });
        }
    });

    globalData = Object.values(processedSchools);
    populateParlimenFilter();
}

function populateParlimenFilter() {
    const parlimenSet = new Set(globalData.map(s => s.parlimen));
    const parlimenArray = [...parlimenSet].sort();
    
    const select = document.getElementById('filterParlimen');
    if(!select) return;
    
    select.innerHTML = '<option value="ALL">SEMUA PARLIMEN</option>';
    
    parlimenArray.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.innerText = p;
        select.appendChild(opt);
    });
}

// 3. RENDER DASHBOARD & KPI
function renderDashboard() {
    const totalSchools = globalData.length; 
    const activeSchoolsList = globalData.filter(s => s.activities.length > 0);
    const activeSchoolsCount = activeSchoolsList.length;
    const totalActs = globalData.reduce((acc, s) => acc + s.activities.length, 0);
    const currentActiveCount = globalData.filter(s => (s.scores[yearCurrent] || 0) > 0).length;
    const transformCount = globalData.filter(s => (s.scores[yearCurrent] || 0) > (s.scores[yearPrev] || 0)).length;
    const zeroCount = globalData.filter(s => s.activities.length === 0).length;

    const animateValue = (id, val) => { 
        const el = document.getElementById(id);
        if(el) el.innerText = val; 
    };
    
    animateValue('kpi-total-schools', totalSchools);
    animateValue('kpi-active-schools', activeSchoolsCount);
    animateValue('kpi-total-acts', totalActs);
    animateValue('kpi-year-curr', currentActiveCount);
    animateValue('kpi-transform', transformCount);
    animateValue('kpi-zero', zeroCount);

    applyFilters();
}

// 4. INTERACTIVE CARD FILTER
// EXPORT KE WINDOW UNTUK HTML ONCLICK
window.setCardFilter = function(type) {
    activeCardFilter = type;
    
    const cards = ['ALL', 'ACTIVE', 'TOTAL_ACTS', 'CURRENT', 'TRANSFORM', 'ZERO'];
    cards.forEach(c => {
        const el = document.getElementById(`card-${c}`);
        if(el) el.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-300', 'active-filter');
    });

    const activeEl = document.getElementById(`card-${type}`);
    if(activeEl) activeEl.classList.add('active-filter', 'ring-4', 'ring-offset-2', 'ring-indigo-300');

    const statusLabels = {
        'ALL': 'SEMUA SEKOLAH (KESELURUHAN)',
        'ACTIVE': 'SEKOLAH TERLIBAT (ADA REKOD)',
        'TOTAL_ACTS': 'SENARAI MENGIKUT JUMLAH PENYERTAAN',
        'CURRENT': `SEKOLAH AKTIF TAHUN ${yearCurrent}`,
        'TRANSFORM': 'SEKOLAH YANG MENINGKAT (TRANSFORMASI)',
        'ZERO': 'SEKOLAH TIADA PENYERTAAN (SIFAR)'
    };
    
    const labelEl = document.getElementById('displayFilterStatus');
    if(labelEl) {
        labelEl.innerText = statusLabels[type] || type;
        labelEl.className = "uppercase font-extrabold ml-1"; 
        if (type === 'ZERO') labelEl.classList.add('text-red-600');
        else if (type === 'TRANSFORM') labelEl.classList.add('text-orange-500');
        else if (type === 'CURRENT') labelEl.classList.add('text-green-600');
        else labelEl.classList.add('text-blue-600');
    }

    applyFilters();
}

// 5. FILTER & RENDER TABLE
// EXPORT KE WINDOW
window.applyFilters = function() {
    const parlimenFilter = document.getElementById('filterParlimen')?.value || 'ALL';
    let filtered = [...globalData]; 

    if (parlimenFilter !== 'ALL') {
        filtered = filtered.filter(s => s.parlimen === parlimenFilter);
    }

    if (activeCardFilter === 'ACTIVE') {
        filtered = filtered.filter(s => s.activities.length > 0);
        filtered.sort((a, b) => b.activities.length - a.activities.length);
    } 
    else if (activeCardFilter === 'TOTAL_ACTS') {
        filtered = filtered.filter(s => s.activities.length > 0);
        filtered.sort((a, b) => b.activities.length - a.activities.length);
    }
    else if (activeCardFilter === 'CURRENT') {
        filtered = filtered.filter(s => (s.scores[yearCurrent] || 0) > 0);
        filtered.sort((a, b) => b.scores[yearCurrent] - a.scores[yearCurrent]);
    }
    else if (activeCardFilter === 'TRANSFORM') {
        filtered = filtered.filter(s => (s.scores[yearCurrent] || 0) > (s.scores[yearPrev] || 0));
        filtered.sort((a, b) => {
            const gapA = (a.scores[yearCurrent] - a.scores[yearPrev]);
            const gapB = (b.scores[yearCurrent] - b.scores[yearPrev]);
            return gapB - gapA;
        });
    }
    else if (activeCardFilter === 'ZERO') {
        filtered = filtered.filter(s => s.activities.length === 0);
        filtered.sort((a, b) => a.nama.localeCompare(b.nama));
    }
    else {
        filtered.sort((a, b) => (b.scores[yearCurrent] || 0) - (a.scores[yearCurrent] || 0));
    }

    filteredDataForCSV = filtered; 
    renderTable(filtered);
}

function renderTable(dataList) {
    const tbody = document.getElementById('comparisonTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if(dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 border-b border-slate-100">
            <div class="flex flex-col items-center justify-center">
                <i class="fas fa-folder-open text-4xl mb-3 opacity-30"></i>
                <span class="font-bold text-sm">Tiada rekod sekolah dalam kategori ini.</span>
            </div>
        </td></tr>`;
        return;
    }

    dataList.forEach(s => {
        const sCurr = s.scores[yearCurrent] || 0;
        const sPrev = s.scores[yearPrev] || 0;
        const totalActs = s.activities.length;
        
        let trendBadge = '';
        
        if (totalActs === 0) {
             trendBadge = `<span class="inline-flex items-center gap-1 bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded font-bold border border-red-100">SIFAR</span>`;
        } else if (sCurr > sPrev) {
            trendBadge = `<span class="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] px-2 py-1 rounded font-bold border border-green-200"><i class="fas fa-arrow-up"></i> NAIK</span>`;
        } else if (sCurr < sPrev) {
            trendBadge = `<span class="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[10px] px-2 py-1 rounded font-bold border border-orange-200"><i class="fas fa-arrow-down"></i> TURUN</span>`;
        } else {
            trendBadge = `<span class="inline-flex items-center gap-1 bg-slate-50 text-slate-500 text-[10px] px-2 py-1 rounded font-bold border border-slate-200">KEKAL</span>`;
        }

        const rowClass = totalActs === 0 ? 'bg-red-50/30' : 'bg-white';

        const row = `
        <tr class="${rowClass} border-b border-slate-50 hover:bg-indigo-50/50 transition group">
            <td class="px-6 py-3 font-mono text-xs font-bold text-slate-500 group-hover:text-indigo-600">${s.kod}</td>
            <td class="px-6 py-3 font-bold text-slate-700 text-xs md:text-sm">
                ${s.nama}
                <div class="text-[9px] text-slate-400 uppercase mt-0.5 tracking-wide font-semibold">${s.parlimen}</div>
            </td>
            <td class="px-6 py-3 text-center font-black text-green-600 border-x border-slate-100 text-sm">${sCurr}</td>
            <td class="px-6 py-3 text-center font-bold text-slate-400 text-sm">${sPrev}</td>
            <td class="px-6 py-3 text-center">${trendBadge}</td>
            <td class="px-6 py-3 text-center">
                <button onclick="viewSchoolDetail('${s.kod}')" class="text-slate-400 hover:text-indigo-600 hover:bg-white p-2 rounded-full transition shadow-sm border border-transparent hover:border-slate-200" title="Lihat Perincian">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// 6. FUNGSI SOKONGAN (CSV & DETAIL)
// EXPORT KE WINDOW
window.downloadCSV = function() {
    if (!filteredDataForCSV || filteredDataForCSV.length === 0) {
        Swal.fire("Tiada Data", "Sila pilih filter yang mempunyai data.", "info");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `KOD SEKOLAH,NAMA SEKOLAH,PARLIMEN,SKOR ${yearCurrent},SKOR ${yearPrev},JUMLAH AKTIVITI,STATUS\n`;

    filteredDataForCSV.forEach(s => {
        const cleanNama = `"${s.nama.replace(/"/g, '""')}"`;
        const cleanParlimen = `"${s.parlimen}"`;
        const sCurr = s.scores[yearCurrent] || 0;
        const sPrev = s.scores[yearPrev] || 0;
        let status = "KEKAL";
        if(s.activities.length === 0) status = "SIFAR";
        else if(sCurr > sPrev) status = "NAIK";
        else if(sCurr < sPrev) status = "TURUN";

        csvContent += `${s.kod},${cleanNama},${cleanParlimen},${sCurr},${sPrev},${s.activities.length},${status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `Analisa_PPPDM_${activeCardFilter}_${new Date().toISOString().slice(0,10)}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// EXPORT KE WINDOW
window.viewSchoolDetail = function(kod) {
    window.switchTab('semakan');
    const school = processedSchools[kod];
    if (school) populateDetailCard(school);
}

function populateDetailCard(school) {
    document.getElementById('schoolDetailCard').classList.remove('hidden');
    
    document.getElementById('detailKod').innerText = school.kod;
    document.getElementById('detailNama').innerText = school.nama;
    document.getElementById('txtParlimen').innerText = school.parlimen;
    
    document.getElementById('scoreCurr').innerText = school.scores[yearCurrent] || 0;
    document.getElementById('scorePrev').innerText = school.scores[yearPrev] || 0;

    const list = document.getElementById('activityList');
    list.innerHTML = '';

    const sortedActs = school.activities.sort((a,b) => b.tahun - a.tahun);

    if (sortedActs.length === 0) {
        list.innerHTML = `<div class="p-6 bg-red-50 border border-red-100 border-dashed rounded-xl text-center text-red-400 text-xs font-bold italic">
            <i class="fas fa-exclamation-circle mb-2 text-lg"></i><br>
            Sekolah ini belum pernah menyertai sebarang program.
        </div>`;
    } else {
        sortedActs.forEach(act => {
            const isCurrent = act.tahun === yearCurrent;
            const yearClass = isCurrent 
                ? 'bg-green-600 text-white border-green-600' 
                : 'bg-slate-200 text-slate-600 border-slate-300';
            
            const item = `
            <div class="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-white shadow-sm hover:shadow-md transition mb-2">
                <span class="${yearClass} text-[10px] font-bold px-2 py-1 rounded shadow-sm border mt-0.5 min-w-[50px] text-center">${act.tahun}</span>
                <span class="text-xs font-semibold text-slate-700 leading-snug">${act.program}</span>
            </div>`;
            list.innerHTML += item;
        });
    }
}

// EXPORT KE WINDOW
window.closeDetail = function() {
    document.getElementById('schoolDetailCard').classList.add('hidden');
}

// SEARCH
// EXPORT KE WINDOW
window.handleSearch = function(query) {
    const resultBox = document.getElementById('searchResults');
    if (query.length < 3) {
        resultBox.classList.add('hidden');
        return;
    }

    const q = query.toUpperCase();
    const matches = globalData.filter(s => s.nama.toUpperCase().includes(q) || s.kod.toUpperCase().includes(q)).slice(0, 6);

    resultBox.innerHTML = '';
    if (matches.length > 0) {
        resultBox.classList.remove('hidden');
        matches.forEach(s => {
            const div = document.createElement('div');
            div.className = 'p-3 hover:bg-blue-50 cursor-pointer transition flex justify-between items-center border-b border-slate-50 last:border-0';
            div.innerHTML = `
                <div>
                    <div class="font-bold text-xs text-slate-800">${s.nama}</div>
                    <div class="text-[9px] text-slate-400 font-mono font-bold">${s.kod}</div>
                </div>
                <i class="fas fa-chevron-right text-slate-300 text-xs"></i>
            `;
            div.onclick = () => {
                populateDetailCard(s);
                resultBox.classList.add('hidden');
                document.getElementById('searchBoxDetail').value = '';
            };
            resultBox.appendChild(div);
        });
    } else {
        resultBox.classList.add('hidden');
    }
}

// TAB SYSTEM
// EXPORT KE WINDOW (INI MEMBAIKI ISU UTAMA)
window.switchTab = function(view) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${view}`).classList.add('active');

    document.getElementById('view-analisa').classList.add('hidden');
    document.getElementById('view-semakan').classList.add('hidden');
    
    document.getElementById(`view-${view}`).classList.remove('hidden');
}