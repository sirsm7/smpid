/**
 * PUBLIC FORM MODULE (FULL PRODUCTION VERSION)
 * Menguruskan logik borang serahan data awam, pengesahan sekolah,
 * penapisan kategori, dan integrasi mod PPD (M030).
 * --- UPDATE V1.3 ---
 * Integration: DROPDOWN_DATA standardisation for JAWATAN, PERINGKAT, PENYEDIA.
 * Penambahan: Dropdown TAHUN (Dinamik 2020 - Semasa).
 */

import { SchoolService } from './services/school.service.js';
import { AchievementService } from './services/achievement.service.js';
import { toggleLoading, formatSentenceCase } from './core/helpers.js';
import { populateDropdown } from './config/dropdowns.js';

// --- GLOBAL STATE ---
let globalSchoolList = [];

/**
 * Inisialisasi portal awam apabila DOM sedia.
 */
document.addEventListener('DOMContentLoaded', () => {
    initPublicPortal();
});

async function initPublicPortal() {
    toggleLoading(true);

    try {
        // 1. Muat turun senarai sekolah dari pangkalan data
        const schools = await SchoolService.getAll();
        globalSchoolList = schools;

        // Isi Datalist untuk carian sekolah manual
        const datalist = document.getElementById('listSekolah');
        if(datalist) {
            datalist.innerHTML = '';
            schools.forEach(s => {
                const opt = document.createElement('option');
                opt.value = `${s.kod_sekolah} - ${s.nama_sekolah}`;
                datalist.appendChild(opt);
            });
        }

        // 2. Standardisasi Dropdown (Surgical Injection)
        // Mengisi semua dropdown menggunakan data berpusat dari dropdowns.js
        const currentYear = new Date().getFullYear().toString();
        
        populateDropdown('pubJawatan', 'JAWATAN', 'GURU AKADEMIK BIASA');
        populateDropdown('pubPeringkat', 'PERINGKAT', 'KEBANGSAAN');
        populateDropdown('pubPenyedia', 'PENYEDIA', 'LAIN-LAIN');
        populateDropdown('pubTahun', 'TAHUN', currentYear); // Dropdown Tahun Baru
        
        // PPD Dropdowns (M030)
        populateDropdown('ppdPeringkat', 'PERINGKAT', 'KEBANGSAAN');
        populateDropdown('ppdPenyedia', 'PENYEDIA', 'LAIN-LAIN');
        populateDropdown('ppdTahun', 'TAHUN', currentYear); // Dropdown Tahun PPD Baru

        // 3. Semak Parameter URL (Auto-lock sekolah)
        const urlParams = new URLSearchParams(window.location.search);
        const kodURL = urlParams.get('kod') ? urlParams.get('kod').toUpperCase() : null;

        if (kodURL === 'M030') {
            // Aktifkan mod khas PPD
            setupPPDMode();
        } else if (kodURL) {
            // Sahkan kod sekolah dari URL
            validateAndLockSchool(kodURL);
        } else {
            // Benarkan carian manual jika tiada parameter
            setupManualSearch();
        }

    } catch (err) {
        console.error("[Public] Gagal memulakan portal:", err);
        Swal.fire({
            icon: 'error',
            title: 'Ralat Pemuatan',
            text: 'Gagal memuatkan data sekolah. Sila cuba lagi.',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        toggleLoading(false);
    }
}

// --- 1. SCHOOL VALIDATION LOGIC ---

/**
 * Menguruskan input carian sekolah secara manual.
 */
function setupManualSearch() {
    const input = document.getElementById('inputCariSekolah');
    const finalInput = document.getElementById('finalKodSekolah');
    const btnGallery = document.getElementById('btnViewGallery');

    if(input) {
        input.disabled = false;
        input.addEventListener('change', function() {
            const val = this.value;
            const parts = val.split(' - ');
            if (parts.length >= 2) {
                const kodPotensi = parts[0].trim();
                const school = globalSchoolList.find(s => s.kod_sekolah === kodPotensi);
                if (school) {
                    if(finalInput) finalInput.value = school.kod_sekolah;
                    enableForm();
                    if (btnGallery) {
                        btnGallery.classList.remove('hidden');
                        btnGallery.href = `gallery.html?kod=${school.kod_sekolah}`;
                    }
                } else {
                    resetFormState();
                }
            } else {
                resetFormState();
            }
        });
    }
}

/**
 * Mengunci borang kepada sekolah tertentu jika parameter URL sah.
 */
function validateAndLockSchool(kod) {
    const school = globalSchoolList.find(s => s.kod_sekolah === kod);
    const input = document.getElementById('inputCariSekolah');
    const statusMsg = document.getElementById('schoolStatusMsg');
    const finalInput = document.getElementById('finalKodSekolah');
    const btnGallery = document.getElementById('btnViewGallery');
    
    if (school) {
        if(input) {
            input.value = `${school.kod_sekolah} - ${school.nama_sekolah}`;
            input.classList.add('bg-green-50', 'border-green-500', 'text-green-700');
            input.disabled = true; 
        }

        if(finalInput) finalInput.value = school.kod_sekolah;
        
        if(statusMsg) {
            statusMsg.classList.remove('hidden', 'text-red-500');
            statusMsg.classList.add('text-green-600');
            statusMsg.innerHTML = `<i class="fas fa-check-circle me-1"></i> Sekolah disahkan.`;
        }
        
        enableForm(); 

        if (btnGallery) {
            btnGallery.classList.remove('hidden');
            btnGallery.href = `gallery.html?kod=${school.kod_sekolah}`;
        }
    } else {
        if(input) input.value = kod;
        if(statusMsg) {
            statusMsg.classList.remove('hidden', 'text-green-600');
            statusMsg.classList.add('text-red-500');
            statusMsg.innerHTML = `<i class="fas fa-times-circle me-1"></i> Kod sekolah tidak ditemui.`;
        }
        if (btnGallery) btnGallery.classList.add('hidden');
        setupManualSearch();
    }
}

function resetFormState() {
    const finalInput = document.getElementById('finalKodSekolah');
    if(finalInput) finalInput.value = "";
    disableForm();
    const btnGallery = document.getElementById('btnViewGallery');
    if(btnGallery) btnGallery.classList.add('hidden');
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

// --- 2. FORM INTERACTION LOGIC ---

/**
 * Menukar UI borang mengikut kategori (Murid, Guru, Sekolah).
 */
window.setPublicType = function(type) {
    document.getElementById('pubKategori').value = type;

    // Kemaskini Visual Tab (Tailwind)
    const buttons = document.querySelectorAll('#publicTabs button');
    buttons.forEach(btn => {
        if (btn.innerText === type) {
            btn.className = 'flex-1 py-2 rounded-lg text-xs font-bold text-white bg-brand-600 shadow-md transition-all text-center transform scale-105';
        } else {
            btn.className = 'flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-all text-center';
        }
    });

    const lblNama = document.getElementById('lblPubNama');
    const inpNama = document.getElementById('pubNama');
    const wrapperJenis = document.getElementById('wrapperPubJenis');
    const divJawatan = document.getElementById('divPubJawatan');

    if (type === 'GURU') {
        if(wrapperJenis) wrapperJenis.classList.remove('hidden');
        if(divJawatan) divJawatan.classList.remove('hidden');
        if(lblNama) lblNama.innerText = "NAMA GURU";
        if(inpNama) {
            inpNama.placeholder = "TAIP NAMA PENUH GURU...";
            inpNama.readOnly = false;
            inpNama.value = ""; 
        }
        
        const radPertandingan = document.getElementById('radPubPertandingan');
        if(radPertandingan) radPertandingan.checked = true;
        
        window.togglePubJenis();
    } 
    else if (type === 'MURID') {
        if(wrapperJenis) wrapperJenis.classList.add('hidden');
        if(divJawatan) divJawatan.classList.add('hidden');
        if(lblNama) lblNama.innerText = "NAMA MURID / KUMPULAN";
        if(inpNama) {
            inpNama.placeholder = "TAIP NAMA PENUH MURID...";
            inpNama.readOnly = false;
            inpNama.value = ""; 
        }
        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        window.togglePubJenis(); 
    }
    else if (type === 'SEKOLAH') {
        if(wrapperJenis) wrapperJenis.classList.add('hidden');
        if(divJawatan) divJawatan.classList.add('hidden');
        if(lblNama) lblNama.innerText = "NAMA SEKOLAH";
        
        const searchInput = document.getElementById('inputCariSekolah');
        let schoolName = "";
        if(searchInput && searchInput.value.includes(' - ')) {
             schoolName = searchInput.value.split(' - ')[1];
        } else if(searchInput) {
             schoolName = searchInput.value;
        }
        
        if(inpNama) {
            inpNama.value = schoolName || ""; 
            inpNama.readOnly = true;
        }
        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        window.togglePubJenis();
    }
};

/**
 * Menukar medan input berdasarkan jenis rekod (Pertandingan vs Pensijilan).
 */
window.togglePubJenis = function() {
    const radSijil = document.getElementById('radPubSijil');
    const isSijil = radSijil ? radSijil.checked : false;
    const type = document.getElementById('pubKategori').value;

    const divPenyedia = document.getElementById('divPubPenyedia');
    const colPeringkat = document.getElementById('divPubColPeringkat');
    const lblProgram = document.getElementById('lblPubProgram');
    const inpProgram = document.getElementById('pubProgram');
    const lblPencapaian = document.getElementById('lblPubPencapaian');
    const inpPencapaian = document.getElementById('pubPencapaian');

    document.getElementById('pubJenisRekod').value = isSijil ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isSijil && type === 'GURU') {
        if(divPenyedia) divPenyedia.classList.remove('hidden');
        if(colPeringkat) colPeringkat.classList.add('hidden'); 
        if(lblProgram) lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        if(inpProgram) inpProgram.placeholder = "CONTOH: GOOGLE CERTIFIED EDUCATOR L1";
        if(lblPencapaian) lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        if(inpPencapaian) inpPencapaian.placeholder = "CONTOH: LULUS / BAND C2";
    } else {
        if(divPenyedia) divPenyedia.classList.add('hidden');
        if(colPeringkat) colPeringkat.classList.remove('hidden');
        if(lblProgram) lblProgram.innerText = "NAMA PERTANDINGAN";
        if(inpProgram) inpProgram.placeholder = "CONTOH: DIGITAL COMPETENCY 2025";
        if(lblPencapaian) lblPencapaian.innerText = "KEPUTUSAN / PENCAPAIAN";
        if(inpPencapaian) inpPencapaian.placeholder = "CONTOH: JOHAN / EMAS / PENYERTAAN";
    }
};

// --- 3. SUBMISSION LOGIC ---

/**
 * Menghantar borang serahan data awam.
 */
window.hantarBorangAwam = async function() {
    const kod = document.getElementById('finalKodSekolah').value;
    const btn = document.querySelector('#formPublic button[type="submit"]');

    if (!kod) {
        return Swal.fire({
            icon: 'warning',
            title: 'Ralat Pengesahan',
            text: 'Sila pilih dan sahkan sekolah anda terlebih dahulu.',
            confirmButtonColor: '#fbbf24'
        });
    }

    // Pengumpulan Data
    const kategori = document.getElementById('pubKategori').value;
    const jenisRekod = document.getElementById('pubJenisRekod').value;
    const nama = document.getElementById('pubNama').value.trim().toUpperCase();
    const program = document.getElementById('pubProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('pubPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('pubLink').value.trim();
    const tahun = document.getElementById('pubTahun').value;

    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';
    let jawatan = null;

    if (kategori === 'GURU') {
        jawatan = document.getElementById('pubJawatan').value;
        if (!jawatan) return Swal.fire('Jawatan Diperlukan', 'Sila pilih jawatan guru.', 'warning');
    }

    if (jenisRekod === 'PENSIJILAN') {
        peringkat = 'ANTARABANGSA'; // Auto-set untuk pensijilan
        penyedia = document.getElementById('pubPenyedia').value;
    } else {
        peringkat = document.getElementById('pubPeringkat').value;
    }

    // Validasi Asas
    if (!nama || !program || !pencapaian || !link || !tahun) {
        return Swal.fire({
            icon: 'warning',
            title: 'Data Tidak Lengkap',
            text: 'Sila pastikan semua ruangan bertanda telah diisi.',
            confirmButtonColor: '#fbbf24'
        });
    }

    // UI Feedback
    if(btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>MENGHANTAR...`;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    try {
        const payload = {
            kod_sekolah: kod,
            kategori, 
            nama_peserta: nama, 
            nama_pertandingan: program,
            peringkat, 
            tahun: parseInt(tahun), 
            pencapaian,
            pautan_bukti: link, 
            jenis_rekod: jenisRekod, 
            penyedia, 
            jawatan
        };

        await AchievementService.create(payload);

        Swal.fire({
            icon: 'success',
            title: 'Berjaya Disimpan!',
            text: 'Rekod pencapaian telah berjaya direkodkan.',
            confirmButtonText: 'Terima Kasih',
            confirmButtonColor: '#16a34a'
        }).then(() => {
            window.resetBorang(false);
        });

    } catch (err) {
        console.error("[Public] Submit Error:", err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menghantar',
            text: 'Sistem mengalami gangguan. Sila cuba sebentar lagi.',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.innerHTML = `<i class="fas fa-paper-plane me-2"></i>HANTAR MAKLUMAT`;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }
};

window.resetBorang = function(fullReset = true) {
    const form = document.getElementById('formPublic');
    if(form) {
        document.getElementById('pubProgram').value = "";
        document.getElementById('pubPencapaian').value = "";
        document.getElementById('pubLink').value = "";
        
        const cat = document.getElementById('pubKategori').value;
        if (cat !== 'SEKOLAH') {
            document.getElementById('pubNama').value = "";
        }
    }

    if (fullReset) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// --- 4. PPD MODE LOGIC (M030) ---

/**
 * Konfigurasi portal khusus untuk Pejabat Pendidikan Daerah.
 */
window.setupPPDMode = function() {
    const cardSekolah = document.getElementById('cardIdentitiSekolah');
    const formSekolah = document.getElementById('formSection');
    if(cardSekolah) cardSekolah.classList.add('hidden');
    if(formSekolah) formSekolah.classList.add('hidden');

    const cardPPD = document.getElementById('cardIdentitiPPD');
    const formPPD = document.getElementById('formSectionPPD');
    if(cardPPD) cardPPD.classList.remove('hidden');
    if(formPPD) formPPD.classList.remove('hidden');

    window.toggleKategoriPPD();
    window.toggleJenisPencapaianPPD();
};

window.toggleKategoriPPD = function() {
    const radUnit = document.getElementById('radPpdUnit');
    const isUnit = radUnit ? radUnit.checked : false;
    const lbl = document.getElementById('lblPpdNama');
    const inp = document.getElementById('ppdNama');
    const hiddenCat = document.getElementById('ppdKategori');
    
    if (isUnit) {
        if(lbl) lbl.innerText = "NAMA UNIT / SEKTOR";
        if(inp) inp.placeholder = "CONTOH: SEKTOR PEMBELAJARAN";
        if(hiddenCat) hiddenCat.value = "PPD";
    } else {
        if(lbl) lbl.innerText = "NAMA PEGAWAI";
        if(inp) inp.placeholder = "TAIP NAMA PENUH PEGAWAI...";
        if(hiddenCat) hiddenCat.value = "PEGAWAI";
    }
};

window.toggleJenisPencapaianPPD = function() {
    const radSijil = document.getElementById('radPpdSijil');
    const isPensijilan = radSijil ? radSijil.checked : false;
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const colPeringkat = document.getElementById('divPpdColPeringkat');
    
    const lblProg = document.getElementById('lblPpdProgram');
    const inpProg = document.getElementById('ppdProgram');
    const lblPenc = document.getElementById('lblPpdPencapaian');
    const inpPenc = document.getElementById('ppdPencapaian');

    document.getElementById('ppdJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isPensijilan) {
        if(divPenyedia) divPenyedia.classList.remove('hidden');
        if(colPeringkat) colPeringkat.classList.add('hidden'); 
        
        if(lblProg) lblProg.innerText = "NAMA SIJIL / PROGRAM";
        if(inpProg) inpProg.placeholder = "CONTOH: GOOGLE CERTIFIED EDUCATOR L1";
        if(lblPenc) lblPenc.innerText = "TAHAP / SKOR / BAND";
        if(inpPenc) inpPenc.placeholder = "CONTOH: LULUS / BAND C2";
    } else {
        if(divPenyedia) divPenyedia.classList.add('hidden');
        if(colPeringkat) colPeringkat.classList.remove('hidden');
        
        if(lblProg) lblProg.innerText = "NAMA PERTANDINGAN";
        if(inpProg) inpProg.placeholder = "CONTOH: DIGITAL LEADERSHIP 2026";
        if(lblPenc) lblPenc.innerText = "PENCAPAIAN";
        if(inpPenc) inpPenc.placeholder = "CONTOH: JOHAN / EMAS / PENYERTAAN";
    }
};

window.hantarBorangPPD = async function() {
    const btn = document.querySelector('#formPPD button[type="submit"]');
    
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
        peringkat = 'ANTARABANGSA';
        penyedia = document.getElementById('ppdPenyedia').value;
    } else {
        peringkat = document.getElementById('ppdPeringkat').value;
    }

    if (!nama || !program || !pencapaian || !link || !tahun) {
        return Swal.fire({
            icon: 'warning',
            title: 'Tidak Lengkap',
            text: 'Sila isi semua maklumat bagi rekod PPD.',
            confirmButtonColor: '#7e22ce'
        });
    }

    if(btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>MENGHANTAR...`;
        btn.classList.add('opacity-75');
    }

    try {
        const payload = {
            kod_sekolah: 'M030',
            kategori, 
            nama_peserta: nama, 
            nama_pertandingan: program,
            peringkat, 
            tahun: parseInt(tahun), 
            pencapaian,
            pautan_bukti: link, 
            jenis_rekod: jenisRekod, 
            penyedia
        };

        await AchievementService.create(payload);

        Swal.fire({
            icon: 'success',
            title: 'Rekod PPD Disimpan',
            text: 'Data pegawai/unit telah berjaya direkodkan.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#7e22ce'
        }).then(() => {
            window.resetBorangPPD();
        });

    } catch (err) {
        console.error("[PPD] Submit Error:", err);
        Swal.fire('Ralat Sistem', 'Gagal menghantar data PPD.', 'error');
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.innerHTML = `<i class="fas fa-save me-2"></i>SIMPAN REKOD PPD`;
            btn.classList.remove('opacity-75');
        }
    }
};

window.resetBorangPPD = function() {
    const form = document.getElementById('formPPD');
    if(form) {
        document.getElementById('ppdNama').value = "";
        document.getElementById('ppdProgram').value = "";
        document.getElementById('ppdPencapaian').value = "";
        document.getElementById('ppdLink').value = "";
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};