/**
 * MODUL GALERI ADMIN (js/admin/gallery_manager.js)
 * Fungsi: Menguruskan paparan galeri admin secara adaptif.
 * Dibaiki: UX Carian "Live Search" dan Robustness Kaunter.
 */

let adminGalleryData = [];
let gallerySchoolListCache = []; // Cache untuk senarai sekolah
let searchDebounceTimer; // Timer untuk carian

// --- 1. INITIALIZATION ---
function initAdminGallery() {
    console.log("📸 Init Admin Gallery...");
    
    // Semak jika data sekolah sudah ada (dari dashboard.js)
    if (window.globalDashboardData && window.globalDashboardData.length > 0) {
        populateGallerySchoolList();
    } else {
        // Jika tiada, mungkin user refresh di tab galeri. Cuba fetch dulu.
        console.warn("Gallery: Global data missing. Fetching...");
        window.fetchDashboardData().then(() => {
            populateGallerySchoolList();
        });
    }
}

// --- 2. POPULATE DROPDOWN & SEARCH ---
function populateGallerySchoolList() {
    const select = document.getElementById('gallerySchoolSelector');
    if (!select) return;

    // Simpan data dalam cache untuk fungsi carian
    if (window.globalDashboardData && window.globalDashboardData.length > 0) {
        gallerySchoolListCache = window.globalDashboardData.filter(s => s.kod_sekolah !== 'M030');
    }

    // Default Render
    renderGalleryDropdown();
    
    // Load Default (M030)
    loadAdminGalleryGrid('M030');
}

function renderGalleryDropdown(filterText = '') {
    const select = document.getElementById('gallerySchoolSelector');
    if(!select) return;

    // Simpan nilai semasa sebelum reset
    const currentValue = select.value;

    select.innerHTML = '<option value="M030">PPD ALOR GAJAH (M030)</option>';
    
    // Filter data jika ada text carian
    const listToRender = filterText 
        ? gallerySchoolListCache.filter(s => s.nama_sekolah.includes(filterText.toUpperCase()) || s.kod_sekolah.includes(filterText.toUpperCase()))
        : gallerySchoolListCache;

    listToRender.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.kod_sekolah;
        opt.innerText = `${s.nama_sekolah}`;
        select.appendChild(opt);
    });

    // --- LOGIK PINTAR: AUTO SELECTION ---
    
    // 1. Jika pengguna taip kod/nama TEPAT, pilih dan muat segera
    const exactMatch = listToRender.find(s => s.kod_sekolah === filterText.toUpperCase() || s.nama_sekolah === filterText.toUpperCase());
    
    if (exactMatch) {
        select.value = exactMatch.kod_sekolah;
        return; // handleGallerySchoolSearch akan handle loading melalui debounce
    }

    // 2. Jika hasil tapisan tinggal SATU sahaja, auto-pilih
    if (filterText && listToRender.length === 1) {
        select.value = listToRender[0].kod_sekolah;
    }
    // 3. Jika tidak, cuba kekalkan pilihan lama jika masih valid (TAPI HANYA JIKA TIADA FILTER TEKS)
    else {
        const options = Array.from(select.options);
        const exists = options.some(o => o.value === currentValue);
        
        // Hanya restore jika nilai wujud DAN kita tidak sedang menapis secara agresif
        if (exists && currentValue) {
            select.value = currentValue;
        } else if (filterText && listToRender.length > 0) {
            // Jika pilihan lama hilang, pilih yang pertama dalam senarai baru
            select.value = listToRender[0].kod_sekolah;
        }
    }
}

function handleGallerySchoolSearch(val) {
    // 1. Update dropdown visual dulu
    renderGalleryDropdown(val);
    
    // 2. Dapatkan nilai yang terpilih sekarang (mungkin berubah sebab auto-select di atas)
    const select = document.getElementById('gallerySchoolSelector');
    const selectedKod = select.value;

    // 3. Debounce Loading Data (Tunggu 500ms berhenti menaip, baru load dari DB)
    clearTimeout(searchDebounceTimer);
    
    searchDebounceTimer = setTimeout(() => {
        if(selectedKod) {
            console.log("🔍 Auto-loading gallery for:", selectedKod);
            loadAdminGalleryGrid(selectedKod);
        }
    }, 500); // 0.5 saat delay
}

// --- 3. RESET VIEW (DIPERBAIKI / FIXED) ---
function resetGallery() {
    const select = document.getElementById('gallerySchoolSelector');
    const searchInput = document.getElementById('gallerySearchInput');

    if(select) {
        // 1. Hentikan sebarang timer carian yang sedang berjalan
        if (typeof searchDebounceTimer !== 'undefined') {
            clearTimeout(searchDebounceTimer);
        }

        // 2. Kosongkan input carian visual
        if(searchInput) searchInput.value = "";
        
        // 3. Render semula dropdown kepada senarai penuh DAHULU
        renderGalleryDropdown(''); 
        
        // 4. Paksa tetapkan nilai kepada M030
        select.value = "M030";
        
        // 5. Muat data galeri lalai
        loadAdminGalleryGrid("M030");

        console.log("🔄 Gallery reset to default (M030)");
    }
}

// --- 4. LOAD DATA & RENDER ---
async function loadAdminGalleryGrid(kod) {
    const grid = document.getElementById('adminGalleryGrid');
    const filterContainer = document.getElementById('galleryFilterContainer');
    const counterEl = document.getElementById('galleryTotalCount');
    
    if(!grid) return;

    // UPDATE HEADER VISUALS (NEW)
    const lblTitle = document.getElementById('galleryHeaderTitle');
    const lblSub = document.getElementById('galleryHeaderSubtitle');
    
    if (lblTitle && lblSub) {
        if (kod === 'M030') {
            lblTitle.innerText = "PPD ALOR GAJAH";
            lblSub.innerHTML = `<span class="badge bg-indigo me-2">M030</span> <span class="text-muted fw-bold">Unit Sumber Teknologi Pendidikan</span>`;
        } else {
            let nama = kod;
            if (window.globalDashboardData) {
                const s = window.globalDashboardData.find(x => x.kod_sekolah === kod);
                if(s) nama = s.nama_sekolah;
            }
            lblTitle.innerText = nama;
            lblSub.innerHTML = `<span class="badge bg-indigo me-2">${kod}</span> <span class="text-muted fw-bold">Galeri Sekolah</span>`;
        }
    }

    grid.innerHTML = `<div class="col-12 text-center py-5"><div class="spinner-border text-indigo"></div><p class="mt-2 small text-muted">Memuatkan galeri...</p></div>`;
    filterContainer.innerHTML = ''; // Reset filter
    if(counterEl) counterEl.innerText = "0";

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .select('*')
            .eq('kod_sekolah', kod)
            .order('created_at', { ascending: false });

        if (error) throw error;

        adminGalleryData = data;
        
        // 5. GENERATE FILTER BUTTONS (ADAPTIVE)
        const categories = [...new Set(data.map(item => item.kategori))].filter(c => c).sort();
        
        let filterHtml = `<button class="btn btn-sm btn-dark rounded-pill px-3 active fw-bold" onclick="filterAdminGallery('ALL', this)">SEMUA</button>`;
        
        categories.forEach(cat => {
            let btnClass = 'btn-outline-secondary';
            if (cat === 'MURID') btnClass = 'btn-outline-primary';
            else if (cat === 'GURU') btnClass = 'btn-outline-warning text-dark';
            else if (cat === 'SEKOLAH') btnClass = 'btn-outline-success';
            else if (cat === 'PEGAWAI') btnClass = 'btn-outline-dark';
            else if (cat === 'PPD') btnClass = 'btn-outline-indigo';

            filterHtml += `<button class="btn btn-sm ${btnClass} rounded-pill px-3 fw-bold ms-1" onclick="filterAdminGallery('${cat}', this)">${cat}</button>`;
        });

        filterContainer.innerHTML = filterHtml;

        // 6. RENDER GRID (DEFAULT: ALL)
        renderAdminCards('ALL');

    } catch (err) {
        console.error("Gallery Error:", err);
        grid.innerHTML = `<div class="col-12 text-center text-danger py-5">Gagal memuatkan galeri.</div>`;
    }
}

// --- 5. FILTERING LOGIC ---
function filterAdminGallery(type, btn) {
    if (btn) {
        const btns = document.querySelectorAll('#galleryFilterContainer button');
        btns.forEach(b => {
            b.classList.remove('active', 'btn-dark', 'text-white');
            const txt = b.innerText;
            if(b !== btn) {
                if (txt === 'MURID') b.className = "btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold ms-1";
                else if (txt === 'GURU') b.className = "btn btn-sm btn-outline-warning text-dark rounded-pill px-3 fw-bold ms-1";
                else if (txt === 'SEKOLAH') b.className = "btn btn-sm btn-outline-success rounded-pill px-3 fw-bold ms-1";
                else if (txt === 'PEGAWAI') b.className = "btn btn-sm btn-outline-dark rounded-pill px-3 fw-bold ms-1";
                else if (txt === 'PPD') b.className = "btn btn-sm btn-outline-indigo rounded-pill px-3 fw-bold ms-1";
                else b.className = "btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold ms-1"; 
            }
        });
        btn.classList.remove('btn-outline-primary', 'btn-outline-warning', 'btn-outline-success', 'btn-outline-dark', 'btn-outline-indigo', 'btn-outline-secondary');
        btn.classList.add('btn-dark', 'text-white', 'active');
    }
    renderAdminCards(type);
}

// --- 6. CARD RENDERER ---
function renderAdminCards(filterType) {
    const grid = document.getElementById('adminGalleryGrid');
    const counterEl = document.getElementById('galleryTotalCount');
    grid.innerHTML = '';

    const filtered = (filterType === 'ALL') 
        ? adminGalleryData 
        : adminGalleryData.filter(item => item.kategori === filterType);

    // Update Counter
    if(counterEl) {
        counterEl.innerText = filtered.length;
        counterEl.classList.remove('text-dark');
        counterEl.classList.add('text-indigo');
        setTimeout(() => counterEl.classList.remove('text-indigo'), 300);
    }

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
    let borderClass = "";
    let textClass = "";
    let catIcon = "";
    let catColor = "";

    if (item.kategori === 'MURID') {
        borderClass = "border-top-primary"; textClass = "text-primary"; catIcon = "fa-user-graduate"; catColor = "#0d6efd";
    } else if (item.kategori === 'GURU') {
        borderClass = "border-top-warning"; textClass = "text-warning"; catIcon = "fa-chalkboard-user"; catColor = "#ffc107";
    } else if (item.kategori === 'SEKOLAH') {
        borderClass = "border-top-success"; textClass = "text-success"; catIcon = "fa-school"; catColor = "#198754";
    } else if (item.kategori === 'PEGAWAI') {
        borderClass = "border-top-dark"; textClass = "text-dark"; catIcon = "fa-user-tie"; catColor = "#212529";
    } else if (item.kategori === 'PPD') {
        borderClass = "border-top-indigo"; textClass = "text-indigo"; catIcon = "fa-building"; catColor = "#4b0082";
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

// EXPORT
window.initAdminGallery = initAdminGallery;
window.loadAdminGalleryGrid = loadAdminGalleryGrid;
window.filterAdminGallery = filterAdminGallery;
window.handleGallerySchoolSearch = handleGallerySchoolSearch;
window.resetGallery = resetGallery;