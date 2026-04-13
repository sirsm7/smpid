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
    // FIX: Sentiasa dapatkan instance terkini dari DB Core untuk elak isu sambungan (Race Condition)
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
        
        const statusSelect = document.getElementById(statusFilterId);
        const catatanSelect = document.getElementById(catatanFilterId);
        const sekolahSelect = document.getElementById(sekolahFilterId);

        let statusVal = statusSelect?.value || 'ALL';
        let catVal = catatanSelect?.value || 'ALL';
        let sekVal = sekolahSelect?.value || 'ALL';

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
        
        // 1. Tapis data asas berdasarkan Status Semasa terlebih dahulu
        let statusFilteredData = dataToProcess;
        if (statusVal !== 'ALL') {
            statusFilteredData = statusFilteredData.filter(item => item.status_proses === statusVal);
        }

        if (catatanSelect && sekolahSelect) {
            
            // A. JANA DROPDOWN CATATAN (Dibasaskan pada pilihan Sekolah semasa)
            let dataForCatatan = statusFilteredData;
            if (sekVal !== 'ALL') {
                dataForCatatan = dataForCatatan.filter(item => item.kod_sekolah === sekVal);
            }
            const uniqueCatatan = [...new Set(dataForCatatan.map(item => item.catatan).filter(Boolean))].sort();
            
            let catatanHtml = '<option value="ALL">Semua Catatan</option>';
            uniqueCatatan.forEach(c => {
                catatanHtml += `<option value="${c}">${c}</option>`;
            });
            catatanSelect.innerHTML = catatanHtml;

            // State Restoration: Kekalkan pilihan jika ia masih wujud, reset jika terkeluar skop
            if (catVal !== 'ALL' && uniqueCatatan.includes(catVal)) {
                catatanSelect.value = catVal;
            } else {
                catVal = 'ALL';
                catatanSelect.value = 'ALL';
            }

            // B. JANA DROPDOWN SEKOLAH (Dibasaskan pada pilihan Catatan semasa)
            let dataForSekolah = statusFilteredData;
            if (catVal !== 'ALL') {
                dataForSekolah = dataForSekolah.filter(item => item.catatan === catVal);
            }
            const uniqueSekolah = [...new Set(dataForSekolah.map(item => item.kod_sekolah).filter(Boolean))].sort();
            
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

            // State Restoration: Kekalkan pilihan jika ia masih wujud, reset jika terkeluar skop
            if (sekVal !== 'ALL' && uniqueSekolah.includes(sekVal)) {
                sekolahSelect.value = sekVal;
            } else {
                sekVal = 'ALL';
                sekolahSelect.value = 'ALL';
            }
        }

        // 2. Laksanakan Tapisan Jadual Akhir menggunakan parameter yang telah disahkan (Validated Parameters)
        let filteredData = statusFilteredData;

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

        if (!filteredData || filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
            window.resetBulkState(kategori);
            
            // Sembunyikan butang Select All pada header jika tiada data
            const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
            const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);
            if (selectAllCb) selectAllCb.classList.add('hidden');
            
            return;
        }

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

            // Gabungan Paparan Kod Sekolah & Kod OU
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
            // KEMASKINI: Hanya papar kotak semak jika status adalah 'DALAM PROSES'
            let checkboxHtml = '';
            if (item.status_proses === 'DALAM PROSES') {
                checkboxHtml = `<input type="checkbox" class="cb-delima-${kategori} w-4 h-4 accent-${colorTheme}-600 cursor-pointer rounded mb-2" value="${item.id}" data-email="${item.id_delima || ''}" onchange="checkBulkStatus('${kategori}')">`;
            }

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

        // KAWALAN PAPARAN SELECT ALL CHECKBOX
        // Sembunyikan checkbox 'Pilih Semua' jika tiada rekod DALAM PROSES
        const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
        const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);
        if (selectAllCb) {
            const hasPending = filteredData.some(item => item.status_proses === 'DALAM PROSES');
            if (hasPending) {
                selectAllCb.classList.remove('hidden');
            } else {
                selectAllCb.classList.add('hidden');
            }
        }

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
    const btnEksport = document.getElementById(`btnEksportPukal${capitalizedKategori}`);
    const countSpan = document.getElementById(`countPukal${capitalizedKategori}`);

    if (count > 0) {
        if (bulkContainer) bulkContainer.classList.remove('hidden');
        if (btnSalin) btnSalin.disabled = false;
        if (btnSelesai) btnSelesai.disabled = false;
        if (btnEksport) btnEksport.disabled = false;
        if (countSpan) countSpan.innerText = count;
    } else {
        if (bulkContainer) bulkContainer.classList.add('hidden');
        if (btnSalin) btnSalin.disabled = true;
        if (btnSelesai) btnSelesai.disabled = true;
        if (btnEksport) btnEksport.disabled = true;
        if (countSpan) countSpan.innerText = '0';
        
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

    // Kumpul senarai ID rekod yang ditandakan
    const selectedIds = Array.from(checkboxes).map(cb => cb.value);

    // Kenal pasti sumber data yang betul berdasarkan kategori
    const dataPool = kategori === 'GURU' ? rawDataGuru : rawDataMurid;
    
    // Tapis rekod dari cache berpandukan ID yang dipilih
    const recordsToExport = dataPool.filter(item => selectedIds.includes(String(item.id)));

    if (recordsToExport.length === 0) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Tiada Data', text: 'Tiada rekod sah untuk dieksport.', showConfirmButton: false, timer: 2000 });
        return;
    }

    // Penyediaan kandungan CSV
    let csvContent = "BIL,KOD SEKOLAH,KOD OU,NAMA,ID DELIMA,KATEGORI,CATATAN,STATUS PROSES,TARIKH MOHON\n";
    
    recordsToExport.forEach((item, index) => {
        // Pembersihan (escaping) teks CSV untuk mengelakkan ralat tanda koma dalam rentetan
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

    // Melaksanakan muat turun dengan format BOM UTF-8 supaya serasi dengan paparan MS Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Eksport_ID_${kategori}_Terpilih_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Paparan maklum balas kejayaan
    Swal.fire({ 
        toast: true, 
        position: 'top-end', 
        icon: 'success', 
        title: 'Berjaya Dieksport!', 
        text: `${recordsToExport.length} rekod dimuat turun.`, 
        showConfirmButton: false, 
        timer: 2000, 
        customClass: { popup: 'colored-toast' } 
    });
};

// Mengekstrak dan menyalin emel ke papan keratan dalam format selari ke bawah (\n)
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

    // Cantumkan menggunakan newline (Enter)
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

// Mengemas kini berbilang rekod secara optimistik ke pangkalan data menggunakan .in() semula
window.tandaSelesaiPukal = async function(kategori) {
    const db = getDatabaseClient();
    if (!db) return;

    const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
    if (checkboxes.length === 0) return;

    const capitalizedKategori = kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
    const btnSelesai = document.getElementById(`btnSelesaiPukal${capitalizedKategori}`);
    const originalHtml = btnSelesai.innerHTML;

    // Visual Feedback (Loading state pada butang pukal)
    btnSelesai.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i>Memproses...`;
    btnSelesai.disabled = true;

    const idsToUpdate = [];
    const rowsToRemove = [];

    checkboxes.forEach(cb => {
        idsToUpdate.push(cb.value);
        rowsToRemove.push(cb.closest('tr'));
    });

    try {
        // Melaksanakan SATU API call menggunakan .in() untuk kelajuan luar biasa
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: 'SELESAI' })
            .in('id', idsToUpdate);

        if (error) throw error;

        // Notifikasi Toast
        Swal.fire({
            toast: true, position: 'top-end', icon: 'success', title: 'Selesai Pukal!',
            text: `${idsToUpdate.length} permohonan dikemaskini.`, showConfirmButton: false, timer: 2000,
            customClass: { popup: 'colored-toast' }
        });

        // 1. Kemaskini Cache Supaya Tidak Timbul Apabila Filter Berubah
        if (kategori === 'GURU') {
            rawDataGuru = rawDataGuru.filter(item => !idsToUpdate.includes(String(item.id)));
            if (filteredDataGuru) filteredDataGuru = filteredDataGuru.filter(item => !idsToUpdate.includes(String(item.id)));
        } else {
            rawDataMurid = rawDataMurid.filter(item => !idsToUpdate.includes(String(item.id)));
            if (filteredDataMurid) filteredDataMurid = filteredDataMurid.filter(item => !idsToUpdate.includes(String(item.id)));
        }

        // 2. Animasi Pembuangan Baris
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

            // 3. Reset UI Tindakan Pukal
            window.resetBulkState(kategori);

            // 4. Masukkan baris kekosongan jika jadual telus sepenuhnya
            if (parentTbody && parentTbody.children.length === 0) {
                parentTbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
            }
        }, 300);

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

/**
 * ===================================================================
 * FUNGSI BANTUAN ASAL (INDIVIDUAL ACTIONS & HELPERS)
 * ===================================================================
 */

// Kemaskini Status Individu (Optimistic UI)
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

        // Kemaskini cache tempatan
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

        // Manipulasi baris jadual jika filter tidak membenarkan status ini
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
                    // Kemaskini status pukal jika baris dipadam dan checkboxnya ditanda sebelum ini
                    window.checkBulkStatus(kategori);
                    
                    if (tbody && tbody.children.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
                    }
                }, 300);
            }
        } else {
            // Render semula jadual penuh jika berada dalam tab "SEMUA"
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