/**
 * @file libat_urus.js
 * @description Controller for the Admin Libat Urus DELIMa Dashboard.
 * Handles data fetching, statistical aggregation, filtering, and gallery rendering.
 */

import { APP_CONFIG } from '../config/app.config.js';
import { libatUrusService } from '../services/libat_urus.service.js';
import { toggleLoading } from '../core/helpers.js';

// --- GLOBAL STATE ---
let allLibatUrusData = [];
let filteredLibatUrusData = [];

/**
 * Initializes and loads the Libat Urus dashboard data
 * Exposed to window so it can be called from main.js when the tab is clicked.
 */
window.loadAdminLibatUrus = async function() {
    toggleLoading(true);
    
    try {
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD); // PPD Code like M030
        
        let daerahFilter = null;
        const daerahWrapper = document.getElementById('luFilterDaerahWrapper');
        
        // RBAC: Set strict filtering based on roles
        if (userRole === 'SUPER_ADMIN' || userRole === 'JPNMEL') {
            if(daerahWrapper) daerahWrapper.classList.remove('hidden');
        } else if (userRole === 'ADMIN') {
            if(daerahWrapper) daerahWrapper.classList.add('hidden');
            daerahFilter = APP_CONFIG.PPD_MAPPING[userKod] || null;
        }

// ── SURGICAL EDIT START: Memuat turun data dan menapis hanya rekod tahun semasa ──
        // Fetch data from database via service
        const rawData = await libatUrusService.getAllReports(daerahFilter);
        const currentYear = new Date().getFullYear();
        
        // Filter strictly for current year data
        allLibatUrusData = rawData.filter(item => {
            if (!item.tarikh_laksana) return false;
            const itemYear = new Date(item.tarikh_laksana).getFullYear();
            return itemYear === currentYear;
        });
// ── SURGICAL EDIT END ──
        
// ── SURGICAL EDIT START: Memanggil Cross Filters semasa pemuatan awal ──
        // Initialize filters and UI
        resetLibatUrusFilters();
        
        // Membina opsyen tapisan berasaskan data yang sedia ada
        updateCrossFilters('ALL', 'ALL', 'ALL');
        
        // Cetus tapisan untuk merender data dan metrik di dalam UI
        window.filterLibatUrus();
// ── SURGICAL EDIT END ──
        
    } catch (error) {
        console.error("Error loading Admin Libat Urus:", error);
        Swal.fire('Ralat Sistem', 'Sistem tidak dapat memuat turun data libat urus. Sila semak sambungan internet atau hubungi pembangun.', 'error');
    }
    
    toggleLoading(false);
};

/**
 * Reset dropdown filters to default
 */
function resetLibatUrusFilters() {
    const fDaerah = document.getElementById('filterLuDaerah');
    const fSekolah = document.getElementById('filterLuSekolah');
    const fBulan = document.getElementById('filterLuBulan');
    
    if(fDaerah) fDaerah.value = "ALL";
    if(fSekolah) fSekolah.value = "ALL";
    if(fBulan) fBulan.value = "ALL";
}

// ── SURGICAL EDIT START: Melaksanakan Cross-Filtering (Tapisan Bersilang) dinamik ──
/**
 * Updates the options in each filter dropdown based on the intersection of the other filters.
 * Prevents "Empty State" by only showing options that have associated data.
 * @param {string} activeDaerah - Current selected district
 * @param {string} activeSekolah - Current selected school
 * @param {string} activeBulan - Current selected month
 */
function updateCrossFilters(activeDaerah, activeSekolah, activeBulan) {
    const filterDaerah = document.getElementById('filterLuDaerah');
    const filterSekolah = document.getElementById('filterLuSekolah');
    const filterBulan = document.getElementById('filterLuBulan');

    // 1. Data for Daerah (Filtered by Sekolah & Bulan)
    const validDaerahRecords = allLibatUrusData.filter(item => {
        const matchSekolah = activeSekolah === 'ALL' || (item.school?.nama_sekolah === activeSekolah);
        const matchBulan = activeBulan === 'ALL' || (item.bulan === activeBulan);
        return matchSekolah && matchBulan;
    });
    const uniqueDaerah = [...new Set(validDaerahRecords.map(item => item.school?.daerah || 'N/A'))].sort();

    // 2. Data for Sekolah (Filtered by Daerah & Bulan)
    const validSekolahRecords = allLibatUrusData.filter(item => {
        const matchDaerah = activeDaerah === 'ALL' || (item.school?.daerah?.toUpperCase() === activeDaerah.toUpperCase());
        const matchBulan = activeBulan === 'ALL' || (item.bulan === activeBulan);
        return matchDaerah && matchBulan;
    });
    const uniqueSekolah = [...new Set(validSekolahRecords.map(item => item.school?.nama_sekolah || 'TIDAK DIKETAHUI'))].sort();

    // 3. Data for Bulan (Filtered by Daerah & Sekolah)
    const validBulanRecords = allLibatUrusData.filter(item => {
        const matchDaerah = activeDaerah === 'ALL' || (item.school?.daerah?.toUpperCase() === activeDaerah.toUpperCase());
        const matchSekolah = activeSekolah === 'ALL' || (item.school?.nama_sekolah === activeSekolah);
        return matchDaerah && matchSekolah;
    });
    const uniqueBulan = [...new Set(validBulanRecords.map(item => item.bulan || 'N/A'))];
    
    // Sort Bulan properly by chronological order
    const monthOrder = { "JANUARI":1, "FEBRUARI":2, "MAC":3, "APRIL":4, "MEI":5, "JUN":6, "JULAI":7, "OGOS":8, "SEPTEMBER":9, "OKTOBER":10, "NOVEMBER":11, "DISEMBER":12 };
    uniqueBulan.sort((a, b) => (monthOrder[a] || 99) - (monthOrder[b] || 99));

    // Rebuild HTML & preserve selection if it still exists in the new filtered array
    if (filterDaerah) {
        let optionsDaerah = `<option value="ALL">SEMUA DAERAH</option>`;
        uniqueDaerah.forEach(d => { if(d !== 'N/A') optionsDaerah += `<option value="${d}">${d}</option>`; });
        filterDaerah.innerHTML = optionsDaerah;
        if (uniqueDaerah.includes(activeDaerah)) filterDaerah.value = activeDaerah;
        else filterDaerah.value = 'ALL';
    }

    if (filterSekolah) {
        let optionsSekolah = `<option value="ALL">SEMUA SEKOLAH</option>`;
        uniqueSekolah.forEach(s => { if(s !== 'TIDAK DIKETAHUI') optionsSekolah += `<option value="${s}">${s}</option>`; });
        filterSekolah.innerHTML = optionsSekolah;
        if (uniqueSekolah.includes(activeSekolah)) filterSekolah.value = activeSekolah;
        else filterSekolah.value = 'ALL';
    }

    if (filterBulan) {
        let optionsBulan = `<option value="ALL">SEMUA BULAN</option>`;
        uniqueBulan.forEach(b => { if(b !== 'N/A') optionsBulan += `<option value="${b}">${b}</option>`; });
        filterBulan.innerHTML = optionsBulan;
        if (uniqueBulan.includes(activeBulan)) filterBulan.value = activeBulan;
        else filterBulan.value = 'ALL';
    }
}
// ── SURGICAL EDIT END ──

// ── SURGICAL EDIT START: Melaksanakan pemicu (trigger) Cross-Filtering ──
/**
 * Filter mechanism triggered by onchange event in dropdowns
 */
window.filterLibatUrus = function() {
    const fDaerah = document.getElementById('filterLuDaerah')?.value || "ALL";
    const fSekolah = document.getElementById('filterLuSekolah')?.value || "ALL";
    const fBulan = document.getElementById('filterLuBulan')?.value || "ALL";

    // 1. Kemaskini silang filter (dropdown) untuk mengelakkan empty state
    updateCrossFilters(fDaerah, fSekolah, fBulan);

    // 2. Dapatkan semula nilai yang telah diverifikasi (fallback kepada 'ALL' jika nilai terdahulu tidak sah)
    const validDaerah = document.getElementById('filterLuDaerah')?.value || "ALL";
    const validSekolah = document.getElementById('filterLuSekolah')?.value || "ALL";
    const validBulan = document.getElementById('filterLuBulan')?.value || "ALL";

    filteredLibatUrusData = allLibatUrusData.filter(item => {
        let matchDaerah = true;
        let matchSekolah = true;
        let matchBulan = true;
        
        const schoolName = item.school?.nama_sekolah || "";
        const schoolDaerah = item.school?.daerah || "";

        if (validDaerah !== "ALL") matchDaerah = schoolDaerah.toUpperCase() === validDaerah.toUpperCase();
        if (validSekolah !== "ALL") matchSekolah = schoolName === validSekolah;
        if (validBulan !== "ALL") matchBulan = item.bulan === validBulan;

        return matchDaerah && matchSekolah && matchBulan;
    });

    processAndRender(filteredLibatUrusData);
};
// ── SURGICAL EDIT END ──

/**
 * Process statistics and render the gallery
 * @param {Array} data - Filtered or full array of records
 */
function processAndRender(data) {
    calculateDashboardStats(data);
    renderLibatUrusGallery(data);
}

/**
 * Perform aggregations to calculate KPIs and update the dashboard cards
 * @param {Array} data - Array of records to process
 */
function calculateDashboardStats(data) {
    let sumGuru = 0;
    let sumMurid = 0;
    let sumIbuBapa = 0;
// ── SURGICAL EDIT START: Menambah pembolehubah kiraan mod pelaksanaan ──
    let sumBersemuka = 0;
    let sumDalamTalian = 0;
// ── SURGICAL EDIT END ──
    
    const monthFrequency = {};
    let topMonth = '-';
    let maxFrequency = 0;

    data.forEach(item => {
        // Tally participants based on categories
        const cat = (item.kategori_sasar || '').toUpperCase();
        const pax = parseInt(item.jumlah_peserta) || 0;
// ── SURGICAL EDIT START: Menjumlahkan nilai peserta mengikut mod pelaksanaan ──
        const mod = (item.mod_pelaksanaan || 'BERSEMUKA').toUpperCase();
// ── SURGICAL EDIT END ──
        
        if (cat === 'GURU') sumGuru += pax;
        else if (cat === 'MURID') sumMurid += pax;
        else if (cat === 'IBU-BAPA (PIBG & PIBKS)' || cat.includes('IBU')) sumIbuBapa += pax;

// ── SURGICAL EDIT START: Logik agihan metrik peserta mod pelaksanaan ──
        if (mod === 'DALAM TALIAN') sumDalamTalian += pax;
        else sumBersemuka += pax; // Defaulting to Bersemuka for legacy/null records
// ── SURGICAL EDIT END ──

        // Calculate Month Frequency
        if (item.bulan) {
            monthFrequency[item.bulan] = (monthFrequency[item.bulan] || 0) + 1;
            if (monthFrequency[item.bulan] > maxFrequency) {
                maxFrequency = monthFrequency[item.bulan];
                topMonth = item.bulan;
            }
        }
    });

    // Update DOM elements safely
    const statLuBulan = document.getElementById('statLuBulan');
    const statLuGuru = document.getElementById('statLuGuru');
    const statLuMurid = document.getElementById('statLuMurid');
    const statLuIbuBapa = document.getElementById('statLuIbuBapa');

    if(statLuBulan) statLuBulan.innerText = topMonth;
    if(statLuGuru) statLuGuru.innerText = sumGuru.toLocaleString('ms-MY');
    if(statLuMurid) statLuMurid.innerText = sumMurid.toLocaleString('ms-MY');
    if(statLuIbuBapa) statLuIbuBapa.innerText = sumIbuBapa.toLocaleString('ms-MY');

// ── SURGICAL EDIT START: Kemaskini metrik ke DOM ID Kad KPI yang baharu dicipta ──
    const statLuBersemuka = document.getElementById('luKpiBersemuka');
    const statLuDalamTalian = document.getElementById('luKpiDalamTalian');

    if(statLuBersemuka) statLuBersemuka.innerText = sumBersemuka.toLocaleString('ms-MY');
    if(statLuDalamTalian) statLuDalamTalian.innerText = sumDalamTalian.toLocaleString('ms-MY');
// ── SURGICAL EDIT END ──
}

/**
 * Generate and display HTML cards for each record
 * @param {Array} data - Records to render
 */
function renderLibatUrusGallery(data) {
    const galleryContainer = document.getElementById('luAdminGallery');
    const emptyState = document.getElementById('luEmptyState');
    
    if (!galleryContainer || !emptyState) return;

    if (data.length === 0) {
        galleryContainer.innerHTML = "";
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
// ── SURGICAL EDIT START: Reka bentuk semula jubin (minimalis), suntikan lakaran kecil (thumbnail), & Ringkasan Sekolah ──
    // Kemaskini grid secara dinamik untuk memaksa ketumpatan kad lebih tinggi (sehingga 5 lajur)
    galleryContainer.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-10 relative";

    // Pengiraan untuk ringkasan jumlah sekolah unik
    const uniqueSchoolsCount = new Set(data.map(item => item.kod_sekolah)).size;
    const currentYear = new Date().getFullYear();

    // Mengubah Penyerahan kepada Laporan & menjadikan ia "Sticky" (Kekal Terapung)
    const summaryHeader = `
        <div class="col-span-full flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 mb-2 border-b-2 border-slate-200/60 sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-md pt-4 -mt-4 rounded-b-xl px-1 shadow-[0_4px_6px_-6px_rgba(0,0,0,0.1)]">
            <div>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5" aria-hidden="true">Prestasi Tahun Semasa</p>
                <h3 class="text-2xl font-black text-slate-800 tracking-tighter leading-none">Laporan ${currentYear}</h3>
            </div>
            <div class="bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    <i class="fas fa-school text-sm"></i>
                </div>
                <div>
                    <span class="block text-xl font-black text-slate-800 leading-none">${uniqueSchoolsCount}</span>
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Jumlah Sekolah</span>
                </div>
            </div>
        </div>
    `;

    const htmlCards = data.map(item => {
        const cat = (item.kategori_sasar || '').toUpperCase();
        const dateStr = new Date(item.tarikh_laksana).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
        const schoolName = item.school?.nama_sekolah || item.kod_sekolah;
        const daerah = item.school?.daerah || 'N/A';
        
        const mod = (item.mod_pelaksanaan || 'BERSEMUKA').toUpperCase();
        const isOnline = mod === 'DALAM TALIAN';
        const modStyle = isOnline ? 'text-purple-600 bg-purple-50 border-purple-100' : 'text-teal-600 bg-teal-50 border-teal-100';
        const modIcon = isOnline ? 'fa-video' : 'fa-users';
        
        let catStyle = 'text-slate-600 bg-slate-50 border-slate-100';
        let catIcon = 'fa-users';
        
        if (cat === 'GURU') { catStyle = 'text-blue-600 bg-blue-50 border-blue-100'; catIcon = 'fa-chalkboard-teacher'; }
        else if (cat === 'MURID') { catStyle = 'text-cyan-600 bg-cyan-50 border-cyan-100'; catIcon = 'fa-user-graduate'; }
        else if (cat.includes('IBU')) { catStyle = 'text-emerald-600 bg-emerald-50 border-emerald-100'; catIcon = 'fa-people-arrows'; }

        // Penjanaan Lakaran Kecil (Thumbnail) Prebiu yang dikurangkan saiz (h-28)
        let previewHtml = '';
        if (item.pautan_fail && item.pautan_fail.includes('drive.google.com')) {
            const previewUrl = item.pautan_fail.replace(/\/view.*/, '/preview');
            // iframe diset pointer-events-none untuk prestasi DOM optimum
            previewHtml = `<div class="h-28 w-full overflow-hidden bg-slate-100 relative group-hover:opacity-90 transition-opacity">
                <iframe src="${previewUrl}" class="w-full h-48 -mt-10 pointer-events-none border-0 transform scale-[1.02]" aria-hidden="true" tabindex="-1" loading="lazy"></iframe>
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
            </div>`;
        } else {
            previewHtml = `<div class="h-28 w-full bg-slate-50 flex items-center justify-center border-b border-slate-100">
                <i class="fas fa-file-alt text-3xl text-slate-200"></i>
            </div>`;
        }

        // Susun atur kad yang lebih kompak (padding lebih kecil, saiz fon optimum)
        return `
        <div class="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-orange-300 transition-all duration-300 flex flex-col overflow-hidden relative transform hover:-translate-y-1">
            ${previewHtml}
            
            <div class="p-3.5 flex-grow flex flex-col">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex flex-wrap gap-1.5">
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${catStyle}" aria-label="Kategori: ${cat}">
                            <i class="fas ${catIcon}"></i> ${cat}
                        </span>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${modStyle}" aria-label="Mod: ${mod}">
                            <i class="fas ${modIcon}"></i> ${mod}
                        </span>
                    </div>
                    <span class="text-[8px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase" aria-label="Daerah: ${daerah}">${daerah}</span>
                </div>
                
                <h4 class="font-bold text-slate-900 text-xs mb-1 leading-tight line-clamp-2 uppercase group-hover:text-orange-600 transition-colors">${schoolName}</h4>
                <p class="text-[9px] font-mono font-bold text-slate-400 mb-3"><i class="fas fa-fingerprint mr-1"></i> ${item.kod_sekolah}</p>
                
                <div class="mt-auto grid grid-cols-[1fr_auto] gap-2 mb-3">
                    <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col justify-center">
                        <span class="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tarikh/Tempat</span>
                        <span class="block text-[9px] font-bold text-slate-700 truncate" title="${item.tempat}">${item.tempat}</span>
                        <span class="block text-[9px] font-semibold text-orange-600 mt-0.5">${dateStr}</span>
                    </div>
                    <div class="bg-orange-50 p-2 px-3 rounded-xl border border-orange-100 flex flex-col justify-center items-center text-center">
                        <span class="block text-[8px] font-bold text-orange-400 uppercase tracking-widest mb-0.5">Peserta</span>
                        <span class="block text-lg font-black text-orange-600 leading-none">${item.jumlah_peserta}</span>
                    </div>
                </div>
                
                <a href="${item.pautan_fail}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-[10px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm" aria-label="Lihat laporan penuh untuk ${schoolName}">
                    <i class="fas fa-external-link-alt text-[9px]"></i> Buka Laporan
                </a>
            </div>
        </div>
        `;
    }).join('');

    galleryContainer.innerHTML = summaryHeader + htmlCards;
// ── SURGICAL EDIT END ──
}

/**
 * Export current filtered data to CSV
 */
window.eksportLibatUrusCSV = function() {
    if (filteredLibatUrusData.length === 0) {
        return Swal.fire('Tiada Data', 'Sila pastikan jadual mempunyai data sebelum muat turun.', 'warning');
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
// ── SURGICAL EDIT START: Menambah lajur MOD_PELAKSANAAN ──
    csvContent += "ID_REKOD,KOD_SEKOLAH,NAMA_SEKOLAH,DAERAH,KATEGORI_SASAR,MOD_PELAKSANAAN,TARIKH_LAKSANA,BULAN,TEMPAT,JUMLAH_PESERTA,PAUTAN_FAIL\r\n";
// ── SURGICAL EDIT END ──

    filteredLibatUrusData.forEach(item => {
        const id = item.id || '';
        const kod = item.kod_sekolah || '';
        const namaSekolah = `"${(item.school?.nama_sekolah || '').replace(/"/g, '""')}"`;
        const daerah = item.school?.daerah || '';
        const kategori = `"${(item.kategori_sasar || '').replace(/"/g, '""')}"`;
// ── SURGICAL EDIT START: Membaca dan menapis ralat (escape characters) mod pelaksanaan ──
        const modPelaksanaan = `"${(item.mod_pelaksanaan || 'BERSEMUKA').replace(/"/g, '""')}"`;
// ── SURGICAL EDIT END ──
        const tarikh = item.tarikh_laksana || '';
        const bulan = item.bulan || '';
        const tempat = `"${(item.tempat || '').replace(/"/g, '""')}"`;
        const jumlah = item.jumlah_peserta || 0;
        const pautan = `"${(item.pautan_fail || '').replace(/"/g, '""')}"`;

// ── SURGICAL EDIT START: Kemasukan data baris selari dengan kedudukan Header baharu ──
        const row = [id, kod, namaSekolah, daerah, kategori, modPelaksanaan, tarikh, bulan, tempat, jumlah, pautan].join(",");
// ── SURGICAL EDIT END ──
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Naming logic based on filters
    const fDaerah = document.getElementById('filterLuDaerah')?.value || "SEMUA_DAERAH";
    const fBulan = document.getElementById('filterLuBulan')?.value || "SEMUA_BULAN";
    const dateMark = new Date().toISOString().slice(0,10).replace(/-/g,"");
    
    link.setAttribute("download", `LAPORAN_LIBAT_URUS_${fDaerah}_${fBulan}_${dateMark}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
};