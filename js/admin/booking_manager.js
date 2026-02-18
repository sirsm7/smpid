/**
 * ADMIN MODULE: BOOKING MANAGER (PRO EDITION - V5.1 INTEGRITY & FIX)
 * Fungsi: Menguruskan tempahan bimbingan bagi pihak PPD.
 * --- UPDATE V5.1 ---
 * 1. Hard Delete Integration: Menggunakan logik pemadaman kekal tanpa audit.
 * 2. Integrated List: Memaparkan rekod tempahan DAN tarikh dikunci dalam satu jadual.
 * 3. Scope Fix: Mendedahkan handleAdminDateAction ke global window untuk akses onclick HTML.
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
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b-2 border-slate-100">
                                    <tr>
                                        <th class="px-8 py-5">Tarikh & Masa</th>
                                        <th class="px-8 py-5">Sekolah / Maklumat Kunci</th>
                                        <th class="px-8 py-5">PIC / Admin</th>
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
    }
};

window.switchAdminWeek = function(weekNum) {
    adminActiveWeek = weekNum;
    window.renderAdminBookingCalendar();
};

/**
 * Membina Grid Kalendar (Admin Side)
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
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth);
        
        const daysInMonth = new Date(adminCurrentYear, adminCurrentMonth + 1, 0).getDate();
        const pad = (n) => n.toString().padStart(2, '0');
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
            const dateString = `${adminCurrentYear}-${pad(adminCurrentMonth + 1)}-${pad(d)}`;
            const dateObj = new Date(adminCurrentYear, adminCurrentMonth, d);
            dateObj.setHours(0, 0, 0, 0);

            const dayOfWeek = dateObj.getDay(); 
            const isAllowedDay = ALLOWED_DAYS.includes(dayOfWeek);
            const isLocked = lockedDetails.hasOwnProperty(dateString);
            const slotsTaken = bookedSlots[dateString] || [];
            const isPast = dateObj < today;

            let status = 'open';
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';
            const maxCapacity = (dayOfWeek === 6) ? 1 : 2;

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
            else if (slotsTaken.length >= maxCapacity) {
                status = 'full';
                statusText = 'PENUH';
                statusIcon = 'fa-users-slash';
            } 
            else if (slotsTaken.length === 1) {
                status = 'partial';
                statusText = '1 SLOT BAKI';
                statusIcon = 'fa-exclamation-circle';
            }

            let iconColor = 'text-brand-600 bg-brand-100';
            if (status === 'full') iconColor = 'text-red-600 bg-red-100';
            if (status === 'locked') iconColor = 'text-purple-600 bg-purple-100';
            if (status === 'partial') iconColor = 'text-amber-600 bg-amber-100';
            if (status === 'closed') iconColor = 'text-slate-400 bg-slate-200';

            const lockedMsg = isLocked ? `<div class="text-[9px] text-purple-600 font-black mt-1 uppercase wrap-safe leading-tight bg-purple-50 p-1 rounded border border-purple-100">${lockedDetails[dateString] || 'ADMIN LOCK'}</div>` : '';
            const isSelected = (dateString === adminSelectedDate);
            
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

            if (!isPast && isAllowedDay) {
                card.onclick = () => {
                    adminSelectedDate = dateString;
                    window.renderAdminBookingCalendar(); 
                    window.handleAdminDateAction(dateString, isLocked);
                };
            } else if (!isPast && isLocked) {
                card.onclick = () => {
                    adminSelectedDate = dateString;
                    window.renderAdminBookingCalendar(); 
                    window.handleAdminDateAction(dateString, true);
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
 * Mengawal tindakan kunci/buka tarikh. 
 * Fungsi ini didedahkan ke global window untuk kegunaan onclick HTML.
 */
window.handleAdminDateAction = async function(iso, currentlyLocked) {
    if (currentlyLocked) {
        Swal.fire({
            title: 'Buka Kunci Tarikh?',
            html: `<div class="text-center mb-4"><span class="text-3xl font-black text-slate-800">${iso}</span></div>
                   <p class="text-sm text-slate-500 font-medium">Adakah anda pasti mahu membuka semula tarikh ini untuk tempahan sekolah?</p>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Ya, Buka Akses',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl border-2 border-slate-100' }
        }).then(async (r) => {
            if (r.isConfirmed) {
                toggleLoading(true);
                try {
                    const adminId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID) || 'ADMIN';
                    await BookingService.toggleDateLock(iso, '', adminId);
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
    } else {
        const { value: note } = await Swal.fire({
            title: 'Kunci Tarikh Ini?',
            html: `<div class="text-center mb-4"><span class="text-3xl font-black text-purple-600">${iso}</span></div>
                   <p class="text-sm text-slate-500 mb-4 px-4 font-medium">Nyatakan sebab (Contoh: CUTI UMUM). Tempahan sekolah akan disekat.</p>`,
            input: 'text',
            inputPlaceholder: 'Sila masukkan sebab kunci...',
            showCancelButton: true,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: 'KUNCI SEKARANG',
            cancelButtonText: 'Batal',
            customClass: { popup: 'rounded-3xl border-2 border-slate-100', input: 'rounded-xl font-bold uppercase mx-4 shadow-sm border-2 border-slate-200' },
            preConfirm: (val) => {
                if (!val) return Swal.showValidationMessage('Sebab atau catatan wajib diisi.');
                return val.toUpperCase();
            }
        });

        if (note) {
            toggleLoading(true);
            try {
                const adminId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID) || 'ADMIN';
                await BookingService.toggleDateLock(iso, note, adminId);
                toggleLoading(false);
                adminSelectedDate = null;
                window.renderAdminBookingCalendar();
                window.loadAdminBookingList();
                Swal.fire({ icon: 'success', title: 'Dikunci', timer: 1000, showConfirmButton: false });
            } catch (err) {
                toggleLoading(false);
                Swal.fire('Ralat', 'Gagal mengunci tarikh.', 'error');
            }
        } else {
            adminSelectedDate = null;
            window.renderAdminBookingCalendar();
        }
    }
};

/**
 * Memproses senarai bersepadu (Tempahan + Kunci) dalam satu jadual.
 */
window.loadAdminBookingList = async function() {
    const tbody = document.getElementById('adminBookingTableBody');
    if (!tbody) return;

    try {
        // Dual Fetch: Mengambil rekod tempahan dan tarikh dikunci secara serentak
        const [bookings, locks] = await Promise.all([
            BookingService.getAllActiveBookings(),
            BookingService.getAllLocks()
        ]);

        // Gabungkan kedua-dua array dan berikan tagging jenis data
        const masterList = [
            ...bookings.map(b => ({ ...b, type: 'BOOKING' })),
            ...locks.map(l => ({ ...l, type: 'LOCK' }))
        ];

        // Susun mengikut tarikh paling awal di atas
        masterList.sort((a, b) => new Date(a.tarikh) - new Date(b.tarikh));

        if (masterList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-24 text-center text-slate-400 font-medium italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">Tiada permohonan tempahan atau tarikh dikunci buat masa ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = masterList.map(item => {
            const dateStr = new Date(item.tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
            
            if (item.type === 'BOOKING') {
                return `
                    <tr class="hover:bg-slate-50/80 transition-all group">
                        <td class="px-8 py-6 align-top">
                            <div class="font-black text-slate-800 text-sm tracking-tight uppercase">${dateStr}</div>
                            <div class="flex items-center gap-2 mt-1.5">
                                <span class="text-[9px] font-black px-2 py-0.5 rounded ${item.masa === 'Pagi' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-orange-100 text-orange-700 border border-orange-200'} uppercase tracking-tighter">${item.masa}</span>
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
                // Reka bentuk baris bagi TARIKH DIKUNCI (LOCK)
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
                            <div class="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">OLEH PENTADBIR:</div>
                            <div class="font-mono text-[10px] text-indigo-600 font-bold break-all">${item.admin_email || 'ADMIN PPD'}</div>
                        </td>
                        <td class="px-8 py-6 text-center align-top">
                            <button onclick="handleAdminDateAction('${item.tarikh}', true)" class="w-10 h-10 rounded-xl bg-white border-2 border-indigo-200 text-indigo-400 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto" title="Buka Kunci Melalui Kalendar">
                                <i class="fas fa-unlock"></i>
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
            // Panggil Service untuk Hard Delete
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

            // Muat semula semua data berkaitan
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