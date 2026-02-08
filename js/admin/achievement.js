/**
 * ADMIN MODULE: ACHIEVEMENT (DEV) - VISUAL FIX (FULL WRAP)
 * Menguruskan rekod pencapaian murid, guru, dan sekolah.
 * * CHANGE LOG:
 * - Dibuang: Logic truncate pada nama sekolah, peserta, dan program.
 * - Ditambah: class="text-wrap" untuk paparan penuh multi-line.
 * - NEW: Added CSV Export functionality based on filtered list.
 */

import { AchievementService } from '../services/achievement.service.js';
import { toggleLoading } from '../core/helpers.js';

let pencapaianList = [];
let currentPencapaianFiltered = []; // Store filtered list for export
let currentCardFilter = 'ALL';
let currentJawatanFilter = 'ALL';
let sortState = { column: 'created_at', direction: 'desc' };

window.populateTahunFilter = async function() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;
    try {
        const years = await AchievementService.getAvailableYears();
        select.innerHTML = '<option value="ALL">SEMUA TAHUN</option>';
        years.forEach(y => select.innerHTML += `<option value="${y}">TAHUN ${y}</option>`);
        window.loadMasterPencapaian();
    } catch (e) { console.error(e); }
};

window.loadMasterPencapaian = async function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if(!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary"></div></td></tr>`;
    
    const tahun = document.getElementById('filterTahunPencapaian').value;
    
    try {
        pencapaianList = await AchievementService.getAll(tahun);
        populateSekolahFilter(pencapaianList);
        window.renderPencapaianTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Gagal memuatkan data.</td></tr>`;
    }
};

function populateSekolahFilter(data) {
    const select = document.getElementById('filterSekolahPencapaian');
    const seen = new Set();
    const oldVal = select.value; 
    
    select.innerHTML = '<option value="ALL">SEMUA SEKOLAH</option>';
    
    // Sort sekolah ikut abjad
    const sortedData = [...data].sort((a, b) => a.kod_sekolah.localeCompare(b.kod_sekolah));

    sortedData.forEach(i => {
        if(!seen.has(i.kod_sekolah)) {
            let label = i.kod_sekolah;
            if (i.kod_sekolah === 'M030') label = "PPD ALOR GAJAH (M030)";
            else if(window.globalDashboardData) {
                const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
                if(s) label = `${s.nama_sekolah} (${i.kod_sekolah})`;
            }
            // Count rekod untuk sekolah ni
            const count = data.filter(d => d.kod_sekolah === i.kod_sekolah).length;
            select.innerHTML += `<option value="${i.kod_sekolah}">${label} (${count})</option>`;
            seen.add(i.kod_sekolah);
        }
    });
    if(seen.has(oldVal)) select.value = oldVal;
}

window.renderPencapaianTable = function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    const katFilter = document.getElementById('filterKategoriPencapaian').value;
    const sekFilter = document.getElementById('filterSekolahPencapaian').value;
    const search = document.getElementById('searchPencapaianInput').value.toUpperCase();

    let data = pencapaianList.filter(i => {
        if(sekFilter !== 'ALL' && i.kod_sekolah !== sekFilter) return false;
        if(katFilter !== 'ALL' && i.kategori !== katFilter) return false;
        
        // Search Logic
        if(search) {
            let namaSekolah = (i.kod_sekolah === 'M030') ? 'PPD ALOR GAJAH' : 
                (window.globalDashboardData?.find(s => s.kod_sekolah === i.kod_sekolah)?.nama_sekolah || '');
            const searchTarget = `${i.kod_sekolah} ${namaSekolah} ${i.nama_peserta} ${i.nama_pertandingan}`.toUpperCase();
            if (!searchTarget.includes(search)) return false;
        }
        
        // Filter Card
        if(currentCardFilter === 'KEBANGSAAN' && i.peringkat !== 'KEBANGSAAN') return false;
        if(currentCardFilter === 'ANTARABANGSA' && !['ANTARABANGSA'].includes(i.peringkat) && i.jenis_rekod !== 'PENSIJILAN') return false;
        if(['GOOGLE','APPLE','MICROSOFT'].includes(currentCardFilter) && i.penyedia !== currentCardFilter) return false;
        if(currentCardFilter === 'LAIN-LAIN' && (i.jenis_rekod !== 'PENSIJILAN' || i.penyedia !== 'LAIN-LAIN')) return false;
        
        // Filter Jawatan
        if(currentJawatanFilter !== 'ALL' && i.jawatan !== currentJawatanFilter) return false;

        return true;
    });

    updateStats(data);
    updateCloud(data); // Jawatan Cloud

    // Sort Logic
    data.sort((a,b) => {
        let valA = a[sortState.column] || '';
        let valB = b[sortState.column] || '';
        if (sortState.column === 'nama_sekolah') valA = a.kod_sekolah; 
        if (sortState.direction === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    // Save filtered and sorted data for export
    currentPencapaianFiltered = data;

    // Render Top 5 Schools Table
    renderTopSchools(data);

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">Tiada rekod sepadan.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(i => {
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = `<span class="text-indigo fw-bold">PPD ALOR GAJAH</span>`;
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        let badgeClass = 'bg-secondary';
        if (i.kategori === 'MURID') badgeClass = 'bg-info text-dark';
        else if (i.kategori === 'GURU') badgeClass = 'bg-warning text-dark';
        else if (i.kategori === 'SEKOLAH') badgeClass = 'bg-success';
        else if (i.kategori === 'PEGAWAI') badgeClass = 'bg-dark';
        else if (i.kategori === 'PPD') badgeClass = 'bg-primary';

        return `<tr>
            <td class="fw-bold small align-middle">${i.kod_sekolah}</td>
            <td class="small text-wrap align-middle">${namaSekolah}</td>
            <td class="text-center align-middle"><span class="badge ${badgeClass} shadow-sm">${i.kategori}</span></td>
            <td class="align-middle">
                <div class="fw-bold text-dark small text-wrap">${i.nama_peserta}</div>
                ${i.jawatan ? `<span class="badge bg-light text-secondary border mt-1" style="font-size:0.6rem;">${i.jawatan}</span>` : ''}
            </td>
            <td class="align-middle"><div class="text-primary small fw-bold text-wrap">${i.nama_pertandingan}</div></td>
            <td class="text-center fw-bold small align-middle">${i.pencapaian}</td>
            <td class="text-center align-middle"><a href="${i.pautan_bukti}" target="_blank" class="btn btn-sm btn-light border text-primary"><i class="fas fa-link"></i></a></td>
            <td class="text-center text-nowrap align-middle">
                <button onclick="openEditPencapaian(${i.id})" class="btn btn-sm btn-outline-warning me-1"><i class="fas fa-edit"></i></button>
                <button onclick="hapusPencapaianAdmin(${i.id})" class="btn btn-sm btn-outline-danger"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
};

function updateStats(data) {
    const ids = ['statTotalMurid', 'statTotalGuru', 'statTotalSekolah', 'statTotalPegawai', 'statTotalUnit'];
    const cats = ['MURID', 'GURU', 'SEKOLAH', 'PEGAWAI', 'PPD'];
    
    ids.forEach((id, idx) => {
        document.getElementById(id).innerText = data.filter(i => i.kategori === cats[idx]).length;
    });
    
    document.getElementById('statKebangsaan').innerText = data.filter(i => i.peringkat === 'KEBANGSAAN').length;
    document.getElementById('statAntarabangsa').innerText = data.filter(i => i.peringkat === 'ANTARABANGSA' || i.jenis_rekod === 'PENSIJILAN').length;
    
    const pensijilan = data.filter(i => i.jenis_rekod === 'PENSIJILAN');
    document.getElementById('statGoogle').innerText = pensijilan.filter(i => i.penyedia === 'GOOGLE').length;
    document.getElementById('statApple').innerText = pensijilan.filter(i => i.penyedia === 'APPLE').length;
    document.getElementById('statMicrosoft').innerText = pensijilan.filter(i => i.penyedia === 'MICROSOFT').length;
    document.getElementById('statLain').innerText = pensijilan.filter(i => i.penyedia === 'LAIN-LAIN').length;
    
    const cards = ['KEBANGSAAN', 'ANTARABANGSA', 'GOOGLE', 'APPLE', 'MICROSOFT', 'LAIN-LAIN'];
    cards.forEach(c => document.getElementById(`card-${c}`)?.classList.remove('card-active-filter'));
    if(currentCardFilter !== 'ALL') document.getElementById(`card-${currentCardFilter}`)?.classList.add('card-active-filter');
}

function updateCloud(data) {
    const container = document.getElementById('jawatanCloudContainer');
    const guruData = data.filter(i => i.kategori === 'GURU' && i.jawatan);
    
    if(guruData.length === 0) {
        document.getElementById('jawatanCloudWrapper').classList.add('hidden');
        return;
    }
    
    document.getElementById('jawatanCloudWrapper').classList.remove('hidden');
    const counts = {};
    let maxCount = 0;
    
    guruData.forEach(i => {
        counts[i.jawatan] = (counts[i.jawatan] || 0) + 1;
        if(counts[i.jawatan] > maxCount) maxCount = counts[i.jawatan];
    });
    
    container.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([j, c]) => {
            let sizeClass = `tag-size-${Math.ceil((c / maxCount) * 5)}`;
            if(c === 1) sizeClass = 'tag-size-1';
            const isActive = currentJawatanFilter === j ? 'active' : '';
            return `<div class="cloud-tag ${sizeClass} ${isActive}" onclick="filterByJawatan('${j}')">${j} <span class="count-badge">${c}</span></div>`;
        }).join('');
}

function renderTopSchools(data) {
    const table = document.getElementById('tableTopContributors');
    document.getElementById('totalRecordsBadge').innerText = `${data.length} Rekod`;
    
    const schoolCounts = {};
    data.forEach(i => {
        if(i.kod_sekolah !== 'M030') schoolCounts[i.kod_sekolah] = (schoolCounts[i.kod_sekolah] || 0) + 1;
    });
    
    const sorted = Object.entries(schoolCounts).sort(([,a], [,b]) => b - a).slice(0, 5);
    
    if(sorted.length === 0) {
        table.innerHTML = `<tr><td class="text-center p-4 text-muted">Tiada data sekolah.</td></tr>`;
        return;
    }
    
    table.innerHTML = sorted.map(([kod, count], idx) => {
        let nama = kod;
        const s = window.globalDashboardData?.find(x => x.kod_sekolah === kod);
        if(s) nama = s.nama_sekolah;
        
        let medal = idx < 3 ? `<span class="medal-icon medal-${idx+1}">${idx+1}</span>` : `<span class="fw-bold ps-2">${idx+1}</span>`;
        return `<tr class="top-school-row" onclick="filterBySchoolFromTop5('${kod}')">
            <td style="width: 40px;" class="text-center align-middle">${medal}</td>
            <td class="align-middle"><div class="fw-bold small text-dark text-wrap">${nama}</div><div class="text-muted" style="font-size:0.65rem;">${kod}</div></td>
            <td class="text-end fw-bold text-primary align-middle pe-3">${count}</td>
        </tr>`;
    }).join('');
}

// --- GLOBAL EXPORTS ---
window.filterByKategori = function(k) { document.getElementById('filterKategoriPencapaian').value = k; currentJawatanFilter = 'ALL'; window.renderPencapaianTable(); };
window.filterByCard = function(c) { currentCardFilter = (currentCardFilter === c) ? 'ALL' : c; window.renderPencapaianTable(); };
window.filterByJawatan = function(j) { currentJawatanFilter = (currentJawatanFilter === j) ? 'ALL' : j; window.renderPencapaianTable(); };
window.filterBySchoolFromTop5 = function(kod) { document.getElementById('filterSekolahPencapaian').value = kod; window.renderPencapaianTable(); };

window.resetPencapaianFilters = function() { 
    currentCardFilter='ALL'; currentJawatanFilter='ALL'; 
    document.getElementById('searchPencapaianInput').value = '';
    document.getElementById('filterKategoriPencapaian').value = 'ALL';
    document.getElementById('filterSekolahPencapaian').value = 'ALL';
    document.getElementById('filterTahunPencapaian').value = 'ALL';
    window.loadMasterPencapaian();
    Swal.fire({ icon: 'success', title: 'Filter Direset', toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
};

window.handleSort = function(col) {
    if(sortState.column === col) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else { sortState.column = col; sortState.direction = 'asc'; }
    window.renderPencapaianTable();
    
    const icons = ['kod_sekolah','nama_sekolah','kategori','nama_peserta','nama_pertandingan','pencapaian'];
    icons.forEach(i => document.getElementById(`icon-${i}`)?.classList.replace('text-white','text-muted'));
    const activeIcon = document.getElementById(`icon-${col}`);
    if(activeIcon) {
        activeIcon.classList.replace('text-muted','text-white');
        activeIcon.classList.remove('opacity-25');
        activeIcon.className = `fas fa-sort-${sortState.direction === 'asc' ? 'up' : 'down'} ms-1 text-white`;
    }
};
window.handlePencapaianSearch = function() { window.renderPencapaianTable(); };

// CRUD Operations
window.openEditPencapaian = function(id) {
    const item = pencapaianList.find(i => i.id === id);
    if(!item) return;
    
    document.getElementById('editIdPencapaian').value = id;
    document.getElementById('editJenisRekod').value = item.jenis_rekod;
    document.getElementById('editNamaSekolah').value = item.kod_sekolah;
    document.getElementById('editInputNama').value = item.nama_peserta;
    document.getElementById('editInputProgram').value = item.nama_pertandingan;
    document.getElementById('editInputPencapaian').value = item.pencapaian;
    document.getElementById('editInputLink').value = item.pautan_bukti;
    
    const divJawatan = document.getElementById('divEditJawatan');
    const divPenyedia = document.getElementById('divEditPenyedia');
    const rowPeringkat = document.getElementById('rowEditPeringkat');

    if(item.kategori === 'GURU') {
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
    
    new bootstrap.Modal(document.getElementById('modalEditPencapaian')).show();
};

window.simpanEditPencapaian = async function() {
    const id = document.getElementById('editIdPencapaian').value;
    const jenis = document.getElementById('editJenisRekod').value;
    
    const payload = {
        nama_peserta: document.getElementById('editInputNama').value.toUpperCase(),
        nama_pertandingan: document.getElementById('editInputProgram').value.toUpperCase(),
        pencapaian: document.getElementById('editInputPencapaian').value.toUpperCase(),
        pautan_bukti: document.getElementById('editInputLink').value
    };
    
    if(!document.getElementById('divEditJawatan').classList.contains('hidden')) {
        payload.jawatan = document.getElementById('editInputJawatan').value;
    }

    if (jenis === 'PENSIJILAN') {
        payload.penyedia = document.getElementById('editInputPenyedia').value;
    } else {
        payload.peringkat = document.getElementById('editInputPeringkat').value;
        payload.tahun = parseInt(document.getElementById('editInputTahun').value);
    }

    toggleLoading(true);
    try {
        await AchievementService.update(id, payload);
        toggleLoading(false);
        bootstrap.Modal.getInstance(document.getElementById('modalEditPencapaian')).hide();
        Swal.fire('Berjaya', 'Data dikemaskini.', 'success').then(() => window.loadMasterPencapaian());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal mengemaskini.', 'error');
    }
};

window.hapusPencapaianAdmin = async function(id) {
    Swal.fire({ title: 'Padam?', text: "Tindakan ini kekal.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire('Dipadam', '', 'success').then(() => window.loadMasterPencapaian());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

// PPD (M030) Functions
window.openModalPPD = function() { new bootstrap.Modal(document.getElementById('modalRekodPPD')).show(); };

window.toggleKategoriPPD = function() {
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
};

window.toggleJenisPencapaianPPD = function() {
    const isPensijilan = document.getElementById('radPpdPensijilan').checked;
    document.getElementById('ppdInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';
    
    document.getElementById('divPpdPenyedia').classList.toggle('hidden', !isPensijilan);
    document.getElementById('rowPpdPeringkat').classList.toggle('hidden', isPensijilan);
    document.getElementById('divPpdTahunOnly').classList.toggle('hidden', !isPensijilan);
    
    const lblProg = document.getElementById('lblPpdProgram');
    const inpProg = document.getElementById('ppdInputProgram');
    const lblPenc = document.getElementById('lblPpdPencapaian');
    const inpPenc = document.getElementById('ppdInputPencapaian');
    
    if (isPensijilan) {
        lblProg.innerText = "NAMA SIJIL / PROGRAM";
        inpProg.placeholder = "Contoh: GOOGLE CERTIFIED EDUCATOR L1";
        lblPenc.innerText = "TAHAP / SKOR / BAND";
        inpPenc.placeholder = "Contoh: LULUS / BAND C2";
    } else {
        lblProg.innerText = "NAMA PERTANDINGAN";
        inpProg.placeholder = "Contoh: DIGITAL COMPETENCY 2025";
        lblPenc.innerText = "PENCAPAIAN";
        inpPenc.placeholder = "Contoh: JOHAN / EMAS";
    }
};

window.simpanPencapaianPPD = async function() {
    const btn = document.querySelector('#formPencapaianPPD button[type="submit"]');
    const radKategori = document.querySelector('input[name="radKatPPD"]:checked').value;
    const jenisRekod = document.getElementById('ppdInputJenisRekod').value;
    const nama = document.getElementById('ppdInputNama').value.trim().toUpperCase();
    
    let tahun = 2024;
    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';
    
    if (jenisRekod === 'PENSIJILAN') {
        penyedia = document.getElementById('ppdInputPenyedia').value;
        peringkat = 'ANTARABANGSA';
        tahun = document.getElementById('ppdInputTahun2').value;
    } else {
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
    toggleLoading(true);

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

        await AchievementService.create(payload);
        
        toggleLoading(false);
        if(btn) btn.disabled = false;
        
        bootstrap.Modal.getInstance(document.getElementById('modalRekodPPD')).hide();
        document.getElementById('formPencapaianPPD').reset();
        
        Swal.fire('Berjaya', 'Rekod PPD Disimpan.', 'success').then(() => window.loadMasterPencapaian());
    } catch(e) {
        toggleLoading(false);
        if(btn) btn.disabled = false;
        Swal.fire('Ralat', 'Gagal simpan rekod.', 'error');
    }
};

// --- NEW EXPORT FUNCTION ---
window.eksportPencapaian = function() {
    if (!currentPencapaianFiltered || currentPencapaianFiltered.length === 0) {
        Swal.fire('Tiada Data', 'Tiada data untuk dieksport pada paparan semasa.', 'info');
        return;
    }

    let csvContent = "BIL,KOD,NAMA SEKOLAH,KATEGORI,PESERTA,JAWATAN,PROGRAM,PERINGKAT,PENCAPAIAN,TAHUN,PAUTAN BUKTI\n";

    currentPencapaianFiltered.forEach((i, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = "PPD ALOR GAJAH";
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        let row = [
            index + 1,
            clean(i.kod_sekolah),
            clean(namaSekolah),
            clean(i.kategori),
            clean(i.nama_peserta),
            clean(i.jawatan || '-'),
            clean(i.nama_pertandingan),
            clean(i.peringkat || '-'),
            clean(i.pencapaian),
            i.tahun,
            clean(i.pautan_bukti)
        ];
        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Laporan_Pencapaian_SMPID_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};