/**
 * ADMIN MODULE: DASHBOARD (TAILWIND EDITION - COMPREHENSIVE V3.0)
 * Menguruskan senarai sekolah, filter berwarna, dan status data.
 * --- UPDATE V3.0 ---
 * 1. UI: Kad profil dinaik taraf kepada grid 4 lajur (PGB | GPK | ICT | ADM) beserta pautan WhatsApp.
 * 2. Carian: Menyokong carian terus menggunakan nama PGB dan GPK.
 * 3. Eksport: Format CSV diperluas untuk memasukkan profil pengurusan tertinggi sekolah.
 */

import { SchoolService } from '../services/school.service.js';
import { toggleLoading, generateWhatsAppLink } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

let dashboardData = [];
let currentFilteredList = [];
let activeStatus = 'ALL';
let activeType = 'ALL';
let searchTerm = ''; 
let reminderQueue = [];
let qIndex = 0;

// --- INITIALIZATION ---
window.fetchDashboardData = async function() {
    toggleLoading(true);
    try {
        const data = await SchoolService.getAll();
        window.globalDashboardData = data; 
        
        // Asingkan PPD (M030) daripada visual dashboard utama
        dashboardData = data.filter(item => item.kod_sekolah !== 'M030');
        
        renderFilters();
        window.runFilter();

    } catch (err) { 
        console.error("Dashboard Error:", err);
        Swal.fire('Ralat', 'Gagal memuatkan data dashboard.', 'error'); 
    } finally {
        toggleLoading(false); 
    }
};

// --- FILTER LOGIC (COLORFUL UI) ---
function renderFilters() {
    const types = [...new Set(dashboardData.map(i => i.jenis))].sort();
    let opts = `<option value="ALL">SEMUA JENIS</option>`;
    types.forEach(t => opts += `<option value="${t}">${t}</option>`);
    
    const container = document.getElementById('filterContainer');
    if(container) {
        container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div class="flex flex-wrap gap-2 justify-center md:justify-start">
            
            <!-- Butang SEMUA (Kelabu) -->
            <button onclick="setFilter('ALL')" id="badgeAll" class="filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200">
                Semua <span id="cntAll" class="bg-white text-slate-600 px-2 py-0.5 rounded-full text-[10px] shadow-sm">0</span>
            </button>

            <!-- Butang LENGKAP (Hijau) -->
            <button onclick="setFilter('LENGKAP')" id="badgeLengkap" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                Lengkap <span id="cntLengkap" class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

            <!-- Butang BELUM (Merah) -->
            <button onclick="setFilter('BELUM')" id="badgeBelum" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-red-200 text-red-600 hover:bg-red-50">
                Belum <span id="cntBelum" class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

            <!-- Butang SAMA (Ungu) -->
            <button onclick="setFilter('SAMA')" id="badgeSama" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-purple-200 text-purple-600 hover:bg-purple-50">
                Sama <span id="cntSama" class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

            <!-- Butang BERBEZA (Oren/Amber) -->
            <button onclick="setFilter('BERBEZA')" id="badgeBerbeza" class="filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-amber-200 text-amber-600 hover:bg-amber-50">
                Berbeza <span id="cntBerbeza" class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px]">0</span>
            </button>

          </div>
          <div class="w-full md:w-auto">
            <select class="w-full md:w-48 px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-brand-500 bg-slate-50" onchange="setType(this.value)">${opts}</select>
          </div>
        </div>`;
    }
}

window.setFilter = function(s) { activeStatus = s; window.runFilter(); }
window.setType = function(t) { activeType = t; window.runFilter(); }
window.handleSearch = function(val) { searchTerm = val.toUpperCase().trim(); window.runFilter(); }

window.runFilter = function() {
    const filtered = dashboardData.filter(i => {
        const statMatch = (activeStatus === 'ALL') || 
                          (activeStatus === 'LENGKAP' && i.is_lengkap) || 
                          (activeStatus === 'BELUM' && !i.is_lengkap) ||
                          (activeStatus === 'SAMA' && i.is_sama) ||
                          (activeStatus === 'BERBEZA' && i.is_berbeza); 
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        
        // Carian Super: Merangkumi Nama Sekolah, Kod, PGB dan GPK
        const searchMatch = !searchTerm || 
                            i.kod_sekolah.includes(searchTerm) || 
                            i.nama_sekolah.includes(searchTerm) ||
                            (i.nama_pgb && i.nama_pgb.includes(searchTerm)) ||
                            (i.nama_gpk && i.nama_gpk.includes(searchTerm));
                            
        return statMatch && typeMatch && searchMatch;
    });

    currentFilteredList = filtered;
    updateBadgeCounts();
    renderGrid(filtered);
};

function updateBadgeCounts() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-1', 'shadow-md', 'scale-105');
        if(btn.id === 'badgeAll') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
        if(btn.id === 'badgeLengkap') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50";
        if(btn.id === 'badgeBelum') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-red-200 text-red-600 hover:bg-red-50";
        if(btn.id === 'badgeSama') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-purple-200 text-purple-600 hover:bg-purple-50";
        if(btn.id === 'badgeBerbeza') btn.className = "filter-btn px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-amber-200 text-amber-600 hover:bg-amber-50";
    });

    const map = { 'ALL': 'badgeAll', 'LENGKAP': 'badgeLengkap', 'BELUM': 'badgeBelum', 'SAMA': 'badgeSama', 'BERBEZA': 'badgeBerbeza' };
    const activeId = map[activeStatus];
    if (activeId) {
        const btn = document.getElementById(activeId);
        if (btn) {
            if(activeStatus === 'ALL') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-600 text-white border-slate-600 shadow-md scale-105";
            if(activeStatus === 'LENGKAP') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-emerald-500 text-white border-emerald-500 shadow-md scale-105";
            if(activeStatus === 'BELUM') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-red-500 text-white border-red-500 shadow-md scale-105";
            if(activeStatus === 'SAMA') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-purple-500 text-white border-purple-500 shadow-md scale-105";
            if(activeStatus === 'BERBEZA') btn.className = "filter-btn active px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-amber-500 text-white border-amber-500 shadow-md scale-105";
            
            const span = btn.querySelector('span');
            if(span) span.className = "bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px]";
        }
    }
    
    const context = dashboardData.filter(i => {
        const typeMatch = (activeType === 'ALL') || (i.jenis === activeType);
        const searchMatch = !searchTerm || 
                            i.kod_sekolah.includes(searchTerm) || 
                            i.nama_sekolah.includes(searchTerm) ||
                            (i.nama_pgb && i.nama_pgb.includes(searchTerm)) ||
                            (i.nama_gpk && i.nama_gpk.includes(searchTerm));
        return typeMatch && searchMatch;
    });
    
    const setTxt = (id, count) => { if(document.getElementById(id)) document.getElementById(id).innerText = count; };
    setTxt('cntAll', context.length);
    setTxt('cntLengkap', context.filter(i => i.is_lengkap).length);
    setTxt('cntBelum', context.filter(i => !i.is_lengkap).length);
    setTxt('cntSama', context.filter(i => i.is_sama).length);
    setTxt('cntBerbeza', context.filter(i => i.is_berbeza).length);
}

function renderGrid(data) {
    const wrapper = document.getElementById('schoolGridWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = "";
    
    if (data.length === 0) { 
        wrapper.innerHTML = `<div class="col-span-full text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 font-medium">Tiada data untuk paparan ini.</div>`; 
        return; 
    }

    const groups = data.reduce((acc, i) => { (acc[i.jenis] = acc[i.jenis] || []).push(i); return acc; }, {});

    Object.keys(groups).sort().forEach(jenis => {
        const items = groups[jenis];
        
        let html = `<div class="col-span-full mt-6 mb-2 border-b border-slate-200 pb-2"><h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-brand-500"></div> ${jenis} (${items.length})</h3></div>`;
        
        items.forEach(s => {
            const statusBadge = s.is_lengkap 
                ? `<span class="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full border border-emerald-200"><i class="fas fa-check"></i> LENGKAP</span>` 
                : `<span class="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full border border-red-200"><i class="fas fa-times"></i> BELUM</span>`;
            
            // Jana Pautan WhatsApp untuk ke-4 profil (Suntikan Parameter)
            const linkPGB = generateWhatsAppLink(s.nama_pgb, s.no_telefon_pgb, true);
            const linkGPK = generateWhatsAppLink(s.nama_gpk, s.no_telefon_gpk, true);
            const linkG = generateWhatsAppLink(s.nama_gpict, s.no_telefon_gpict, true);
            const linkA = generateWhatsAppLink(s.nama_admin_delima, s.no_telefon_admin_delima, true);

            // Logik Komponen Butang WhatsApp Padat
            const renderActions = (linkRaw, hasTele) => {
                let btns = '<div class="flex items-center gap-1.5 justify-center">';
                if(hasTele) btns += `<span class="text-blue-500 text-[10px]" title="Bot: Berdaftar"><i class="fas fa-check-circle"></i></span>`;
                else btns += `<span class="text-slate-300 text-[10px]" title="Bot: Belum"><i class="fas fa-circle"></i></span>`;
                
                if(linkRaw) {
                    btns += `<a href="${linkRaw}" target="_blank" onclick="event.stopPropagation()" class="w-5 h-5 rounded bg-slate-200 hover:bg-green-100 hover:text-green-600 text-slate-500 flex items-center justify-center transition" title="WhatsApp Terus"><i class="fab fa-whatsapp text-[10px]"></i></a>`;
                } else {
                    btns += `<span class="w-5 h-5 rounded bg-slate-100 text-slate-300 flex items-center justify-center cursor-not-allowed" title="Tiada Nombor"><i class="fab fa-whatsapp text-[10px]"></i></span>`;
                }
                btns += '</div>';
                return btns;
            };

            html += `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden group flex flex-col h-full" onclick="viewSchoolProfile('${s.kod_sekolah}')">
                <div class="p-5 flex-grow">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="text-xs font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">${s.kod_sekolah}</span>
                        </div>
                        ${statusBadge}
                    </div>
                    <h4 class="font-bold text-slate-800 text-sm leading-snug group-hover:text-brand-600 transition mb-1 whitespace-normal">${s.nama_sekolah}</h4>
                    
                    <button onclick="event.stopPropagation(); window.resetPasswordSekolah('${s.kod_sekolah}')" class="text-[10px] font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                        <i class="fas fa-key"></i> Reset Password
                    </button>
                </div>
                
                <!-- Grid Bawah (Footer) - Naik Taraf 4 Lajur -->
                <div class="bg-slate-50 border-t border-slate-100 p-2 grid grid-cols-4 divide-x divide-slate-200 mt-auto">
                    <div class="px-1 flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition rounded">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter" title="${s.nama_pgb || 'PGB'}">PGB</span>
                        ${renderActions(linkPGB, s.telegram_id_pgb)}
                    </div>
                    <div class="px-1 flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition rounded">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter" title="${s.nama_gpk || 'GPK'}">GPK</span>
                        ${renderActions(linkGPK, s.telegram_id_gpk)}
                    </div>
                    <div class="px-1 flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition rounded">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter" title="${s.nama_gpict || 'GPICT'}">ICT</span>
                        ${renderActions(linkG, s.telegram_id_gpict)}
                    </div>
                    <div class="px-1 flex flex-col items-center justify-center gap-1 hover:bg-slate-100 transition rounded">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-tighter" title="${s.nama_admin_delima || 'ADMIN'}">ADM</span>
                        ${renderActions(linkA, s.telegram_id_admin)}
                    </div>
                </div>
            </div>`;
        });
        wrapper.innerHTML += html;
    });
}

// --- UTILS & EXPORTS ---

/**
 * FIXED: Menghalakan pandangan admin ke profil sekolah yang dipilih.
 * Menggunakan localStorage untuk integriti data silang modul.
 */
window.viewSchoolProfile = function(kod) {
    // SULAM (Surgical Injection): Tukar sessionStorage -> localStorage
    localStorage.setItem(APP_CONFIG.SESSION.USER_KOD, kod);
    window.location.href = 'user.html'; 
};

window.eksportDataTapis = function() {
    if (!currentFilteredList || currentFilteredList.length === 0) return Swal.fire('Tiada Data', '', 'info'); 
    
    // Kemas kini tajuk CSV untuk merangkumi profil PGB dan GPK
    let csvContent = "BIL,KOD,NAMA,JENIS,NAMA PGB,TEL PGB,NAMA GPK,TEL GPK,NAMA GPICT,TEL GPICT,NAMA ADMIN,TEL ADMIN,STATUS PENGISIAN\n";
    
    currentFilteredList.forEach((s, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        let row = [
            index + 1, clean(s.kod_sekolah), clean(s.nama_sekolah), clean(s.jenis),
            clean(s.nama_pgb), clean(s.no_telefon_pgb),
            clean(s.nama_gpk), clean(s.no_telefon_gpk),
            clean(s.nama_gpict), clean(s.no_telefon_gpict), 
            clean(s.nama_admin_delima), clean(s.no_telefon_admin_delima),
            s.is_lengkap ? 'LENGKAP' : 'BELUM'
        ];
        csvContent += row.join(",") + "\n";
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Profil_Penuh_Sekolah_${activeStatus}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
};

window.janaSenaraiTelegram = function() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    let txt = `**STATUS PENGISIAN SMPID (${activeType})**\n\n`;
    const pending = list.filter(i => !i.is_lengkap);
    
    if(pending.length === 0) return Swal.fire('Hebat', 'Semua lengkap!', 'success'); 
    
    pending.forEach(i => txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`);
    txt += `\nMohon tindakan segera.`;
    navigator.clipboard.writeText(txt).then(() => Swal.fire('Disalin!', 'Senarai disalin.', 'success'));
};

// --- QUEUE SYSTEM (MODAL CONTROL) ---
window.mulaTindakanPantas = function() {
    let list = (activeType === 'ALL') ? dashboardData : dashboardData.filter(i => i.jenis === activeType);
    reminderQueue = [];
    
    list.forEach(i => {
        if (i.no_telefon_gpict && !i.telegram_id_gpict) {
            reminderQueue.push({role:'GPICT', ...i, targetName: i.nama_gpict, targetTel: i.no_telefon_gpict});
        }
        if (i.no_telefon_admin_delima && !i.telegram_id_admin) {
            reminderQueue.push({role:'Admin', ...i, targetName: i.nama_admin_delima, targetTel: i.no_telefon_admin_delima});
        }
    });
    
    if (reminderQueue.length === 0) return Swal.fire('Tiada Sasaran', 'Tiada data untuk disusuli.', 'info'); 
    qIndex = 0; 
    document.getElementById('queueModal').classList.remove('hidden'); 
    renderQueue();
};

function renderQueue() {
    if (qIndex >= reminderQueue.length) { 
        document.getElementById('queueModal').classList.add('hidden'); 
        Swal.fire('Selesai', 'Semakan tamat.', 'success'); 
        return; 
    }
    const item = reminderQueue[qIndex];
    document.getElementById('qProgress').innerText = `${qIndex + 1} / ${reminderQueue.length}`;
    document.getElementById('qRoleBadge').innerText = item.role;
    document.getElementById('qSchoolName').innerText = item.nama_sekolah;
    document.getElementById('qCode').innerText = item.kod_sekolah;
    document.getElementById('qPersonName').innerText = item.targetName || "-";
    
    const link = generateWhatsAppLink(item.targetName, item.targetTel);
    const btn = document.getElementById('qWaBtn');
    
    if (link) { 
        btn.href = link; 
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else { 
        btn.removeAttribute('href'); 
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

window.nextQueue = function() { qIndex++; renderQueue(); }
window.prevQueue = function() { if(qIndex > 0) qIndex--; renderQueue(); }