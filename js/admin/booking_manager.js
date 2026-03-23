/**
 * ADMIN MODULE: BOOKING MANAGER (PRO EDITION - V8.1 SINGLE-ROW CONSTRAINT FIX)
 * Fungsi: Menguruskan tempahan bimbingan bagi pihak PPD.
 * --- UPDATE V8.1 (CONSTRAINT FIX) ---
 * 1. Menghapuskan logik pengumpulan (grouping) yang lama kerana pangkalan data
 * kini menggunakan "Single-Row Storage" (1 Tarikh = 1 Baris sahaja).
 * 2. Memecahkan rentetan kod_ppd (cth: "M010,M020") kepada tatasusunan (array) 
 * secara masa nyata untuk paparan UI lencana dan kotak semak.
 */

import { BookingService } from '../services/booking.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- STATE MANAGEMENT ---
const todayDate = new Date();
let adminCurrentMonth = todayDate.getMonth();
let adminCurrentYear = todayDate.getFullYear();

// LOGIK AUTO-MINGGU: Mengira minggu berdasarkan tarikh hari ini
let adminActiveWeek = Math.ceil(todayDate.getDate() / 7); 

let activeBookings = [];
let lockedDatesList = [];
let adminSelectedDate = null; 

const ALLOWED_DAYS = [2, 3, 4, 6]; // Selasa, Rabu, Khamis, Sabtu
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

/**
 * Inisialisasi Modul Booking Admin (EntryPoint)
 */
window.initAdminBooking = async function() {
    const wrapper = document.getElementById('tab-tempahan');
    if (!wrapper) return;

    if (!document.getElementById('bookingAdminContent')) {
        wrapper.innerHTML = `
            <div class="p-6 md:p-8" id="bookingAdminContent">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b-2 border-slate-100 pb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Pengurusan Bimbingan & Bengkel</h2>
                        <p class="text-slate-500 text-sm font-medium">Kawal baki slot, kunci tarikh daerah, dan semak tempahan aktif.</p>
                    </div>
                    <div class="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border-2 border-slate-200">
                        <button onclick="switchAdminBookingView('calendar')" id="btnViewCal" class="px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105">KALENDAR</button>
                        <button onclick="switchAdminBookingView('list')" id="btnViewList" class="px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all">SENARAI AKTIF</button>
                    </div>
                </div>

                <div id="adminBookingCalendarView" class="animate-fade-up">
                    <div class="grid grid-cols-1 lg:grid-cols-1 gap-8">
                        <div>
                            <div class="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm">
                                <div class="p-5 bg-slate-50/50 border-b-2 border-slate-100 flex items-center justify-between">
                                    <button onclick="changeAdminMonth(-1)" class="w-10 h-10 rounded-xl bg-white hover:shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-left"></i></button>
                                    <h3 id="adminMonthLabel" class="font-black text-slate-800 uppercase tracking-tighter text-base">...</h3>
                                    <button onclick="changeAdminMonth(1)" class="w-10 h-10 rounded-xl bg-white hover:shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-right"></i></button>
                                </div>
                                
                                <div class="p-6">
                                    <div class="overflow-x-auto pb-4 mb-4">
                                        <div class="flex gap-2 min-w-max" id="adminWeekTabsContainer"></div>
                                    </div>

                                    <div class="flex flex-wrap gap-4 justify-center mb-6 bg-slate-100/50 p-4 rounded-2xl border-2 border-slate-200/50">
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-white border-2 border-slate-300 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">Kosong</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-100 border-2 border-amber-400 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">1 Slot</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-red-100 border-2 border-red-400 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">Penuh</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-purple-100 border-2 border-purple-400 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-500 uppercase">Dikunci</span></div>
                                        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-slate-200 border-2 border-slate-300 shadow-sm"></span> <span class="text-[10px] font-bold text-slate-400 uppercase">Lepas / Tutup</span></div>
                                    </div>

                                    <div id="adminCalendarGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="adminBookingListView" class="hidden animate-fade-up">
                    <div class="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm">
                        <div class="p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                            <i class="fas fa-info-circle text-amber-500 mt-0.5"></i>
                            <p class="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Hanya tempahan dan kunci tarikh bagi hari ini dan akan datang sahaja dipaparkan.</p>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b-2 border-slate-100">
                                    <tr>
                                        <th class="px-8 py-5">Tarikh & Masa</th>
                                        <th class="px-8 py-5">Sekolah / Maklumat Kunci</th>
                                        <th class="px-8 py-5">PIC / Log Admin</th>
                                        <th class="px-8 py-5 text-center">Tindakan</th>
                                    </tr>
                                </thead>
                                <tbody id="adminBookingTableBody" class="divide-y divide-slate-100"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    window.renderAdminBookingCalendar();
    window.loadAdminBookingList();
};

window.switchAdminBookingView = function(view) {
    const btnCal = document.getElementById('btnViewCal');
    const btnList = document.getElementById('btnViewList');
    const viewCal = document.getElementById('adminBookingCalendarView');
    const viewList = document.getElementById('adminBookingListView');

    if (!btnCal || !btnList || !viewCal || !viewList) return;

    if (view === 'calendar') {
        btnCal.className = "px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105";
        btnList.className = "px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all";
        viewCal.classList.remove('hidden');
        viewList.classList.add('hidden');
    } else {
        btnList.className = "px-6 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105";
        btnCal.className = "px-6 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all";
        viewList.classList.remove('hidden');
        viewCal.classList.add('hidden');
        
        // Muat semula senarai apabila tab dibuka
        window.loadAdminBookingList();
    }
};

window.switchAdminWeek = function(weekNum) {
    adminActiveWeek = weekNum;
    window.renderAdminBookingCalendar();
};

/**
 * Membina Grid Kalendar (Admin Side) dengan Sokongan Pelbagai Skop Kunci
 */
window.renderAdminBookingCalendar = async function() {
    const grid = document.getElementById('adminCalendarGrid');
    const label = document.getElementById('adminMonthLabel');
    const tabsContainer = document.getElementById('adminWeekTabsContainer');
    
    if (!grid || !label || !tabsContainer) return;

    grid.innerHTML = `<div class="col-span-full py-20 text-center flex flex-col items-center justify-center">
        <i class="fas fa-circle-notch fa-spin text-slate-300 text-3xl mb-4"></i>
        <p class="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Menjana Kalendar...</p>
    </div>`;
    
    label.innerText = `${MALAY_MONTHS[adminCurrentMonth]} ${adminCurrentYear}`;

    try {
        const daysInMonth = new Date(adminCurrentYear, adminCurrentMonth + 1, 0).getDate();
        const pad = (n) => n.toString().padStart(2, '0');
        const monthPrefix = `${adminCurrentYear}-${pad(adminCurrentMonth + 1)}`;

        // Ambil data bulan semasa dan senarai kunci global untuk UI Lencana
        const [{ bookedSlots }, allLocks] = await Promise.all([
            BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth),
            BookingService.getAllLocks()
        ]);
        
        // Tapis kunci tarikh untuk bulan paparan semasa
        const activeMonthLocks = allLocks.filter(l => l.tarikh.startsWith(monthPrefix));
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalWeeks = Math.ceil(daysInMonth / 7);
        if (adminActiveWeek > totalWeeks) adminActiveWeek = 1;

        let tabsHtml = '';
        for (let w = 1; w <= totalWeeks; w++) {
            const isActive = adminActiveWeek === w;
            const activeClass = isActive ? 'week-tab-admin-active' : 'week-tab-admin-inactive';
            tabsHtml += `<button onclick="switchAdminWeek(${w})" class="week-tab-admin ${activeClass}">MINGGU ${w}</button>`;
        }
        tabsContainer.innerHTML = tabsHtml;

        const startDay = (adminActiveWeek - 1) * 7 + 1;
        const endDay = Math.min(adminActiveWeek * 7, daysInMonth);

        grid.innerHTML = "";
        let hasContent = false;

        for (let d = startDay; d <= endDay; d++) {
            const dateString = `${monthPrefix}-${pad(d)}`;
            const dateObj = new Date(adminCurrentYear, adminCurrentMonth, d);
            dateObj.setHours(0, 0, 0, 0);

            const dayOfWeek = dateObj.getDay(); 
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            
            // Dapatkan kunci untuk tarikh ini (Kini sentiasa hanya maksimum 1 baris)
            const lockObj = activeMonthLocks.find(l => l.tarikh.split('T')[0] === dateString);
            const isLocked = !!lockObj;
            
            const slotsTaken = bookedSlots[dateString] || [];
            const isPast = dateObj < today;

            let status = 'open';
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';
            const maxCapacity = (dayOfWeek === 6) ? 1 : 2;

            // LOGIK KAPASITI
            const isFullDayTaken = slotsTaken.includes('1 HARI');
            let filledCount = slotsTaken.length;
            if (isFullDayTaken) filledCount = 2;

            if (!isAllowedDay) {
                status = 'closed';
                statusText = 'TIADA SESI';
                statusIcon = 'fa-ban';
            } 
            else if (isPast) {
                status = 'closed';
                statusText = 'LEPAS';
                statusIcon = 'fa-history';
            } 
            else if (isLocked) {
                status = 'locked';
                statusText = 'DIKUNCI';
                statusIcon = 'fa-lock';
            } 
            else if (filledCount >= maxCapacity) {
                status = 'full';
                statusText = 'PENUH';
                statusIcon = 'fa-users-slash';
            } 
            else if (filledCount > 0) {
                status = 'partial';
                statusText = '1 SLOT BAKI';
                statusIcon = 'fa-exclamation-circle';
            }

            let iconColor = 'text-brand-600 bg-brand-100';
            if (status === 'full') iconColor = 'text-red-600 bg-red-100';
            if (status === 'locked') iconColor = 'text-purple-600 bg-purple-100';
            if (status === 'partial') iconColor = 'text-amber-600 bg-amber-100';
            if (status === 'closed') iconColor = 'text-slate-400 bg-slate-200';

            // PAPARAN NOTA KUNCI YANG KAYA (RICH UI MULTI-REGION)
            let lockedMsg = '';
            let existingScopes = ['ALL'];
            
            if (isLocked) {
                // Ekstrak rentetan menjadi tatasusunan (Array) untuk logik seterusnya
                existingScopes = (lockObj.kod_ppd || 'ALL').split(',');
                
                const isAll = existingScopes.includes('ALL');
                const scopeLabel = isAll ? 'KUNCI NEGERI' : `KUNCI DAERAH (${existingScopes.join(', ')})`;
                const scopeClass = isAll ? 'bg-fuchsia-600 text-white border-fuchsia-700' : 'bg-purple-200 text-purple-800 border-purple-300';
                const displayNote = lockObj.komen || 'TIADA CATATAN';
                
                lockedMsg = `
                <div class="mt-1.5 flex flex-col gap-1">
                    <span class="${scopeClass} px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest w-fit border shadow-sm">${scopeLabel}</span>
                    <div class="text-[9px] text-purple-700 font-bold uppercase wrap-safe leading-tight bg-purple-50 p-1.5 rounded border border-purple-200">
                        ${displayNote}
                    </div>
                </div>`;
            }

            const isSelected = (dateString === adminSelectedDate);
            const hasBookings = (filledCount > 0); 

            const card = document.createElement('div');
            card.className = `day-card card-${status} ${isSelected ? 'card-active' : ''}`;
            
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">${DAY_NAMES[dayOfWeek]}</span>
                        <span class="text-3xl font-black text-slate-800 leading-none">${d}</span>
                    </div>
                    <div class="${iconColor} w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm transition-transform group-hover:rotate-12">
                        <i class="fas ${statusIcon}"></i>
                    </div>
                </div>
                
                <div class="mt-auto pt-4">
                    <span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${iconColor} border border-black/5">
                        ${statusText}
                    </span>
                    ${lockedMsg}
                </div>
            `;

            const clickNote = isLocked ? lockObj.komen : '';

            if (!isPast && isAllowedDay) {
                card.onclick = () => {
                    adminSelectedDate = dateString;
                    window.renderAdminBookingCalendar(); 
                    window.handleAdminDateAction(dateString, isLocked, hasBookings, clickNote, existingScopes);
                };
            } else if (!isPast && isLocked) {
                card.onclick = () => {
                    adminSelectedDate = dateString;
                    window.renderAdminBookingCalendar(); 
                    window.handleAdminDateAction(dateString, true, false, clickNote, existingScopes);
                };
            }

            grid.appendChild(card);
            hasContent = true;
        }

        if (!hasContent) {
            grid.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400 text-sm font-medium italic">Tiada tarikh aktif dalam minggu ini.</div>`;
        }

    } catch (e) {
        console.error("[AdminBooking] Calendar Error:", e);
        grid.innerHTML = `<div class="col-span-full py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl border-2 border-red-100">Ralat pangkalan data kalendar.</div>`;
    }
};

/**
 * Mengawal tindakan kunci/buka tarikh dan kemaskini skop berbilang kawasan.
 */
window.handleAdminDateAction = async function(iso, currentlyLocked, hasBookings, currentNote = '', existingScopesParam = 'ALL') {
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'M030';
    
    // Halang pentadbir daripada mengunci tarikh yang telah ada tempahan
    if (!currentlyLocked && hasBookings) {
        Swal.fire({
            icon: 'error',
            title: 'Halangan Keselamatan',
            html: `<div class="text-center">
                     <p class="text-sm font-bold text-red-600 mb-2">TARIKH INI MEMPUNYAI TEMPAHAN AKTIF.</p>
                     <p class="text-xs text-slate-500">Anda tidak boleh mengunci tarikh yang telah ditempah oleh sekolah. Sila batalkan tempahan sekolah tersebut dahulu di senarai bawah.</p>
                   </div>`,
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'rounded-3xl' }
        });
        adminSelectedDate = null;
        window.renderAdminBookingCalendar();
        return; 
    }

    // Format penangkapan skop ke dalam tatasusunan yang selamat
    let existingScopeArray = Array.isArray(existingScopesParam) ? existingScopesParam : (typeof existingScopesParam === 'string' ? existingScopesParam.split(',') : ['ALL']);
    let capturedScopes = currentlyLocked ? existingScopeArray : [userKod];

    // Bina Ruang Checkbox Pemilihan Skop Kunci (Hanya untuk Super Admin/JPNMEL)
    let scopeHtml = '';
    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
        let checkboxes = `
            <label class="flex items-center gap-3 p-3 border-b border-slate-100 bg-white cursor-pointer hover:bg-purple-50 transition rounded-t-xl">
                <input type="checkbox" class="swal-scope-cb w-5 h-5 accent-purple-600 cursor-pointer" value="ALL" ${capturedScopes.includes('ALL') ? 'checked' : ''} onchange="if(this.checked) document.querySelectorAll('.swal-scope-cb').forEach(cb => { if(cb.value !== 'ALL') cb.checked = false; })">
                <span class="text-xs font-black text-slate-700 tracking-wider">SEMUA DAERAH (NEGERI MELAKA)</span>
            </label>
        `;
        
        if (APP_CONFIG.PPD_MAPPING) {
            for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                const isChecked = capturedScopes.includes(k) && !capturedScopes.includes('ALL') ? 'checked' : '';
                checkboxes += `
                <label class="flex items-center gap-3 p-3 border-b border-slate-100 bg-white cursor-pointer hover:bg-slate-50 transition last:border-b-0 last:rounded-b-xl">
                    <input type="checkbox" class="swal-scope-cb w-5 h-5 accent-purple-600 cursor-pointer" value="${k}" ${isChecked} onchange="if(this.checked) document.querySelector('.swal-scope-cb[value=\\'ALL\\']').checked = false;">
                    <span class="text-xs font-bold text-slate-700">${v} (${k})</span>
                </label>`;
            }
        }
        
        scopeHtml = `
            <div class="mt-4 text-left px-4">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><i class="fas fa-map-marker-alt text-purple-400 mr-1"></i> Skop Kunci Tarikh (Pilih 1 Atau Lebih)</label>
                <div class="max-h-48 overflow-y-auto custom-scrollbar bg-white rounded-xl border-2 border-slate-200 shadow-inner">
                    ${checkboxes}
                </div>
            </div>
        `;
    }

    const getSelectedScopes = () => {
        if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
            const cbs = document.querySelectorAll('.swal-scope-cb:checked');
            const vals = Array.from(cbs).map(cb => cb.value);
            if (vals.includes('ALL')) return ['ALL'];
            return vals;
        }
        return [userKod];
    };

    const titleText = currentlyLocked ? 'Pengurusan Kunci Tarikh' : 'Kunci Tarikh Ini?';
    const confirmText = currentlyLocked ? 'KEMASKINI CATATAN / KAWASAN' : 'KUNCI SEKARANG';

    const result = await Swal.fire({
        title: titleText,
        html: `
            <div class="text-center mb-4"><span class="text-3xl font-black text-purple-600">${iso}</span></div>
            <p class="text-sm text-slate-500 mb-4 px-4 font-medium">Nyatakan sebab atau catatan rasmi di bawah.</p>
            <div class="px-4">
                <input id="swal-note" class="w-full p-3 rounded-xl border-2 border-slate-200 font-bold uppercase text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 text-slate-800 transition" placeholder="Contoh: CUTI UMUM / BENGKEL..." value="${currentNote}">
            </div>
            ${scopeHtml}
        `,
        showCancelButton: true,
        showDenyButton: currentlyLocked,
        confirmButtonColor: '#7c3aed',
        denyButtonColor: '#10b981', 
        cancelButtonColor: '#64748b',
        confirmButtonText: confirmText,
        denyButtonText: 'BUKA KUNCI TERPILIH',
        cancelButtonText: 'BATAL',
        customClass: { 
            popup: 'rounded-3xl border-2 border-slate-100', 
            confirmButton: 'font-bold tracking-wider', 
            denyButton: 'font-bold tracking-wider', 
            cancelButton: 'font-bold tracking-wider' 
        },
        preDeny: () => {
            // Tangkap nilai skop sejurus sebelum tetingkap dimusnahkan (untuk Buka Kunci)
            capturedScopes = getSelectedScopes();
            if (capturedScopes.length === 0) {
                // Jika mereka buang semua tanda dan tekan buka kunci, anggap mereka mahu buka kunci skop lama
                capturedScopes = existingScopeArray;
            }
            return true;
        },
        preConfirm: () => {
            const note = document.getElementById('swal-note').value.trim().toUpperCase();
            if (!note) {
                Swal.showValidationMessage('Sebab atau catatan wajib diisi.');
                return false;
            }
            const targetScopes = getSelectedScopes();
            if (targetScopes.length === 0) {
                Swal.showValidationMessage('Sila pilih sekurang-kurangnya satu daerah untuk dikunci.');
                return false;
            }
            return { note, targetScopes };
        }
    });

    // Logik jika butang "BUKA KUNCI TERPILIH" ditekan
    if (result.isDenied) {
        Swal.fire({
            title: 'Buka Kunci Tarikh?',
            text: "Tarikh ini akan dibuka semula untuk tempahan sekolah bagi kawasan yang ditandakan.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Ya, Buka Akses',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl' }
        }).then(async (r) => {
            if (r.isConfirmed) {
                toggleLoading(true);
                try {
                    await BookingService.manageDateLock('UNLOCK', iso, '', capturedScopes);
                    toggleLoading(false);
                    adminSelectedDate = null;
                    window.renderAdminBookingCalendar();
                    window.loadAdminBookingList(); 
                    Swal.fire({ icon: 'success', title: 'Dibuka', timer: 1000, showConfirmButton: false });
                } catch (err) {
                    toggleLoading(false);
                    Swal.fire('Ralat', 'Gagal membuka kunci tarikh.', 'error');
                }
            } else {
                adminSelectedDate = null;
                window.renderAdminBookingCalendar();
            }
        });
    } 
    // Logik jika butang "KEMASKINI / KUNCI SEKARANG" ditekan
    else if (result.isConfirmed) {
        const { note, targetScopes } = result.value;
        const action = currentlyLocked ? 'UPDATE' : 'LOCK';

        toggleLoading(true);
        try {
            await BookingService.manageDateLock(action, iso, note, targetScopes);
            toggleLoading(false);
            adminSelectedDate = null;
            window.renderAdminBookingCalendar();
            window.loadAdminBookingList();
            Swal.fire({ icon: 'success', title: currentlyLocked ? 'Dikemaskini' : 'Dikunci', timer: 1000, showConfirmButton: false });
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Ralat', err.message || 'Gagal memproses kunci tarikh.', 'error');
        }
    } else {
        adminSelectedDate = null;
        window.renderAdminBookingCalendar();
    }
};

/**
 * Memproses senarai bersepadu (Tempahan + Kunci berangkai) dalam satu jadual.
 * Menapis tarikh lampau untuk memastikan senarai pengurusan sentiasa bersih.
 */
window.loadAdminBookingList = async function() {
    const tbody = document.getElementById('adminBookingTableBody');
    if (!tbody) return;

    try {
        let [bookings, locks] = await Promise.all([
            BookingService.getAllActiveBookings(),
            BookingService.getAllLocks()
        ]);

        // --- RBAC FILTERING (SUNTIKAN DAERAH UNTUK TEMPAHAN) ---
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
            const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
            validSchoolCodes.push(userKod); // Benarkan PPD sendiri
            bookings = bookings.filter(b => validSchoolCodes.includes(b.kod_sekolah));
        }

        // Format semula locks untuk keseragaman paparan dengan tempahan (Menukar String kepada Array)
        const processedLocks = locks.map(l => ({
            ...l,
            kod_ppd: l.kod_ppd ? l.kod_ppd.split(',') : ['ALL'],
            type: 'LOCK'
        }));

        // Tapis hanya paparan untuk Hari Ini dan Akan Datang
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Gabungkan kedua-dua array dan tapis
        const masterList = [
            ...bookings.map(b => ({ ...b, type: 'BOOKING' })),
            ...processedLocks
        ].filter(item => {
            const itemDate = new Date(item.tarikh);
            itemDate.setHours(0, 0, 0, 0);
            return itemDate >= today;
        }).sort((a, b) => new Date(a.tarikh) - new Date(b.tarikh)); // Susun mengikut tarikh terawal

        if (masterList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-24 text-center text-slate-400 font-medium italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">Tiada permohonan tempahan atau tarikh dikunci bermula hari ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = masterList.map(item => {
            const dateStr = new Date(item.tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            
            if (item.type === 'BOOKING') {
                let masaClass = 'bg-purple-100 text-purple-700 border border-purple-200'; // Default: 1 HARI (Ungu)
                if (item.masa === 'Pagi') masaClass = 'bg-blue-100 text-blue-700 border border-blue-200';
                else if (item.masa === 'Petang') masaClass = 'bg-orange-100 text-orange-700 border border-orange-200';

                return `
                    <tr class="hover:bg-slate-50/80 transition-all group">
                        <td class="px-8 py-6 align-top">
                            <div class="font-black text-slate-800 text-sm tracking-tight uppercase">${dateStr}</div>
                            <div class="flex items-center gap-2 mt-1.5">
                                <span class="text-[9px] font-black px-2 py-0.5 rounded ${masaClass} uppercase tracking-tighter">${item.masa}</span>
                                <span class="text-[10px] text-slate-400 font-mono font-bold">${item.id_tempahan}</span>
                            </div>
                        </td>
                        <td class="px-8 py-6 align-top">
                            <div class="font-bold text-brand-600 text-sm leading-snug mb-1.5 wrap-safe max-w-xs group-hover:text-brand-700 transition-colors uppercase">${item.nama_sekolah}</div>
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest wrap-safe leading-relaxed">${item.tajuk_bengkel || 'TIADA TAJUK SPESIFIK'}</div>
                        </td>
                        <td class="px-8 py-6 align-top">
                            <div class="font-bold text-slate-700 text-xs uppercase wrap-safe">${item.nama_pic}</div>
                            <a href="https://wa.me/${item.no_tel_pic.replace(/[^0-9]/g, '')}" target="_blank" class="text-[10px] text-blue-500 font-black hover:underline inline-flex items-center gap-1.5 mt-1">
                                <i class="fab fa-whatsapp"></i> ${item.no_tel_pic}
                            </a>
                        </td>
                        <td class="px-8 py-6 text-center align-top">
                            <button onclick="cancelBookingAdmin(${item.id}, '${item.id_tempahan}')" class="w-10 h-10 rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-400 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto group-active:scale-95" title="Padam Tempahan (Kekal)">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                const escapedNote = (item.komen || '').replace(/'/g, "\\'");
                const dateOnly = item.tarikh.split('T')[0];
                
                const isAll = item.kod_ppd.includes('ALL');
                const scopeBadgeLabel = isAll ? 'NEGERI (SEMUA DAERAH)' : `DAERAH (${item.kod_ppd.join(', ')})`;
                const scopeBadgeColor = isAll ? 'text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50' : 'text-slate-600 border-slate-200 bg-white';
                
                // Gabungkan kembali senarai daerah sebagai koma bertitik untuk dihantar secara pukal ke parameter butang aksi
                const scopesParam = item.kod_ppd.join(','); 

                return `
                    <tr class="bg-indigo-50/40 hover:bg-indigo-50 transition-all border-l-4 border-l-indigo-500">
                        <td class="px-8 py-6 align-top">
                            <div class="font-black text-indigo-900 text-sm tracking-tight uppercase">${dateStr}</div>
                            <div class="mt-1.5">
                                <span class="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-600 text-white border border-indigo-700 uppercase tracking-tighter shadow-sm">TARIKH DIKUNCI</span>
                            </div>
                        </td>
                        <td class="px-8 py-6 align-top">
                            <div class="font-bold text-indigo-700 text-sm leading-snug mb-1.5 wrap-safe max-w-xs uppercase">BIMBINGAN DISEKAT</div>
                            <div class="text-[10px] font-bold text-indigo-400 uppercase tracking-wide wrap-safe leading-relaxed italic bg-white/50 p-1.5 rounded-lg border border-indigo-100">
                                <i class="fas fa-info-circle mr-1"></i> "${item.komen || 'TIADA CATATAN'}"
                            </div>
                        </td>
                        <td class="px-8 py-6 align-top">
                            <div class="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">DIKUNCI OLEH:</div>
                            <div class="font-mono text-[10px] text-indigo-600 font-bold break-all mb-2">${item.dikunci_oleh || 'PENTADBIR SISTEM'}</div>
                            <div class="text-[8px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded inline-block border ${scopeBadgeColor}">
                                Skop: <span class="font-black">${scopeBadgeLabel}</span>
                            </div>
                        </td>
                        <td class="px-8 py-6 text-center align-top">
                            <button onclick="handleAdminDateAction('${dateOnly}', true, false, '${escapedNote}', '${scopesParam}')" class="w-10 h-10 rounded-xl bg-white border-2 border-indigo-200 text-indigo-400 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto" title="Urus Kunci Tarikh">
                                <i class="fas fa-cog"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
        }).join('');
    } catch (e) {
        console.error("[AdminBooking] List Load Error:", e);
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-red-500 font-bold bg-red-50 border-2 border-red-100">Gagal memproses senarai tempahan dari pelayan.</td></tr>`;
    }
};

/**
 * Melaksanakan pemadaman kekal (Hard Delete) bagi tempahan.
 */
window.cancelBookingAdmin = async function(dbId, bookingId) {
    const { isConfirmed } = await Swal.fire({
        title: 'Padam Tempahan?',
        html: `<div class="text-center p-5 bg-red-50 rounded-2xl border-2 border-red-100 mb-4 shadow-inner">
                 <p class="text-xs text-red-400 font-bold uppercase tracking-widest mb-1">ID Permohonan:</p>
                 <p class="text-xl font-black text-red-600 font-mono">${bookingId}</p>
               </div>
               <p class="text-sm text-slate-500 leading-relaxed px-4 font-medium">Tindakan ini adalah <b>PADAM KEKAL</b> dari pangkalan data. Tiada rekod audit akan disimpan.</p>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'YA, PADAM KEKAL',
        cancelButtonText: 'TUTUP',
        customClass: { popup: 'rounded-[2rem] border-4 border-red-50' }
    });

    if (isConfirmed) {
        toggleLoading(true);
        try {
            await BookingService.adminCancelBooking(dbId);
            toggleLoading(false);
            
            Swal.fire({ 
                icon: 'success', 
                title: 'Data Dihapuskan', 
                text: 'Rekod telah dipadam secara fizikal dari sistem.', 
                timer: 1500, 
                showConfirmButton: false, 
                customClass: { popup: 'rounded-[2rem]' } 
            });

            window.loadAdminBookingList();
            window.renderAdminBookingCalendar(); 
        } catch (e) {
            toggleLoading(false);
            Swal.fire({ icon: 'error', title: 'Ralat Pemadaman', text: 'Gagal memadam data dari pangkalan data.', customClass: { popup: 'rounded-[2rem]' } });
        }
    }
};

/**
 * Menukar bulan paparan kalendar.
 */
window.changeAdminMonth = function(offset) {
    adminCurrentMonth += offset;
    adminSelectedDate = null; 
    
    if (adminCurrentMonth > 11) { 
        adminCurrentMonth = 0; 
        adminCurrentYear++; 
    } else if (adminCurrentMonth < 0) { 
        adminCurrentMonth = 11; 
        adminCurrentYear--; 
    }
    
    const realToday = new Date();
    if (adminCurrentMonth === realToday.getMonth() && adminCurrentYear === realToday.getFullYear()) {
        adminActiveWeek = Math.ceil(realToday.getDate() / 7);
    } else {
        adminActiveWeek = 1; 
    }
    
    window.renderAdminBookingCalendar();
};