import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

const db = getDatabaseClient();

// Menyimpan data mentah untuk tapisan silang (client-side cache) bagi melancarkan prestasi UI
let rawDataGuru = [];
let rawDataMurid = [];
let mapKodOuGlobal = {};

/**
 * Memuatkan senarai permohonan DELIMa dari pangkalan data dan 
 * melaksanakan integrasi bersama jadual delima_data_sekolah untuk kod_ou
 * @param {string} kategori - 'GURU' atau 'MURID'
 * @param {boolean} forceRefresh - Paksa tarik data baharu dari Supabase
 */
window.loadSenaraiDelimaAdmin = async function(kategori, forceRefresh = true) {
    if (!db) {
        console.error("Gagal menyambung ke pangkalan data.");
        return;
    }

    try {
        const tbodyId = kategori === 'GURU' ? 'tbodyAdminGuru' : 'tbodyAdminMurid';
        const tbody = document.getElementById(tbodyId);
        
        if (!tbody) return;

        // Dapatkan elemen filter UI
        const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
        const catatanFilterId = kategori === 'GURU' ? 'filterCatatanGuruAdmin' : 'filterCatatanMuridAdmin';
        
        const statusFilter = document.getElementById(statusFilterId)?.value || 'ALL';
        const catatanFilter = document.getElementById(catatanFilterId)?.value || 'ALL';

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

        // Laksanakan Tapisan (Client-side Filtering)
        let filteredData = dataToProcess;

        // 1. Tapis mengikut Status (DALAM PROSES / SELESAI / ALL)
        if (statusFilter !== 'ALL') {
            filteredData = filteredData.filter(item => item.status_proses === statusFilter);
        }

        // 2. Tapis mengikut Catatan Khusus
        if (catatanFilter !== 'ALL') {
            filteredData = filteredData.filter(item => {
                if (!item.catatan) return false;
                return item.catatan.includes(catatanFilter);
            });
        }

        // Proses Paparan Antaramuka (UI Render)
        if (!filteredData || filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
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
                ? `<button onclick="kemaskiniStatusDelima('${item.id}', 'SELESAI', '${kategori}')" class="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md transform active:scale-95"><i class="fas fa-check-circle mr-1"></i>Tanda Selesai</button>`
                : `<button onclick="kemaskiniStatusDelima('${item.id}', 'DALAM PROSES', '${kategori}')" class="mt-3 w-full bg-white border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm transform active:scale-95"><i class="fas fa-undo mr-1"></i>Buka Semula</button>`;

            const deleteButton = `<button onclick="padamRekodDelima('${item.id}', '${kategori}')" class="mt-1.5 w-full bg-white border border-red-100 hover:bg-red-50 text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm"><i class="fas fa-trash-alt mr-1"></i>Padam</button>`;

            const isTarikMasuk = item.catatan === 'Berpindah MASUK ke sekolah ini';
            const colorTheme = kategori === 'GURU' ? 'blue' : 'cyan';
            
            const destinasiBadge = isTarikMasuk 
                ? `<br><span class="text-${colorTheme}-700 font-bold mt-2 block text-xs bg-${colorTheme}-50 p-2.5 rounded-lg border border-${colorTheme}-100 shadow-sm wrap-safe"><i class="fas fa-download mr-1.5 text-${colorTheme}-500"></i> Mohon Tarik Ke:<br><span class="text-[10px] text-slate-500 font-mono mt-1 block tracking-wider bg-white px-2 py-1 rounded inline-block wrap-safe break-all">OU: ${item.unit_organisasi_baharu || item.kod_sekolah}</span></span>` 
                : '';

            html += `
                <tr class="${bgRow} border-b border-slate-100 transition-colors group">
                    <td class="px-6 py-4 text-center font-black text-slate-400 align-top">${index + 1}</td>
                    <td class="px-6 py-4 align-top">
                        <div class="font-bold text-slate-800 tracking-tight">${schoolName}</div>
                        <div class="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-indigo-700 bg-indigo-50 px-2 py-1 rounded mt-1.5 border border-indigo-100 shadow-sm">
                            <i class="fas fa-building text-indigo-400"></i> ${paparKodSekolahGabungan}
                        </div>
                        <div class="mt-3 p-3 bg-white border-2 border-slate-100 rounded-xl shadow-sm">
                            <span class="font-bold text-slate-700 block mb-1 text-xs uppercase"><i class="fas fa-user-circle text-slate-400 mr-1.5"></i>${item.nama}</span>
                            <span class="font-mono text-slate-500 text-[10px] font-bold tracking-wider bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded block w-fit wrap-safe break-all">ID: ${item.id_delima || 'TIADA REKOD'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 align-top">
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
                    <td class="px-6 py-4 text-center align-top">
                        <div class="mb-3">${badgeStatus}</div>
                        ${actionButton}
                        ${deleteButton}
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

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
 * Mengemas kini status tiket DELIMa
 * @param {string} id - UUID tiket
 * @param {string} statusBaru - 'DALAM PROSES' atau 'SELESAI'
 * @param {string} kategori - Kategori untuk refresh jadual yang betul
 */
window.kemaskiniStatusDelima = async function(id, statusBaru, kategori) {
    if (!db) return;
    try {
        if (statusBaru === 'SELESAI') {
            const confirm = await Swal.fire({
                title: 'Sahkan Tindakan',
                text: 'Adakah isu/permohonan ini telah diselesaikan sepenuhnya di pangkalan DELIMa pusat?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#cbd5e1',
                confirmButtonText: 'Ya, Sahkan Selesai',
                cancelButtonText: 'Batal Tindakan'
            });
            
            if (!confirm.isConfirmed) return;
        }

        Swal.fire({
            title: 'Menyimpan Rekod...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: statusBaru })
            .eq('id', id);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Rekod Dikemas Kini',
            text: `Status telah ditukar kepada ${statusBaru}.`,
            timer: 1500,
            showConfirmButton: false
        });

        // Wajib set forceRefresh = true supaya array data mentah dikemas kini dengan status terbaharu
        loadSenaraiDelimaAdmin(kategori, true);

    } catch (error) {
        console.error('Ralat kemaskini status DELIMa:', error);
        Swal.fire({
            icon: 'error',
            title: 'Ralat Keselamatan',
            text: 'Gagal mengemas kini status pada pangkalan data.',
            confirmButtonColor: '#ef4444'
        });
    }
};

/**
 * Memadam rekod permohonan secara kekal
 * @param {string} id - UUID tiket
 * @param {string} kategori - Kategori untuk refresh jadual yang betul
 */
window.padamRekodDelima = async function(id, kategori) {
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

        Swal.fire({
            title: 'Melaksanakan arahan...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const { error } = await db
            .from('smpid_delima_status')
            .delete()
            .eq('id', id);

        if (error) throw error;

        Swal.fire({
            icon: 'success',
            title: 'Terpadam',
            text: 'Rekod berjaya dibersihkan dari sistem.',
            timer: 1500,
            showConfirmButton: false
        });

        // Wajib tarik rekod terkini selepas penghapusan
        loadSenaraiDelimaAdmin(kategori, true);

    } catch (error) {
        console.error('Ralat padam rekod DELIMa:', error);
        Swal.fire({
            icon: 'error',
            title: 'Akses Ditolak',
            text: 'Ralat berlaku semasa cuba memadam rekod pangkalan data.',
            confirmButtonColor: '#ef4444'
        });
    }
};