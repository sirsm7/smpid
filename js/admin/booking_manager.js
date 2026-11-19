import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { BookingService } from "../services/booking.service.js";
import { toggleLoading, cleanPhone } from "../core/helpers.js";

const todayDate = new Date();
let adminCurrentMonth = todayDate.getMonth();
let adminCurrentYear = todayDate.getFullYear();

function getWeeksInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let currentWeek = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateObj = new Date(year, month, d);
    const dayOfWeek = (dateObj.getDay() + 6) % 7;
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
  const index = weeks.findIndex((w) => w.includes(date));
  return index >= 0 ? index + 1 : 1;
}

let adminActiveWeek = getWeekNumberForDate(
  adminCurrentYear,
  adminCurrentMonth,
  todayDate.getDate()
);
let adminSelectedDates = [];
let adminDaerahFilter = "ALL";
let globalAuditBookings = [];
let filteredAuditBookings = [];
let auditDaerahFilter = "ALL";
let realtimeSubscribed = false;
let dateActionBusy = false;
let cancelBookingBusy = false;

const MALAY_MONTHS = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember"
];
const DAY_NAMES = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function createIcon(iconClass) {
  const icon = document.createElement("i");
  icon.className = iconClass;
  return icon;
}

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message =
    options && (options.text || options.title)
      ? `${options.title || ""}\n${options.text || ""}`.trim()
      : "";
  if (options && options.showCancelButton) {
    const confirmed = window.confirm(message);
    return Promise.resolve({ isConfirmed: confirmed, isDenied: false });
  }
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true, isDenied: false });
}

async function silentRefreshAllBookingViews() {
  try {
    await window.renderAdminBookingDashboard();
    await window.renderAdminBookingCalendar();
    await window.loadAdminBookingList();
    const viewAudit = document.getElementById("adminBookingAuditView");
    if (viewAudit && !viewAudit.classList.contains("hidden")) {
      await window.loadAdminBookingAudit();
    }
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  Promise.all([
    RealtimeManager.subscribeTable({
      key: "admin_bb_tempahan",
      table: "smpid_bb_tempahan",
      primaryKey: "id",
      cacheStore: "query_cache",
      cachePrefix: "booking",
      onChange: async () => {
        await silentRefreshAllBookingViews();
      },
      onSync: async () => {
        await silentRefreshAllBookingViews();
      }
    }),
    RealtimeManager.subscribeTable({
      key: "admin_bb_kunci",
      table: "smpid_bb_kunci",
      primaryKey: "id",
      cacheStore: "query_cache",
      cachePrefix: "booking",
      onChange: async () => {
        await silentRefreshAllBookingViews();
      },
      onSync: async () => {
        await silentRefreshAllBookingViews();
      }
    })
  ]).catch(() => {
    realtimeSubscribed = false;
  });
}

function createKpiCard(titleText, valueId, iconClass, hoverBorderClass, badgeBgClass, badgeTextClass) {
  const card = document.createElement("div");
  card.className = `bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between group ${hoverBorderClass} transition-colors`;

  const infoDiv = document.createElement("div");
  const titleP = document.createElement("p");
  titleP.className = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1";
  titleP.textContent = titleText;

  const valH3 = document.createElement("h3");
  valH3.className = "text-2xl font-black text-slate-800 leading-none";
  valH3.id = valueId;
  valH3.textContent = "0";

  infoDiv.appendChild(titleP);
  infoDiv.appendChild(valH3);

  const iconBox = document.createElement("div");
  iconBox.className = `w-12 h-12 rounded-xl ${badgeBgClass} ${badgeTextClass} flex items-center justify-center text-xl group-hover:scale-110 transition-transform shrink-0`;
  iconBox.appendChild(createIcon(iconClass));

  card.appendChild(infoDiv);
  card.appendChild(iconBox);
  return card;
}

function buildBookingAdminLayout() {
  const root = document.createElement("div");
  root.className = "p-6 md:p-8";
  root.id = "bookingAdminContent";

  const headerRow = document.createElement("div");
  headerRow.className =
    "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b-2 border-slate-100 pb-6";

  const titleCol = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.className = "text-2xl font-bold text-slate-800 tracking-tight";
  h2.textContent = "Pengurusan Bimbingan & Bengkel";
  const subP = document.createElement("p");
  subP.className = "text-slate-500 text-sm font-medium";
  subP.textContent = "Kawal baki slot, kunci tarikh daerah, dan semak tempahan aktif.";
  titleCol.appendChild(h2);
  titleCol.appendChild(subP);

  const tabBar = document.createElement("div");
  tabBar.className =
    "flex flex-wrap bg-slate-100 p-1.5 rounded-2xl shadow-inner border-2 border-slate-200 gap-1";

  const viewTabs = [
    {
      id: "btnViewCal",
      view: "calendar",
      label: "KALENDAR",
      cls: "min-h-[44px] px-5 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105"
    },
    {
      id: "btnViewList",
      view: "list",
      label: "SENARAI AKTIF",
      cls: "min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all"
    },
    {
      id: "btnViewAudit",
      view: "audit",
      label: "SEMAKAN AUDIT",
      cls: "min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all"
    }
  ];

  viewTabs.forEach((tab) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = tab.id;
    btn.className = tab.cls;
    btn.textContent = tab.label;
    btn.addEventListener("click", () => {
      window.switchAdminBookingView(tab.view);
    });
    tabBar.appendChild(btn);
  });

  headerRow.appendChild(titleCol);
  headerRow.appendChild(tabBar);
  root.appendChild(headerRow);

  const kpiPanel = document.createElement("div");
  kpiPanel.id = "adminBookingDashboardPanel";
  kpiPanel.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-up";

  kpiPanel.appendChild(
    createKpiCard(
      "Sekolah Memohon",
      "kpiSekolahMemohon",
      "fas fa-school",
      "hover:border-emerald-300",
      "bg-emerald-50",
      "text-emerald-600"
    )
  );
  kpiPanel.appendChild(
    createKpiCard(
      "Kunci Negeri (ALL)",
      "kpiKunciNegeri",
      "fas fa-globe",
      "hover:border-fuchsia-300",
      "bg-fuchsia-50",
      "text-fuchsia-600"
    )
  );
  kpiPanel.appendChild(
    createKpiCard(
      "Kunci Daerah",
      "kpiKunciDaerah",
      "fas fa-map-marker-alt",
      "hover:border-purple-300",
      "bg-purple-50",
      "text-purple-600"
    )
  );

  const totalDarkCard = document.createElement("div");
  totalDarkCard.className =
    "bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 border border-slate-700 shadow-md flex items-center justify-between relative overflow-hidden group";

  const bgDecor = document.createElement("div");
  bgDecor.className =
    "absolute -right-4 -bottom-4 opacity-10 transform group-hover:scale-110 transition-transform";
  bgDecor.appendChild(createIcon("fas fa-calendar-times text-7xl"));

  const darkContent = document.createElement("div");
  darkContent.className = "relative z-10";

  const darkLabel = document.createElement("p");
  darkLabel.className = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1";
  darkLabel.textContent = "Jumlah Hari Dikunci";

  const darkVal = document.createElement("h3");
  darkVal.className = "text-3xl font-black text-white leading-none";
  darkVal.id = "kpiJumlahHariKunci";
  darkVal.textContent = "0";

  const yearNote = document.createElement("p");
  yearNote.className = "text-[9px] text-slate-400 mt-1 font-bold";
  yearNote.appendChild(document.createTextNode("Tahun "));
  const yearSpan = document.createElement("span");
  yearSpan.id = "kpiTahunSemasa";
  yearSpan.textContent = String(new Date().getFullYear());
  yearNote.appendChild(yearSpan);

  darkContent.appendChild(darkLabel);
  darkContent.appendChild(darkVal);
  darkContent.appendChild(yearNote);
  totalDarkCard.appendChild(bgDecor);
  totalDarkCard.appendChild(darkContent);
  kpiPanel.appendChild(totalDarkCard);
  root.appendChild(kpiPanel);

  const calView = document.createElement("div");
  calView.id = "adminBookingCalendarView";
  calView.className = "animate-fade-up";

  const calCard = document.createElement("div");
  calCard.className = "bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm";

  const calHeader = document.createElement("div");
  calHeader.className =
    "p-5 bg-slate-50/50 border-b-2 border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4";

  const monthNav = document.createElement("div");
  monthNav.className = "flex items-center justify-between w-full sm:w-auto";

  const prevMonthBtn = document.createElement("button");
  prevMonthBtn.type = "button";
  prevMonthBtn.className =
    "min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-white hover:shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all";
  prevMonthBtn.appendChild(createIcon("fas fa-chevron-left"));
  prevMonthBtn.addEventListener("click", () => {
    window.changeAdminMonth(-1);
  });

  const monthLabel = document.createElement("h3");
  monthLabel.id = "adminMonthLabel";
  monthLabel.className = "font-black text-slate-800 uppercase tracking-tighter text-base mx-4";
  monthLabel.textContent = "...";

  const nextMonthBtn = document.createElement("button");
  nextMonthBtn.type = "button";
  nextMonthBtn.className =
    "min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-white hover:shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-brand-600 transition-all";
  nextMonthBtn.appendChild(createIcon("fas fa-chevron-right"));
  nextMonthBtn.addEventListener("click", () => {
    window.changeAdminMonth(1);
  });

  monthNav.appendChild(prevMonthBtn);
  monthNav.appendChild(monthLabel);
  monthNav.appendChild(nextMonthBtn);

  const calTools = document.createElement("div");
  calTools.className = "flex flex-wrap items-center gap-2 w-full sm:w-auto";

  const daerahWrap = document.createElement("div");
  daerahWrap.id = "adminBookingFilterDaerahWrapper";
  daerahWrap.className = "hidden w-full sm:w-auto";

  const daerahSelect = document.createElement("select");
  daerahSelect.id = "adminBookingFilterDaerah";
  daerahSelect.className =
    "w-full sm:w-48 min-h-[44px] p-2 rounded-xl border-2 border-slate-200 text-xs font-bold outline-none focus:border-brand-500 bg-white";
  daerahSelect.addEventListener("change", (e) => {
    window.setAdminBookingDaerah(e.target.value);
  });
  daerahWrap.appendChild(daerahSelect);

  const multiLockBtn = document.createElement("button");
  multiLockBtn.type = "button";
  multiLockBtn.id = "btnMultiLock";
  multiLockBtn.className =
    "hidden min-h-[44px] px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md items-center gap-2";
  multiLockBtn.appendChild(createIcon("fas fa-lock"));
  multiLockBtn.appendChild(document.createTextNode(" Kunci "));
  const multiCountSpan = document.createElement("span");
  multiCountSpan.id = "multiLockCount";
  multiCountSpan.textContent = "0";
  multiLockBtn.appendChild(multiCountSpan);
  multiLockBtn.appendChild(document.createTextNode(" Tarikh"));
  multiLockBtn.addEventListener("click", () => {
    window.handleMultiDateAction();
  });

  calTools.appendChild(daerahWrap);
  calTools.appendChild(multiLockBtn);

  calHeader.appendChild(monthNav);
  calHeader.appendChild(calTools);
  calCard.appendChild(calHeader);

  const calBody = document.createElement("div");
  calBody.className = "p-6";

  const weekScroll = document.createElement("div");
  weekScroll.className = "overflow-x-auto pb-4 mb-4";
  const weekTabs = document.createElement("div");
  weekTabs.className = "flex gap-2 min-w-max";
  weekTabs.id = "adminWeekTabsContainer";
  weekScroll.appendChild(weekTabs);

  const legendBox = document.createElement("div");
  legendBox.className =
    "flex flex-wrap gap-4 justify-center mb-6 bg-slate-100/50 p-4 rounded-2xl border-2 border-slate-200/50";

  const legends = [
    { dot: "bg-white border-slate-300", text: "Kosong", textCls: "text-slate-500" },
    { dot: "bg-amber-100 border-amber-400", text: "1 Slot", textCls: "text-slate-500" },
    { dot: "bg-red-100 border-red-400", text: "Penuh", textCls: "text-slate-500" },
    { dot: "bg-purple-100 border-purple-400", text: "Dikunci", textCls: "text-slate-500" },
    { dot: "bg-slate-200 border-slate-300", text: "Lepas / Tutup", textCls: "text-slate-400" }
  ];

  legends.forEach((leg) => {
    const item = document.createElement("div");
    item.className = "flex items-center gap-2";
    const dot = document.createElement("span");
    dot.className = `w-3 h-3 rounded-full ${leg.dot} border-2 shadow-sm`;
    const lbl = document.createElement("span");
    lbl.className = `text-[10px] font-bold ${leg.textCls} uppercase`;
    lbl.textContent = leg.text;
    item.appendChild(dot);
    item.appendChild(lbl);
    legendBox.appendChild(item);
  });

  const calGrid = document.createElement("div");
  calGrid.id = "adminCalendarGrid";
  calGrid.className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";

  calBody.appendChild(weekScroll);
  calBody.appendChild(legendBox);
  calBody.appendChild(calGrid);
  calCard.appendChild(calBody);
  calView.appendChild(calCard);
  root.appendChild(calView);

  const listView = document.createElement("div");
  listView.id = "adminBookingListView";
  listView.className = "hidden animate-fade-up";

  const listCard = document.createElement("div");
  listCard.className = "bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm";

  const listBanner = document.createElement("div");
  listBanner.className = "p-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3";
  listBanner.appendChild(createIcon("fas fa-info-circle text-amber-500 mt-0.5"));
  const bannerP = document.createElement("p");
  bannerP.className = "text-[10px] font-bold text-amber-700 uppercase tracking-widest";
  bannerP.textContent =
    "Hanya tempahan dan kunci tarikh bagi hari ini dan akan datang sahaja dipaparkan.";
  listBanner.appendChild(bannerP);

  const listScroll = document.createElement("div");
  listScroll.className = "overflow-x-auto";

  const listTable = document.createElement("table");
  listTable.className = "w-full text-sm text-left";

  const listThead = document.createElement("thead");
  listThead.className =
    "bg-slate-50 text-[10px] font-black text-slate-400 uppercase border-b-2 border-slate-100";
  const listHeadTr = document.createElement("tr");

  [
    { text: "Tarikh & Masa", cls: "px-8 py-5" },
    { text: "Sekolah / Maklumat Kunci", cls: "px-8 py-5" },
    { text: "PIC / Log Admin", cls: "px-8 py-5" },
    { text: "Tindakan", cls: "px-8 py-5 text-center" }
  ].forEach((col) => {
    const th = document.createElement("th");
    th.className = col.cls;
    th.textContent = col.text;
    listHeadTr.appendChild(th);
  });
  listThead.appendChild(listHeadTr);

  const listTbody = document.createElement("tbody");
  listTbody.id = "adminBookingTableBody";
  listTbody.className = "divide-y divide-slate-100";

  listTable.appendChild(listThead);
  listTable.appendChild(listTbody);
  listScroll.appendChild(listTable);
  listCard.appendChild(listBanner);
  listCard.appendChild(listScroll);
  listView.appendChild(listCard);
  root.appendChild(listView);

  const auditView = document.createElement("div");
  auditView.id = "adminBookingAuditView";
  auditView.className = "hidden animate-fade-up";

  const auditCard = document.createElement("div");
  auditCard.className = "bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-sm";

  const auditHeader = document.createElement("div");
  auditHeader.className =
    "p-5 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4";

  const auditTitleBox = document.createElement("div");
  auditTitleBox.className = "flex items-center gap-3";
  auditTitleBox.appendChild(createIcon("fas fa-history text-slate-400 text-xl"));
  const auditTitleText = document.createElement("div");
  const auditH3 = document.createElement("h3");
  auditH3.className = "font-bold text-slate-800 uppercase tracking-widest text-xs";
  auditH3.textContent = "Sejarah Penuh Tempahan";
  const auditSub = document.createElement("p");
  auditSub.className = "text-[10px] text-slate-500";
  auditSub.textContent = "Log rekod aktif, lepas, dan tarikh dikunci.";
  auditTitleText.appendChild(auditH3);
  auditTitleText.appendChild(auditSub);
  auditTitleBox.appendChild(auditTitleText);

  const auditControls = document.createElement("div");
  auditControls.className = "flex flex-col sm:flex-row gap-2 w-full md:w-auto";

  const searchWrap = document.createElement("div");
  searchWrap.className = "relative w-full sm:w-56";
  const searchIcon = createIcon(
    "fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
  );
  const auditSearchInput = document.createElement("input");
  auditSearchInput.type = "text";
  auditSearchInput.id = "auditSearchInput";
  auditSearchInput.className =
    "w-full min-h-[44px] pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-brand-500 outline-none";
  auditSearchInput.placeholder = "Cari Sekolah/ID/Fokus...";
  auditSearchInput.addEventListener("input", () => {
    window.filterAudit();
  });
  searchWrap.appendChild(searchIcon);
  searchWrap.appendChild(auditSearchInput);

  const auditDaerahWrap = document.createElement("div");
  auditDaerahWrap.id = "auditDaerahFilterWrapper";
  auditDaerahWrap.className = "hidden w-full sm:w-40";
  const auditDaerahSelect = document.createElement("select");
  auditDaerahSelect.id = "auditDaerahFilter";
  auditDaerahSelect.className =
    "w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:border-brand-500 outline-none";
  const defaultAuditOpt = document.createElement("option");
  defaultAuditOpt.value = "ALL";
  defaultAuditOpt.textContent = "SEMUA DAERAH";
  auditDaerahSelect.appendChild(defaultAuditOpt);
  auditDaerahSelect.addEventListener("change", () => {
    window.filterAudit();
  });
  auditDaerahWrap.appendChild(auditDaerahSelect);

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className =
    "min-h-[44px] px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition flex items-center justify-center gap-2 shadow-sm whitespace-nowrap";
  exportBtn.appendChild(createIcon("fas fa-download"));
  exportBtn.appendChild(document.createTextNode(" Eksport"));
  exportBtn.addEventListener("click", () => {
    window.eksportAuditCSV();
  });

  const refreshAuditBtn = document.createElement("button");
  refreshAuditBtn.type = "button";
  refreshAuditBtn.className =
    "min-w-[44px] min-h-[44px] px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:text-brand-600 transition flex items-center justify-center shadow-sm";
  refreshAuditBtn.title = "Refresh Data";
  refreshAuditBtn.appendChild(createIcon("fas fa-sync-alt"));
  refreshAuditBtn.addEventListener("click", () => {
    window.loadAdminBookingAudit();
  });

  auditControls.appendChild(searchWrap);
  auditControls.appendChild(auditDaerahWrap);
  auditControls.appendChild(exportBtn);
  auditControls.appendChild(refreshAuditBtn);

  auditHeader.appendChild(auditTitleBox);
  auditHeader.appendChild(auditControls);

  const auditScroll = document.createElement("div");
  auditScroll.className = "overflow-x-auto max-h-[600px] custom-scrollbar";

  const auditTable = document.createElement("table");
  auditTable.className = "w-full text-sm text-left";

  const auditThead = document.createElement("thead");
  auditThead.className =
    "bg-slate-100 text-[10px] font-black text-slate-500 uppercase border-b-2 border-slate-200 sticky top-0 z-10";
  const auditHeadTr = document.createElement("tr");

  [
    { text: "BIL", cls: "px-6 py-4 w-12 text-center" },
    { text: "TARIKH/MASA", cls: "px-6 py-4" },
    { text: "SEKOLAH / SKOP KUNCI", cls: "px-6 py-4" },
    { text: "FOKUS BIMBINGAN / CATATAN", cls: "px-6 py-4" },
    { text: "PEGAWAI PIC", cls: "px-6 py-4" },
    { text: "STATUS", cls: "px-6 py-4 text-center" }
  ].forEach((col) => {
    const th = document.createElement("th");
    th.className = col.cls;
    th.textContent = col.text;
    auditHeadTr.appendChild(th);
  });
  auditThead.appendChild(auditHeadTr);

  const auditTbody = document.createElement("tbody");
  auditTbody.id = "auditTableBody";
  auditTbody.className = "divide-y divide-slate-100";

  const initAuditTr = document.createElement("tr");
  const initAuditTd = document.createElement("td");
  initAuditTd.colSpan = 6;
  initAuditTd.className = "p-8 text-center text-slate-400 italic";
  initAuditTd.textContent = "Menyemak Pangkalan Data...";
  initAuditTr.appendChild(initAuditTd);
  auditTbody.appendChild(initAuditTr);

  auditTable.appendChild(auditThead);
  auditTable.appendChild(auditTbody);
  auditScroll.appendChild(auditTable);

  auditCard.appendChild(auditHeader);
  auditCard.appendChild(auditScroll);
  auditView.appendChild(auditCard);
  root.appendChild(auditView);

  return root;
}

window.initAdminBooking = async function () {
  const wrapper = document.getElementById("tab-tempahan");
  if (!wrapper) {
    return;
  }

  if (!document.getElementById("bookingAdminContent")) {
    clearElement(wrapper);
    wrapper.appendChild(buildBookingAdminLayout());
  }

  populateAdminBookingDaerah();
  const tahunSemasaEl = document.getElementById("kpiTahunSemasa");
  if (tahunSemasaEl) {
    tahunSemasaEl.textContent = String(new Date().getFullYear());
  }

  await envReady;
  await initDatabaseClient();

  await Promise.all([
    window.renderAdminBookingCalendar(),
    window.loadAdminBookingList(),
    window.renderAdminBookingDashboard()
  ]);

  ensureRealtimeSync();
};

function populateAdminBookingDaerah() {
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const wrapper = document.getElementById("adminBookingFilterDaerahWrapper");
  const select = document.getElementById("adminBookingFilterDaerah");
  const auditWrapper = document.getElementById("auditDaerahFilterWrapper");
  const auditSelect = document.getElementById("auditDaerahFilter");

  if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
    if (wrapper) {
      wrapper.classList.remove("hidden");
    }
    if (auditWrapper) {
      auditWrapper.classList.remove("hidden");
    }

    const populateOptions = (targetSelect, currentVal) => {
      if (!targetSelect) {
        return;
      }
      clearElement(targetSelect);
      const fragment = document.createDocumentFragment();
      const allOpt = document.createElement("option");
      allOpt.value = "ALL";
      allOpt.textContent = "SEMUA DAERAH";
      fragment.appendChild(allOpt);

      if (APP_CONFIG.PPD_MAPPING) {
        Object.entries(APP_CONFIG.PPD_MAPPING).forEach(([kod, nama]) => {
          const opt = document.createElement("option");
          opt.value = kod;
          opt.textContent = nama;
          fragment.appendChild(opt);
        });
      }
      targetSelect.appendChild(fragment);
      targetSelect.value = currentVal;
    };

    populateOptions(select, adminDaerahFilter);
    populateOptions(auditSelect, auditDaerahFilter);
  } else {
    if (wrapper) {
      wrapper.classList.add("hidden");
    }
    if (auditWrapper) {
      auditWrapper.classList.add("hidden");
    }
  }
}

window.setAdminBookingDaerah = function (daerahValue) {
  adminDaerahFilter = daerahValue;
  const auditSelect = document.getElementById("auditDaerahFilter");
  if (auditSelect && auditSelect.value !== daerahValue) {
    auditSelect.value = daerahValue;
    auditDaerahFilter = daerahValue;
    const viewAudit = document.getElementById("adminBookingAuditView");
    if (viewAudit && !viewAudit.classList.contains("hidden")) {
      window.filterAudit();
    }
  }
  adminSelectedDates = [];
  updateMultiLockUI();
  window.renderAdminBookingCalendar();
  window.renderAdminBookingDashboard();
};

window.renderAdminBookingDashboard = async function () {
  try {
    await envReady;
    await initDatabaseClient();

    const [locks, bookings] = await Promise.all([
      BookingService.getAllLocks(),
      BookingService.getAllActiveBookings()
    ]);

    const currentYearString = String(new Date().getFullYear());
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "M030";

    const viewTarget = ["SUPER_ADMIN", "JPNMEL"].includes(userRole)
      ? adminDaerahFilter
      : userKod;
    const currentYearBookings = (bookings || []).filter(
      (b) => b.tarikh && b.tarikh.startsWith(currentYearString)
    );

    let relevantBookings = currentYearBookings;

    if (viewTarget !== "ALL" && Array.isArray(window.globalDashboardData)) {
      const targetDaerahName =
        (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[viewTarget]) || viewTarget;
      const validSchoolCodesForDaerah = window.globalDashboardData
        .filter(
          (s) =>
            (s.daerah && s.daerah.toUpperCase() === targetDaerahName.toUpperCase()) ||
            s.kod_sekolah === viewTarget
        )
        .map((s) => s.kod_sekolah);
      relevantBookings = currentYearBookings.filter((b) =>
        validSchoolCodesForDaerah.includes(b.kod_sekolah)
      );
    }

    const uniqueSchools = new Set(relevantBookings.map((b) => b.kod_sekolah));
    const kpiSekolahEl = document.getElementById("kpiSekolahMemohon");
    if (kpiSekolahEl) {
      kpiSekolahEl.textContent = String(uniqueSchools.size);
    }

    let countKunciNegeri = 0;
    let countKunciDaerah = 0;
    const uniqueDaysLocked = new Set();

    const currentYearLocks = (locks || []).filter(
      (l) => l.tarikh && l.tarikh.startsWith(currentYearString)
    );

    currentYearLocks.forEach((lock) => {
      const dateOnly = lock.tarikh.split("T")[0];
      const scopes = lock.kod_ppd ? lock.kod_ppd.split(",") : [];
      let isRelevantToView = false;
      let isStatewide = false;

      for (let i = 0; i < scopes.length; i += 1) {
        const scope = scopes[i];
        const sCode = scope.includes(":") ? scope.split(":")[0] : scope;
        if (sCode === "ALL") {
          isStatewide = true;
          isRelevantToView = true;
        } else if (viewTarget === "ALL" || sCode === viewTarget) {
          isRelevantToView = true;
        }
      }

      if (isRelevantToView) {
        uniqueDaysLocked.add(dateOnly);
        if (isStatewide) {
          countKunciNegeri += 1;
        } else {
          countKunciDaerah += 1;
        }
      }
    });

    const kpiKunciNegeriEl = document.getElementById("kpiKunciNegeri");
    const kpiKunciDaerahEl = document.getElementById("kpiKunciDaerah");
    const kpiJumlahHariEl = document.getElementById("kpiJumlahHariKunci");

    if (kpiKunciNegeriEl) {
      kpiKunciNegeriEl.textContent = String(countKunciNegeri);
    }
    if (kpiKunciDaerahEl) {
      kpiKunciDaerahEl.textContent = String(countKunciDaerah);
    }
    if (kpiJumlahHariEl) {
      kpiJumlahHariEl.textContent = String(uniqueDaysLocked.size);
    }
  } catch {}
};

window.switchAdminBookingView = function (view) {
  const btnCal = document.getElementById("btnViewCal");
  const btnList = document.getElementById("btnViewList");
  const btnAudit = document.getElementById("btnViewAudit");

  const viewCal = document.getElementById("adminBookingCalendarView");
  const viewList = document.getElementById("adminBookingListView");
  const viewAudit = document.getElementById("adminBookingAuditView");

  if (!btnCal || !btnList || !btnAudit || !viewCal || !viewList || !viewAudit) {
    return;
  }

  [btnCal, btnList, btnAudit].forEach((btn) => {
    btn.className =
      "min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-brand-600 border-2 border-transparent transition-all";
  });

  [viewCal, viewList, viewAudit].forEach((v) => v.classList.add("hidden"));

  const activeCls =
    "min-h-[44px] px-5 py-2 rounded-xl text-xs font-black bg-white text-brand-600 shadow-md border-2 border-slate-100 transition-all transform scale-105";

  if (view === "calendar") {
    btnCal.className = activeCls;
    viewCal.classList.remove("hidden");
  } else if (view === "list") {
    btnList.className = activeCls;
    viewList.classList.remove("hidden");
    window.loadAdminBookingList();
  } else if (view === "audit") {
    btnAudit.className = activeCls;
    viewAudit.classList.remove("hidden");
    window.loadAdminBookingAudit();
  }
};

window.switchAdminWeek = function (weekNum) {
  adminActiveWeek = weekNum;
  window.renderAdminBookingCalendar();
};

function checkIsAllowedDayAdmin(dateObj) {
  const dayOfWeek = dateObj.getDay();
  const dayOfMonth = dateObj.getDate();

  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || "";
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "";

  let targetDaerahKod = userKod;
  if (["SUPER_ADMIN", "JPNMEL"].includes(userRole) && adminDaerahFilter !== "ALL") {
    targetDaerahKod = adminDaerahFilter;
  }

  if (["SUPER_ADMIN", "JPNMEL"].includes(userRole) && adminDaerahFilter === "ALL") {
    if ([1, 2, 3, 4].includes(dayOfWeek)) {
      return true;
    }
    if (dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21) {
      return true;
    }
    return false;
  }

  const isJasin = targetDaerahKod === "M010";
  const isMelakaTengah = targetDaerahKod === "M020";
  const isAlorGajah = targetDaerahKod === "M030" || (!isJasin && !isMelakaTengah);

  if ([2, 3, 4].includes(dayOfWeek)) {
    return true;
  }
  if (isJasin) {
    return false;
  }
  if (isMelakaTengah && dayOfWeek === 1) {
    return true;
  }
  if (isAlorGajah && dayOfWeek === 6 && dayOfMonth >= 15 && dayOfMonth <= 21) {
    return true;
  }
  return false;
}

function updateMultiLockUI() {
  const btnMultiLock = document.getElementById("btnMultiLock");
  const countSpan = document.getElementById("multiLockCount");
  if (!btnMultiLock || !countSpan) {
    return;
  }

  if (adminSelectedDates.length > 0) {
    btnMultiLock.classList.remove("hidden");
    btnMultiLock.classList.add("flex");
    countSpan.textContent = String(adminSelectedDates.length);
  } else {
    btnMultiLock.classList.add("hidden");
    btnMultiLock.classList.remove("flex");
  }
}

window.renderAdminBookingCalendar = async function () {
  const grid = document.getElementById("adminCalendarGrid");
  const label = document.getElementById("adminMonthLabel");
  const tabsContainer = document.getElementById("adminWeekTabsContainer");

  if (!grid || !label || !tabsContainer) {
    return;
  }

  clearElement(grid);
  const loadingBox = document.createElement("div");
  loadingBox.className = "col-span-full py-20 text-center flex flex-col items-center justify-center";
  loadingBox.appendChild(createIcon("fas fa-circle-notch fa-spin text-slate-300 text-3xl mb-4"));
  const loadingP = document.createElement("p");
  loadingP.className =
    "text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse";
  loadingP.textContent = "Menjana Kalendar...";
  loadingBox.appendChild(loadingP);
  grid.appendChild(loadingBox);

  label.textContent = `${MALAY_MONTHS[adminCurrentMonth]} ${adminCurrentYear}`;

  try {
    await envReady;
    await initDatabaseClient();

    const weeks = getWeeksInMonth(adminCurrentYear, adminCurrentMonth);
    const pad = (n) => String(n).padStart(2, "0");
    const monthPrefix = `${adminCurrentYear}-${pad(adminCurrentMonth + 1)}`;

    const [{ bookedSlots }, allLocks] = await Promise.all([
      BookingService.getMonthlyData(adminCurrentYear, adminCurrentMonth, adminDaerahFilter),
      BookingService.getAllLocks()
    ]);

    const activeMonthLocks = (allLocks || []).filter(
      (l) => l.tarikh && l.tarikh.startsWith(monthPrefix)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalWeeks = weeks.length;
    if (adminActiveWeek > totalWeeks) {
      adminActiveWeek = 1;
    }

    clearElement(tabsContainer);
    const tabsFragment = document.createDocumentFragment();
    for (let w = 1; w <= totalWeeks; w += 1) {
      const isActive = adminActiveWeek === w;
      const activeClass = isActive ? "week-tab-admin-active" : "week-tab-admin-inactive";
      const weekBtn = document.createElement("button");
      weekBtn.type = "button";
      weekBtn.className = `week-tab-admin min-h-[40px] ${activeClass}`;
      weekBtn.textContent = `MINGGU ${w}`;
      const targetWeek = w;
      weekBtn.addEventListener("click", () => {
        window.switchAdminWeek(targetWeek);
      });
      tabsFragment.appendChild(weekBtn);
    }
    tabsContainer.appendChild(tabsFragment);

    const currentWeekDays = weeks[adminActiveWeek - 1] || [];
    const cardsFragment = document.createDocumentFragment();
    let hasContent = false;

    for (let i = 0; i < currentWeekDays.length; i += 1) {
      const d = currentWeekDays[i];
      const dateString = `${monthPrefix}-${pad(d)}`;
      const dateObj = new Date(adminCurrentYear, adminCurrentMonth, d);
      dateObj.setHours(0, 0, 0, 0);

      const dayOfWeek = dateObj.getDay();
      const isAllowedDay = checkIsAllowedDayAdmin(dateObj);

      const lockObj = activeMonthLocks.find((l) => l.tarikh.split("T")[0] === dateString);
      const isLockedGlobal = Boolean(lockObj);
      const lockedSlots = [];

      if (isLockedGlobal) {
        const scopes = lockObj.kod_ppd ? lockObj.kod_ppd.split(",") : [];
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "M030";
        const viewTarget = ["SUPER_ADMIN", "JPNMEL"].includes(userRole)
          ? adminDaerahFilter
          : userKod;

        scopes.forEach((scope) => {
          let scopeCode = scope;
          let scopeSlot = "1 HARI";
          if (scope.includes(":")) {
            const parts = scope.split(":");
            scopeCode = parts[0];
            scopeSlot = parts[1];
          }

          if (
            scopeCode === "ALL" ||
            (viewTarget !== "ALL" && scopeCode === viewTarget) ||
            viewTarget === "ALL"
          ) {
            if (scopeSlot === "ALL" || scopeSlot === "1 HARI") {
              lockedSlots.push("Pagi", "Petang", "1 HARI");
            } else if (scopeSlot === "PAGI") {
              lockedSlots.push("Pagi");
            } else if (scopeSlot === "PETANG") {
              lockedSlots.push("Petang");
            }
          }
        });
      }

      const slotsTaken = bookedSlots[dateString] || [];
      const combinedSlots = [...new Set([...slotsTaken, ...lockedSlots])];

      const isPast = dateObj < today;
      let status = "open";
      let statusText = "KOSONG";
      let statusIcon = "fa-check-circle";

      const maxCapacity = dayOfWeek === 6 ? 1 : 2;
      const isFullDayTaken =
        combinedSlots.includes("1 HARI") ||
        (combinedSlots.includes("Pagi") && combinedSlots.includes("Petang"));

      let filledCount = combinedSlots.length;
      if (isFullDayTaken) {
        filledCount = 2;
      }

      const isFullyLocked =
        lockedSlots.includes("1 HARI") ||
        (lockedSlots.includes("Pagi") && lockedSlots.includes("Petang"));

      if (!isAllowedDay) {
        status = "closed";
        statusText = "TIADA SESI";
        statusIcon = "fa-ban";
      } else if (isPast) {
        status = "closed";
        statusText = "LEPAS";
        statusIcon = "fa-history";
      } else if (isFullyLocked) {
        status = "locked";
        statusText = "DIKUNCI";
        statusIcon = "fa-lock";
      } else if (filledCount >= maxCapacity) {
        status = "full";
        statusText = "PENUH";
        statusIcon = "fa-users-slash";
      } else if (filledCount > 0) {
        if (lockedSlots.length > 0) {
          status = "locked";
          statusText = "KUNCI SEPARA";
          statusIcon = "fa-lock";
        } else {
          status = "partial";
          statusText = "1 SLOT BAKI";
          statusIcon = "fa-exclamation-circle";
        }
      }

      let iconColor = "text-brand-600 bg-brand-100";
      if (status === "full") {
        iconColor = "text-red-600 bg-red-100";
      }
      if (status === "locked") {
        iconColor = "text-purple-600 bg-purple-100";
      }
      if (status === "partial") {
        iconColor = "text-amber-600 bg-amber-100";
      }
      if (status === "closed") {
        iconColor = "text-slate-400 bg-slate-200";
      }

      const isSelected = adminSelectedDates.includes(dateString);
      const card = document.createElement("div");
      card.className = `day-card card-${status} ${
        isSelected ? "card-active ring-4 ring-purple-500 transform scale-105" : ""
      } transition-all duration-200`;

      const topRow = document.createElement("div");
      topRow.className = "flex justify-between items-start";

      const dayInfo = document.createElement("div");
      const dayNameSpan = document.createElement("span");
      dayNameSpan.className =
        "text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1";
      dayNameSpan.textContent = DAY_NAMES[dayOfWeek];

      const dayNumSpan = document.createElement("span");
      dayNumSpan.className = "text-3xl font-black text-slate-800 leading-none";
      dayNumSpan.textContent = String(d);

      dayInfo.appendChild(dayNameSpan);
      dayInfo.appendChild(dayNumSpan);

      const iconCircle = document.createElement("div");
      iconCircle.className = `${iconColor} w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-sm shadow-sm transition-transform group-hover:rotate-12`;
      iconCircle.appendChild(createIcon(`fas ${statusIcon}`));

      topRow.appendChild(dayInfo);
      topRow.appendChild(iconCircle);

      const bottomArea = document.createElement("div");
      bottomArea.className = "mt-auto pt-4";

      const statusPill = document.createElement("span");
      statusPill.className = `inline-block px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${iconColor} border border-black/5`;
      statusPill.textContent = statusText;
      bottomArea.appendChild(statusPill);

      if (isLockedGlobal) {
        const existingScopes = (lockObj.kod_ppd || "ALL").split(",");
        const isAll = existingScopes.some((s) => s.startsWith("ALL"));
        const districtCodesOnly = existingScopes
          .map((s) => s.split(":")[0])
          .filter((v, idx, a) => a.indexOf(v) === idx && v !== "ALL");

        const scopeLabel = isAll
          ? "KUNCI NEGERI"
          : `KUNCI DAERAH (${districtCodesOnly.join(", ")})`;
        const scopeClass = isAll
          ? "bg-fuchsia-600 text-white border-fuchsia-700"
          : "bg-purple-200 text-purple-800 border-purple-300";
        const displayNote = lockObj.komen || "TIADA CATATAN";

        const lockDetailBox = document.createElement("div");
        lockDetailBox.className = "mt-1.5 flex flex-col gap-1";

        const scopeBadge = document.createElement("span");
        scopeBadge.className = `${scopeClass} px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest w-fit border shadow-sm`;
        scopeBadge.textContent = scopeLabel;

        const noteBox = document.createElement("div");
        noteBox.className =
          "text-[9px] text-purple-700 font-bold uppercase wrap-safe break-words leading-tight bg-purple-50 p-1.5 rounded border border-purple-200";
        noteBox.textContent = displayNote;

        lockDetailBox.appendChild(scopeBadge);
        lockDetailBox.appendChild(noteBox);
        bottomArea.appendChild(lockDetailBox);
      }

      card.appendChild(topRow);
      card.appendChild(bottomArea);

      if (!isPast && (isAllowedDay || isLockedGlobal)) {
        card.addEventListener("click", () => {
          if (adminSelectedDates.includes(dateString)) {
            adminSelectedDates = adminSelectedDates.filter((ds) => ds !== dateString);
          } else {
            adminSelectedDates.push(dateString);
          }
          updateMultiLockUI();
          window.renderAdminBookingCalendar();
        });
      }

      cardsFragment.appendChild(card);
      hasContent = true;
    }

    clearElement(grid);
    if (!hasContent) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className =
        "col-span-full py-10 text-center text-slate-400 text-sm font-medium italic";
      emptyDiv.textContent = "Tiada tarikh aktif dalam minggu ini.";
      grid.appendChild(emptyDiv);
    } else {
      grid.appendChild(cardsFragment);
    }
  } catch {
    clearElement(grid);
    const errDiv = document.createElement("div");
    errDiv.className =
      "col-span-full py-20 text-center text-red-500 font-bold bg-red-50 rounded-2xl border-2 border-red-100";
    errDiv.textContent = "Ralat pangkalan data kalendar.";
    grid.appendChild(errDiv);
  }
};

window.handleMultiDateAction = function () {
  if (adminSelectedDates.length === 0) {
    return;
  }
  window.handleAdminDateAction(adminSelectedDates, false, false, "", ["ALL"]);
};

window.handleAdminDateAction = async function (
  isoArray,
  currentlyLocked,
  hasBookings,
  currentNote = "",
  existingScopesParam = "ALL"
) {
  if (dateActionBusy) {
    return;
  }

  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "M030";

  const datesToProcess = Array.isArray(isoArray) ? isoArray : [isoArray];
  const displayDatesText =
    datesToProcess.length > 1 ? `${datesToProcess.length} Tarikh Dipilih` : datesToProcess[0];

  if (!currentlyLocked && hasBookings && datesToProcess.length === 1) {
    const warnContainer = document.createElement("div");
    warnContainer.className = "text-center";
    const p1 = document.createElement("p");
    p1.className = "text-sm font-bold text-red-600 mb-2";
    p1.textContent = "Terdapat tempahan yang telah dibuat oleh sekolah pada tarikh ini.";
    const p2 = document.createElement("p");
    p2.className = "text-xs text-slate-500";
    p2.textContent =
      "Anda masih boleh mengunci baki slot kosong, tetapi anda tidak boleh membatalkan slot yang telah ditempah tanpa memaklumkan pihak sekolah.";
    warnContainer.appendChild(p1);
    warnContainer.appendChild(p2);

    await showAlert({
      icon: "warning",
      title: "Tempahan Aktif Wujud",
      html: warnContainer,
      confirmButtonColor: "#f59e0b",
      customClass: { popup: "rounded-3xl" }
    });
  }

  const existingScopeArray = Array.isArray(existingScopesParam)
    ? existingScopesParam
    : typeof existingScopesParam === "string"
      ? existingScopesParam.split(",")
      : ["ALL"];

  const parsedScopes = existingScopeArray.map((s) => {
    if (s.includes(":")) {
      const p = s.split(":");
      return { kod: p[0], slot: p[1] };
    }
    return { kod: s, slot: "ALL" };
  });

  if (typeof window === "undefined" || !window.Swal) {
    return;
  }

  const modalContent = document.createElement("div");

  const headerDateBox = document.createElement("div");
  headerDateBox.className = "text-center mb-4";
  const dateSpan = document.createElement("span");
  dateSpan.className = "text-xl md:text-2xl font-black text-purple-600 px-4";
  dateSpan.textContent = displayDatesText;
  headerDateBox.appendChild(dateSpan);

  if (datesToProcess.length > 1) {
    const subDatesSpan = document.createElement("span");
    subDatesSpan.className = "text-[10px] text-slate-400 font-bold mt-1 block";
    subDatesSpan.textContent = datesToProcess.join(", ");
    headerDateBox.appendChild(subDatesSpan);
  }
  modalContent.appendChild(headerDateBox);

  const instrP = document.createElement("p");
  instrP.className = "text-sm text-slate-500 mb-4 px-4 font-medium";
  instrP.textContent = "Nyatakan sebab atau catatan rasmi di bawah.";
  modalContent.appendChild(instrP);

  const noteWrap = document.createElement("div");
  noteWrap.className = "px-4";
  const noteInput = document.createElement("input");
  noteInput.id = "swal-note";
  noteInput.type = "text";
  noteInput.className =
    "w-full min-h-[44px] p-3 rounded-xl border-2 border-slate-200 font-bold uppercase text-sm outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 text-slate-800 transition";
  noteInput.placeholder = "Contoh: CUTI UMUM / BENGKEL...";
  noteInput.value = currentNote || "";
  noteWrap.appendChild(noteInput);
  modalContent.appendChild(noteWrap);

  const slotWrap = document.createElement("div");
  slotWrap.className = "mt-4 text-left px-4";
  const slotLabel = document.createElement("label");
  slotLabel.className =
    "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2";
  slotLabel.setAttribute("for", "swal-slot-selection");
  slotLabel.appendChild(createIcon("fas fa-clock text-amber-500 mr-1"));
  slotLabel.appendChild(document.createTextNode(" Slot Masa Yang Ingin Dikunci"));

  const slotSelect = document.createElement("select");
  slotSelect.id = "swal-slot-selection";
  slotSelect.className =
    "w-full min-h-[44px] p-2.5 rounded-xl border-2 border-slate-200 text-xs font-bold outline-none focus:border-purple-500 bg-white shadow-sm";

  [
    { val: "ALL", txt: "KUNCI SEPENUH HARI (1 HARI)" },
    { val: "PAGI", txt: "KUNCI SLOT PAGI SAHAJA" },
    { val: "PETANG", txt: "KUNCI SLOT PETANG SAHAJA" }
  ].forEach((optItem) => {
    const opt = document.createElement("option");
    opt.value = optItem.val;
    opt.textContent = optItem.txt;
    slotSelect.appendChild(opt);
  });

  if (currentlyLocked && parsedScopes.length > 0) {
    slotSelect.value = parsedScopes[0].slot;
  }

  slotWrap.appendChild(slotLabel);
  slotWrap.appendChild(slotSelect);
  modalContent.appendChild(slotWrap);

  if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
    const hasAllDistrict = parsedScopes.some((s) => s.kod === "ALL");

    const scopeWrap = document.createElement("div");
    scopeWrap.className = "mt-4 text-left px-4";

    const scopeLabel = document.createElement("label");
    scopeLabel.className =
      "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2";
    scopeLabel.appendChild(createIcon("fas fa-map-marker-alt text-purple-400 mr-1"));
    scopeLabel.appendChild(
      document.createTextNode(" Skop Kunci Tarikh (Pilih 1 Atau Lebih)")
    );

    const listBox = document.createElement("div");
    listBox.className =
      "max-h-48 overflow-y-auto custom-scrollbar bg-white rounded-xl border-2 border-slate-200 shadow-inner";

    const allLabel = document.createElement("label");
    allLabel.className =
      "flex items-center gap-3 p-3 border-b border-slate-100 bg-white cursor-pointer hover:bg-purple-50 transition rounded-t-xl";
    const allCb = document.createElement("input");
    allCb.type = "checkbox";
    allCb.className = "swal-scope-cb w-5 h-5 accent-purple-600 cursor-pointer";
    allCb.value = "ALL";
    allCb.checked = hasAllDistrict;

    const allText = document.createElement("span");
    allText.className = "text-xs font-black text-slate-700 tracking-wider";
    allText.textContent = "SEMUA DAERAH (NEGERI MELAKA)";

    allLabel.appendChild(allCb);
    allLabel.appendChild(allText);
    listBox.appendChild(allLabel);

    const districtCheckboxes = [];
    if (APP_CONFIG.PPD_MAPPING) {
      Object.entries(APP_CONFIG.PPD_MAPPING).forEach(([k, v]) => {
        const dLabel = document.createElement("label");
        dLabel.className =
          "flex items-center gap-3 p-3 border-b border-slate-100 bg-white cursor-pointer hover:bg-slate-50 transition last:border-b-0 last:rounded-b-xl";
        const dCb = document.createElement("input");
        dCb.type = "checkbox";
        dCb.className = "swal-scope-cb w-5 h-5 accent-purple-600 cursor-pointer";
        dCb.value = k;
        dCb.checked = parsedScopes.some((s) => s.kod === k) && !hasAllDistrict;

        dCb.addEventListener("change", () => {
          if (dCb.checked) {
            allCb.checked = false;
          }
        });

        const dText = document.createElement("span");
        dText.className = "text-xs font-bold text-slate-700";
        dText.textContent = `${v} (${k})`;

        dLabel.appendChild(dCb);
        dLabel.appendChild(dText);
        listBox.appendChild(dLabel);
        districtCheckboxes.push(dCb);
      });
    }

    allCb.addEventListener("change", () => {
      if (allCb.checked) {
        districtCheckboxes.forEach((cb) => {
          cb.checked = false;
        });
      }
    });

    scopeWrap.appendChild(scopeLabel);
    scopeWrap.appendChild(listBox);
    modalContent.appendChild(scopeWrap);
  }

  const getSelectedScopes = () => {
    let codes = [userKod];
    if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
      const cbs = modalContent.querySelectorAll(".swal-scope-cb:checked");
      const vals = Array.from(cbs).map((cb) => cb.value);
      codes = vals.includes("ALL") ? ["ALL"] : vals;
    }
    const selectedSlot = slotSelect.value || "ALL";
    return codes.map((c) => `${c}:${selectedSlot}`);
  };

  const titleText =
    currentlyLocked && datesToProcess.length === 1
      ? "Pengurusan Kunci Tarikh"
      : "Kunci Tarikh Ini?";
  const confirmText =
    currentlyLocked && datesToProcess.length === 1
      ? "KEMASKINI CATATAN / KAWASAN"
      : "KUNCI SEKARANG";

  let capturedScopes = [];

  const result = await window.Swal.fire({
    title: titleText,
    html: modalContent,
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonColor: "#7c3aed",
    denyButtonColor: "#10b981",
    cancelButtonColor: "#64748b",
    confirmButtonText: confirmText,
    denyButtonText: "BUKA KUNCI TERPILIH",
    cancelButtonText: "BATAL",
    customClass: {
      popup: "rounded-3xl border-2 border-slate-100",
      confirmButton: "font-bold tracking-wider",
      denyButton: "font-bold tracking-wider",
      cancelButton: "font-bold tracking-wider"
    },
    preDeny: () => {
      capturedScopes = getSelectedScopes();
      if (capturedScopes.length === 0) {
        capturedScopes = existingScopeArray;
      }
      return true;
    },
    preConfirm: () => {
      const note = noteInput.value.trim().toUpperCase();
      if (!note) {
        window.Swal.showValidationMessage("Sebab atau catatan wajib diisi.");
        return false;
      }
      const targetScopes = getSelectedScopes();
      if (targetScopes.length === 0) {
        window.Swal.showValidationMessage(
          "Sila pilih sekurang-kurangnya satu daerah untuk dikunci."
        );
        return false;
      }
      return { note, targetScopes };
    }
  });

  if (result.isDenied) {
    const confirmUnlock = await showAlert({
      title: "Buka Kunci Tarikh?",
      text: "Kunci bagi tarikh-tarikh yang dipilih akan dibuka semula untuk tempahan sekolah.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Buka Akses",
      cancelButtonText: "Batal",
      customClass: { popup: "rounded-3xl" }
    });

    if (confirmUnlock && confirmUnlock.isConfirmed) {
      dateActionBusy = true;
      toggleLoading(true);
      try {
        await envReady;
        await initDatabaseClient();
        const promises = datesToProcess.map((iso) =>
          BookingService.manageDateLock("UNLOCK", iso, "", capturedScopes)
        );
        await Promise.all(promises);

        toggleLoading(false);
        adminSelectedDates = [];
        updateMultiLockUI();

        await silentRefreshAllBookingViews();
        showAlert({ icon: "success", title: "Dibuka", timer: 1000, showConfirmButton: false });
      } catch {
        toggleLoading(false);
        showAlert({ icon: "error", title: "Ralat", text: "Gagal membuka kunci tarikh." });
      } finally {
        dateActionBusy = false;
      }
    } else {
      window.renderAdminBookingCalendar();
    }
  } else if (result.isConfirmed && result.value) {
    const { note, targetScopes } = result.value;
    const action = currentlyLocked && datesToProcess.length === 1 ? "UPDATE" : "LOCK";

    dateActionBusy = true;
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      const promises = datesToProcess.map((iso) =>
        BookingService.manageDateLock(action, iso, note, targetScopes)
      );
      await Promise.all(promises);

      toggleLoading(false);
      adminSelectedDates = [];
      updateMultiLockUI();

      await silentRefreshAllBookingViews();
      showAlert({
        icon: "success",
        title: "Selesai!",
        text: `Berjaya mengemaskini ${datesToProcess.length} tarikh.`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat",
        text: err && err.message ? err.message : "Gagal memproses kunci tarikh."
      });
    } finally {
      dateActionBusy = false;
    }
  } else {
    window.renderAdminBookingCalendar();
  }
};

window.loadAdminBookingList = async function () {
  const tbody = document.getElementById("adminBookingTableBody");
  if (!tbody) {
    return;
  }

  try {
    await envReady;
    await initDatabaseClient();

    let [bookings, locks] = await Promise.all([
      BookingService.getAllActiveBookings(),
      BookingService.getAllLocks()
    ]);

    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

    if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
      const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
      if (userKod) {
        validSchoolCodes.push(userKod);
      }
      bookings = (bookings || []).filter((b) => validSchoolCodes.includes(b.kod_sekolah));
    } else {
      bookings = bookings || [];
    }

    const processedLocks = (locks || []).map((l) => ({
      ...l,
      kod_ppd: l.kod_ppd ? l.kod_ppd.split(",") : ["ALL:ALL"],
      type: "LOCK"
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const masterList = [
      ...bookings.map((b) => ({ ...b, type: "BOOKING" })),
      ...processedLocks
    ]
      .filter((item) => {
        const itemDate = new Date(item.tarikh);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate >= today;
      })
      .sort((a, b) => new Date(a.tarikh) - new Date(b.tarikh));

    clearElement(tbody);

    if (masterList.length === 0) {
      const emptyTr = document.createElement("tr");
      const emptyTd = document.createElement("td");
      emptyTd.colSpan = 4;
      emptyTd.className =
        "p-24 text-center text-slate-400 font-medium italic bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200";
      emptyTd.textContent =
        "Tiada permohonan tempahan atau tarikh dikunci bermula hari ini.";
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
      return;
    }

    const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
    const displayList = masterList.slice(0, limit);
    const fragment = document.createDocumentFragment();

    displayList.forEach((item) => {
      const dateStr = new Date(item.tarikh).toLocaleDateString("ms-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

      if (item.type === "BOOKING") {
        let masaClass = "bg-purple-100 text-purple-700 border border-purple-200";
        if (item.masa === "Pagi") {
          masaClass = "bg-blue-100 text-blue-700 border border-blue-200";
        } else if (item.masa === "Petang") {
          masaClass = "bg-orange-100 text-orange-700 border border-orange-200";
        }

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50/80 transition-all group";

        const tdDate = document.createElement("td");
        tdDate.className = "px-8 py-6 align-top";
        const dateDiv = document.createElement("div");
        dateDiv.className = "font-black text-slate-800 text-sm tracking-tight uppercase";
        dateDiv.textContent = dateStr;

        const metaRow = document.createElement("div");
        metaRow.className = "flex items-center gap-2 mt-1.5";
        const masaSpan = document.createElement("span");
        masaSpan.className = `text-[9px] font-black px-2 py-0.5 rounded ${masaClass} uppercase tracking-tighter`;
        masaSpan.textContent = item.masa || "-";
        const idSpan = document.createElement("span");
        idSpan.className = "text-[10px] text-slate-400 font-mono font-bold";
        idSpan.textContent = item.id_tempahan || "-";
        metaRow.appendChild(masaSpan);
        metaRow.appendChild(idSpan);
        tdDate.appendChild(dateDiv);
        tdDate.appendChild(metaRow);

        const tdSchool = document.createElement("td");
        tdSchool.className = "px-8 py-6 align-top";
        const schoolDiv = document.createElement("div");
        schoolDiv.className =
          "font-bold text-brand-600 text-sm leading-snug mb-1.5 wrap-safe max-w-xs group-hover:text-brand-700 transition-colors uppercase break-words";
        schoolDiv.textContent = item.nama_sekolah || item.kod_sekolah || "-";
        const topicDiv = document.createElement("div");
        topicDiv.className =
          "text-[10px] font-black text-slate-400 uppercase tracking-widest wrap-safe leading-relaxed break-words";
        topicDiv.textContent = item.tajuk_bengkel || "TIADA TAJUK SPESIFIK";
        tdSchool.appendChild(schoolDiv);
        tdSchool.appendChild(topicDiv);

        const tdPic = document.createElement("td");
        tdPic.className = "px-8 py-6 align-top";
        const picDiv = document.createElement("div");
        picDiv.className = "font-bold text-slate-700 text-xs uppercase wrap-safe break-words";
        picDiv.textContent = item.nama_pic || "-";
        tdPic.appendChild(picDiv);

        const cleanedTel = cleanPhone(item.no_tel_pic || "");
        if (cleanedTel) {
          const waLink = document.createElement("a");
          waLink.href = `https://wa.me/${cleanedTel}`;
          waLink.target = "_blank";
          waLink.rel = "noopener noreferrer";
          waLink.className =
            "text-[10px] text-blue-500 font-black hover:underline inline-flex items-center gap-1.5 mt-1";
          waLink.appendChild(createIcon("fab fa-whatsapp"));
          waLink.appendChild(document.createTextNode(` ${item.no_tel_pic}`));
          tdPic.appendChild(waLink);
        }

        const tdAction = document.createElement("td");
        tdAction.className = "px-8 py-6 text-center align-top";
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className =
          "min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-slate-100 border-2 border-slate-200 text-slate-400 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto group-active:scale-95";
        delBtn.title = "Padam Tempahan (Kekal)";
        delBtn.appendChild(createIcon("fas fa-trash-alt"));
        delBtn.addEventListener("click", () => {
          window.cancelBookingAdmin(item.id, item.id_tempahan);
        });
        tdAction.appendChild(delBtn);

        tr.appendChild(tdDate);
        tr.appendChild(tdSchool);
        tr.appendChild(tdPic);
        tr.appendChild(tdAction);
        fragment.appendChild(tr);
      } else {
        const dateOnly = item.tarikh.split("T")[0];
        const isAll = item.kod_ppd.some((s) => s.startsWith("ALL"));

        const scopesDisplay = [];
        item.kod_ppd.forEach((scope) => {
          let districtName = scope;
          let slotName = "SEHARI";
          if (scope.includes(":")) {
            const parts = scope.split(":");
            districtName = parts[0] !== "ALL" ? parts[0] : "NEGERI";
            if (parts[1] !== "ALL") {
              slotName = parts[1];
            }
          }
          scopesDisplay.push(`${districtName}(${slotName})`);
        });

        const scopeBadgeLabel = isAll
          ? `NEGERI [${item.kod_ppd[0].split(":")[1] || "ALL"}]`
          : `DAERAH: ${scopesDisplay.join(", ")}`;
        const scopeBadgeColor = isAll
          ? "text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50"
          : "text-slate-600 border-slate-200 bg-white";

        const tr = document.createElement("tr");
        tr.className =
          "bg-indigo-50/40 hover:bg-indigo-50 transition-all border-l-4 border-l-indigo-500";

        const tdDate = document.createElement("td");
        tdDate.className = "px-8 py-6 align-top";
        const dateDiv = document.createElement("div");
        dateDiv.className = "font-black text-indigo-900 text-sm tracking-tight uppercase";
        dateDiv.textContent = dateStr;
        const badgeWrap = document.createElement("div");
        badgeWrap.className = "mt-1.5";
        const lockBadge = document.createElement("span");
        lockBadge.className =
          "text-[9px] font-black px-2 py-0.5 rounded bg-indigo-600 text-white border border-indigo-700 uppercase tracking-tighter shadow-sm";
        lockBadge.textContent = "TARIKH DIKUNCI";
        badgeWrap.appendChild(lockBadge);
        tdDate.appendChild(dateDiv);
        tdDate.appendChild(badgeWrap);

        const tdInfo = document.createElement("td");
        tdInfo.className = "px-8 py-6 align-top";
        const titleDiv = document.createElement("div");
        titleDiv.className =
          "font-bold text-indigo-700 text-sm leading-snug mb-1.5 wrap-safe max-w-xs uppercase";
        titleDiv.textContent = "BIMBINGAN DISEKAT";
        const noteDiv = document.createElement("div");
        noteDiv.className =
          "text-[10px] font-bold text-indigo-400 uppercase tracking-wide wrap-safe break-words leading-relaxed italic bg-white/50 p-1.5 rounded-lg border border-indigo-100";
        noteDiv.appendChild(createIcon("fas fa-info-circle mr-1"));
        noteDiv.appendChild(document.createTextNode(`"${item.komen || "TIADA CATATAN"}"`));
        tdInfo.appendChild(titleDiv);
        tdInfo.appendChild(noteDiv);

        const tdAdmin = document.createElement("td");
        tdAdmin.className = "px-8 py-6 align-top";
        const lblBy = document.createElement("div");
        lblBy.className = "text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1";
        lblBy.textContent = "DIKUNCI OLEH:";
        const byVal = document.createElement("div");
        byVal.className = "font-mono text-[10px] text-indigo-600 font-bold break-all mb-2";
        byVal.textContent = item.dikunci_oleh || "PENTADBIR SISTEM";
        const scopeBox = document.createElement("div");
        scopeBox.className = `text-[8px] font-bold text-slate-400 uppercase tracking-wider px-2 py-0.5 rounded inline-block border ${scopeBadgeColor}`;
        scopeBox.appendChild(document.createTextNode("Skop: "));
        const scopeStrong = document.createElement("span");
        scopeStrong.className = "font-black";
        scopeStrong.textContent = scopeBadgeLabel;
        scopeBox.appendChild(scopeStrong);
        tdAdmin.appendChild(lblBy);
        tdAdmin.appendChild(byVal);
        tdAdmin.appendChild(scopeBox);

        const tdAction = document.createElement("td");
        tdAction.className = "px-8 py-6 text-center align-top";
        const cfgBtn = document.createElement("button");
        cfgBtn.type = "button";
        cfgBtn.className =
          "min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-white border-2 border-indigo-200 text-indigo-400 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center mx-auto";
        cfgBtn.title = "Urus Kunci Tarikh";
        cfgBtn.appendChild(createIcon("fas fa-cog"));
        cfgBtn.addEventListener("click", () => {
          window.handleAdminDateAction(
            dateOnly,
            true,
            false,
            item.komen || "",
            item.kod_ppd
          );
        });
        tdAction.appendChild(cfgBtn);

        tr.appendChild(tdDate);
        tr.appendChild(tdInfo);
        tr.appendChild(tdAdmin);
        tr.appendChild(tdAction);
        fragment.appendChild(tr);
      }
    });

    if (masterList.length > limit) {
      const infoTr = document.createElement("tr");
      infoTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
      const infoTd = document.createElement("td");
      infoTd.colSpan = 4;
      infoTd.className = "p-3 px-6 text-center text-xs font-bold text-amber-800";
      infoTd.appendChild(createIcon("fas fa-info-circle text-amber-500 mr-1.5"));
      infoTd.appendChild(document.createTextNode("Memaparkan "));
      const bLimit = document.createElement("strong");
      bLimit.textContent = String(limit);
      infoTd.appendChild(bLimit);
      infoTd.appendChild(document.createTextNode(" daripada "));
      const bTotal = document.createElement("strong");
      bTotal.textContent = String(masterList.length);
      infoTd.appendChild(bTotal);
      infoTd.appendChild(
        document.createTextNode(" permohonan aktif & kunci tarikh terkini.")
      );
      infoTr.appendChild(infoTd);
      fragment.appendChild(infoTr);
    }

    tbody.appendChild(fragment);
  } catch {
    clearElement(tbody);
    const errTr = document.createElement("tr");
    const errTd = document.createElement("td");
    errTd.colSpan = 4;
    errTd.className =
      "p-10 text-center text-red-500 font-bold bg-red-50 border-2 border-red-100";
    errTd.textContent = "Gagal memproses senarai tempahan dari pelayan.";
    errTr.appendChild(errTd);
    tbody.appendChild(errTr);
  }
};

window.cancelBookingAdmin = async function (dbId, bookingId) {
  if (cancelBookingBusy || typeof window === "undefined" || !window.Swal) {
    return;
  }

  const container = document.createElement("div");
  const card = document.createElement("div");
  card.className =
    "text-center p-5 bg-red-50 rounded-2xl border-2 border-red-100 mb-4 shadow-inner";

  const lbl = document.createElement("p");
  lbl.className = "text-xs text-red-400 font-bold uppercase tracking-widest mb-1";
  lbl.textContent = "ID Permohonan:";

  const idP = document.createElement("p");
  idP.className = "text-xl font-black text-red-600 font-mono";
  idP.textContent = bookingId || "-";

  card.appendChild(lbl);
  card.appendChild(idP);

  const noteP = document.createElement("p");
  noteP.className = "text-sm text-slate-500 leading-relaxed px-4 font-medium";
  noteP.appendChild(document.createTextNode("Tindakan ini adalah "));
  const boldText = document.createElement("strong");
  boldText.textContent = "PADAM KEKAL";
  noteP.appendChild(boldText);
  noteP.appendChild(
    document.createTextNode(" dari pangkalan data. Tiada rekod audit akan disimpan.")
  );

  container.appendChild(card);
  container.appendChild(noteP);

  const { isConfirmed } = await window.Swal.fire({
    title: "Padam Tempahan?",
    html: container,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "YA, PADAM KEKAL",
    cancelButtonText: "TUTUP",
    customClass: { popup: "rounded-[2rem] border-4 border-red-50" }
  });

  if (isConfirmed) {
    cancelBookingBusy = true;
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await BookingService.adminCancelBooking(dbId);
      toggleLoading(false);

      await showAlert({
        icon: "success",
        title: "Data Dihapuskan",
        text: "Rekod telah dipadam secara fizikal dari sistem.",
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: "rounded-[2rem]" }
      });

      await silentRefreshAllBookingViews();
    } catch {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat Pemadaman",
        text: "Gagal memadam data dari pangkalan data.",
        customClass: { popup: "rounded-[2rem]" }
      });
    } finally {
      cancelBookingBusy = false;
    }
  }
};

window.changeAdminMonth = function (offset) {
  adminCurrentMonth += offset;
  adminSelectedDates = [];
  updateMultiLockUI();

  if (adminCurrentMonth > 11) {
    adminCurrentMonth = 0;
    adminCurrentYear += 1;
  } else if (adminCurrentMonth < 0) {
    adminCurrentMonth = 11;
    adminCurrentYear -= 1;
  }

  const realToday = new Date();
  if (
    adminCurrentMonth === realToday.getMonth() &&
    adminCurrentYear === realToday.getFullYear()
  ) {
    adminActiveWeek = getWeekNumberForDate(
      adminCurrentYear,
      adminCurrentMonth,
      realToday.getDate()
    );
  } else {
    adminActiveWeek = 1;
  }

  window.renderAdminBookingCalendar();
};

window.loadAdminBookingAudit = async function () {
  const tbody = document.getElementById("auditTableBody");
  if (!tbody) {
    return;
  }

  clearElement(tbody);
  const loadTr = document.createElement("tr");
  const loadTd = document.createElement("td");
  loadTd.colSpan = 6;
  loadTd.className = "p-12 text-center text-slate-400 font-medium italic";
  loadTd.appendChild(createIcon("fas fa-circle-notch fa-spin mr-2"));
  loadTd.appendChild(document.createTextNode("Menarik rekod audit dari pangkalan data..."));
  loadTr.appendChild(loadTd);
  tbody.appendChild(loadTr);

  try {
    await envReady;
    const db = (await initDatabaseClient()) || getDatabaseClient();
    if (!db) {
      throw new Error("Pangkalan data tidak tersedia.");
    }

    const [resTempahan, resKunci] = await Promise.all([
      db.from("smpid_bb_tempahan").select("*").order("tarikh", { ascending: false }),
      db.from("smpid_bb_kunci").select("*").order("tarikh", { ascending: false })
    ]);

    if (resTempahan.error) {
      throw resTempahan.error;
    }
    if (resKunci.error) {
      throw resKunci.error;
    }

    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

    let rawTempahan = resTempahan.data || [];
    let rawKunci = resKunci.data || [];

    if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
      const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
      if (userKod) {
        validSchoolCodes.push(userKod);
      }
      rawTempahan = rawTempahan.filter((b) => validSchoolCodes.includes(b.kod_sekolah));

      let targetPPD = userKod;
      if (APP_CONFIG.PPD_MAPPING) {
        const foundKey = Object.keys(APP_CONFIG.PPD_MAPPING).find((k) => k === userKod);
        if (foundKey) {
          targetPPD = foundKey;
        }
      }
      rawKunci = rawKunci.filter((k) => {
        if (!k.kod_ppd) {
          return false;
        }
        const scopes = k.kod_ppd.split(",");
        return scopes.some((s) => s.startsWith("ALL") || s.startsWith(targetPPD));
      });
    }

    const mappedTempahan = rawTempahan.map((b) => {
      let daerah = "ALOR GAJAH";
      if (Array.isArray(window.globalDashboardData)) {
        const sMatch = window.globalDashboardData.find((s) => s.kod_sekolah === b.kod_sekolah);
        if (sMatch && sMatch.daerah) {
          daerah = sMatch.daerah;
        }
      } else if (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[b.kod_sekolah]) {
        daerah = APP_CONFIG.PPD_MAPPING[b.kod_sekolah];
      }
      return { ...b, type: "BOOKING", daerah: daerah.toUpperCase() };
    });

    const mappedKunci = rawKunci.map((k) => {
      const parsedDaerah = [];
      if (k.kod_ppd) {
        const scopes = k.kod_ppd.split(",");
        scopes.forEach((s) => {
          const dKod = s.split(":")[0];
          if (dKod === "ALL") {
            parsedDaerah.push("NEGERI");
          } else if (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[dKod]) {
            parsedDaerah.push(APP_CONFIG.PPD_MAPPING[dKod]);
          } else {
            parsedDaerah.push(dKod);
          }
        });
      }

      return {
        ...k,
        type: "LOCK",
        daerah: parsedDaerah.join(", "),
        kod_sekolah: "SYSTEM",
        nama_sekolah: `KUNCI TARIKH (${k.kod_ppd || "ALL"})`,
        id_tempahan: `LOCK-${k.id}`,
        masa: "SEHARI / SEPARA",
        tajuk_bengkel: k.komen || "TIADA CATATAN",
        nama_pic: k.dikunci_oleh || "PENTADBIR SISTEM",
        no_tel_pic: "-",
        status: "DIKUNCI"
      };
    });

    globalAuditBookings = [...mappedTempahan, ...mappedKunci].sort(
      (a, b) => new Date(b.tarikh) - new Date(a.tarikh)
    );
    window.filterAudit();
  } catch {
    clearElement(tbody);
    const errTr = document.createElement("tr");
    const errTd = document.createElement("td");
    errTd.colSpan = 6;
    errTd.className =
      "p-10 text-center text-red-500 font-bold bg-red-50 border-2 border-red-100";
    errTd.textContent = "Gagal menarik data audit. Sila cuba lagi.";
    errTr.appendChild(errTd);
    tbody.appendChild(errTr);
  }
};

window.filterAudit = function () {
  const searchInput = document.getElementById("auditSearchInput");
  const daerahInput = document.getElementById("auditDaerahFilter");

  const query = searchInput ? searchInput.value.trim().toUpperCase() : "";
  const daerahTarget = daerahInput ? daerahInput.value : "ALL";
  auditDaerahFilter = daerahTarget;

  if (adminDaerahFilter !== daerahTarget) {
    adminDaerahFilter = daerahTarget;
    const mainSelect = document.getElementById("adminBookingFilterDaerah");
    if (mainSelect) {
      mainSelect.value = daerahTarget;
    }
    window.renderAdminBookingDashboard();
    window.renderAdminBookingCalendar();
  }

  filteredAuditBookings = globalAuditBookings.filter((b) => {
    let matchDaerah = true;
    let matchSearch = true;

    if (daerahTarget !== "ALL") {
      const targetName =
        APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[daerahTarget]
          ? APP_CONFIG.PPD_MAPPING[daerahTarget]
          : daerahTarget;
      matchDaerah =
        b.daerah.includes(targetName.toUpperCase()) || b.daerah.includes("NEGERI");
    }

    if (query) {
      matchSearch =
        (b.nama_sekolah && b.nama_sekolah.toUpperCase().includes(query)) ||
        (b.kod_sekolah && b.kod_sekolah.toUpperCase().includes(query)) ||
        (b.id_tempahan && b.id_tempahan.toUpperCase().includes(query)) ||
        (b.nama_pic && b.nama_pic.toUpperCase().includes(query)) ||
        (b.tajuk_bengkel && b.tajuk_bengkel.toUpperCase().includes(query));
    }

    return matchDaerah && matchSearch;
  });

  renderAuditTable();
};

function renderAuditTable() {
  const tbody = document.getElementById("auditTableBody");
  if (!tbody) {
    return;
  }

  clearElement(tbody);

  if (filteredAuditBookings.length === 0) {
    const emptyTr = document.createElement("tr");
    const emptyTd = document.createElement("td");
    emptyTd.colSpan = 6;
    emptyTd.className = "p-12 text-center text-slate-400 font-medium italic bg-slate-50/50";
    emptyTd.textContent = "Tiada rekod ditemui berdasarkan carian anda.";
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayList = filteredAuditBookings.slice(0, limit);
  const fragment = document.createDocumentFragment();

  displayList.forEach((item, index) => {
    const dateObj = new Date(item.tarikh);
    const dateStr = dateObj.toLocaleDateString("ms-MY", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const isLock = item.type === "LOCK";
    const tr = document.createElement("tr");
    tr.className = isLock
      ? "bg-purple-50/30 hover:bg-purple-50 transition border-b border-purple-100 last:border-0 border-l-4 border-l-purple-500"
      : "hover:bg-slate-50 transition border-b border-slate-50 last:border-0";

    const tdBil = document.createElement("td");
    tdBil.className = "px-6 py-4 text-center font-mono text-[10px] font-bold text-slate-400";
    tdBil.textContent = String(index + 1);

    const tdDate = document.createElement("td");
    tdDate.className = "px-6 py-4";
    const dateDiv = document.createElement("div");
    dateDiv.className = "font-bold text-slate-800 text-xs mb-1";
    dateDiv.textContent = dateStr;
    const masaDiv = document.createElement("div");
    masaDiv.className = isLock
      ? "text-[9px] font-black uppercase text-purple-600 tracking-wider"
      : "text-[9px] font-black uppercase text-slate-500 tracking-wider";
    masaDiv.appendChild(createIcon(isLock ? "fas fa-lock mr-1" : "fas fa-clock mr-1"));
    masaDiv.appendChild(document.createTextNode(item.masa || "-"));
    tdDate.appendChild(dateDiv);
    tdDate.appendChild(masaDiv);

    const tdSchool = document.createElement("td");
    tdSchool.className = "px-6 py-4";
    const schoolDiv = document.createElement("div");
    schoolDiv.className = isLock
      ? "font-bold text-purple-700 text-sm leading-snug wrap-safe break-words max-w-[200px]"
      : "font-bold text-brand-600 text-sm leading-snug wrap-safe break-words max-w-[200px]";
    schoolDiv.textContent = item.nama_sekolah || "-";

    const tagRow = document.createElement("div");
    tagRow.className = "flex items-center gap-2 mt-1";
    const kodBadge = document.createElement("span");
    kodBadge.className = isLock
      ? "text-[9px] font-mono font-bold bg-white px-1.5 py-0.5 rounded text-purple-500 border border-purple-200 shadow-sm"
      : "text-[9px] font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200";
    kodBadge.textContent = item.kod_sekolah || "-";
    const daerahBadge = document.createElement("span");
    daerahBadge.className = isLock
      ? "text-[9px] font-bold text-purple-600 uppercase bg-purple-100 px-1.5 py-0.5 rounded"
      : "text-[9px] font-bold text-slate-400 uppercase";
    daerahBadge.textContent = item.daerah || "-";
    tagRow.appendChild(kodBadge);
    tagRow.appendChild(daerahBadge);
    tdSchool.appendChild(schoolDiv);
    tdSchool.appendChild(tagRow);

    const tdTopic = document.createElement("td");
    tdTopic.className = "px-6 py-4";
    const topicDiv = document.createElement("div");
    topicDiv.className = isLock
      ? "text-xs font-bold text-slate-700 wrap-safe break-words max-w-[200px] leading-snug bg-white p-1.5 rounded border border-slate-200"
      : "text-xs font-bold text-slate-700 wrap-safe break-words max-w-[200px] leading-snug";
    topicDiv.textContent = isLock ? `"${item.tajuk_bengkel}"` : item.tajuk_bengkel || "-";
    const refDiv = document.createElement("div");
    refDiv.className = "text-[9px] text-slate-400 font-mono mt-1 font-bold";
    refDiv.textContent = `REF: ${item.id_tempahan || "-"}`;
    tdTopic.appendChild(topicDiv);
    tdTopic.appendChild(refDiv);

    const tdPic = document.createElement("td");
    tdPic.className = "px-6 py-4";
    const picDiv = document.createElement("div");
    picDiv.className = "text-xs font-bold text-slate-700 wrap-safe break-words uppercase";
    picDiv.textContent = item.nama_pic || "-";
    const telDiv = document.createElement("div");
    telDiv.className = "text-[10px] font-mono font-bold text-slate-500 mt-1";
    telDiv.textContent = item.no_tel_pic || "-";
    tdPic.appendChild(picDiv);
    tdPic.appendChild(telDiv);

    const tdStatus = document.createElement("td");
    tdStatus.className = "px-6 py-4 text-center";
    const statusBadge = document.createElement("span");
    if (isLock) {
      statusBadge.className =
        "bg-purple-100 text-purple-700 px-2.5 py-1 rounded text-[10px] font-black tracking-widest border border-purple-200 shadow-sm";
      statusBadge.textContent = "DIKUNCI";
    } else if (item.status === "AKTIF") {
      statusBadge.className =
        "bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-black tracking-widest border border-emerald-200 shadow-sm";
      statusBadge.textContent = "AKTIF";
    } else {
      statusBadge.className =
        "bg-red-100 text-red-700 px-2.5 py-1 rounded text-[10px] font-black tracking-widest border border-red-200 shadow-sm";
      statusBadge.textContent = "BATAL";
    }
    tdStatus.appendChild(statusBadge);

    tr.appendChild(tdBil);
    tr.appendChild(tdDate);
    tr.appendChild(tdSchool);
    tr.appendChild(tdTopic);
    tr.appendChild(tdPic);
    tr.appendChild(tdStatus);
    fragment.appendChild(tr);
  });

  if (filteredAuditBookings.length > limit) {
    const infoTr = document.createElement("tr");
    infoTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
    const infoTd = document.createElement("td");
    infoTd.colSpan = 6;
    infoTd.className = "p-3 px-6 text-center text-xs font-bold text-amber-800";

    const flexWrap = document.createElement("div");
    flexWrap.className = "flex flex-col sm:flex-row items-center justify-between gap-2";

    const leftSpan = document.createElement("span");
    leftSpan.className = "flex items-center gap-1.5";
    leftSpan.appendChild(createIcon("fas fa-info-circle text-amber-500 text-sm"));
    leftSpan.appendChild(document.createTextNode("Memaparkan "));
    const bLimit = document.createElement("strong");
    bLimit.textContent = String(limit);
    leftSpan.appendChild(bLimit);
    leftSpan.appendChild(document.createTextNode(" daripada "));
    const bTotal = document.createElement("strong");
    bTotal.textContent = String(filteredAuditBookings.length);
    leftSpan.appendChild(bTotal);
    leftSpan.appendChild(
      document.createTextNode(" rekod audit. Gunakan carian untuk melihat rekod spesifik.")
    );

    const rightSpan = document.createElement("span");
    rightSpan.className =
      "text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full font-black uppercase tracking-wider";
    rightSpan.textContent = `Eksport CSV Menyimpan 100% Data (${filteredAuditBookings.length} Rekod)`;

    flexWrap.appendChild(leftSpan);
    flexWrap.appendChild(rightSpan);
    infoTd.appendChild(flexWrap);
    infoTr.appendChild(infoTd);
    fragment.appendChild(infoTr);
  }

  tbody.appendChild(fragment);
}

window.eksportAuditCSV = function () {
  if (!filteredAuditBookings || filteredAuditBookings.length === 0) {
    showAlert({
      icon: "warning",
      title: "Tiada Data",
      text: "Tiada rekod untuk dieksport berdasarkan tapisan semasa."
    });
    return;
  }

  let csvContent =
    "BIL,ID TEMPAHAN,JENIS REKOD,TARIKH,MASA,KOD SEKOLAH,NAMA SEKOLAH,DAERAH,FOKUS / CATATAN,NAMA PIC,NO TEL PIC,STATUS\n";

  filteredAuditBookings.forEach((b, index) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const tarikh = b.tarikh ? new Date(b.tarikh).toLocaleDateString("ms-MY") : "-";

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

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Semakan_Audit_Tempahan_Dan_Kunci_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }
};