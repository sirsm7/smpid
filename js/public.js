/**
 * SMPID PUBLIC FORM MODULE (js/public.js)
 * Versi: 4.1 (Tambah Pautan Galeri)
 */

// State Global
let globalSchoolList = [];
const db = window.supabaseClient; 

document.addEventListener('DOMContentLoaded', () => {
    initPublicPortal();
});

async function initPublicPortal() {
    window.toggleLoading(true);

    try {
        // 1. Muat turun senarai sekolah untuk rujukan (Mode Sekolah)
        const { data, error } = await db
            .from('smpid_sekolah_data')
            .select('kod_sekolah, nama_sekolah')
            .order('nama_sekolah', { ascending: true });

        if (error) throw error;
        globalSchoolList = data;

        const datalist = document.getElementById('listSekolah');
        datalist.innerHTML = '';
        data.forEach(s => {
            const opt = document.createElement('option');
            opt.value = `${s.kod_sekolah} - ${s.nama_sekolah}`;
            datalist.appendChild(opt);
        });

        // 2. Semak URL Parameter
        const urlParams = new URLSearchParams(window.location.search);
        const kodURL = urlParams.get('kod') ? urlParams.get('kod').toUpperCase() : null;

        if (kodURL === 'M030') {
            // --- LALUAN A: MODE PPD (M030) ---
            setupPPDMode();
        } else if (kodURL) {
            // --- LALUAN B: MODE SEKOLAH (AUTO LOCK) ---
            validateAndLockSchool(kodURL);
        } else {
            // --- LALUAN C: MODE MANUAL (CARIAN) ---
            setupManualSearch();
        }

        window.toggleLoading(false);

    } catch (err) {
        console.error("Public Init Error:", err);
        window.toggleLoading(false);
        Swal.fire("Ralat Sistem", "Gagal memuatkan konfigurasi.", "error");
    }
}

// ==========================================
// BAHAGIAN 1: LOGIK KHAS PPD (M030)
// ==========================================

function setupPPDMode() {
    console.log("🔒 Mod PPD Diaktifkan");
    
    // 1. Sembunyikan Elemen Sekolah
    const cardSekolah = document.getElementById('cardIdentitiSekolah');
    const formSekolah = document.getElementById('formSection');
    
    if(cardSekolah) cardSekolah.classList.add('hidden');
    if(formSekolah) formSekolah.classList.add('hidden');

    // 2. Paparkan Elemen PPD
    const cardPPD = document.getElementById('cardIdentitiPPD');
    const formPPD = document.getElementById('formSectionPPD');
    
    if(cardPPD) cardPPD.classList.remove('hidden');
    if(formPPD) formPPD.classList.remove('hidden');

    // 3. Init UI PPD
    toggleKategoriPPD();
    toggleJenisPencapaianPPD();
}

function toggleKategoriPPD() {
    const isUnit = document.getElementById('radPpdUnit').checked;
    const lbl = document.getElementById('lblPpdNama');
    const inp = document.getElementById('ppdNama');
    const hiddenCat = document.getElementById('ppdKategori');
    
    if (isUnit) {
        lbl.innerText = "NAMA UNIT / SEKTOR";
        inp.placeholder = "Contoh: SEKTOR PEMBELAJARAN";
        hiddenCat.value = "PPD"; // Simpan sebagai PPD (Unit)
    } else {
        lbl.innerText = "NAMA PEGAWAI";
        inp.placeholder = "Taip nama penuh...";
        hiddenCat.value = "PEGAWAI"; // Simpan sebagai PEGAWAI
    }
}

function toggleJenisPencapaianPPD() {
    const isPensijilan = document.getElementById('radPpdSijil').checked;
    
    // UI Elements
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const divPeringkat = document.getElementById('divPpdPeringkat');
    
    const lblProgram = document.getElementById('lblPpdProgram');
    const inpProgram = document.getElementById('ppdProgram');
    
    const lblPencapaian = document.getElementById('lblPpdPencapaian');
    const inpPencapaian = document.getElementById('ppdPencapaian');

    document.getElementById('ppdJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        divPeringkat.classList.add('hidden'); // Sembunyi dropdown peringkat

        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        
        lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2";

    } else {
        divPenyedia.classList.add('hidden');
        divPeringkat.classList.remove('hidden');

        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }
}

async function hantarBorangPPD() {
    const btn = document.querySelector('#formPPD button[type="submit"]');
    
    // Ambil Data
    const kategori = document.getElementById('ppdKategori').value;
    const jenisRekod = document.getElementById('ppdJenisRekod').value;
    const nama = document.getElementById('ppdNama').value.trim().toUpperCase();
    const program = document.getElementById('ppdProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('ppdPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('ppdLink').value.trim();
    const tahun = document.getElementById('ppdTahun').value;

    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';

    if (jenisRekod === 'PENSIJILAN') {
        peringkat = 'ANTARABANGSA'; // Default Profesional
        penyedia = document.getElementById('ppdPenyedia').value;
    } else {
        peringkat = document.getElementById('ppdPeringkat').value;
    }

    // Validasi
    if (!nama || !program || !pencapaian || !link || !tahun) {
        return Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
    }

    if(btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>MENGHANTAR...`; }

    try {
        const payload = {
            kod_sekolah: 'M030', // Hardcoded untuk PPD
            kategori: kategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: parseInt(tahun),
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        const { error } = await db.from('smpid_pencapaian').insert([payload]);
        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Rekod PPD Disimpan',
            text: 'Data telah berjaya direkodkan.',
            confirmButtonText: 'OK'
        }).then(() => {
            resetBorangPPD();
        });

    } catch (err) {
        console.error(err);
        Swal.fire('Ralat', 'Gagal menghantar data.', 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-save me-2"></i>SIMPAN REKOD PPD`; }
    }
}

function resetBorangPPD() {
    document.getElementById('ppdNama').value = "";
    document.getElementById('ppdProgram').value = "";
    document.getElementById('ppdPencapaian').value = "";
    document.getElementById('ppdLink').value = "";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// BAHAGIAN 2: LOGIK SEKOLAH (STANDARD)
// ==========================================

function validateAndLockSchool(kod) {
    const school = globalSchoolList.find(s => s.kod_sekolah === kod);
    const input = document.getElementById('inputCariSekolah');
    const statusMsg = document.getElementById('schoolStatusMsg');
    const finalInput = document.getElementById('finalKodSekolah');
    const btnGallery = document.getElementById('btnViewGallery');
    
    if (school) {
        input.value = `${school.kod_sekolah} - ${school.nama_sekolah}`;
        input.classList.add('bg-success', 'bg-opacity-10', 'border-success', 'text-success');
        input.disabled = true; 

        finalInput.value = school.kod_sekolah;
        statusMsg.classList.remove('hidden', 'text-danger');
        statusMsg.classList.add('text-success');
        statusMsg.innerHTML = `<i class="fas fa-check-circle me-1"></i> Sekolah disahkan.`;
        enableForm(); 

        // AKTIFKAN BUTANG GALERI
        if (btnGallery) {
            btnGallery.classList.remove('hidden');
            btnGallery.href = `gallery.html?kod=${school.kod_sekolah}`;
        }

    } else {
        input.value = kod;
        statusMsg.classList.remove('hidden', 'text-success');
        statusMsg.classList.add('text-danger');
        statusMsg.innerHTML = `<i class="fas fa-times-circle me-1"></i> Kod tidak sah.`;
        
        // SOROK BUTANG GALERI
        if (btnGallery) btnGallery.classList.add('hidden');
        setupManualSearch();
    }
}

function setupManualSearch() {
    const input = document.getElementById('inputCariSekolah');
    const finalInput = document.getElementById('finalKodSekolah');
    const btnGallery = document.getElementById('btnViewGallery');

    if(input) input.disabled = false;
    
    if(input) {
        input.addEventListener('change', function() {
            const val = this.value;
            const parts = val.split(' - ');
            if (parts.length >= 2) {
                const kodPotensi = parts[0].trim();
                const school = globalSchoolList.find(s => s.kod_sekolah === kodPotensi);
                if (school) {
                    finalInput.value = school.kod_sekolah;
                    enableForm();
                    // Update Gallery Link
                    if (btnGallery) {
                        btnGallery.classList.remove('hidden');
                        btnGallery.href = `gallery.html?kod=${school.kod_sekolah}`;
                    }
                } else {
                    finalInput.value = "";
                    disableForm();
                    if(btnGallery) btnGallery.classList.add('hidden');
                }
            } else {
                finalInput.value = "";
                disableForm();
                if(btnGallery) btnGallery.classList.add('hidden');
            }
        });
    }
}

function enableForm() {
    const formSection = document.getElementById('formSection');
    if(formSection) {
        formSection.classList.remove('disabled-form');
        formSection.classList.add('enabled-form');
    }
}

function disableForm() {
    const formSection = document.getElementById('formSection');
    if(formSection) {
        formSection.classList.remove('enabled-form');
        formSection.classList.add('disabled-form');
    }
}

// --- LOGIK UI BORANG AWAM (STANDARD) ---
function setPublicType(type) {
    document.getElementById('pubKategori').value = type;

    // Update Tabs
    const buttons = document.querySelectorAll('#publicTabs button');
    buttons.forEach(btn => {
        if (btn.innerText === type) {
            btn.classList.add('active', 'bg-primary', 'text-white');
            btn.classList.remove('bg-light', 'text-dark');
        } else {
            btn.classList.remove('active', 'bg-primary', 'text-white');
        }
    });

    const lblNama = document.getElementById('lblPubNama');
    const inpNama = document.getElementById('pubNama');
    const wrapperJenis = document.getElementById('wrapperPubJenis');

    if (type === 'GURU') {
        wrapperJenis.classList.remove('hidden'); 
        lblNama.innerText = "NAMA GURU";
        inpNama.placeholder = "Taip nama penuh guru...";
        inpNama.readOnly = false;
        inpNama.value = ""; 
        
        document.getElementById('radPubPertandingan').checked = true;
        togglePubJenis();
    } 
    else if (type === 'MURID') {
        wrapperJenis.classList.add('hidden');
        lblNama.innerText = "NAMA MURID / KUMPULAN";
        inpNama.placeholder = "Taip nama penuh murid...";
        inpNama.readOnly = false;
        inpNama.value = ""; 

        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        togglePubJenis(); 
    }
    else if (type === 'SEKOLAH') {
        wrapperJenis.classList.add('hidden');
        lblNama.innerText = "NAMA SEKOLAH";
        
        const schoolName = document.getElementById('inputCariSekolah').value.split(' - ')[1] || "";
        inpNama.value = schoolName; 
        inpNama.readOnly = true;

        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        togglePubJenis();
    }
}

function togglePubJenis() {
    const isSijil = document.getElementById('radPubSijil').checked;
    const type = document.getElementById('pubKategori').value;

    const divPenyedia = document.getElementById('divPubPenyedia');
    const divPeringkat = document.getElementById('divPubPeringkat');
    
    const lblProgram = document.getElementById('lblPubProgram');
    const inpProgram = document.getElementById('pubProgram');
    
    const lblPencapaian = document.getElementById('lblPubPencapaian');
    const inpPencapaian = document.getElementById('pubPencapaian');

    document.getElementById('pubJenisRekod').value = isSijil ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isSijil && type === 'GURU') {
        divPenyedia.classList.remove('hidden');
        divPeringkat.classList.add('hidden'); 

        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        
        lblPencapaian.innerText = "TAHAP / SKOR";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2";
    } else {
        divPenyedia.classList.add('hidden');
        divPeringkat.classList.remove('hidden');

        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }
}

async function hantarBorangAwam() {
    const kod = document.getElementById('finalKodSekolah').value;
    const btn = document.querySelector('#formPublic button[type="submit"]');

    if (!kod) return Swal.fire('Ralat', 'Sila pilih sekolah dahulu.', 'warning');

    const kategori = document.getElementById('pubKategori').value;
    const jenisRekod = document.getElementById('pubJenisRekod').value;
    const nama = document.getElementById('pubNama').value.trim().toUpperCase();
    const program = document.getElementById('pubProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('pubPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('pubLink').value.trim();
    const tahun = document.getElementById('pubTahun').value;

    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';

    if (jenisRekod === 'PENSIJILAN') {
        peringkat = 'ANTARABANGSA'; 
        penyedia = document.getElementById('pubPenyedia').value;
    } else {
        peringkat = document.getElementById('pubPeringkat').value;
    }

    if (!nama || !program || !pencapaian || !link || !tahun) {
        return Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat bertanda.', 'warning');
    }

    if(btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>MENGHANTAR...`; }

    try {
        const payload = {
            kod_sekolah: kod,
            kategori: kategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: parseInt(tahun),
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        const { error } = await db.from('smpid_pencapaian').insert([payload]);
        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Berjaya!',
            text: 'Data telah disimpan.',
            confirmButtonText: 'OK'
        }).then(() => {
            resetBorang(false);
        });

    } catch (err) {
        console.error(err);
        Swal.fire('Ralat', 'Gagal menghantar data.', 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane me-2"></i>HANTAR MAKLUMAT`; }
    }
}

function resetBorang(fullReset = true) {
    document.getElementById('pubProgram').value = "";
    document.getElementById('pubPencapaian').value = "";
    document.getElementById('pubLink').value = "";
    
    const cat = document.getElementById('pubKategori').value;
    if (cat !== 'SEKOLAH') {
        document.getElementById('pubNama').value = "";
    }

    if (fullReset) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}