/**
 * MODUL PENCAPAIAN (js/admin/achievement.js)
 * Fungsi: Menguruskan Tab Pencapaian V3 (CRUD, Filter Kad, Statistik)
 */

let pencapaianList = [];
let currentCardFilter = 'ALL';

// --- INIT & LOAD DATA ---
async function populateTahunFilter() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Memuatkan...</option>';
    select.disabled = true;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .select('tahun');

        if (error) throw error;

        const years = [...new Set(data.map(item => item.tahun))].sort((a, b) => b - a);
        select.innerHTML = ''; 

        if (years.length === 0) {
            select.innerHTML = '<option value="" disabled selected>TIADA REKOD</option>';
            select.disabled = true;
        } else {
            const optAll = document.createElement('option');
            optAll.value = "ALL";
            optAll.innerText = "SEMUA TAHUN";
            select.appendChild(optAll);

            years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.innerText = `TAHUN ${y}`;
                select.appendChild(opt);
            });
            select.disabled = false;
            select.value = "ALL";
            
            loadMasterPencapaian();
        }

    } catch (err) {
        console.error("Year Filter Error:", err);
        select.innerHTML = '<option value="" disabled selected>Ralat</option>';
    }
}

async function loadMasterPencapaian() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>`;
    document.getElementById('tableTopContributors').innerHTML = `<tr><td class="text-center p-4">Mengira data...</td></tr>`;

    const tahunInput = document.getElementById('filterTahunPencapaian');
    const tahun = tahunInput.value || 'ALL';

    try {
        let query = window.supabaseClient.from('smpid_pencapaian').select('*');
        if (tahun !== 'ALL') query = query.eq('tahun', tahun);
        
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw error;
        
        pencapaianList = data;
        populateSekolahFilter(pencapaianList);
        renderPencapaianTable();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-danger">Gagal memuatkan data.</td></tr>`;
    }
}

// --- LOGIK FILTER & STATISTIK ---
function updateStatCards(dataToProcess) {
    // 1. STATISTIK KATEGORI UTAMA (NEW)
    const totalMurid = dataToProcess.filter(i => i.kategori === 'MURID').length;
    const totalGuru = dataToProcess.filter(i => i.kategori === 'GURU').length;
    const totalSekolah = dataToProcess.filter(i => i.kategori === 'SEKOLAH').length;
    const totalPegawai = dataToProcess.filter(i => i.kategori === 'PEGAWAI').length;
    const totalUnit = dataToProcess.filter(i => i.kategori === 'PPD').length;

    const elMurid = document.getElementById('statTotalMurid');
    const elGuru = document.getElementById('statTotalGuru');
    const elSekolah = document.getElementById('statTotalSekolah');
    const elPegawai = document.getElementById('statTotalPegawai');
    const elUnit = document.getElementById('statTotalUnit');

    if(elMurid) elMurid.innerText = totalMurid;
    if(elGuru) elGuru.innerText = totalGuru;
    if(elSekolah) elSekolah.innerText = totalSekolah;
    if(elPegawai) elPegawai.innerText = totalPegawai;
    if(elUnit) elUnit.innerText = totalUnit;

    // 2. STATISTIK PERINGKAT & PENYEDIA
    const totalKeb = dataToProcess.filter(i => i.peringkat === 'KEBANGSAAN').length;
    const totalInt = dataToProcess.filter(i => i.peringkat === 'ANTARABANGSA' || i.jenis_rekod === 'PENSIJILAN').length;
    const countGoogle = dataToProcess.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'GOOGLE').length;
    const countApple = dataToProcess.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'APPLE').length;
    const countMicrosoft = dataToProcess.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'MICROSOFT').length;
    const countLain = dataToProcess.filter(i => i.jenis_rekod === 'PENSIJILAN' && i.penyedia === 'LAIN-LAIN').length;

    document.getElementById('statKebangsaan').innerText = totalKeb;
    document.getElementById('statAntarabangsa').innerText = totalInt;
    document.getElementById('statGoogle').innerText = countGoogle;
    document.getElementById('statApple').innerText = countApple;
    document.getElementById('statMicrosoft').innerText = countMicrosoft;
    document.getElementById('statLain').innerText = countLain;

    // 3. TOP CONTRIBUTORS LOGIC
    const schoolCounts = {};
    dataToProcess.forEach(item => {
        if (item.kod_sekolah !== 'M030') {
            schoolCounts[item.kod_sekolah] = (schoolCounts[item.kod_sekolah] || 0) + 1;
        }
    });

    const sortedSchools = Object.entries(schoolCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const top5Table = document.getElementById('tableTopContributors');
    document.getElementById('totalRecordsBadge').innerText = `${dataToProcess.length} Rekod`;

    if (sortedSchools.length === 0) {
        top5Table.innerHTML = `<tr><td class="text-center p-4 text-muted">Tiada data sekolah.</td></tr>`;
    } else {
        let html = '';
        sortedSchools.forEach(([kod, count], index) => {
            let namaSekolah = kod;
            const ref = window.globalDashboardData?.find(s => s.kod_sekolah === kod);
            if (ref) namaSekolah = ref.nama_sekolah;

            let medal = '';
            if (index === 0) medal = '<span class="medal-icon medal-1">1</span>';
            else if (index === 1) medal = '<span class="medal-icon medal-2">2</span>';
            else if (index === 2) medal = '<span class="medal-icon medal-3">3</span>';
            else medal = `<span class="fw-bold text-muted ps-2">${index + 1}</span>`;

            html += `
            <tr class="top-school-row" onclick="filterBySchoolFromTop5('${kod}')">
                <td style="width: 40px;" class="text-center align-middle">${medal}</td>
                <td class="align-middle">
                    <div class="fw-bold text-dark small text-truncate" style="max-width: 180px;">${namaSekolah}</div>
                    <div class="text-muted" style="font-size: 0.65rem;">${kod}</div>
                </td>
                <td class="text-end fw-bold text-primary align-middle pe-3">${count}</td>
            </tr>`;
        });
        top5Table.innerHTML = html;
    }
}

function populateSekolahFilter(sourceData) {
    const select = document.getElementById('filterSekolahPencapaian');
    const existingVal = select.value;
    
    const schoolCounts = {};
    sourceData.forEach(item => {
        schoolCounts[item.kod_sekolah] = (schoolCounts[item.kod_sekolah] || 0) + 1;
    });

    const uniqueSchools = Object.keys(schoolCounts).sort();
    
    select.innerHTML = '<option value="ALL">SEMUA SEKOLAH</option>';
    
    uniqueSchools.forEach(kod => {
        let label = kod;
        if (kod === 'M030') label = 'PPD ALOR GAJAH (M030)';
        else {
            const ref = window.globalDashboardData?.find(s => s.kod_sekolah === kod);
            if (ref) label = `${ref.nama_sekolah}`;
        }
        
        const count = schoolCounts[kod];
        label += ` (${count})`;

        const opt = document.createElement('option');
        opt.value = kod;
        opt.innerText = label;
        select.appendChild(opt);
    });

    if (uniqueSchools.includes(existingVal)) select.value = existingVal;
}

// --- FUNGSI TAPISAN KATEGORI & RESET ---
function filterByKategori(kategori) {
    const select = document.getElementById('filterKategoriPencapaian');
    if(select) {
        select.value = kategori;
        renderPencapaianTable();
        document.getElementById('tbodyPencapaianMaster')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function resetPencapaianFilters() {
    // 1. Reset Nilai Dropdown
    document.getElementById('filterSekolahPencapaian').value = 'ALL';
    document.getElementById('filterTahunPencapaian').value = 'ALL';
    document.getElementById('filterKategoriPencapaian').value = 'ALL';
    
    // 2. Reset Filter Kad
    currentCardFilter = 'ALL';
    updateCardVisuals();

    // 3. Muat Semula Data (Ini akan trigger renderPencapaianTable juga)
    loadMasterPencapaian();
    
    // 4. UI Feedback
    Swal.fire({
        icon: 'success',
        title: 'Filter Direset',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1000
    });
}

function filterByCard(type) {
    if (currentCardFilter === type) {
        currentCardFilter = 'ALL';
    } else {
        currentCardFilter = type;
    }
    updateCardVisuals();
    renderPencapaianTable();
}

function updateCardVisuals() {
    const cards = ['KEBANGSAAN', 'ANTARABANGSA', 'GOOGLE', 'APPLE', 'MICROSOFT', 'LAIN-LAIN'];
    cards.forEach(c => {
        const el = document.getElementById(`card-${c}`);
        if(el) el.classList.remove('card-active-filter');
    });

    if (currentCardFilter !== 'ALL') {
        const activeEl = document.getElementById(`card-${currentCardFilter}`);
        if(activeEl) activeEl.classList.add('card-active-filter');
    }
    
    const label = document.getElementById('labelCurrentFilter');
    if (label) label.innerText = (currentCardFilter !== 'ALL') ? `(Tapisan: ${currentCardFilter})` : '';
}

function filterBySchoolFromTop5(kod) {
    const select = document.getElementById('filterSekolahPencapaian');
    if (select) {
        select.value = kod;
        renderPencapaianTable();
    }
}

function renderPencapaianTable() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if (!tbody) return;

    const katFilter = document.getElementById('filterKategoriPencapaian').value;
    const sekFilter = document.getElementById('filterSekolahPencapaian').value;

    // 1. Tapis Sekolah dahulu (untuk updateStatCards)
    let baseData = pencapaianList.filter(item => {
        if (sekFilter !== 'ALL' && item.kod_sekolah !== sekFilter) return false;
        return true;
    });

    // Update Kad Statistik (Supaya kad kategori tunjuk jumlah yang betul sebelum ditapis kategori)
    updateStatCards(baseData);

    // 2. Tapis Kategori
    let filtered = baseData.filter(item => {
        if (katFilter !== 'ALL' && item.kategori !== katFilter) return false;
        return true;
    });

    // 3. Tapis Kad (National/International/Provider)
    if (currentCardFilter !== 'ALL') {
        filtered = filtered.filter(item => {
            if (currentCardFilter === 'KEBANGSAAN') return item.peringkat === 'KEBANGSAAN';
            if (currentCardFilter === 'ANTARABANGSA') return (item.peringkat === 'ANTARABANGSA' || item.jenis_rekod === 'PENSIJILAN');
            if (['GOOGLE', 'APPLE', 'MICROSOFT', 'LAIN-LAIN'].includes(currentCardFilter)) {
                return (item.jenis_rekod === 'PENSIJILAN' && item.penyedia === currentCardFilter);
            }
            return true;
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted fst-italic">Tiada rekod sepadan.</td></tr>`;
        return;
    }

    let html = '';
    filtered.forEach(item => {
        let namaSekolah = (item.kod_sekolah === 'M030') ? 
            '<span class="fw-bold text-indigo">PPD ALOR GAJAH</span>' : 
            (window.globalDashboardData?.find(s => s.kod_sekolah === item.kod_sekolah)?.nama_sekolah || item.kod_sekolah);

        let badgeClass = 'bg-secondary';
        if (item.kategori === 'MURID') badgeClass = 'bg-info text-dark';
        else if (item.kategori === 'GURU') badgeClass = 'bg-warning text-dark';
        else if (item.kategori === 'SEKOLAH') badgeClass = 'bg-success text-white'; 
        else if (item.kategori === 'PEGAWAI') badgeClass = 'bg-dark text-white'; 
        else if (item.kategori === 'PPD') badgeClass = 'bg-primary text-white';

        let displayProgram = '';
        let displayPencapaian = '';

        if (item.jenis_rekod === 'PENSIJILAN') {
            let providerBadge = 'bg-secondary';
            if(item.penyedia === 'GOOGLE') providerBadge = 'bg-google';
            else if(item.penyedia === 'APPLE') providerBadge = 'bg-apple';
            else if(item.penyedia === 'MICROSOFT') providerBadge = 'bg-microsoft';

            displayProgram = `<span class="badge ${providerBadge} me-1 small"><i class="fas fa-certificate"></i></span> <span class="fw-bold small">${item.nama_pertandingan}</span>`;
            displayPencapaian = `<span class="fw-bold text-dark small">${item.pencapaian}</span>`;
        } else {
            displayProgram = `<div class="small text-uppercase fw-bold text-primary">${item.nama_pertandingan}</div>`;
            displayPencapaian = `<span class="fw-bold text-success small">${item.pencapaian}</span>`;
        }

        html += `
        <tr>
            <td class="fw-bold small">${item.kod_sekolah}</td>
            <td class="small text-truncate" style="max-width: 180px;" title="${namaSekolah.replace(/<[^>]*>?/gm, '')}">${namaSekolah}</td>
            <td class="text-center"><span class="badge ${badgeClass} shadow-sm" style="font-size: 0.7em">${item.kategori}</span></td>
            <td><div class="fw-bold text-dark small text-truncate" style="max-width: 150px;" title="${item.nama_peserta}">${item.nama_peserta}</div></td>
            <td>${displayProgram}</td>
            <td class="text-center">${displayPencapaian}</td>
            <td class="text-center">
                <a href="${item.pautan_bukti}" target="_blank" class="btn btn-sm btn-light border text-primary" title="Lihat Bukti"><i class="fas fa-link"></i></a>
            </td>
            <td class="text-center text-nowrap">
                <button onclick="openEditPencapaian(${item.id})" class="btn btn-sm btn-outline-warning me-1" title="Edit"><i class="fas fa-edit"></i></button>
                <button onclick="hapusPencapaianAdmin(${item.id})" class="btn btn-sm btn-outline-danger" title="Hapus"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// --- CRUD OPERATIONS ---
function openEditPencapaian(id) {
    const item = pencapaianList.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editIdPencapaian').value = item.id;
    document.getElementById('editJenisRekod').value = item.jenis_rekod;
    document.getElementById('editNamaSekolah').value = item.kod_sekolah;
    document.getElementById('editInputNama').value = item.nama_peserta;
    document.getElementById('editInputProgram').value = item.nama_pertandingan;
    document.getElementById('editInputPencapaian').value = item.pencapaian;
    document.getElementById('editInputLink').value = item.pautan_bukti;
    
    const divPenyedia = document.getElementById('divEditPenyedia');
    const rowPeringkat = document.getElementById('rowEditPeringkat');
    
    if (item.jenis_rekod === 'PENSIJILAN') {
        divPenyedia.classList.remove('hidden');
        rowPeringkat.classList.add('hidden');
        
        document.getElementById('editInputPenyedia').value = item.penyedia || 'LAIN-LAIN';
        document.getElementById('lblEditProgram').innerText = "NAMA SIJIL";
        document.getElementById('lblEditPencapaian').innerText = "TAHAP / SKOR";
    } else {
        divPenyedia.classList.add('hidden');
        rowPeringkat.classList.remove('hidden');
        
        document.getElementById('editInputPeringkat').value = item.peringkat;
        document.getElementById('editInputTahun').value = item.tahun;
        
        document.getElementById('lblEditProgram').innerText = "NAMA PERTANDINGAN";
        document.getElementById('lblEditPencapaian').innerText = "PENCAPAIAN";
    }

    const modal = new bootstrap.Modal(document.getElementById('modalEditPencapaian'));
    modal.show();
}

async function simpanEditPencapaian() {
    const id = document.getElementById('editIdPencapaian').value;
    const jenis = document.getElementById('editJenisRekod').value;
    
    const payload = {
        nama_peserta: document.getElementById('editInputNama').value.toUpperCase(),
        nama_pertandingan: document.getElementById('editInputProgram').value.toUpperCase(),
        pencapaian: document.getElementById('editInputPencapaian').value.toUpperCase(),
        pautan_bukti: document.getElementById('editInputLink').value
    };

    if (jenis === 'PENSIJILAN') {
        payload.penyedia = document.getElementById('editInputPenyedia').value;
    } else {
        payload.peringkat = document.getElementById('editInputPeringkat').value;
        payload.tahun = parseInt(document.getElementById('editInputTahun').value);
    }

    const btn = document.querySelector('#formEditPencapaian button[type="submit"]');
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
        
        bootstrap.Modal.getInstance(document.getElementById('modalEditPencapaian')).hide();
        Swal.fire({ icon: 'success', title: 'Data Dikemaskini', timer: 1000, showConfirmButton: false });
        
        loadMasterPencapaian();

    } catch (err) {
        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        console.error(err);
        Swal.fire('Ralat', 'Gagal mengemaskini data.', 'error');
    }
}

async function hapusPencapaianAdmin(id) {
    Swal.fire({
        title: 'Padam Rekod?',
        text: "Tindakan ini kekal dan tidak boleh dikembalikan.",
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
                Swal.fire('Dipadam', 'Rekod berjaya dipadam.', 'success').then(() => loadMasterPencapaian());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
}

// --- FUNGSI REKOD PPD ---
function openModalPPD() {
    const modal = new bootstrap.Modal(document.getElementById('modalRekodPPD'));
    modal.show();
}

function toggleKategoriPPD() {
    const isUnit = document.getElementById('radUnit').checked;
    const lbl = document.getElementById('lblPpdNamaPeserta');
    const inp = document.getElementById('ppdInputNama');
    
    if (isUnit) {
        lbl.innerText = "NAMA UNIT / SEKTOR";
        inp.placeholder = "Contoh: SEKTOR PEMBELAJARAN";
    } else {
        lbl.innerText = "NAMA PEGAWAI";
        inp.placeholder = "Taip nama penuh...";
    }
}

function toggleJenisPencapaianPPD() {
    const isPensijilan = document.getElementById('radPpdPensijilan').checked;
    
    // Elements
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const rowPeringkat = document.getElementById('rowPpdPeringkat');
    const divTahunOnly = document.getElementById('divPpdTahunOnly');
    
    const lblProgram = document.getElementById('lblPpdProgram');
    const inpProgram = document.getElementById('ppdInputProgram');
    
    const lblPencapaian = document.getElementById('lblPpdPencapaian');
    const inpPencapaian = document.getElementById('ppdInputPencapaian');

    document.getElementById('ppdInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';

    if (isPensijilan) {
        divPenyedia.classList.remove('hidden');
        rowPeringkat.classList.add('hidden');
        divTahunOnly.classList.remove('hidden');

        lblProgram.innerText = "NAMA SIJIL / PROGRAM";
        inpProgram.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        
        lblPencapaian.innerText = "TAHAP / SKOR / BAND";
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2 / LEVEL 1";

    } else {
        divPenyedia.classList.add('hidden');
        rowPeringkat.classList.remove('hidden');
        divTahunOnly.classList.add('hidden');

        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS / PENYERTAAN";
    }
}

async function simpanPencapaianPPD() {
    const btn = document.querySelector('#formPencapaianPPD button[type="submit"]');

    const radKategori = document.querySelector('input[name="radKatPPD"]:checked').value;
    const jenisRekod = document.getElementById('ppdInputJenisRekod').value;
    const nama = document.getElementById('ppdInputNama').value.trim().toUpperCase();
    
    let penyedia = 'LAIN-LAIN';
    let peringkat = 'KEBANGSAAN';
    let tahun = 2024;
    
    if (jenisRekod === 'PENSIJILAN') {
        penyedia = document.getElementById('ppdInputPenyedia').value;
        peringkat = 'ANTARABANGSA';
        tahun = document.getElementById('ppdInputTahun2').value;
    } else {
        penyedia = 'LAIN-LAIN';
        peringkat = document.getElementById('ppdInputPeringkat').value;
        tahun = document.getElementById('ppdInputTahun').value;
    }

    const program = document.getElementById('ppdInputProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('ppdInputPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('ppdInputLink').value.trim();

    if (!nama || !program || !pencapaian || !link || !tahun) {
        Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
        return;
    }

    if (parseInt(tahun) < 2023) {
        Swal.fire('Tahun Tidak Sah', 'Rekod mestilah dari tahun 2023 dan ke atas.', 'warning');
        return;
    }

    if(btn) btn.disabled = true;
    window.toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: 'M030',
            kategori: radKategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: parseInt(tahun),
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        const { error } = await window.supabaseClient
            .from('smpid_pencapaian')
            .insert([payload]);

        if (error) throw error;

        window.toggleLoading(false);
        if(btn) btn.disabled = false;

        bootstrap.Modal.getInstance(document.getElementById('modalRekodPPD')).hide();
        document.getElementById('formPencapaianPPD').reset();

        Swal.fire('Berjaya', 'Rekod PPD telah disimpan.', 'success').then(() => {
            populateTahunFilter();
        });

    } catch (err) {
        window.toggleLoading(false);
        if(btn) btn.disabled = false;
        console.error(err);
        Swal.fire('Ralat', 'Gagal menyimpan rekod PPD.', 'error');
    }
}

// EXPORTS
window.loadMasterPencapaian = loadMasterPencapaian;
window.populateTahunFilter = populateTahunFilter;
window.filterByCard = filterByCard;
window.filterByKategori = filterByKategori;
window.resetPencapaianFilters = resetPencapaianFilters; // Export baru
window.filterBySchoolFromTop5 = filterBySchoolFromTop5;
window.renderPencapaianTable = renderPencapaianTable;
window.openEditPencapaian = openEditPencapaian;
window.simpanEditPencapaian = simpanEditPencapaian;
window.hapusPencapaianAdmin = hapusPencapaianAdmin;
window.openModalPPD = openModalPPD;
window.toggleKategoriPPD = toggleKategoriPPD;
window.toggleJenisPencapaianPPD = toggleJenisPencapaianPPD;
window.simpanPencapaianPPD = simpanPencapaianPPD;