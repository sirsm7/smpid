/**
 * BOOKING MODULE CONTROLLER (BB) - VERSION 6.4 (STRICT DISTRICT LOGIC & REAL WEEK CALCULATION)
 * Fungsi: Menguruskan logik tempahan dengan paparan Grid Kad Interaktif.
 * --- UPDATE V6.3 ---
 * 1. Menapis kelayakan hari (Allowed Days) secara spesifik mengikut daerah.
 * --- UPDATE V6.4 ---
 * 1. Menukar logik pengiraan tatasusunan minggu (`getWeeksInMonth`) supaya selari dengan 
 *    kalendar dunia sebenar (bermula hari Isnin).
 * 2. Memastikan `activeWeek` dijana dan dilaraskan mengikut tatasusunan kalendar sebenar.
 */

import { BookingService } from '../../js/services/booking.service.js';
import { SchoolService } from '../../js/services/school.service.js';
import { APP_CONFIG } from '../../js/config/app.config.js';
import { populateDropdown } from '../../js/config/dropdowns.js';
import { envReady } from '../../js/config/config.js';
import { initDatabaseClient } from '../../js/core/db.js';

let lifecycleBound = false;

async function ensureRuntimeReady() {
    if (typeof window !== 'undefined' && window.ENV_READY) {
        await window.ENV_READY;
    } else {
        await envReady;
    }
    await initDatabaseClient();
}

function clearElement(el) {
    if (!el) return;
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

function createIcon(iconClass) {
    const icon = document.createElement('i');
    icon.className = iconClass;
    return icon;
}

function parseLocalIsoDate(isoDate) {
    const parts = String(isoDate || '').split('T')[0].split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        return new Date(isoDate);
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

// --- STATE MANAGEMENT ---
const todayDate = new Date();
let currentMonth = todayDate.getMonth();
let currentYear = todayDate.getFullYear();

// FUNGSI BANTUAN MINGGU (ISNIN - AHAD) [DIKEMASKINI DARI booking_manager.js]
function getWeeksInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks = [];
    let currentWeek = [];
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        const dayOfWeek = (dateObj.getDay() + 6) % 7; // 0=Isnin, 6=Ahad
        
        currentWeek.push(d);
        
        if (dayOfWeek === 6 || d === daysInMonth) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    return weeks;
}

function getWeekNumberForDate(year, month, date) {
    const weeks = getWeeksInMonth(year, month);
    const index = weeks.findIndex(w => w.includes(date));
    return index >= 0 ? index + 1 : 1;
}

// LOGIK AUTO-MINGGU DIKEMASKINI: Mengira minggu semasa berdasarkan kalendar sebenar
let activeWeek = getWeekNumberForDate(currentYear, currentMonth, todayDate.getDate()); 

let selectedDateString = null; 
// SURGICAL EDIT START: Tambah atribut daerah untuk rujukan state global
let schoolInfo = { kod: '', nama: '', daerah: '' };
// SURGICAL EDIT END

// Day Configuration: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
const MALAY_MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

document.addEventListener('DOMContentLoaded', () => {
    initBookingPortal();
});

/**
 * Initialize school profile and UI components.
 */
async function initBookingPortal() {
    const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
    if (!kod) return window.location.replace('../../index.html');
    populateDropdown('tajukBengkel', 'BENGKEL');

    try {
        await ensureRuntimeReady();
        const data = await SchoolService.getByCode(kod);
        if (data) {
            schoolInfo.kod = data.kod_sekolah;
            schoolInfo.nama = data.nama_sekolah;
            const dispKod = document.getElementById('displayKod');
            if (dispKod) dispKod.textContent = schoolInfo.kod;

            const dispNama = document.getElementById('displayNama');
            if (dispNama) {
                dispNama.textContent = schoolInfo.nama.toUpperCase();
                dispNama.classList.add('wrap-safe');
            }

            let namaDaerah = data.daerah ? data.daerah.toUpperCase() : '';
            if (!namaDaerah && APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[kod]) {
                namaDaerah = APP_CONFIG.PPD_MAPPING[kod].toUpperCase();
            }

            schoolInfo.daerah = namaDaerah;

            if (namaDaerah) {
                const headerDaerahEl = document.getElementById('headerDaerah');
                if (headerDaerahEl) headerDaerahEl.textContent = `PEJABAT PENDIDIKAN DAERAH ${namaDaerah}`;

                const footerDaerahEl = document.getElementById('footerDaerah');
                if (footerDaerahEl) {
                    clearElement(footerDaerahEl);
                    const yearSpan = document.createElement('span');
                    yearSpan.id = 'currentYear';
                    yearSpan.textContent = String(new Date().getFullYear());
                    footerDaerahEl.appendChild(document.createTextNode('\u00A9 '));
                    footerDaerahEl.appendChild(yearSpan);
                    footerDaerahEl.appendChild(document.createTextNode(` PEJABAT PENDIDIKAN DAERAH ${namaDaerah}`));
                }
            }
        }
    } catch {}

    if (!lifecycleBound) {
        lifecycleBound = true;
        const syncPortalData = () => {
            const activeKod = schoolInfo.kod || kod;
            renderCalendar();
            if (activeKod) loadBookingHistory(activeKod);
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') syncPortalData();
        });
        window.addEventListener('online', syncPortalData);
    }

    await Promise.all([
        loadBookingHistory(schoolInfo.kod || kod),
        renderCalendar()
    ]);
}

/**
 * Load booking history for the current school with Premium UI.
 */
async function loadBookingHistory(kod) {
    const tbody = document.getElementById('historyTableBody');
    const countBadge = document.getElementById('historyCount');
    if (!tbody) return;
    const renderStatusRow = (text, cellClass) => {
        clearElement(tbody);
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3;
        td.className = cellClass;
        td.textContent = text;
        tr.appendChild(td);
        tbody.appendChild(tr);
    };

    renderStatusRow(
        'Memproses rekod bimbingan...',
        'p-12 text-center text-slate-400 text-xs animate-pulse'
    );

    try {
        await ensureRuntimeReady();
        const data = await BookingService.getSchoolBookings(kod);
        const list = Array.isArray(data) ? data : [];
        if (countBadge) countBadge.textContent = `${list.length} Permohonan`;

        if (list.length === 0) {
            renderStatusRow(
                'Tiada rekod tempahan ditemui untuk sekolah ini.',
                'p-12 text-center text-slate-400 italic bg-slate-50/50'
            );
            return;
        }

        clearElement(tbody);
        const fragment = document.createDocumentFragment();

        list.forEach((item) => {
            const dateObj = parseLocalIsoDate(item.tarikh);
            const dateStr = dateObj.toLocaleDateString('ms-MY', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });

            let sessionIcon = 'fa-sun text-amber-500';
            let sessionBg = 'bg-amber-50 text-amber-700 border-amber-100';

            if (item.masa === 'Petang') {
                sessionIcon = 'fa-moon text-indigo-400';
                sessionBg = 'bg-indigo-50 text-indigo-700 border-indigo-100';
            } else if (item.masa === '1 HARI') {
                sessionIcon = 'fa-clock text-purple-500';
                sessionBg = 'bg-purple-50 text-purple-700 border-purple-100';
            }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 group';

            const tdDate = document.createElement('td');
            tdDate.className = 'px-6 py-5 align-top';
            const dateCol = document.createElement('div');
            dateCol.className = 'flex flex-col gap-1.5';
            const dateDiv = document.createElement('div');
            dateDiv.className = 'font-mono font-black text-slate-800 text-xs tracking-tighter uppercase';
            dateDiv.textContent = dateStr;
            const masaBadge = document.createElement('div');
            masaBadge.className = `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[9px] font-black w-fit ${sessionBg} transition-transform group-hover:scale-105`;
            masaBadge.appendChild(createIcon(`fas ${sessionIcon}`));
            masaBadge.appendChild(document.createTextNode(` ${String(item.masa || '').toUpperCase()}`));
            dateCol.appendChild(dateDiv);
            dateCol.appendChild(masaBadge);
            tdDate.appendChild(dateCol);

            const tdTitle = document.createElement('td');
            tdTitle.className = 'px-6 py-5 align-top';
            const titleCol = document.createElement('div');
            titleCol.className = 'flex flex-col gap-1';
            const titleDiv = document.createElement('div');
            titleDiv.className = 'text-xs font-bold text-slate-700 uppercase leading-relaxed wrap-safe max-w-sm group-hover:text-brand-600 transition-colors';
            titleDiv.title = item.tajuk_bengkel || '';
            titleDiv.textContent = item.tajuk_bengkel || '-';
            const refDiv = document.createElement('div');
            refDiv.className = 'text-[9px] text-slate-400 font-mono font-bold';
            refDiv.textContent = `REF: ${item.id_tempahan || '-'}`;
            titleCol.appendChild(titleDiv);
            titleCol.appendChild(refDiv);
            tdTitle.appendChild(titleCol);

            const tdStatus = document.createElement('td');
            tdStatus.className = 'px-6 py-5 text-center align-top';
            const statusSpan = document.createElement('span');
            const isAktif = item.status === 'AKTIF';
            statusSpan.className = isAktif
                ? 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black border bg-emerald-50 text-emerald-600 border-emerald-200 min-w-[80px] justify-center shadow-sm'
                : 'inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black border bg-red-50 text-red-600 border-red-200 min-w-[80px] justify-center shadow-sm';
            statusSpan.textContent = isAktif ? 'AKTIF' : 'BATAL';
            tdStatus.appendChild(statusSpan);

            tr.appendChild(tdDate);
            tr.appendChild(tdTitle);
            tr.appendChild(tdStatus);
            fragment.appendChild(tr);
        });

        tbody.appendChild(fragment);
    } catch {
        renderStatusRow(
            'Gagal memproses data sejarah dari pelayan.',
            'p-12 text-center text-red-500 font-bold bg-red-50 border border-red-100 rounded-xl'
        );
    }
}

/**
 * Menyemak sama ada sesuatu tarikh dibenarkan berdasarkan daerah dan logik minggu
 * Jasin: Selasa, Rabu, Khamis sahaja
 * Alor Gajah: Selasa, Rabu, Khamis, + Sabtu (Minggu 3)
 * Melaka Tengah: Isnin, Selasa, Rabu, Khamis
 * @param {Date} dateObj - Objek tarikh untuk disemak
 * @returns {boolean} - True jika dibenarkan
 */
function checkIsAllowedDay(dateObj) {
    const dayOfWeek = dateObj.getDay(); // 0:Ahad, 1:Isnin, 2:Selasa, 3:Rabu, 4:Khamis, 5:Jumaat, 6:Sabtu
    const dayOfMonth = dateObj.getDate();
    const dName = schoolInfo.daerah.toUpperCase();
    const dCode = schoolInfo.kod;
    
    // Gunakan nama daerah sebenar, padanan ID fallback
    const isJasin = (dName === 'JASIN' || dCode === 'M010');
    const isMelakaTengah = (dName === 'MELAKA TENGAH' || dCode === 'M020');
    // Jika tidak dapat ditentukan secara pasti, kita anggap Alor Gajah (default behavior lama)
    const isAlorGajah = (!isJasin && !isMelakaTengah); 

    // PERATURAN UNIVERSAL (Semua daerah): Selasa (2), Rabu (3), Khamis (4) sentiasa dibenarkan
    if ([2, 3, 4].includes(dayOfWeek)) return true;

    // PERATURAN JASIN: Tiada hari tambahan (Sudah dicover di atas)
    if (isJasin) return false;

    // PERATURAN MELAKA TENGAH: Isnin (1) dibenarkan tambahan
    if (isMelakaTengah && dayOfWeek === 1) return true;

    // PERATURAN ALOR GAJAH: Sabtu (6) dibenarkan HANYA pada minggu ke-3 (15hb - 21hb)
    if (isAlorGajah && dayOfWeek === 6) {
        if (dayOfMonth >= 15 && dayOfMonth <= 21) return true;
    }

    return false;
}

/**
 * Main Render: Grid-based Calendar Cards.
 */
window.renderCalendar = async function() {
    const container = document.getElementById('calendarBody');
    const monthLabel = document.getElementById('monthDisplay');
    const tabsContainer = document.getElementById('weekTabsContainer');
    
    if (!container || !monthLabel || !tabsContainer) return;

    clearElement(container);
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'col-span-full py-20 text-center flex flex-col items-center justify-center';
    loadingDiv.appendChild(createIcon('fas fa-circle-notch fa-spin text-slate-300 text-3xl mb-4'));
    const loadingP = document.createElement('p');
    loadingP.className = 'text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse';
    loadingP.textContent = 'Menjana Jadual...';
    loadingDiv.appendChild(loadingP);
    container.appendChild(loadingDiv);

    monthLabel.textContent = `${MALAY_MONTHS[currentMonth]} ${currentYear}`.toUpperCase();

    try {
        await ensureRuntimeReady();
        const { bookedSlots, lockedDetails } = await BookingService.getMonthlyData(currentYear, currentMonth);

        const weeks = getWeeksInMonth(currentYear, currentMonth);
        const pad = (n) => String(n).padStart(2, '0');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const totalWeeks = weeks.length;
        if (activeWeek > totalWeeks) activeWeek = 1;

        clearElement(tabsContainer);
        const tabsFrag = document.createDocumentFragment();
        for (let w = 1; w <= totalWeeks; w++) {
            const isActive = activeWeek === w;
            const tabBtn = document.createElement('button');
            tabBtn.type = 'button';
            tabBtn.className = `week-tab min-h-[44px] ${isActive ? 'week-tab-active' : 'week-tab-inactive'}`;
            tabBtn.textContent = `MINGGU ${w}`;
            const targetWeek = w;
            tabBtn.addEventListener('click', () => window.switchWeek(targetWeek));
            tabsFrag.appendChild(tabBtn);
        }
        tabsContainer.appendChild(tabsFrag);

        const currentWeekDays = weeks[activeWeek - 1] || [];
        clearElement(container);
        const cardsFrag = document.createDocumentFragment();
        let hasContent = false;

        for (let i = 0; i < currentWeekDays.length; i++) {
            const d = currentWeekDays[i];
            const dateString = `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;
            const dateObj = new Date(currentYear, currentMonth, d);
            dateObj.setHours(0, 0, 0, 0);

            const dayOfWeek = dateObj.getDay();
            const isAllowedDay = checkIsAllowedDay(dateObj);
            const isLocked = Object.prototype.hasOwnProperty.call(lockedDetails, dateString);
            const slotsTaken = bookedSlots[dateString] || [];

            const minNoticeDate = new Date();
            minNoticeDate.setDate(today.getDate() + 3);
            minNoticeDate.setHours(0, 0, 0, 0);

            const isPast = dateObj < today;
            const isTooSoon = dateObj < minNoticeDate;

            let status = 'open';
            let statusText = 'KOSONG';
            let statusIcon = 'fa-check-circle';

            const isSaturday = dayOfWeek === 6;
            const isFullDayTaken = slotsTaken.includes('1 HARI');
            let filledCount = isFullDayTaken ? 2 : slotsTaken.length;
            const maxCapacity = isSaturday ? 1 : 2;

            if (isPast) {
                status = 'closed';
                statusText = 'LEPAS';
                statusIcon = 'fa-history';
            } else if (isTooSoon) {
                status = 'closed';
                statusText = 'TUTUP';
                statusIcon = 'fa-clock';
            } else if (!isAllowedDay) {
                status = 'closed';
                statusText = 'TIADA SESI';
                statusIcon = 'fa-ban';
            } else if (isLocked) {
                status = 'locked';
                statusText = 'DIKUNCI';
                statusIcon = 'fa-lock';
            } else if (filledCount >= maxCapacity) {
                status = 'full';
                statusText = 'PENUH';
                statusIcon = 'fa-users-slash';
            } else if (filledCount > 0) {
                status = 'partial';
                statusText = 'TERHAD';
                statusIcon = 'fa-exclamation-circle';
            }

            const isSelected = dateString === selectedDateString;
            const card = document.createElement('div');
            card.className = `day-card card-${status} ${isSelected ? 'card-active' : ''} animate-fade-in group`;

            let statusColorClass = 'text-brand-600 bg-brand-50 border-brand-200';
            if (status === 'full') statusColorClass = 'text-red-500 bg-red-50 border-red-200';
            if (status === 'locked') statusColorClass = 'text-purple-600 bg-purple-50 border-purple-200';
            if (status === 'partial') statusColorClass = 'text-amber-600 bg-amber-50 border-amber-200';
            if (status === 'closed') statusColorClass = 'text-slate-400 bg-slate-100 border-slate-200';

            const topFlex = document.createElement('div');
            topFlex.className = 'flex justify-between items-start';

            const dayCol = document.createElement('div');
            const dayNameSpan = document.createElement('span');
            dayNameSpan.className = 'text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1';
            dayNameSpan.textContent = DAY_NAMES[dayOfWeek];
            const dayNumSpan = document.createElement('span');
            dayNumSpan.className = 'text-3xl font-black text-slate-800 leading-none';
            dayNumSpan.textContent = String(d);
            dayCol.appendChild(dayNameSpan);
            dayCol.appendChild(dayNumSpan);

            const badgeCircle = document.createElement('div');
            badgeCircle.className = `${statusColorClass} w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm transition-transform group-hover:rotate-12`;
            badgeCircle.appendChild(createIcon(`fas ${statusIcon}`));

            topFlex.appendChild(dayCol);
            topFlex.appendChild(badgeCircle);

            const bottomDiv = document.createElement('div');
            bottomDiv.className = 'mt-4';
            const statusBadge = document.createElement('span');
            statusBadge.className = `inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${statusColorClass} border`;
            statusBadge.textContent = statusText;
            bottomDiv.appendChild(statusBadge);

            if (isLocked && lockedDetails[dateString]) {
                const lockNote = document.createElement('div');
                lockNote.className = 'text-[9px] text-purple-500 font-bold mt-1 uppercase wrap-safe leading-tight break-words';
                lockNote.textContent = lockedDetails[dateString];
                bottomDiv.appendChild(lockNote);
            }

            card.appendChild(topFlex);
            card.appendChild(bottomDiv);

            if (status === 'open' || status === 'partial') {
                card.addEventListener('click', () => handleCardSelection(dateString, slotsTaken, card));
            }

            cardsFrag.appendChild(card);
            hasContent = true;
        }

        if (!hasContent) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'col-span-full py-10 text-center text-slate-400 text-sm italic border-2 border-dashed border-slate-200 rounded-xl';
            emptyDiv.textContent = 'Tiada tarikh aktif dalam minggu ini.';
            cardsFrag.appendChild(emptyDiv);
        }

        container.appendChild(cardsFrag);
    } catch {
        clearElement(container);
        const errDiv = document.createElement('div');
        errDiv.className = 'col-span-full py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl border-2 border-red-100';
        errDiv.textContent = 'Gagal memuatkan data kalendar.';
        container.appendChild(errDiv);
    }
};

function handleCardSelection(dateStr, slotsTaken, element) {
    selectedDateString = dateStr;
    document.querySelectorAll('.day-card').forEach((r) => r.classList.remove('card-active'));
    element.classList.add('card-active');

    const dateObj = parseLocalIsoDate(dateStr);
    const dayOfWeek = dateObj.getDay();
    const dateReadable = dateObj.toLocaleDateString('ms-MY', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const displayInput = document.getElementById('displayDate');
    displayInput.value = dateReadable.toUpperCase();
    displayInput.classList.remove('bg-brand-50/50', 'cursor-not-allowed', 'text-brand-700');
    displayInput.classList.add('bg-white', 'text-slate-800', 'border-brand-500');

    document.getElementById('rawDate').value = dateStr;
    document.getElementById('slotWrapper').classList.remove('hidden');

    const radioPagi = document.querySelector('input[name="inputMasa"][value="Pagi"]');
    const radioPetang = document.querySelector('input[name="inputMasa"][value="Petang"]');
    const radioSehari = document.querySelector('input[name="inputMasa"][value="1 HARI"]');

    const labelPagi = document.getElementById('labelPagi');
    const labelPetang = document.getElementById('labelPetang');
    const labelSehari = document.getElementById('labelSehari');

    [radioPagi, radioPetang, radioSehari].forEach((r) => {
        if (r) {
            r.disabled = true;
            r.checked = false;
        }
    });
    [labelPagi, labelPetang, labelSehari].forEach((l) => {
        if (l) {
            l.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            l.classList.remove('opacity-100', 'pointer-events-auto', 'grayscale-0');
        }
    });

    const isAllowedDay = checkIsAllowedDay(dateObj);

    if (isAllowedDay && !slotsTaken.includes('Pagi') && !slotsTaken.includes('1 HARI') && radioPagi && labelPagi) {
        radioPagi.disabled = false;
        labelPagi.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }

    const isNormalDay = dayOfWeek !== 0 && dayOfWeek !== 6;
    if (isNormalDay && isAllowedDay && !slotsTaken.includes('Petang') && !slotsTaken.includes('1 HARI') && radioPetang && labelPetang) {
        radioPetang.disabled = false;
        labelPetang.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }

    if (isNormalDay && isAllowedDay && slotsTaken.length === 0 && radioSehari && labelSehari) {
        radioSehari.disabled = false;
        labelSehari.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
    }

    checkFormValidity();
    document.querySelectorAll('input[name="inputMasa"]').forEach((r) => {
        r.onchange = checkFormValidity;
    });
}

/**
 * Validates form state to enable submit button.
 */
function checkFormValidity() {
    const date = document.getElementById('rawDate').value;
    const masa = document.querySelector('input[name="inputMasa"]:checked');
    const btn = document.getElementById('btnSubmit');
    
    if (date && masa) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

/**
 * Week & Month Navigation.
 */
window.switchWeek = function(w) {
    activeWeek = w;
    resetSelection();
    renderCalendar();
};

window.changeMonth = function(offset) {
    currentMonth += offset;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    
    // Auto-calculate week only if it returns to the actual current real-time month
    const realToday = new Date();
    if (currentMonth === realToday.getMonth() && currentYear === realToday.getFullYear()) {
        activeWeek = getWeekNumberForDate(currentYear, currentMonth, realToday.getDate());
    } else {
        activeWeek = 1; 
    }
    
    resetSelection();
    renderCalendar();
};

/**
 * Resets form selection and UI state.
 */
function resetSelection() {
    selectedDateString = null;
    document.getElementById('btnSubmit').disabled = true;
    document.getElementById('slotWrapper').classList.add('hidden');
    
    const disp = document.getElementById('displayDate');
    disp.value = "";
    disp.classList.add('bg-brand-50/50', 'cursor-not-allowed');
    disp.classList.remove('bg-white', 'text-slate-800', 'border-brand-500');
    disp.placeholder = "SILA PILIH TARIKH DI KIRI";
}

/**
 * Form submission logic with SweetAlert2.
 */
window.handleBookingSubmit = async function() {
    const date = document.getElementById('rawDate').value;
    const tajukBengkel = document.getElementById('tajukBengkel').value;
    const masaInp = document.querySelector('input[name="inputMasa"]:checked');
    const picName = document.getElementById('picName').value.trim();
    const picPhone = document.getElementById('picPhone').value.trim();
    const btn = document.getElementById('btnSubmit');

    if (!date || !tajukBengkel || !masaInp || !picName || !picPhone) {
        return Swal.fire({ icon: "warning", title: "Tidak Lengkap", text: "Sila isi semua maklumat bertanda." });
    }

    const payload = {
        tarikh: date,
        masa: masaInp.value, // Will send 'Pagi', 'Petang', or '1 HARI'
        tajuk_bengkel: tajukBengkel,
        nama_pic: picName.toUpperCase(),
        no_tel_pic: picPhone,
        kod_sekolah: schoolInfo.kod,
        nama_sekolah: schoolInfo.nama.toUpperCase()
    };

    document.getElementById('loadingOverlay').classList.remove('hidden');
    btn.disabled = true;

    try {
        const result = await BookingService.createBooking(payload);
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        const refWrap = document.createElement('div');
        refWrap.appendChild(document.createTextNode('Nombor Rujukan:'));
        refWrap.appendChild(document.createElement('br'));
        const refBold = document.createElement('b');
        refBold.className = 'text-xl font-mono text-brand-600 mt-2 block';
        refBold.textContent = result.bookingId || '-';
        refWrap.appendChild(refBold);
        refWrap.appendChild(document.createElement('br'));
        const refNote = document.createElement('span');
        refNote.className = 'text-sm text-slate-500 wrap-safe';
        refNote.textContent = 'Sila simpan nombor ini untuk rujukan urusan bimbingan.';
        refWrap.appendChild(refNote);

        await Swal.fire({
            icon: 'success',
            title: 'Tempahan Berjaya!',
            html: refWrap,
            confirmButtonColor: '#2563eb'
        });

        const noticeWrap = document.createElement('div');
        noticeWrap.className = 'text-left text-sm space-y-3 mt-2 text-slate-700';
        const p1 = document.createElement('p');
        p1.textContent = 'Tempahan anda telah direkodkan ke dalam sistem.';
        const p2 = document.createElement('p');
        p2.className = 'font-bold text-red-600';
        p2.textContent = 'PERHATIAN PENTING:';
        const ul = document.createElement('ul');
        ul.className = 'list-disc pl-5 space-y-1';
        const li1 = document.createElement('li');
        li1.appendChild(document.createTextNode('Sila hubungi '));
        const bPic = document.createElement('b');
        bPic.textContent = 'PIC DAERAH';
        li1.appendChild(bPic);
        li1.appendChild(document.createTextNode(' untuk pengesahan segera.'));
        const li2 = document.createElement('li');
        li2.appendChild(document.createTextNode('Anda juga diwajibkan untuk menghantar '));
        const bSurat = document.createElement('b');
        bSurat.textContent = 'surat makluman rasmi';
        li2.appendChild(bSurat);
        li2.appendChild(document.createTextNode(' kepada Pejabat Pendidikan Daerah (PPD).'));
        ul.appendChild(li1);
        ul.appendChild(li2);
        noticeWrap.appendChild(p1);
        noticeWrap.appendChild(p2);
        noticeWrap.appendChild(ul);

        await Swal.fire({
            icon: 'info',
            title: 'Tindakan Susulan',
            html: noticeWrap,
            confirmButtonText: 'Saya Faham & Akan Selesaikan',
            confirmButtonColor: '#059669',
            allowOutsideClick: false
        });

        document.getElementById('bookingForm').reset();
        resetSelection();

        await Promise.all([
            renderCalendar(),
            loadBookingHistory(schoolInfo.kod)
        ]);
    } catch (err) {
        document.getElementById('loadingOverlay').classList.add('hidden');
        btn.disabled = false;
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.message });
    }
};

// Global Exports for HTML Click Handlers
window.changeMonth = changeMonth;
window.switchWeek = switchWeek;
window.handleBookingSubmit = handleBookingSubmit;