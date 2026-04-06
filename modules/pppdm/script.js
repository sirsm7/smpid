/**
 * modules/pppdm/script.js
 * Logik Papan Pemuka Analisa PPPDM (Modular Version - Diperluaskan dengan Tab Program & Kad SR/SM)
 * --- UPDATE V2.1 (RBAC DAERAH) ---
 * 1. Tapisan Global: Mengimplementasikan tapisan berasaskan daerah (PPD_MAPPING).
 * 2. Pembersihan Hardcode: Menukar rujukan statik 'M030' kepada senarai dinamik PPD.
 * 3. Filter Interaktif Daerah: Dihidupkan untuk SUPER_ADMIN & JPNMEL. Data Program & KPI kini dinamik mengikut daerah!
 */

import { getDatabaseClient } from '../../js/core/db.js';
import { APP_CONFIG } from '../../js/config/app.config.js';

// CONFIG & STATE
const db = getDatabaseClient();
let globalData = [];
let filteredDataForCSV = []; 
let processedSchools = {};

// State untuk Program Stats & Pemetaan Jenis Sekolah
let programStats = {};
let schoolTypeMap = {}; // Kamus rujukan pantas SR/SM
let schoolDaerahMap = {}; // Kamus rujukan daerah

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

// FUNGSI BANTUAN: BINA PETA JENIS & DAERAH SEKOLAH
function buildSchoolMetadataMap(sekolahData) {
    schoolTypeMap = {};
    schoolDaerahMap = {};
    const srTypes = ['SK', 'SJKC', 'SJKT', 'SR SABK'];
    const smTypes = ['SMK', 'SBP', 'SM SABK', 'KV'];

    sekolahData.forEach(s => {
        schoolDaerahMap[s.kod_sekolah] = s.daerah || 'TIADA REKOD';
        
        if (!s.jenis_sekolah) {
            schoolTypeMap[s.kod_sekolah] = 'LAIN';
            return;
        }
        
        const jenis = s.jenis_sekolah.toUpperCase().trim();
        if (srTypes.includes(jenis)) {
            schoolTypeMap[s.kod_sekolah] = 'SR';
        } else if (smTypes.includes(jenis)) {
            schoolTypeMap[s.kod_sekolah] = 'SM';
        } else {
            schoolTypeMap[s.kod_sekolah] = 'LAIN';
        }
    });
}

function getSchoolType(kod) {
    if (!kod) return 'LAIN';
    return schoolTypeMap[kod] || 'LAIN';
}

function getSchoolDaerah(kod) {
    if (!kod) return 'TIADA REKOD';
    return schoolDaerahMap[kod] || 'TIADA REKOD';
}

// 1. FETCH DATA (DUAL-FETCH) & TENTUKAN TAHUN
async function fetchData() {
    try {
        const [resAnalisa, resSekolah] = await Promise.all([
            db.from('view_smpid_pppdm_analisa').select('*'),
            db.from('smpid_sekolah_data').select('kod_sekolah, jenis_sekolah, daerah')
        ]);

        if (resAnalisa.error) throw resAnalisa.error;
        if (resSekolah.error) throw resSekolah.error;

        let sekolahDataRaw = resSekolah.data;
        let analisaDataRaw = resAnalisa.data;

        // --- RBAC FILTERING (SUNTIKAN DAERAH) ---
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && userKod && APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[userKod]) {
            const daerahDibenarkan = APP_CONFIG.PPD_MAPPING[userKod];
            
            sekolahDataRaw = sekolahDataRaw.filter(s => s.daerah === daerahDibenarkan || s.kod_sekolah === userKod);
            const validSchoolCodes = sekolahDataRaw.map(s => s.kod_sekolah);
            analisaDataRaw = analisaDataRaw.filter(a => validSchoolCodes.includes(a.kod_sekolah));
        }
        // ----------------------------------------

        // Siapkan kamus memori jenis dan daerah sekolah sebelum proses data
        buildSchoolMetadataMap(sekolahDataRaw);
        
        const data = analisaDataRaw;

        const years = [...new Set(data.map(d => d.tahun))].filter(y => y).sort((a,b) => b - a);
        if (years.length > 0) yearCurrent = years[0];
        if (years.length > 1) yearPrev = years[1];

        updateYearLabels();
        processData(data);
        populateDaerahFilter();
        
        // Memacu keseluruhan pengiraan KPI, Program Table dan Jadual Sekolah
        applyFilters(); 

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
        'detail-lbl-prev': `Tahun ${yearPrev}`,
        'header-prog-curr': `Tahun ${yearCurrent}`,
        'header-prog-prev': `Tahun ${yearPrev}`
    };

    for (const [id, text] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if(el) el.innerText = text;
    }
}

// 2. PROSES DATA INDUK (SEKOLAH & AKTIVITI)
function processData(rawData) {
    processedSchools = {};
    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];
    
    rawData.forEach(row => {
        // Buang aktiviti oleh PPD itu sendiri untuk analisa sekolah
        if (senaraiKodPPD.includes(row.kod_sekolah)) return; 

        const sType = getSchoolType(row.kod_sekolah);
        const sDaerah = getSchoolDaerah(row.kod_sekolah);

        if (!processedSchools[row.kod_sekolah]) {
            processedSchools[row.kod_sekolah] = {
                kod: row.kod_sekolah,
                nama: row.nama_sekolah,
                parlimen: row.parlimen || "LAIN-LAIN",
                type: sType, 
                daerah: sDaerah,
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

function populateDaerahFilter() {
    const select = document.getElementById('filterDaerah');
    if(!select) return;
    
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
        select.classList.remove('hidden');
        select.innerHTML = '<option value="ALL">SEMUA DAERAH</option>';
        
        if (APP_CONFIG.PPD_MAPPING) {
            const uniqueDaerahs = [...new Set(Object.values(APP_CONFIG.PPD_MAPPING))].sort();
            uniqueDaerahs.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.innerText = d;
                select.appendChild(opt);
            });
        }
    } else {
        select.classList.add('hidden');
    }
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

// 3. RENDER KPI SECARA DINAMIK
function updateKPICards(dataList) {
    const totalSchools = dataList.length; 
    const allSr = dataList.filter(s => s.type === 'SR').length;
    const allSm = dataList.filter(s => s.type === 'SM').length;

    const activeSchoolsList = dataList.filter(s => s.activities.length > 0);
    const activeSchoolsCount = activeSchoolsList.length;
    const activeSr = activeSchoolsList.filter(s => s.type === 'SR').length;
    const activeSm = activeSchoolsList.filter(s => s.type === 'SM').length;

    const totalActs = dataList.reduce((acc, s) => acc + s.activities.length, 0);
    const actsSr = dataList.filter(s => s.type === 'SR').reduce((acc, s) => acc + s.activities.length, 0);
    const actsSm = dataList.filter(s => s.type === 'SM').reduce((acc, s) => acc + s.activities.length, 0);

    const currentActiveList = dataList.filter(s => (s.scores[yearCurrent] || 0) > 0);
    const currentActiveCount = currentActiveList.length;
    const currSr = currentActiveList.filter(s => s.type === 'SR').length;
    const currSm = currentActiveList.filter(s => s.type === 'SM').length;

    const transformList = dataList.filter(s => (s.scores[yearCurrent] || 0) > (s.scores[yearPrev] || 0));
    const transformCount = transformList.length;
    const transSr = transformList.filter(s => s.type === 'SR').length;
    const transSm = transformList.filter(s => s.type === 'SM').length;

    const zeroList = dataList.filter(s => s.activities.length === 0);
    const zeroCount = zeroList.length;
    const zeroSr = zeroList.filter(s => s.type === 'SR').length;
    const zeroSm = zeroList.filter(s => s.type === 'SM').length;

    const setTxt = (id, val) => { 
        const el = document.getElementById(id);
        if(el) el.innerText = val; 
    };
    
    setTxt('kpi-total-schools', totalSchools);
    setTxt('kpi-active-schools', activeSchoolsCount);
    setTxt('kpi-sr-active', activeSr);
    setTxt('kpi-sm-active', activeSm);
    setTxt('kpi-total-acts', totalActs);
    setTxt('kpi-year-curr', currentActiveCount);
    setTxt('kpi-transform', transformCount);
    setTxt('kpi-zero', zeroCount);

    setTxt('kpi-all-sr', `SR: ${allSr}`);
    setTxt('kpi-all-sm', `SM: ${allSm}`);
    setTxt('kpi-active-sr', `SR: ${activeSr}`);
    setTxt('kpi-active-sm', `SM: ${activeSm}`);
    setTxt('kpi-acts-sr', `SR: ${actsSr}`);
    setTxt('kpi-acts-sm', `SM: ${actsSm}`);
    setTxt('kpi-curr-sr', `SR: ${currSr}`);
    setTxt('kpi-curr-sm', `SM: ${currSm}`);
    setTxt('kpi-trans-sr', `SR: ${transSr}`);
    setTxt('kpi-trans-sm', `SM: ${transSm}`);
    setTxt('kpi-zero-sr', `SR: ${zeroSr}`);
    setTxt('kpi-zero-sm', `SM: ${zeroSm}`);
}

function rebuildProgramStats(dataList) {
    programStats = {};
    dataList.forEach(s => {
        s.activities.forEach(act => {
            const progName = act.program.trim().toUpperCase();
            const year = act.tahun;
            const sType = s.type;

            if (!programStats[progName]) {
                programStats[progName] = {};
            }
            if (!programStats[progName][year]) {
                programStats[progName][year] = { SR: 0, SM: 0, LAIN: 0, Total: 0 };
            }
            programStats[progName][year][sType] = (programStats[progName][year][sType] || 0) + 1;
            programStats[progName][year].Total++;
        });
    });
}

// 4. INTERACTIVE CARD FILTER (Bilik Dashboard)
window.setCardFilter = function(type) {
    activeCardFilter = type;
    
    const cards = ['ALL', 'ACTIVE', 'SR', 'SM', 'TOTAL_ACTS', 'CURRENT', 'TRANSFORM', 'ZERO'];
    cards.forEach(c => {
        const el = document.getElementById(`card-${c}`);
        if(el) el.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-300', 'active-filter');
    });

    const activeEl = document.getElementById(`card-${type}`);
    if(activeEl) activeEl.classList.add('active-filter', 'ring-4', 'ring-offset-2', 'ring-indigo-300');

    const statusLabels = {
        'ALL': 'SEMUA SEKOLAH (KESELURUHAN)',
        'ACTIVE': 'SEKOLAH TERLIBAT (ADA REKOD)',
        'SR': 'SEKOLAH RENDAH TERLIBAT (ADA REKOD)',
        'SM': 'SEKOLAH MENENGAH TERLIBAT (ADA REKOD)',
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
        else if (type === 'SR') labelEl.classList.add('text-cyan-600');
        else if (type === 'SM') labelEl.classList.add('text-fuchsia-600');
        else labelEl.classList.add('text-blue-600');
    }

    applyFilters();
}

// 5. FILTER PUSAT & RENDER JADUAL (Pusat Kawalan Penapisan)
window.applyFilters = function() {
    const parlimenFilter = document.getElementById('filterParlimen')?.value || 'ALL';
    const daerahFilter = document.getElementById('filterDaerah')?.value || 'ALL';

    // 1. TAPISAN KAWASAN (Dropdown)
    let baseFiltered = [...globalData]; 

    if (daerahFilter !== 'ALL') {
        baseFiltered = baseFiltered.filter(s => s.daerah === daerahFilter);
    }
    if (parlimenFilter !== 'ALL') {
        baseFiltered = baseFiltered.filter(s => s.parlimen === parlimenFilter);
    }

    // 2. KEMASKINI KPI & TAB PROGRAM (Dinamic Cascading)
    updateKPICards(baseFiltered);
    rebuildProgramStats(baseFiltered);
    renderProgramTable();

    // 3. TAPISAN KAD AKTIF (Active Card Filter - Cth: Hanya SR, atau Zero)
    let tableFiltered = [...baseFiltered];
    
    if (activeCardFilter === 'ACTIVE') {
        tableFiltered = tableFiltered.filter(s => s.activities.length > 0);
        tableFiltered.sort((a, b) => b.activities.length - a.activities.length);
    } 
    else if (activeCardFilter === 'SR') {
        tableFiltered = tableFiltered.filter(s => s.type === 'SR' && s.activities.length > 0);
        tableFiltered.sort((a, b) => b.activities.length - a.activities.length);
    }
    else if (activeCardFilter === 'SM') {
        tableFiltered = tableFiltered.filter(s => s.type === 'SM' && s.activities.length > 0);
        tableFiltered.sort((a, b) => b.activities.length - a.activities.length);
    }
    else if (activeCardFilter === 'TOTAL_ACTS') {
        tableFiltered = tableFiltered.filter(s => s.activities.length > 0);
        tableFiltered.sort((a, b) => b.activities.length - a.activities.length);
    }
    else if (activeCardFilter === 'CURRENT') {
        tableFiltered = tableFiltered.filter(s => (s.scores[yearCurrent] || 0) > 0);
        tableFiltered.sort((a, b) => b.scores[yearCurrent] - a.scores[yearCurrent]);
    }
    else if (activeCardFilter === 'TRANSFORM') {
        tableFiltered = tableFiltered.filter(s => (s.scores[yearCurrent] || 0) > (s.scores[yearPrev] || 0));
        tableFiltered.sort((a, b) => {
            const gapA = (a.scores[yearCurrent] - a.scores[yearPrev]);
            const gapB = (b.scores[yearCurrent] - b.scores[yearPrev]);
            return gapB - gapA;
        });
    }
    else if (activeCardFilter === 'ZERO') {
        tableFiltered = tableFiltered.filter(s => s.activities.length === 0);
        tableFiltered.sort((a, b) => a.nama.localeCompare(b.nama));
    }
    else {
        // Lalai: Susun berdasarkan skor tahun semasa tertinggi
        tableFiltered.sort((a, b) => (b.scores[yearCurrent] || 0) - (a.scores[yearCurrent] || 0));
    }

    filteredDataForCSV = tableFiltered; 
    renderTable(tableFiltered);
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
                <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">${s.parlimen}</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 font-bold">${s.type}</span>
                </div>
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

// 6. RENDER JADUAL PROGRAM (Dynamic by District)
function renderProgramTable() {
    const tbody = document.getElementById('programTableBody');
    if(!tbody) return;
    
    let progArray = Object.keys(programStats).map(name => {
        return {
            name: name,
            stats: programStats[name],
            totalCurr: programStats[name][yearCurrent]?.Total || 0,
            totalPrev: programStats[name][yearPrev]?.Total || 0
        };
    });

    // Susun jadual berdasarkan penyertaan tahun terkini secara menurun
    progArray.sort((a, b) => b.totalCurr - a.totalCurr);

    tbody.innerHTML = '';
    
    if (progArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Tiada rekod program direkodkan untuk saringan ini.</td></tr>`;
        return;
    }

    progArray.forEach((prog, index) => {
        const sPrev = prog.stats[yearPrev] || { SR: 0, SM: 0, Total: 0 };
        const sCurr = prog.stats[yearCurrent] || { SR: 0, SM: 0, Total: 0 }; 
        
        // Gelapkan sedikit baris jika program tersebut tiada penyertaan pada tahun terkini
        const rowClass = sCurr.Total === 0 ? 'bg-slate-50/70 opacity-75' : 'bg-white hover:bg-purple-50/30';
        
        tbody.innerHTML += `
        <tr class="${rowClass} border-b border-slate-100 transition duration-200">
            <td class="px-6 py-3 text-center text-xs font-bold text-slate-400">${index + 1}</td>
            <td class="px-6 py-3 font-bold text-slate-700 text-xs md:text-sm leading-snug">${prog.name}</td>
            
            <!-- Tahun Terdahulu -->
            <td class="px-3 py-3 text-center text-xs font-medium text-slate-500 bg-slate-50/50">${sPrev.SR}</td>
            <td class="px-3 py-3 text-center text-xs font-medium text-slate-500 bg-slate-50/50">${sPrev.SM}</td>
            <td class="px-3 py-3 text-center text-xs font-black text-slate-600 bg-slate-100/60">${sPrev.Total}</td>
            
            <!-- Tahun Terkini -->
            <td class="px-3 py-3 text-center text-xs font-bold text-green-600 bg-green-50/20">${sCurr.SR}</td>
            <td class="px-3 py-3 text-center text-xs font-bold text-green-600 bg-green-50/20">${sCurr.SM}</td>
            <td class="px-3 py-3 text-center text-sm font-black text-green-700 bg-green-50/60">${sCurr.Total}</td>
        </tr>`;
    });
}

// 7. FUNGSI SOKONGAN (CSV & DETAIL)
window.downloadCSV = function() {
    if (!filteredDataForCSV || filteredDataForCSV.length === 0) {
        Swal.fire("Tiada Data", "Sila pilih filter yang mempunyai data.", "info");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `KOD SEKOLAH,NAMA SEKOLAH,JENIS SEKOLAH,DAERAH,PARLIMEN,SKOR ${yearCurrent},SKOR ${yearPrev},JUMLAH AKTIVITI,STATUS\n`;

    filteredDataForCSV.forEach(s => {
        const cleanNama = `"${s.nama.replace(/"/g, '""')}"`;
        const cleanDaerah = `"${s.daerah || '-'}"`;
        const cleanParlimen = `"${s.parlimen}"`;
        const sCurr = s.scores[yearCurrent] || 0;
        const sPrev = s.scores[yearPrev] || 0;
        let status = "KEKAL";
        if(s.activities.length === 0) status = "SIFAR";
        else if(sCurr > sPrev) status = "NAIK";
        else if(sCurr < sPrev) status = "TURUN";

        csvContent += `${s.kod},${cleanNama},${s.type},${cleanDaerah},${cleanParlimen},${sCurr},${sPrev},${s.activities.length},${status}\n`;
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

window.closeDetail = function() {
    document.getElementById('schoolDetailCard').classList.add('hidden');
}

// SEARCH
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
window.switchTab = function(view) {
    // 1. Reset class untuk semua butang tab
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
    });
    
    // 2. Aktifkan butang yang ditekan
    const activeBtn = document.getElementById(`btn-${view}`);
    if (activeBtn) activeBtn.classList.add('active');

    // 3. Sembunyikan semua section
    document.getElementById('view-analisa').classList.add('hidden');
    document.getElementById('view-semakan').classList.add('hidden');
    document.getElementById('view-program').classList.add('hidden');
    
    // 4. Tunjukkan section yang dipilih
    const activeView = document.getElementById(`view-${view}`);
    if (activeView) activeView.classList.remove('hidden');
}