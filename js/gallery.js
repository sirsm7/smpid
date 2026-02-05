/**
 * SMPID GALLERY MODULE (js/gallery.js)
 * Versi: 5.0 (Dashboard Kemenjadian - Penaziran Ready)
 * Fungsi: Memaparkan grid pencapaian dengan statistik dan kod warna kategori.
 */

let allGalleryData = []; // Simpan data tempatan untuk filtering pantas

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});

async function initGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    let rawKod = urlParams.get('kod');

    // 1. INPUT SANITIZATION
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

    // 2. PAUTAN KEMBALI
    const btnBack = document.getElementById('btnBackHome');
    if (btnBack) {
        // Jika user datang dari public.html, back akan bawa ke sana semula dengan kod
        // Jika dari dashboard user, mungkin lain. Kita kekalkan ke index buat masa ini.
        // btnBack.setAttribute('onclick', `window.location.href='index.html'`);
    }

    // 3. DAPATKAN NAMA SEKOLAH
    try {
        const { data: sekolahData, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('nama_sekolah')
            .eq('kod_sekolah', kodSekolah)
            .single();

        if (error) {
            console.warn("Supabase Error (Sekolah):", error);
            throw new Error("Sekolah tidak dijumpai.");
        }

        if (sekolahData) {
            document.getElementById('headerSchoolName').innerText = sekolahData.nama_sekolah;
            document.getElementById('headerSchoolCode').innerText = kodSekolah;
        }
        
        // 4. LOAD DATA GALERI
        loadGalleryItems(kodSekolah);

    } catch (e) { 
        console.error("Ralat Init Galeri:", e); 
        Swal.fire({
            title: 'Ralat Carian',
            text: `Kod sekolah '${kodSekolah}' tidak ditemui.`,
            icon: 'error',
            confirmButtonText: 'Cari Semula'
        }).then(() => {
            window.location.replace('public.html');
        });
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

        // PENAPIS DATA UTAMA
        // Hanya ambil rekod yang mempunyai kategori sah (MURID, GURU, SEKOLAH)
        // Rekod tanpa kategori atau 'LAIN-LAIN' akan diabaikan untuk kekemasan dashboard.
        allGalleryData = data.filter(item => 
            item.kategori && ['MURID', 'GURU', 'SEKOLAH'].includes(item.kategori)
        );

        updateStats(allGalleryData);
        renderGallery('SEMUA'); // Papar semua pada permulaan

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="col-12 text-center text-danger">Gagal memuatkan data galeri.</div>`;
    }
}

function updateStats(data) {
    // Kira jumlah
    const total = data.length;
    const murid = data.filter(i => i.kategori === 'MURID').length;
    const guru = data.filter(i => i.kategori === 'GURU').length;
    const sekolah = data.filter(i => i.kategori === 'SEKOLAH').length;

    // Animasi Nombor (Mudah)
    document.getElementById('countTotal').innerText = total;
    document.getElementById('countMurid').innerText = murid;
    document.getElementById('countGuru').innerText = guru;
    document.getElementById('countSekolah').innerText = sekolah;
}

function filterGallery(type, btn) {
    // Update UI Butang
    if(btn) {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    renderGallery(type);
}

function renderGallery(filterType) {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = "";

    // Tapis data berdasarkan butang
    const filteredData = (filterType === 'SEMUA') 
        ? allGalleryData 
        : allGalleryData.filter(item => item.kategori === filterType);

    if (filteredData.length === 0) {
        grid.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="text-muted opacity-50">
                <i class="fas fa-folder-open fa-3x mb-3"></i>
                <p class="fw-bold">Tiada rekod ${filterType !== 'SEMUA' ? filterType : ''} dijumpai.</p>
            </div>
        </div>`;
        return;
    }

    filteredData.forEach(item => {
        const card = createCard(item);
        grid.innerHTML += card;
    });
}

function createCard(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    // TENTUKAN TEMA WARNA & IKON BERDASARKAN KATEGORI
    let borderClass = "";
    let textClass = "";
    let catIcon = "";
    let catColor = "";

    if (item.kategori === 'MURID') {
        borderClass = "border-top-primary"; // Biru
        textClass = "text-primary";
        catIcon = "fa-user-graduate";
        catColor = "#0d6efd"; // Biru Bootstrap
    } else if (item.kategori === 'GURU') {
        borderClass = "border-top-warning"; // Kuning/Jingga
        textClass = "text-warning";
        catIcon = "fa-chalkboard-user";
        catColor = "#ffc107"; // Kuning
    } else if (item.kategori === 'SEKOLAH') {
        borderClass = "border-top-indigo"; // Ungu
        textClass = "text-indigo";
        catIcon = "fa-school";
        catColor = "#4b0082"; // Indigo
    }

    // REGEX LOGIC UNTUK THUMBNAIL
    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder";
        thumbnailArea = `
            <div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center">
                <i class="fas fa-folder folder-icon" style="color: ${catColor} !important; opacity: 0.8;"></i>
            </div>
        `;
    } else if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        iconType = "fa-image";
        
        thumbnailArea = `
            <div class="gallery-thumb-container">
                <img src="${thumbUrl}" class="gallery-thumb" loading="lazy" 
                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'gallery-thumb-container bg-light d-flex align-items-center justify-content-center\'><i class=\'fas fa-file-image fa-2x text-secondary opacity-25\'></i></div>'">
            </div>
        `;
    } else if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; 
        iconType = "fa-play";

        thumbnailArea = `
            <div class="gallery-thumb-container">
                <img src="${thumbUrl}" class="gallery-thumb" loading="lazy" style="object-fit: cover;">
                <div class="position-absolute top-50 start-50 translate-middle text-white opacity-75">
                    <i class="fas fa-play-circle fa-3x shadow-sm"></i>
                </div>
            </div>
        `;
    } else {
        iconType = "fa-globe";
        let domain = "";
        try { domain = new URL(link).hostname; } catch(e) {}
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

        thumbnailArea = `
            <div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center flex-column">
                <img src="${faviconUrl}" style="width: 48px; height: 48px;" class="mb-2 shadow-sm rounded-circle bg-white p-1" 
                     onerror="this.style.display='none';">
                <div class="text-muted small mt-1 text-truncate w-75 text-center">${domain}</div>
            </div>
        `;
    }

    return `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2 fade-up">
        <div class="card-gallery ${borderClass} h-100 shadow-sm" onclick="window.open('${link}', '_blank')" title="Klik untuk lihat bukti">
            
            ${thumbnailArea}
            
            <!-- Category Badge (Top Left) -->
            <div class="category-icon ${textClass}">
                <i class="fas ${catIcon}"></i> ${item.kategori}
            </div>

            <!-- Type Icon (Top Right) -->
            <div class="icon-overlay">
                <i class="fas ${iconType}"></i>
            </div>
            
            <div class="card-body d-flex flex-column p-3">
                <h6 class="fw-bold text-dark mb-1 text-truncate-2" style="font-size: 0.85rem; line-height: 1.3;">
                    ${item.nama_pertandingan}
                </h6>
                <p class="text-secondary mb-2 text-truncate small fw-bold opacity-75" style="font-size: 0.7rem;">
                    ${item.nama_peserta}
                </p>
                
                <div class="mt-auto pt-2 border-top border-light d-flex justify-content-between align-items-center">
                    <span class="${textClass} fw-bold" style="font-size: 0.75rem;">
                        ${item.pencapaian}
                    </span>
                    <small class="text-muted" style="font-size: 0.65rem;">${item.tahun}</small>
                </div>
            </div>
        </div>
    </div>`;
}