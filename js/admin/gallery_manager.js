/**
 * ADMIN MODULE: GALLERY MANAGER (FULL PRODUCTION VERSION)
 * Menguruskan paparan galeri admin, penapisan kategori, 
 * carian sekolah, dan logik Word Cloud jawatan guru.
 * * UPDATE V1.1: Pembaikan isu teks terpotong (truncated).
 * Menukarkan truncate/line-clamp kepada whitespace-normal (wrap).
 */

import { AchievementService } from '../services/achievement.service.js';

// --- GLOBAL STATE ---
let adminGalleryData = [];
let gallerySchoolListCache = [];
let searchDebounceTimer;
let currentGalleryJawatanFilter = 'ALL'; 

// --- 1. INITIALIZATION ---

/**
 * Memulakan modul galeri admin.
 */
window.initAdminGallery = function() {
    // Reset filter state
    currentGalleryJawatanFilter = 'ALL';
    
    // Pastikan data sekolah global sudah dimuatkan oleh dashboard.js
    if (window.globalDashboardData && window.globalDashboardData.length > 0) {
        populateGallerySchoolList();
    } else {
        console.warn("[Gallery] Data sekolah global belum sedia. Menunggu data...");
        // Fallback: Cuba muat semula selepas 1 saat jika dashboard lambat
        setTimeout(() => {
            if(window.globalDashboardData) populateGallerySchoolList();
        }, 1000);
    }
};

// --- 2. SCHOOL SELECTION & DROPDOWN LOGIC ---

/**
 * Mengisi dropdown pilihan sekolah untuk galeri.
 */
function populateGallerySchoolList() {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;

    // Ambil semua sekolah kecuali PPD sendiri untuk senarai dropdown
    gallerySchoolListCache = window.globalDashboardData.filter(s => s.kod_sekolah !== 'M030');
    renderGalleryDropdown();
    
    // Secara lalai, muat galeri PPD (M030) pada permulaan
    window.loadAdminGalleryGrid('M030');
}

/**
 * Menghasilkan elemen <option> dalam dropdown sekolah.
 */
function renderGalleryDropdown(filterText = '') {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="M030">PPD ALOR GAJAH (M030)</option>';

    const listToRender = filterText 
        ? gallerySchoolListCache.filter(s => 
            s.nama_sekolah.toUpperCase().includes(filterText.toUpperCase()) || 
            s.kod_sekolah.toUpperCase().includes(filterText.toUpperCase())
          )
        : gallerySchoolListCache;

    listToRender.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.kod_sekolah;
        opt.innerText = s.nama_sekolah;
        select.appendChild(opt);
    });

    // Kekalkan pilihan jika sekolah masih wujud dalam senarai carian
    const exists = Array.from(select.options).some(o => o.value === currentValue);
    if (exists && currentValue) {
        select.value = currentValue;
    }
}

/**
 * Menguruskan carian sekolah dalam dropdown dengan teknik debounce.
 */
window.handleGallerySchoolSearch = function(val) {
    renderGalleryDropdown(val);
    const select = document.getElementById('gallerySchoolSelector');
    const selectedKod = select.value;

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        if(selectedKod) {
            window.loadAdminGalleryGrid(selectedKod);
        }
    }, 500);
};

/**
 * Menetapkan semula paparan galeri ke keadaan asal (M030).
 */
window.resetGallery = function() {
    const select = document.getElementById('gallerySchoolSelector');
    const searchInput = document.getElementById('gallerySearchInput');

    if(select) {
        clearTimeout(searchDebounceTimer);
        if(searchInput) searchInput.value = "";
        renderGalleryDropdown(''); 
        select.value = "M030";
        window.loadAdminGalleryGrid("M030");
    }
};

// --- 3. DATA LOADING & PROCESSING ---

/**
 * Mengambil data pencapaian sekolah tertentu dan memulakan rendering.
 */
window.loadAdminGalleryGrid = async function(kod) {
    const grid = document.getElementById('adminGalleryGrid');
    const filterContainer = document.getElementById('galleryFilterContainer');
    const counterEl = document.getElementById('galleryTotalCount');
    const cloudWrapper = document.getElementById('galleryCloudWrapper');

    if(!grid) return;

    // Kemaskini Tajuk Header
    updateGalleryHeader(kod);

    // Papar Loading State
    grid.innerHTML = `
        <div class="col-span-full text-center py-16 text-slate-400 font-medium">
            <div class="flex flex-col items-center gap-3">
                <i class="fas fa-circle-notch fa-spin fa-2x text-indigo-500"></i>
                <p class="animate-pulse">Menyusun Galeri...</p>
            </div>
        </div>
    `;
    
    if(counterEl) counterEl.innerText = "0";
    if(filterContainer) filterContainer.innerHTML = '';
    
    currentGalleryJawatanFilter = 'ALL';
    if(cloudWrapper) cloudWrapper.classList.add('hidden');

    try {
        const data = await AchievementService.getBySchool(kod);
        adminGalleryData = data;

        // Dapatkan kategori unik untuk butang filter
        const categories = [...new Set(data.map(item => item.kategori))].filter(c => c).sort();
        
        // Bina Butang Filter (Tailwind style)
        let filterHtml = `
            <button class="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition-all transform scale-105" 
                    onclick="filterAdminGallery('ALL', this)">
                SEMUA
            </button>
        `;
        
        categories.forEach(cat => {
            let colorClass = 'text-slate-500 hover:text-slate-800 hover:bg-slate-50';
            if (cat === 'MURID') colorClass = 'text-blue-600 hover:bg-blue-50';
            else if (cat === 'GURU') colorClass = 'text-amber-600 hover:bg-amber-50';
            else if (cat === 'SEKOLAH') colorClass = 'text-green-600 hover:bg-green-50';
            
            filterHtml += `
                <button class="px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 transition-all shadow-sm ml-2 ${colorClass}" 
                        onclick="filterAdminGallery('${cat}', this)">
                    ${cat}
                </button>
            `;
        });
        
        if(filterContainer) filterContainer.innerHTML = filterHtml;

        // Paparkan kad pertama kali (SEMUA)
        renderAdminCards('ALL');

    } catch (e) {
        console.error("[Gallery] Gagal muat data:", e);
        grid.innerHTML = `<div class="col-span-full text-center text-red-500 font-bold py-10">Ralat memproses data galeri.</div>`;
    }
};

/**
 * Mengemaskini teks dan badge pada header galeri.
 */
function updateGalleryHeader(kod) {
    const lblTitle = document.getElementById('galleryHeaderTitle');
    const lblSub = document.getElementById('galleryHeaderSubtitle');
    
    if (kod === 'M030') {
        lblTitle.innerText = "PPD ALOR GAJAH";
        lblSub.innerHTML = `<span class="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black mr-2">M030</span> UNIT SUMBER TEKNOLOGI PENDIDIKAN`;
    } else {
        let nama = kod;
        const s = window.globalDashboardData?.find(x => x.kod_sekolah === kod);
        if(s) nama = s.nama_sekolah;
        
        lblTitle.innerText = nama;
        lblSub.innerHTML = `<span class="inline-block bg-brand-100 text-brand-700 px-2 py-0.5 rounded text-[10px] font-black mr-2">${kod}</span> GALERI PENCAPAIAN SEKOLAH`;
    }
}

// --- 4. FILTERING & RENDERING ---

/**
 * Menapis galeri berdasarkan kategori (Murid, Guru, Sekolah).
 */
window.filterAdminGallery = function(type, btn) {
    if (btn) {
        // Reset gaya semua butang
        const btns = document.querySelectorAll('#galleryFilterContainer button');
        btns.forEach(b => {
            b.className = "px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm ml-2";
        });
        // Aktifkan butang terpilih
        btn.className = "px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition-all transform scale-105 ml-2";
    }

    // Urus Paparan Word Cloud jika kategori GURU dipilih
    const cloudWrapper = document.getElementById('galleryCloudWrapper');
    if (type === 'GURU') {
        if(cloudWrapper) {
            cloudWrapper.classList.remove('hidden');
            generateJawatanCloud();
        }
    } else {
        if(cloudWrapper) cloudWrapper.classList.add('hidden');
        currentGalleryJawatanFilter = 'ALL';
    }

    renderAdminCards(type);
};

/**
 * Menjana Word Cloud jawatan guru secara dinamik untuk galeri.
 */
function generateJawatanCloud() {
    const container = document.getElementById('galleryCloudContainer');
    if (!container) return;

    // Ambil guru yang ada maklumat jawatan
    const guruData = adminGalleryData.filter(item => item.kategori === 'GURU' && item.jawatan);
    
    if (guruData.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Tiada data jawatan direkodkan untuk sekolah ini.</p>`;
        return;
    }

    const counts = {};
    let max = 0;

    guruData.forEach(item => {
        const j = item.jawatan.trim();
        counts[j] = (counts[j] || 0) + 1;
        if (counts[j] > max) max = counts[j];
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    container.innerHTML = entries.map(([jawatan, count]) => {
        const isActive = (jawatan === currentGalleryJawatanFilter);
        // Saiz font dinamik berdasarkan kekerapan
        let sizeStyle = "text-[10px]";
        if(count > 2) sizeStyle = "text-[11px] font-bold";
        if(count > 5) sizeStyle = "text-[12px] font-black";

        return `
            <div onclick="filterGalleryByJawatan('${jawatan}')" 
                 class="inline-flex items-center px-3 py-1 rounded-full border cursor-pointer transition-all m-1 shadow-sm
                        ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}">
                <span class="${sizeStyle}">${jawatan}</span>
                <span class="ml-2 bg-slate-100 text-slate-500 px-1.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : ''}">${count}</span>
            </div>
        `;
    }).join('');
}

/**
 * Menapis galeri berdasarkan jawatan yang dipilih dalam Word Cloud.
 */
window.filterGalleryByJawatan = function(jawatan) {
    currentGalleryJawatanFilter = (currentGalleryJawatanFilter === jawatan) ? 'ALL' : jawatan;
    
    const btnReset = document.getElementById('btnResetGalleryCloud');
    if(btnReset) {
        if (currentGalleryJawatanFilter !== 'ALL') btnReset.classList.remove('hidden');
        else btnReset.classList.add('hidden');
    }

    generateJawatanCloud(); 
    renderAdminCards('GURU');
};

/**
 * Fungsi rendering utama untuk menjana kad galeri.
 */
function renderAdminCards(filterType) {
    const grid = document.getElementById('adminGalleryGrid');
    const counterEl = document.getElementById('galleryTotalCount');
    if(!grid) return;
    
    grid.innerHTML = '';

    // 1. Tapis mengikut Kategori Utama
    let filtered = (filterType === 'ALL') 
        ? adminGalleryData 
        : adminGalleryData.filter(item => item.kategori === filterType);

    // 2. Tapis mengikut Word Cloud (Jika ada)
    if (filterType === 'GURU' && currentGalleryJawatanFilter !== 'ALL') {
        filtered = filtered.filter(item => item.jawatan === currentGalleryJawatanFilter);
    }

    if(counterEl) counterEl.innerText = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <i class="fas fa-folder-open text-4xl text-slate-200 mb-3"></i>
                <p class="text-slate-400 font-medium italic">Tiada rekod untuk paparan ini.</p>
            </div>
        `;
        return;
    }

    // 3. Susun mengikut Tahun (Grouping)
    const uniqueYears = [...new Set(filtered.map(item => item.tahun))].sort((a, b) => b - a);

    uniqueYears.forEach(year => {
        // Year Section Header
        grid.innerHTML += `
            <div class="col-span-full flex items-center gap-4 mt-6 mb-2">
                <span class="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black border border-indigo-100 shadow-sm">
                    <i class="fas fa-calendar-alt mr-2"></i> TAHUN ${year}
                </span>
                <div class="h-px bg-slate-200 flex-grow"></div>
            </div>`;

        const itemsInYear = filtered.filter(item => item.tahun === year);
        itemsInYear.forEach(item => {
            grid.innerHTML += createAdminCardHTML(item);
        });
    });
}

/**
 * Menjana HTML bagi sekeping kad galeri dengan pengecaman thumbnail pintar.
 * FIX: Menukar 'truncate' dan 'line-clamp' kepada 'whitespace-normal' untuk menyokong teks wrap.
 */
function createAdminCardHTML(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    let borderClass = "border-t-4 border-slate-300";
    let textClass = "text-slate-600";
    let catIcon = "fa-folder";
    let bgCircle = "bg-slate-50";

    if (item.kategori === 'MURID') {
        borderClass = "border-t-4 border-blue-500"; textClass = "text-blue-600"; catIcon = "fa-user-graduate"; bgCircle = "bg-blue-50";
    } else if (item.kategori === 'GURU') {
        borderClass = "border-t-4 border-amber-500"; textClass = "text-amber-600"; catIcon = "fa-chalkboard-user"; bgCircle = "bg-amber-50";
    } else if (item.kategori === 'SEKOLAH') {
        borderClass = "border-t-4 border-green-500"; textClass = "text-green-600"; catIcon = "fa-school"; bgCircle = "bg-green-50";
    } else if (item.kategori === 'PPD' || item.kategori === 'PEGAWAI') {
        borderClass = "border-t-4 border-indigo-500"; textClass = "text-indigo-600"; catIcon = "fa-building"; bgCircle = "bg-indigo-50";
    }

    // Deteksi Jenis Pautan
    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder-open";
        thumbnailArea = `<div class="aspect-video bg-slate-100 flex items-center justify-center text-amber-400 text-5xl"><i class="fas fa-folder-open"></i></div>`;
    } else if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        iconType = "fa-image";
        thumbnailArea = `
            <div class="aspect-video bg-slate-100 overflow-hidden relative">
                <img src="${thumbUrl}" class="w-full h-full object-cover transform hover:scale-110 transition duration-700" 
                     loading="lazy" 
                     onerror="this.parentElement.innerHTML='<div class=\\'aspect-video bg-slate-100 flex items-center justify-center text-slate-300 text-3xl\\'><i class=\\'fas fa-image-slash\\'></i></div>'">
            </div>`;
    } else if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; 
        iconType = "fa-play";
        thumbnailArea = `
            <div class="aspect-video bg-black overflow-hidden relative group">
                <img src="${thumbUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500">
                <div class="absolute inset-0 flex items-center justify-center">
                    <i class="fas fa-play-circle text-white/90 text-4xl shadow-2xl group-hover:scale-125 transition duration-300"></i>
                </div>
            </div>`;
    } else {
        iconType = "fa-globe";
        thumbnailArea = `<div class="aspect-video bg-slate-50 flex items-center justify-center text-slate-300 text-3xl"><i class="fas fa-globe-asia"></i></div>`;
    }

    return `
    <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col h-full ${borderClass}" 
         onclick="window.open('${link}', '_blank')">
        ${thumbnailArea}
        <div class="p-4 flex flex-col flex-grow relative">
            <span class="absolute top-[-12px] right-3 bg-white p-1 rounded-full shadow-sm text-slate-400 text-[10px] w-6 h-6 flex items-center justify-center border border-slate-100">
                <i class="fas ${iconType}"></i>
            </span>
            <div class="flex items-center gap-1.5 mb-2">
                <div class="w-2 h-2 rounded-full ${textClass.replace('text', 'bg')}"></div>
                <span class="text-[10px] font-black uppercase tracking-wider ${textClass}">${item.kategori}</span>
            </div>
            <h6 class="font-bold text-slate-800 text-xs leading-snug mb-1 whitespace-normal break-words" title="${item.nama_pertandingan}">${item.nama_pertandingan}</h6>
            <p class="text-[10px] text-slate-400 font-bold mb-3 whitespace-normal break-words">${item.nama_peserta}</p>
            
            <div class="mt-auto pt-3 border-t border-slate-50 flex justify-between items-center">
                <span class="text-[10px] font-black ${textClass} bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase whitespace-normal break-words">
                    ${item.pencapaian}
                </span>
                <i class="fas fa-external-link-alt text-slate-300 text-[9px]"></i>
            </div>
        </div>
    </div>`;
}