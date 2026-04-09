import { supabase } from '../core/db.js';

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

        // Tarik data baharu dari pangkalan data jika diarahkan
        if (forceRefresh || dataToProcess.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-circle-notch fa-spin mr-2"></i>Mengumpul dan menyegerak pangkalan data ${kategori}...</td></tr>`;

            const { data: delimaData, error: delimaError } = await supabase
                .from('helpdesk_delima')
                .select('*')
                .eq('kategori', kategori)
                .order('created_at', { ascending: false });

            if (delimaError) throw delimaError;

            // Simpan dalam state aplikasi
            if (kategori === 'GURU') {
                rawDataGuru = delimaData || [];
                dataToProcess = rawDataGuru;
            } else {
                rawDataMurid = delimaData || [];
                dataToProcess = rawDataMurid;
            }

            // CROSS-QUERY: Tarik kod_ou dari delima_data_sekolah
            const unikKodSekolah = [...new Set(dataToProcess.map(item => item.kod_sekolah))];
            
            if (unikKodSekolah.length > 0) {
                const { data: sekolahData, error: sekolahError } = await supabase
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
            filteredData = filteredData.filter(item => item.status === statusFilter);
        }

        // 2. Tapis mengikut Catatan Khusus
        if (catatanFilter !== 'ALL') {
            filteredData = filteredData.filter(item => {
                if (!item.catatan) return false;
                // Menggunakan 'includes' untuk padanan separa kerana pengguna mungkin menambah teks lain dalam catatan
                return item.catatan.includes(catatanFilter);
            });
        }

        // Proses Paparan Antaramuka (UI Render)
        if (!filteredData || filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
            return;
        }

        let html = '';
        filteredData.forEach((item, index) => {
            const dateObj = new Date(item.created_at);
            const formatTarikh = dateObj.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            const formatMasa = dateObj.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
            
            // Gabungan Paparan Kod Sekolah & Kod OU
            const kodOu = mapKodOuGlobal[item.kod_sekolah] || 'Tiada Kod OU';
            const paparKodSekolahGabungan = `${item.kod_sekolah} (${kodOu})`;

            let badgeStatus = '';
            let bgRow = 'hover:bg-slate-50';
            
            if (item.status === 'DALAM PROSES') {
                badgeStatus = `<span class="bg-amber-100 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest"><i class="fas fa-clock mr-1"></i>PROSES</span>`;
            } else if (item.status === 'SELESAI') {
                badgeStatus = `<span class="bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest"><i class="fas fa-check-double mr-1"></i>SELESAI</span>`;
                bgRow = 'bg-slate-50/50 hover:bg-slate-100 opacity-80 grayscale-[0.2]';
            }

            const actionButton = item.status === 'DALAM PROSES'
                ? `<button onclick="kemaskiniStatusDelima('${item.id}', 'SELESAI', '${kategori}')" class="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md transform active:scale-95"><i class="fas fa-check-circle mr-1"></i>Tanda Selesai</button>`
                : `<button onclick="kemaskiniStatusDelima('${item.id}', 'DALAM PROSES', '${kategori}')" class="mt-3 w-full bg-white border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm transform active:scale-95"><i class="fas fa-undo mr-1"></i>Buka Semula</button>`;

            const deleteButton = `<button onclick="padamRekodDelima('${item.id}', '${kategori}')" class="mt-1.5 w-full bg-white border border-red-100 hover:bg-red-50 text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm"><i class="fas fa-trash-alt mr-1"></i>Padam</button>`;

            html += `
                <tr class="${bgRow} border-b border-slate-100 transition-colors">
                    <td class="px-6 py-4 text-center font-black text-slate-400">${index + 1}</td>
                    <td class="px-6 py-4">
                        <div class="font-bold text-slate-800 tracking-tight">${item.nama_sekolah}</div>
                        <div class="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-indigo-700 bg-indigo-50 px-2 py-1 rounded mt-1.5 border border-indigo-100 shadow-sm">
                            <i class="fas fa-building text-indigo-400"></i> ${paparKodSekolahGabungan}
                        </div>
                        <div class="mt-3 p-3 bg-white border-2 border-slate-100 rounded-xl shadow-sm">
                            <span class="font-bold text-slate-700 block mb-1 text-xs"><i class="fas fa-user-circle text-slate-400 mr-1.5"></i>${item.nama_pemohon}</span>
                            <span class="font-mono text-slate-500 text-[10px] font-bold tracking-wider bg-slate-50 px-1.5 py-0.5 border border-slate-200 rounded block w-fit">IC: ${item.ic_pemohon || 'TIADA REKOD'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-700 bg-sky-50 border-l-4 border-sky-400 p-3 rounded-r-xl shadow-sm mb-3 relative overflow-hidden">
                            <i class="fas fa-quote-right absolute right-2 bottom-2 text-3xl text-sky-500/10 z-0"></i>
                            <span class="block text-[9px] uppercase tracking-widest text-sky-600 mb-1 z-10 relative">Isu / Catatan Permohonan:</span>
                            <span class="z-10 relative">${item.catatan || '-'}</span>
                        </div>
                        <div class="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            <span class="bg-slate-100 px-2 py-1 rounded"><i class="fas fa-calendar-alt mr-1"></i> ${formatTarikh}</span>
                            <span class="bg-slate-100 px-2 py-1 rounded"><i class="fas fa-clock mr-1"></i> ${formatMasa}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center align-middle">
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

        const { error } = await supabase
            .from('helpdesk_delima')
            .update({ status: statusBaru })
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

        const { error } = await supabase
            .from('helpdesk_delima')
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