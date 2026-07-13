import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

// Menyimpan data mentah untuk tapisan silang (client-side cache) bagi melancarkan prestasi UI
let rawDataGuru = [];
let rawDataMurid = [];

// Menyimpan data yang TELAH ditapis untuk tujuan eksport CSV (Sync UI-State)
let filteredDataGuru = [];
let filteredDataMurid = [];

let mapKodOuGlobal = {};

/**
 * Memuatkan senarai permohonan DELIMa dari pangkalan data dan 
 * melaksanakan integrasi bersama jadual delima_data_sekolah untuk kod_ou
 * @param {string} kategori - 'GURU' atau 'MURID'
 * @param {boolean} forceRefresh - Paksa tarik data baharu dari Supabase
 */
window.loadSenaraiDelimaAdmin = async function(kategori, forceRefresh = true) {
    const db = getDatabaseClient();
    
    if (!db) {
        console.error("Gagal menyambung ke pangkalan data.");
        if (typeof Swal !== 'undefined') Swal.fire('Ralat Sistem', 'Pangkalan data tidak bersambung. Sila muat semula halaman.', 'error');
        return;
    }

    try {
        const tbodyId = kategori === 'GURU' ? 'tbodyAdminGuru' : 'tbodyAdminMurid';
        const tbody = document.getElementById(tbodyId);
        
        if (!tbody) return;

        // Dapatkan elemen filter UI
        const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
        const catatanFilterId = kategori === 'GURU' ? 'filterCatatanGuruAdmin' : 'filterCatatanMuridAdmin';
        const sekolahFilterId = kategori === 'GURU' ? 'filterSekolahGuruAdmin' : 'filterSekolahMuridAdmin';
        const lokasiFilterId = kategori === 'GURU' ? 'filterLokasiGuruAdmin' : 'filterLokasiMuridAdmin';
        
        const statusSelect = document.getElementById(statusFilterId);
        const catatanSelect = document.getElementById(catatanFilterId);
        const sekolahSelect = document.getElementById(sekolahFilterId);
        const lokasiSelect = document.getElementById(lokasiFilterId);

        let statusVal = statusSelect?.value || 'ALL';
        let catVal = catatanSelect?.value || 'ALL';
        let sekVal = sekolahSelect?.value || 'ALL';
        let lokVal = lokasiSelect?.value || 'ALL';

        let dataToProcess = kategori === 'GURU' ? rawDataGuru : rawDataMurid;

        // Tarik data baharu dari pangkalan data jika diarahkan (atau jika array kosong)
        if (forceRefresh || dataToProcess.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-circle-notch fa-spin mr-2"></i>Mengumpul dan menyegerak pangkalan data ${kategori}...</td></tr>`;

            const { data: delimaData, error: delimaError } = await db
                .from('smpid_delima_status')
                .select('*')
                .eq('kategori', kategori)
                .order('created_at', { ascending: false });

            if (delimaError) throw delimaError;

            let fetchedData = delimaData || [];

            // --- RBAC FILTERING ---
            const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
            const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

            if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
                const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
                validSchoolCodes.push(userKod); // Benarkan rekod PPD mereka sendiri jika wujud
                fetchedData = fetchedData.filter(item => validSchoolCodes.includes(item.kod_sekolah));
            }

            // Simpan dalam state aplikasi
            if (kategori === 'GURU') {
                rawDataGuru = fetchedData;
                dataToProcess = rawDataGuru;
            } else {
                rawDataMurid = fetchedData;
                dataToProcess = rawDataMurid;
            }

            // CROSS-QUERY: Tarik kod_ou dari delima_data_sekolah
            const unikKodSekolah = [...new Set(dataToProcess.map(item => item.kod_sekolah))];
            
            if (unikKodSekolah.length > 0) {
                const { data: sekolahData, error: sekolahError } = await db
                    .from('delima_data_sekolah')
                    .select('kod_sekolah, kod_ou')
                    .in('kod_sekolah', unikKodSekolah);
                
                if (!sekolahError && sekolahData) {
                    sekolahData.forEach(sek => {
                        mapKodOuGlobal[sek.kod_sekolah] = sek.kod_ou;
                    });
                }
            }
        }

        // =========================================================
        // SMART DYNAMIC CASCADING FILTERS LOGIC
        // =========================================================
        
        // 1. Pra-Tapisan data asas berdasarkan Status Semasa & Lokasi
        let preFilteredData = dataToProcess;
        
        if (statusVal !== 'ALL') {
            preFilteredData = preFilteredData.filter(item => item.status_proses === statusVal);
        }

        // Tapisan gabungan untuk Lokasi Asal dilaksanakan sebelum penjanaan dropdown
        if (lokVal !== 'ALL') {
            if (lokVal === 'DALAM NEGERI') {
                preFilteredData = preFilteredData.filter(item => item.nama && (item.nama.includes('(DALAM DAERAH)') || item.nama.includes('(LUAR DAERAH)')));
            } else if (lokVal === 'LUAR NEGERI') {
                preFilteredData = preFilteredData.filter(item => item.nama && item.nama.includes('(LUAR NEGERI)'));
            } else {
                preFilteredData = preFilteredData.filter(item => item.nama && item.nama.includes(`(${lokVal})`));
            }
        }

        if (catatanSelect && sekolahSelect) {
            
            // A. JANA DROPDOWN CATATAN (Berdasarkan preFilteredData)
            const uniqueCatatan = [...new Set(preFilteredData.map(item => item.catatan).filter(Boolean))].sort();
            
            let catatanHtml = '<option value="ALL">Semua Catatan</option>';
            uniqueCatatan.forEach(c => {
                catatanHtml += `<option value="${c}">${c}</option>`;
            });
            catatanSelect.innerHTML = catatanHtml;

            if (catVal !== 'ALL' && uniqueCatatan.includes(catVal)) {
                catatanSelect.value = catVal;
            } else {
                catVal = 'ALL';
                catatanSelect.value = 'ALL';
            }

            // B. JANA DROPDOWN SEKOLAH (Berdasarkan preFilteredData)
            const uniqueSekolah = [...new Set(preFilteredData.map(item => item.kod_sekolah).filter(Boolean))].sort();
            
            const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];
            let sekolahHtml = '<option value="ALL">Semua Sekolah</option>';
            
            uniqueSekolah.forEach(kod => {
                let namaSekolah = kod;
                if (senaraiKodPPD.includes(kod)) {
                    namaSekolah = APP_CONFIG.PPD_MAPPING[kod] ? `PPD ${APP_CONFIG.PPD_MAPPING[kod]}` : 'PEJABAT PENDIDIKAN DAERAH';
                } else if (window.globalDashboardData) {
                    const schoolMatch = window.globalDashboardData.find(s => s.kod_sekolah === kod);
                    if (schoolMatch) namaSekolah = `${schoolMatch.nama_sekolah}`;
                }
                sekolahHtml += `<option value="${kod}">${namaSekolah} (${kod})</option>`;
            });
            sekolahSelect.innerHTML = sekolahHtml;

            if (sekVal !== 'ALL' && uniqueSekolah.includes(sekVal)) {
                sekolahSelect.value = sekVal;
            } else {
                sekVal = 'ALL';
                sekolahSelect.value = 'ALL';
            }
        }

        // 2. Laksanakan Tapisan Jadual Akhir menggunakan parameter yang telah disahkan
        let filteredData = preFilteredData;

        if (sekVal !== 'ALL') {
            filteredData = filteredData.filter(item => item.kod_sekolah === sekVal);
        }
        if (catVal !== 'ALL') {
            filteredData = filteredData.filter(item => item.catatan === catVal);
        }

        // Simpan state tapisan penuh untuk kegunaan eksport CSV
        if (kategori === 'GURU') {
            filteredDataGuru = filteredData;
        } else {
            filteredDataMurid = filteredData;
        }

        // =========================================================
        // PROSES PAPARAN ANTARAMUKA (UI RENDER)
        // =========================================================

        const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
        const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);

        if (!filteredData || filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
            window.resetBulkState(kategori);
            
            // Sembunyikan butang Select All pada header jika tiada data
            if (selectAllCb) selectAllCb.classList.add('hidden');
            return;
        }

        // Tunjukkan Select All jika ada data (Tidak terhad pada status DALAM PROSES lagi)
        if (selectAllCb) selectAllCb.classList.remove('hidden');

        const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];
        let html = '';

        filteredData.forEach((item, index) => {
            const dateObj = new Date(item.created_at);
            const formatTarikh = dateObj.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            const formatMasa = dateObj.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
            
            // Nama Sekolah Dinamik
            let schoolName = item.kod_sekolah;
            if (senaraiKodPPD.includes(item.kod_sekolah)) {
                schoolName = APP_CONFIG.PPD_MAPPING[item.kod_sekolah] ? `PPD ${APP_CONFIG.PPD_MAPPING[item.kod_sekolah]}` : 'PEJABAT PENDIDIKAN DAERAH';
            } else if (window.globalDashboardData) {
                const schoolMatch = window.globalDashboardData.find(s => s.kod_sekolah === item.kod_sekolah);
                if (schoolMatch) schoolName = schoolMatch.nama_sekolah;
            }

            const kodOu = mapKodOuGlobal[item.kod_sekolah] || 'Tiada Kod OU';
            const paparKodSekolahGabungan = `${item.kod_sekolah} (${kodOu})`;

            let badgeStatus = '';
            let bgRow = 'hover:bg-slate-50/80';
            
            if (item.status_proses === 'DALAM PROSES') {
                badgeStatus = `<span class="bg-amber-100 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest"><i class="fas fa-clock mr-1"></i>PROSES</span>`;
            } else if (item.status_proses === 'SELESAI') {
                badgeStatus = `<span class="bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest"><i class="fas fa-check-double mr-1"></i>SELESAI</span>`;
                bgRow = 'bg-slate-50/50 hover:bg-slate-100 opacity-80 grayscale-[0.2]';
            }

            const actionButton = item.status_proses === 'DALAM PROSES'
                ? `<button onclick="kemaskiniStatusDelima('${item.id}', 'SELESAI', '${kategori}', this)" class="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md transform active:scale-95"><i class="fas fa-check-circle mr-1"></i>Tanda Selesai</button>`
                : `<button onclick="kemaskiniStatusDelima('${item.id}', 'DALAM PROSES', '${kategori}', this)" class="mt-3 w-full bg-white border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm transform active:scale-95"><i class="fas fa-undo mr-1"></i>Buka Semula</button>`;

            const deleteButton = `<button onclick="padamRekodDelima('${item.id}', '${kategori}')" class="mt-1.5 w-full bg-white border border-red-100 hover:bg-red-50 text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm"><i class="fas fa-trash-alt mr-1"></i>Padam</button>`;

            const isTarikMasuk = item.catatan === 'Berpindah MASUK ke sekolah ini';
            const colorTheme = kategori === 'GURU' ? 'blue' : 'cyan';
            
            const destinasiBadge = isTarikMasuk 
                ? `<br><span class="text-${colorTheme}-700 font-bold mt-2 block text-xs bg-${colorTheme}-50 p-2.5 rounded-lg border border-${colorTheme}-100 shadow-sm wrap-safe"><i class="fas fa-download mr-1.5 text-${colorTheme}-500"></i> Mohon Tarik Ke:<br><span class="text-[10px] text-slate-500 font-mono mt-1 block tracking-wider bg-white px-2 py-1 rounded inline-block wrap-safe break-all">OU: ${item.unit_organisasi_baharu || item.kod_sekolah}</span></span>` 
                : '';

            // SUNTIKAN ROW CHECKBOX UNTUK TINDAKAN PUKAL
            // KEMASKINI: Kotak semak kini dibuka untuk semua status, ditambah data-status untuk pengesanan pintar
            let checkboxHtml = `<input type="checkbox" class="cb-delima-${kategori} w-4 h-4 accent-${colorTheme}-600 cursor-pointer rounded mb-2" value="${item.id}" data-email="${item.id_delima || ''}" data-status="${item.status_proses}" onchange="checkBulkStatus('${kategori}')">`;

            html += `
                <tr class="${bgRow} border-b border-slate-100 transition-colors group">
                    <td class="px-6 py-5 text-center font-mono font-bold text-slate-400 text-xs align-top pt-6">
                        ${checkboxHtml}<br>${index + 1}
                    </td>
                    <td class="px-6 py-5 align-top">
                        <div class="font-bold text-slate-800 tracking-tight">${schoolName}</div>
                        <div class="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-indigo-700 bg-indigo-50 px-2 py-1 rounded mt-1.5 border border-indigo-100 shadow-sm">
                            <i class="fas fa-building text-indigo-400"></i> ${paparKodSekolahGabungan}
                        </div>
                        <div class="mt-3 p-3 bg-white border-2 border-slate-100 rounded-xl shadow-sm">
                            <span class="font-bold text-slate-700 block mb-1 text-xs uppercase"><i class="fas fa-user-circle text-slate-400 mr-1.5"></i>${item.nama}</span>
                            <div class="flex items-center gap-2 mt-1">
                                <div class="text-[10px] text-slate-500 font-mono font-bold bg-slate-50 px-2 py-1 rounded-md inline-block border border-slate-200 shadow-sm wrap-safe break-all">${item.id_delima || 'TIADA REKOD'}</div>
                                ${item.id_delima ? `<button onclick="window.salinIdDelimaAdmin('${item.id_delima}')" class="p-1.5 bg-${colorTheme}-50 text-${colorTheme}-600 rounded-md hover:bg-${colorTheme}-100 hover:text-${colorTheme}-800 transition-colors shadow-sm" title="Salin ID DELIMa"><i class="far fa-copy"></i></button>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-5 align-top">
                        <div class="text-xs font-bold text-slate-700 bg-sky-50 border-l-4 border-sky-400 p-3 rounded-r-xl shadow-sm mb-3 relative overflow-hidden">
                            <i class="fas fa-quote-right absolute right-2 bottom-2 text-3xl text-sky-500/10 z-0"></i>
                            <span class="block text-[9px] uppercase tracking-widest text-sky-600 mb-1 z-10 relative">Isu / Catatan Permohonan:</span>
                            <span class="z-10 relative">${item.catatan || '-'}</span>
                        </div>
                        ${destinasiBadge}
                        <div class="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-3">
                            <span class="bg-slate-100 px-2 py-1 rounded"><i class="fas fa-calendar-alt mr-1"></i> ${formatTarikh}</span>
                            <span class="bg-slate-100 px-2 py-1 rounded"><i class="fas fa-clock mr-1"></i> ${formatMasa}</span>
                        </div>
                    </td>
                    <td class="px-6 py-5 text-center align-top">
                        <div class="mb-3">${badgeStatus}</div>
                        ${actionButton}
                        ${deleteButton}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        window.resetBulkState(kategori);

    } catch (error) {
        console.error('Ralat Admin DELIMa (loadSenaraiDelimaAdmin):', error);
        Swal.fire({
            icon: 'error',
            title: 'Ralat Pangkalan Data',
            text: 'Gagal menarik data permohonan DELIMa atau Kod OU.',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'Tutup'
        });
    }
};

/**
 * ===================================================================
 * ENJIN TINDAKAN PUKAL (BULK ACTIONS)
 * ===================================================================
 */

// Menetapkan semula UI Kotak Semak dan Kumpulan Butang ke keadaan asal
window.resetBulkState = function(kategori) {
    const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
    const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);
    if (selectAllCb) selectAllCb.checked = false;
    window.checkBulkStatus(kategori);
};

// Mengawal Kotak Semak Utama (Select All)
window.toggleSelectAll = function(kategori, element) {
    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}`);
    checkboxes.forEach(cb => {
        cb.checked = element.checked;
    });
    window.checkBulkStatus(kategori);
};

// Menyemak jumlah pilihan dan mengaktifkan/menyahaktifkan butang pukal
window.checkBulkStatus = function(kategori) {
    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
    const count = checkboxes.length;
    const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
    
    const bulkContainer = document.getElementById(`bulkActions${capitalizedKategori}`);
    const btnSalin = document.getElementById(`btnSalinPukal${capitalizedKategori}`);
    const btnSelesai = document.getElementById(`btnSelesaiPukal${capitalizedKategori}`);
    const btnBukaSemula = document.getElementById(`btnBukaSemulaPukal${capitalizedKategori}`); // DOM baharu
    const btnEksport = document.getElementById(`btnEksportPukal${capitalizedKategori}`);
    const countSpan = document.getElementById(`countPukal${capitalizedKategori}`);

    // Pengesan status pintar
    let hasDalamProses = false;
    let hasSelesai = false;

    checkboxes.forEach(cb => {
        if (cb.dataset.status === 'DALAM PROSES') hasDalamProses = true;
        if (cb.dataset.status === 'SELESAI') hasSelesai = true;
    });

    // Kenal pasti status penapis (filter) semasa untuk UI pintar
    const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
    const currentFilter = document.getElementById(statusFilterId)?.value || 'ALL';

    if (count > 0) {
        if (bulkContainer) bulkContainer.classList.remove('hidden');
        if (btnSalin) btnSalin.disabled = false;
        if (btnEksport) btnEksport.disabled = false;
        if (countSpan) countSpan.innerText = count;

        // Kawalan spesifik butang mengikut status yang ditanda
        if (btnSelesai) btnSelesai.disabled = !hasDalamProses;
        if (btnBukaSemula) {
            btnBukaSemula.disabled = !hasSelesai;
            
            // [SUNTIKAN SURGICAL START] Sembunyikan "Buka Semula" jika penapis adalah "DALAM PROSES"
            if (currentFilter === 'DALAM PROSES') {
                btnBukaSemula.classList.add('hidden');
            } else {
                btnBukaSemula.classList.remove('hidden');
            }
            // [SUNTIKAN SURGICAL END]
        }
    } else {
        if (bulkContainer) bulkContainer.classList.add('hidden');
        if (btnSalin) btnSalin.disabled = true;
        if (btnSelesai) btnSelesai.disabled = true;
        if (btnEksport) btnEksport.disabled = true;
        if (countSpan) countSpan.innerText = '0';
        
        if (btnBukaSemula) {
            btnBukaSemula.disabled = true;
            
            // [SUNTIKAN SURGICAL START] Kekalkan logik sembunyi UI walaupun tiada data ditanda supaya antaramuka tidak kelip
            if (currentFilter === 'DALAM PROSES') {
                btnBukaSemula.classList.add('hidden');
            } else {
                btnBukaSemula.classList.remove('hidden');
            }
            // [SUNTIKAN SURGICAL END]
        }
        
        const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);
        if (selectAllCb) selectAllCb.checked = false;
    }
};

/**
 * EKSPORT CSV BERKELOMPOK BAHARU (Mengekstrak rekod yang ditandakan sahaja)
 */
window.eksportCsvPukal = function(kategori) {
    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
    if (checkboxes.length === 0) return;

    const selectedIds = Array.from(checkboxes).map(cb => cb.value);
    const dataPool = kategori === 'GURU' ? rawDataGuru : rawDataMurid;
    const recordsToExport = dataPool.filter(item => selectedIds.includes(String(item.id)));

    if (recordsToExport.length === 0) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Tiada Data', text: 'Tiada rekod sah untuk dieksport.', showConfirmButton: false, timer: 2000 });
        return;
    }

    let csvContent = "BIL,KOD SEKOLAH,KOD OU,NAMA,ID DELIMA,KATEGORI,CATATAN,STATUS PROSES,TARIKH MOHON\n";
    
    recordsToExport.forEach((item, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const kodOu = mapKodOuGlobal[item.kod_sekolah] || 'TIADA KOD OU';
        const tarikhStr = new Date(item.created_at).toLocaleDateString('ms-MY');
        
        let row = [
            index + 1,
            clean(item.kod_sekolah),
            clean(kodOu),
            clean(item.nama),
            clean(item.id_delima),
            clean(item.kategori),
            clean(item.catatan),
            clean(item.status_proses),
            clean(tarikhStr)
        ];
        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Eksport_ID_${kategori}_Terpilih_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({ 
        toast: true, position: 'top-end', icon: 'success', title: 'Berjaya Dieksport!', text: `${recordsToExport.length} rekod dimuat turun.`, showConfirmButton: false, timer: 2000, customClass: { popup: 'colored-toast' } 
    });
};

window.salinEmelPukal = function(kategori) {
    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
    let emails = [];
    
    checkboxes.forEach(cb => {
        const email = cb.getAttribute('data-email');
        if (email && email !== '-' && email.trim() !== '') {
            emails.push(email.trim());
        }
    });

    if (emails.length === 0) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Tiada Emel Sah', text: 'Pilihan anda tidak mengandungi emel yang sah.', showConfirmButton: false, timer: 2000 });
        return;
    }

    const textToCopy = emails.join('\n');

    const fallbackCopy = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            tunjukToastBerjaya();
        } catch (err) {
            console.error('Fallback copy gagal', err);
        }
        document.body.removeChild(textArea);
    };

    const tunjukToastBerjaya = () => {
        Swal.fire({
            toast: true, position: 'top-end', icon: 'success', title: 'Berjaya Disalin!', text: 'Senarai emel sedia ditampal di Excel (Satu lajur).',
            showConfirmButton: false, timer: 2000, customClass: { popup: 'colored-toast' }
        });
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).then(() => {
            tunjukToastBerjaya();
        }).catch(err => {
            fallbackCopy(textToCopy);
        });
    } else {
        fallbackCopy(textToCopy);
    }
};

// Mengemas kini berbilang rekod ke status SELESAI
window.tandaSelesaiPukal = async function(kategori) {
    const db = getDatabaseClient();
    if (!db) return;

    // Pastikan kita hanya ambil checkbox Dalam Proses yang bertanda sahaja
    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked[data-status="DALAM PROSES"]`);
    if (checkboxes.length === 0) return;

    const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
    const btnSelesai = document.getElementById(`btnSelesaiPukal${capitalizedKategori}`);
    const originalHtml = btnSelesai.innerHTML;

    btnSelesai.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i>Memproses...`;
    btnSelesai.disabled = true;

    const idsToUpdate = [];
    const rowsToRemove = [];

    checkboxes.forEach(cb => {
        idsToUpdate.push(cb.value);
        rowsToRemove.push(cb.closest('tr'));
    });

    try {
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: 'SELESAI' })
            .in('id', idsToUpdate);

        if (error) throw error;

        Swal.fire({
            toast: true, position: 'top-end', icon: 'success', title: 'Selesai Pukal!',
            text: `${idsToUpdate.length} permohonan dikemaskini.`, showConfirmButton: false, timer: 2000,
            customClass: { popup: 'colored-toast' }
        });

        // KEMASKINI CACHE: Jangan filter out rekod (nanti hilang dari memori), tukar sahaja statusnya
        let dataArray = kategori === 'GURU' ? rawDataGuru : rawDataMurid;
        idsToUpdate.forEach(id => {
            const index = dataArray.findIndex(item => String(item.id) === String(id));
            if (index !== -1) {
                dataArray[index].status_proses = 'SELESAI';
            }
        });

        const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
        const statusFilter = document.getElementById(statusFilterId)?.value || 'ALL';

        // Hanya hapuskan baris dan animasikan jika filter BUKAN "ALL"
        if (statusFilter !== 'ALL') {
            rowsToRemove.forEach(row => {
                row.style.transition = 'all 0.3s ease-out';
                row.style.opacity = '0';
                row.style.transform = 'translateX(20px)';
            });

            setTimeout(() => {
                let parentTbody = null;
                rowsToRemove.forEach(row => {
                    parentTbody = row.parentNode;
                    row.remove();
                });

                window.resetBulkState(kategori);

                if (parentTbody && parentTbody.children.length === 0) {
                    parentTbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
                }
            }, 300);
        } else {
            // Jika filter adalah ALL, muat semula jadual untuk kemaskini badge
            loadSenaraiDelimaAdmin(kategori, false);
        }

    } catch (error) {
        console.error('Ralat kemaskini pukal:', error);
        btnSelesai.innerHTML = originalHtml;
        btnSelesai.disabled = false;
        Swal.fire({
            toast: true, position: 'top-end', icon: 'error', title: 'Ralat Rangkaian',
            text: 'Gagal memproses tindakan pukal.', showConfirmButton: false, timer: 2500
        });
    }
};

// =========================================================
// FUNGSI BAHARU: BUKA SEMULA PUKAL
// =========================================================
window.bukaSemulaPukal = async function(kategori) {
    const db = getDatabaseClient();
    if (!db) return;

    // Pastikan kita hanya ambil checkbox Selesai yang bertanda sahaja
    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked[data-status="SELESAI"]`);
    if (checkboxes.length === 0) return;

    const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
    const btnBukaSemula = document.getElementById(`btnBukaSemulaPukal${capitalizedKategori}`);
    const originalHtml = btnBukaSemula ? btnBukaSemula.innerHTML : '<i class="fas fa-undo mr-1"></i>Buka Semula';

    if (btnBukaSemula) {
        btnBukaSemula.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i>Memproses...`;
        btnBukaSemula.disabled = true;
    }

    const idsToUpdate = [];
    const rowsToRemove = [];

    checkboxes.forEach(cb => {
        idsToUpdate.push(cb.value);
        rowsToRemove.push(cb.closest('tr'));
    });

    try {
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: 'DALAM PROSES' })
            .in('id', idsToUpdate);

        if (error) throw error;

        Swal.fire({
            toast: true, position: 'top-end', icon: 'success', title: 'Berjaya!',
            text: `${idsToUpdate.length} permohonan dibuka semula.`, showConfirmButton: false, timer: 2000,
            customClass: { popup: 'colored-toast' }
        });

        // KEMASKINI CACHE (Sync state)
        let dataArray = kategori === 'GURU' ? rawDataGuru : rawDataMurid;
        idsToUpdate.forEach(id => {
            const index = dataArray.findIndex(item => String(item.id) === String(id));
            if (index !== -1) {
                dataArray[index].status_proses = 'DALAM PROSES';
            }
        });

        const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
        const statusFilter = document.getElementById(statusFilterId)?.value || 'ALL';

        // Jika filter sekarang adalah SELESAI, animasikan pemadaman baris ke Dalam Proses
        if (statusFilter !== 'ALL') {
            rowsToRemove.forEach(row => {
                row.style.transition = 'all 0.3s ease-out';
                row.style.opacity = '0';
                row.style.transform = 'translateX(20px)';
            });

            setTimeout(() => {
                let parentTbody = null;
                rowsToRemove.forEach(row => {
                    parentTbody = row.parentNode;
                    row.remove();
                });

                window.resetBulkState(kategori);

                if (parentTbody && parentTbody.children.length === 0) {
                    parentTbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
                }
            }, 300);
        } else {
            // Jika filter adalah ALL, render semula jadual untuk kemaskini UI butang & badge
            loadSenaraiDelimaAdmin(kategori, false);
        }

    } catch (error) {
        console.error('Ralat buka semula pukal:', error);
        if (btnBukaSemula) {
            btnBukaSemula.innerHTML = originalHtml;
            btnBukaSemula.disabled = false;
        }
        Swal.fire({
            toast: true, position: 'top-end', icon: 'error', title: 'Ralat Rangkaian',
            text: 'Gagal memproses tindakan pukal.', showConfirmButton: false, timer: 2500
        });
    }
};

/**
 * ===================================================================
 * FUNGSI BANTUAN ASAL (INDIVIDUAL ACTIONS & HELPERS)
 * ===================================================================
 */

window.kemaskiniStatusDelima = async function(id, statusBaru, kategori, btnElement) {
    const db = getDatabaseClient();
    if (!db) return;
    
    const originalHtml = btnElement.innerHTML;
    const rowElement = btnElement.closest('tr');
    
    btnElement.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-1"></i>Tunggu...`;
    btnElement.disabled = true;
    btnElement.classList.add('opacity-70', 'cursor-not-allowed');

    try {
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: statusBaru })
            .eq('id', id);

        if (error) throw error;

        let dataArray = kategori === 'GURU' ? rawDataGuru : rawDataMurid;
        const index = dataArray.findIndex(item => String(item.id) === String(id));
        if (index !== -1) {
            dataArray[index].status_proses = statusBaru;
        }

        Swal.fire({
            toast: true, position: 'top-end', icon: 'success', title: 'Selesai!',
            text: `Status ditala ke ${statusBaru}`, timer: 1500, showConfirmButton: false,
            customClass: { popup: 'colored-toast' }
        });

        const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
        const statusFilter = document.getElementById(statusFilterId)?.value || 'ALL';

        if (statusFilter !== 'ALL' && statusFilter !== statusBaru) {
            if (rowElement) {
                rowElement.style.transition = 'all 0.3s ease-out';
                rowElement.style.opacity = '0';
                rowElement.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    const tbody = rowElement.parentNode;
                    rowElement.remove();
                    window.checkBulkStatus(kategori);
                    
                    if (tbody && tbody.children.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
                    }
                }, 300);
            }
        } else {
            loadSenaraiDelimaAdmin(kategori, false);
        }

    } catch (error) {
        console.error('Ralat kemaskini status DELIMa:', error);
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
        btnElement.classList.remove('opacity-70', 'cursor-not-allowed');

        Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Ralat Keselamatan', text: 'Gagal mengemas kini status.', showConfirmButton: false, timer: 2500 });
    }
};

window.salinIdDelimaAdmin = function(emel) {
    if (!emel || emel === '-' || emel.trim() === '') return;

    const fallbackCopy = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            const successful = document.execCommand('copy');
            if (successful) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Disalin!', text: text, showConfirmButton: false, timer: 2000, customClass: { popup: 'colored-toast' } });
            }
        } catch (err) {}
        document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(emel).then(() => {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Disalin!', text: emel, showConfirmButton: false, timer: 2000, customClass: { popup: 'colored-toast' } });
        }).catch(err => {
            fallbackCopy(emel);
        });
    } else {
        fallbackCopy(emel);
    }
};

window.padamRekodDelima = async function(id, kategori) {
    const db = getDatabaseClient();
    if (!db) return;
    try {
        const confirm = await Swal.fire({
            title: 'Padam Rekod?',
            text: 'Tindakan ini tidak boleh diundur. Rekod permohonan akan dihapuskan sepenuhnya.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#cbd5e1',
            confirmButtonText: 'Ya, Padam',
            cancelButtonText: 'Batal'
        });

        if (!confirm.isConfirmed) return;

        Swal.fire({ title: 'Melaksanakan arahan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const { error } = await db.from('smpid_delima_status').delete().eq('id', id);

        if (error) throw error;

        Swal.fire({ icon: 'success', title: 'Terpadam', text: 'Rekod berjaya dibersihkan dari sistem.', timer: 1500, showConfirmButton: false });
        loadSenaraiDelimaAdmin(kategori, true);

    } catch (error) {
        console.error('Ralat padam rekod DELIMa:', error);
        Swal.fire({ icon: 'error', title: 'Akses Ditolak', text: 'Ralat berlaku semasa cuba memadam rekod pangkalan data.', confirmButtonColor: '#ef4444' });
    }
};