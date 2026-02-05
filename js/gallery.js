/**
 * SMPID GALLERY MODULE (js/gallery.js)
 * Fungsi: Memaparkan grid pencapaian sekolah dengan thumbnail pintar.
 * Versi: 4.1 (Fix: Uppercase Force & Error Handling)
 * Kemaskini: 
 * - Memaksa kod sekolah jadi HURUF BESAR untuk elak ralat 406 Supabase.
 * - Pembersihan input (trim).
 */

document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});

async function initGallery() {
    const urlParams = new URLSearchParams(window.location.search);
    let rawKod = urlParams.get('kod');

    // 1. INPUT SANITIZATION (PENTING UNTUK SUPABASE)
    // Tukar ke Huruf Besar & Buang Space.
    // Contoh: 'mba0016 ' -> 'MBA0016'
    const kodSekolah = rawKod ? rawKod.trim().toUpperCase() : null;

    // 2. SEMAKAN KESELAMATAN (REDIRECT)
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

    // 3. TETAPKAN PAUTAN KEMBALI (SMART LINKING)
    const btnBack = document.getElementById('btnBack');
    if (btnBack) {
        btnBack.setAttribute('onclick', `window.location.href='public.html?kod=${kodSekolah}'`);
    }

    // 4. DAPATKAN DATA (NAMA SEKOLAH)
    try {
        const { data: sekolahData, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('nama_sekolah')
            .eq('kod_sekolah', kodSekolah) // Query guna Kod Huruf Besar
            .single();

        if (error) {
            console.warn("Supabase Error (Sekolah):", error);
            throw new Error("Sekolah tidak dijumpai atau Kod Salah.");
        }

        if (sekolahData) {
            document.getElementById('headerSchoolName').innerText = sekolahData.nama_sekolah;
            document.getElementById('headerSchoolCode').innerText = kodSekolah;
        }
        
        // 5. DAPATKAN DATA PENCAPAIAN
        loadGalleryItems(kodSekolah);

    } catch (e) { 
        console.error("Ralat Init Galeri:", e); 
        Swal.fire({
            title: 'Ralat Carian',
            text: `Kod sekolah '${kodSekolah}' tidak ditemui dalam sistem.`,
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

        grid.innerHTML = ""; 

        if (data.length === 0) {
            grid.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="text-muted opacity-50">
                    <i class="fas fa-folder-open fa-3x mb-3"></i>
                    <p class="fw-bold">Belum ada hantaran di galeri sekolah ini.</p>
                </div>
            </div>`;
            return;
        }

        data.forEach(item => {
            const card = createCard(item);
            grid.innerHTML += card;
        });

    } catch (err) {
        console.error(err);
        grid.innerHTML = `<div class="col-12 text-center text-danger">Gagal memuatkan galeri.</div>`;
    }
}

function createCard(item) {
    const link = item.pautan_bukti || "";
    let thumbnailArea = "";
    let iconType = "fa-link";
    
    // REGEX LOGIC UNTUK PENGESANAN JENIS FAIL
    const fileIdMatch = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const folderMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const youtubeMatch = link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);

    if (folderMatch) {
        iconType = "fa-folder";
        thumbnailArea = `
            <div class="gallery-thumb-container bg-warning bg-opacity-10 d-flex align-items-center justify-content-center">
                <i class="fas fa-folder folder-icon text-warning" style="font-size: 3rem;"></i>
            </div>
        `;
    } else if (fileIdMatch) {
        const fileId = fileIdMatch[1];
        const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        iconType = "fa-file-image";
        
        thumbnailArea = `
            <div class="gallery-thumb-container">
                <img src="${thumbUrl}" class="gallery-thumb" loading="lazy" 
                     onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'gallery-thumb-container bg-light d-flex align-items-center justify-content-center\'><i class=\'fas fa-lock fa-lg text-danger opacity-50\'></i></div>'">
            </div>
        `;
    } else if (youtubeMatch) {
        const videoId = youtubeMatch[1];
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`; 
        iconType = "fa-play-circle";

        thumbnailArea = `
            <div class="gallery-thumb-container">
                <img src="${thumbUrl}" class="gallery-thumb" loading="lazy" style="object-fit: cover;">
                <div class="position-absolute top-50 start-50 translate-middle text-white opacity-75">
                    <i class="fas fa-play fa-2x"></i>
                </div>
            </div>
        `;
    } else {
        iconType = "fa-globe";
        let domain = "";
        try {
            const urlObj = new URL(link);
            domain = urlObj.hostname;
        } catch(e) { domain = ""; }

        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

        thumbnailArea = `
            <div class="gallery-thumb-container bg-light d-flex align-items-center justify-content-center flex-column">
                <img src="${faviconUrl}" style="width: 48px; height: 48px; object-fit: contain;" class="mb-2 shadow-sm rounded-circle bg-white p-1" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                <i class="fas fa-globe fa-2x text-secondary opacity-25" style="display:none"></i>
                <div class="text-muted text-truncate w-75 text-center mt-1" style="font-size: 0.6rem; max-width:90%;">${domain}</div>
            </div>
        `;
    }

    let badgeClass = "bg-secondary";
    if (item.kategori === 'MURID') badgeClass = "bg-info text-dark";
    else if (item.kategori === 'GURU') badgeClass = "bg-warning text-dark";

    return `
    <div class="col-6 col-sm-4 col-md-3 col-lg-2 fade-up">
        <div class="card-gallery" onclick="window.open('${link}', '_blank')" title="${item.nama_pertandingan}">
            ${thumbnailArea}
            <div class="icon-overlay"><i class="fas ${iconType}"></i></div>
            
            <div class="card-body d-flex flex-column p-2">
                <div class="mb-1">
                    <span class="badge ${badgeClass} badge-category" style="font-size: 0.6rem;">${item.kategori}</span>
                </div>
                <h6 class="fw-bold text-dark mb-1 text-truncate-2" style="font-size: 0.75rem; line-height: 1.2;">${item.nama_pertandingan}</h6>
                <p class="text-secondary mb-0 text-truncate" style="font-size: 0.7rem;">${item.nama_peserta}</p>
                <div class="mt-auto pt-2 border-top mt-1">
                    <span class="text-success fw-bold" style="font-size: 0.7rem;">
                        <i class="fas fa-trophy me-1"></i> ${item.pencapaian}
                    </span>
                </div>
            </div>
        </div>
    </div>`;
}