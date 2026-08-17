import { BookingService } from '../services/booking.service.js';
import { toggleLoading } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';
import { getDatabaseClient } from '../core/db.js';

const todayDate = new Date();
let adminCurrentMonth = todayDate.getMonth();
let adminCurrentYear = todayDate.getFullYear();
let adminActiveWeek = Math.ceil(todayDate.getDate() / 7);
let activeBookings = [];
let lockedDatesList = [];
let adminSelectedDates = [];
let adminDaerahFilter = 'ALL';
let globalAuditBookings = [];
let filteredAuditBookings = [];
let auditDaerahFilter = 'ALL';

const ALLOWED_DAYS = [2, 3, 4, 6];
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

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
                    <div class="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl shadow-inner border-2 border-slate-200 gap-1">
                        <button onclick="switchAdminBookingView('calendar')" id="btnViewCal" class="px-5 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105">KALENDAR</button>
                        <button onclick="switchAdminBookingView('list')" id="btnViewList" class="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all">SENARAI AKTIF</button>
                        <button onclick="switchAdminBookingView('audit')" id="btnViewAudit" class="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all">SEMAKAN AUDIT</button>
                    </div>
                </div>

                <!-- SUNTIKAN DASHBOARD KPI MINI -->
                <div id="adminBookingDashboardPanel" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-up">
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between group hover:border-emerald-300 transition-colors">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sekolah Memohon</p>
                            <h3 class="text-2xl font-black text-slate-800 leading-none" id="kpiSekolahMemohon">0</h3>
                        </div>
                        <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            <i class="fas fa-school"></i>
                        </div>
                    </div>
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between group hover:border-fuchsia-300 transition-colors">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kunci Negeri (ALL)</p>
                            <h3 class="text-2xl font-black text-slate-800 leading-none" id="kpiKunciNegeri">0</h3>
                        </div>
                        <div class="w-12 h-12 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            <i class="fas fa-globe"></i>
                        </div>
                    </div>
                    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between group hover:border-purple-300 transition-colors">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kunci Daerah</p>
                            <h3 class="text-2xl font-black text-slate-800 leading-none" id="kpiKunciDaerah">0</h3>
                        </div>
                        <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                    </div>
                     <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 border border-slate-700 shadow-md flex items-center justify-between relative overflow-hidden group">
                        <div class="absolute -right-4 -bottom-4 opacity-10 transform group-hover:scale-110 transition-transform">
                            <i class="fas fa-calendar-times text-7xl"></i>
                        </div>
                        <div class="relative z-10">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jumlah Hari Dikunci</p>
                            <h3 class="text-3xl font-black text-white leading-none" id="kpiJumlahHariKunci">0</h3>
                            <p class="text-[9px] text-slate-400 mt-1 font-bold">Tahun <span id="kpiTahunSemasa">-</span></p>
                        </div>
                    </div>
                </div>

                <!-- VIEW 1: KALENDAR -->
                <div id="adminBookingCalendarView" class="animate-fade-up">
                    <div class="grid grid-cols-1 lg:grid-cols-1 gap-8">
                        <div>
                            <div class="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm">
                                <div class="p-5 bg-slate-50/50 border-b-2 border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div class="flex items-center justify-between w-full sm:w-auto">
                                        <button onclick="changeAdminMonth(-1)" class="w-10 h-10 rounded-xl bg-white hover:shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-left"></i></button>
                                        <h3 id="adminMonthLabel" class="font-black text-slate-800 uppercase tracking-tighter text-base mx-4">...</h3>
                                        <button onclick="changeAdminMonth(1)" class="w-10 h-10 rounded-xl bg-white hover:shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all"><i class="fas fa-chevron-right"></i></button>
                                    </div>
                                    <div class="flex items-center gap-2 w-full sm:w-auto">
                                        <div id="adminBookingFilterDaerahWrapper" class="hidden">
                                             <select id="adminBookingFilterDaerah" onchange="window.setAdminBookingDaerah(this.value)" class="w-full sm:w-48 p-2 rounded-xl border-2 border-slate-200 text-xs font-bold outline-none focus:border-brand-500 bg-white">
                                             </select>
                                        </div>
                                        <button id="btnMultiLock" onclick="window.handleMultiDateAction()" class="hidden px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md items-center gap-2">
                                            <i class="fas fa-lock"></i> Kunci <span id="multiLockCount">0</span> Tarikh
                                        </button>
                                    </div>
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

                <!-- VIEW 2: SENARAI AKTIF -->
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

                <!-- VIEW 3: SEMAKAN AUDIT (BAHARU) -->
                <div id="adminBookingAuditView" class="hidden animate-fade-up">
                    <div class="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm">
                        <div class="p-5 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div class="flex items-center gap-3">
                                <i class="fas fa-history text-slate-400 text-xl"></i>
                                <div>
                                    <h3 class="font-bold text-slate-800 uppercase tracking-widest text-xs">Sejarah Penuh Tempahan</h3>
                                    <p class="text-[10px] text-slate-500">Log rekod aktif, lepas, dan tarikh dikunci.</p>
                                </div>
                            </div>
                            <div class="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <div class="relative w-full sm:w-56">
                                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input type="text" id="auditSearchInput" class="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-500 outline-none" placeholder="Cari Sekolah/ID/Fokus..." onkeyup="window.filterAudit()">
                                </div>
                                <div id="auditDaerahFilterWrapper" class="hidden w-full sm:w-40">
                                    <select id="auditDaerahFilter" class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:border-brand-500 outline-none" onchange="window.filterAudit()">
                                        <option value="ALL">SEMUA DAERAH</option>
                                    </select>
                                </div>
                                <button onclick="window.eksportAuditCSV()" class="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
                                    <i class="fas fa-download"></i> Eksport
                                </button>
                                <button onclick="window.loadAdminBookingAudit()" class="px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:text-brand-600 transition flex items-center justify-center shadow-sm" title="Refresh Data">
                                    <i class="fas fa-sync-alt"></i>
                                </button>
                            </div>
                        </div>
                        <div class="overflow-x-auto max-h-[600px] custom-scrollbar">
                            <table class="w-full text-sm text-left">
                                <thead class="bg-slate-100 text-[10px] font-black text-slate-500 uppercase border-b-2 border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-6 py-4 w-12 text-center">BIL</th>
                                        <th class="px-6 py-4">TARIKH/MASA</th>
                                        <th class="px-6 py-4">SEKOLAH / SKOP KUNCI</th>
                                        <th class="px-6 py-4">FOKUS BIMBINGAN / CATATAN</th>
                                        <th class="px-6 py-4">PEGAWAI PIC</th>
                                        <th class="px-6 py-4 text-center">STATUS</th>
                                    </tr>
                                </thead>
                                <tbody id="auditTableBody" class="divide-y divide-slate-100">
                                    <tr><td colspan="6" class="p-8 text-center text-slate-400 italic">Menyemak Pangkalan Data...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    populateAdminBookingDaerah();
    document.getElementById('kpiTahunSemasa').innerText = new Date().getFullYear();
    window.renderAdminBookingCalendar();
    window.loadAdminBookingList();
    window.renderAdminBookingDashboard();
};

function populateAdminBookingDaerah() {
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const wrapper = document.getElementById('adminBookingFilterDaerahWrapper');
    const select = document.getElementById('adminBookingFilterDaerah');
    const auditWrapper = document.getElementById('auditDaerahFilterWrapper');
    const auditSelect = document.getElementById('auditDaerahFilter');

    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
        if(wrapper) wrapper.classList.remove('hidden');
        if(auditWrapper) auditWrapper.classList.remove('hidden');

        let html = `<option value="ALL">SEMUA DAERAH</option>`;
        if (APP_CONFIG.PPD_MAPPING) {
            for (const [kod, nama] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                html += `<option value="${kod}">${nama}</option>`;
            }
        }
        if(select) {
            select.innerHTML = html;
            select.value = adminDaerahFilter;
        }
        if(auditSelect) {
            auditSelect.innerHTML = html;
            auditSelect.value = auditDaerahFilter;
        }
    } else {
        if(wrapper) wrapper.classList.add('hidden');
        if(auditWrapper) auditWrapper.classList.add('hidden');
    }
}

window.setAdminBookingDaerah = function(daerahValue) {
    adminDaerahFilter = daerahValue;
    const auditSelect = document.getElementById('auditDaerahFilter');
    if (auditSelect && auditSelect.value !== daerahValue) {
        auditSelect.value = daerahValue;
        auditDaerahFilter = daerahValue;
        const viewAudit = document.getElementById('adminBookingAuditView');
        if (viewAudit && !viewAudit.classList.contains('hidden')) {
             window.filterAudit();
        }
    }
    adminSelectedDates = [];
    updateMultiLockUI();
    window.renderAdminBookingCalendar();
    window.renderAdminBookingDashboard();
};

window.renderAdminBookingDashboard = async function() {
    try {
        const [locks, bookings] = await Promise.all([
            BookingService.getAllLocks(),
            BookingService.getAllActiveBookings()
        ]);

        const currentYearString = new Date().getFullYear().toString();
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'M030';
        
        const viewTarget = ['SUPER_ADMIN', 'JPNMEL'].includes(userRole) ? adminDaerahFilter : userKod;
        const currentYearBookings = bookings.filter(b => b.tarikh.startsWith(currentYearString));
        
        let relevantBookings = currentYearBookings;

        if (viewTarget !== 'ALL') {
            if (window.globalDashboardData) {
                const targetDaerahName = APP_CONFIG.PPD_MAPPING[viewTarget] || viewTarget;
                const validSchoolCodesForDaerah = window.globalDashboardData
                    .filter(s => (s.daerah && s.daerah.toUpperCase() === targetDaerahName.toUpperCase()) || s.kod_sekolah === viewTarget)
                    .map(s => s.kod_sekolah);
                relevantBookings = currentYearBookings.filter(b => validSchoolCodesForDaerah.includes(b.kod_sekolah));
            }
        }

        const uniqueSchools = new Set(relevantBookings.map(b => b.kod_sekolah));
        document.getElementById('kpiSekolahMemohon').innerText = uniqueSchools.size;

        let countKunciNegeri = 0;
        let countKunciDaerah = 0;
        let uniqueDaysLocked = new Set();

        const currentYearLocks = locks.filter(l => l.tarikh.startsWith(currentYearString));

        currentYearLocks.forEach(lock => {
            const dateOnly = lock.tarikh.split('T')[0];
            const scopes = lock.kod_ppd ? lock.kod_ppd.split(',') : [];
            let isRelevantToView = false;
            let isStatewide = false;

            for (const scope of scopes) {
                let sCode = scope;
                if (scope.includes(':')) {
                    sCode = scope.split(':')[0];
                }
                if (sCode === 'ALL') {
                    isStatewide = true;
                    isRelevantToView = true;
                } else if (viewTarget === 'ALL' || sCode === viewTarget) {
                    isRelevantToView = true;
                }
            }

            if (isRelevantToView) {
                uniqueDaysLocked.add(dateOnly);
                if (isStatewide) {
                    countKunciNegeri++;
                } else {
                    countKunciDaerah++;
                }
            }
        });

        document.getElementById('kpiKunciNegeri').innerText = countKunciNegeri;
        document.getElementById('kpiKunciDaerah').innerText = countKunciDaerah;
        document.getElementById('kpiJumlahHariKunci').innerText = uniqueDaysLocked.size;

    } catch (e) {
        console.error("Gagal mengira KPI Dashboard Kunci:", e);
    }
};

window.switchAdminBookingView = function(view) {
    const btnCal = document.getElementById('btnViewCal');
    const btnList = document.getElementById('btnViewList');
    const btnAudit = document.getElementById('btnViewAudit');
    
    const viewCal = document.getElementById('adminBookingCalendarView');
    const viewList = document.getElementById('adminBookingListView');
    const viewAudit = document.getElementById('adminBookingAuditView');

    if (!btnCal || !btnList || !btnAudit || !viewCal || !viewList || !viewAudit) return;

    [btnCal, btnList, btnAudit].forEach(btn => {
        btn.className = "px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all";
    });

    [viewCal, viewList, viewAudit].forEach(v => v.classList.add('hidden'));

    if (view === 'calendar') {
        btnCal.className = "px-5 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105";
        viewCal.classList.remove('hidden');
    } else if (view === 'list') {
        btnList.className = "px-5 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105";
        viewList.classList.remove('hidden');
        window.loadAdminBookingList();
    } else if (view === 'audit') {
        btnAudit.className = "px-5 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105";
        viewAudit.classList.remove('hidden');
        window.loadAdminBookingAudit();
    }
};

window.switchAdminWeek = function(weekNum) {
    adminActiveWeek = weekNum;
    window.renderAdminBookingCalendar();
};

function checkIsAllowedDayAdmin(dateObj) {
    const dayOfWeek = dateObj.getDay();
    const dayOfMonth = dateObj.getDate();
    
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || '';
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || '';

    let targetDaerahKod = userKod;
    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole) && adminDaerahFilter !== 'ALL') {
        targetDaerahKod = adminDaerahFilter;
    }

    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole) && adminDaerahFilter === 'ALL') {
        if ([1, 2, 3, 4].includes(dayOfWeek)) return true;
        if (dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21) return true;
        return false;
    }

    const isJasin = (targetDaerahKod === 'M010');
    const isMelakaTengah = (targetDaerahKod === 'M020');
    const isAlorGajah = (targetDaerahKod === 'M030' || (!isJasin && !isMelakaTengah));

    if ([2, 3, 4].includes(dayOfWeek)) return true;
    if (isJasin) return false;
    if (isMelakaTengah && dayOfWeek === 1) return true;
    if (isAlorGajah && dayOfWeek === 6) {
        if (dayOfMonth >= 15 && dayOfMonth <= 21) return true;
    }
    return false;
}

function updateMultiLockUI() {
    const btnMultiLock = document.getElementById('btnMultiLock');
    const countSpan = document.getElementById('multiLockCount');
    if (!btnMultiLock || !countSpan) return;

    if (adminSelectedDates.length > 0) {
        btnMultiLock.classList.remove('hidden');
        btnMultiLock.classList.add('flex');
        countSpan.innerText = adminSelectedDates.length;
    } else {
        btnMultiLock.classList.add('hidden');
        btnMultiLock.classList.remove('flex');
    }
}

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

        const [{ bookedSlots }, allLocks] = await Promise.all([
            BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth, adminDaerahFilter),
            BookingService.getAllLocks()
        ]);

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
            const isAllowedDay = checkIsAllowedDayAdmin(dateObj);

            // Pengesanan Kekunci
            const lockObj = activeMonthLocks.find(l => l.tarikh.split('T')[0] === dateString);
            const isLockedGlobal = !!lockObj;
            let lockedSlots = []; // ['Pagi', 'Petang', '1 HARI']

            if (isLockedGlobal) {
                const scopes = lockObj.kod_ppd ? lockObj.kod_ppd.split(',') : [];
                scopes.forEach(scope => {
                     const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
                     const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'M030';
                     const viewTarget = ['SUPER_ADMIN', 'JPNMEL'].includes(userRole) ? adminDaerahFilter : userKod;

                     let scopeCode = scope;
                     let scopeSlot = '1 HARI';
                     if(scope.includes(':')) {
                         const parts = scope.split(':');
                         scopeCode = parts[0];
                         scopeSlot = parts[1];
                     }

                     if (scopeCode === 'ALL' || (viewTarget !== 'ALL' && scopeCode === viewTarget) || (viewTarget === 'ALL')) {
                          if (scopeSlot === 'ALL' || scopeSlot === '1 HARI') {
                               lockedSlots.push('Pagi', 'Petang', '1 HARI');
                          } else if (scopeSlot === 'PAGI') {
                               lockedSlots.push('Pagi');
                          } else if (scopeSlot === 'PETANG') {
                               lockedSlots.push('Petang');
                          }
                     }
                });
            }

            const slotsTaken = bookedSlots[dateString] || [];
            const combinedSlots = [...new Set([...slotsTaken, ...lockedSlots])];

            const isPast = dateObj < today;
            let status = 'open';
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';

            const maxCapacity = (dayOfWeek === 6) ? 1 : 2;
            const isFullDayTaken = combinedSlots.includes('1 HARI') || (combinedSlots.includes('Pagi') && combinedSlots.includes('Petang'));
            
            let filledCount = combinedSlots.length;
            if (isFullDayTaken) filledCount = 2;
            
            const isFullyLocked = lockedSlots.includes('1 HARI') || (lockedSlots.includes('Pagi') && lockedSlots.includes('Petang'));

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
            else if (isFullyLocked) {
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
                if(lockedSlots.length > 0) {
                    status = 'locked';
                    statusText = 'KUNCI SEPARA';
                    statusIcon = 'fa-lock';
                } else {
                    status = 'partial';
                    statusText = '1 SLOT BAKI';
                    statusIcon = 'fa-exclamation-circle';
                }
            }

            let iconColor = 'text-brand-600 bg-brand-100';
            if (status === 'full') iconColor = 'text-red-600 bg-red-100';
            if (status === 'locked') iconColor = 'text-purple-600 bg-purple-100';
            if (status === 'partial') iconColor = 'text-amber-600 bg-amber-100';
            if (status === 'closed') iconColor = 'text-slate-400 bg-slate-200';

            let lockedMsg = '';
            let existingScopes = ['ALL'];
            if (isLockedGlobal) {
                existingScopes = (lockObj.kod_ppd || 'ALL').split(',');
                const isAll = existingScopes.some(s => s.startsWith('ALL'));
                const districtCodesOnly = existingScopes.map(s => s.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i && v !== 'ALL');
                
                const scopeLabel = isAll ? 'KUNCI NEGERI' : `KUNCI DAERAH (${districtCodesOnly.join(', ')})`;
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

            const isSelected = adminSelectedDates.includes(dateString);
            const hasBookings = (slotsTaken.length > 0);

            const card = document.createElement('div');
            card.className = `day-card card-${status} ${isSelected ? 'card-active ring-4 ring-purple-500 transform scale-105' : ''} transition-all duration-200`;
            
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

            if (!isPast && (isAllowedDay || isLockedGlobal)) {
                card.onclick = (e) => {
                     if (adminSelectedDates.includes(dateString)) {
                         adminSelectedDates = adminSelectedDates.filter(d => d !== dateString);
                     } else {
                         adminSelectedDates.push(dateString);
                     }
                     updateMultiLockUI();
                     window.renderAdminBookingCalendar();
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

window.handleMultiDateAction = function() {
    if (adminSelectedDates.length === 0) return;
    window.handleAdminDateAction(adminSelectedDates, false, false, '', ['ALL']);
};

window.handleAdminDateAction = async function(isoArray, currentlyLocked, hasBookings, currentNote = '', existingScopesParam = 'ALL') {
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'M030';

    const datesToProcess = Array.isArray(isoArray) ? isoArray : [isoArray];
    const displayDatesText = datesToProcess.length > 1 ? `${datesToProcess.length} Tarikh Dipilih` : datesToProcess[0];

    if (!currentlyLocked && hasBookings && datesToProcess.length === 1) {
        Swal.fire({
            icon: 'warning',
            title: 'Tempahan Aktif Wujud',
            html: `<div class="text-center">
                     <p class="text-sm font-bold text-red-600 mb-2">Terdapat tempahan yang telah dibuat oleh sekolah pada tarikh ini.</p>
                     <p class="text-xs text-slate-500">Anda masih boleh mengunci baki slot kosong, tetapi anda tidak boleh membatalkan slot yang telah ditempah tanpa memaklumkan pihak sekolah.</p>
                   </div>`,
            confirmButtonColor: '#f59e0b',
            customClass: { popup: 'rounded-3xl' }
        });
    }

    let existingScopeArray = Array.isArray(existingScopesParam) ? existingScopesParam : (typeof existingScopesParam === 'string' ? existingScopesParam.split(',') : ['ALL']);
    let parsedScopes = existingScopeArray.map(s => {
        if(s.includes(':')) {
            const p = s.split(':');
            return { kod: p[0], slot: p[1] };
        }
        return { kod: s, slot: 'ALL' };
    });

    const slotOptionsHTML = `
        <div class="mt-4 text-left px-4">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><i class="fas fa-clock text-amber-500 mr-1"></i> Slot Masa Yang Ingin Dikunci</label>
            <select id="swal-slot-selection" class="w-full p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold outline-none focus:border-purple-500 bg-white shadow-sm">
                <option value="ALL">KUNCI SEPENUH HARI (1 HARI)</option>
                <option value="PAGI">KUNCI SLOT PAGI SAHAJA</option>
                <option value="PETANG">KUNCI SLOT PETANG SAHAJA</option>
            </select>
        </div>
    `;

    let scopeHtml = '';
    if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
        const hasAllDistrict = parsedScopes.some(s => s.kod === 'ALL');
        
        let checkboxes = `
            <label class="flex items-center gap-3 p-3 border-b border-slate-100 bg-white cursor-pointer hover:bg-purple-50 transition rounded-t-xl">
                <input type="checkbox" class="swal-scope-cb w-5 h-5 accent-purple-600 cursor-pointer" value="ALL" ${hasAllDistrict ? 'checked' : ''} onchange="if(this.checked) document.querySelectorAll('.swal-scope-cb').forEach(cb => { if(cb.value !== 'ALL') cb.checked = false; })">
                <span class="text-xs font-black text-slate-700 tracking-wider">SEMUA DAERAH (NEGERI MELAKA)</span>
            </label>
        `;
        if (APP_CONFIG.PPD_MAPPING) {
            for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                const isChecked = parsedScopes.some(s => s.kod === k) && !hasAllDistrict ? 'checked' : '';
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
        let codes = [userKod];
        if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
            const cbs = document.querySelectorAll('.swal-scope-cb:checked');
            const vals = Array.from(cbs).map(cb => cb.value);
            codes = vals.includes('ALL') ? ['ALL'] : vals;
        }
        const slotEl = document.getElementById('swal-slot-selection');
        const selectedSlot = slotEl ? slotEl.value : 'ALL';
        return codes.map(c => `${c}:${selectedSlot}`);
    };

    const titleText = (currentlyLocked && datesToProcess.length === 1) ? 'Pengurusan Kunci Tarikh' : 'Kunci Tarikh Ini?';
    const confirmText = (currentlyLocked && datesToProcess.length === 1) ? 'KEMASKINI CATATAN / KAWASAN' : 'KUNCI SEKARANG';

    let capturedScopes = [];

    const result = await Swal.fire({
        title: titleText,
        html: `
            <div class="text-center mb-4">
                <span class="text-xl md:text-2xl font-black text-purple-600 px-4">${displayDatesText}</span>
                ${datesToProcess.length > 1 ? `<br><span class="text-[10px] text-slate-400 font-bold mt-1 block">${datesToProcess.join(', ')}</span>` : ''}
            </div>
            <p class="text-sm text-slate-500 mb-4 px-4 font-medium">Nyatakan sebab atau catatan rasmi di bawah.</p>
            <div class="px-4">
                <input id="swal-note" class="w-full p-3 rounded-xl border-2 border-slate-200 font-bold uppercase text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 text-slate-800 transition" placeholder="Contoh: CUTI UMUM / BENGKEL..." value="${currentNote}">
            </div>
            ${slotOptionsHTML}
            ${scopeHtml}
        `,
        didOpen: () => {
             if(currentlyLocked && parsedScopes.length > 0) {
                 const firstSlot = parsedScopes[0].slot;
                 const slotEl = document.getElementById('swal-slot-selection');
                 if(slotEl) slotEl.value = firstSlot;
             }
        },
        showCancelButton: true,
        showDenyButton: true,
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
            capturedScopes = getSelectedScopes();
            if (capturedScopes.length === 0) {
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

    if (result.isDenied) {
        Swal.fire({
            title: 'Buka Kunci Tarikh?',
            text: "Kunci bagi tarikh-tarikh yang dipilih akan dibuka semula untuk tempahan sekolah.",
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
                    const promises = datesToProcess.map(iso => 
                        BookingService.manageDateLock('UNLOCK', iso, '', capturedScopes)
                    );
                    await Promise.all(promises);
                    
                    toggleLoading(false);
                    adminSelectedDates = [];
                    updateMultiLockUI();
                    
                    window.renderAdminBookingCalendar();
                    window.loadAdminBookingList();
                    window.renderAdminBookingDashboard();
                    
                    Swal.fire({ icon: 'success', title: 'Dibuka', timer: 1000, showConfirmButton: false });
                } catch (err) {
                    toggleLoading(false);
                    Swal.fire('Ralat', 'Gagal membuka kunci tarikh.', 'error');
                }
            } else {
                window.renderAdminBookingCalendar();
            }
        });
    }
    else if (result.isConfirmed) {
        const { note, targetScopes } = result.value;
        const action = (currentlyLocked && datesToProcess.length === 1) ? 'UPDATE' : 'LOCK';

        toggleLoading(true);
        try {
            const promises = datesToProcess.map(iso => 
                BookingService.manageDateLock(action, iso, note, targetScopes)
            );
            await Promise.all(promises);

            toggleLoading(false);
            adminSelectedDates = [];
            updateMultiLockUI();
            
            window.renderAdminBookingCalendar();
            window.loadAdminBookingList();
            window.renderAdminBookingDashboard();
            
            Swal.fire({ icon: 'success', title: 'Selesai!', text: `Berjaya mengemaskini ${datesToProcess.length} tarikh.`, timer: 1500, showConfirmButton: false });
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Ralat', err.message || 'Gagal memproses kunci tarikh.', 'error');
        }
    } else {
        window.renderAdminBookingCalendar();
    }
};

window.loadAdminBookingList = async function() {
    const tbody = document.getElementById('adminBookingTableBody');
    if (!tbody) return;

    try {
        let [bookings, locks] = await Promise.all([
            BookingService.getAllActiveBookings(),
            BookingService.getAllLocks()
        ]);

        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
            const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
            validSchoolCodes.push(userKod);
            bookings = bookings.filter(b => validSchoolCodes.includes(b.kod_sekolah));
        }

        const processedLocks = locks.map(l => ({
            ...l,
            kod_ppd: l.kod_ppd ? l.kod_ppd.split(',') : ['ALL:ALL'],
            type: 'LOCK'
        }));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const masterList = [
            ...bookings.map(b => ({ ...b, type: 'BOOKING' })),
            ...processedLocks
        ].filter(item => {
            const itemDate = new Date(item.tarikh);
            itemDate.setHours(0, 0, 0, 0);
            return itemDate >= today;
        }).sort((a, b) => new Date(a.tarikh) - new Date(b.tarikh));

        if (masterList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-24 text-center text-slate-400 font-medium italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">Tiada permohonan tempahan atau tarikh dikunci bermula hari ini.</td></tr>`;
            return;
        }

        tbody.innerHTML = masterList.map(item => {
            const dateStr = new Date(item.tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });

            if (item.type === 'BOOKING') {
                let masaClass = 'bg-purple-100 text-purple-700 border border-purple-200';
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
                const isAll = item.kod_ppd.some(s => s.startsWith('ALL'));
                
                let scopesDisplay = [];
                item.kod_ppd.forEach(scope => {
                     let districtName = scope;
                     let slotName = 'SEHARI';
                     if(scope.includes(':')) {
                         const parts = scope.split(':');
                         if(parts[0] !== 'ALL') {
                             districtName = parts[0];
                         } else {
                             districtName = 'NEGERI';
                         }
                         if(parts[1] !== 'ALL') slotName = parts[1];
                     }
                     scopesDisplay.push(`${districtName}(${slotName})`);
                });
                
                const scopeBadgeLabel = isAll ? `NEGERI [${item.kod_ppd[0].split(':')[1] || 'ALL'}]` : `DAERAH: ${scopesDisplay.join(', ')}`;
                const scopeBadgeColor = isAll ? 'text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50' : 'text-slate-600 border-slate-200 bg-white';
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
            window.renderAdminBookingDashboard();
            
            const viewAudit = document.getElementById('adminBookingAuditView');
            if (viewAudit && !viewAudit.classList.contains('hidden')) {
                window.loadAdminBookingAudit();
            }
        } catch (e) {
            toggleLoading(false);
            Swal.fire({ icon: 'error', title: 'Ralat Pemadaman', text: 'Gagal memadam data dari pangkalan data.', customClass: { popup: 'rounded-[2rem]' } });
        }
    }
};

window.changeAdminMonth = function(offset) {
    adminCurrentMonth += offset;
    adminSelectedDates = [];
    updateMultiLockUI();
    
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

window.loadAdminBookingAudit = async function() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-400 font-medium italic"><i class="fas fa-circle-notch fa-spin mr-2"></i>Menarik rekod audit dari pangkalan data...</td></tr>`;

    try {
        const db = getDatabaseClient();
        if (!db) throw new Error("Pangkalan data tidak tersedia.");

        // Tarik rekod secara serentak
        const [resTempahan, resKunci] = await Promise.all([
            db.from('smpid_bb_tempahan').select('*').order('tarikh', { ascending: false }),
            db.from('smpid_bb_kunci').select('*').order('tarikh', { ascending: false })
        ]);

        if (resTempahan.error) throw resTempahan.error;
        if (resKunci.error) throw resKunci.error;

        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

        let rawTempahan = resTempahan.data || [];
        let rawKunci = resKunci.data || [];

        // Laksana RBAC
        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && window.globalDashboardData) {
            const validSchoolCodes = window.globalDashboardData.map(s => s.kod_sekolah);
            validSchoolCodes.push(userKod);
            rawTempahan = rawTempahan.filter(b => validSchoolCodes.includes(b.kod_sekolah));
            
            let targetPPD = userKod;
            if (APP_CONFIG.PPD_MAPPING) {
                const foundKey = Object.keys(APP_CONFIG.PPD_MAPPING).find(k => k === userKod);
                if (foundKey) targetPPD = foundKey;
            }
            rawKunci = rawKunci.filter(k => {
               if(!k.kod_ppd) return false;
               const scopes = k.kod_ppd.split(',');
               return scopes.some(s => s.startsWith('ALL') || s.startsWith(targetPPD));
            });
        }

        // Peta data tempahan
        const mappedTempahan = rawTempahan.map(b => {
            let daerah = 'ALOR GAJAH';
            if (window.globalDashboardData) {
                const sMatch = window.globalDashboardData.find(s => s.kod_sekolah === b.kod_sekolah);
                if (sMatch && sMatch.daerah) daerah = sMatch.daerah;
            } else if (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[b.kod_sekolah]) {
                 daerah = APP_CONFIG.PPD_MAPPING[b.kod_sekolah];
            }
            return { ...b, type: 'BOOKING', daerah: daerah.toUpperCase() };
        });

        // Peta data kunci (Locks)
        const mappedKunci = rawKunci.map(k => {
            const isAll = k.kod_ppd && k.kod_ppd.includes('ALL');
            let parsedDaerah = [];
            
            if(k.kod_ppd) {
                const scopes = k.kod_ppd.split(',');
                scopes.forEach(s => {
                    const dKod = s.split(':')[0];
                    if(dKod === 'ALL') parsedDaerah.push('NEGERI');
                    else if (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[dKod]) parsedDaerah.push(APP_CONFIG.PPD_MAPPING[dKod]);
                    else parsedDaerah.push(dKod);
                });
            }
            
            const finalDaerah = parsedDaerah.join(', ');

            return {
                ...k,
                type: 'LOCK',
                daerah: finalDaerah,
                kod_sekolah: 'SYSTEM',
                nama_sekolah: 'KUNCI TARIKH (' + (k.kod_ppd || 'ALL') + ')',
                id_tempahan: 'LOCK-' + k.id,
                masa: 'SEHARI / SEPARA',
                tajuk_bengkel: k.komen || 'TIADA CATATAN',
                nama_pic: k.dikunci_oleh || 'PENTADBIR SISTEM',
                no_tel_pic: '-',
                status: 'DIKUNCI'
            };
        });

        // Gabung & susun mengikut tarikh
        globalAuditBookings = [...mappedTempahan, ...mappedKunci].sort((a, b) => new Date(b.tarikh) - new Date(a.tarikh));
        window.filterAudit();

    } catch (e) {
        console.error("Audit Load Error:", e);
        tbody.innerHTML = `<tr><td colspan="6" class="p-10 text-center text-red-500 font-bold bg-red-50 border-2 border-red-100">Gagal menarik data audit. Sila cuba lagi.</td></tr>`;
    }
};

window.filterAudit = function() {
    const searchInput = document.getElementById('auditSearchInput');
    const daerahInput = document.getElementById('auditDaerahFilter');
    
    const query = searchInput ? searchInput.value.trim().toUpperCase() : '';
    const daerahTarget = daerahInput ? daerahInput.value : 'ALL';
    auditDaerahFilter = daerahTarget;

    if (adminDaerahFilter !== daerahTarget) {
        adminDaerahFilter = daerahTarget;
        const mainSelect = document.getElementById('adminBookingFilterDaerah');
        if (mainSelect) mainSelect.value = daerahTarget;
        window.renderAdminBookingDashboard();
        window.renderAdminBookingCalendar();
    }

    filteredAuditBookings = globalAuditBookings.filter(b => {
        let matchDaerah = true;
        let matchSearch = true;

        if (daerahTarget !== 'ALL') {
            const targetName = (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[daerahTarget]) ? APP_CONFIG.PPD_MAPPING[daerahTarget] : daerahTarget;
            // Padanan tambahan bagi LOCK yang mengandungi NEGERI
            matchDaerah = b.daerah.includes(targetName.toUpperCase()) || b.daerah.includes('NEGERI');
        }

        if (query) {
            matchSearch = 
                (b.nama_sekolah && b.nama_sekolah.includes(query)) || 
                (b.kod_sekolah && b.kod_sekolah.includes(query)) || 
                (b.id_tempahan && b.id_tempahan.includes(query)) || 
                (b.nama_pic && b.nama_pic.includes(query)) ||
                (b.tajuk_bengkel && b.tajuk_bengkel.includes(query));
        }

        return matchDaerah && matchSearch;
    });

    renderAuditTable();
};

function renderAuditTable() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    if (filteredAuditBookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-slate-400 font-medium italic bg-slate-50/50">Tiada rekod ditemui berdasarkan carian anda.</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredAuditBookings.map((item, index) => {
        const dateObj = new Date(item.tarikh);
        const dateStr = dateObj.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });

        if (item.type === 'LOCK') {
            return `
                <tr class="bg-purple-50/30 hover:bg-purple-50 transition border-b border-purple-100 last:border-0 border-l-4 border-l-purple-500">
                    <td class="px-6 py-4 text-center font-mono text-[10px] font-bold text-slate-400">${index + 1}</td>
                    <td class="px-6 py-4">
                        <div class="font-bold text-slate-800 text-xs mb-1">${dateStr}</div>
                        <div class="text-[9px] font-black uppercase text-purple-600 tracking-wider"><i class="fas fa-lock mr-1"></i>${item.masa}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="font-bold text-purple-700 text-sm leading-snug wrap-safe max-w-[200px]">${item.nama_sekolah}</div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-[9px] font-mono font-bold bg-white px-1.5 py-0.5 rounded text-purple-500 border border-purple-200 shadow-sm">${item.kod_sekolah}</span>
                            <span class="text-[9px] font-bold text-purple-600 uppercase bg-purple-100 px-1.5 py-0.5 rounded">${item.daerah}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-700 wrap-safe max-w-[200px] leading-snug bg-white p-1.5 rounded border border-slate-200">"${item.tajuk_bengkel}"</div>
                        <div class="text-[9px] text-slate-400 font-mono mt-1 font-bold">REF: ${item.id_tempahan}</div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-xs font-bold text-slate-700 wrap-safe uppercase">${item.nama_pic}</div>
                        <div class="text-[10px] font-mono font-bold text-slate-500 mt-1">${item.no_tel_pic}</div>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="bg-purple-100 text-purple-700 px-2.5 py-1 rounded text-[10px] font-black tracking-widest border border-purple-200 shadow-sm">DIKUNCI</span>
                    </td>
                </tr>
            `;
        }

        // Render biasa untuk BOOKING
        let statusBadge = `<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-black tracking-widest border border-emerald-200 shadow-sm">AKTIF</span>`;
        if (item.status !== 'AKTIF') {
            statusBadge = `<span class="bg-red-100 text-red-700 px-2.5 py-1 rounded text-[10px] font-black tracking-widest border border-red-200 shadow-sm">BATAL</span>`;
        }

        return `
            <tr class="hover:bg-slate-50 transition border-b border-slate-50 last:border-0">
                <td class="px-6 py-4 text-center font-mono text-[10px] font-bold text-slate-400">${index + 1}</td>
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-800 text-xs mb-1">${dateStr}</div>
                    <div class="text-[9px] font-black uppercase text-slate-500 tracking-wider"><i class="fas fa-clock mr-1"></i>${item.masa}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="font-bold text-brand-600 text-sm leading-snug wrap-safe max-w-[200px]">${item.nama_sekolah}</div>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-[9px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">${item.kod_sekolah}</span>
                        <span class="text-[9px] font-bold text-slate-400 uppercase">${item.daerah}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs font-bold text-slate-700 wrap-safe max-w-[200px] leading-snug">${item.tajuk_bengkel}</div>
                    <div class="text-[9px] text-slate-400 font-mono mt-1 font-bold">REF: ${item.id_tempahan || '-'}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-xs font-bold text-slate-700 wrap-safe uppercase">${item.nama_pic}</div>
                    <div class="text-[10px] font-mono font-bold text-slate-500 mt-1">${item.no_tel_pic}</div>
                </td>
                <td class="px-6 py-4 text-center">
                    ${statusBadge}
                </td>
            </tr>
        `;
    }).join('');
}

window.eksportAuditCSV = function() {
    if (filteredAuditBookings.length === 0) {
        Swal.fire('Tiada Data', 'Tiada rekod untuk dieksport berdasarkan tapisan semasa.', 'warning');
        return;
    }

    let csvContent = "BIL,ID TEMPAHAN,JENIS REKOD,TARIKH,MASA,KOD SEKOLAH,NAMA SEKOLAH,DAERAH,FOKUS / CATATAN,NAMA PIC,NO TEL PIC,STATUS\n";

    filteredAuditBookings.forEach((b, index) => {
        const clean = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;
        const tarikh = b.tarikh ? new Date(b.tarikh).toLocaleDateString('ms-MY') : '-';
        
        const row = [
            index + 1,
            clean(b.id_tempahan),
            clean(b.type),
            clean(tarikh),
            clean(b.masa),
            clean(b.kod_sekolah),
            clean(b.nama_sekolah),
            clean(b.daerah),
            clean(b.tajuk_bengkel),
            clean(b.nama_pic),
            clean(b.no_tel_pic),
            clean(b.status)
        ];

        csvContent += row.join(",") + "\n";
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Semakan_Audit_Tempahan_Dan_Kunci_${new Date().toISOString().slice(0,10)}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};