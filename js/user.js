/**
 * SMPID USER PORTAL MODULE (FULL PRODUCTION VERSION)
 * Menguruskan profil sekolah, analisa digital, helpdesk, 
 * dan modul pencapaian kemenjadian sekolah.
 * * --- UPDATE V1.4 ---
 * Penambahan Data PGB & GPK Pentadbiran ke dalam Profil Sekolah.
 * Integration: DROPDOWN_DATA standardisation for JAWATAN, PERINGKAT, PENYEDIA.
 * Penambahan: Dropdown TAHUN (Dinamik 2020 - Semasa).
 * Migration: Migrasi dari sessionStorage ke localStorage untuk sokongan cross-tab.
 */

import { toggleLoading, checkEmailDomain, autoFormatPhone, keluarSistem, formatSentenceCase } from './core/helpers.js';
import { SchoolService } from './services/school.service.js';
import { AuthService } from './services/auth.service.js';
import { DcsService } from './services/dcs.service.js';
import { SupportService } from './services/support.service.js';
import { AchievementService } from './services/achievement.service.js';
import { APP_CONFIG } from './config/app.config.js';
import { populateDropdown } from './config/dropdowns.js';

// --- GLOBAL STATE ---
let analisaChart = null;
let userPencapaianList = []; 

/**
 * Inisialisasi portal apabila DOM sedia.
 */
document.addEventListener('DOMContentLoaded', () => {
    initUserPortal();
});

function initUserPortal() {
    // UPDATE: Ambil dari localStorage supaya sesi kekal apabila buka tab baharu
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const isAdmin = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';

    // Semakan keselamatan sesi
    if (!kod && !isAdmin) { 
        window.location.replace('index.html'); 
        return; 
    }
    
    // Standardisasi Dropdown Form Utama (Surgical Injection)
    const currentYear = new Date().getFullYear().toString();
    
    populateDropdown('pInputJawatan', 'JAWATAN', 'GURU AKADEMIK BIASA');
    populateDropdown('pInputPeringkat', 'PERINGKAT', 'KEBANGSAAN');
    populateDropdown('pInputPenyedia', 'PENYEDIA', 'LAIN-LAIN');
    populateDropdown('pInputTahun', 'TAHUN', currentYear); // Suntikan Dropdown Tahun

    const displayKod = document.getElementById('displayKodSekolah');
    const btnLogout = document.getElementById('btnLogoutMenu');

    // Mod Paparan Admin (Jika admin klik dari dashboard)
    if (isAdmin) {
        if(displayKod) {
            displayKod.innerHTML = `<i class="fas fa-user-shield me-2"></i>ADMIN VIEW: ${kod}`;
            displayKod.className = "inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-400 text-white text-xs font-bold px-4 py-1.5 rounded-full backdrop-blur-sm";
        }
        
        if(btnLogout) {
            btnLogout.innerHTML = `<i class="fas fa-arrow-left"></i> Kembali ke Dashboard Admin`;
            btnLogout.setAttribute('onclick', "window.location.href='admin.html'");
            btnLogout.className = "w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm";
        }
        
        const btnReset = document.getElementById('btnResetData');
        if (btnReset) btnReset.classList.remove('hidden');

    } else {
        if(displayKod) displayKod.innerHTML = `<i class="fas fa-school"></i> ${kod}`;
    }
    
    // Muat data profil sekolah
    loadProfil(kod);
}

// --- 1. NAVIGATION LOGIC ---

/**
 * Menukar paparan seksyen dalam portal (Single Page App style).
 */
window.showSection = function(section, event) {
    // Jika dipanggil dari event (klik link), prevent default jump
    if (event && event.preventDefault) {
        event.preventDefault();
        // Update hash tanpa jump
        history.pushState(null, null, '#' + section);
    }

    const sections = ['menu', 'profil', 'aduan', 'analisa', 'pencapaian'];
    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if(el) el.classList.add('hidden');
    });

    const targetEl = document.getElementById(`section-${section}`);
    if(targetEl) {
        targetEl.classList.remove('hidden');
        targetEl.classList.add('animate-fade-up');
    }

    // Trigger pemuatan data khusus mengikut seksyen
    const welcomeText = document.getElementById('welcomeText');
    
    if (section === 'menu') if(welcomeText) welcomeText.innerText = "MENU UTAMA";
    if (section === 'profil') if(welcomeText) welcomeText.innerText = "PROFIL SEKOLAH";

    if (section === 'aduan') {
        window.loadTiketUser();
        if(welcomeText) welcomeText.innerText = "HELPDESK";
    }
    if (section === 'analisa') {
        loadAnalisaSekolah();
        if(welcomeText) welcomeText.innerText = "ANALISA DIGITAL";
    }
    if (section === 'pencapaian') {
        window.loadPencapaianSekolah();
        if(welcomeText) welcomeText.innerText = "REKOD PENCAPAIAN";
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- 2. PROFILE MANAGEMENT ---

async function loadProfil(kod) {
    if (!kod) return;
    try {
        const data = await SchoolService.getByCode(kod);
        if(!data) return;

        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        // Peta data DB ke input HTML termasuk PGB dan GPK
        const fields = {
            'pgbNama': data.nama_pgb, 'pgbTel': data.no_telefon_pgb, 'pgbEmel': data.emel_delima_pgb,
            'gpkNama': data.nama_gpk, 'gpkTel': data.no_telefon_gpk, 'gpkEmel': data.emel_delima_gpk,
            'gpictNama': data.nama_gpict, 'gpictTel': data.no_telefon_gpict, 'gpictEmel': data.emel_delima_gpict,
            'adminNama': data.nama_admin_delima, 'adminTel': data.no_telefon_admin_delima, 'adminEmel': data.emel_delima_admin_delima
        };
        
        for (let id in fields) { 
            const el = document.getElementById(id);
            if(el) el.value = fields[id] || ""; 
        }
    } catch (err) { 
        console.error("[Profile] Gagal muat:", err); 
    }
}

window.simpanProfil = async function() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const emelPgb = document.getElementById('pgbEmel').value;
    const emelGpk = document.getElementById('gpkEmel').value;
    const emelG = document.getElementById('gpictEmel').value;
    const btnSubmit = document.querySelector('#dataForm button[type="submit"]');
    
    // Validasi domain emel hanya jika ia telah diisi
    if (emelPgb && !checkEmailDomain(emelPgb)) {
        return Swal.fire({
            icon: 'warning',
            title: 'Format Emel PGB Salah',
            text: 'Sila gunakan emel rasmi domain @moe-dl.edu.my',
            confirmButtonColor: '#f59e0b'
        });
    }

    if (emelGpk && !checkEmailDomain(emelGpk)) {
        return Swal.fire({
            icon: 'warning',
            title: 'Format Emel GPK Salah',
            text: 'Sila gunakan emel rasmi domain @moe-dl.edu.my',
            confirmButtonColor: '#f59e0b'
        });
    }

    if (!checkEmailDomain(emelG)) {
        return Swal.fire({
            icon: 'warning',
            title: 'Format Emel Salah',
            text: 'Sila gunakan emel rasmi domain @moe-dl.edu.my',
            confirmButtonColor: '#f59e0b'
        });
    }

    if(btnSubmit) { btnSubmit.disabled = true; btnSubmit.classList.add('opacity-75'); }
    toggleLoading(true);

    const payload = {
        nama_pgb: document.getElementById('pgbNama').value.toUpperCase(),
        no_telefon_pgb: document.getElementById('pgbTel').value,
        emel_delima_pgb: emelPgb,
        nama_gpk: document.getElementById('gpkNama').value.toUpperCase(),
        no_telefon_gpk: document.getElementById('gpkTel').value,
        emel_delima_gpk: emelGpk,
        nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
        no_telefon_gpict: document.getElementById('gpictTel').value,
        emel_delima_gpict: emelG,
        nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
        no_telefon_admin_delima: document.getElementById('adminTel').value,
        emel_delima_admin_delima: document.getElementById('adminEmel').value
    };

    try {
        await SchoolService.updateProfile(kod, payload);
        toggleLoading(false);
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.classList.remove('opacity-75'); }
        
        Swal.fire({
            icon: 'success', 
            title: 'Tersimpan', 
            text: 'Maklumat sekolah berjaya dikemaskini.',
            confirmButtonColor: '#22c55e'
        }).then(() => window.showSection('menu'));
    } catch (err) {
        toggleLoading(false); 
        if(btnSubmit) { btnSubmit.disabled = false; btnSubmit.classList.remove('opacity-75'); }
        Swal.fire('Ralat', 'Gagal menyimpan profil. Sila cuba lagi.', 'error');
    }
};

window.salinData = function() {
    if (document.getElementById('checkSama').checked) {
        ['Nama','Tel','Emel'].forEach(suffix => {
            const gpictVal = document.getElementById('gpict'+suffix).value;
            document.getElementById('admin'+suffix).value = gpictVal;
        });
    }
};

// --- 3. DIGITAL ANALYSIS (DCS/DELIMa) ---

async function loadAnalisaSekolah() {
    // UPDATE: Ambil dari localStorage
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tableBody = document.getElementById('tableAnalisaBody');

    try {
        const data = await DcsService.getBySchool(kod);

        if (!data) {
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-red-400 font-bold italic">Data analisa sekolah belum tersedia.</td></tr>`;
            return;
        }

        // Tentukan data terkini (2025 vs 2024)
        let dcsLatest = (data.dcs_2025 !== null) ? data.dcs_2025 : data.dcs_2024;
        let aktifLatest = (data.peratus_aktif_2025 !== null) ? data.peratus_aktif_2025 : data.peratus_aktif_2024;
        
        document.getElementById('valDcs').innerText = dcsLatest ? dcsLatest.toFixed(2) : "0.00";
        document.getElementById('valAktif').innerText = aktifLatest ? aktifLatest : "0";

        renderAnalisaTable(data);
        renderDcsChart(data);
    } catch (err) { 
        console.error("[Analisa] Ralat:", err); 
    }
}

function renderAnalisaTable(data) {
    const tableBody = document.getElementById('tableAnalisaBody');
    if(!tableBody) return;
    const years = [2023, 2024, 2025];
    let rows = '';
    years.forEach(year => {
        const dcs = data[`dcs_${year}`];
        const aktif = data[`peratus_aktif_${year}`];
        if (dcs !== null || aktif !== null) {
            rows += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-500">${year}</td>
                <td class="px-6 py-4 font-black text-blue-600">${dcs !== null ? dcs.toFixed(2) : '-'}</td>
                <td class="px-6 py-4 font-black text-green-600">${aktif !== null ? aktif + '%' : '-'}</td>
            </tr>`;
        }
    });
    tableBody.innerHTML = rows || `<tr><td colspan="3" class="p-6 text-center text-slate-400 italic">Tiada sejarah data ditemui.</td></tr>`;
}

function renderDcsChart(data) {
    const ctx = document.getElementById('chartAnalisa');
    if (!ctx) return;
    if (analisaChart) analisaChart.destroy();
    
    const labels = ['2023', '2024', '2025'];
    const dataDcs = [data.dcs_2023, data.dcs_2024, data.dcs_2025];
    const dataAktif = [data.peratus_aktif_2023, data.peratus_aktif_2024, data.peratus_aktif_2025];

    analisaChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { 
                    label: 'Skor DCS (0-5)', 
                    data: dataDcs, 
                    borderColor: '#3b82f6', 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                    yAxisID: 'y', 
                    tension: 0.4, 
                    fill: true,
                    pointRadius: 6,
                    pointBackgroundColor: '#3b82f6'
                },
                { 
                    label: '% Aktif DELIMa', 
                    data: dataAktif, 
                    borderColor: '#10b981', 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                    yAxisID: 'y1', 
                    tension: 0.4, 
                    borderDash: [5, 5],
                    pointRadius: 6,
                    pointBackgroundColor: '#10b981'
                }
            ]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { weight: 'bold' } } } },
            scales: { 
                y: { min: 0, max: 5, position: 'left', title: { display: true, text: 'Skor DCS' } }, 
                y1: { min: 0, max: 100, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '% Aktif' } } 
            }
        }
    });
}

// --- 4. ACHIEVEMENT (KEMENJADIAN) MODULE ---

/**
 * Menukar UI borang mengikut kategori (Murid, Guru, Sekolah).
 */
window.setPencapaianType = function(type) {
    document.getElementById('pencapaianKategori').value = type;
    
    // Kemaskini Visual Tab
    const tabs = ['murid', 'guru', 'sekolah'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-p-${t}`);
        if(!btn) return;
        if(t.toUpperCase() === type) {
            btn.className = "flex-1 py-2 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-md transition transform scale-105";
        } else {
            btn.className = "flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition";
        }
    });

    const wrapperJenis = document.getElementById('wrapperJenisRekod');
    const divJawatan = document.getElementById('divInputJawatan');
    const inpName = document.getElementById('pInputNama');
    const lblName = document.getElementById('labelNamaPeserta');

    if (type === 'GURU') {
        wrapperJenis.classList.remove('hidden');
        divJawatan.classList.remove('hidden');
        inpName.value = "";
        inpName.readOnly = false;
        lblName.innerText = "NAMA GURU";
    } else {
        wrapperJenis.classList.add('hidden');
        divJawatan.classList.add('hidden');
        document.getElementById('radioPertandingan').checked = true;
        
        if (type === 'SEKOLAH') {
            inpName.value = document.getElementById('dispNamaSekolah').innerText;
            inpName.readOnly = true;
            lblName.innerText = "NAMA SEKOLAH";
        } else {
            inpName.value = "";
            inpName.readOnly = false;
            lblName.innerText = "NAMA MURID / KUMPULAN";
        }
    }
    window.toggleJenisPencapaian();
};

/**
 * Menukar medan input berdasarkan jenis rekod (Pertandingan vs Pensijilan).
 */
window.toggleJenisPencapaian = function() {
    const isPensijilan = document.getElementById('radioPensijilan').checked;
    document.getElementById('pInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';
    
    const divPenyedia = document.getElementById('divInputPenyedia');
    const colPeringkat = document.getElementById('divColPeringkat');
    
    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden');
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden');
    }
};

/**
 * Memuatkan senarai rekod pencapaian sekolah dari database.
 */
window.loadPencapaianSekolah = async function() {
    // UPDATE: Ambil dari localStorage
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tbody = document.getElementById('tbodyRekodPencapaian');
    if(!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 font-medium animate-pulse">Memuatkan rekod...</td></tr>`;

    try {
        const data = await AchievementService.getBySchool(kod);
        userPencapaianList = data; // Cache data

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl">Tiada rekod pencapaian ditemui.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(item => {
            let badgeClass = 'bg-slate-100 text-slate-600';
            if (item.kategori === 'MURID') badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
            else if (item.kategori === 'GURU') badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
            else if (item.kategori === 'SEKOLAH') badgeClass = 'bg-green-100 text-green-700 border-green-200';

            const programLabel = item.jenis_rekod === 'PENSIJILAN' 
                ? `<span class="bg-amber-50 text-amber-600 text-[9px] px-1 rounded border border-amber-200 mr-1 font-black">SIJIL</span> ${item.nama_pertandingan}`
                : item.nama_pertandingan;

            return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group">
                <td class="px-4 py-4 text-center w-24">
                    <span class="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeClass}">${item.kategori}</span>
                    <div class="text-[10px] text-slate-400 mt-1.5 font-mono font-bold">${item.tahun}</div>
                </td>
                <td class="px-4 py-4">
                    <div class="font-bold text-slate-800 text-sm leading-snug mb-0.5 uppercase whitespace-normal break-words">${item.nama_peserta}</div>
                    <div class="text-xs text-teal-600 font-bold mb-1.5 leading-tight whitespace-normal break-words">${programLabel}</div>
                    <div class="flex flex-wrap gap-2">
                        <span class="bg-white text-slate-500 text-[10px] px-2 py-0.5 rounded border border-slate-200 uppercase font-medium">${item.peringkat}</span>
                        <span class="bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded border border-green-100 font-black uppercase tracking-wider">${item.pencapaian}</span>
                    </div>
                </td>
                <td class="px-4 py-4 text-center w-28">
                    <div class="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openEditPencapaianUser('${item.id}')" class="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition shadow-sm" title="Edit"><i class="fas fa-edit"></i></button>
                        <button onclick="padamPencapaian('${item.id}')" class="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition shadow-sm" title="Padam"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    } catch (err) { 
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-red-500 font-bold">Ralat pangkalan data.</td></tr>`; 
    }
};

/**
 * Menyimpan rekod pencapaian baharu.
 */
window.simpanPencapaian = async function() {
    // UPDATE: Ambil dari localStorage
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD); 
    const btn = document.querySelector('#formPencapaian button[type="submit"]');
    const kategori = document.getElementById('pencapaianKategori').value;
    const jenisRekod = document.getElementById('pInputJenisRekod').value;
    
    let jawatan = null;
    if (kategori === 'GURU') {
        jawatan = document.getElementById('pInputJawatan').value;
        if (!jawatan) return Swal.fire('Ralat Jawatan', 'Sila pilih jawatan guru.', 'warning');
    }

    let peringkat = document.getElementById('pInputPeringkat').value;
    let penyedia = document.getElementById('pInputPenyedia').value;
    if (jenisRekod === 'PENSIJILAN') peringkat = 'ANTARABANGSA';

    const nama = document.getElementById('pInputNama').value.trim().toUpperCase();
    const program = document.getElementById('pInputProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('pInputPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('pInputLink').value.trim();
    const tahun = parseInt(document.getElementById('pInputTahun').value);

    if(!nama || !program || !pencapaian || !link || !tahun) {
        return Swal.fire('Maklumat Tidak Lengkap', 'Sila isi semua ruangan bertanda.', 'warning');
    }

    if(btn) { btn.disabled = true; btn.classList.add('opacity-75'); }
    toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: kod,
            kategori, 
            nama_peserta: nama, 
            nama_pertandingan: program,
            peringkat,
            tahun,
            pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia,
            jawatan
        };

        await AchievementService.create(payload);
        toggleLoading(false);
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        
        Swal.fire({
            icon: 'success',
            title: 'Berjaya Direkod',
            text: 'Maklumat telah disimpan ke pangkalan data.',
            confirmButtonColor: '#22c55e'
        }).then(() => {
            document.getElementById('formPencapaian').reset();
            // Reset dropdown tahun ke semasa
            const currentYear = new Date().getFullYear().toString();
            document.getElementById('pInputTahun').value = currentYear;
            window.loadPencapaianSekolah();
        });
    } catch (err) {
        toggleLoading(false); 
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        Swal.fire('Ralat Sistem', 'Gagal menyimpan rekod. Sila cuba lagi.', 'error');
    }
};

// --- 5. EDIT MODAL OPERATIONS ---

window.openEditPencapaianUser = function(id) {
    const item = userPencapaianList.find(i => String(i.id) === String(id));
    if (!item) return;

    // Standardisasi Dropdown Modal Edit (Surgical Injection)
    populateDropdown('editUserJawatan', 'JAWATAN', item.jawatan);
    populateDropdown('editUserPeringkat', 'PERINGKAT', item.peringkat);
    populateDropdown('editUserPenyedia', 'PENYEDIA', item.penyedia);
    populateDropdown('editUserTahun', 'TAHUN', item.tahun); // Suntikan Dropdown Tahun Edit

    document.getElementById('editUserId').value = item.id;
    if (item.jenis_rekod === 'PENSIJILAN') document.getElementById('editRadioPensijilanUser').checked = true;
    else document.getElementById('editRadioPertandinganUser').checked = true;

    document.getElementById('editUserNama').value = item.nama_peserta;
    document.getElementById('editUserProgram').value = item.nama_pertandingan;
    document.getElementById('editUserPencapaian').value = item.pencapaian;
    document.getElementById('editUserLink').value = item.pautan_bukti;
    // Nilai tahun di-set oleh populateDropdown di atas

    window.toggleEditUserJenis(); 

    const divJawatan = document.getElementById('editUserDivJawatan');
    if (item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
    } else {
        divJawatan.classList.add('hidden');
    }

    document.getElementById('modalEditPencapaianUser').classList.remove('hidden');
};

window.toggleEditUserJenis = function() {
    const jenis = document.querySelector('input[name="editRadioJenisUser"]:checked').value;
    const divPenyedia = document.getElementById('editUserDivPenyedia');
    const colPeringkat = document.getElementById('editUserColPeringkat');
    
    const lblProg = document.getElementById('lblEditUserProgram');
    const lblPenc = document.getElementById('lblEditUserPencapaian');

    if (jenis === 'PENSIJILAN') {
        divPenyedia.classList.remove('hidden');
        colPeringkat.classList.add('hidden'); 
        if(lblProg) lblProg.innerText = "NAMA SIJIL / PROGRAM";
        if(lblPenc) lblPenc.innerText = "TAHAP / SKOR";
    } else {
        divPenyedia.classList.add('hidden');
        colPeringkat.classList.remove('hidden'); 
        if(lblProg) lblProg.innerText = "NAMA PERTANDINGAN";
        if(lblPenc) lblPenc.innerText = "PENCAPAIAN";
    }
};

window.updatePencapaianUser = async function() {
    const id = document.getElementById('editUserId').value;
    const btn = document.querySelector('#formEditPencapaianUser button[type="submit"]');
    const jenis = document.querySelector('input[name="editRadioJenisUser"]:checked').value;

    if(btn) { btn.disabled = true; btn.classList.add('opacity-75'); }
    toggleLoading(true);

    try {
        const payload = {
            nama_peserta: document.getElementById('editUserNama').value.toUpperCase(),
            nama_pertandingan: document.getElementById('editUserProgram').value.toUpperCase(),
            pencapaian: document.getElementById('editUserPencapaian').value.toUpperCase(),
            pautan_bukti: document.getElementById('editUserLink').value,
            tahun: parseInt(document.getElementById('editUserTahun').value),
            jenis_rekod: jenis
        };

        if (!document.getElementById('editUserDivJawatan').classList.contains('hidden')) {
            payload.jawatan = document.getElementById('editUserJawatan').value;
        }

        if (jenis === 'PENSIJILAN') {
            payload.penyedia = document.getElementById('editUserPenyedia').value;
            payload.peringkat = 'ANTARABANGSA'; 
        } else {
            payload.peringkat = document.getElementById('editUserPeringkat').value;
        }

        await AchievementService.update(id, payload);
        toggleLoading(false);
        if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        
        document.getElementById('modalEditPencapaianUser').classList.add('hidden');
        Swal.fire({
            icon: 'success',
            title: 'Kemaskini Berjaya',
            timer: 1500,
            showConfirmButton: false
        }).then(() => window.loadPencapaianSekolah());
    } catch (e) {
        toggleLoading(false); if(btn) { btn.disabled = false; btn.classList.remove('opacity-75'); }
        Swal.fire('Gagal', 'Sistem tidak dapat mengemaskini rekod.', 'error');
    }
};

window.padamPencapaian = async function(id) {
    Swal.fire({ 
        title: 'Padam Rekod?', 
        text: "Tindakan ini tidak boleh dibatalkan semula.",
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire('Berjaya', 'Rekod telah dipadam.', 'success').then(() => window.loadPencapaianSekolah());
            } catch (e) {
                toggleLoading(false); 
                Swal.fire('Ralat', 'Gagal memadam rekod.', 'error');
            }
        }
    });
};

// --- 6. HELPDESK & TICKETING ---

window.hantarTiket = async function() {
    // UPDATE: Ambil dari localStorage
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.toUpperCase();
    const mesej = document.getElementById('tiketMesej').value;

    if (!peranan) return Swal.fire('Peranan Wajib', 'Sila pilih peranan anda.', 'warning');

    toggleLoading(true);
    try {
        await SupportService.createTicket({ 
            kod_sekolah: kod, 
            peranan_pengirim: peranan, 
            tajuk: tajuk, 
            butiran_masalah: mesej 
        });
        toggleLoading(false);
        Swal.fire('Tiket Dihantar', 'Kami akan menyemak aduan anda secepat mungkin.', 'success').then(() => {
            document.getElementById('formTiket').reset();
            if(window.switchAduanTab) window.switchAduanTab('semak');
            window.loadTiketUser();
        });
    } catch (e) { 
        toggleLoading(false); 
        Swal.fire('Ralat', 'Gagal menghantar tiket aduan.', 'error'); 
    }
};

window.loadTiketUser = async function() {
    // UPDATE: Ambil dari localStorage
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const container = document.getElementById('senaraiTiketContainer');
    if(!container) return;

    try {
        const data = await SupportService.getBySchool(kod);
        container.innerHTML = "";
        
        if(data.length === 0) { 
            container.innerHTML = `<div class="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-medium italic">Tiada tiket aduan aktif ditemui.</div>`; 
            return; 
        }
        
        data.forEach(t => {
            const statusBadge = t.status === 'SELESAI' 
                ? `<span class="bg-green-100 text-green-700 text-[10px] px-2.5 py-1 rounded-full font-black border border-green-200">SELESAI</span>` 
                : `<span class="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-full font-black animate-pulse border border-amber-200">DALAM PROSES</span>`;
            
            const balasan = t.balasan_admin 
                ? `<div class="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100"><strong class="text-emerald-700 uppercase flex items-center gap-2 mb-1"><i class="fas fa-check-circle"></i> Respon Pentadbir:</strong> ${t.balasan_admin}</div>` 
                : '';
            
            container.innerHTML += `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div class="flex justify-between items-start mb-3">
                    <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest">${new Date(t.created_at).toLocaleDateString('ms-MY')}</div>
                    ${statusBadge}
                </div>
                <h4 class="font-bold text-slate-800 text-sm mb-2 uppercase leading-tight">${t.tajuk}</h4>
                <p class="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl">${t.butiran_masalah}</p>
                ${balasan}
            </div>`;
        });
    } catch (e) { 
        container.innerHTML = `<div class="text-red-500 font-bold text-center py-6">Ralat memuatkan sejarah tiket.</div>`; 
    }
};

// --- 7. SECURITY & MAINTENANCE ---

window.ubahKataLaluan = async function() {
    // UPDATE: Ambil dari localStorage
    const userId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);
    if (!userId) {
        Swal.fire('Sesi Luput', 'Sila log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html: `
            <div class="space-y-3">
                <input id="swal-old-pass" type="password" class="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Kata Laluan Lama">
                <input id="swal-new-pass" type="password" class="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Kata Laluan Baharu (Min 6)">
            </div>
        `,
        focusConfirm: false, 
        showCancelButton: true, 
        confirmButtonText: 'Simpan Perubahan', 
        confirmButtonColor: '#16a34a',
        preConfirm: () => {
            const oldP = document.getElementById('swal-old-pass').value;
            const newP = document.getElementById('swal-new-pass').value;
            if(!oldP || !newP) {
                Swal.showValidationMessage('Sila isi kedua-dua ruangan.');
                return false;
            }
            if(newP.length < 6) {
                Swal.showValidationMessage('Kata laluan baharu minima 6 aksara.');
                return false;
            }
            return [oldP, newP];
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;
        toggleLoading(true);
        try {
            await AuthService.changePassword(userId, oldPass, newPass);
            toggleLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Berjaya Ditukar',
                text: 'Sila log masuk semula dengan kata laluan baharu.',
                confirmButtonColor: '#22c55e'
            }).then(() => keluarSistem());
        } catch (err) { 
            toggleLoading(false); 
            Swal.fire('Gagal', err.message, 'error'); 
        }
    }
};

window.resetDataSekolah = async function() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const { value: password } = await Swal.fire({
        title: 'Akses Pentadbir PPD',
        text: 'Masukkan kata laluan keselamatan untuk reset data:',
        input: 'password',
        showCancelButton: true,
        confirmButtonText: 'SAHKAN RESET',
        confirmButtonColor: '#ef4444'
    });

    if (password === 'pkgag') { 
         Swal.fire({
            title: 'Sahkan Padam Semua Data?',
            text: "Data profil PGB, GPK, GPICT dan Admin DELIMa akan dipadamkan (NULL). Kod sekolah akan kekal wujud.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Padam Semua!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                toggleLoading(true);
                try {
                    await SchoolService.resetData(kod);
                    toggleLoading(false);
                    Swal.fire('Selesai', 'Data sekolah telah dikosongkan.', 'success').then(() => loadProfil(kod));
                } catch (err) {
                    toggleLoading(false); 
                    Swal.fire('Ralat', 'Gagal memulakan proses reset data.', 'error');
                }
            }
        });
    } else if (password) {
        Swal.fire('Akses Ditolak', 'Kata laluan keselamatan tidak sah.', 'error');
    }
};