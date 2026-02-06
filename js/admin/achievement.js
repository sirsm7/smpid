/**
 * MODUL PENCAPAIAN (js/admin/achievement.js) - REFACTORED v8.0 (Cross-Filtering)
 * Fungsi: Menguruskan Tab Pencapaian V3 dengan Logik Statistik Reaktif
 */

let pencapaianList = [];
let currentCardFilter = 'ALL';
let currentJawatanFilter = 'ALL';
let sortState = { column: 'created_at', direction: 'desc' };

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
        
        // Populate Filter Sekolah
        populateSekolahFilter(pencapaianList);
        
        // Render Utama
        renderPencapaianTable();

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-danger">Gagal memuatkan data.</td></tr>`;
    }
}

// --- CORE LOGIC: DATA PROCESSING & CROSS-FILTERING ---

/**
 * FUNGSI ORKESTRA UTAMA
 * Dipanggil setiap kali sebarang filter berubah (Search, Dropdown, Card, Jawatan)
 */
function renderPencapaianTable() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if (!tbody) return;

    // 1. Dapatkan Nilai Filter Semasa
    const katFilter = document.getElementById('filterKategoriPencapaian').value; // MURID, GURU...
    const sekFilter = document.getElementById('filterSekolahPencapaian').value; // M030, MBA...
    const searchInput = document.getElementById('searchPencapaianInput').value.toUpperCase().trim();

    // 2. HASILKAN 'BASE DATA' (Data Asas)
    // Ini adalah data yang ditapis oleh SEKOLAH dan CARIAN sahaja.
    // Ini penting supaya Search Bar memberi kesan kepada SEMUA statistik.
    let baseData = pencapaianList.filter(item => {
        // Filter Sekolah
        if (sekFilter !== 'ALL' && item.kod_sekolah !== sekFilter) return false;
        
        // Filter Carian Teks (Global Search)
        if (searchInput) {
            let namaSekolah = (item.kod_sekolah === 'M030') ? 'PPD ALOR GAJAH' : 
                (window.globalDashboardData?.find(s => s.kod_sekolah === item.kod_sekolah)?.nama_sekolah || '');
            const searchTarget = `${item.kod_sekolah} ${namaSekolah} ${item.nama_peserta} ${item.nama_pertandingan}`.toUpperCase();
            if (!searchTarget.includes(searchInput)) return false;
        }
        return true;
    });

    // 3. KIRA STATISTIK: KATEGORI (Baris Atas: Murid, Guru, dll)
    // Logic: BaseData + Filter Kad (Supaya jika pilih 'GOOGLE', kad Murid tunjuk murid Google shj)
    let dataForCategoryStats = filterByCardType(baseData, currentCardFilter);
    updateCategoryStats(dataForCategoryStats);

    // 4. KIRA STATISTIK: KAD KPI (Baris Bawah: Kebangsaan, Google, dll)
    // Logic: BaseData + Filter Kategori + Jawatan (Supaya jika pilih 'GURU', kad Google tunjuk guru Google shj)
    let dataForKPIBadges = baseData.filter(item => {
        if (katFilter !== 'ALL' && item.kategori !== katFilter) return false;
        if (currentJawatanFilter !== 'ALL' && item.jawatan !== currentJawatanFilter) return false;
        return true;
    });
    updateKPIBadges(dataForKPIBadges);

    // 5. UPDATE JAWATAN CLOUD
    // Logic: Tunjuk jawatan yang wujud dalam subset Guru semasa
    if (katFilter === 'GURU' || katFilter === 'ALL') {
        generateJawatanCloud(dataForKPIBadges); // Gunakan data yang dah filter kategori
    } else {
        document.getElementById('jawatanCloudWrapper').classList.add('hidden');
    }

    // 6. HASILKAN DATA AKHIR UNTUK JADUAL (Final Dataset)
    // Logic: Gabungan SEMUA filter
    let finalData = dataForKPIBadges.filter(item => {
        // Tapis mengikut Kad yang dipilih (jika ada)
        if (currentCardFilter === 'ALL') return true;
        
        if (currentCardFilter === 'KEBANGSAAN') return item.peringkat === 'KEBANGSAAN';
        if (currentCardFilter === 'ANTARABANGSA') return (item.peringkat === 'ANTARABANGSA' || item.jenis_rekod === 'PENSIJILAN');
        
        if (['GOOGLE', 'APPLE', 'MICROSOFT', 'LAIN-LAIN'].includes(currentCardFilter)) {
            return (item.jenis_rekod === 'PENSIJILAN' && item.penyedia === currentCardFilter);
        }
        return true;
    });

    // 7. RENDER JADUAL TOP 5 SEKOLAH
    // Logic: Berdasarkan Final Data (Siapa paling aktif dalam konteks paparan sekarang)
    renderTopSchools(finalData);

    // 8. RENDER JADUAL UTAMA
    renderMainTableRows(finalData, tbody);
    updateCardVisuals();
}

/**
 * Helper: Tapis data mengikut jenis Kad (untuk kegunaan pengiraan silang)
 */
function filterByCardType(data, cardType) {
    if (cardType === 'ALL') return data;
    return data.filter(item => {
        if (cardType === 'KEBANGSAAN') return item.peringkat === 'KEBANGSAAN';
        if (cardType === 'ANTARABANGSA') return (item.peringkat === 'ANTARABANGSA' || item.jenis_rekod === 'PENSIJILAN');
        if (['GOOGLE', 'APPLE', 'MICROSOFT', 'LAIN-LAIN'].includes(cardType)) {
            return (item.jenis_rekod === 'PENSIJILAN' && item.penyedia === cardType);
        }
        return true;
    });
}

// --- SUB-RENDERING FUNCTIONS ---

function updateCategoryStats(dataSet) {
    const counts = {
        'MURID': 0, 'GURU': 0, 'SEKOLAH': 0, 'PEGAWAI': 0, 'PPD': 0
    };

    dataSet.forEach(item => {
        if (counts[item.kategori] !== undefined) counts[item.kategori]++;
    });

    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    
    setTxt('statTotalMurid', counts['MURID']);
    setTxt('statTotalGuru', counts['GURU']);
    setTxt('statTotalSekolah', counts['SEKOLAH']);
    setTxt('statTotalPegawai', counts['PEGAWAI']);
    setTxt('statTotalUnit', counts['PPD']);
}

function updateKPIBadges(dataSet) {
    let stats = {
        'KEBANGSAAN': 0, 'ANTARABANGSA': 0,
        'GOOGLE': 0, 'APPLE': 0, 'MICROSOFT': 0, 'LAIN': 0
    };

    dataSet.forEach(item => {
        if (item.peringkat === 'KEBANGSAAN') stats['KEBANGSAAN']++;
        if (item.peringkat === 'ANTARABANGSA' || item.jenis_rekod === 'PENSIJILAN') stats['ANTARABANGSA']++;
        
        if (item.jenis_rekod === 'PENSIJILAN') {
            if (item.penyedia === 'GOOGLE') stats['GOOGLE']++;
            else if (item.penyedia === 'APPLE') stats['APPLE']++;
            else if (item.penyedia === 'MICROSOFT') stats['MICROSOFT']++;
            else if (item.penyedia === 'LAIN-LAIN') stats['LAIN']++;
        }
    });

    document.getElementById('statKebangsaan').innerText = stats['KEBANGSAAN'];
    document.getElementById('statAntarabangsa').innerText = stats['ANTARABANGSA'];
    document.getElementById('statGoogle').innerText = stats['GOOGLE'];
    document.getElementById('statApple').innerText = stats['APPLE'];
    document.getElementById('statMicrosoft').innerText = stats['MICROSOFT'];
    document.getElementById('statLain').innerText = stats['LAIN'];
}

function renderTopSchools(dataSet) {
    const top5Table = document.getElementById('tableTopContributors');
    document.getElementById('totalRecordsBadge').innerText = `${dataSet.length} Rekod`;

    const schoolCounts = {};
    dataSet.forEach(item => {
        if (item.kod_sekolah !== 'M030') {
            schoolCounts[item.kod_sekolah] = (schoolCounts[item.kod_sekolah] || 0) + 1;
        }
    });

    const sortedSchools = Object.entries(schoolCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

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
                    <div class="fw-bold text-dark small text-wrap">${namaSekolah}</div>
                    <div class="text-muted" style="font-size: 0.65rem;">${kod}</div>
                </td>
                <td class="text-end fw-bold text-primary align-middle pe-3">${count}</td>
            </tr>`;
        });
        top5Table.innerHTML = html;
    }
}

function renderMainTableRows(dataList, tbody) {
    // Sorting logic
    dataList.sort((a, b) => {
        let valA = getSortValue(a, sortState.column);
        let valB = getSortValue(b, sortState.column);
        if (valA < valB) return sortState.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });
    updateSortIcons();

    if (dataList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted fst-italic">Tiada rekod sepadan.</td></tr>`;
        return;
    }

    let html = '';
    dataList.forEach(item => {
        let namaSekolah = (item.kod_sekolah === 'M030') ? 
            '<span class="fw-bold text-indigo">PPD ALOR GAJAH</span>' : 
            (window.globalDashboardData?.find(s => s.kod_sekolah === item.kod_sekolah)?.nama_sekolah || item.kod_sekolah);

        let badgeClass = 'bg-secondary';
        if (item.kategori === 'MURID') badgeClass = 'bg-info text-dark';
        else if (item.kategori === 'GURU') badgeClass = 'bg-warning text-dark';
        else if (item.kategori === 'SEKOLAH') badgeClass = 'bg-success text-white'; 
        else if (item.kategori === 'PEGAWAI') badgeClass = 'bg-dark text-white'; 
        else if (item.kategori === 'PPD') badgeClass = 'bg-primary text-white';

        let categoryDisplay = `<span class="badge ${badgeClass} shadow-sm" style="font-size: 0.7em">${item.kategori}</span>`;
        if (item.kategori === 'GURU' && item.jawatan) {
            categoryDisplay += `<div class="mt-1"><span class="badge bg-light text-secondary border" style="font-size: 0.6rem;">${item.jawatan}</span></div>`;
        }

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
            <td class="small text-wrap" title="${namaSekolah.replace(/<[^>]*>?/gm, '')}">${namaSekolah}</td>
            <td class="text-center">${categoryDisplay}</td>
            <td><div class="fw-bold text-dark small text-wrap">${item.nama_peserta}</div></td>
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

// --- UTILS & EVENT HANDLERS ---

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

function handlePencapaianSearch(val) {
    renderPencapaianTable();
}

function filterByKategori(kategori) {
    const select = document.getElementById('filterKategoriPencapaian');
    if(select) {
        select.value = kategori;
        currentJawatanFilter = 'ALL'; // Reset jawatan bila tukar kategori
        
        const btnReset = document.getElementById('btnResetJawatan');
        if(btnReset) btnReset.classList.add('hidden');
        
        renderPencapaianTable();
        document.getElementById('tbodyPencapaianMaster')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function resetPencapaianFilters() {
    document.getElementById('filterSekolahPencapaian').value = 'ALL';
    document.getElementById('filterTahunPencapaian').value = 'ALL';
    document.getElementById('filterKategoriPencapaian').value = 'ALL';
    document.getElementById('searchPencapaianInput').value = '';
    
    currentCardFilter = 'ALL';
    currentJawatanFilter = 'ALL';
    sortState = { column: 'created_at', direction: 'desc' };
    
    document.getElementById('btnResetJawatan')?.classList.add('hidden');

    loadMasterPencapaian(); // Reload penuh
    
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
    currentCardFilter = (currentCardFilter === type) ? 'ALL' : type;
    renderPencapaianTable();
}

function filterBySchoolFromTop5(kod) {
    const select = document.getElementById('filterSekolahPencapaian');
    if (select) {
        select.value = kod;
        renderPencapaianTable();
    }
}

function filterByJawatan(jawatan) {
    currentJawatanFilter = (currentJawatanFilter === jawatan) ? 'ALL' : jawatan;
    
    // UI Button Reset
    const btnReset = document.getElementById('btnResetJawatan');
    if(btnReset) {
        if(currentJawatanFilter !== 'ALL') btnReset.classList.remove('hidden');
        else btnReset.classList.add('hidden');
    }
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
    let labelText = "";
    
    if (currentCardFilter !== 'ALL') labelText += `[${currentCardFilter}] `;
    if (currentJawatanFilter !== 'ALL') labelText += `[Jawatan: ${currentJawatanFilter}]`;
    
    if (label) label.innerText = labelText ? `(Tapisan: ${labelText})` : '';
}

// --- JAWATAN CLOUD GENERATOR ---
function generateJawatanCloud(dataSet) {
    const cloudContainer = document.getElementById('jawatanCloudContainer');
    const cloudWrapper = document.getElementById('jawatanCloudWrapper');
    
    if (!cloudContainer) return;

    // Kumpul Data Jawatan dari subset data semasa (Guru sahaja)
    const jawatanCounts = {};
    let maxCount = 0;

    dataSet.forEach(item => {
        if (item.kategori === 'GURU' && item.jawatan && item.jawatan.trim() !== "") {
            const j = item.jawatan.trim();
            jawatanCounts[j] = (jawatanCounts[j] || 0) + 1;
            if (jawatanCounts[j] > maxCount) maxCount = jawatanCounts[j];
        }
    });

    const entries = Object.entries(jawatanCounts);
    
    if (entries.length === 0) {
        cloudWrapper.classList.add('hidden');
        return;
    }

    cloudWrapper.classList.remove('hidden');
    cloudContainer.innerHTML = '';

    entries.sort((a, b) => b[1] - a[1]);

    entries.forEach(([jawatan, count]) => {
        // Size normalization logic
        let sizeClass = `tag-size-${Math.ceil((count / maxCount) * 5)}`;
        if (count === 1) sizeClass = 'tag-size-1';

        const isActive = (jawatan === currentJawatanFilter) ? 'active' : '';
        
        const btn = document.createElement('div');
        btn.className = `cloud-tag ${sizeClass} ${isActive}`;
        btn.innerHTML = `${jawatan} <span class="count-badge">${count}</span>`;
        btn.onclick = () => filterByJawatan(jawatan);
        
        cloudContainer.appendChild(btn);
    });
}

// --- SORTING HELPERS (UNCHANGED) ---
function handleSort(column) {
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }
    renderPencapaianTable();
}

function getSortValue(item, column) {
    if (column === 'nama_sekolah') {
        if (item.kod_sekolah === 'M030') return 'PPD ALOR GAJAH';
        const ref = window.globalDashboardData?.find(s => s.kod_sekolah === item.kod_sekolah);
        return ref ? ref.nama_sekolah.toLowerCase() : item.kod_sekolah.toLowerCase();
    }
    const val = item[column];
    if (typeof val === 'string') return val.toLowerCase();
    return val || '';
}

function updateSortIcons() {
    const headers = ['kod_sekolah', 'nama_sekolah', 'kategori', 'nama_peserta', 'nama_pertandingan', 'pencapaian'];
    headers.forEach(h => {
        const el = document.getElementById(`icon-${h}`);
        if(el) el.className = 'fas fa-sort ms-1 text-muted opacity-25';
    });
    const activeIcon = document.getElementById(`icon-${sortState.column}`);
    if(activeIcon) {
        activeIcon.className = `fas fa-sort-${sortState.direction === 'asc' ? 'up' : 'down'} ms-1 text-white opacity-100`;
    }
}

// --- CRUD OPERATIONS (UNCHANGED EXPORTS - KEEPING THEM FOR COMPATIBILITY) ---
// (Fungsi seperti openEditPencapaian, simpanEditPencapaian, hapusPencapaianAdmin, dll 
// dikekalkan sama seperti fail asal tetapi disingkatkan di sini untuk fokus pada refactoring)
// Pastikan fungsi-fungsi CRUD asal disalin semula di sini jika fail ini menggantikan fail lama sepenuhnya.

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
    
    const divJawatan = document.getElementById('divEditJawatan');
    if (item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
        document.getElementById('editInputJawatan').value = item.jawatan || 'GURU AKADEMIK BIASA';
    } else {
        divJawatan.classList.add('hidden');
    }

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

    const divJawatan = document.getElementById('divEditJawatan');
    if (!divJawatan.classList.contains('hidden')) {
        payload.jawatan = document.getElementById('editInputJawatan').value;
    }

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
        text: "Tindakan ini kekal.",
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
        inpPencapaian.placeholder = "Contoh: LULUS / BAND C2";
    } else {
        divPenyedia.classList.add('hidden');
        rowPeringkat.classList.remove('hidden');
        divTahunOnly.classList.add('hidden');
        lblProgram.innerText = "NAMA PERTANDINGAN";
        inpProgram.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        lblPencapaian.innerText = "PENCAPAIAN";
        inpPencapaian.placeholder = "Contoh: JOHAN / EMAS";
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

        const { error } = await window.supabaseClient.from('smpid_pencapaian').insert([payload]);
        if (error) throw error;

        window.toggleLoading(false);
        if(btn) btn.disabled = false;

        bootstrap.Modal.getInstance(document.getElementById('modalRekodPPD')).hide();
        document.getElementById('formPencapaianPPD').reset();

        Swal.fire('Berjaya', 'Rekod PPD telah disimpan.', 'success').then(() => {
            loadMasterPencapaian();
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
window.resetPencapaianFilters = resetPencapaianFilters; 
window.filterBySchoolFromTop5 = filterBySchoolFromTop5;
window.renderPencapaianTable = renderPencapaianTable;
window.openEditPencapaian = openEditPencapaian;
window.simpanEditPencapaian = simpanEditPencapaian;
window.hapusPencapaianAdmin = hapusPencapaianAdmin;
window.openModalPPD = openModalPPD;
window.toggleKategoriPPD = toggleKategoriPPD;
window.toggleJenisPencapaianPPD = toggleJenisPencapaianPPD;
window.simpanPencapaianPPD = simpanPencapaianPPD;
window.handlePencapaianSearch = handlePencapaianSearch;
window.handleSort = handleSort;
window.filterByJawatan = filterByJawatan;