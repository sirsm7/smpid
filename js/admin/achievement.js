/**
 * ADMIN MODULE: ACHIEVEMENT (PRO WEB CASTER FULL EDITION - V1.9)
 * Menguruskan rekod pencapaian dengan kawalan integriti data penuh.
 * --- UPDATE V1.9 ---
 * 1. Bug Fix: Memperbaiki isu Dropdown Tahun tidak di-reset apabila butang RESET ditekan.
 * 2. Sync Fix: Menyelaraskan kad statistik (Kategori) dengan dropdown secara dua hala.
 */

import { AchievementService } from '../services/achievement.service.js';
import { toggleLoading } from '../core/helpers.js';
import { populateDropdown } from '../config/dropdowns.js';

// --- STATE MANAGEMENT ---
let pencapaianList = [];
let currentPencapaianFiltered = []; 
let currentCardFilter = 'ALL';
let currentJawatanFilter = 'ALL';
let currentKategoriFilter = 'ALL'; 
let sortState = { column: 'created_at', direction: 'desc' };

// Cache untuk senarai nama program unik bagi tujuan penyeragaman
let standardizationList = []; 
let filteredStandardizationList = [];

// --- INITIALIZATION ---

/**
 * Mengisi dropdown tahun di bahagian filter utama.
 */
window.populateTahunFilter = async function() {
    const select = document.getElementById('filterTahunPencapaian');
    if (!select) return;
    try {
        const years = await AchievementService.getAvailableYears();
        // Standardized Text
        select.innerHTML = '<option value="ALL">SEMUA TAHUN</option>';
        years.forEach(y => {
            select.innerHTML += `<option value="${y}">TAHUN ${y}</option>`;
        });
        window.loadMasterPencapaian();
    } catch (e) { 
        console.error("[Achievement] Gagal muat tahun:", e); 
    }
};

/**
 * Memuatkan data induk pencapaian dari database.
 */
window.loadMasterPencapaian = async function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if(!tbody) return;
    
    // Tunjuk loading hanya jika data kosong untuk elak kelipan visual (flicker)
    if (pencapaianList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10"><i class="fas fa-circle-notch fa-spin text-brand-500 text-2xl"></i></td></tr>`;
    }
    
    const tahun = document.getElementById('filterTahunPencapaian').value;
    
    try {
        pencapaianList = await AchievementService.getAll(tahun);
        populateSekolahFilter(pencapaianList);
        window.renderPencapaianTable();
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red-500 font-bold p-4">Gagal memuatkan data dari pangkalan data.</td></tr>`;
    }
};

/**
 * Mengisi dropdown senarai sekolah berdasarkan data yang ada.
 */
function populateSekolahFilter(data) {
    const select = document.getElementById('filterSekolahPencapaian');
    if (!select) return;
    const seen = new Set();
    const oldVal = select.value; 
    
    select.innerHTML = '<option value="ALL">SEMUA SEKOLAH</option>';
    
    // Susun sekolah (PPD di atas, kemudian ikut nama)
    const sortedData = [...data].sort((a, b) => {
        if (a.kod_sekolah === 'M030') return -1;
        if (b.kod_sekolah === 'M030') return 1;
        
        let nameA = a.kod_sekolah;
        let nameB = b.kod_sekolah;
        
        if(window.globalDashboardData) {
            const sA = window.globalDashboardData.find(x => x.kod_sekolah === a.kod_sekolah);
            const sB = window.globalDashboardData.find(x => x.kod_sekolah === b.kod_sekolah);
            if(sA) nameA = sA.nama_sekolah;
            if(sB) nameB = sB.nama_sekolah;
        }
        
        return nameA.localeCompare(nameB);
    });

    sortedData.forEach(i => {
        if(!seen.has(i.kod_sekolah)) {
            let label = i.kod_sekolah;
            if (i.kod_sekolah === 'M030') label = "PPD ALOR GAJAH (M030)";
            else if(window.globalDashboardData) {
                const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
                if(s) label = `${s.nama_sekolah} (${i.kod_sekolah})`;
            }
            const count = data.filter(d => d.kod_sekolah === i.kod_sekolah).length;
            select.innerHTML += `<option value="${i.kod_sekolah}">${label} (${count})</option>`;
            seen.add(i.kod_sekolah);
        }
    });
    
    // Kekalkan pilihan lama jika masih relevan
    if(seen.has(oldVal)) select.value = oldVal;
    else select.value = 'ALL';
}

// --- RENDERING LOGIC ---

/**
 * Fungsi utama untuk render jadual berdasarkan tapisan semasa.
 */
window.renderPencapaianTable = function() {
    const tbody = document.getElementById('tbodyPencapaianMaster');
    if(!tbody) return;
    
    // FIX V1.8: Baca nilai dari dropdown UI untuk update state. Membenarkan carian/filter berfungsi.
    const elKat = document.getElementById('filterKategoriPencapaian');
    if(elKat) {
        currentKategoriFilter = elKat.value;
    }

    const katFilter = currentKategoriFilter;
    const sekFilter = document.getElementById('filterSekolahPencapaian').value;
    const jenisFilter = document.getElementById('filterJenisPencapaian').value; 
    const search = document.getElementById('searchPencapaianInput').value.toUpperCase();

    let data = pencapaianList.filter(i => {
        // Filter Dropdowns
        if(sekFilter !== 'ALL' && i.kod_sekolah !== sekFilter) return false;
        if(katFilter !== 'ALL' && i.kategori !== katFilter) return false;
        if(jenisFilter !== 'ALL' && i.jenis_rekod !== jenisFilter) return false; 
        
        // Carian Teks
        if(search) {
            let namaSekolah = (i.kod_sekolah === 'M030') ? 'PPD ALOR GAJAH' : 
                (window.globalDashboardData?.find(s => s.kod_sekolah === i.kod_sekolah)?.nama_sekolah || '');
            const searchTarget = `${i.kod_sekolah} ${namaSekolah} ${i.nama_peserta} ${i.nama_pertandingan}`.toUpperCase();
            if (!searchTarget.includes(search)) return false;
        }
        
        // Filter Kad (Peringkat/Provider)
        if(currentCardFilter === 'KEBANGSAAN' && i.peringkat !== 'KEBANGSAAN') return false;
        if(currentCardFilter === 'ANTARABANGSA' && !['ANTARABANGSA'].includes(i.peringkat) && i.jenis_rekod !== 'PENSIJILAN') return false;
        if(['GOOGLE','APPLE','MICROSOFT'].includes(currentCardFilter) && i.penyedia !== currentCardFilter) return false;
        if(currentCardFilter === 'LAIN-LAIN' && (i.jenis_rekod !== 'PENSIJILAN' || i.penyedia !== 'LAIN-LAIN')) return false;
        
        // Filter Jawatan
        if(currentJawatanFilter !== 'ALL' && i.jawatan !== currentJawatanFilter) return false;

        return true;
    });

    updateStats(data);
    updateCloud(data); 

    // Sorting
    data.sort((a,b) => {
        let valA = a[sortState.column] || '';
        let valB = b[sortState.column] || '';
        if (sortState.column === 'nama_sekolah') valA = a.kod_sekolah; 
        if (sortState.direction === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    });

    currentPencapaianFiltered = data;
    renderTopSchools(data);

    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400 font-medium">Tiada rekod ditemui untuk kriteria ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(i => {
        let namaSekolah = i.kod_sekolah;
        if(i.kod_sekolah === 'M030') namaSekolah = `<span class="text-indigo-600 font-black">PPD ALOR GAJAH</span>`;
        else if(window.globalDashboardData) {
            const s = window.globalDashboardData.find(x => x.kod_sekolah === i.kod_sekolah);
            if(s) namaSekolah = s.nama_sekolah;
        }

        let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
        if (i.kategori === 'MURID') badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
        else if (i.kategori === 'GURU') badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
        else if (i.kategori === 'SEKOLAH') badgeClass = 'bg-green-100 text-green-700 border-green-200';
        else if (i.kategori === 'PEGAWAI') badgeClass = 'bg-slate-800 text-white border-slate-700';
        else if (i.kategori === 'PPD') badgeClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';

        let jenisBadge = '';
        if (i.jenis_rekod === 'PENSIJILAN') {
            jenisBadge = `<span class="bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black px-1 rounded mr-1">SIJIL</span>`;
        } else {
            jenisBadge = `<span class="bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-black px-1 rounded mr-1">PROG</span>`;
        }

        return `<tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
            <td class="px-4 py-4 font-mono text-xs font-bold text-slate-400 whitespace-nowrap">${i.kod_sekolah}</td>
            <td class="px-4 py-4 text-xs font-semibold text-slate-700 leading-snug whitespace-normal break-words">${namaSekolah}</td>
            <td class="px-4 py-4 text-center whitespace-nowrap"><span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${i.kategori}</span></td>
            <td class="px-4 py-4 whitespace-normal break-words">
                <div class="font-bold text-slate-800 text-sm mb-0.5">${i.nama_peserta}</div>
                ${i.jawatan ? `<span class="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">${i.jawatan}</span>` : ''}
            </td>
            <td class="px-4 py-4 whitespace-normal break-words">
                <div class="mb-1">${jenisBadge}</div>
                <div class="text-brand-600 text-xs font-bold leading-tight">${i.nama_pertandingan}</div>
            </td>
            <td class="px-4 py-4 text-center font-black text-slate-700 text-xs whitespace-nowrap bg-slate-50/50">${i.pencapaian}</td>
            <td class="px-4 py-4 text-center whitespace-nowrap"><a href="${i.pautan_bukti}" target="_blank" class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition" title="Lihat Bukti"><i class="fas fa-link"></i></a></td>
            <td class="px-4 py-4 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-1">
                    <button onclick="openEditPencapaian(${i.id})" class="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="hapusPencapaianAdmin(${i.id})" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition" title="Padam"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
};

/**
 * Kemaskini visual kad statistik dan highlight filter yang aktif.
 */
function updateStats(data) {
    const categories = ['MURID', 'GURU', 'SEKOLAH', 'PEGAWAI', 'PPD'];
    
    categories.forEach((cat) => {
        const el = document.getElementById(`statTotal${cat.charAt(0) + cat.slice(1).toLowerCase()}`);
        const card = document.getElementById(`cardStat-${cat}`);
        
        if(el) el.innerText = data.filter(i => i.kategori === cat).length;
        
        if(card) {
            const isActive = currentKategoriFilter === cat;
            
            // RESET & RE-APPLY CLASSES SURGICALLY
            // Gunakan array untuk elak 'InvalidCharacterError' pada classList.add
            let classes = ["p-3", "rounded-xl", "border", "cursor-pointer", "transition-all"];
            
            if (cat === 'MURID') {
                classes.push(...(isActive ? ["bg-blue-600", "border-blue-600", "shadow-md", "scale-105"] : ["bg-blue-50", "border-blue-100", "hover:bg-blue-100"]));
                card.className = classes.join(' ');
                card.querySelector('span').className = isActive ? 'text-[10px] font-black text-white uppercase tracking-widest' : 'text-[10px] font-black text-blue-600 uppercase tracking-widest';
                card.querySelector('h4').className = isActive ? 'text-xl font-black text-white' : 'text-xl font-black text-blue-800';
            }
            else if (cat === 'GURU') {
                classes.push(...(isActive ? ["bg-amber-500", "border-amber-500", "shadow-md", "scale-105"] : ["bg-amber-50", "border-amber-100", "hover:bg-amber-100"]));
                card.className = classes.join(' ');
                card.querySelector('span').className = isActive ? 'text-[10px] font-black text-white uppercase tracking-widest' : 'text-[10px] font-black text-amber-600 uppercase tracking-widest';
                card.querySelector('h4').className = isActive ? 'text-xl font-black text-white' : 'text-xl font-black text-amber-800';
            }
            else if (cat === 'SEKOLAH') {
                // FIXED CONTRAST: Teks hijau lebih gelap (text-green-700/800)
                classes.push(...(isActive ? ["bg-green-600", "border-green-600", "shadow-md", "scale-105"] : ["bg-green-50", "border-green-100", "hover:bg-green-100"]));
                card.className = classes.join(' ');
                card.querySelector('span').className = isActive ? 'text-[10px] font-black text-white uppercase tracking-widest' : 'text-[10px] font-black text-green-700 uppercase tracking-widest';
                card.querySelector('h4').className = isActive ? 'text-xl font-black text-white' : 'text-xl font-black text-green-800';
            }
            else if (cat === 'PEGAWAI') {
                classes.push(...(isActive ? ["bg-slate-800", "border-slate-800", "shadow-md", "scale-105"] : ["bg-slate-50", "border-slate-200", "hover:bg-slate-100"]));
                card.className = classes.join(' ');
                card.querySelector('span').className = isActive ? 'text-[10px] font-black text-white uppercase tracking-widest' : 'text-[10px] font-black text-slate-600 uppercase tracking-widest';
                card.querySelector('h4').className = isActive ? 'text-xl font-black text-white' : 'text-xl font-black text-slate-800';
            }
            else if (cat === 'PPD') {
                classes.push(...(isActive ? ["bg-indigo-600", "border-indigo-600", "shadow-md", "scale-105"] : ["bg-indigo-50", "border-indigo-100", "hover:bg-indigo-100"]));
                card.className = classes.join(' ');
                card.querySelector('span').className = isActive ? 'text-[10px] font-black text-white uppercase tracking-widest' : 'text-[10px] font-black text-indigo-600 uppercase tracking-widest';
                card.querySelector('h4').className = isActive ? 'text-xl font-black text-white' : 'text-xl font-black text-indigo-800';
            }
        }
    });
    
    // Update Counts for Special Cards (National/International/Providers)
    const setTxt = (id, count) => {
        const el = document.getElementById(id);
        if(el) el.innerText = count;
    };

    setTxt('statKebangsaan', data.filter(i => i.peringkat === 'KEBANGSAAN').length);
    setTxt('statAntarabangsa', data.filter(i => i.peringkat === 'ANTARABANGSA' || i.jenis_rekod === 'PENSIJILAN').length);
    
    const pensijilan = data.filter(i => i.jenis_rekod === 'PENSIJILAN');
    setTxt('statGoogle', pensijilan.filter(i => i.penyedia === 'GOOGLE').length);
    setTxt('statApple', pensijilan.filter(i => i.penyedia === 'APPLE').length);
    setTxt('statMicrosoft', pensijilan.filter(i => i.penyedia === 'MICROSOFT').length);
    setTxt('statLain', pensijilan.filter(i => i.penyedia === 'LAIN-LAIN').length);
    
    // Highlight Active Special Cards
    const specialCards = ['KEBANGSAAN', 'ANTARABANGSA', 'GOOGLE', 'APPLE', 'MICROSOFT', 'LAIN-LAIN'];
    specialCards.forEach(card => {
        const el = document.getElementById(`card-${card}`);
        if(el) {
            el.classList.remove('ring-4', 'ring-offset-2', 'ring-indigo-400', 'shadow-xl', 'scale-[1.03]', 'z-10', 'opacity-60');
            if(card === currentCardFilter) {
                el.classList.add('ring-4', 'ring-offset-2', 'ring-indigo-400', 'shadow-xl', 'scale-[1.03]', 'z-10');
            } else if (currentCardFilter !== 'ALL') {
                el.classList.add('opacity-60');
            }
        }
    });
}

/**
 * Menjana awan kata (Word Cloud) bagi jawatan guru secara dinamik.
 */
function updateCloud(data) {
    const container = document.getElementById('jawatanCloudContainer');
    const wrapper = document.getElementById('jawatanCloudWrapper');
    if (!container) return;

    const guruData = data.filter(i => i.kategori === 'GURU' && i.jawatan);
    
    if(guruData.length === 0) {
        if(wrapper) wrapper.classList.add('hidden');
        return;
    }
    
    if(wrapper) wrapper.classList.remove('hidden');
    const counts = {};
    let maxCount = 0;
    
    guruData.forEach(i => {
        const j = i.jawatan.trim();
        counts[j] = (counts[j] || 0) + 1;
        if(counts[j] > maxCount) maxCount = counts[j];
    });
    
    container.innerHTML = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([j, c]) => {
            const isActive = currentJawatanFilter === j;
            let sizeClass = "text-[10px]";
            if(c > 2) sizeClass = "text-[11px] font-bold";
            if(c > 5) sizeClass = "text-[12px] font-black";

            return `
                <div onclick="filterPencapaianByJawatan('${j}')" 
                     class="inline-flex items-center px-3 py-1 rounded-full border cursor-pointer transition-all m-1 shadow-sm
                            ${isActive ? 'bg-indigo-600 text-white border-indigo-600 scale-105 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}">
                    <span class="${sizeClass}">${j}</span>
                    <span class="ml-2 bg-slate-100 text-slate-400 px-1.5 rounded-full text-[9px] font-bold ${isActive ? 'bg-white/20 text-white' : ''}">${c}</span>
                </div>
            `;
        }).join('');
}

/**
 * Render senarai 5 sekolah penyumbang data tertinggi.
 */
function renderTopSchools(data) {
    const table = document.getElementById('tableTopContributors');
    const badge = document.getElementById('totalRecordsBadge');
    if(badge) badge.innerText = `${data.length} Rekod`;
    if(!table) return;
    
    const schoolCounts = {};
    data.forEach(i => {
        if(i.kod_sekolah !== 'M030') {
            schoolCounts[i.kod_sekolah] = (schoolCounts[i.kod_sekolah] || 0) + 1;
        }
    });
    
    const sorted = Object.entries(schoolCounts).sort(([,a], [,b]) => b - a).slice(0, 5);
    
    if(sorted.length === 0) {
        table.innerHTML = `<tr><td class="text-center p-4 text-slate-400 text-xs italic">Tiada data sekolah.</td></tr>`;
        return;
    }
    
    table.innerHTML = sorted.map(([kod, count], idx) => {
        let nama = kod;
        const s = window.globalDashboardData?.find(x => x.kod_sekolah === kod);
        if(s) nama = s.nama_sekolah;
        
        return `<tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0 cursor-pointer group" onclick="filterBySchoolFromTop5('${kod}')">
            <td class="p-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center text-[10px] font-black transition-colors">${idx + 1}</div>
                        <div>
                            <div class="text-xs font-black text-slate-800 leading-tight whitespace-normal" title="${nama}">${nama}</div>
                            <div class="text-[9px] font-mono text-slate-400 font-bold">${kod}</div>
                        </div>
                    </div>
                    <span class="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">${count}</span>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// --- GLOBAL EXPORTS (WITH TOGGLE LOGIC) ---

window.filterByKategori = function(k) { 
    // TOGGLE LOGIC: Klik semula untuk reset ke 'ALL'
    currentKategoriFilter = (currentKategoriFilter === k) ? 'ALL' : k;
    currentJawatanFilter = 'ALL'; 

    // FIX V1.8: Sinkronisasi dropdown secara manual apabila klik dari kad
    const elKat = document.getElementById('filterKategoriPencapaian');
    if(elKat) elKat.value = currentKategoriFilter;

    window.renderPencapaianTable(); 
};

window.filterByCard = function(c) { 
    // TOGGLE LOGIC: Klik semula untuk reset ke 'ALL'
    currentCardFilter = (currentCardFilter === c) ? 'ALL' : c; 
    window.renderPencapaianTable(); 
};

window.filterPencapaianByJawatan = function(j) { 
    // TOGGLE LOGIC: Klik semula untuk reset ke 'ALL'
    currentJawatanFilter = (currentJawatanFilter === j) ? 'ALL' : j; 
    
    const btnReset = document.getElementById('btnResetJawatan');
    if(btnReset) {
        if (currentJawatanFilter !== 'ALL') btnReset.classList.remove('hidden');
        else btnReset.classList.add('hidden');
    }
    
    window.renderPencapaianTable(); 
};

window.filterBySchoolFromTop5 = function(kod) { 
    const el = document.getElementById('filterSekolahPencapaian');
    if(el) {
        // Toggle school filter
        if (el.value === kod) el.value = 'ALL';
        else el.value = kod;
        window.renderPencapaianTable();
    }
};

/**
 * Reset semua tapisan kepada keadaan asal.
 */
window.resetPencapaianFilters = function() { 
    currentCardFilter = 'ALL'; 
    currentJawatanFilter = 'ALL'; 
    currentKategoriFilter = 'ALL';
    document.getElementById('searchPencapaianInput').value = '';
    
    const elSek = document.getElementById('filterSekolahPencapaian');
    if(elSek) elSek.value = 'ALL';

    const elKat = document.getElementById('filterKategoriPencapaian');
    if(elKat) elKat.value = 'ALL'; // FIX V1.8
    
    const elJenis = document.getElementById('filterJenisPencapaian');
    if(elJenis) elJenis.value = 'ALL';

    // FIX V1.9: Reset dropdown tahun kepada default
    const elTahun = document.getElementById('filterTahunPencapaian');
    if(elTahun) elTahun.value = 'ALL';
    
    window.loadMasterPencapaian();
    Swal.fire({ icon: 'success', title: 'Tapis Direset', toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
};

window.handleSort = function(col) {
    if(sortState.column === col) sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    else { sortState.column = col; sortState.direction = 'asc'; }
    window.renderPencapaianTable();
};

window.handlePencapaianSearch = function() { 
    window.renderPencapaianTable(); 
};

// --- CRUD OPERATIONS ---

window.openEditPencapaian = function(id) {
    const item = pencapaianList.find(i => i.id === id);
    if(!item) return;

    // Standardisasi Dropdown Modal Edit
    populateDropdown('editInputJawatan', 'JAWATAN', item.jawatan);
    populateDropdown('editInputPeringkat', 'PERINGKAT', item.peringkat);
    populateDropdown('editInputPenyedia', 'PENYEDIA', item.penyedia);
    populateDropdown('editInputTahun', 'TAHUN', item.tahun); 
    
    document.getElementById('editIdPencapaian').value = id;
    document.getElementById('editNamaSekolah').value = item.kod_sekolah;
    document.getElementById('editInputNama').value = item.nama_peserta;
    document.getElementById('editInputProgram').value = item.nama_pertandingan;
    document.getElementById('editInputPencapaian').value = item.pencapaian;
    document.getElementById('editInputLink').value = item.pautan_bukti;
    
    if (item.jenis_rekod === 'PENSIJILAN') {
        document.getElementById('editRadioPensijilan').checked = true;
    } else {
        document.getElementById('editRadioPertandingan').checked = true;
    }

    const divJawatan = document.getElementById('divEditJawatan');
    if(item.kategori === 'GURU') {
        divJawatan.classList.remove('hidden');
    } else {
        divJawatan.classList.add('hidden');
    }
    
    window.toggleEditJenis();
    document.getElementById('modalEditPencapaian').classList.remove('hidden');
};

window.toggleEditJenis = function() {
    const jenisInput = document.querySelector('input[name="editRadioJenis"]:checked');
    if(!jenisInput) return;
    const jenis = jenisInput.value;
    
    const divPenyedia = document.getElementById('divEditPenyedia');
    const colPeringkat = document.getElementById('divEditColPeringkat');

    if (jenis === 'PENSIJILAN') {
        if(divPenyedia) divPenyedia.classList.remove('hidden');
        if(colPeringkat) colPeringkat.classList.add('hidden'); 
    } else {
        if(divPenyedia) divPenyedia.classList.add('hidden');
        if(colPeringkat) colPeringkat.classList.remove('hidden'); 
    }
};

window.simpanEditPencapaian = async function() {
    const id = document.getElementById('editIdPencapaian').value;
    const jenisInput = document.querySelector('input[name="editRadioJenis"]:checked');
    if(!jenisInput) return;
    const jenis = jenisInput.value;
    
    const payload = {
        nama_peserta: document.getElementById('editInputNama').value.toUpperCase(),
        nama_pertandingan: document.getElementById('editInputProgram').value.toUpperCase(),
        pencapaian: document.getElementById('editInputPencapaian').value.toUpperCase(),
        pautan_bukti: document.getElementById('editInputLink').value,
        tahun: parseInt(document.getElementById('editInputTahun').value),
        jenis_rekod: jenis
    };
    
    if(!document.getElementById('divEditJawatan').classList.contains('hidden')) {
        payload.jawatan = document.getElementById('editInputJawatan').value;
    }

    if (jenis === 'PENSIJILAN') {
        payload.penyedia = document.getElementById('editInputPenyedia').value;
        payload.peringkat = 'ANTARABANGSA'; 
    } else {
        payload.peringkat = document.getElementById('editInputPeringkat').value;
    }

    toggleLoading(true);
    try {
        await AchievementService.update(id, payload);
        toggleLoading(false);
        document.getElementById('modalEditPencapaian').classList.add('hidden');
        Swal.fire({ icon: 'success', title: 'Tersimpan', text: 'Rekod telah dikemaskini.', timer: 1500, showConfirmButton: false }).then(() => window.loadMasterPencapaian());
    } catch (e) {
        toggleLoading(false);
        Swal.fire('Ralat Sistem', 'Gagal mengemaskini rekod.', 'error');
    }
};

window.openModalPPD = function() { 
    const currentYear = new Date().getFullYear().toString();
    populateDropdown('ppdInputPeringkat', 'PERINGKAT', 'KEBANGSAAN');
    populateDropdown('ppdInputPenyedia', 'PENYEDIA', 'LAIN-LAIN');
    populateDropdown('ppdInputTahun', 'TAHUN', currentYear); 

    document.getElementById('modalRekodPPD').classList.remove('hidden'); 
};

window.toggleKategoriPPD = function() {
    const isUnit = document.getElementById('radUnit').checked;
    const lbl = document.getElementById('lblPpdNamaPeserta');
    const inp = document.getElementById('ppdInputNama');
    if (isUnit) {
        if(lbl) lbl.innerText = "NAMA UNIT / SEKTOR";
        if(inp) inp.placeholder = "CONTOH: SEKTOR PEMBELAJARAN";
    } else {
        if(lbl) lbl.innerText = "NAMA PEGAWAI";
        if(inp) inp.placeholder = "TAIP NAMA PENUH...";
    }
};

window.toggleJenisPencapaianPPD = function() {
    const isPensijilan = document.getElementById('radPpdPensijilan').checked;
    document.getElementById('ppdInputJenisRekod').value = isPensijilan ? 'PENSIJILAN' : 'PERTANDINGAN';
    
    const divPenyedia = document.getElementById('divPpdPenyedia');
    const colPeringkat = document.getElementById('divPpdColPeringkat');
    
    const lblProg = document.getElementById('lblPpdProgram');
    const inpProg = document.getElementById('ppdInputProgram');
    const lblPenc = document.getElementById('lblPpdPencapaian');
    const inpPenc = document.getElementById('ppdInputPencapaian');
    
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
        if(inpProg) inpProg.placeholder = "CONTOH: DIGITAL COMPETENCY 2025";
        if(lblPenc) lblPenc.innerText = "PENCAPAIAN";
        if(inpPenc) inpPenc.placeholder = "CONTOH: JOHAN / EMAS";
    }
};

window.simpanPencapaianPPD = async function() {
    const radKategoriInput = document.querySelector('input[name="radKatPPD"]:checked');
    if(!radKategoriInput) return;
    const radKategori = radKategoriInput.value;
    
    const jenisRekod = document.getElementById('ppdInputJenisRekod').value;
    const nama = document.getElementById('ppdInputNama').value.trim().toUpperCase();
    
    let peringkat = 'KEBANGSAAN';
    let penyedia = 'LAIN-LAIN';
    const tahunVal = document.getElementById('ppdInputTahun').value;
    const tahun = parseInt(tahunVal);

    if (jenisRekod === 'PENSIJILAN') {
        penyedia = document.getElementById('ppdInputPenyedia').value;
        peringkat = 'ANTARABANGSA';
    } else {
        peringkat = document.getElementById('ppdInputPeringkat').value;
    }

    const program = document.getElementById('ppdInputProgram').value.trim().toUpperCase();
    const pencapaian = document.getElementById('ppdInputPencapaian').value.trim().toUpperCase();
    const link = document.getElementById('ppdInputLink').value.trim();

    if (!nama || !program || !pencapaian || !link || !tahun) {
        Swal.fire('Tidak Lengkap', 'Sila isi semua maklumat.', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        const payload = {
            kod_sekolah: 'M030',
            kategori: radKategori,
            nama_peserta: nama,
            nama_pertandingan: program,
            peringkat: peringkat,
            tahun: tahun,
            pencapaian: pencapaian,
            pautan_bukti: link,
            jenis_rekod: jenisRekod,
            penyedia: penyedia
        };

        await AchievementService.create(payload);
        toggleLoading(false);
        document.getElementById('modalRekodPPD').classList.add('hidden');
        document.getElementById('formPencapaianPPD').reset();
        
        Swal.fire('Berjaya', 'Rekod PPD telah disimpan.', 'success').then(() => window.loadMasterPencapaian());
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menyimpan rekod.', 'error');
    }
};

window.hapusPencapaianAdmin = async function(id) {
    Swal.fire({ 
        title: 'Padam Rekod?', 
        text: "Tindakan ini tidak boleh dikembalikan.", 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444', 
        confirmButtonText: 'Ya, Padam'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.delete(id);
                toggleLoading(false);
                Swal.fire({ icon: 'success', title: 'Dipadam', timer: 1000, showConfirmButton: false }).then(() => window.loadMasterPencapaian());
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

/**
 * Mengeksport data terapis ke format CSV.
 */
window.eksportPencapaian = function() {
    if (!currentPencapaianFiltered || currentPencapaianFiltered.length === 0) {
        Swal.fire('Tiada Data', 'Tiada rekod untuk dieksport.', 'info');
        return;
    }

    let csvContent = "BIL,KOD,NAMA SEKOLAH,JENIS REKOD,KATEGORI,PESERTA,JAWATAN,PROGRAM,PERINGKAT,PENCAPAIAN,TAHUN,PAUTAN BUKTI\n";

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
            clean(i.jenis_rekod), 
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

// --- DATA STANDARDIZATION LOGIC ---

window.refreshStandardizeUI = function() {
    const counts = {};
    standardizationList = [];
    filteredStandardizationList = [];

    pencapaianList.forEach(item => {
        const name = item.nama_pertandingan || "TIADA NAMA";
        counts[name] = (counts[name] || 0) + 1;
    });

    Object.keys(counts).sort().forEach(name => {
        standardizationList.push({ name: name, count: counts[name] });
    });

    filteredStandardizationList = standardizationList;
    
    const searchVal = document.getElementById('standardizeSearch').value;
    if (searchVal) {
        handleStandardizeSearch(searchVal);
    } else {
        renderStandardizeTable(filteredStandardizationList);
    }
}

window.openStandardizeModal = function() {
    document.getElementById('standardizeSearch').value = '';
    window.refreshStandardizeUI();
    document.getElementById('modalStandardize').classList.remove('hidden');
};

window.renderStandardizeTable = function(list) {
    const tbody = document.getElementById('tbodyStandardize');
    if (!tbody) return;
    
    if(list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-slate-400">Tiada padanan carian.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((item, index) => {
        const safeId = index; 
        const safeName = item.name.replace(/'/g, "\\'"); 

        return `
            <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <td class="text-center font-bold text-xs text-slate-300 p-4">${index + 1}</td>
                <td class="font-bold text-slate-800 text-xs w-1/3 p-4 leading-snug">${item.name}</td>
                <td class="text-center p-4">
                    <span class="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-indigo-100">
                        ${item.count} REKOD
                    </span>
                </td>
                <td class="p-4 w-1/3">
                    <input type="text" id="std-input-${safeId}" 
                           class="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs uppercase-input focus:border-indigo-500 outline-none bg-white" 
                           placeholder="Nama baharu..." 
                           value="${item.name.replace(/"/g, '&quot;')}"
                           oninput="this.value = this.value.toUpperCase()">
                </td>
                <td class="text-center p-4">
                    <button onclick="executeStandardization('${safeName}', 'std-input-${safeId}')" 
                            class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black shadow-sm transition transform active:scale-95">
                        <i class="fas fa-magic me-1"></i> SET
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

window.handleStandardizeSearch = function(val) {
    const term = val.toUpperCase().trim();
    if (!term) {
        filteredStandardizationList = standardizationList;
    } else {
        filteredStandardizationList = standardizationList.filter(item => item.name.toUpperCase().includes(term));
    }
    renderStandardizeTable(filteredStandardizationList);
};

window.executeStandardization = function(oldName, inputId) {
    const newName = document.getElementById(inputId).value.trim().toUpperCase();
    
    if (!newName) return Swal.fire('Ralat', 'Nama baharu kosong.', 'warning');
    if (newName === oldName) return Swal.fire('Tiada Perubahan', 'Nama sama dengan asal.', 'info');

    Swal.fire({
        title: 'Sahkan Penyeragaman?',
        html: `Menukar <b>"${oldName}"</b> kepada <br><b class="text-emerald-600">"${newName}"</b><br>untuk semua rekod berkaitan.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981', 
        confirmButtonText: 'Ya, Seragamkan!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await AchievementService.batchUpdateProgramName(oldName, newName);
                toggleLoading(false);
                await Swal.fire({ title: 'Berjaya!', text: 'Data telah diseragamkan.', icon: 'success', timer: 1500, showConfirmButton: false });
                await window.loadMasterPencapaian(); 
                window.refreshStandardizeUI(); 
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal mengemaskini data.', 'error');
            }
        }
    });
};