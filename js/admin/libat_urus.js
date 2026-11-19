import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { libatUrusService } from "../services/libat_urus.service.js";
import { toggleLoading } from "../core/helpers.js";

let allLibatUrusData = [];
let filteredLibatUrusData = [];
let realtimeSubscribed = false;

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

function sanitizeExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === "#") {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function extractDrivePreviewUrl(safeUrl) {
  if (!safeUrl) {
    return null;
  }
  try {
    const parsed = new URL(safeUrl);
    if (
      parsed.hostname !== "drive.google.com" &&
      parsed.hostname !== "docs.google.com"
    ) {
      return null;
    }
    const fileMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch && /^[a-zA-Z0-9_-]+$/.test(fileMatch[1])) {
      return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }
    return null;
  } catch {
    return null;
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

function downloadCsvFile(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }
}

function resolveScopedDaerahFilter() {
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const daerahWrapper = document.getElementById("luFilterDaerahWrapper");

  if (userRole === "SUPER_ADMIN" || userRole === "JPNMEL") {
    if (daerahWrapper) {
      daerahWrapper.classList.remove("hidden");
    }
    return null;
  }

  if (daerahWrapper) {
    daerahWrapper.classList.add("hidden");
  }

  if (["ADMIN", "PPD_UNIT"].includes(userRole) && userKod && APP_CONFIG.PPD_MAPPING) {
    return APP_CONFIG.PPD_MAPPING[userKod] || null;
  }

  return null;
}

async function silentRefreshLibatUrus() {
  if (!document.getElementById("luAdminGallery")) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();
    const daerahFilter = resolveScopedDaerahFilter();
    const rawData = await libatUrusService.getAllReports(daerahFilter);
    const currentYear = new Date().getFullYear();

    allLibatUrusData = (rawData || []).filter((item) => {
      if (!item || !item.tarikh_laksana) {
        return false;
      }
      return new Date(item.tarikh_laksana).getFullYear() === currentYear;
    });

    window.filterLibatUrus();
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_libat_urus",
    table: "smpid_libat_urus",
    primaryKey: "id",
    cacheStore: "query_cache",
    cachePrefix: "libat_urus",
    onChange: async () => {
      await silentRefreshLibatUrus();
    },
    onSync: async () => {
      await silentRefreshLibatUrus();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

window.loadAdminLibatUrus = async function () {
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();

    const daerahFilter = resolveScopedDaerahFilter();
    const rawData = await libatUrusService.getAllReports(daerahFilter);
    const currentYear = new Date().getFullYear();

    allLibatUrusData = (rawData || []).filter((item) => {
      if (!item || !item.tarikh_laksana) {
        return false;
      }
      const itemYear = new Date(item.tarikh_laksana).getFullYear();
      return itemYear === currentYear;
    });

    resetLibatUrusFilters();
    updateCrossFilters("ALL", "ALL", "ALL");
    window.filterLibatUrus();
    ensureRealtimeSync();
  } catch {
    showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: "Sistem tidak dapat memuat turun data libat urus. Sila semak sambungan internet atau hubungi pembangun."
    });
  } finally {
    toggleLoading(false);
  }
};

function resetLibatUrusFilters() {
  const fDaerah = document.getElementById("filterLuDaerah");
  const fSekolah = document.getElementById("filterLuSekolah");
  const fBulan = document.getElementById("filterLuBulan");

  if (fDaerah) {
    fDaerah.value = "ALL";
  }
  if (fSekolah) {
    fSekolah.value = "ALL";
  }
  if (fBulan) {
    fBulan.value = "ALL";
  }
}

function rebuildSelectOptions(selectEl, defaultLabel, items, activeValue) {
  if (!selectEl) {
    return;
  }
  clearElement(selectEl);
  const fragment = document.createDocumentFragment();

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "ALL";
  defaultOpt.textContent = defaultLabel;
  fragment.appendChild(defaultOpt);

  items.forEach((val) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    fragment.appendChild(opt);
  });

  selectEl.appendChild(fragment);
  selectEl.value = items.includes(activeValue) ? activeValue : "ALL";
}

function updateCrossFilters(activeDaerah, activeSekolah, activeBulan) {
  const filterDaerah = document.getElementById("filterLuDaerah");
  const filterSekolah = document.getElementById("filterLuSekolah");
  const filterBulan = document.getElementById("filterLuBulan");

  const validDaerahRecords = allLibatUrusData.filter((item) => {
    const matchSekolah =
      activeSekolah === "ALL" || (item.school && item.school.nama_sekolah === activeSekolah);
    const matchBulan = activeBulan === "ALL" || item.bulan === activeBulan;
    return matchSekolah && matchBulan;
  });
  const uniqueDaerah = [
    ...new Set(
      validDaerahRecords
        .map((item) => (item.school && item.school.daerah) || "")
        .filter((d) => d && d !== "N/A")
    )
  ].sort();

  const validSekolahRecords = allLibatUrusData.filter((item) => {
    const matchDaerah =
      activeDaerah === "ALL" ||
      Boolean(
        item.school &&
          item.school.daerah &&
          item.school.daerah.toUpperCase() === activeDaerah.toUpperCase()
      );
    const matchBulan = activeBulan === "ALL" || item.bulan === activeBulan;
    return matchDaerah && matchBulan;
  });
  const uniqueSekolah = [
    ...new Set(
      validSekolahRecords
        .map((item) => (item.school && item.school.nama_sekolah) || "")
        .filter((s) => s && s !== "TIDAK DIKETAHUI")
    )
  ].sort();

  const validBulanRecords = allLibatUrusData.filter((item) => {
    const matchDaerah =
      activeDaerah === "ALL" ||
      Boolean(
        item.school &&
          item.school.daerah &&
          item.school.daerah.toUpperCase() === activeDaerah.toUpperCase()
      );
    const matchSekolah =
      activeSekolah === "ALL" || (item.school && item.school.nama_sekolah === activeSekolah);
    return matchDaerah && matchSekolah;
  });
  const uniqueBulan = [
    ...new Set(validBulanRecords.map((item) => item.bulan || "").filter((b) => b && b !== "N/A"))
  ];

  const monthOrder = {
    JANUARI: 1,
    FEBRUARI: 2,
    MAC: 3,
    APRIL: 4,
    MEI: 5,
    JUN: 6,
    JULAI: 7,
    OGOS: 8,
    SEPTEMBER: 9,
    OKTOBER: 10,
    NOVEMBER: 11,
    DISEMBER: 12
  };
  uniqueBulan.sort((a, b) => (monthOrder[a] || 99) - (monthOrder[b] || 99));

  rebuildSelectOptions(filterDaerah, "SEMUA DAERAH", uniqueDaerah, activeDaerah);
  rebuildSelectOptions(filterSekolah, "SEMUA SEKOLAH", uniqueSekolah, activeSekolah);
  rebuildSelectOptions(filterBulan, "SEMUA BULAN", uniqueBulan, activeBulan);
}

window.filterLibatUrus = function () {
  const fDaerahEl = document.getElementById("filterLuDaerah");
  const fSekolahEl = document.getElementById("filterLuSekolah");
  const fBulanEl = document.getElementById("filterLuBulan");

  const fDaerah = fDaerahEl ? fDaerahEl.value : "ALL";
  const fSekolah = fSekolahEl ? fSekolahEl.value : "ALL";
  const fBulan = fBulanEl ? fBulanEl.value : "ALL";

  updateCrossFilters(fDaerah, fSekolah, fBulan);

  const validDaerah = fDaerahEl ? fDaerahEl.value : "ALL";
  const validSekolah = fSekolahEl ? fSekolahEl.value : "ALL";
  const validBulan = fBulanEl ? fBulanEl.value : "ALL";

  filteredLibatUrusData = allLibatUrusData.filter((item) => {
    let matchDaerah = true;
    let matchSekolah = true;
    let matchBulan = true;

    const schoolName = (item.school && item.school.nama_sekolah) || "";
    const schoolDaerah = (item.school && item.school.daerah) || "";

    if (validDaerah !== "ALL") {
      matchDaerah = schoolDaerah.toUpperCase() === validDaerah.toUpperCase();
    }
    if (validSekolah !== "ALL") {
      matchSekolah = schoolName === validSekolah;
    }
    if (validBulan !== "ALL") {
      matchBulan = item.bulan === validBulan;
    }

    return matchDaerah && matchSekolah && matchBulan;
  });

  processAndRender(filteredLibatUrusData);
};

function processAndRender(data) {
  calculateDashboardStats(data);
  renderLibatUrusGallery(data);
}

function calculateDashboardStats(data) {
  let sumGuru = 0;
  let sumMurid = 0;
  let sumIbuBapa = 0;
  let sumBersemuka = 0;
  let sumDalamTalian = 0;

  const monthFrequency = {};
  let topMonth = "-";
  let maxFrequency = 0;

  data.forEach((item) => {
    const cat = (item.kategori_sasar || "").toUpperCase();
    const pax = parseInt(item.jumlah_peserta, 10) || 0;
    const mod = (item.mod_pelaksanaan || "BERSEMUKA").toUpperCase();

    if (cat === "GURU") {
      sumGuru += pax;
    } else if (cat === "MURID") {
      sumMurid += pax;
    } else if (cat === "IBU-BAPA (PIBG & PIBKS)" || cat.includes("IBU")) {
      sumIbuBapa += pax;
    }

    if (mod === "DALAM TALIAN") {
      sumDalamTalian += pax;
    } else {
      sumBersemuka += pax;
    }

    if (item.bulan) {
      monthFrequency[item.bulan] = (monthFrequency[item.bulan] || 0) + 1;
      if (monthFrequency[item.bulan] > maxFrequency) {
        maxFrequency = monthFrequency[item.bulan];
        topMonth = item.bulan;
      }
    }
  });

  const statLuBulan = document.getElementById("statLuBulan");
  const statLuGuru = document.getElementById("statLuGuru");
  const statLuMurid = document.getElementById("statLuMurid");
  const statLuIbuBapa = document.getElementById("statLuIbuBapa");

  if (statLuBulan) {
    statLuBulan.textContent = topMonth;
  }
  if (statLuGuru) {
    statLuGuru.textContent = sumGuru.toLocaleString("ms-MY");
  }
  if (statLuMurid) {
    statLuMurid.textContent = sumMurid.toLocaleString("ms-MY");
  }
  if (statLuIbuBapa) {
    statLuIbuBapa.textContent = sumIbuBapa.toLocaleString("ms-MY");
  }

  const statLuBersemuka = document.getElementById("luKpiBersemuka");
  const statLuDalamTalian = document.getElementById("luKpiDalamTalian");

  if (statLuBersemuka) {
    statLuBersemuka.textContent = sumBersemuka.toLocaleString("ms-MY");
  }
  if (statLuDalamTalian) {
    statLuDalamTalian.textContent = sumDalamTalian.toLocaleString("ms-MY");
  }
}

function buildSummaryHeader(currentYear, uniqueSchoolsCount) {
  const headerDiv = document.createElement("div");
  headerDiv.className =
    "col-span-full flex flex-col md:flex-row md:items-end justify-between gap-4 pb-3 mb-2 border-b-2 border-slate-200/60 sticky top-0 z-30 bg-[#f8fafc]/95 backdrop-blur-md pt-4 -mt-4 rounded-b-xl px-1 shadow-[0_4px_6px_-6px_rgba(0,0,0,0.1)]";

  const titleWrap = document.createElement("div");
  const subP = document.createElement("p");
  subP.className = "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5";
  subP.setAttribute("aria-hidden", "true");
  subP.textContent = "Prestasi Tahun Semasa";

  const h3 = document.createElement("h3");
  h3.className = "text-2xl font-black text-slate-800 tracking-tighter leading-none";
  h3.textContent = `Laporan ${currentYear}`;

  titleWrap.appendChild(subP);
  titleWrap.appendChild(h3);

  const badgeCard = document.createElement("div");
  badgeCard.className =
    "bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3";

  const iconCircle = document.createElement("div");
  iconCircle.className =
    "w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0";
  iconCircle.appendChild(createIcon("fas fa-school text-sm"));

  const statCol = document.createElement("div");
  const countSpan = document.createElement("span");
  countSpan.className = "block text-xl font-black text-slate-800 leading-none";
  countSpan.textContent = String(uniqueSchoolsCount);

  const lblSpan = document.createElement("span");
  lblSpan.className = "text-[9px] font-bold text-slate-500 uppercase tracking-widest";
  lblSpan.textContent = "Jumlah Sekolah";

  statCol.appendChild(countSpan);
  statCol.appendChild(lblSpan);
  badgeCard.appendChild(iconCircle);
  badgeCard.appendChild(statCol);

  headerDiv.appendChild(titleWrap);
  headerDiv.appendChild(badgeCard);
  return headerDiv;
}

function buildLibatUrusCard(item) {
  const cat = (item.kategori_sasar || "").toUpperCase();
  const dateStr = item.tarikh_laksana
    ? new Date(item.tarikh_laksana).toLocaleDateString("ms-MY", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : "-";
  const schoolName =
    (item.school && item.school.nama_sekolah) || item.kod_sekolah || "-";
  const daerah = (item.school && item.school.daerah) || "N/A";

  const mod = (item.mod_pelaksanaan || "BERSEMUKA").toUpperCase();
  const isOnline = mod === "DALAM TALIAN";
  const modStyle = isOnline
    ? "text-purple-600 bg-purple-50 border-purple-100"
    : "text-teal-600 bg-teal-50 border-teal-100";
  const modIcon = isOnline ? "fa-video" : "fa-users";

  let catStyle = "text-slate-600 bg-slate-50 border-slate-100";
  let catIcon = "fa-users";

  if (cat === "GURU") {
    catStyle = "text-blue-600 bg-blue-50 border-blue-100";
    catIcon = "fa-chalkboard-teacher";
  } else if (cat === "MURID") {
    catStyle = "text-cyan-600 bg-cyan-50 border-cyan-100";
    catIcon = "fa-user-graduate";
  } else if (cat.includes("IBU")) {
    catStyle = "text-emerald-600 bg-emerald-50 border-emerald-100";
    catIcon = "fa-people-arrows";
  }

  const card = document.createElement("div");
  card.className =
    "group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-orange-300 transition-all duration-300 flex flex-col overflow-hidden relative transform hover:-translate-y-1 min-w-0";

  const safeUrl = sanitizeExternalUrl(item.pautan_fail);
  const previewUrl = extractDrivePreviewUrl(safeUrl);

  if (previewUrl) {
    const previewWrap = document.createElement("div");
    previewWrap.className =
      "h-28 w-full overflow-hidden bg-slate-100 relative group-hover:opacity-90 transition-opacity";

    const iframe = document.createElement("iframe");
    iframe.src = previewUrl;
    iframe.title = `Prapapar Laporan ${schoolName}`;
    iframe.className =
      "w-full h-48 -mt-10 pointer-events-none border-0 transform scale-[1.02]";
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.loading = "lazy";

    const overlay = document.createElement("div");
    overlay.className =
      "absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent";

    previewWrap.appendChild(iframe);
    previewWrap.appendChild(overlay);
    card.appendChild(previewWrap);
  } else {
    const placeholderWrap = document.createElement("div");
    placeholderWrap.className =
      "h-28 w-full bg-slate-50 flex items-center justify-center border-b border-slate-100";
    placeholderWrap.appendChild(createIcon("fas fa-file-alt text-3xl text-slate-200"));
    card.appendChild(placeholderWrap);
  }

  const bodyDiv = document.createElement("div");
  bodyDiv.className = "p-3.5 flex-grow flex flex-col min-w-0";

  const topMeta = document.createElement("div");
  topMeta.className = "flex justify-between items-start gap-1.5 mb-3";

  const badgesFlex = document.createElement("div");
  badgesFlex.className = "flex flex-wrap gap-1.5 min-w-0";

  const catBadge = document.createElement("span");
  catBadge.className = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${catStyle}`;
  catBadge.setAttribute("aria-label", `Kategori: ${cat}`);
  catBadge.appendChild(createIcon(`fas ${catIcon}`));
  catBadge.appendChild(document.createTextNode(` ${cat || "-"}`));

  const modBadge = document.createElement("span");
  modBadge.className = `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${modStyle}`;
  modBadge.setAttribute("aria-label", `Mod: ${mod}`);
  modBadge.appendChild(createIcon(`fas ${modIcon}`));
  modBadge.appendChild(document.createTextNode(` ${mod}`));

  badgesFlex.appendChild(catBadge);
  badgesFlex.appendChild(modBadge);

  const daerahBadge = document.createElement("span");
  daerahBadge.className =
    "text-[8px] font-bold text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0";
  daerahBadge.setAttribute("aria-label", `Daerah: ${daerah}`);
  daerahBadge.textContent = daerah;

  topMeta.appendChild(badgesFlex);
  topMeta.appendChild(daerahBadge);
  bodyDiv.appendChild(topMeta);

  const schoolH4 = document.createElement("h4");
  schoolH4.className =
    "font-bold text-slate-900 text-xs mb-1 leading-tight line-clamp-2 uppercase group-hover:text-orange-600 transition-colors break-words";
  schoolH4.title = schoolName;
  schoolH4.textContent = schoolName;
  bodyDiv.appendChild(schoolH4);

  const kodP = document.createElement("p");
  kodP.className = "text-[9px] font-mono font-bold text-slate-400 mb-3";
  kodP.appendChild(createIcon("fas fa-fingerprint mr-1"));
  kodP.appendChild(document.createTextNode(` ${item.kod_sekolah || "-"}`));
  bodyDiv.appendChild(kodP);

  const infoGrid = document.createElement("div");
  infoGrid.className = "mt-auto grid grid-cols-[1fr_auto] gap-2 mb-3";

  const placeBox = document.createElement("div");
  placeBox.className =
    "bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col justify-center min-w-0";

  const placeLbl = document.createElement("span");
  placeLbl.className =
    "block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5";
  placeLbl.textContent = "Tarikh/Tempat";

  const placeVal = document.createElement("span");
  placeVal.className = "block text-[9px] font-bold text-slate-700 truncate";
  placeVal.title = item.tempat || "";
  placeVal.textContent = item.tempat || "-";

  const dateVal = document.createElement("span");
  dateVal.className = "block text-[9px] font-semibold text-orange-600 mt-0.5";
  dateVal.textContent = dateStr;

  placeBox.appendChild(placeLbl);
  placeBox.appendChild(placeVal);
  placeBox.appendChild(dateVal);

  const paxBox = document.createElement("div");
  paxBox.className =
    "bg-orange-50 p-2 px-3 rounded-xl border border-orange-100 flex flex-col justify-center items-center text-center";

  const paxLbl = document.createElement("span");
  paxLbl.className =
    "block text-[8px] font-bold text-orange-400 uppercase tracking-widest mb-0.5";
  paxLbl.textContent = "Peserta";

  const paxVal = document.createElement("span");
  paxVal.className = "block text-lg font-black text-orange-600 leading-none";
  paxVal.textContent = String(item.jumlah_peserta || 0);

  paxBox.appendChild(paxLbl);
  paxBox.appendChild(paxVal);

  infoGrid.appendChild(placeBox);
  infoGrid.appendChild(paxBox);
  bodyDiv.appendChild(infoGrid);

  if (safeUrl) {
    const actionLink = document.createElement("a");
    actionLink.href = safeUrl;
    actionLink.target = "_blank";
    actionLink.rel = "noopener noreferrer";
    actionLink.className =
      "w-full min-h-[44px] py-2.5 rounded-lg bg-slate-900 hover:bg-orange-600 text-white text-[10px] font-bold transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm";
    actionLink.setAttribute("aria-label", `Lihat laporan penuh untuk ${schoolName}`);
    actionLink.appendChild(createIcon("fas fa-external-link-alt text-[9px]"));
    actionLink.appendChild(document.createTextNode(" Buka Laporan"));
    bodyDiv.appendChild(actionLink);
  } else {
    const disabledBadge = document.createElement("span");
    disabledBadge.className =
      "w-full min-h-[44px] py-2.5 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center justify-center gap-1.5 border border-slate-200 cursor-not-allowed";
    disabledBadge.textContent = "Tiada Pautan Sah";
    bodyDiv.appendChild(disabledBadge);
  }

  card.appendChild(bodyDiv);
  return card;
}

function renderLibatUrusGallery(data) {
  const galleryContainer = document.getElementById("luAdminGallery");
  const emptyState = document.getElementById("luEmptyState");

  if (!galleryContainer || !emptyState) {
    return;
  }

  clearElement(galleryContainer);

  if (data.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  galleryContainer.className =
    "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-10 relative";

  const uniqueSchoolsCount = new Set(data.map((item) => item.kod_sekolah)).size;
  const currentYear = new Date().getFullYear();

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayData = data.slice(0, limit);
  const fragment = document.createDocumentFragment();

  fragment.appendChild(buildSummaryHeader(currentYear, uniqueSchoolsCount));

  displayData.forEach((item) => {
    fragment.appendChild(buildLibatUrusCard(item));
  });

  if (data.length > limit) {
    const noticeDiv = document.createElement("div");
    noticeDiv.className =
      "col-span-full p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center px-6 gap-3 mt-4 shadow-sm";

    const leftSpan = document.createElement("span");
    leftSpan.className = "text-xs font-bold text-amber-800 flex items-center gap-2";
    leftSpan.appendChild(createIcon("fas fa-info-circle text-amber-500 text-sm"));
    leftSpan.appendChild(document.createTextNode("Memaparkan "));
    const bLimit = document.createElement("strong");
    bLimit.textContent = String(limit);
    leftSpan.appendChild(bLimit);
    leftSpan.appendChild(document.createTextNode(" daripada "));
    const bTotal = document.createElement("strong");
    bTotal.textContent = String(data.length);
    leftSpan.appendChild(bTotal);
    leftSpan.appendChild(
      document.createTextNode(
        " laporan libat urus terkini bagi menjamin kelancaran sistem. Gunakan tapisan untuk melihat laporan spesifik."
      )
    );

    const rightSpan = document.createElement("span");
    rightSpan.className =
      "text-[10px] font-black text-amber-700 uppercase bg-amber-100 px-3 py-1 rounded-full border border-amber-300";
    rightSpan.textContent = `Eksport CSV Menyimpan 100% Data (${data.length} Laporan)`;

    noticeDiv.appendChild(leftSpan);
    noticeDiv.appendChild(rightSpan);
    fragment.appendChild(noticeDiv);
  }

  galleryContainer.appendChild(fragment);
}

window.eksportLibatUrusCSV = function () {
  if (!filteredLibatUrusData || filteredLibatUrusData.length === 0) {
    showAlert({
      icon: "warning",
      title: "Tiada Data",
      text: "Sila pastikan jadual mempunyai data sebelum muat turun."
    });
    return;
  }

  let csvContent =
    "ID_REKOD,KOD_SEKOLAH,NAMA_SEKOLAH,DAERAH,KATEGORI_SASAR,MOD_PELAKSANAAN,TARIKH_LAKSANA,BULAN,TEMPAT,JUMLAH_PESERTA,PAUTAN_FAIL\r\n";

  filteredLibatUrusData.forEach((item) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const row = [
      item.id || "",
      item.kod_sekolah || "",
      clean(item.school && item.school.nama_sekolah),
      (item.school && item.school.daerah) || "",
      clean(item.kategori_sasar),
      clean(item.mod_pelaksanaan || "BERSEMUKA"),
      item.tarikh_laksana || "",
      item.bulan || "",
      clean(item.tempat),
      item.jumlah_peserta || 0,
      clean(item.pautan_fail)
    ].join(",");
    csvContent += row + "\r\n";
  });

  const fDaerahEl = document.getElementById("filterLuDaerah");
  const fBulanEl = document.getElementById("filterLuBulan");
  const fDaerah = fDaerahEl ? fDaerahEl.value : "SEMUA_DAERAH";
  const fBulan = fBulanEl ? fBulanEl.value : "SEMUA_BULAN";
  const dateMark = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  downloadCsvFile(`LAPORAN_LIBAT_URUS_${fDaerah}_${fBulan}_${dateMark}.csv`, csvContent);
};

window.eksportStatusLibatUrusCSV = function () {
  if (!Array.isArray(window.globalDashboardData) || window.globalDashboardData.length === 0) {
    showAlert({
      icon: "error",
      title: "Ralat Data",
      text: "Sistem belum bersedia atau data sekolah tidak wujud."
    });
    return;
  }

  const currentYear = new Date().getFullYear();
  const fDaerahEl = document.getElementById("filterLuDaerah");
  const fBulanEl = document.getElementById("filterLuBulan");
  const fDaerah = fDaerahEl ? fDaerahEl.value : "ALL";
  const fBulan = fBulanEl ? fBulanEl.value : "ALL";

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  let baseSchoolData = window.globalDashboardData.filter(
    (s) => !senaraiKodPPD.includes(s.kod_sekolah)
  );

  if (fDaerah !== "ALL") {
    baseSchoolData = baseSchoolData.filter(
      (s) => (s.daerah || "").toUpperCase() === fDaerah.toUpperCase()
    );
  }

  const submittedCodes = new Set(filteredLibatUrusData.map((item) => item.kod_sekolah));

  let csvContent =
    "BIL,KOD_SEKOLAH,NAMA_SEKOLAH,DAERAH,TAHUN_LAKSANA,BULAN,STATUS_PENGISIAN\r\n";

  baseSchoolData.forEach((school, index) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const isSubmitted = submittedCodes.has(school.kod_sekolah);
    const statusPengisian = isSubmitted ? "SUDAH HANTAR" : "BELUM HANTAR";
    const displayBulan = fBulan === "ALL" ? "KESELURUHAN TAHUN" : fBulan;

    const row = [
      index + 1,
      school.kod_sekolah || "",
      clean(school.nama_sekolah),
      school.daerah || "",
      currentYear,
      displayBulan,
      statusPengisian
    ].join(",");

    csvContent += row + "\r\n";
  });

  const dateMark = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeBulanName = fBulan === "ALL" ? "SEMUA_BULAN" : fBulan;
  const safeDaerahName = fDaerah === "ALL" ? "SEMUA_DAERAH" : fDaerah;

  downloadCsvFile(
    `STATUS_PENGISIAN_LU_${safeDaerahName}_${safeBulanName}_${dateMark}.csv`,
    csvContent
  );
};