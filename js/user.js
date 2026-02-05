/**
 * SMPID USER PORTAL MODULE (js/user.js)
 * Versi: 6.0 (Added Edit/Update Functionality)
 * Fungsi: Logik Dashboard Sekolah, Profil, Aduan, Analisa & Pencapaian
 */

// NOTA: Variable global (DENO_API_URL, SUPABASE_URL) diambil dari window (utils.js)

// Global Variables
let analisaChart = null;
let userPencapaianList = []; // Simpan data tempatan untuk rujukan Edit

// ==========================================
// 1. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initUserPortal();
});

function initUserPortal() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    // Double check security
    if (!kod && !isAdmin) { 
        window.location.replace('index.html'); 
        return; 
    }
    
    // Setup UI Header
    const displayKod = document.getElementById('displayKodSekolah');
    const btnLogout = document.getElementById('btnLogoutMenu');

    if (isAdmin) {
        // Paparan Khas jika Admin PPD
        displayKod.innerHTML = `<i class="fas fa-user-shield me-2"></i>ADMIN VIEW: ${kod}`;
        displayKod.classList.replace('text-dark', 'text-primary');
        displayKod.classList.add('border', 'border-primary');
        
        if(btnLogout) {
            btnLogout.innerHTML = `<i class="fas fa-arrow-left me-2"></i>Kembali ke Dashboard Admin`;
            btnLogout.setAttribute('onclick', "window.location.href='admin.html'");
            btnLogout.classList.replace('text-danger', 'text-primary');
        }
        
        // Tunjuk butang reset (hanya untuk admin)
        const btnReset = document.getElementById('btnResetData');
        if (btnReset) btnReset.classList.remove('hidden');

    } else {
        // Paparan Biasa (Sekolah)
        displayKod.innerHTML = `<i class="fas fa-school me-2"></i>${kod}`;
    }
    
    // Mula muatkan data profil
    loadProfil(kod);
}

// ==========================================
// 2. NAVIGASI (SPA FEEL)
// ==========================================

function showSection(section) {
    const menuSection = document.getElementById('section-menu');
    const profilSection = document.getElementById('section-profil');
    const aduanSection = document.getElementById('section-aduan');
    const analisaSection = document.getElementById('section-analisa');
    const pencapaianSection = document.getElementById('section-pencapaian');
    const welcomeText = document.getElementById('welcomeText');

    // Reset semua ke hidden dulu
    menuSection.classList.add('hidden');
    profilSection.classList.add('hidden');
    aduanSection.classList.add('hidden');
    if(analisaSection) analisaSection.classList.add('hidden');
    if(pencapaianSection) pencapaianSection.classList.add('hidden');

    if (section === 'menu') {
        menuSection.classList.remove('hidden');
        welcomeText.innerText = "Menu Utama";
    } else if (section === 'profil') {
        profilSection.classList.remove('hidden');
        welcomeText.innerText = "Kemaskini Maklumat";
    } else if (section === 'aduan') {
        aduanSection.classList.remove('hidden');
        welcomeText.innerText = "Helpdesk & Aduan";
        loadTiketUser(); 
    } else if (section === 'analisa') {
        analisaSection.classList.remove('hidden');
        welcomeText.innerText = "Analisa Digital";
        loadAnalisaSekolah();
    } else if (section === 'pencapaian') {
        pencapaianSection.classList.remove('hidden');
        welcomeText.innerText = "Rekod Pencapaian";
        loadPencapaianSekolah(); // Panggil fungsi load senarai
    }
}

// ==========================================
// 3. PENGURUSAN PROFIL
// ==========================================

async function loadProfil(kod) {
    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .select('*')
            .eq('kod_sekolah', kod)
            .single();
            
        if (error) throw error;
        
        // Isi Header
        document.getElementById('dispNamaSekolah').innerText = data.nama_sekolah;
        document.getElementById('dispKodDaerah').innerText = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || '-'}`;
        document.getElementById('hiddenKodSekolah').value = data.kod_sekolah;
        
        // Isi Borang
        const fields = {
            'gpictNama': data.nama_gpict, 
            'gpictTel': data.no_telefon_gpict, 
            'gpictEmel': data.emel_delima_gpict,
            'adminNama': data.nama_admin_delima, 
            'adminTel': data.no_telefon_admin_delima, 
            'adminEmel': data.emel_delima_admin_delima
        };
        
        for (let id in fields) { 
            if(document.getElementById(id)) {
                document.getElementById(id).value = fields[id] || ""; 
            }
        }
    } catch (err) { 
        console.error("Gagal muat profil:", err); 
        Swal.fire('Ralat Sambungan', 'Gagal memuatkan data sekolah.', 'error');
    }
}

function salinData() {
    if (document.getElementById('checkSama').checked) {
        ['Nama','Tel','Emel'].forEach(suffix => {
            document.getElementById('admin'+suffix).value = document.getElementById('gpict'+suffix).value;
        });
    }
}

async function simpanProfil() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const namaSekolah = document.getElementById('dispNamaSekolah').innerText;
    const emelG = document.getElementById('gpictEmel').value;
    const btnSubmit = document.querySelector('#dataForm button[type="submit"]');
    
    const isAdmin = sessionStorage.getItem('smpid_auth') === 'true';

    // Validasi Asas
    if (!window.checkEmailDomain(emelG)) { 
        Swal.fire('Format Salah', 'Sila gunakan emel domain moe-dl.edu.my', 'warning'); 
        return; 
    }

    if(btnSubmit) btnSubmit.disabled = true;
    window.toggleLoading(true);

    const payload = {
        nama_gpict: document.getElementById('gpictNama').value.toUpperCase(),
        no_telefon_gpict: document.getElementById('gpictTel').value,
        emel_delima_gpict: emelG,
        nama_admin_delima: document.getElementById('adminNama').value.toUpperCase(),
        no_telefon_admin_delima: document.getElementById('adminTel').value,
        emel_delima_admin_delima: document.getElementById('adminEmel').value
    };

    try {
        const { error } = await window.supabaseClient
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kod);
            
        if (error) throw error;

        if (window.DENO_API_URL) {
            fetch(`${window.DENO_API_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: kod, 
                    nama: namaSekolah,
                    updated_by: isAdmin ? 'PENTADBIR PPD' : 'PIHAK SEKOLAH' 
                })
            }).catch(err => console.warn("Bot offline:", err));
        }

        window.toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        
        Swal.fire('Berjaya', 'Maklumat sekolah telah dikemaskini.', 'success')
            .then(() => showSection('menu'));
            
    } catch (err) {
        window.toggleLoading(false); 
        if(btnSubmit) btnSubmit.disabled = false;
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyimpan data ke database.', 'error');
    }
}

// ==========================================
// 4. ANALISA DIGITAL (DCS & DELIMa)
// ==========================================

async function loadAnalisaSekolah() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const tableBody = document.getElementById('tableAnalisaBody');

    document.getElementById('valDcs').innerText = '-';
    document.getElementById('valAktif').innerText = '-';
    if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-muted py-3">Memuatkan data...</td></tr>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_dcs_analisa')
            .select('*')
            .eq('kod_sekolah', kod)
            .single();

        if (error) {
            if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-danger py-3">Data analisa belum tersedia.</td></tr>`;
            return;
        }

        let dcsLatest = (data.dcs_2025 !== null) ? data.dcs_2025 : data.dcs_2024;
        let aktifLatest = (data.peratus_aktif_2025 !== null) ? data.peratus_aktif_2025 : data.peratus_aktif_2024;
        let dcsPrev = data.dcs_2023; 
        if (data.dcs_2025 !== null) dcsPrev = data.dcs_2024;

        document.getElementById('valDcs').innerText = dcsLatest ? dcsLatest.toFixed(2) : "0.00";
        document.getElementById('valAktif').innerText = aktifLatest ? aktifLatest : "0";

        const trendEl = document.getElementById('trendDcs');
        if (dcsLatest > dcsPrev) {
            trendEl.innerHTML = `<i class="fas fa-arrow-up me-1"></i>Meningkat`;
            trendEl.className = "badge bg-white text-success mt-2 rounded-pill px-2 border border-success";
        } else if (dcsLatest < dcsPrev) {
            trendEl.innerHTML = `<i class="fas fa-arrow-down me-1"></i>Menurun`;
            trendEl.className = "badge bg-white text-danger mt-2 rounded-pill px-2 border border-danger";
        } else {
            trendEl.innerHTML = `<i class="fas fa-minus me-1"></i>Tiada Perubahan`;
            trendEl.className = "badge bg-white text-secondary mt-2 rounded-pill px-2 border";
        }

        let rows = '';
        const createRow = (year, dcs, aktif) => {
            if (dcs === null && aktif === null) return ''; 
            return `<tr>
                <td class="fw-bold text-secondary">${year}</td>
                <td><span class="badge ${dcs >= 3.0 ? 'bg-success' : 'bg-warning'} text-white">${dcs !== null ? dcs.toFixed(2) : '-'}</span></td>
                <td>${aktif !== null ? aktif + '%' : '-'}</td>
            </tr>`;
        };

        rows += createRow(2023, data.dcs_2023, data.peratus_aktif_2023);
        rows += createRow(2024, data.dcs_2024, data.peratus_aktif_2024);
        rows += createRow(2025, data.dcs_2025, data.peratus_aktif_2025);

        if(tableBody) tableBody.innerHTML = rows;

        renderDcsChart(data);

    } catch (err) {
        console.error("Analisa Error:", err);
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="3" class="text-danger py-3">Ralat memuatkan data.</td></tr>`;
    }
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
                { label: 'Skor DCS (0-5)', data: dataDcs, borderColor: '#0d6efd', backgroundColor: 'rgba(13, 110, 253, 0.1)', yAxisID: 'y', tension: 0.3, fill: true },
                { label: '% Aktif DELIMa', data: dataAktif, borderColor: '#198754', backgroundColor: 'rgba(25, 135, 84, 0.1)', yAxisID: 'y1', tension: 0.3, borderDash: [5, 5] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { min: 0, max: 5, position: 'left' },
                y1: { min: 0, max: 100, position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

// ==========================================
// 5. HELPDESK / ADUAN
// ==========================================

async function hantarTiket() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.toUpperCase();
    const mesej = window.formatSentenceCase(document.getElementById('tiketMesej').value);
    const btnSubmit = document.querySelector('#formTiket button[type="submit"]');

    if (!peranan) { 
        Swal.fire('Pilih Jawatan', 'Sila nyatakan anda sebagai GPICT atau Admin.', 'warning'); 
        return; 
    }

    if(btnSubmit) btnSubmit.disabled = true;
    window.toggleLoading(true);

    try {
        const { error } = await window.supabaseClient
            .from('smpid_aduan')
            .insert([{ kod_sekolah: kod, peranan_pengirim: peranan, tajuk: tajuk, butiran_masalah: mesej }]);
        
        if (error) throw error;

        if (window.DENO_API_URL) {
            fetch(`${window.DENO_API_URL}/notify-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod: kod, peranan: peranan, tajuk: tajuk, mesej: mesej })
            }).catch(e => console.warn("Bot offline:", e));
        }

        window.toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        
        Swal.fire('Tiket Dihantar', 'Pihak PPD telah dimaklumkan.', 'success').then(() => {
            document.getElementById('formTiket').reset();
            const tabBtn = document.querySelector('#tab-semak-aduan');
            if(tabBtn) { const tab = new bootstrap.Tab(tabBtn); tab.show(); }
            loadTiketUser();
        });

    } catch (err) {
        window.toggleLoading(false);
        if(btnSubmit) btnSubmit.disabled = false;
        Swal.fire('Ralat', 'Gagal menghantar tiket.', 'error');
    }
}

async function loadTiketUser() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const container = document.getElementById('senaraiTiketContainer');
    
    if(!container) return;
    container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_aduan')
            .select('*')
            .eq('kod_sekolah', kod)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        container.innerHTML = ""; 

        if (data.length === 0) {
            container.innerHTML = `
            <div class="text-center py-5 opacity-50">
                <i class="fas fa-folder-open fa-3x mb-3 text-secondary"></i>
                <p class="fw-bold text-dark">Tiada Rekod Aduan</p>
            </div>`;
            return;
        }

        data.forEach(t => {
            const dateObj = new Date(t.created_at);
            const dateStr = dateObj.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
            
            let statusBadge = t.status === 'SELESAI' 
                ? `<span class="badge bg-success bg-gradient shadow-sm">SELESAI</span>`
                : `<span class="badge bg-warning text-dark bg-gradient shadow-sm">DALAM PROSES</span>`;

            let responHTML = t.balasan_admin ? `
                <div class="bg-primary bg-opacity-10 p-3 rounded-3 border border-primary border-opacity-25 mt-3 position-relative">
                    <span class="position-absolute top-0 start-50 translate-middle badge rounded-pill bg-primary mt-1 shadow-sm">Respon PPD</span>
                    <p class="mb-1 text-dark small mt-2 fw-semibold">${t.balasan_admin}</p>
                </div>` : `
                <div class="bg-light p-2 rounded-3 border border-dashed mt-3 text-center">
                    <small class="text-muted fst-italic"><i class="fas fa-hourglass-half me-2"></i>Menunggu tindakan...</small>
                </div>`;

            const cardHTML = `
            <div class="card shadow-sm border-0 rounded-4 mb-1 overflow-hidden">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between mb-2">
                         <span class="fw-bold small text-muted">${dateStr}</span>
                         ${statusBadge}
                    </div>
                    <h6 class="fw-bold text-dark mb-2">${t.tajuk}</h6>
                    <p class="text-secondary small mb-0 text-break">${t.butiran_masalah}</p>
                    ${responHTML}
                </div>
            </div>`;
            container.innerHTML += cardHTML;
        });

    } catch (e) { 
        container.innerHTML = `<div class="alert alert-danger small">Gagal memuatkan tiket.</div>`;
    }
}

// ==========================================
// 6. MODUL PENCAPAIAN & KEMENJADIAN (CRUD)
// ==========================================

function setPencapaianType(type) {
    document.getElementById('pencapaianKategori').value = type;
    const wrapperJenis = document.getElementById('wrapperJenisRekod');
    const lbl = document.getElementById('labelNamaPeserta');
    const inpName = document.getElementById('pInputNama');

    if (type === 'GURU') {
        wrapperJenis.classList.remove('hidden');
        toggleJenisPencapaian();
        inpName.value = "";
        inpName.readOnly = false;
        inpName.placeholder = "Taip nama penuh guru...";
    } else {
        wrapperJenis.classList.add('hidden');
        document.getElementById('radioPertandingan').checked = true;
        toggleJenisPencapaian(); 

        if (type === 'MURID') {
            lbl.innerText = "NAMA MURID";
            inpName.value = "";
            inpName.readOnly = false;
            inpName.placeholder = "Taip nama penuh murid...";
        } else if (type === 'SEKOLAH') {
            lbl.innerText = "NAMA SEKOLAH";
            inpName.value = document.getElementById('dispNamaSekolah').innerText;
            inpName.readOnly = true; 
        }
    }
}

function toggleJenisPencapaian() {
    const isPensijilan = document.getElementById('radioPensijilan').checked;
    
    const divPenyedia = document.getElementById('divInputPenyedia');
    const selectPeringkat = document.getElementById('pInputPeringkat');
    
    const lblProgram = document.getElementById('lblProgram');
    const inpProgram = document.getElementById('pInputProgram');
    
    const lblPencapaian = document.getElementById('lblPencapaian');
    const inpPencapaian = document.getElementById('pInputPencapaian');
    
    document.getElementById('pInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        selectPeringkat.parentElement.classList.add('hidden');
        
        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        
        lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2 / LEVEL 1";
    } else {
        divPenyedia.classList.add('hidden');
        selectPeringkat.parentElement.classList.remove('hidden');
        
        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }

    const kategori = document.getElementById('pencapaianKategori').value;
    const lblNama = document.getElementById('labelNamaPeserta');
    
    if (kategori === 'GURU') {
        lblNama.innerText = isPensijilan ? "NAMA GURU" : "NAMA GURU / KUMPULAN";
    }
}

async function simpanPencapaian() {
    const kod = sessionStorage.getItem('smpid_user_kod'); 
    const btn = document.querySelector('#formPencapaian button[type="submit"]');

    const kategori = document.getElementById('pencapaianKategori').value;
    const jenisRekod = document.getElementById('pInputJenisRekod').value;
    const nama = document.getElementById('pInputNama').value.trim().toUpperCase();
    
    let penyedia = 'LAIN-LAIN';
    let peringkat = 'KEBANGSAAN';
    
    if (jenisRekod === 'PENSIJILAN') {
        penyedia = document.getElementById('pInputPenyedia').value;
        peringkat = 'ANTARABANGSA'; 
    } else {
        penyedia = 'LAIN-LAIN'; 
        peringkat = document.getElementById('pInputPeringkat').value;
    }

    const program = document.getElementById('pInputProgram').value.trim().toUpperCase();
    const tahunInput = document.getElementById('pInputTahun').value;
    const pencapaian = document.getElementById('pInputPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('pInputLink').value.trim();

    if (!nama || !program || !pencapaian || !link || !tahunInput) {
        Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat yang bertanda.', 'warning');
        return;
    }

    const tahun = parseInt(tahunInput);
    if (tahun < 2023) {
        Swal.fire('Tahun Tidak Sah', 'Rekod mestilah dari tahun 2023 dan ke atas.', 'warning');
        return;
    }

    if(btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: kod,
            kategori: kategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: tahun,
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        const { error } = await window.supabaseClient.from('smpid_pencapaian').insert([payload]);
        if (error) throw error;

        window.toggleLoading(false);
        if(btn) btn.disabled = false;

        Swal.fire('Berjaya', 'Rekod pencapaian telah disimpan.', 'success').then(() => {
            document.getElementById('pInputProgram').value = "";
            document.getElementById('pInputPencapaian').value = "";
            document.getElementById('pInputLink').value = "";
            if(kategori !== 'SEKOLAH') document.getElementById('pInputNama').value = "";
            loadPencapaianSekolah();
        });

    } catch (err) {
        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyimpan rekod.', 'error');
    }
}

async function loadPencapaianSekolah() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    const tbody = document.getElementById('tbodyRekodPencapaian');
    
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div> Memuatkan...</td></tr>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .select('*')
            .eq('kod_sekolah', kod)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Simpan data untuk kegunaan Edit
        userPencapaianList = data;

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted fst-italic">Tiada rekod dijumpai.</td></tr>`;
            return;
        }

        let html = '';
        data.forEach(item => {
            let badgeClass = 'bg-secondary';
            if (item.kategori === 'MURID') badgeClass = 'bg-info text-dark';
            else if (item.kategori === 'GURU') badgeClass = 'bg-warning text-dark';
            else if (item.kategori === 'SEKOLAH') badgeClass = 'bg-purple';

            let displayProgram = item.nama_pertandingan;
            let displayPeringkat = item.peringkat;

            if (item.jenis_rekod === 'PENSIJILAN') {
                let badgeProvider = 'bg-secondary';
                if (item.penyedia === 'GOOGLE') badgeProvider = 'bg-google';
                else if (item.penyedia === 'APPLE') badgeProvider = 'bg-apple';
                else if (item.penyedia === 'MICROSOFT') badgeProvider = 'bg-microsoft';
                
                displayProgram = `<span class="badge ${badgeProvider} me-1"><i class="fas fa-certificate"></i> ${item.penyedia}</span> <span class="fw-bold text-dark">${item.nama_pertandingan}</span>`;
                displayPeringkat = `<span class="badge bg-dark">PRO</span>`; 
            } else {
                 displayProgram = `<div class="text-primary small fw-bold text-uppercase mb-1">${item.nama_pertandingan}</div>`;
                 displayPeringkat = `<span class="badge bg-light text-dark border">${item.peringkat}</span>`;
            }

            html += `
            <tr>
                <td class="text-center align-middle">
                    <span class="badge ${badgeClass} shadow-sm">${item.kategori}</span>
                    <div class="small text-muted mt-1 fw-bold">${item.tahun}</div>
                </td>
                <td class="align-middle">
                    <div class="fw-bold text-dark small text-truncate" style="max-width: 200px;">${item.nama_peserta}</div>
                    ${displayProgram}
                    <div class="d-flex gap-2 mt-1">
                        ${displayPeringkat}
                        <span class="badge bg-success bg-opacity-10 text-success border border-success">${item.pencapaian}</span>
                    </div>
                    <a href="${item.pautan_bukti}" target="_blank" class="btn btn-link btn-sm p-0 mt-1 text-decoration-none small">
                        <i class="fas fa-external-link-alt me-1"></i>Lihat Bukti
                    </a>
                </td>
                <td class="text-center align-middle">
                    <button onclick="openEditPencapaianUser(${item.id})" class="btn btn-sm btn-outline-warning shadow-sm me-1" title="Edit Rekod">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="padamPencapaian(${item.id})" class="btn btn-sm btn-outline-danger shadow-sm" title="Padam Rekod">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-danger">Gagal memuatkan data.</td></tr>`;
    }
}

// --- FUNGSI EDIT PENCAPAIAN (BARU) ---
function openEditPencapaianUser(id) {
    const item = userPencapaianList.find(i => i.id === id);
    if (!item) return;

    // Isi Nilai Asas
    document.getElementById('editUserId').value = item.id;
    document.getElementById('editUserJenis').value = item.jenis_rekod;
    document.getElementById('editUserNama').value = item.nama_peserta;
    document.getElementById('editUserProgram').value = item.nama_pertandingan;
    document.getElementById('editUserPencapaian').value = item.pencapaian;
    document.getElementById('editUserLink').value = item.pautan_bukti;
    document.getElementById('editUserTahun').value = item.tahun;

    // Logik UI Mengikut Jenis Rekod
    const divPenyedia = document.getElementById('editUserDivPenyedia');
    const rowPeringkat = document.getElementById('editUserRowPeringkat');
    const lblProgram = document.getElementById('lblEditUserProgram');
    const lblPencapaian = document.getElementById('lblEditUserPencapaian');

    if (item.jenis_rekod === 'PENSIJILAN') {
        divPenyedia.classList.remove('hidden');
        rowPeringkat.classList.add('hidden'); // Sembunyi dropdown peringkat
        document.getElementById('editUserPenyedia').value = item.penyedia || 'LAIN-LAIN';
        
        lblProgram.innerText = "NAMA SIJIL";
        lblPencapaian.innerText = "TAHAP / SKOR";
    } else {
        divPenyedia.classList.add('hidden');
        rowPeringkat.classList.remove('hidden'); // Tunjuk balik dropdown peringkat
        document.getElementById('editUserPeringkat').value = item.peringkat || 'KEBANGSAAN';
        
        lblProgram.innerText = "NAMA PERTANDINGAN";
        lblPencapaian.innerText = "PENCAPAIAN";
    }

    // Tunjuk Modal
    const modalEl = document.getElementById('modalEditPencapaianUser');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function updatePencapaianUser() {
    const id = document.getElementById('editUserId').value;
    const jenis = document.getElementById('editUserJenis').value;
    const btn = document.querySelector('#formEditPencapaianUser button[type="submit"]');

    // Ambil Data
    const nama = document.getElementById('editUserNama').value.trim().toUpperCase();
    const program = document.getElementById('editUserProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('editUserPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('editUserLink').value.trim();
    const tahun = parseInt(document.getElementById('editUserTahun').value);

    // Validasi
    if (!nama || !program || !pencapaian || !link || !tahun) {
        Swal.fire('Data Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
        return;
    }

    // Payload
    const payload = {
        nama_peserta: nama,
        nama_pertandingan: program,
        pencapaian: pencapaian,
        pautan_bukti: link,
        tahun: tahun
    };

    if (jenis === 'PENSIJILAN') {
        payload.penyedia = document.getElementById('editUserPenyedia').value;
        payload.peringkat = 'ANTARABANGSA'; // Auto fix for cert
    } else {
        payload.peringkat = document.getElementById('editUserPeringkat').value;
        payload.penyedia = 'LAIN-LAIN';
    }

    if(btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        const { error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        window.toggleLoading(false);
        if(btn) btn.disabled = false;

        // Tutup Modal
        const modalEl = document.getElementById('modalEditPencapaianUser');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if(modal) modal.hide();

        Swal.fire('Berjaya', 'Rekod telah dikemaskini.', 'success').then(() => {
            loadPencapaianSekolah(); // Refresh Table
        });

    } catch (err) {
        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        console.error(err);
        Swal.fire('Ralat', 'Gagal mengemaskini rekod.', 'error');
    }
}

async function padamPencapaian(id) {
    Swal.fire({
        title: 'Padam Rekod?',
        text: "Data ini tidak boleh dikembalikan.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient.from('smpid_pencapaian').delete().eq('id', id); 
                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Dipadam', 'Rekod berjaya dipadam.', 'success').then(() => loadPencapaianSekolah());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam rekod.', 'error');
            }
        }
    });
}

// ==========================================
// 7. TUKAR KATA LALUAN & RESET
// ==========================================

async function ubahKataLaluan() {
    const kod = sessionStorage.getItem('smpid_user_kod');
    if (!kod) return;

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html:
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Lama</label>' +
            '<input id="swal-input1" type="password" class="swal2-input mb-3" placeholder="Masukan password semasa">' +
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Baru</label>' +
            '<input id="swal-input2" type="password" class="swal2-input" placeholder="Minima 6 aksara">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            return [
                document.getElementById('swal-input1').value,
                document.getElementById('swal-input2').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;

        if (!oldPass || !newPass) { Swal.fire('Ralat', 'Sila isi kedua-dua ruang.', 'warning'); return; }
        if (newPass.length < 6) { Swal.fire('Ralat', 'Kata laluan baru terlalu pendek (min 6).', 'warning'); return; }

        window.toggleLoading(true);

        try {
            const { data: userData, error: fetchError } = await window.supabaseClient
                .from('smpid_users')
                .select('password')
                .eq('kod_sekolah', kod)
                .single();

            if (fetchError || !userData) throw new Error("User tidak dijumpai.");
            if (userData.password !== oldPass) {
                window.toggleLoading(false);
                Swal.fire('Gagal', 'Kata laluan lama tidak sah.', 'error');
                return;
            }

            const { error: updateError } = await window.supabaseClient
                .from('smpid_users')
                .update({ password: newPass })
                .eq('kod_sekolah', kod);

            if (updateError) throw updateError;

            window.toggleLoading(false);
            Swal.fire('Berjaya', 'Kata laluan telah ditukar.', 'success').then(() => window.keluarSistem());

        } catch (err) {
            window.toggleLoading(false);
            Swal.fire('Ralat', 'Gagal menukar kata laluan.', 'error');
        }
    }
}

async function resetDataSekolah() {
    const kod = document.getElementById('hiddenKodSekolah').value;
    const { value: password } = await Swal.fire({
        title: 'Akses Admin Diperlukan',
        text: 'Masukkan kata laluan khas untuk reset data sekolah ini:',
        input: 'password',
        showCancelButton: true,
        confirmButtonText: 'Sahkan'
    });

    if (password === 'pkgag') { // Master Key
         Swal.fire({
            title: 'Pasti Reset Data?',
            text: "Semua data GPICT/Admin akan dipadam (NULL). Kod sekolah kekal.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Ya, Reset!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                window.toggleLoading(true);
                const payload = {
                    nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null, telegram_id_gpict: null,
                    nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null, telegram_id_admin: null
                };
                try {
                    const { error } = await window.supabaseClient.from('smpid_sekolah_data').update(payload).eq('kod_sekolah', kod);
                    if (error) throw error;
                    window.toggleLoading(false);
                    Swal.fire('Berjaya', 'Data sekolah telah di-reset.', 'success').then(() => loadProfil(kod));
                } catch (err) {
                    window.toggleLoading(false); 
                    Swal.fire('Ralat', 'Gagal reset data.', 'error');
                }
            }
        });
    } else if (password) {
        Swal.fire('Akses Ditolak', 'Kata laluan salah.', 'error');
    }
}

// Bind Global Window Functions
window.showSection = showSection;
window.simpanProfil = simpanProfil;
window.salinData = salinData;
window.hantarTiket = hantarTiket;
window.loadTiketUser = loadTiketUser;
window.ubahKataLaluan = ubahKataLaluan;
window.resetDataSekolah = resetDataSekolah;
window.loadAnalisaSekolah = loadAnalisaSekolah;
window.renderDcsChart = renderDcsChart;

// BIND FUNGSI PENCAPAIAN (BARU)
window.setPencapaianType = setPencapaianType;
window.simpanPencapaian = simpanPencapaian;
window.loadPencapaianSekolah = loadPencapaianSekolah;
window.padamPencapaian = padamPencapaian;
// BIND FUNGSI EDIT PENCAPAIAN USER (BARU)
window.openEditPencapaianUser = openEditPencapaianUser;
window.updatePencapaianUser = updatePencapaianUser;
// BIND FUNGSI TOGGLE JENIS (PENTING)
window.toggleJenisPencapaian = toggleJenisPencapaian;