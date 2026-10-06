/**
 * PUBLIC FORM MODULE (FULL PRODUCTION VERSION)
 * Menguruskan logik borang serahan data awam, pengesahan sekolah,
 * penapisan kategori, dan integrasi mod PPD (Dinamik).
 * --- UPDATE V2.2 ---
 * Integration: Modul Penilaian Impak BBM Berbantukan AI.
 * Integration: Sokongan PPD Dinamik (Membuang hardcode M030) menggunakan APP_CONFIG.
 * Integration: Modul Upload Fail Base64 menggantikan input URL manual.
 * --- UPDATE V2.3 (UI & DATA IMPAK) ---
 * Integration: Menyokong Q14 logik bersyarat Subjek STEM.
 * Integration: Mengekstrak Q12 & Q13 menggunakan Array (JSONB/TEXT).
 */

import { SchoolService } from './services/school.service.js';
import { AchievementService } from './services/achievement.service.js';
import { ImpactService } from './services/impact.service.js'; // Import perkhidmatan Impak BBM
import { toggleLoading, formatSentenceCase, uploadFileToDrive } from './core/helpers.js';
import { populateDropdown, DROPDOWN_DATA } from './config/dropdowns.js';
import { APP_CONFIG } from './config/app.config.js';

// --- GLOBAL STATE ---
let globalSchoolList = [];
let currentPpdCode = null; // Menyimpan kod PPD semasa dari URL
let isImpakClosed = false; // Penanda status kuota Impak BBM

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
        const currentYear = new Date().getFullYear().toString();
        
        populateDropdown('pubJawatan', 'JAWATAN', 'GURU AKADEMIK BIASA');
        populateDropdown('pubPeringkat', 'PERINGKAT', 'KEBANGSAAN');
        populateDropdown('pubPenyedia', 'PENYEDIA', 'LAIN-LAIN');
        populateDropdown('pubTahun', 'TAHUN', currentYear); 
        
        // PPD Dropdowns
        populateDropdown('ppdPeringkat', 'PERINGKAT', 'KEBANGSAAN');
        populateDropdown('ppdPenyedia', 'PENYEDIA', 'LAIN-LAIN');
        populateDropdown('ppdTahun', 'TAHUN', currentYear); 

        // Modul Impak Dropdowns
        populateDropdown('impakUmur', 'UMUR_MURID'); // Fallback initial populate
        renderImpakCheckboxes();

        // 3. Semak Parameter URL (Auto-lock sekolah)
        const urlParams = new URLSearchParams(window.location.search);
        const kodURL = urlParams.get('kod') ? urlParams.get('kod').toUpperCase() : null;

        const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];

        if (kodURL && senaraiKodPPD.includes(kodURL)) {
            // Aktifkan mod khas PPD
            currentPpdCode = kodURL;
            setupPPDMode(kodURL);
        } else if (kodURL) {
            // Sahkan kod sekolah dari URL dan semak kuota
            validateAndLockSchool(kodURL);
        } else {
            // Benarkan carian manual
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
        input.addEventListener('change', async function() {
            const val = this.value;
            const parts = val.split(' - ');
            if (parts.length >= 2) {
                const kodPotensi = parts[0].trim();
                const school = globalSchoolList.find(s => s.kod_sekolah === kodPotensi);
                if (school) {
                    if(finalInput) finalInput.value = school.kod_sekolah;
                    
                    // Semak status kuota modul impak
                    await checkImpakStatus(school.kod_sekolah);
                    
                    // Kemaskini dropdown TAHUN / TINGKATAN secara dinamik
                    updateImpakUmurDropdown(school);
                    
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
async function validateAndLockSchool(kod) {
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
        
        // Semak status kuota modul impak
        await checkImpakStatus(school.kod_sekolah);
        
        // Kemaskini dropdown TAHUN / TINGKATAN secara dinamik
        updateImpakUmurDropdown(school);
        
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

/**
 * Menyemak sama ada sekolah telah mencapai had minimum 10 respons sah
 */
async function checkImpakStatus(kodSekolah) {
    try {
        const result = await ImpactService.checkSchoolQuota(kodSekolah);
        isImpakClosed = result.isClosed;
        
        // Jika pengguna sudah berada di tab IMPAK, kemaskini UI serta-merta
        const currentTab = document.getElementById('pubKategori')?.value;
        if (currentTab === 'IMPAK') {
            updateImpakUI();
        }
    } catch (e) {
        console.error("Gagal menyemak kuota impak:", e);
        isImpakClosed = false; // Fallback untuk mengelakkan borang tersekat
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
 * Mengemaskini dropdown TAHUN / TINGKATAN berdasarkan jenis sekolah.
 */
function updateImpakUmurDropdown(school) {
    const selectUmur = document.getElementById('impakUmur');
    if (!selectUmur || !DROPDOWN_DATA || !DROPDOWN_DATA['UMUR_MURID']) return;

    const jenisSekolah = (school.jenis_sekolah || '').toUpperCase();
    const umurData = DROPDOWN_DATA['UMUR_MURID'];
    
    // Tentukan sama ada ia sekolah menengah atau rendah berdasarkan kata kunci
    const isSekolahMenengah = ['SMK', 'SBP', 'SM SABK', 'KV'].some(keyword => jenisSekolah.includes(keyword));
    const isSekolahRendah = ['SK', 'SJKC', 'SJKT', 'SR SABK'].some(keyword => jenisSekolah.includes(keyword));

    selectUmur.innerHTML = '<option value="" disabled selected>- SILA PILIH -</option>';

    umurData.forEach(item => {
        const val = item.val;
        // Jika Menengah, hanya papar pilihan 'TINGKATAN'
        if (isSekolahMenengah) {
            if (val.includes('TINGKATAN')) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = item.txt;
                selectUmur.appendChild(opt);
            }
        } 
        // Jika Rendah, hanya papar pilihan 'TAHUN'
        else if (isSekolahRendah) {
            if (val.includes('TAHUN')) {
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = item.txt;
                selectUmur.appendChild(opt);
            }
        }
        // Jika jenis sekolah tidak spesifik (atau belum diset), papar semua
        else {
            const opt = document.createElement('option');
            opt.value = val;
            opt.innerText = item.txt;
            selectUmur.appendChild(opt);
        }
    });
}

/**
 * Menukar UI borang mengikut kategori (Murid, Guru, Sekolah, Impak).
 */
window.setPublicType = function(type) {
    document.getElementById('pubKategori').value = type;

    // Kemaskini Visual Tab (Tailwind)
    const tabs = ['MURID', 'GURU', 'SEKOLAH', 'IMPAK'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (!btn) return;
        
        if (t === type) {
            if (t === 'IMPAK') {
                btn.className = 'flex-1 min-w-[80px] py-2.5 rounded-xl text-[10px] md:text-xs font-black text-indigo-700 bg-indigo-100 shadow-md transition-all text-center border-indigo-300 transform scale-105';
            } else {
                btn.className = 'flex-1 min-w-[70px] py-2.5 rounded-xl text-xs font-black text-white bg-brand-600 shadow-md transition-all text-center transform scale-105';
            }
        } else {
            if (t === 'IMPAK') {
                btn.className = 'flex-1 min-w-[80px] py-2.5 rounded-xl text-[10px] md:text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200 transition-all text-center bg-white shadow-sm';
            } else {
                btn.className = 'flex-1 min-w-[70px] py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-all text-center';
            }
        }
    });

    const formMain = document.getElementById('formPublic');
    const formImpak = document.getElementById('formImpak');
    const impakClosedMsg = document.getElementById('impakClosedMsg');
    
    // Logik Paparan Borang Kemenjadian vs Borang Impak
    if (type === 'IMPAK') {
        if(formMain) formMain.classList.add('hidden');
        updateImpakUI();
    } else {
        if(formMain) formMain.classList.remove('hidden');
        if(formImpak) formImpak.classList.add('hidden');
        if(impakClosedMsg) impakClosedMsg.classList.add('hidden');
        
        // Teruskan logik borang kemenjadian asal
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
    }
};

/**
 * Mengawal paparan borang impak vs mesej penutupan
 */
function updateImpakUI() {
    const formImpak = document.getElementById('formImpak');
    const impakClosedMsg = document.getElementById('impakClosedMsg');
    
    // Semak sekali lagi untuk keselamatan (double-check) 
    // jika fungsi ini dipanggil sebelum promise `checkImpakStatus` selesai
    if (isImpakClosed) {
        if(formImpak) formImpak.classList.add('hidden');
        if(impakClosedMsg) impakClosedMsg.classList.remove('hidden');
    } else {
        if(formImpak) formImpak.classList.remove('hidden');
        if(impakClosedMsg) impakClosedMsg.classList.add('hidden');
    }
}

/**
 * Membina checkbox Q11 secara dinamik berdasarkan konfigurasi
 */
function renderImpakCheckboxes() {
    const container = document.getElementById('impakQ11Container');
    if (!container) return;
    
    const komponen = DROPDOWN_DATA['KOMPONEN_BBM'];
    let html = '';
    
    komponen.forEach((k, index) => {
        const id = `chk_bbm_${index}`;
        // Jika ini adalah opsyen "Lain-lain", kita tambah event handler khas
        const isLain = k.val === "Lain-lain";
        const extraAttrs = isLain ? `onchange="window.toggleQ11Lain(this.checked)"` : '';
        
        html += `
        <label class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition shadow-sm group">
            <input type="checkbox" name="impakQ11" value="${k.val}" class="accent-indigo-600 w-4 h-4" ${extraAttrs}> 
            <span class="text-xs font-bold text-slate-700 group-hover:text-indigo-800">${k.txt}</span>
        </label>`;
    });
    
    container.innerHTML = html;
}

window.toggleQ11Lain = function(isChecked) {
    const inputLain = document.getElementById('impakQ11Lain');
    if (inputLain) {
        if (isChecked) {
            inputLain.classList.remove('hidden');
            inputLain.focus();
        } else {
            inputLain.classList.add('hidden');
            inputLain.value = '';
        }
    }
};

/**
 * Memaparkan atau menyembunyikan kotak lungsur spesifik subjek STEM untuk Q14
 */
window.toggleQ14Subjek = function() {
    const containerSubjek = document.getElementById('containerSubjekSTEM');
    const radMain = document.querySelector('input[name="impakQ14Main"]:checked');
    const selSubjek = document.getElementById('impakQ14Sub');
    
    if (radMain && radMain.value === 'SUBJEK STEM') {
        containerSubjek.classList.remove('hidden');
        if (selSubjek) selSubjek.required = true;
    } else {
        containerSubjek.classList.add('hidden');
        if (selSubjek) {
            selSubjek.required = false;
            selSubjek.value = '';
        }
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

    const wrapperSijil = document.getElementById('wrapperPubSijil');
    const dropdownSijil = document.getElementById('pubSijilDropdown');
    const dropdownPenyedia = document.getElementById('pubPenyedia');

    document.getElementById('pubJenisRekod').value = isSijil ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isSijil && type === 'GURU') {
        if(divPenyedia) divPenyedia.classList.remove('hidden');
        if(colPeringkat) colPeringkat.classList.add('hidden'); 
        if(lblProgram) lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        
        if(wrapperSijil) wrapperSijil.classList.remove('hidden');
        if(dropdownSijil) dropdownSijil.value = ""; 
        if(dropdownPenyedia) {
            dropdownPenyedia.disabled = false;
            dropdownPenyedia.value = "LAIN-LAIN";
        }
        if(inpProgram) {
            inpProgram.placeholder = "NYATAKAN NAMA SIJIL (JIKA LAIN-LAIN)";
            inpProgram.classList.add('hidden');
            inpProgram.required = false;
        }

        if(lblPencapaian) lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        if(inpPencapaian) inpPencapaian.placeholder = "CONTOH: LULUS / BAND C2";
    } else {
        if(divPenyedia) divPenyedia.classList.add('hidden');
        if(colPeringkat) colPeringkat.classList.remove('hidden');
        if(lblProgram) lblProgram.innerText = "NAMA PERTANDINGAN";
        
        if(wrapperSijil) wrapperSijil.classList.add('hidden');
        if(dropdownPenyedia) dropdownPenyedia.disabled = false;
        if(inpProgram) {
            inpProgram.placeholder = "CONTOH: DIGITAL COMPETENCY 2025";
            inpProgram.classList.remove('hidden');
            inpProgram.required = true;
            inpProgram.value = "";
        }

        if(lblPencapaian) lblPencapaian.innerText = "KEPUTUSAN / PENCAPAIAN";
        if(inpPencapaian) inpPencapaian.placeholder = "CONTOH: JOHAN / EMAS / PENYERTAAN";
    }
};

window.handleSijilChange = function() {
    const dropdownSijil = document.getElementById('pubSijilDropdown');
    const manualInput = document.getElementById('pubProgram');
    const dropdownPenyedia = document.getElementById('pubPenyedia');
    
    if (!dropdownSijil || !manualInput || !dropdownPenyedia) return;
    
    const selectedVal = dropdownSijil.value;
    
    const penyediaMap = {
        "GOOGLE CERTIFIED EDUCATOR LEVEL 1": "GOOGLE",
        "GOOGLE CERTIFIED EDUCATOR LEVEL 2": "GOOGLE",
        "GEMINI CERTIFIED EDUCATOR": "GOOGLE",
        "GEMINI CERTIFIED STUDENT": "GOOGLE",
        "GEMINI CERTIFIED FACULTY": "GOOGLE",
        "GOOGLE CERTIFIED TRAINER": "GOOGLE",
        "GOOGLE CERTIFIED INNOVATOR": "GOOGLE",
        "GOOGLE CERTIFIED COACH": "GOOGLE",
        "APPLE TEACHER": "APPLE",
        "APPLE LEARNING COACH": "APPLE",
        "APPLE TEACHER SWIFT PLAYGROUNDS": "APPLE",
        "APPLE TEACHER PORTFOLIO": "APPLE",
        "APPLE PROFESSIONAL LEARNING SPECIALIST": "APPLE",
        "APPLE DISTINGUISHED EDUCATOR": "APPLE",
        "MICROSOFT INNOVATIVE EDUCATOR": "MICROSOFT",
        "MICROSOFT INNOVATIVE EDUCATOR EXPERT": "MICROSOFT",
        "MICROSOFT CERTIFIED EDUCATOR": "MICROSOFT"
    };
    
    if (selectedVal === "LAIN-LAIN") {
        manualInput.classList.remove('hidden');
        manualInput.value = "";
        manualInput.required = true;
        manualInput.focus();
        
        dropdownPenyedia.disabled = false;
        dropdownPenyedia.value = "LAIN-LAIN";
    } else if (selectedVal) {
        manualInput.classList.add('hidden');
        manualInput.value = selectedVal; 
        manualInput.required = false;
        
        if (penyediaMap[selectedVal]) {
            dropdownPenyedia.value = penyediaMap[selectedVal];
            dropdownPenyedia.disabled = true;
        }
    }
};

// --- 3. SUBMISSION LOGIC WITH FILE UPLOAD ---

/**
 * Menghantar borang serahan data awam (Kemenjadian)
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

    const kategori = document.getElementById('pubKategori').value;
    const jenisRekod = document.getElementById('pubJenisRekod').value;
    const nama = document.getElementById('pubNama').value.trim().toUpperCase();
    const program = document.getElementById('pubProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('pubPencapaian').value.trim().toUpperCase();
    const fileInput = document.getElementById('pubFile');
    const file = fileInput.files[0];
    const tahun = document.getElementById('pubTahun').value;

    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';
    let jawatan = null;

    if (kategori === 'GURU') {
        jawatan = document.getElementById('pubJawatan').value;
        if (!jawatan) return Swal.fire('Jawatan Diperlukan', 'Sila pilih jawatan guru.', 'warning');
    }

    if (jenisRekod === 'PENSIJILAN') {
        peringkat = 'ANTARABANGSA'; 
        penyedia = document.getElementById('pubPenyedia').value;
    } else {
        peringkat = document.getElementById('pubPeringkat').value;
    }

    if (!nama || !program || !pencapaian || !file || !tahun) {
        return Swal.fire({
            icon: 'warning',
            title: 'Data Tidak Lengkap',
            text: 'Sila pastikan semua ruangan bertanda (termasuk fail) telah diisi.',
            confirmButtonColor: '#fbbf24'
        });
    }

    if (file.size > 5 * 1024 * 1024) {
        return Swal.fire({
            icon: 'warning',
            title: 'Fail Terlalu Besar',
            text: 'Maksimum saiz fail adalah 5MB. Sila mampatkan fail anda.',
            confirmButtonColor: '#fbbf24'
        });
    }

    if(btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>MEMUAT NAIK FAIL BUKTI...`;
        btn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    try {
        const uploadedUrl = await uploadFileToDrive(file);

        if(btn) btn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>MENYIMPAN REKOD PANGKALAN DATA...`;

        const payload = {
            kod_sekolah: kod,
            kategori, 
            nama_peserta: nama, 
            nama_pertandingan: program,
            peringkat, 
            tahun: parseInt(tahun), 
            pencapaian,
            pautan_bukti: uploadedUrl, 
            jenis_rekod: jenisRekod, 
            penyedia, 
            jawatan
        };

        await AchievementService.create(payload);

        Swal.fire({
            icon: 'success',
            title: 'Berjaya Disimpan!',
            text: 'Rekod pencapaian dan bukti telah berjaya direkodkan.',
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
            text: err.message || 'Sistem mengalami gangguan. Sila cuba sebentar lagi.',
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

/**
 * Menghantar borang penilaian Impak BBM
 */
window.hantarImpakBBM = async function() {
    const kod = document.getElementById('finalKodSekolah').value;
    const btn = document.getElementById('btnSubmitImpak');

    if (!kod) {
        return Swal.fire('Ralat Pengesahan', 'Sila pilih dan sahkan sekolah anda di atas terlebih dahulu.', 'warning');
    }

    // Ekstrak data dari checkbox (Q11 - Komponen BBM)
    const q11Checkboxes = document.querySelectorAll('input[name="impakQ11"]:checked');
    let q11Values = Array.from(q11Checkboxes).map(cb => cb.value);
    
    if (q11Values.includes("Lain-lain")) {
        const lainVal = document.getElementById('impakQ11Lain')?.value.trim();
        if (lainVal) {
            q11Values = q11Values.filter(val => val !== "Lain-lain");
            q11Values.push(lainVal);
        }
    }

    if (q11Values.length === 0) {
        return Swal.fire('Data Tidak Lengkap', 'Sila pilih sekurang-kurangnya SATU komponen BBM pada soalan Q11.', 'warning');
    }

    // Ekstrak data radio (Q12 - Perkara Dipelajari)
    const q12Radio = document.querySelector('input[name="impakQ12"]:checked');
    const q12Val = q12Radio ? q12Radio.value : null;

    // Ekstrak data checkbox (Q13 - Cadangan Penambahbaikan)
    const q13Checkboxes = document.querySelectorAll('input[name="impakQ13"]:checked');
    let q13Values = Array.from(q13Checkboxes).map(cb => cb.value);

    // Pengurusan Logik Pengesahan Mata Pelajaran (Q14)
    const q14MainRadio = document.querySelector('input[name="impakQ14Main"]:checked');
    if (!q14MainRadio) {
        return Swal.fire('Data Tidak Lengkap', 'Sila pilih Mata Pelajaran pada soalan Q14.', 'warning');
    }
    
    let subjekAkhir = q14MainRadio.value;
    if (subjekAkhir === 'SUBJEK STEM') {
        const selSubjek = document.getElementById('impakQ14Sub')?.value;
        if (!selSubjek) {
            return Swal.fire('Data Tidak Lengkap', 'Anda telah memilih SUBJEK STEM. Sila nyatakan subjek tersebut secara spesifik pada ruangan yang disediakan.', 'warning');
        }
        subjekAkhir = selSubjek;
    }

    // Bina Payload Data yang dipetakan dengan Skema Database baharu
    const payload = {
        kod_sekolah: kod,
        jantina: document.getElementById('impakJantina').value,
        kumpulan_umur: document.getElementById('impakUmur').value,
        q1_kefahaman: document.querySelector('input[name="impakQ1"]:checked')?.value,
        q2_penguasaan: document.querySelector('input[name="impakQ2"]:checked')?.value,
        q3_ingatan: document.querySelector('input[name="impakQ3"]:checked')?.value,
        q4_minat: document.querySelector('input[name="impakQ4"]:checked')?.value,
        q5_idea: document.querySelector('input[name="impakQ5"]:checked')?.value,
        q6_keyakinan: document.querySelector('input[name="impakQ6"]:checked')?.value,
        q7_persediaan_ujian: document.querySelector('input[name="impakQ7"]:checked')?.value,
        q8_keseluruhan: document.querySelector('input[name="impakQ8"]:checked')?.value,
        q9_penglibatan: document.querySelector('input[name="impakQ9"]:checked')?.value,
        q10_penerangan_guru: document.querySelector('input[name="impakQ10"]:checked')?.value,
        q11_komponen_bbm: q11Values, // Dihantar sebagai Array -> Supabase RPC JSONB
        q12_perkara_dipelajari: q12Val, // Radio Button Tunggal
        q13_cadangan: q13Values.length > 0 ? q13Values : null, // Dihantar sebagai Array
        q14_pengesahan_sesi: subjekAkhir // Menyimpan Mata Pelajaran Sebenar
    };

    if(btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>MEREKOD MAKLUM BALAS...`;
    }

    try {
        const result = await ImpactService.submitImpact(payload);
        
        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Terima Kasih!',
                text: 'Maklum balas anda telah direkodkan. Penghargaan atas penyertaan anda.',
                confirmButtonColor: '#4f46e5' 
            }).then(() => {
                document.getElementById('formImpak').reset();
                window.toggleQ11Lain(false); 
                window.toggleQ14Subjek(); // Reset Subjek STEM Dropdown
                checkImpakStatus(kod);
            });
        }
    } catch (err) {
        console.error("Impak Submit Error:", err);
        Swal.fire({
            icon: 'error',
            title: 'Penolakan Sistem',
            text: err.message || 'Ralat teknikal. Gagal menghantar rekod.',
            confirmButtonColor: '#ef4444'
        });
        
        if (err.message && err.message.includes('sasaran')) {
            checkImpakStatus(kod);
        }
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.innerHTML = `<i class="fas fa-paper-plane me-2"></i>HANTAR MAKLUM BALAS`;
        }
    }
};

window.resetBorang = function(fullReset = true) {
    const form = document.getElementById('formPublic');
    const formImpak = document.getElementById('formImpak');
    
    if(form) {
        document.getElementById('pubProgram').value = "";
        document.getElementById('pubPencapaian').value = "";
        document.getElementById('pubFile').value = ""; 
        
        const pubSijilDropdown = document.getElementById('pubSijilDropdown');
        if (pubSijilDropdown) pubSijilDropdown.value = "";
        
        const pubPenyedia = document.getElementById('pubPenyedia');
        if (pubPenyedia) pubPenyedia.disabled = false;
        
        const pubProgram = document.getElementById('pubProgram');
        if (pubProgram && document.getElementById('pubJenisRekod').value === 'PENSIJILAN') {
            pubProgram.classList.add('hidden');
        }
        
        const cat = document.getElementById('pubKategori').value;
        if (cat !== 'SEKOLAH' && cat !== 'IMPAK') {
            document.getElementById('pubNama').value = "";
        }
    }

    if (formImpak) {
        formImpak.reset();
        window.toggleQ11Lain(false);
        window.toggleQ14Subjek();
    }

    if (fullReset) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// --- 4. PPD MODE LOGIC (Dinamik) ---

/**
 * Konfigurasi portal khusus untuk Pejabat Pendidikan Daerah secara dinamik.
 */
window.setupPPDMode = function(kodPPD) {
    const cardSekolah = document.getElementById('cardIdentitiSekolah');
    const formSekolah = document.getElementById('formSection');
    if(cardSekolah) cardSekolah.classList.add('hidden');
    if(formSekolah) formSekolah.classList.add('hidden');

    const cardPPD = document.getElementById('cardIdentitiPPD');
    const formPPD = document.getElementById('formSectionPPD');
    if(cardPPD) cardPPD.classList.remove('hidden');
    if(formPPD) formPPD.classList.remove('hidden');

    const ppdNameSubtitle = document.getElementById('ppdNameSubtitle');
    if (ppdNameSubtitle) {
        const namaPpd = APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[kodPPD] ? APP_CONFIG.PPD_MAPPING[kodPPD] : 'PEJABAT PENDIDIKAN DAERAH';
        ppdNameSubtitle.innerText = `Unit Sumber Teknologi Pendidikan (${kodPPD}) - ${namaPpd}`;
    }

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
    const fileInput = document.getElementById('ppdFile');
    const file = fileInput.files[0];
    const tahun = document.getElementById('ppdTahun').value;

    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';

    if (jenisRekod === 'PENSIJILAN') {
        peringkat = 'ANTARABANGSA';
        penyedia = document.getElementById('ppdPenyedia').value;
    } else {
        peringkat = document.getElementById('ppdPeringkat').value;
    }

    if (!nama || !program || !pencapaian || !file || !tahun) {
        return Swal.fire({
            icon: 'warning',
            title: 'Tidak Lengkap',
            text: 'Sila isi semua maklumat bagi rekod PPD dan muat naik fail bukti.',
            confirmButtonColor: '#7e22ce'
        });
    }

    if (file.size > 5 * 1024 * 1024) {
        return Swal.fire({
            icon: 'warning',
            title: 'Fail Terlalu Besar',
            text: 'Maksimum saiz fail adalah 5MB.',
            confirmButtonColor: '#7e22ce'
        });
    }

    if(btn) { 
        btn.disabled = true; 
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>MEMUAT NAIK FAIL...`;
        btn.classList.add('opacity-75');
    }

    try {
        const uploadedUrl = await uploadFileToDrive(file);
        
        if(btn) btn.innerHTML = `<i class="fas fa-circle-notch fa-spin me-2"></i>MENYIMPAN REKOD...`;

        const payload = {
            kod_sekolah: currentPpdCode || 'M030', 
            kategori, 
            nama_peserta: nama, 
            nama_pertandingan: program,
            peringkat, 
            tahun: parseInt(tahun), 
            pencapaian,
            pautan_bukti: uploadedUrl, 
            jenis_rekod: jenisRekod, 
            penyedia
        };

        await AchievementService.create(payload);

        Swal.fire({
            icon: 'success',
            title: 'Rekod PPD Disimpan',
            text: 'Data pegawai/unit beserta fail bukti telah berjaya direkodkan.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#7e22ce'
        }).then(() => {
            window.resetBorangPPD();
        });

    } catch (err) {
        console.error("[PPD] Submit Error:", err);
        Swal.fire('Ralat Sistem', err.message || 'Gagal menghantar data PPD.', 'error');
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
        document.getElementById('ppdFile').value = ""; 
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
};