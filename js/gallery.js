/**
 * GALLERY CONTROLLER (FIXED VISUALS)
 * Memaparkan galeri pencapaian sekolah dengan visual penuh (Thumbnails + Masonry).
 * * FIXES:
 * - Removed truncation. Kad kini akan memanjang ke bawah.
 */

import { AchievementService } from './services/achievement.service.js';
import { SchoolService } from './services/school.service.js';

let allGalleryData = [];
let currentJawatanFilter = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});

async function initGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    const kodSekolah = urlParams.get('kod');

    if (!kodSekolah) {
        // Fallback jika tiada kod, balik ke laman awam
        window.location.replace('public.html');
        return;
    }

    try {
        // 1. Muat Nama Sekolah
        const sekolah = await SchoolService.getByCode(kodSekolah);
        if (sekolah) {
            document.getElementById('headerSchoolName').innerText = sekolah.nama_sekolah;
            document.getElementById('headerSchoolCode').innerText = kodSekolah;
        }

        // 2. Muat Galeri
        const data = await AchievementService.getBySchool(kodSekolah);
        
        // Tapis data untuk paparan awam (hanya kategori tertentu)
        allGalleryData = data.filter(item => ['MURID', 'GURU', 'SEKOLAH'].includes(item.kategori));

        updateStats(allGalleryData);
        window.renderGallery('SEMUA');

    } catch (e) {
        console.error("Gallery Init Error:", e);
        const grid = document.getElementById('galleryGrid');
        if(grid) grid.innerHTML = `<div class="col-12 text-center text-danger py-5">Gagal memuatkan galeri.</div>`;
    }
}

function updateStats(data) {
    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setTxt('countTotal', data.length);
    setTxt('countMurid', data.filter(i => i.kategori === 'MURID').length);
    setTxt('countGuru', data.filter(i => i.kategori === 'GURU').length);
    setTxt('countSekolah', data.filter(i => i.kategori === 'SEKOLAH').length);
}

// --- FUNGSI GLOBAL UI ---

window.filterGallery = function(type, btn) {
    if(btn) {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    const cloudWrapper = document.getElementById('jawatanCloudWrapper');
    
    // Logik Paparan Cloud Jawatan
    if (type === 'GURU') {
        if(cloudWrapper) cloudWrapper.classList.remove('hidden');
        generateJawatanCloud();
    } else {
        if(cloudWrapper) cloudWrapper.classList.add('hidden');
        currentJawatanFilter = 'ALL';
    }

    window.renderGallery(type);
};

window.renderGallery = function(filterType) {
    const grid = document.getElementById('galleryGrid');
    if(!grid) return;
    grid.innerHTML = "";

    // 1. Tapis Kategori Utama
    let filteredData = (filterType === 'SEMUA') 
        ? allGalleryData 
        : allGalleryData.filter(item => item.kategori === filterType);

    // 2. Tapis Sub-Kategori (Jawatan Guru)
    if (filterType === 'GURU' && currentJawatanFilter !== 'ALL') {
        filteredData = filteredData.filter(item => item.jawatan === currentJawatanFilter);
    }

    // 3. Paparan Kosong
    if (filteredData.length === 0) {
        let msg = "Tiada rekod dijumpai.";
        if (filterType === 'GURU' && currentJawatanFilter !== 'ALL') {
            msg = `Tiada rekod untuk jawatan <b>${currentJawatanFilter}</b>.`;
        }
        grid.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="text-muted opacity-50">
                <i class="fas fa-folder-open fa-3x mb-3"></i>
                <p class="fw-bold">${msg}</p>
            </div>
        </div>`;
        return;
    }

    // 4. Render Mengikut Tahun (Year Grouping)
    const uniqueYears = [...new Set(filteredData.map(item => item.tahun))].sort((a, b) => b - a);

    uniqueYears.forEach(year => {
        const headerHTML = `
            <div class="col-12 mt-4 mb-2 fade-up">
                <div class="d-flex align-items-center">
                    <span class="badge bg-light text-dark border me-2" style="font-size: 0.9rem;">
                        <i class="fas fa-calendar-alt me-1 text-secondary"></i> ${year}
                    </span>
                    <div class="flex-grow-1 border-bottom opacity-25"></div>
                </div>
            </div>`;
        grid.innerHTML += headerHTML;

        const itemsInYear = filteredData.filter(item => item.tahun === year);
        itemsInYear.forEach(item => {
            grid.innerHTML += createCardHTML(item);
        });
    });
};

function createCardHTML(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    let borderClass = "";
    let textClass = "";
    let catIcon = "";
    let catColor = "";

    if (item.kategori === 'MURID') {
        borderClass = "border-top-primary"; textClass = "text-primary"; catIcon = "fa-user-graduate"; catColor = "#0d6efd";
    } else if (item.kategori === 'GURU') {
        borderClass = "border-top-warning"; textClass = "text-warning"; catIcon = "fa-chalkboard-user"; catColor = "#ffc107";
    } else if (item.kategori === 'SEKOLAH') {
        borderClass = "border-top-indigo"; textClass = "text-indigo"; catIcon = "fa-school"; catColor = "#4b0082";
    }

    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder";
        thumbnailArea = `<div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center"><i class="fas fa-folder folder-icon" style="color: ${catColor} !important; opacity: 0.8;"></i></div>`;
    } else if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        iconType = "fa-image";
        thumbnailArea = `<div class="gallery-thumb-container"><img src="${thumbUrl}" class="gallery-thumb" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'gallery-thumb-container bg-light d-flex align-items-center justify-content-center\\'><i class=\\'fas fa-file-image fa-2x text-secondary opacity-25\\'></i></div>'"></div>`;
    } else if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; 
        iconType = "fa-play";
        thumbnailArea = `<div class="gallery-thumb-container"><img src="${thumbUrl}" class="gallery-thumb" loading="lazy" style="object-fit: cover;"><div class="position-absolute top-50 start-50 translate-middle text-white opacity-75"><i class="fas fa-play-circle fa-3x shadow-sm"></i></div></div>`;
    } else {
        iconType = "fa-globe";
        let domain = ""; try { domain = new URL(link).hostname; } catch(e) {}
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        thumbnailArea = `<div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center flex-column"><img src="${faviconUrl}" style="width: 48px; height: 48px;" class="mb-2 shadow-sm rounded-circle bg-white p-1" onerror="this.style.display='none';"><div class="text-muted small mt-1 text-truncate w-75 text-center">${domain}</div></div>`;
    }

    // UPDATE: TEXT WRAP ENABLED
    // Removed: text-truncate-2
    // Added: text-wrap-safe, card-body-flex
    return `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2 fade-up">
        <div class="card-gallery ${borderClass} h-100 shadow-sm" onclick="window.open('${link}', '_blank')" title="Klik untuk lihat bukti">
            ${thumbnailArea}
            <div class="category-icon ${textClass}"><i class="fas ${catIcon}"></i> ${item.kategori}</div>
            <div class="icon-overlay"><i class="fas ${iconType}"></i></div>
            <div class="card-body d-flex flex-column p-3 card-body-flex">
                <h6 class="fw-bold text-dark mb-1 text-wrap-safe" style="font-size: 0.85rem; line-height: 1.3;">${item.nama_pertandingan}</h6>
                <p class="text-secondary mb-2 small fw-bold opacity-75 text-wrap-safe" style="font-size: 0.7rem;">${item.nama_peserta}</p>
                <div class="mt-auto pt-2 border-top border-light d-flex justify-content-between align-items-center">
                    <span class="${textClass} fw-bold text-wrap-safe" style="font-size: 0.75rem;">${item.pencapaian}</span>
                </div>
            </div>
        </div>
    </div>`;
}

function generateJawatanCloud() {
    const container = document.getElementById('jawatanCloudContainer');
    if (!container) return;

    const guruData = allGalleryData.filter(item => item.kategori === 'GURU');
    
    const counts = {};
    let maxCount = 0;

    guruData.forEach(item => {
        if (item.jawatan && item.jawatan.trim() !== "") {
            const j = item.jawatan.trim();
            counts[j] = (counts[j] || 0) + 1;
            if (counts[j] > maxCount) maxCount = counts[j];
        }
    });

    const entries = Object.entries(counts);
    
    if (entries.length === 0) {
        container.innerHTML = `<small class="text-muted fst-italic">Tiada data jawatan spesifik.</small>`;
        return;
    }

    entries.sort((a, b) => b[1] - a[1]);

    container.innerHTML = '';
    entries.forEach(([jawatan, count]) => {
        let sizeClass = `tag-size-${Math.ceil((count / maxCount) * 4)}`; 
        if(count === 1) sizeClass = 'tag-size-1';

        const isActive = (jawatan === currentJawatanFilter) ? 'active' : '';
        const btnHTML = `<div class="cloud-tag ${sizeClass} ${isActive}" onclick="filterByJawatan('${jawatan}')">${jawatan} <span class="count-badge">${count}</span></div>`;
        container.innerHTML += btnHTML;
    });
}

window.filterByJawatan = function(jawatan) {
    currentJawatanFilter = (currentJawatanFilter === jawatan) ? 'ALL' : jawatan;
    
    const btnReset = document.getElementById('btnResetJawatan');
    if(btnReset) {
        if (currentJawatanFilter !== 'ALL') btnReset.classList.remove('hidden');
        else btnReset.classList.add('hidden');
    }

    generateJawatanCloud();
    window.renderGallery('GURU');
};