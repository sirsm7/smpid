import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { AchievementService } from "../services/achievement.service.js";

let adminGalleryData = [];
let gallerySchoolListCache = [];
let searchDebounceTimer = null;
let currentGalleryJawatanFilter = "ALL";
let currentGalleryCategoryFilter = "ALL";
let currentGalleryKod = "";
let realtimeSubscribed = false;
let initRetryCount = 0;

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

function getPpdCodeList() {
  return APP_CONFIG && APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
}

function getPpdDisplayName(kod) {
  return APP_CONFIG && APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[kod]
    ? APP_CONFIG.PPD_MAPPING[kod]
    : "PEJABAT PENDIDIKAN DAERAH";
}

async function silentRefreshGallery() {
  if (!currentGalleryKod || !document.getElementById("adminGalleryGrid")) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();
    const data = await AchievementService.getBySchool(currentGalleryKod);
    adminGalleryData = Array.isArray(data) ? data : [];
    renderFilterPills(adminGalleryData, currentGalleryCategoryFilter);
    if (currentGalleryCategoryFilter === "GURU") {
      generateJawatanCloud();
    }
    renderAdminCards(currentGalleryCategoryFilter);
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_gallery_pencapaian",
    table: "smpid_pencapaian",
    primaryKey: "id",
    cacheStore:
      APP_CONFIG.IDB && APP_CONFIG.IDB.STORES
        ? APP_CONFIG.IDB.STORES.ACHIEVEMENTS
        : "achievements_cache",
    cachePrefix: "achievements",
    onChange: async () => {
      await silentRefreshGallery();
    },
    onSync: async () => {
      await silentRefreshGallery();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

window.initAdminGallery = function () {
  currentGalleryJawatanFilter = "ALL";
  currentGalleryCategoryFilter = "ALL";

  if (Array.isArray(window.globalDashboardData) && window.globalDashboardData.length > 0) {
    initRetryCount = 0;
    populateGallerySchoolList();
    return;
  }

  if (initRetryCount < 10) {
    initRetryCount += 1;
    setTimeout(() => {
      if (Array.isArray(window.globalDashboardData) && window.globalDashboardData.length > 0) {
        initRetryCount = 0;
        populateGallerySchoolList();
      } else {
        window.initAdminGallery();
      }
    }, 600);
  }
};

function populateGallerySchoolList() {
  const select = document.getElementById("gallerySchoolSelector");
  if (!select) {
    return;
  }

  const senaraiKodPPD = getPpdCodeList();
  const allRows = Array.isArray(window.globalDashboardData) ? window.globalDashboardData : [];
  gallerySchoolListCache = allRows.filter((s) => !senaraiKodPPD.includes(s.kod_sekolah));
  renderGalleryDropdown("");

  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "M030";
  window.loadAdminGalleryGrid(userKod);
}

function renderGalleryDropdown(filterText = "") {
  const select = document.getElementById("gallerySchoolSelector");
  if (!select) {
    return;
  }

  const currentValue = select.value;
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "M030";
  const namaPpd = getPpdDisplayName(userKod);

  clearElement(select);
  const fragment = document.createDocumentFragment();

  const defaultOpt = document.createElement("option");
  defaultOpt.value = userKod;
  defaultOpt.textContent = `PPD ${namaPpd} (${userKod})`;
  fragment.appendChild(defaultOpt);

  const query = String(filterText || "").toUpperCase().trim();
  const listToRender = query
    ? gallerySchoolListCache.filter(
        (s) =>
          (s.nama_sekolah && s.nama_sekolah.toUpperCase().includes(query)) ||
          (s.kod_sekolah && s.kod_sekolah.toUpperCase().includes(query))
      )
    : gallerySchoolListCache;

  listToRender.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.kod_sekolah;
    opt.textContent = s.nama_sekolah || s.kod_sekolah;
    fragment.appendChild(opt);
  });

  select.appendChild(fragment);

  const exists = Array.from(select.options).some((o) => o.value === currentValue);
  if (exists && currentValue) {
    select.value = currentValue;
  }
}

window.handleGallerySchoolSearch = function (val) {
  renderGalleryDropdown(val);
  const select = document.getElementById("gallerySchoolSelector");
  const selectedKod = select ? select.value : "";

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    if (selectedKod) {
      window.loadAdminGalleryGrid(selectedKod);
    }
  }, 500);
};

window.resetGallery = function () {
  const select = document.getElementById("gallerySchoolSelector");
  const searchInput = document.getElementById("gallerySearchInput");
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "M030";

  if (select) {
    clearTimeout(searchDebounceTimer);
    if (searchInput) {
      searchInput.value = "";
    }
    renderGalleryDropdown("");
    select.value = userKod;
    window.loadAdminGalleryGrid(userKod);
  }
};

function renderFilterPills(data, activeType) {
  const filterContainer = document.getElementById("galleryFilterContainer");
  if (!filterContainer) {
    return;
  }

  clearElement(filterContainer);
  const fragment = document.createDocumentFragment();

  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className =
    activeType === "ALL"
      ? "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition-all transform scale-105"
      : "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm";
  allBtn.textContent = "SEMUA";
  allBtn.addEventListener("click", () => {
    window.filterAdminGallery("ALL", allBtn);
  });
  fragment.appendChild(allBtn);

  const categories = [...new Set((data || []).map((item) => item.kategori))]
    .filter(Boolean)
    .sort();

  categories.forEach((cat) => {
    const isSelected = activeType === cat;
    let colorClass = "text-slate-500 hover:text-slate-800 hover:bg-slate-50";
    if (cat === "MURID") {
      colorClass = "text-blue-600 hover:bg-blue-50";
    } else if (cat === "GURU") {
      colorClass = "text-amber-600 hover:bg-amber-50";
    } else if (cat === "SEKOLAH") {
      colorClass = "text-green-600 hover:bg-green-50";
    }

    const catBtn = document.createElement("button");
    catBtn.type = "button";
    catBtn.className = isSelected
      ? "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition-all transform scale-105 ml-2"
      : `min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 transition-all shadow-sm ml-2 ${colorClass}`;
    catBtn.textContent = cat;
    catBtn.addEventListener("click", () => {
      window.filterAdminGallery(cat, catBtn);
    });
    fragment.appendChild(catBtn);
  });

  filterContainer.appendChild(fragment);
}

window.loadAdminGalleryGrid = async function (kod) {
  const grid = document.getElementById("adminGalleryGrid");
  const filterContainer = document.getElementById("galleryFilterContainer");
  const counterEl = document.getElementById("galleryTotalCount");
  const cloudWrapper = document.getElementById("galleryCloudWrapper");

  if (!grid) {
    return;
  }

  currentGalleryKod = kod;
  updateGalleryHeader(kod);

  clearElement(grid);
  const loadingWrap = document.createElement("div");
  loadingWrap.className = "col-span-full text-center py-16 text-slate-400 font-medium";
  const innerFlex = document.createElement("div");
  innerFlex.className = "flex flex-col items-center gap-3";
  innerFlex.appendChild(createIcon("fas fa-circle-notch fa-spin fa-2x text-indigo-500"));
  const loadingText = document.createElement("p");
  loadingText.className = "animate-pulse";
  loadingText.textContent = "Menyusun Galeri...";
  innerFlex.appendChild(loadingText);
  loadingWrap.appendChild(innerFlex);
  grid.appendChild(loadingWrap);

  if (counterEl) {
    counterEl.textContent = "0";
  }
  if (filterContainer) {
    clearElement(filterContainer);
  }

  currentGalleryJawatanFilter = "ALL";
  currentGalleryCategoryFilter = "ALL";
  if (cloudWrapper) {
    cloudWrapper.classList.add("hidden");
  }

  try {
    await envReady;
    await initDatabaseClient();
    const data = await AchievementService.getBySchool(kod);
    adminGalleryData = Array.isArray(data) ? data : [];

    renderFilterPills(adminGalleryData, "ALL");
    renderAdminCards("ALL");
    ensureRealtimeSync();
  } catch {
    clearElement(grid);
    const errDiv = document.createElement("div");
    errDiv.className = "col-span-full text-center text-red-500 font-bold py-10";
    errDiv.textContent = "Ralat memproses data galeri.";
    grid.appendChild(errDiv);
  }
};

function updateGalleryHeader(kod) {
  const lblTitle = document.getElementById("galleryHeaderTitle");
  const lblSub = document.getElementById("galleryHeaderSubtitle");
  const senaraiKodPPD = getPpdCodeList();

  if (senaraiKodPPD.includes(kod)) {
    const namaPpd = getPpdDisplayName(kod);
    if (lblTitle) {
      lblTitle.textContent = `PPD ${namaPpd}`;
    }
    if (lblSub) {
      clearElement(lblSub);
      const badge = document.createElement("span");
      badge.className =
        "inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-black mr-2";
      badge.textContent = kod;
      lblSub.appendChild(badge);
      lblSub.appendChild(document.createTextNode("UNIT SUMBER TEKNOLOGI PENDIDIKAN"));
    }
  } else {
    let nama = kod;
    if (Array.isArray(window.globalDashboardData)) {
      const s = window.globalDashboardData.find((x) => x.kod_sekolah === kod);
      if (s && s.nama_sekolah) {
        nama = s.nama_sekolah;
      }
    }
    if (lblTitle) {
      lblTitle.textContent = nama;
    }
    if (lblSub) {
      clearElement(lblSub);
      const badge = document.createElement("span");
      badge.className =
        "inline-block bg-brand-100 text-brand-700 px-2 py-0.5 rounded text-[10px] font-black mr-2";
      badge.textContent = kod;
      lblSub.appendChild(badge);
      lblSub.appendChild(document.createTextNode("GALERI PENCAPAIAN SEKOLAH"));
    }
  }
}

window.filterAdminGallery = function (type, btn) {
  currentGalleryCategoryFilter = type || "ALL";

  if (btn) {
    const btns = document.querySelectorAll("#galleryFilterContainer button");
    btns.forEach((b, idx) => {
      b.className =
        idx === 0
          ? "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm"
          : "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all shadow-sm ml-2";
    });
    const isFirst = btn === btns[0];
    btn.className = isFirst
      ? "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition-all transform scale-105"
      : "min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-white shadow-md transition-all transform scale-105 ml-2";
  }

  const cloudWrapper = document.getElementById("galleryCloudWrapper");
  if (type === "GURU") {
    if (cloudWrapper) {
      cloudWrapper.classList.remove("hidden");
      generateJawatanCloud();
    }
  } else {
    if (cloudWrapper) {
      cloudWrapper.classList.add("hidden");
    }
    currentGalleryJawatanFilter = "ALL";
  }

  renderAdminCards(type);
};

function generateJawatanCloud() {
  const container = document.getElementById("galleryCloudContainer");
  if (!container) {
    return;
  }

  const guruData = adminGalleryData.filter((item) => item.kategori === "GURU" && item.jawatan);

  clearElement(container);
  if (guruData.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.className = "text-xs text-slate-400 italic py-2";
    emptyP.textContent = "Tiada data jawatan direkodkan untuk sekolah ini.";
    container.appendChild(emptyP);
    return;
  }

  const counts = {};
  guruData.forEach((item) => {
    const j = item.jawatan.trim();
    if (j) {
      counts[j] = (counts[j] || 0) + 1;
    }
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const fragment = document.createDocumentFragment();

  entries.forEach(([jawatan, count]) => {
    const isActive = jawatan === currentGalleryJawatanFilter;
    let sizeStyle = "text-[10px]";
    if (count > 2) {
      sizeStyle = "text-[11px] font-bold";
    }
    if (count > 5) {
      sizeStyle = "text-[12px] font-black";
    }

    const chip = document.createElement("div");
    chip.className = `min-h-[36px] inline-flex items-center px-3 py-1 rounded-full border cursor-pointer transition-all m-1 shadow-sm ${
      isActive
        ? "bg-indigo-600 text-white border-indigo-600"
        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
    }`;
    chip.addEventListener("click", () => {
      window.filterGalleryByJawatan(jawatan);
    });

    const labelSpan = document.createElement("span");
    labelSpan.className = sizeStyle;
    labelSpan.textContent = jawatan;

    const countSpan = document.createElement("span");
    countSpan.className = `ml-2 px-1.5 rounded-full text-[9px] font-bold ${
      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
    }`;
    countSpan.textContent = String(count);

    chip.appendChild(labelSpan);
    chip.appendChild(countSpan);
    fragment.appendChild(chip);
  });

  container.appendChild(fragment);
}

window.filterGalleryByJawatan = function (jawatan) {
  currentGalleryJawatanFilter =
    jawatan === "ALL" || currentGalleryJawatanFilter === jawatan ? "ALL" : jawatan;

  const btnReset = document.getElementById("btnResetGalleryCloud");
  if (btnReset) {
    if (currentGalleryJawatanFilter !== "ALL") {
      btnReset.classList.remove("hidden");
    } else {
      btnReset.classList.add("hidden");
    }
  }

  generateJawatanCloud();
  renderAdminCards("GURU");
};

function renderAdminCards(filterType) {
  const grid = document.getElementById("adminGalleryGrid");
  const counterEl = document.getElementById("galleryTotalCount");
  if (!grid) {
    return;
  }

  clearElement(grid);

  let filtered =
    filterType === "ALL"
      ? adminGalleryData
      : adminGalleryData.filter((item) => item.kategori === filterType);

  if (filterType === "GURU" && currentGalleryJawatanFilter !== "ALL") {
    filtered = filtered.filter((item) => item.jawatan === currentGalleryJawatanFilter);
  }

  if (counterEl) {
    counterEl.textContent = String(filtered.length);
  }

  if (filtered.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className =
      "col-span-full text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200";
    emptyBox.appendChild(createIcon("fas fa-folder-open text-4xl text-slate-200 mb-3"));
    const emptyText = document.createElement("p");
    emptyText.className = "text-slate-400 font-medium italic";
    emptyText.textContent = "Tiada rekod untuk paparan ini.";
    emptyBox.appendChild(emptyText);
    grid.appendChild(emptyBox);
    return;
  }

  const uniqueYears = [...new Set(filtered.map((item) => item.tahun))].sort((a, b) => b - a);
  const fragment = document.createDocumentFragment();

  uniqueYears.forEach((year) => {
    const yearHeader = document.createElement("div");
    yearHeader.className = "col-span-full flex items-center gap-4 mt-6 mb-2";

    const yearBadge = document.createElement("span");
    yearBadge.className =
      "bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black border border-indigo-100 shadow-sm";
    yearBadge.appendChild(createIcon("fas fa-calendar-alt mr-2"));
    yearBadge.appendChild(document.createTextNode(`TAHUN ${year || "-"}`));

    const divider = document.createElement("div");
    divider.className = "h-px bg-slate-200 flex-grow";

    yearHeader.appendChild(yearBadge);
    yearHeader.appendChild(divider);
    fragment.appendChild(yearHeader);

    const itemsInYear = filtered.filter((item) => item.tahun === year);
    itemsInYear.forEach((item) => {
      fragment.appendChild(createAdminCardElement(item));
    });
  });

  grid.appendChild(fragment);
}

function createAdminCardElement(item) {
  const rawLink = item.pautan_bukti || "";
  const safeUrl = sanitizeExternalUrl(rawLink);
  let iconType = "fa-globe";

  let borderClass = "border-t-4 border-slate-300";
  let textClass = "text-slate-600";
  let dotClass = "bg-slate-600";

  if (item.kategori === "MURID") {
    borderClass = "border-t-4 border-blue-500";
    textClass = "text-blue-600";
    dotClass = "bg-blue-600";
  } else if (item.kategori === "GURU") {
    borderClass = "border-t-4 border-amber-500";
    textClass = "text-amber-600";
    dotClass = "bg-amber-600";
  } else if (item.kategori === "SEKOLAH") {
    borderClass = "border-t-4 border-green-500";
    textClass = "text-green-600";
    dotClass = "bg-green-600";
  } else if (item.kategori === "PPD" || item.kategori === "PEGAWAI") {
    borderClass = "border-t-4 border-indigo-500";
    textClass = "text-indigo-600";
    dotClass = "bg-indigo-600";
  }

  const card = document.createElement("div");
  card.className = `bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col h-full ${borderClass} ${
    safeUrl ? "cursor-pointer" : "cursor-default"
  }`;

  if (safeUrl) {
    card.addEventListener("click", () => {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    });
  }

  const fileIdMatch = rawLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const folderMatch = rawLink.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const youtubeMatch = rawLink.match(
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
  );

  if (folderMatch) {
    iconType = "fa-folder-open";
    const thumbBox = document.createElement("div");
    thumbBox.className =
      "aspect-video bg-slate-100 flex items-center justify-center text-amber-400 text-5xl";
    thumbBox.appendChild(createIcon("fas fa-folder-open"));
    card.appendChild(thumbBox);
  } else if (fileIdMatch && /^[a-zA-Z0-9_-]+$/.test(fileIdMatch[1])) {
    iconType = "fa-image";
    const thumbBox = document.createElement("div");
    thumbBox.className = "aspect-video bg-slate-100 overflow-hidden relative";

    const img = document.createElement("img");
    img.src = `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}=s400`;
    img.alt = item.nama_pertandingan || "Bukti Pencapaian";
    img.loading = "lazy";
    img.className = "w-full h-full object-cover transform hover:scale-110 transition duration-700";
    img.addEventListener("error", () => {
      clearElement(thumbBox);
      thumbBox.className =
        "aspect-video bg-slate-100 flex items-center justify-center text-slate-300 text-3xl";
      thumbBox.appendChild(createIcon("fas fa-image-slash"));
    });

    thumbBox.appendChild(img);
    card.appendChild(thumbBox);
  } else if (youtubeMatch && /^[a-zA-Z0-9_-]{11}$/.test(youtubeMatch[1])) {
    iconType = "fa-play";
    const thumbBox = document.createElement("div");
    thumbBox.className = "aspect-video bg-black overflow-hidden relative group";

    const img = document.createElement("img");
    img.src = `https://img.youtube.com/vi/${youtubeMatch[1]}/mqdefault.jpg`;
    img.alt = item.nama_pertandingan || "Video Bukti";
    img.loading = "lazy";
    img.className =
      "w-full h-full object-cover opacity-80 group-hover:opacity-100 transition duration-500";
    img.addEventListener("error", () => {
      clearElement(thumbBox);
      thumbBox.className =
        "aspect-video bg-slate-900 flex items-center justify-center text-slate-500 text-3xl";
      thumbBox.appendChild(createIcon("fas fa-video-slash"));
    });

    const overlay = document.createElement("div");
    overlay.className = "absolute inset-0 flex items-center justify-center";
    overlay.appendChild(
      createIcon(
        "fas fa-play-circle text-white/90 text-4xl shadow-2xl group-hover:scale-125 transition duration-300"
      )
    );

    thumbBox.appendChild(img);
    thumbBox.appendChild(overlay);
    card.appendChild(thumbBox);
  } else {
    iconType = "fa-globe";
    const thumbBox = document.createElement("div");
    thumbBox.className =
      "aspect-video bg-slate-50 flex items-center justify-center text-slate-300 text-3xl";
    thumbBox.appendChild(createIcon("fas fa-globe-asia"));
    card.appendChild(thumbBox);
  }

  const bodyDiv = document.createElement("div");
  bodyDiv.className = "p-4 flex flex-col flex-grow relative min-w-0";

  const typeBadge = document.createElement("span");
  typeBadge.className =
    "absolute top-[-12px] right-3 bg-white p-1 rounded-full shadow-sm text-slate-400 text-[10px] w-6 h-6 flex items-center justify-center border border-slate-100";
  typeBadge.appendChild(createIcon(`fas ${iconType}`));
  bodyDiv.appendChild(typeBadge);

  const catRow = document.createElement("div");
  catRow.className = "flex items-center gap-1.5 mb-2";
  const dot = document.createElement("div");
  dot.className = `w-2 h-2 rounded-full ${dotClass}`;
  const catLabel = document.createElement("span");
  catLabel.className = `text-[10px] font-black uppercase tracking-wider ${textClass}`;
  catLabel.textContent = item.kategori || "-";
  catRow.appendChild(dot);
  catRow.appendChild(catLabel);
  bodyDiv.appendChild(catRow);

  const titleEl = document.createElement("h6");
  titleEl.className =
    "font-bold text-slate-800 text-xs leading-snug mb-1 whitespace-normal break-words";
  titleEl.title = item.nama_pertandingan || "";
  titleEl.textContent = item.nama_pertandingan || "-";
  bodyDiv.appendChild(titleEl);

  const participantEl = document.createElement("p");
  participantEl.className =
    "text-[10px] text-slate-400 font-bold mb-3 whitespace-normal break-words";
  participantEl.textContent = item.nama_peserta || "-";
  bodyDiv.appendChild(participantEl);

  const footerDiv = document.createElement("div");
  footerDiv.className =
    "mt-auto pt-3 border-t border-slate-50 flex justify-between items-center gap-2";

  const resultBadge = document.createElement("span");
  resultBadge.className = `text-[10px] font-black ${textClass} bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase whitespace-normal break-words`;
  resultBadge.textContent = item.pencapaian || "-";

  footerDiv.appendChild(resultBadge);
  if (safeUrl) {
    footerDiv.appendChild(createIcon("fas fa-external-link-alt text-slate-300 text-[9px] shrink-0"));
  }

  bodyDiv.appendChild(footerDiv);
  card.appendChild(bodyDiv);

  return card;
}