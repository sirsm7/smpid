/**
 * HELPDESK & DELIMA MANAGER CONTROLLER
 * Menguruskan logik antaramuka tiket aduan, status guru, dan status murid.
 * Modul ini menggunakan Service Layer untuk berinteraksi dengan Supabase.
 */

import { SupportService } from '../../js/services/support.service.js';
import { DelimaService } from './delima.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Semakan Keselamatan Sesi
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    if (!kod) {
        console.warn("⛔ [Helpdesk] Akses Tanpa Izin. Mengalih keluar...");
        window.location.replace('../../index.html');
        return;
    }

    // 2. Intercept dan perkayakan fungsi switchTab sedia ada untuk menyokong Lazy Loading data
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabId) {
        // Laksanakan pertukaran UI (UI visual switch)
        if (typeof originalSwitchTab === 'function') {
            originalSwitchTab(tabId);
        }
        
        // Muat data dari pangkalan data apabila tab ditekan (Lazy Load)
        if (tabId === 'aduan') window.muatSenaraiTiket();
        else if (tabId === 'guru') window.muatSenaraiDelima('GURU');
        else if (tabId === 'murid') window.muatSenaraiDelima('MURID');
    };

    // 3. Muat data awal untuk tab lalai (Aduan ICT)
    window.muatSenaraiTiket();
});

// --- FUNGSI UTILITI ---
function toggleLoadingLocal(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) {
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}

// ==========================================
// SEKSYEN 1: TIKET ADUAN ICT
// ==========================================

window.hantarTiketAduan = async function() {
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const peranan = document.getElementById('tiketPeranan').value;
    const tajuk = document.getElementById('tiketTajuk').value.trim().toUpperCase();
    const mesej = document.getElementById('tiketMesej').value.trim();

    if (!peranan || !tajuk || !mesej) return Swal.fire('Tidak Lengkap', 'Sila isi semua ruangan tiket aduan.', 'warning');

    toggleLoadingLocal(true);
    try {
        await SupportService.createTicket({
            kod_sekolah: kod,
            peranan_pengirim: peranan,
            tajuk: tajuk,
            butiran_masalah: mesej
        });
        
        toggleLoadingLocal(false);
        Swal.fire({
            icon: 'success',
            title: 'Tiket Dihantar',
            text: 'Aduan anda telah direkodkan dan akan disemak oleh pihak PPD.',
            confirmButtonColor: '#dc2626'
        }).then(() => {
            document.getElementById('formTiket').reset();
            window.muatSenaraiTiket();
        });
    } catch (e) {
        toggleLoadingLocal(false);
        Swal.fire('Ralat Sistem', 'Gagal menghantar tiket aduan ke pangkalan data. Sila cuba lagi.', 'error');
    }
};

window.muatSenaraiTiket = async function() {
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const container = document.getElementById('senaraiTiketContainer');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-12 text-slate-400 font-medium animate-pulse"><i class="fas fa-circle-notch fa-spin text-2xl mb-3 block text-helpdesk-400"></i>Memuatkan rekod aduan...</div>';

    try {
        const data = await SupportService.getBySchool(kod);
        container.innerHTML = "";
        
        if(data.length === 0) { 
            container.innerHTML = `<div class="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-medium italic">Tiada tiket aduan aktif ditemui untuk sekolah ini.</div>`; 
            return; 
        }
        
        data.forEach(t => {
            const statusBadge = t.status === 'SELESAI' 
                ? `<span class="bg-green-100 text-green-700 text-[10px] px-3 py-1 rounded-full font-black border border-green-200 shadow-sm uppercase tracking-widest flex items-center gap-1.5"><i class="fas fa-check"></i> SELESAI</span>` 
                : `<span class="bg-amber-100 text-amber-700 text-[10px] px-3 py-1 rounded-full font-black animate-pulse border border-amber-200 shadow-sm uppercase tracking-widest flex items-center gap-1.5"><i class="fas fa-clock"></i> DALAM PROSES</span>`;
            
            const balasan = t.balasan_admin 
                ? `<div class="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-700 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100"><strong class="text-emerald-700 uppercase flex items-center gap-2 mb-1.5"><i class="fas fa-check-circle text-emerald-500"></i> Respon Pentadbir:</strong> <span class="leading-relaxed block mt-1">${t.balasan_admin}</span></div>` 
                : '';
            
            container.innerHTML += `
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all mb-4 border-l-4 border-l-helpdesk-500">
                <div class="flex justify-between items-start mb-4 border-b border-slate-50 pb-3">
                    <div class="text-[10px] text-slate-400 font-black uppercase tracking-widest"><i class="far fa-calendar-alt mr-1.5"></i> ${new Date(t.created_at).toLocaleDateString('ms-MY')}</div>
                    ${statusBadge}
                </div>
                <h4 class="font-bold text-slate-800 text-sm mb-2 uppercase leading-tight">${t.tajuk}</h4>
                <p class="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">${t.butiran_masalah}</p>
                ${balasan}
            </div>`;
        });
    } catch (e) { 
        container.innerHTML = `<div class="text-red-500 font-bold text-center py-6 bg-red-50 rounded-xl border border-red-100"><i class="fas fa-exclamation-triangle mr-2"></i> Ralat memuatkan sejarah tiket aduan.</div>`; 
    }
};

// ==========================================
// SEKSYEN 2: PENGURUSAN STATUS ID DELIMA
// ==========================================

window.hantarStatusDelima = async function(kategori) {
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    
    let payload = {
        kod_sekolah: kod,
        kategori: kategori,
        status_proses: 'DALAM PROSES',
        unit_organisasi_asal: 'TIDAK DINYATAKAN' // Nilai hardcode menggantikan input yang dibuang
    };

    // Logik Pengekstrakan Data Borang Guru
    if (kategori === 'GURU') {
        payload.nama = document.getElementById('guruNama').value.trim().toUpperCase();
        payload.id_delima = document.getElementById('guruIdDelima').value.trim().toLowerCase();
        payload.catatan = document.getElementById('guruCatatan').value;
        
        // Logik Khusus: Jika berpindah masuk, set OU baharu kepada kod sekolah pemohon secara automatik
        if (payload.catatan === 'Berpindah MASUK ke sekolah ini') {
            payload.unit_organisasi_baharu = kod.toLowerCase();
            payload.nama_organisasi_baharu = null; 
        } else {
            payload.unit_organisasi_baharu = null;
            payload.nama_organisasi_baharu = null;
        }

        // Validasi Ekstra untuk ID DELIMa
        if (payload.id_delima && !payload.id_delima.endsWith('@moe-dl.edu.my')) {
            return Swal.fire('Format Tidak Sah', 'ID DELIMa Guru mestilah berakhir dengan @moe-dl.edu.my', 'error');
        }
        
        if (!payload.nama || !payload.id_delima || !payload.catatan) {
            return Swal.fire('Tidak Lengkap', 'Sila pastikan semua ruangan wajib diisi.', 'warning');
        }
    } 
    // Logik Pengekstrakan Data Borang Murid
    else {
        payload.nama = document.getElementById('muridNama').value.trim().toUpperCase();
        payload.id_delima = document.getElementById('muridIdDelima').value.trim().toLowerCase();
        payload.catatan = document.getElementById('muridCatatan').value;
        
        // Auto-set OU jika tarik masuk
        if (payload.catatan === 'Berpindah MASUK ke sekolah ini') {
            payload.unit_organisasi_baharu = kod.toLowerCase();
            payload.nama_organisasi_baharu = null; 
        } else {
            payload.unit_organisasi_baharu = null;
            payload.nama_organisasi_baharu = null;
        }

        // Validasi Ekstra untuk ID DELIMa
        if (payload.id_delima && !payload.id_delima.endsWith('@moe-dl.edu.my')) {
            return Swal.fire('Format Tidak Sah', 'ID DELIMa Murid mestilah berakhir dengan @moe-dl.edu.my', 'error');
        }

        if (!payload.nama || !payload.id_delima || !payload.catatan) {
            return Swal.fire('Tidak Lengkap', 'Sila pastikan semua ruangan wajib diisi.', 'warning');
        }
    }

    toggleLoadingLocal(true);
    try {
        // Memanggil API Service yang dikhususkan (DelimaService)
        await DelimaService.createStatus(payload);
        
        toggleLoadingLocal(false);
        Swal.fire({
            icon: 'success',
            title: 'Berjaya Direkodkan',
            text: `Status permohonan ID DELIMa bagi ${kategori.toLowerCase()} telah dihantar ke PPD untuk proses selanjutnya.`,
            confirmButtonColor: kategori === 'GURU' ? '#2563eb' : '#0891b2' // Warna ikut tema
        }).then(() => {
            // Reset UI selepas berjaya
            if (kategori === 'GURU') {
                document.getElementById('formStatusGuru').reset();
                window.muatSenaraiDelima('GURU');
            } else {
                document.getElementById('formStatusMurid').reset();
                window.muatSenaraiDelima('MURID');
            }
        });
    } catch (e) {
        toggleLoadingLocal(false);
        Swal.fire('Ralat Rangkaian', 'Gagal memuat naik rekod status ke pangkalan data. Sila cuba lagi sebentar lagi.', 'error');
    }
};

window.muatSenaraiDelima = async function(kategori) {
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    const tbodyId = kategori === 'GURU' ? 'senaraiGuruContainer' : 'senaraiMuridContainer';
    const tbody = document.getElementById(tbodyId);
    
    if (!tbody) return;
    
    tbody.innerHTML = `<tr><td colspan="4" class="p-12 text-center text-slate-400 font-medium animate-pulse"><i class="fas fa-sync fa-spin text-xl mb-2 block text-slate-300"></i> Menyemak senarai pangkalan data...</td></tr>`;

    try {
        const data = await DelimaService.getBySchool(kod, kategori);
        
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-400 italic bg-slate-50/50">Tiada rekod serahan perubahan status bagi kategori ${kategori.toLowerCase()} dijumpai.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((item, index) => {
            const statusBadge = item.status_proses === 'SELESAI' 
                ? `<span class="inline-flex items-center justify-center bg-green-100 text-green-700 text-[9px] px-3 py-1.5 rounded-full font-black border border-green-200 shadow-sm w-full uppercase tracking-widest"><i class="fas fa-check mr-1.5"></i> SELESAI</span>` 
                : `<span class="inline-flex items-center justify-center bg-amber-100 text-amber-700 text-[9px] px-3 py-1.5 rounded-full font-black animate-pulse border border-amber-200 shadow-sm w-full uppercase tracking-widest"><i class="fas fa-clock mr-1.5"></i> PROSES</span>`;
            
            let detailsHtml = '';
            
            // Paparan Lencana "Mohon Tarik" untuk Guru dan Murid
            const isTarikMasuk = item.catatan === 'Berpindah MASUK ke sekolah ini';
            const colorTheme = kategori === 'GURU' ? 'blue' : 'cyan';
            
            const destinasiBadge = isTarikMasuk 
                ? `<br><span class="text-${colorTheme}-700 font-bold mt-2 block text-xs bg-${colorTheme}-50 p-2.5 rounded-lg border border-${colorTheme}-100 shadow-sm"><i class="fas fa-download mr-1.5 text-${colorTheme}-500"></i> Mohon Tarik Ke: <br><span class="text-[10px] text-slate-500 font-mono mt-1 block tracking-wider bg-white px-2 py-1 rounded inline-block">OU: ${item.unit_organisasi_baharu || kod}</span></span>` 
                : '';
            
            detailsHtml = `
                <div class="font-bold text-slate-700 text-xs mb-1 uppercase bg-slate-100 inline-block px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">${item.catatan}</div>
                ${destinasiBadge}
            `;

            return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 group">
                <td class="px-6 py-5 text-center font-mono font-bold text-slate-400 text-xs align-top pt-6">${index + 1}</td>
                <td class="px-6 py-5 align-top">
                    <div class="font-bold text-slate-800 text-sm leading-snug mb-2 uppercase group-hover:text-${colorTheme}-600 transition-colors">${item.nama}</div>
                    <div class="text-[10px] text-slate-500 font-mono font-bold bg-white px-2 py-1 rounded-md inline-block border border-slate-200 shadow-sm">${item.id_delima}</div>
                    <div class="text-[9px] text-slate-400 mt-2.5 font-semibold tracking-wider"><i class="far fa-calendar-alt mr-1"></i> ${new Date(item.created_at).toLocaleDateString('ms-MY')}</div>
                </td>
                <td class="px-6 py-5 align-top pt-6">${detailsHtml}</td>
                <td class="px-6 py-5 text-center align-top pt-6">${statusBadge}</td>
            </tr>`;
        }).join('');
        
    } catch (e) {
        console.error("[Helpdesk] Senarai DELIMa error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-red-500 font-bold bg-red-50 border border-red-100 rounded-xl"><i class="fas fa-wifi text-lg mb-2 block"></i> Gagal menyambung ke pangkalan data.</td></tr>`;
    }
};