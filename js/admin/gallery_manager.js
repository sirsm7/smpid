/**
 * ADMIN MODULE: GALLERY MANAGER (DEV)
 * Menguruskan paparan galeri admin, carian sekolah, dan tapisan.
 * * FIXES:
 * - Removed truncation classes (text-truncate, text-truncate-2)
 * - Added text-wrap-safe for full content display
 */

import { AchievementService } from '../services/achievement.service.js';

let adminGalleryData = [];
let gallerySchoolListCache = [];
let searchDebounceTimer;

// --- 1. INITIALIZATION ---
window.initAdminGallery = function() {
    if (window.globalDashboardData && window.globalDashboardData.length > 0) {
        populateGallerySchoolList();
    } else {
        console.warn("Gallery: Global data missing. Waiting...");
    }
};

// --- 2. POPULATE & SEARCH LOGIC ---
function populateGallerySchoolList() {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;

    gallerySchoolListCache = window.globalDashboardData.filter(s => s.kod_sekolah !== 'M030');
    renderGalleryDropdown();
    window.loadAdminGalleryGrid('M030');
}

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

    const exactMatch = listToRender.find(s => s.kod_sekolah === filterText.toUpperCase());
    if (exactMatch) {
        select.value = exactMatch.kod_sekolah;
        return; 
    }

    if (filterText && listToRender.length === 1) {
        select.value = listToRender[0].kod_sekolah;
    } else {
        const exists = Array.from(select.options).some(o => o.value === currentValue);
        if (exists && currentValue) {
            select.value = currentValue;
        } else if (filterText && listToRender.length > 0) {
            select.value = listToRender[0].kod_sekolah;
        }
    }
}

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

// --- 3. DATA LOADING & RENDERING ---
window.loadAdminGalleryGrid = async function(kod) {
    const grid = document.getElementById('adminGalleryGrid');
    const filterContainer = document.getElementById('galleryFilterContainer');
    const counterEl = document.getElementById('galleryTotalCount');

    if(!grid) return;

    updateGalleryHeader(kod);

    grid.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-indigo"></div><p class="mt-2 small text-muted">Memuatkan galeri...</p></div>`;
    if(counterEl) counterEl.innerText = "0";
    filterContainer.innerHTML = '';

    try {
        const data = await AchievementService.getBySchool(kod);
        adminGalleryData = data;

        const categories = [...new Set(data.map(item => item.kategori))].filter(c => c).sort();
        let filterHtml = `<button class="btn btn-sm btn-dark rounded-pill px-3 active fw-bold" onclick="filterAdminGallery('ALL', this)">SEMUA</button>`;
        
        categories.forEach(cat => {
            let btnClass = 'btn-outline-secondary';
            if (cat === 'MURID') btnClass = 'btn-outline-primary';
            else if (cat === 'GURU') btnClass = 'btn-outline-warning text-dark';
            else if (cat === 'SEKOLAH') btnClass = 'btn-outline-success';
            
            filterHtml += `<button class="btn btn-sm ${btnClass} rounded-pill px-3 fw-bold ms-1" onclick="filterAdminGallery('${cat}', this)">${cat}</button>`;
        });
        
        filterContainer.innerHTML = filterHtml;
        renderAdminCards('ALL');

    } catch (e) {
        console.error(e);
        grid.innerHTML = `<div class="col-12 text-center text-danger py-5">Gagal memuatkan data.</div>`;
    }
};

function updateGalleryHeader(kod) {
    const lblTitle = document.getElementById('galleryHeaderTitle');
    const lblSub = document.getElementById('galleryHeaderSubtitle');
    
    if (kod === 'M030') {
        lblTitle.innerText = "PPD ALOR GAJAH";
        lblSub.innerHTML = `<span class="badge bg-indigo me-2">M030</span> <span class="text-muted fw-bold">Unit Sumber Teknologi Pendidikan</span>`;
    } else {
        let nama = kod;
        const s = window.globalDashboardData?.find(x => x.kod_sekolah === kod);
        if(s) nama = s.nama_sekolah;
        
        lblTitle.innerText = nama;
        lblSub.innerHTML = `<span class="badge bg-indigo me-2">${kod}</span> <span class="text-muted fw-bold">Galeri Sekolah</span>`;
    }
}

// --- 4. FILTERING & CARDS ---
window.filterAdminGallery = function(type, btn) {
    if (btn) {
        const btns = document.querySelectorAll('#galleryFilterContainer button');
        btns.forEach(b => {
            const txt = b.innerText;
            b.className = "btn btn-sm rounded-pill px-3 fw-bold ms-1 " + getBtnClass(txt, false);
        });
        btn.className = "btn btn-sm rounded-pill px-3 fw-bold ms-1 active btn-dark text-white";
    }
    renderAdminCards(type);
};

function getBtnClass(cat, isActive) {
    if(isActive) return 'btn-dark text-white active';
    if (cat === 'MURID') return 'btn-outline-primary';
    if (cat === 'GURU') return 'btn-outline-warning text-dark';
    if (cat === 'SEKOLAH') return 'btn-outline-success';
    return 'btn-outline-secondary';
}

function renderAdminCards(filterType) {
    const grid = document.getElementById('adminGalleryGrid');
    const counterEl = document.getElementById('galleryTotalCount');
    grid.innerHTML = '';

    const filtered = (filterType === 'ALL') 
        ? adminGalleryData 
        : adminGalleryData.filter(item => item.kategori === filterType);

    if(counterEl) counterEl.innerText = filtered.length;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5 text-muted fst-italic">Tiada rekod untuk kategori ini.</div>`;
        return;
    }

    const uniqueYears = [...new Set(filtered.map(item => item.tahun))].sort((a, b) => b - a);

    uniqueYears.forEach(year => {
        grid.innerHTML += `
            <div class="col-12 mt-3 mb-2 fade-up">
                <div class="d-flex align-items-center">
                    <span class="badge bg-light text-dark border me-2 shadow-sm">${year}</span>
                    <div class="flex-grow-1 border-bottom opacity-25"></div>
                </div>
            </div>`;

        const itemsInYear = filtered.filter(item => item.tahun === year);
        itemsInYear.forEach(item => {
            grid.innerHTML += createAdminCardHTML(item);
        });
    });
}

function createAdminCardHTML(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    let borderClass = "border-top-dark";
    let textClass = "text-dark";
    let catIcon = "fa-user";
    let catColor = "#212529";

    if (item.kategori === 'MURID') { borderClass="border-top-primary"; textClass="text-primary"; catIcon="fa-user-graduate"; catColor="#0d6efd"; }
    else if (item.kategori === 'GURU') { borderClass="border-top-warning"; textClass="text-warning"; catIcon="fa-chalkboard-user"; catColor="#ffc107"; }
    else if (item.kategori === 'SEKOLAH') { borderClass="border-top-success"; textClass="text-success"; catIcon="fa-school"; catColor="#198754"; }
    else if (item.kategori === 'PPD') { borderClass="border-top-indigo"; textClass="text-indigo"; catIcon="fa-building"; catColor="#4b0082"; }

    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder";
        thumbnailArea = `<div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center"><i class="fas fa-folder folder-icon" style="color: ${catColor} !important; opacity: 0.8;"></i></div>`;
    } else if (fileIdMatch) {
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}=s400`;
        iconType = "fa-image";
        thumbnailArea = `<div class="gallery-thumb-container"><img src="${thumbUrl}" class="gallery-thumb" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'gallery-thumb-container bg-light d-flex align-items-center justify-content-center\\'><i class=\\'fas fa-file-image fa-2x text-secondary opacity-25\\'></i></div>'"></div>`;
    } else if (youtubeMatch) {
        const thumbUrl = `https://img.youtube.com/vi/${youtubeMatch[1]}/mqdefault.jpg`; 
        iconType = "fa-play";
        thumbnailArea = `<div class="gallery-thumb-container"><img src="${thumbUrl}" class="gallery-thumb" loading="lazy" style="object-fit: cover;"><div class="position-absolute top-50 start-50 translate-middle text-white opacity-75"><i class="fas fa-play-circle fa-3x shadow-sm"></i></div></div>`;
    } else {
        iconType = "fa-globe";
        let domain = ""; try { domain = new URL(link).hostname; } catch(e) {}
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        thumbnailArea = `<div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center flex-column"><img src="${faviconUrl}" style="width: 48px; height: 48px;" class="mb-2 shadow-sm rounded-circle bg-white p-1" onerror="this.style.display='none';"><div class="text-muted small mt-1 text-truncate w-75 text-center">${domain}</div></div>`;
    }

    // UPDATE: TEXT WRAP AND FLEX GROWTH
    // Removed: text-truncate-2
    // Added: text-wrap-safe, card-body-flex
    return `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2 fade-up">
        <div class="card-gallery ${borderClass} h-100 shadow-sm" onclick="window.open('${link}', '_blank')" title="Klik untuk lihat bukti">
            ${thumbnailArea}
            <div class="category-icon ${textClass}"><i class="fas ${catIcon}"></i> ${item.kategori}</div>
            <div class="icon-overlay"><i class="fas ${iconType}"></i></div>
            <div class="card-body p-3 card-body-flex">
                <h6 class="fw-bold text-dark mb-1 text-wrap-safe" style="font-size: 0.85rem; line-height: 1.3;">${item.nama_pertandingan}</h6>
                <p class="text-secondary mb-2 small fw-bold opacity-75 text-wrap-safe" style="font-size: 0.7rem;">${item.nama_peserta}</p>
                <div class="mt-auto pt-2 border-top border-light d-flex justify-content-between align-items-center">
                    <span class="${textClass} fw-bold text-wrap-safe" style="font-size: 0.75rem;">${item.pencapaian}</span>
                </div>
            </div>
        </div>
    </div>`;
}