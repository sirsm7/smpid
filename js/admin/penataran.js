/**
 * ADMIN MODULE: PENATARAN DIGITAL
 * Menguruskan penarikan data jadual, paparan analitik ringkas daerah,
 * carian sekolah, pemadaman rekod (reset), dan eksport CSV.
 * --- UPDATE V2.1 (RBAC DAERAH) ---
 * 1. Menyuntik tapisan global supaya data laporan selari dengan daerah admin.
 * 2. Pemaparan dinamik nama PPD mengikut tetapan APP_CONFIG.
 * --- UPDATE V2.2 (PENAPISAN DINAMIK KAD KPI & JADUAL) ---
 * 1. Membenarkan penapisan data melalui klik kad KPI (Semua, 5 Bintang, Atas Purata).
 * 2. Menyuntik dropdown daerah khas untuk peranan SUPER_ADMIN / JPNMEL.
 */

import { PenataranService } from '../services/penataran.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

let masterPenataranList = [];
let filteredPenataranList = [];
let activePenataranFilter = 'ALL';
let activeDaerahPenataran = 'ALL';
let purataSemasa = 0;

/**
 * Muat senarai laporan penataran dari Supabase
 */
window.muatSenaraiPenataran = async function() {
    const tbody = document.getElementById('tbodyAdminPenataran');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="p-10 text-center text-sky-600 font-bold animate-pulse"><i class="fas fa-spinner fa-spin mr-2"></i>Menyegerak data pelayan...</td></tr>`;

    try {
        let dataRaw = await PenataranService.getAll();

        // Pemetaan data daerah dari memori global dashboard
        dataRaw = dataRaw.map(d => {
            const s = window.globalDashboardData?.find(x => x.kod_sekolah === d.kod_sekolah);
            return { ...d, daerah: s?.daerah || 'TIADA REKOD' };
        });

        // --- RBAC FILTERING ---
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
            const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
            validSchoolCodes.push(userKod); // Benarkan rekod PPD mereka sendiri
            dataRaw = dataRaw.filter(p => validSchoolCodes.includes(p.kod_sekolah));
        }

        masterPenataranList = dataRaw;
        
        renderDaerahDropdownPenataran(userRole);
        window.applyFilterPenataran();

    } catch (e) {
        console.error("[AdminPenataran] Ralat Fetch:", e);
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-bold bg-red-50 border border-red-100 rounded-xl"><i class="fas fa-exclamation-triangle mr-2"></i>Gagal memuatkan data penataran.</td></tr>`;
    }
};

/**
 * Menjana Dropdown Daerah Untuk Super Admin / JPNMEL
 */
function renderDaerahDropdownPenataran(userRole) {
    const container = document.getElementById('penataranDaerahFilterContainer');
    if (!container) return;

    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
        let daerahOpts = `<option value="ALL">SEMUA DAERAH</option>`;
        if (APP_CONFIG.PPD_MAPPING) {
            const uniqueDaerahs = [...new Set(Object.values(APP_CONFIG.PPD_MAPPING))].sort();
            uniqueDaerahs.forEach(d => {
                daerahOpts += `<option value="${d}">${d}</option>`;
            });
        }
        container.innerHTML = `<select id="filterDaerahPenataran" class="w-full md:w-48 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-sky-500 bg-white text-slate-700 shadow-sm" onchange="window.setDaerahPenataran(this.value)">${daerahOpts}</select>`;
        
        const sel = document.getElementById('filterDaerahPenataran');
        if(sel) sel.value = activeDaerahPenataran;
    } else {
        container.innerHTML = '';
    }
}

/**
 * Handler Penukaran Filter Daerah
 */
window.setDaerahPenataran = function(daerah) {
    activeDaerahPenataran = daerah;
    window.applyFilterPenataran();
};

/**
 * Handler Penukaran Filter Kad (ALL, 5STAR, AVG)
 */
window.setFilterPenataran = function(filter) {
    activePenataranFilter = filter;
    
    // UI Updates for Cards
    ['ALL', '5STAR', 'AVG'].forEach(f => {
        const el = document.getElementById(`card-penataran-${f}`);
        if (el) {
            el.classList.remove('border-sky-400', 'border-emerald-400', 'border-amber-400', 'opacity-100', 'shadow-md');
            el.classList.add('border-transparent', 'opacity-80', 'shadow-sm');
        }
    });

    const activeEl = document.getElementById(`card-penataran-${filter}`);
    if (activeEl) {
        activeEl.classList.remove('border-transparent', 'opacity-80', 'shadow-sm');
        activeEl.classList.add('opacity-100', 'shadow-md');
        if (filter === 'ALL') activeEl.classList.add('border-sky-400');
        if (filter === '5STAR') activeEl.classList.add('border-emerald-400');
        if (filter === 'AVG') activeEl.classList.add('border-amber-400');
    }

    window.applyFilterPenataran();
};

/**
 * Fungsi Penapisan Keseluruhan (Daerah + Kad + Carian Teks)
 */
window.applyFilterPenataran = function() {
    const query = (document.getElementById('searchPenataran')?.value || '').toUpperCase().trim();
    
    // 1. Tapis Daerah Dulu
    let baseData = masterPenataranList;
    if (activeDaerahPenataran !== 'ALL') {
        baseData = baseData.filter(d => d.daerah === activeDaerahPenataran);
    }
    
    // 2. Kemaskini KPI menggunakan baseData (mengikut daerah)
    kemaskiniKPI(baseData);

    // 3. Tapis mengikut Card Filter & Text Search
    filteredPenataranList = baseData.filter(item => {
        // Card Match
        let cardMatch = true;
        if (activePenataranFilter === '5STAR') {
            cardMatch = item.penarafan.includes('5 Bintang');
        } else if (activePenataranFilter === 'AVG') {
            cardMatch = item.jumlah_skor >= purataSemasa;
        }

        // Text Match
        let textMatch = true;
        if (query) {
            textMatch = item.nama_sekolah.toUpperCase().includes(query) || 
                        item.kod_sekolah.toUpperCase().includes(query);
        }

        return cardMatch && textMatch;
    });

    renderJadualPenataran();
};

/**
 * Kemaskini KPI Bar (Berdasarkan Base Data Daerah)
 */
function kemaskiniKPI(data) {
    purataSemasa = 0;
    if (data.length > 0) {
        const sum = data.reduce((acc, curr) => acc + curr.jumlah_skor, 0);
        purataSemasa = Math.round(sum / data.length);
    }

    const totalEl = document.getElementById('kpiPenataranTotal');
    const cemEl = document.getElementById('kpiPenataranCemerlang');
    const avgEl = document.getElementById('kpiPenataranPurata');
    
    if(totalEl) totalEl.innerText = data.length;
    
    if(cemEl) {
        const cemerlang = data.filter(i => i.penarafan.includes('5 Bintang')).length;
        cemEl.innerText = cemerlang;
    }
    
    if(avgEl) avgEl.innerText = purataSemasa;
}

/**
 * Papar jadual ke dalam DOM HTML
 */
function renderJadualPenataran() {
    const tbody = document.getElementById('tbodyAdminPenataran');
    if (!tbody) return;

    if (filteredPenataranList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-12 text-center text-slate-400 font-medium italic bg-slate-50/50">Tiada rekod penilaian sekolah ditemui.</td></tr>`;
        return;
    }

    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];

    tbody.innerHTML = filteredPenataranList.map((item, index) => {
        // Tentukan nama paparan dinamik untuk PPD
        let displayNama = item.nama_sekolah;
        if (senaraiKodPPD.includes(item.kod_sekolah)) {
            displayNama = APP_CONFIG.PPD_MAPPING[item.kod_sekolah] ? `PPD ${APP_CONFIG.PPD_MAPPING[item.kod_sekolah]}` : 'PEJABAT PENDIDIKAN DAERAH';
        }

        // Tentukan warna lencana bintang
        let starColor = 'text-slate-300';
        let bgStyle = 'bg-slate-50 border-slate-200 text-slate-500';
        
        if (item.penarafan.includes('5 Bintang')) { starColor = 'text-emerald-500 drop-shadow-md'; bgStyle = 'bg-emerald-50 border-emerald-200 text-emerald-700'; }
        else if (item.penarafan.includes('4 Bintang')) { starColor = 'text-blue-500'; bgStyle = 'bg-blue-50 border-blue-200 text-blue-700'; }
        else if (item.penarafan.includes('3 Bintang')) { starColor = 'text-amber-500'; bgStyle = 'bg-amber-50 border-amber-200 text-amber-700'; }
        else if (item.penarafan.includes('2 Bintang')) { starColor = 'text-orange-500'; bgStyle = 'bg-orange-50 border-orange-200 text-orange-700'; }
        else { starColor = 'text-red-500'; bgStyle = 'bg-red-50 border-red-200 text-red-700'; }

        // Bintang ikon
        const starCount = parseInt(item.penarafan.charAt(0)) || 1;
        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
            starsHtml += i < starCount ? `<i class="fas fa-star ${starColor} mx-0.5"></i>` : `<i class="far fa-star text-slate-200 mx-0.5"></i>`;
        }

        const dateStr = new Date(item.updated_at).toLocaleDateString('ms-MY', { day:'2-digit', month:'short', year:'numeric' });

        return `
        <tr class="hover:bg-sky-50/30 transition-colors border-b border-slate-100 last:border-0 group">
            <td class="px-6 py-5 text-center font-mono font-bold text-slate-400 align-middle">${index + 1}</td>
            <td class="px-6 py-5 font-mono font-black text-slate-600 align-middle">
                <span class="bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm group-hover:border-sky-300 transition-colors">${item.kod_sekolah}</span>
            </td>
            <td class="px-6 py-5 align-middle">
                <div class="font-bold text-slate-800 text-sm leading-snug uppercase">${displayNama}</div>
                <div class="flex flex-wrap items-center gap-2 mt-1.5">
                     <span class="text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 uppercase">${item.daerah || 'TIADA REKOD'}</span>
                     <span class="text-[9px] text-slate-400 font-bold tracking-wider uppercase"><i class="far fa-clock mr-1"></i> Diserah: ${dateStr}</span>
                </div>
            </td>
            <td class="px-6 py-5 text-center bg-sky-50/20 align-middle font-black text-sky-700 text-lg">${item.jumlah_skor}</td>
            <td class="px-6 py-5 text-center bg-sky-50/20 align-middle font-bold text-slate-600">${item.peratus}</td>
            <td class="px-6 py-5 text-center align-middle">
                <div class="mb-1.5">${starsHtml}</div>
                <span class="inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${bgStyle}">${item.penarafan.split('(')[1]?.replace(')','') || item.penarafan}</span>
            </td>
            <td class="px-6 py-5 text-center align-middle">
                <button onclick="window.padamRekodPenataran('${item.kod_sekolah}')" class="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm group-hover:shadow-md" title="Reset (Padam) Rekod Ini">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

/**
 * Padam data sekolah (Reset)
 */
window.padamRekodPenataran = async function(kod) {
    Swal.fire({
        title: `Reset Data ${kod}?`,
        text: "Tindakan ini akan memadam borang penataran sekolah ini dari sistem PPD secara kekal.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await PenataranService.deleteRecord(kod);
                toggleLoading(false);
                Swal.fire({ icon: 'success', title: 'Dipadam', timer: 1500, showConfirmButton: false });
                
                // Muat semula data
                window.muatSenaraiPenataran();
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat Sistem', 'Gagal memadam rekod.', 'error');
            }
        }
    });
};

/**
 * Eksport CSV Format Laporan Keseluruhan beserta Pecahan Dimensi
 */
window.eksportPenataranCSV = function() {
    if (!filteredPenataranList || filteredPenataranList.length === 0) {
        return Swal.fire('Tiada Data', 'Jadual kosong.', 'info');
    }

    // Tajuk Lajur Standard PPD
    let csvContent = "BIL,KOD SEKOLAH,NAMA SEKOLAH,DAERAH,TARIKH SERAHAN,JUMLAH SKOR,PERATUS,PENARAFAN BINTANG,SKOR DIMENSI 1,SKOR DIMENSI 2,SKOR DIMENSI 3,SKOR DIMENSI 4,SKOR DIMENSI 5,SKOR DIMENSI 6\n";

    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];

    filteredPenataranList.forEach((s, index) => {
        let displayNama = s.nama_sekolah;
        if (senaraiKodPPD.includes(s.kod_sekolah)) {
            displayNama = APP_CONFIG.PPD_MAPPING[s.kod_sekolah] ? `PPD ${APP_CONFIG.PPD_MAPPING[s.kod_sekolah]}` : 'PEJABAT PENDIDIKAN DAERAH';
        }

        const cleanNama = `"${displayNama.replace(/"/g, '""')}"`;
        const tarikh = new Date(s.updated_at).toLocaleDateString('ms-MY');
        const d1 = s.skor_dimensi?.d1 || 0;
        const d2 = s.skor_dimensi?.d2 || 0;
        const d3 = s.skor_dimensi?.d3 || 0;
        const d4 = s.skor_dimensi?.d4 || 0;
        const d5 = s.skor_dimensi?.d5 || 0;
        const d6 = s.skor_dimensi?.d6 || 0;

        let row = [
            index + 1, s.kod_sekolah, cleanNama, s.daerah, tarikh,
            s.jumlah_skor, s.peratus, s.penarafan.replace(/,/g, ''),
            d1, d2, d3, d4, d5, d6
        ];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Pemantauan_Penataran_Digital_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};