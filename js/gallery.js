/**
 * SMPID GALLERY MODULE (js/gallery.js)
 * Versi: 6.0 (Integrated Jawatan Word Cloud for Guru)
 * Fungsi: Memaparkan grid pencapaian dengan penapis pintar jawatan guru.
 */

let allGalleryData = []; // Simpan data tempatan
let currentJawatanFilter = 'ALL'; // State untuk sub-filter

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});

async function initGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    let rawKod = urlParams.get('kod');

    const kodSekolah = rawKod ? rawKod.trim().toUpperCase() : null;

    if (!kodSekolah) {
        Swal.fire({
            title: 'Tiada Kod Sekolah',
            text: 'Sila pilih sekolah dari senarai utama.',
            icon: 'warning',
            confirmButtonText: 'Ke Carian Sekolah'
        }).then(() => {
            window.location.replace('public.html');
        });
        return;
    }

    // UPDATE UI HEADER
    try {
        const { data: sekolahData, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('nama_sekolah')
            .eq('kod_sekolah', kodSekolah)
            .single();

        if (error) throw new Error("Sekolah tidak dijumpai.");

        if (sekolahData) {
            document.getElementById('headerSchoolName').innerText = sekolahData.nama_sekolah;
            document.getElementById('headerSchoolCode').innerText = kodSekolah;
        }
        
        loadGalleryItems(kodSekolah);

    } catch (e) { 
        console.error("Ralat Init Galeri:", e); 
        Swal.fire('Ralat', 'Gagal memuatkan data sekolah.', 'error').then(() => window.location.replace('public.html'));
    }
}

async function loadGalleryItems(kod) {
    const grid = document.getElementById('galleryGrid');
    
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .select('*')
            .eq('kod_sekolah', kod)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allGalleryData = data.filter(item => 
            item.kategori && ['MURID', 'GURU', 'SEKOLAH'].includes(item.kategori)
        );

        updateStats(allGalleryData);
        renderGallery('SEMUA'); // Papar semua secara default

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="col-12 text-center text-danger">Gagal memuatkan data galeri.</div>`;
    }
}

function updateStats(data) {
    const total = data.length;
    const murid = data.filter(i => i.kategori === 'MURID').length;
    const guru = data.filter(i => i.kategori === 'GURU').length;
    const sekolah = data.filter(i => i.kategori === 'SEKOLAH').length;

    document.getElementById('countTotal').innerText = total;
    document.getElementById('countMurid').innerText = murid;
    document.getElementById('countGuru').innerText = guru;
    document.getElementById('countSekolah').innerText = sekolah;
}

// --- LOGIK FILTER UTAMA (KATEGORI) ---
function filterGallery(type, btn) {
    if(btn) {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // KAWALAN AWAN KATA (Hanya untuk GURU)
    const cloudWrapper = document.getElementById('jawatanCloudWrapper');
    
    if (type === 'GURU') {
        cloudWrapper.classList.remove('hidden');
        generateJawatanCloud(); // Jana cloud segar
    } else {
        cloudWrapper.classList.add('hidden');
        currentJawatanFilter = 'ALL'; // Reset sub-filter bila tukar kategori
    }

    renderGallery(type);
}

// --- LOGIK AWAN KATA (BARU) ---
function generateJawatanCloud() {
    const container = document.getElementById('jawatanCloudContainer');
    if (!container) return;

    // 1. Dapatkan data guru sahaja
    const guruData = allGalleryData.filter(item => item.kategori === 'GURU');
    
    // 2. Kira Frekuensi Jawatan
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
    
    // Jika tiada jawatan direkodkan
    if (entries.length === 0) {
        container.innerHTML = `<small class="text-muted fst-italic">Tiada data jawatan spesifik.</small>`;
        return;
    }

    // 3. Susun (Paling banyak ke paling sikit)
    entries.sort((a, b) => b[1] - a[1]);

    // 4. Render HTML
    container.innerHTML = '';
    entries.forEach(([jawatan, count]) => {
        // Tentukan saiz visual berdasarkan populariti
        let sizeClass = `tag-size-${Math.ceil((count / maxCount) * 4)}`; 
        if(count === 1) sizeClass = 'tag-size-1';

        const isActive = (jawatan === currentJawatanFilter) ? 'active' : '';
        
        const btn = document.createElement('div');
        btn.className = `cloud-tag ${sizeClass} ${isActive}`;
        btn.innerHTML = `${jawatan} <span class="count-badge">${count}</span>`;
        btn.onclick = () => filterByJawatan(jawatan);
        
        container.appendChild(btn);
    });
}

function filterByJawatan(jawatan) {
    currentJawatanFilter = (currentJawatanFilter === jawatan) ? 'ALL' : jawatan;
    
    // Update butang Reset
    const btnReset = document.getElementById('btnResetJawatan');
    if (currentJawatanFilter !== 'ALL') btnReset.classList.remove('hidden');
    else btnReset.classList.add('hidden');

    // Re-render Cloud (untuk update highlight 'active') & Grid
    generateJawatanCloud();
    renderGallery('GURU');
}

// --- RENDER GRID (DIKEMASKINI) ---
function renderGallery(filterType) {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = "";

    // 1. Tapis Kategori Utama
    let filteredData = (filterType === 'SEMUA') 
        ? allGalleryData 
        : allGalleryData.filter(item => item.kategori === filterType);

    // 2. Tapis Sub-Kategori (Jawatan Guru)
    // Logik: Hanya tapis jika kita dalam mod GURU dan ada jawatan dipilih
    if (filterType === 'GURU' && currentJawatanFilter !== 'ALL') {
        filteredData = filteredData.filter(item => item.jawatan === currentJawatanFilter);
    }

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

    // 3. Render Mengikut Tahun
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
            grid.innerHTML += createCard(item);
        });
    });
}

function createCard(item) {
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

    // Regex Thumbnail
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

    return `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2 fade-up">
        <div class="card-gallery ${borderClass} h-100 shadow-sm" onclick="window.open('${link}', '_blank')" title="Klik untuk lihat bukti">
            ${thumbnailArea}
            <div class="category-icon ${textClass}"><i class="fas ${catIcon}"></i> ${item.kategori}</div>
            <div class="icon-overlay"><i class="fas ${iconType}"></i></div>
            <div class="card-body d-flex flex-column p-3">
                <h6 class="fw-bold text-dark mb-1 text-truncate-2" style="font-size: 0.85rem; line-height: 1.3;">${item.nama_pertandingan}</h6>
                <p class="text-secondary mb-2 text-truncate small fw-bold opacity-75" style="font-size: 0.7rem;">${item.nama_peserta}</p>
                <div class="mt-auto pt-2 border-top border-light d-flex justify-content-between align-items-center">
                    <span class="${textClass} fw-bold" style="font-size: 0.75rem;">${item.pencapaian}</span>
                </div>
            </div>
        </div>
    </div>`;
}