/**
 * SMPID PUBLIC FORM MODULE (js/public.js)
 * Versi: 3.0 (Final Fix: Input Structure & Validation)
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

        const urlParams = new URLSearchParams(window.location.search);
        const kodURL = urlParams.get('kod');

        if (kodURL) {
            validateAndLockSchool(kodURL.toUpperCase());
        } else {
            setupManualSearch();
        }

        window.toggleLoading(false);

    } catch (err) {
        console.error("Public Init Error:", err);
        window.toggleLoading(false);
        Swal.fire("Ralat Sistem", "Gagal memuatkan senarai sekolah.", "error");
    }
}

/** LOGIK 1: PENGESAHAN SEKOLAH **/
function validateAndLockSchool(kod) {
    const school = globalSchoolList.find(s => s.kod_sekolah === kod);
    const input = document.getElementById('inputCariSekolah');
    const statusMsg = document.getElementById('schoolStatusMsg');
    const finalInput = document.getElementById('finalKodSekolah');
    
    if (school) {
        input.value = `${school.kod_sekolah} - ${school.nama_sekolah}`;
        input.classList.add('bg-success', 'bg-opacity-10', 'border-success', 'text-success');
        input.disabled = true; 

        finalInput.value = school.kod_sekolah;
        statusMsg.classList.remove('hidden', 'text-danger');
        statusMsg.classList.add('text-success');
        statusMsg.innerHTML = `<i class="fas fa-check-circle me-1"></i> Sekolah disahkan.`;
        enableForm(); 
    } else {
        input.value = kod;
        statusMsg.classList.remove('hidden', 'text-success');
        statusMsg.classList.add('text-danger');
        statusMsg.innerHTML = `<i class="fas fa-times-circle me-1"></i> Kod tidak sah.`;
        setupManualSearch();
    }
}

function setupManualSearch() {
    const input = document.getElementById('inputCariSekolah');
    const finalInput = document.getElementById('finalKodSekolah');
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
            } else {
                finalInput.value = "";
                disableForm();
            }
        } else {
            finalInput.value = "";
            disableForm();
        }
    });
}

function enableForm() {
    const formSection = document.getElementById('formSection');
    formSection.classList.remove('disabled-form');
    formSection.classList.add('enabled-form');
}

function disableForm() {
    const formSection = document.getElementById('formSection');
    formSection.classList.remove('enabled-form');
    formSection.classList.add('disabled-form');
}

/** LOGIK 2: KAWALAN UI BORANG **/
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
        inpNama.value = ""; // Clear nama
        
        document.getElementById('radPubPertandingan').checked = true;
        togglePubJenis();
    } 
    else if (type === 'MURID') {
        wrapperJenis.classList.add('hidden');
        lblNama.innerText = "NAMA MURID / KUMPULAN";
        inpNama.placeholder = "Taip nama penuh murid...";
        inpNama.readOnly = false;
        inpNama.value = ""; // Clear nama

        document.getElementById('pubJenisRekod').value = 'PERTANDINGAN';
        togglePubJenis(); 
    }
    else if (type === 'SEKOLAH') {
        wrapperJenis.classList.add('hidden');
        lblNama.innerText = "NAMA SEKOLAH";
        
        const schoolName = document.getElementById('inputCariSekolah').value.split(' - ')[1] || "";
        inpNama.value = schoolName; // Auto isi
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
        // MOD PENSIJILAN
        divPenyedia.classList.remove('hidden');
        divPeringkat.classList.add('hidden'); // Sembunyi dropdown peringkat, tapi TAHUN KEKAL

        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        
        lblPencapaian.innerText = "TAHAP / SKOR";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2";
    } else {
        // MOD PERTANDINGAN (Default)
        divPenyedia.classList.add('hidden');
        divPeringkat.classList.remove('hidden');

        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }
}

/** LOGIK 3: HANTAR DATA **/
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
        peringkat = 'ANTARABANGSA'; // Default Profesional
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
    
    // Jangan reset nama jika kategori SEKOLAH (sebab auto-filled)
    const cat = document.getElementById('pubKategori').value;
    if (cat !== 'SEKOLAH') {
        document.getElementById('pubNama').value = "";
    }

    if (fullReset) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}