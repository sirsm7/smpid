import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { DcsService } from "../services/dcs.service.js";
import { toggleLoading } from "../core/helpers.js";

let dcsDataList = [];
let currentFilteredDcs = [];
const charts = { donut: null, bar: null };
let analisaSortState = { column: "", direction: "desc" };
let realtimeSubscribed = false;
let dcsSaveBusy = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message =
    options && (options.text || options.title)
      ? `${options.title || ""}\n${options.text || ""}`.trim()
      : "";
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function applyRbacToDcs(rawList) {
  let data = Array.isArray(rawList) ? rawList : [];
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

  if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
    const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
    if (userKod) {
      validSchoolCodes.push(userKod);
    }
    data = data.filter((d) => validSchoolCodes.includes(d.kod_sekolah));
  }
  return data;
}

function renderTableMessage(wrapper, message, isError = false) {
  if (!wrapper) {
    return;
  }
  clearElement(wrapper);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = isError
    ? "p-8 text-center text-red-500 font-bold"
    : "p-8 text-center text-slate-400 font-medium";
  td.textContent = message;
  tr.appendChild(td);
  wrapper.appendChild(tr);
}

async function silentRefreshDcsAdmin() {
  try {
    await envReady;
    await initDatabaseClient();
    const dataRaw = await DcsService.getAll();
    dcsDataList = applyRbacToDcs(dataRaw);
    populateDcsYears(true);
    window.updateDashboardAnalisa();
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_dcs_analisa",
    table: "smpid_dcs_analisa",
    primaryKey: "kod_sekolah",
    cacheStore: "query_cache",
    cachePrefix: "dcs",
    onChange: async () => {
      await silentRefreshDcsAdmin();
    },
    onSync: async () => {
      await silentRefreshDcsAdmin();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

window.loadDcsAdmin = async function () {
  const wrapper = document.getElementById("tableAnalisaBody");
  renderTableMessage(wrapper, "Memuatkan data analisa...", false);

  try {
    await envReady;
    await initDatabaseClient();
    const dataRaw = await DcsService.getAll();
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    dcsDataList = applyRbacToDcs(dataRaw);

    initDistrictFilter(userRole);
    populateDcsYears(false);
    window.updateDashboardAnalisa();
    ensureRealtimeSync();
  } catch {
    renderTableMessage(wrapper, "Gagal memuatkan data.", true);
  }
};

function initDistrictFilter(userRole) {
  if (!["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
    return;
  }

  const searchBox = document.getElementById("searchAnalisa");
  if (!searchBox || document.getElementById("filterDaerahAnalisa")) {
    return;
  }

  const filterSelect = document.createElement("select");
  filterSelect.id = "filterDaerahAnalisa";
  filterSelect.className =
    "ml-0 md:ml-3 mt-2 md:mt-0 min-h-[40px] p-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-slate-600";

  const fragment = document.createDocumentFragment();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "ALL";
  defaultOpt.textContent = "Semua Daerah (Negeri)";
  fragment.appendChild(defaultOpt);

  const senaraiPPD = APP_CONFIG.PPD_MAPPING || {
    M010: "ALOR GAJAH",
    M020: "JASIN",
    M030: "MELAKA TENGAH"
  };

  Object.keys(senaraiPPD).forEach((kod) => {
    const opt = document.createElement("option");
    opt.value = kod;
    opt.textContent = senaraiPPD[kod];
    fragment.appendChild(opt);
  });

  filterSelect.appendChild(fragment);

  if (searchBox.parentNode) {
    searchBox.parentNode.insertBefore(filterSelect, searchBox.nextSibling);
  }

  filterSelect.addEventListener("change", () => {
    window.updateDashboardAnalisa();
  });
}

function getBaseFilteredData() {
  let list = [...dcsDataList];
  const filterEl = document.getElementById("filterDaerahAnalisa");

  if (filterEl && filterEl.value !== "ALL") {
    const targetPPDCode = filterEl.value;
    const senaraiPPD = APP_CONFIG.PPD_MAPPING || {};
    const targetPPDName = senaraiPPD[targetPPDCode]
      ? senaraiPPD[targetPPDCode].toUpperCase()
      : targetPPDCode.toUpperCase();

    list = list.filter((d) => {
      if (d.kod_sekolah && d.kod_sekolah.toUpperCase() === targetPPDCode.toUpperCase()) {
        return true;
      }
      if (d.daerah && d.daerah.toUpperCase() === targetPPDName) {
        return true;
      }
      return false;
    });
  }

  return list;
}

function populateDcsYears(preserveSelection = false) {
  const select = document.getElementById("pilihTahunAnalisa");
  if (!select || dcsDataList.length === 0) {
    return;
  }

  const prevSelected = select.value;
  const yearSet = new Set();

  dcsDataList.forEach((row) => {
    if (!row || typeof row !== "object") {
      return;
    }
    Object.keys(row).forEach((key) => {
      const match = key.match(/^dcs_(\d{4})$/);
      if (match) {
        yearSet.add(parseInt(match[1], 10));
      }
    });
  });

  const years = Array.from(yearSet).sort((a, b) => b - a);
  if (years.length === 0) {
    return;
  }

  clearElement(select);
  const fragment = document.createDocumentFragment();

  years.forEach((y, index) => {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = index === 0 ? `DATA TAHUN ${y} (TERKINI)` : `DATA TAHUN ${y}`;
    fragment.appendChild(opt);
  });

  select.appendChild(fragment);

  if (preserveSelection && prevSelected && years.includes(parseInt(prevSelected, 10))) {
    select.value = prevSelected;
  } else {
    select.value = String(years[0]);
  }
}

function setYearComparisonBadge(el, currYear, prevYear) {
  if (!el) {
    return;
  }
  clearElement(el);
  const span = document.createElement("span");
  span.className = "opacity-70 font-normal ml-1 text-[10px]";
  span.textContent = `(${currYear} vs ${prevYear})`;
  el.appendChild(span);
}

window.updateDashboardAnalisa = function () {
  const selectEl = document.getElementById("pilihTahunAnalisa");
  const currYear = selectEl ? parseInt(selectEl.value, 10) : NaN;
  if (!currYear || Number.isNaN(currYear)) {
    return;
  }
  const prevYear = currYear - 1;

  setYearComparisonBadge(document.getElementById("lblYearDcs"), currYear, prevYear);
  setYearComparisonBadge(document.getElementById("lblYearAktif"), currYear, prevYear);

  const titleEl = document.getElementById("modalDcsYearTitle");
  if (titleEl) {
    titleEl.textContent = String(currYear);
  }

  processDcsPanel(`dcs_${currYear}`);
  processActivePanel(`peratus_aktif_${currYear}`);

  window.filterAnalisaTable(currYear, prevYear);
};

function getKategoriDcs(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return {
      label: "TIADA",
      color: "text-slate-400",
      bg: "bg-slate-100 border-slate-200"
    };
  }
  const num = Number(score);
  if (num < 2) {
    return {
      label: "BEGINNER",
      color: "text-red-700",
      bg: "bg-red-100 border-red-200"
    };
  }
  if (num <= 3) {
    return {
      label: "NOVICE",
      color: "text-orange-700",
      bg: "bg-orange-100 border-orange-200"
    };
  }
  if (num <= 4) {
    return {
      label: "INTERMEDIATE",
      color: "text-amber-700",
      bg: "bg-amber-100 border-amber-200"
    };
  }
  if (num <= 4.74) {
    return {
      label: "ADVANCE",
      color: "text-blue-700",
      bg: "bg-blue-100 border-blue-200"
    };
  }
  return {
    label: "INNOVATOR",
    color: "text-green-700",
    bg: "bg-green-100 border-green-200"
  };
}

function renderTopRankingRows(tbody, topRows, field, formatFn, borderClass, valueClass) {
  if (!tbody) {
    return;
  }
  clearElement(tbody);
  const fragment = document.createDocumentFragment();

  if (topRows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.className = "p-3 text-center text-xs text-slate-400";
    td.textContent = "Tiada Data";
    tr.appendChild(td);
    fragment.appendChild(tr);
    tbody.appendChild(fragment);
    return;
  }

  topRows.forEach((d, idx) => {
    const tr = document.createElement("tr");
    tr.className = `${borderClass} last:border-0`;

    const tdRank = document.createElement("td");
    tdRank.className = "p-3 font-bold text-slate-500 w-8";
    tdRank.textContent = String(idx + 1);

    const tdName = document.createElement("td");
    tdName.className = "p-3 text-xs font-semibold text-slate-700 truncate max-w-[150px]";
    tdName.title = d.nama_sekolah || "";
    tdName.textContent = d.nama_sekolah || "-";

    const tdVal = document.createElement("td");
    tdVal.className = `p-3 text-right font-bold ${valueClass}`;
    tdVal.textContent = formatFn(d[field]);

    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdVal);
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
}

function processDcsPanel(field) {
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  let targetPpdKod = "JPNMEL";

  const filterEl = document.getElementById("filterDaerahAnalisa");
  if (filterEl && filterEl.value !== "ALL") {
    targetPpdKod = filterEl.value;
  } else if (["ADMIN", "PPD_UNIT"].includes(userRole)) {
    targetPpdKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  }

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  const activeDataList = getBaseFilteredData();

  const ppdData = dcsDataList.find((d) => d.kod_sekolah === targetPpdKod);
  const ppdScore = ppdData && ppdData[field] !== null && ppdData[field] !== undefined ? Number(ppdData[field]) : 0;

  const scoreEl = document.getElementById("kpiDcsScore");
  if (scoreEl) {
    scoreEl.textContent = ppdScore.toFixed(2);
  }

  const cat = getKategoriDcs(ppdScore);
  const lbl = document.getElementById("kpiDcsLabel");
  if (lbl) {
    lbl.textContent = cat.label;
    lbl.className = `inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 border ${cat.bg} ${cat.color}`;
  }

  const schools = activeDataList.filter(
    (d) => !senaraiKodPPD.includes(d.kod_sekolah) && d.kod_sekolah !== "JPNMEL"
  );
  const cats = { Beginner: 0, Novice: 0, Intermediate: 0, Advance: 0, Innovator: 0 };

  schools.forEach((d) => {
    const score = d[field];
    if (score !== null && score !== undefined) {
      const catLabel = getKategoriDcs(score).label;
      const normalizedKey = catLabel.charAt(0) + catLabel.slice(1).toLowerCase();
      if (Object.prototype.hasOwnProperty.call(cats, normalizedKey)) {
        cats[normalizedKey] += 1;
      }
    }
  });

  const chartData = [
    cats.Beginner || 0,
    cats.Novice || 0,
    cats.Intermediate || 0,
    cats.Advance || 0,
    cats.Innovator || 0
  ];

  const ctx = document.getElementById("chartDcsDonut");
  if (charts.donut) {
    charts.donut.destroy();
    charts.donut = null;
  }
  if (ctx && typeof window !== "undefined" && typeof window.Chart !== "undefined") {
    charts.donut = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Beginner", "Novice", "Intermediate", "Advance", "Innovator"],
        datasets: [
          {
            data: chartData,
            backgroundColor: ["#ef4444", "#f97316", "#f59e0b", "#3b82f6", "#22c55e"],
            borderWidth: 0
          }
        ]
      },
      options: {
        plugins: { legend: { position: "right", labels: { boxWidth: 10, font: { size: 10 } } } },
        maintainAspectRatio: false,
        cutout: "70%"
      }
    });
  }

  const top5 = [...schools].sort((a, b) => (b[field] || 0) - (a[field] || 0)).slice(0, 5);
  renderTopRankingRows(
    document.getElementById("tableTopDcs"),
    top5,
    field,
    (val) => (val !== null && val !== undefined ? Number(val).toFixed(2) : "-"),
    "border-b border-blue-50",
    "text-blue-600"
  );
}

function processActivePanel(field) {
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  let targetPpdKod = "JPNMEL";

  const filterEl = document.getElementById("filterDaerahAnalisa");
  if (filterEl && filterEl.value !== "ALL") {
    targetPpdKod = filterEl.value;
  } else if (["ADMIN", "PPD_UNIT"].includes(userRole)) {
    targetPpdKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  }

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  const activeDataList = getBaseFilteredData();

  const ppdData = dcsDataList.find((d) => d.kod_sekolah === targetPpdKod);
  const scoreEl = document.getElementById("kpiActiveScore");
  if (scoreEl) {
    scoreEl.textContent = String(ppdData && ppdData[field] !== null && ppdData[field] !== undefined ? ppdData[field] : 0);
  }

  const schools = activeDataList.filter(
    (d) => !senaraiKodPPD.includes(d.kod_sekolah) && d.kod_sekolah !== "JPNMEL"
  );
  const ranges = { "Tinggi (>80%)": 0, Sederhana: 0, Rendah: 0 };

  schools.forEach((d) => {
    const v = d[field];
    if (v >= 80) {
      ranges["Tinggi (>80%)"] += 1;
    } else if (v >= 50) {
      ranges.Sederhana += 1;
    } else if (v > 0) {
      ranges.Rendah += 1;
    }
  });

  const ctx = document.getElementById("chartActiveBar");
  if (charts.bar) {
    charts.bar.destroy();
    charts.bar = null;
  }
  if (ctx && typeof window !== "undefined" && typeof window.Chart !== "undefined") {
    charts.bar = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(ranges),
        datasets: [
          {
            data: Object.values(ranges),
            backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"],
            borderRadius: 4
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        maintainAspectRatio: false,
        scales: { x: { grid: { display: false } }, y: { grid: { display: false } } }
      }
    });
  }

  const top5 = [...schools].sort((a, b) => (b[field] || 0) - (a[field] || 0)).slice(0, 5);
  renderTopRankingRows(
    document.getElementById("tableTopActive"),
    top5,
    field,
    (val) => `${val !== null && val !== undefined ? val : "-"}%`,
    "border-b border-green-50",
    "text-green-600"
  );
}

window.sortAnalisa = function (col) {
  if (analisaSortState.column === col) {
    analisaSortState.direction = analisaSortState.direction === "asc" ? "desc" : "asc";
  } else {
    analisaSortState.column = col;
    analisaSortState.direction = col === "kod" || col === "nama" ? "asc" : "desc";
  }

  const selectEl = document.getElementById("pilihTahunAnalisa");
  const currYear = selectEl ? parseInt(selectEl.value, 10) : new Date().getFullYear();
  window.filterAnalisaTable(currYear, currYear - 1);
};

function createTrendIcon(currVal, prevVal) {
  if (currVal === null || currVal === undefined || prevVal === null || prevVal === undefined) {
    return null;
  }
  const c = Number(currVal);
  const p = Number(prevVal);
  if (Number.isNaN(c) || Number.isNaN(p) || c === p) {
    return null;
  }
  const icon = document.createElement("i");
  icon.className =
    c > p
      ? "fas fa-arrow-up text-green-500 text-[10px] ml-1"
      : "fas fa-arrow-down text-red-500 text-[10px] ml-1";
  return icon;
}

window.filterAnalisaTable = function (currYear, prevYear) {
  if (!currYear) {
    const selectEl = document.getElementById("pilihTahunAnalisa");
    currYear = selectEl ? parseInt(selectEl.value, 10) : new Date().getFullYear();
  }
  if (!prevYear) {
    prevYear = currYear - 1;
  }

  const searchInput = document.getElementById("searchAnalisa");
  const keyword = searchInput ? searchInput.value.toUpperCase().trim() : "";

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  const activeDataList = getBaseFilteredData();
  const listWithoutPPD = activeDataList.filter(
    (d) => !senaraiKodPPD.includes(d.kod_sekolah) && d.kod_sekolah !== "JPNMEL"
  );

  const list = keyword
    ? listWithoutPPD.filter(
        (d) =>
          (d.nama_sekolah && d.nama_sekolah.toUpperCase().includes(keyword)) ||
          (d.kod_sekolah && d.kod_sekolah.toUpperCase().includes(keyword))
      )
    : [...listWithoutPPD];

  if (analisaSortState.column) {
    list.sort((a, b) => {
      let valA;
      let valB;

      if (analisaSortState.column === "kod") {
        valA = String(a.kod_sekolah || "").toUpperCase();
        valB = String(b.kod_sekolah || "").toUpperCase();
      } else if (analisaSortState.column === "nama") {
        valA = String(a.nama_sekolah || "").toUpperCase();
        valB = String(b.nama_sekolah || "").toUpperCase();
      } else if (analisaSortState.column === "dcs") {
        valA = parseFloat(a[`dcs_${currYear}`]) || 0;
        valB = parseFloat(b[`dcs_${currYear}`]) || 0;
      } else if (analisaSortState.column === "aktif") {
        valA = parseFloat(a[`peratus_aktif_${currYear}`]) || 0;
        valB = parseFloat(b[`peratus_aktif_${currYear}`]) || 0;
      }

      if (valA < valB) {
        return analisaSortState.direction === "asc" ? -1 : 1;
      }
      if (valA > valB) {
        return analisaSortState.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }

  currentFilteredDcs = list;

  const columns = ["kod", "nama", "dcs", "aktif"];
  columns.forEach((c) => {
    const th = document.getElementById(`th-analisa-${c}`);
    if (th) {
      const icon = th.querySelector("i.fas");
      if (icon) {
        icon.className = "fas fa-sort ml-1 opacity-50";
        if (analisaSortState.column === c) {
          const arrowDir = analisaSortState.direction === "asc" ? "up" : "down";
          icon.className = `fas fa-sort-${arrowDir} ml-1 text-brand-600 opacity-100`;
        }
      }
    }
  });

  const wrapper = document.getElementById("tableAnalisaBody");
  if (!wrapper) {
    return;
  }

  if (list.length === 0) {
    renderTableMessage(
      wrapper,
      "Tiada rekod sekolah dijumpai berdasarkan tapisan semasa.",
      false
    );
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayList = list.slice(0, limit);
  const fragment = document.createDocumentFragment();

  displayList.forEach((d) => {
    const valDcsCurr = d[`dcs_${currYear}`];
    const valActCurr = d[`peratus_aktif_${currYear}`];
    const valDcsPrev = d[`dcs_${prevYear}`];
    const valActPrev = d[`peratus_aktif_${prevYear}`];

    const cat = getKategoriDcs(valDcsCurr);

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors";

    const tdKod = document.createElement("td");
    tdKod.className = "px-6 py-4 border-b border-slate-100 font-mono text-xs font-bold text-slate-500";
    tdKod.textContent = d.kod_sekolah || "-";

    const tdNama = document.createElement("td");
    tdNama.className =
      "px-6 py-4 border-b border-slate-100 font-semibold text-slate-700 text-xs md:text-sm leading-snug break-words";
    tdNama.textContent = d.nama_sekolah || "-";

    const tdDcs = document.createElement("td");
    tdDcs.className = "px-6 py-4 border-b border-slate-100 text-center bg-blue-50/30";
    const dcsCol = document.createElement("div");
    dcsCol.className = "flex flex-col items-center";

    const dcsMain = document.createElement("div");
    dcsMain.className = "font-bold text-blue-700 text-sm";
    dcsMain.textContent =
      valDcsCurr !== null && valDcsCurr !== undefined ? Number(valDcsCurr).toFixed(2) : "-";
    const dcsTrendIcon = createTrendIcon(valDcsCurr, valDcsPrev);
    if (dcsTrendIcon) {
      dcsMain.appendChild(dcsTrendIcon);
    }

    const dcsPrevSpan = document.createElement("span");
    dcsPrevSpan.className = "text-[10px] text-slate-400 mb-1";
    dcsPrevSpan.textContent = `Prev: ${
      valDcsPrev !== null && valDcsPrev !== undefined ? Number(valDcsPrev).toFixed(2) : "-"
    }`;

    const catBadge = document.createElement("span");
    catBadge.className = `inline-block px-2 py-0.5 rounded text-[9px] font-bold border ${cat.bg} ${cat.color}`;
    catBadge.textContent = cat.label;

    dcsCol.appendChild(dcsMain);
    dcsCol.appendChild(dcsPrevSpan);
    dcsCol.appendChild(catBadge);
    tdDcs.appendChild(dcsCol);

    const tdAktif = document.createElement("td");
    tdAktif.className = "px-6 py-4 border-b border-slate-100 text-center bg-green-50/30";
    const actCol = document.createElement("div");
    actCol.className = "flex flex-col items-center";

    const actMain = document.createElement("div");
    actMain.className = "font-bold text-green-700 text-sm";
    actMain.textContent = `${valActCurr || 0}%`;
    const actTrendIcon = createTrendIcon(valActCurr, valActPrev);
    if (actTrendIcon) {
      actMain.appendChild(actTrendIcon);
    }

    const actPrevSpan = document.createElement("span");
    actPrevSpan.className = "text-[10px] text-slate-400";
    actPrevSpan.textContent = `Prev: ${valActPrev || 0}%`;

    actCol.appendChild(actMain);
    actCol.appendChild(actPrevSpan);
    tdAktif.appendChild(actCol);

    const tdEdit = document.createElement("td");
    tdEdit.className = "px-6 py-4 border-b border-slate-100 text-center";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className =
      "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 transition shadow-sm";
    editBtn.title = "Edit Skor DCS";
    const editIcon = document.createElement("i");
    editIcon.className = "fas fa-edit";
    editBtn.appendChild(editIcon);
    editBtn.addEventListener("click", () => {
      window.openEditDcs(d.kod_sekolah);
    });
    tdEdit.appendChild(editBtn);

    tr.appendChild(tdKod);
    tr.appendChild(tdNama);
    tr.appendChild(tdDcs);
    tr.appendChild(tdAktif);
    tr.appendChild(tdEdit);
    fragment.appendChild(tr);
  });

  if (list.length > limit) {
    const infoTr = document.createElement("tr");
    infoTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
    const infoTd = document.createElement("td");
    infoTd.colSpan = 5;
    infoTd.className = "p-3 px-6 text-center text-xs font-bold text-amber-800";

    const flexWrap = document.createElement("div");
    flexWrap.className = "flex flex-col sm:flex-row items-center justify-between gap-2";

    const leftSpan = document.createElement("span");
    leftSpan.className = "flex items-center gap-1.5";
    const infoIcon = document.createElement("i");
    infoIcon.className = "fas fa-info-circle text-amber-500 text-sm";
    leftSpan.appendChild(infoIcon);
    leftSpan.appendChild(document.createTextNode("Memaparkan "));
    const bLimit = document.createElement("strong");
    bLimit.textContent = String(limit);
    leftSpan.appendChild(bLimit);
    leftSpan.appendChild(document.createTextNode(" daripada "));
    const bTotal = document.createElement("strong");
    bTotal.textContent = String(list.length);
    leftSpan.appendChild(bTotal);
    leftSpan.appendChild(
      document.createTextNode(" sekolah. Gunakan carian untuk melihat sekolah spesifik.")
    );

    const rightSpan = document.createElement("span");
    rightSpan.className =
      "text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full font-black uppercase tracking-wider";
    rightSpan.textContent = `Eksport CSV Menyimpan 100% Data (${list.length} Rekod)`;

    flexWrap.appendChild(leftSpan);
    flexWrap.appendChild(rightSpan);
    infoTd.appendChild(flexWrap);
    infoTr.appendChild(infoTd);
    fragment.appendChild(infoTr);
  }

  clearElement(wrapper);
  wrapper.appendChild(fragment);
};

window.openEditDcs = function (kod) {
  const item = dcsDataList.find((d) => d.kod_sekolah === kod);
  if (!item) {
    return;
  }
  const selectEl = document.getElementById("pilihTahunAnalisa");
  const year = selectEl ? selectEl.value : String(new Date().getFullYear());

  const kodEl = document.getElementById("editKodSekolah");
  const namaEl = document.getElementById("displayEditNama");
  const dcsEl = document.getElementById("editDcsVal");
  const aktifEl = document.getElementById("editAktifVal");

  if (kodEl) {
    kodEl.value = kod;
  }
  if (namaEl) {
    namaEl.value = item.nama_sekolah || "";
  }
  if (dcsEl) {
    dcsEl.value = item[`dcs_${year}`] !== null && item[`dcs_${year}`] !== undefined ? item[`dcs_${year}`] : "";
  }
  if (aktifEl) {
    aktifEl.value =
      item[`peratus_aktif_${year}`] !== null && item[`peratus_aktif_${year}`] !== undefined
        ? item[`peratus_aktif_${year}`]
        : "";
  }

  const modal = document.getElementById("modalEditDcs");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

window.simpanDcs = async function () {
  if (dcsSaveBusy) {
    return;
  }

  const kodEl = document.getElementById("editKodSekolah");
  const selectEl = document.getElementById("pilihTahunAnalisa");
  const dcsEl = document.getElementById("editDcsVal");
  const aktifEl = document.getElementById("editAktifVal");

  const kod = kodEl ? kodEl.value : "";
  const year = selectEl ? selectEl.value : String(new Date().getFullYear());
  if (!kod) {
    return;
  }

  const dcsParsed = dcsEl && dcsEl.value !== "" ? parseFloat(dcsEl.value) : null;
  const aktifParsed = aktifEl && aktifEl.value !== "" ? parseFloat(aktifEl.value) : null;

  const payload = {};
  payload[`dcs_${year}`] = Number.isNaN(dcsParsed) ? null : dcsParsed;
  payload[`peratus_aktif_${year}`] = Number.isNaN(aktifParsed) ? null : aktifParsed;

  dcsSaveBusy = true;
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await DcsService.update(kod, payload);
    toggleLoading(false);

    const modal = document.getElementById("modalEditDcs");
    if (modal) {
      modal.classList.add("hidden");
    }

    await showAlert({
      icon: "success",
      title: "Disimpan",
      text: "Data telah dikemaskini.",
      timer: 1500,
      showConfirmButton: false,
      confirmButtonColor: "#22c55e"
    });
    await window.loadDcsAdmin();
  } catch {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat",
      text: "Gagal menyimpan data."
    });
  } finally {
    dcsSaveBusy = false;
  }
};

window.eksportDcs = function () {
  if (!currentFilteredDcs || currentFilteredDcs.length === 0) {
    showAlert({
      icon: "info",
      title: "Tiada Data",
      text: "Tiada rekod untuk dieksport."
    });
    return;
  }

  const selectEl = document.getElementById("pilihTahunAnalisa");
  const currYear = selectEl ? parseInt(selectEl.value, 10) : new Date().getFullYear();
  const prevYear = currYear - 1;
  let csvContent = `BIL,KOD,NAMA SEKOLAH,SKOR DCS ${currYear},SKOR DCS ${prevYear},AKTIF ${currYear}%,AKTIF ${prevYear}%\n`;

  currentFilteredDcs.forEach((d, index) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const valDcsCurr =
      d[`dcs_${currYear}`] !== null && d[`dcs_${currYear}`] !== undefined
        ? Number(d[`dcs_${currYear}`]).toFixed(2)
        : "0.00";
    const valDcsPrev =
      d[`dcs_${prevYear}`] !== null && d[`dcs_${prevYear}`] !== undefined
        ? Number(d[`dcs_${prevYear}`]).toFixed(2)
        : "0.00";
    const valActCurr = d[`peratus_aktif_${currYear}`] || "0";
    const valActPrev = d[`peratus_aktif_${prevYear}`] || "0";

    const row = [
      index + 1,
      clean(d.kod_sekolah),
      clean(d.nama_sekolah),
      valDcsCurr,
      valDcsPrev,
      valActCurr,
      valActPrev
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Analisa_DCS_${currYear}.csv`;
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