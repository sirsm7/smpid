/**
 * PUBLIC FORM CONTROLLER
 * Menguruskan logik borang serahan data awam.
 * Menggunakan: SchoolService, AchievementService
 */

import { SchoolService } from './services/school.service.js';
import { AchievementService } from './services/achievement.service.js';
import { toggleLoading } from './core/helpers.js';

let globalSchoolList = [];

document.addEventListener('DOMContentLoaded', () => {
    initPublicPortal();
});

async function initPublicPortal() {
    toggleLoading(true);

    try {
        // 1. Muat turun senarai sekolah guna Service
        const schools = await SchoolService.getAll();
        globalSchoolList = schools;

        // Populate Datalist
        const datalist = document.getElementById('listSekolah');
        datalist.innerHTML = '';
        schools.forEach(s => {
            const opt = document.createElement('option');
            opt.value = `${s.kod_sekolah} - ${s.nama_sekolah}`;
            datalist.appendChild(opt);
        });

        // 2. Semak URL Parameter
        const urlParams = new URLSearchParams(window.location.search);
        const kodURL = urlParams.get('kod') ? urlParams.get('kod').toUpperCase() : null;

        if (kodURL === 'M030') {
            setupPPDMode();
        } else if (kodURL) {
            validateAndLockSchool(kodURL);
        } else {
            setupManualSearch();
        }

    } catch (err) {
        console.error("Public Init Error:", err);
        Swal.fire("Ralat Sistem", "Gagal memuatkan data sekolah.", "error");
    } finally {
        toggleLoading(false);
    }
}

// --- LOGIK UI UTAMA ---

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
                    finalInput.value = school.kod_sekolah;
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

        if (btnGallery) {
            btnGallery.classList.remove('hidden');
            btnGallery.href = `gallery.html?kod=${school.kod_sekolah}`;
        }
    } else {
        input.value = kod;
        statusMsg.classList.remove('hidden', 'text-success');
        statusMsg.classList.add('text-danger');
        statusMsg.innerHTML = `<i class="fas fa-times-circle me-1"></i> Kod tidak sah.`;
        if (btnGallery) btnGallery.classList.add('hidden');
        setupManualSearch();
    }
}

function resetFormState() {
    document.getElementById('finalKodSekolah').value = "";
    disableForm();
    document.getElementById('btnViewGallery').classList.add('hidden');
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

// --- LOGIK UI BORANG (Standard) ---

// Fungsi ini terdedah kepada window untuk onclick HTML
window.setPublicType = function(type) {
    document.getElementById('pubKategori').value = type;

    // Update Tabs UI
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
    const divJawatan = document.getElementById('divPubJawatan');

    if (type === 'GURU') {
        wrapperJenis.classList.remove('hidden');
        divJawatan.classList.remove('hidden');
        lblNama.innerText = "NAMA GURU";
        inpNama.placeholder = "Taip nama penuh guru...";
        inpNama.readOnly = false;
        inpNama.value = ""; 
        document.getElementById('radPubPertandingan').checked = true;
        window.togglePubJenis();
    } 
    else if (type === 'MURID') {
        wrapperJenis.classList.add('hidden');
        divJawatan.classList.add('hidden');
        lblNama.innerText = "NAMA MURID / KUMPULAN";
        inpNama.placeholder = "Taip nama penuh murid...";
        inpNama.readOnly = false;
        inpNama.value = ""; 
        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        window.togglePubJenis(); 
    }
    else if (type === 'SEKOLAH') {
        wrapperJenis.classList.add('hidden');
        divJawatan.classList.add('hidden');
        lblNama.innerText = "NAMA SEKOLAH";
        const schoolName = document.getElementById('inputCariSekolah').value.split(' - ')[1] || "";
        inpNama.value = schoolName; 
        inpNama.readOnly = true;
        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        window.togglePubJenis();
    }
};

window.togglePubJenis = function() {
    const isSijil = document.getElementById('radPubSijil').checked;
    const type = document.getElementById('pubKategori').value;

    const divPenyedia = document.getElementById('divPubPenyedia');
    const colPeringkat = document.getElementById('divPubColPeringkat');
    
    const lblProgram = document.getElementById('lblPubProgram');
    const inpProgram = document.getElementById('pubProgram');
    
    const lblPencapaian = document.getElementById('lblPubPencapaian');
    const inpPencapaian = document.getElementById('pubPencapaian');

    document.getElementById('pubJenisRekod').value = isSijil ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isSijil && type === 'GURU') {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden'); 
        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        lblPencapaian.innerText = "TAHAP / SKOR";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2";
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden');
        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }
};

// --- PENGHANTARAN BORANG ---

window.hantarBorangAwam = async function() {
    const kod = document.getElementById('finalKodSekolah').value;
    const btn = document.querySelector('#formPublic button[type="submit"]');

    if (!kod) return Swal.fire('Ralat', 'Sila pilih sekolah dahulu.', 'warning');

    // Kumpul Data
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
        if (!jawatan) return Swal.fire('Jawatan Wajib', 'Sila pilih jawatan guru.', 'warning');
    }

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
            kategori, nama_peserta: nama, nama_pertandingan: program,
            peringkat, tahun: parseInt(tahun), pencapaian,
            pautan_bukti: link, jenis_rekod: jenisRekod, penyedia, jawatan
        };

        // Guna Service
        await AchievementService.create(payload);

        Swal.fire({
            icon: 'success',
            title: 'Berjaya!',
            text: 'Data telah disimpan.',
            confirmButtonText: 'OK'
        }).then(() => {
            window.resetBorang(false);
        });

    } catch (err) {
        console.error(err);
        Swal.fire('Ralat', 'Gagal menghantar data.', 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-paper-plane me-2"></i>HANTAR MAKLUMAT`; }
    }
};

window.resetBorang = function(fullReset = true) {
    document.getElementById('pubProgram').value = "";
    document.getElementById('pubPencapaian').value = "";
    document.getElementById('pubLink').value = "";
    // Jangan reset tahun - biarkan default HTML (2026)
    
    const cat = document.getElementById('pubKategori').value;
    if (cat !== 'SEKOLAH') {
        document.getElementById('pubNama').value = "";
    }

    if (fullReset) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// --- LOGIK PPD (M030) ---

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
    const isUnit = document.getElementById('radPpdUnit').checked;
    const lbl = document.getElementById('lblPpdNama');
    const inp = document.getElementById('ppdNama');
    const hiddenCat = document.getElementById('ppdKategori');
    
    if (isUnit) {
        lbl.innerText = "NAMA UNIT / SEKTOR";
        inp.placeholder = "Contoh: SEKTOR PEMBELAJARAN";
        hiddenCat.value = "PPD";
    } else {
        lbl.innerText = "NAMA PEGAWAI";
        inp.placeholder = "Taip nama penuh...";
        hiddenCat.value = "PEGAWAI";
    }
};

window.toggleJenisPencapaianPPD = function() {
    const isPensijilan = document.getElementById('radPpdSijil').checked;
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const colPeringkat = document.getElementById('divPpdColPeringkat'); // Guna ID Column
    
    const lblProgram = document.getElementById('lblPpdProgram');
    const inpProgram = document.getElementById('ppdProgram');
    const lblPencapaian = document.getElementById('lblPpdPencapaian');
    const inpPencapaian = document.getElementById('ppdPencapaian');

    document.getElementById('ppdJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden'); 
        
        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2";
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden');
        
        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
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
        return Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
    }

    if(btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>MENGHANTAR...`; }

    try {
        const payload = {
            kod_sekolah: 'M030',
            kategori, nama_peserta: nama, nama_pertandingan: program,
            peringkat, tahun: parseInt(tahun), pencapaian,
            pautan_bukti: link, jenis_rekod: jenisRekod, penyedia
        };

        // Guna Service
        await AchievementService.create(payload);

        Swal.fire({
            icon: 'success',
            title: 'Rekod PPD Disimpan',
            text: 'Data telah berjaya direkodkan.',
            confirmButtonText: 'OK'
        }).then(() => {
            window.resetBorangPPD();
        });

    } catch (err) {
        console.error(err);
        Swal.fire('Ralat', 'Gagal menghantar data.', 'error');
    } finally {
        if(btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-save me-2"></i>SIMPAN REKOD PPD`; }
    }
};

window.resetBorangPPD = function() {
    document.getElementById('ppdNama').value = "";
    document.getElementById('ppdProgram').value = "";
    document.getElementById('ppdPencapaian').value = "";
    document.getElementById('ppdLink').value = "";
    // Jangan reset tahun
    window.scrollTo({ top: 0, behavior: 'smooth' });
};