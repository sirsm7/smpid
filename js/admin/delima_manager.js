/**
 * ADMIN MODULE: DELIMA MANAGER
 * Menguruskan paparan dan tindakan admin terhadap rekod status ID DELIMa sekolah.
 * Fungsi ini dipanggil dari panel 'Pusat Sokongan Terkumpul' (admin.html).
 * --- UPDATE V2.1 (RBAC DAERAH) ---
 * 1. Menyuntik tapisan global supaya data selari dengan daerah admin (PPD_MAPPING).
 * 2. Mengurus pemaparan dinamik entiti PPD berdasarkan APP_CONFIG.
 */

import { DelimaService } from '../../modules/helpdesk/delima.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

window.loadSenaraiDelimaAdmin = async function(kategori) {
    const tbodyId = kategori === 'GURU' ? 'tbodyAdminGuru' : 'tbodyAdminMurid';
    const filterId = kategori === 'GURU' ? 'filterDelimaGuruAdmin' : 'filterDelimaMuridAdmin';
    const tbody = document.getElementById(tbodyId);
    const filter = document.getElementById(filterId).value;

    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400 font-medium animate-pulse"><i class="fas fa-circle-notch fa-spin text-xl mb-3 block text-slate-300"></i>Memuatkan senarai...</td></tr>`;

    try {
        let dataRaw = await DelimaService.getAll(kategori, filter);

        // --- RBAC FILTERING ---
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
            const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
            validSchoolCodes.push(userKod); // Benarkan rekod PPD mereka sendiri jika wujud
            dataRaw = dataRaw.filter(item => validSchoolCodes.includes(item.kod_sekolah));
        }

        if (dataRaw.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400 italic bg-slate-50/50">Tiada rekod ditemui untuk saringan ini.</td></tr>`;
            return;
        }

        const senaraiKodPPD = APP_CONFIG.PPD_MAPPING ? Object.keys(APP_CONFIG.PPD_MAPPING) : ['M010', 'M020', 'M030'];

        tbody.innerHTML = dataRaw.map((item, index) => {
            // Memadankan kod sekolah dengan nama penuh dari memori Dashboard
            let schoolName = item.kod_sekolah;
            if (senaraiKodPPD.includes(item.kod_sekolah)) {
                schoolName = APP_CONFIG.PPD_MAPPING[item.kod_sekolah] ? `PPD ${APP_CONFIG.PPD_MAPPING[item.kod_sekolah]}` : 'PEJABAT PENDIDIKAN DAERAH';
            } else if (window.globalDashboardData) {
                const schoolMatch = window.globalDashboardData.find(s => s.kod_sekolah === item.kod_sekolah);
                if (schoolMatch) schoolName = schoolMatch.nama_sekolah;
            }

            // Penetapan Butang Status & Aksi
            let actionArea = '';
            if (item.status_proses === 'SELESAI') {
                actionArea = `<span class="inline-flex items-center justify-center bg-green-100 text-green-700 text-[10px] px-3 py-1.5 rounded-full font-black border border-green-200 shadow-sm w-full uppercase tracking-widest"><i class="fas fa-check mr-1.5"></i> SELESAI</span>
                              <button onclick="hapusDelimaAdmin(${item.id}, '${kategori}')" class="mt-2 text-[10px] font-bold text-slate-400 hover:text-red-500 transition uppercase tracking-wider"><i class="fas fa-trash-alt"></i> Padam</button>`;
            } else {
                actionArea = `<button onclick="kemaskiniStatusDelimaAdmin(${item.id}, 'SELESAI', '${kategori}')" class="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-3 py-2 rounded-lg shadow-md transition-all flex items-center justify-center gap-1.5 uppercase tracking-widest transform active:scale-95"><i class="fas fa-check-double"></i> Tanda Selesai</button>`;
            }

            // Penetapan Visual Susun Atur Destinasi Guru vs Murid
            let detailsHtml = '';
            const isTarikMasuk = item.catatan === 'Berpindah MASUK ke sekolah ini';
            const colorTheme = kategori === 'GURU' ? 'blue' : 'cyan';
            
            const destinasiBadge = isTarikMasuk 
                ? `<br><span class="text-${colorTheme}-700 font-bold mt-2 block text-xs bg-${colorTheme}-50 p-2.5 rounded-lg border border-${colorTheme}-100 shadow-sm"><i class="fas fa-download mr-1.5 text-${colorTheme}-500"></i> Mohon Tarik Masuk Ke:<br><span class="text-[10px] text-slate-500 font-mono mt-1 block tracking-wider bg-white px-2 py-1 rounded inline-block">OU: ${item.unit_organisasi_baharu || item.kod_sekolah}</span></span>` 
                : '';
                
            detailsHtml = `
                <div class="font-bold text-slate-700 text-xs mb-1 uppercase bg-slate-100 inline-block px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">${item.catatan}</div>
                ${destinasiBadge}
            `;

            return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 group">
                <td class="px-6 py-4 w-12 text-center font-mono font-bold text-slate-400 text-xs align-top pt-6">${index + 1}</td>
                <td class="px-6 py-4 w-2/5 align-top pt-6">
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="bg-slate-800 text-white text-[9px] px-2 py-0.5 rounded font-bold tracking-widest shadow-sm">${item.kod_sekolah}</span>
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[200px]" title="${schoolName}">${schoolName}</span>
                    </div>
                    <div class="font-bold text-slate-800 text-sm leading-snug mb-2 uppercase break-words">${item.nama}</div>
                    <div class="text-[10px] text-slate-500 font-mono font-bold bg-white px-2 py-1 rounded-md inline-block border border-slate-200 shadow-sm">${item.id_delima}</div>
                    <div class="text-[9px] text-slate-400 mt-2 font-semibold tracking-wider"><i class="far fa-calendar-alt mr-1"></i> Dihantar: ${new Date(item.created_at).toLocaleDateString('ms-MY')}</div>
                </td>
                <td class="px-6 py-4 w-2/5 align-top pt-6">${detailsHtml}</td>
                <td class="px-6 py-4 text-center w-32 align-top pt-6">${actionArea}</td>
            </tr>`;
        }).join('');
        
    } catch (e) {
        console.error("[AdminDelima] Error loading list:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500 font-bold bg-red-50 border border-red-100 rounded-xl"><i class="fas fa-exclamation-triangle text-lg mb-2 block"></i> Gagal memuatkan data pangkalan data.</td></tr>`;
    }
};

window.kemaskiniStatusDelimaAdmin = async function(id, status, kategori) {
    Swal.fire({
        title: 'Sahkan Tindakan',
        text: 'Adakah permohonan ini telah diselesaikan (diproses dalam konsol admin)?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Ya, Selesai!',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await DelimaService.updateStatus(id, status);
                toggleLoading(false);
                Swal.fire({ icon: 'success', title: 'Status Dikemaskini', timer: 1500, showConfirmButton: false });
                window.loadSenaraiDelimaAdmin(kategori);
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal mengemaskini status.', 'error');
            }
        }
    });
};

window.hapusDelimaAdmin = async function(id, kategori) {
    Swal.fire({
        title: 'Padam Rekod?',
        text: 'Rekod ini akan dipadam secara kekal dari pangkalan data.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            toggleLoading(true);
            try {
                await DelimaService.deleteStatus(id);
                toggleLoading(false);
                Swal.fire({ icon: 'success', title: 'Dipadam', timer: 1500, showConfirmButton: false });
                window.loadSenaraiDelimaAdmin(kategori);
            } catch (e) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam rekod.', 'error');
            }
        }
    });
};