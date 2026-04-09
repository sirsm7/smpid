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

            // PENUKARAN: Menambah elemen 'this' ke dalam argument onlick
            const actionButton = item.status_proses === 'DALAM PROSES'
                ? `<button onclick="kemaskiniStatusDelima('${item.id}', 'SELESAI', '${kategori}', this)" class="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md transform active:scale-95"><i class="fas fa-check-circle mr-1"></i>Tanda Selesai</button>`
                : `<button onclick="kemaskiniStatusDelima('${item.id}', 'DALAM PROSES', '${kategori}', this)" class="mt-3 w-full bg-white border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm transform active:scale-95"><i class="fas fa-undo mr-1"></i>Buka Semula</button>`;

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
                            <div class="flex items-center gap-2 mt-1">
                                <div class="text-[10px] text-slate-500 font-mono font-bold bg-slate-50 px-2 py-1 rounded-md inline-block border border-slate-200 shadow-sm wrap-safe break-all">${item.id_delima || 'TIADA REKOD'}</div>
                                ${item.id_delima ? `<button onclick="window.salinIdDelimaAdmin('${item.id_delima}')" class="p-1.5 bg-${colorTheme}-50 text-${colorTheme}-600 rounded-md hover:bg-${colorTheme}-100 hover:text-${colorTheme}-800 transition-colors shadow-sm" title="Salin ID DELIMa"><i class="far fa-copy"></i></button>` : ''}
                            </div>
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
 * Fungsi Global: Menyalin ID DELIMa ke Clipboard berserta Toast Notification
 */
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
                tunjukToastBerjaya(text);
            } else {
                tunjukToastGagal();
            }
        } catch (err) {
            console.error('[DELIMA] Fallback menyalin gagal:', err);
            tunjukToastGagal();
        }
        document.body.removeChild(textArea);
    };

    const tunjukToastBerjaya = (teks) => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Disalin!',
                text: teks,
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
                customClass: { popup: 'colored-toast' }
            });
        } else {
            alert(`ID disalin: ${teks}`);
        }
    };

    const tunjukToastGagal = () => {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Gagal menyalin ID',
                showConfirmButton: false,
                timer: 2500
            });
        } else {
            alert('Sistem gagal menyalin ID. Sila salin secara manual.');
        }
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(emel).then(() => {
            tunjukToastBerjaya(emel);
        }).catch(err => {
            console.warn('[DELIMA] Clipboard API ralat, bertukar ke fallback.', err);
            fallbackCopy(emel);
        });
    } else {
        fallbackCopy(emel);
    }
};

/**
 * PENUKARAN: Mengemas kini status tiket DELIMa (Optimistic Asynchronous UI)
 * @param {string} id - UUID tiket
 * @param {string} statusBaru - 'DALAM PROSES' atau 'SELESAI'
 * @param {string} kategori - Kategori untuk refresh jadual yang betul
 * @param {HTMLElement} btnElement - Rujukan butang yang diklik (this)
 */
window.kemaskiniStatusDelima = async function(id, statusBaru, kategori, btnElement) {
    if (!db) return;
    
    // 1. Simpan rujukan HTML asal
    const originalHtml = btnElement.innerHTML;
    const rowElement = btnElement.closest('tr');
    
    // 2. Ubah UI Butang (Optimistic: Tukar serta-merta tanpa block screen)
    btnElement.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-1"></i>Tunggu...`;
    btnElement.disabled = true;
    btnElement.classList.add('opacity-70', 'cursor-not-allowed');

    try {
        // 3. Eksekusi DB secara Asynchronous
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: statusBaru })
            .eq('id', id);

        if (error) throw error;

        // 4. Kemaskini tatasusunan cache tempatan supaya tidak berlaku kepincangan
        let dataArray = kategori === 'GURU' ? rawDataGuru : rawDataMurid;
        const index = dataArray.findIndex(item => item.id === id);
        if (index !== -1) {
            dataArray[index].status_proses = statusBaru;
        }

        // 5. Paparkan notifikasi Toast (Ganti modal statik Swal lama)
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Selesai!',
            text: `Status ditala ke ${statusBaru}`,
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'colored-toast' }
        });

        // 6. Manipulasi Animasi Penyingkiran Baris (Jika tapisan menapis status tersebut)
        const statusFilterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
        const statusFilter = document.getElementById(statusFilterId)?.value || 'ALL';

        if (statusFilter !== 'ALL' && statusFilter !== statusBaru) {
            // Baris perlu dikeluarkan kerana ia tidak tergolong dalam status yang ditapis
            if (rowElement) {
                rowElement.style.transition = 'all 0.3s ease-out';
                rowElement.style.opacity = '0';
                rowElement.style.transform = 'translateX(20px)';
                
                setTimeout(() => {
                    const tbody = rowElement.parentNode;
                    rowElement.remove();
                    
                    // Inject placeholder jika jadual telah bersih sepenuhnya
                    if (tbody && tbody.children.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 font-medium"><i class="fas fa-inbox text-3xl mb-3 opacity-20 block"></i>Tiada rekod permohonan padan dengan tapisan ini.</td></tr>`;
                    }
                }, 300);
            }
        } else {
            // Jika filter adalah "SEMUA STATUS", cuma Render semula UI dari Cache tanpa fetch Pangkalan Data
            loadSenaraiDelimaAdmin(kategori, false);
        }

    } catch (error) {
        console.error('Ralat kemaskini status DELIMa:', error);
        
        // Kembalikan keadaan butang kepada asal jika gagal supaya boleh diklik semula
        btnElement.innerHTML = originalHtml;
        btnElement.disabled = false;
        btnElement.classList.remove('opacity-70', 'cursor-not-allowed');

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: 'Ralat Keselamatan',
            text: 'Gagal mengemas kini status.',
            showConfirmButton: false,
            timer: 2500
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