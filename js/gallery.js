import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient } from "./core/db.js";
import { RealtimeManager } from "./core/realtime.js";
import { AchievementService } from "./services/achievement.service.js";
import { SchoolService } from "./services/school.service.js";

let allGalleryData = [];
let currentJawatanFilter = "ALL";
let currentCategoryFilter = "SEMUA";
let currentKodSekolah = "";
let isPPDMode = false;
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

function filterCategoryScope(data) {
  const list = Array.isArray(data) ? data : [];
  if (isPPDMode) {
    return list.filter((item) => ["PEGAWAI", "PPD"].includes(item.kategori));
  }
  return list.filter((item) => ["MURID", "GURU", "SEKOLAH"].includes(item.kategori));
}

async function silentRefreshPublicGallery() {
  if (!currentKodSekolah || !document.getElementById("galleryGrid")) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();
    const data = await AchievementService.getBySchool(currentKodSekolah);
    allGalleryData = filterCategoryScope(data);
    updateStats(allGalleryData);
    if (currentCategoryFilter === "GURU" && !isPPDMode) {
      generateJawatanCloud();
    }
    window.renderGallery(currentCategoryFilter);
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "public_gallery_pencapaian",
    table: "smpid_pencapaian",
    primaryKey: "id",
    cacheStore:
      APP_CONFIG.IDB && APP_CONFIG.IDB.STORES
        ? APP_CONFIG.IDB.STORES.ACHIEVEMENTS
        : "achievements_cache",
    cachePrefix: "achievements",
    onChange: async () => {
      await silentRefreshPublicGallery();
    },
    onSync: async () => {
      await silentRefreshPublicGallery();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

function bindLifecycleEvents() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      silentRefreshPublicGallery();
    }
  });

  window.addEventListener("online", () => {
    silentRefreshPublicGallery();
  });

  const cleanup = () => {
    if (RealtimeManager && typeof RealtimeManager.removeAllChannels === "function") {
      RealtimeManager.removeAllChannels();
    }
  };

  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("pagehide", cleanup);
}

document.addEventListener("DOMContentLoaded", () => {
  bindLifecycleEvents();
  initGallery();
});

async function initGallery() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawKod = urlParams.get("kod");
  const kodSekolah = rawKod ? rawKod.trim().toUpperCase() : null;

  if (!kodSekolah) {
    window.location.replace("index.html");
    return;
  }

  currentKodSekolah = kodSekolah;

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  isPPDMode = senaraiKodPPD.includes(kodSekolah);

  try {
    await envReady;
    await initDatabaseClient();

    const headerNameEl = document.getElementById("headerSchoolName");
    const headerCodeEl = document.getElementById("headerSchoolCode");

    if (isPPDMode) {
      const namaPpd =
        (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[kodSekolah]) ||
        "PEJABAT PENDIDIKAN DAERAH";
      if (headerNameEl) {
        headerNameEl.textContent = `PPD ${namaPpd}`;
      }
      if (headerCodeEl) {
        headerCodeEl.textContent = kodSekolah;
      }
    } else {
      const sekolah = await SchoolService.getByCode(kodSekolah);
      if (sekolah) {
        if (headerNameEl) {
          headerNameEl.textContent = sekolah.nama_sekolah || kodSekolah;
        }
        if (headerCodeEl) {
          headerCodeEl.textContent = kodSekolah;
        }
      }
    }

    const data = await AchievementService.getBySchool(kodSekolah);
    allGalleryData = filterCategoryScope(data);

    renderDynamicFilters();
    updateStats(allGalleryData);
    window.renderGallery("SEMUA");
    ensureRealtimeSync();
  } catch {
    const grid = document.getElementById("galleryGrid");
    if (grid) {
      clearElement(grid);
      const errDiv = document.createElement("div");
      errDiv.className = "col-span-full text-center text-red-500 font-bold py-10";
      errDiv.textContent = "Gagal memuatkan galeri.";
      grid.appendChild(errDiv);
    }
  }
}

function updateStats(data) {
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = String(val);
    }
  };
  setTxt("countTotal", data.length);

  const statBox3 = document.getElementById("statBox3");
  const lblStat1 = document.getElementById("lblStat1");
  const lblStat2 = document.getElementById("lblStat2");

  if (isPPDMode) {
    setTxt("countMurid", data.filter((i) => i.kategori === "PEGAWAI").length);
    setTxt("countGuru", data.filter((i) => i.kategori === "PPD").length);
    if (statBox3) {
      statBox3.classList.add("hidden");
    }
    if (lblStat1) {
      lblStat1.textContent = "PEGAWAI";
    }
    if (lblStat2) {
      lblStat2.textContent = "UNIT / SEKTOR";
    }
  } else {
    setTxt("countMurid", data.filter((i) => i.kategori === "MURID").length);
    setTxt("countGuru", data.filter((i) => i.kategori === "GURU").length);
    setTxt("countSekolah", data.filter((i) => i.kategori === "SEKOLAH").length);
    if (statBox3) {
      statBox3.classList.remove("hidden");
    }
    if (lblStat1) {
      lblStat1.textContent = "MURID";
    }
    if (lblStat2) {
      lblStat2.textContent = "GURU";
    }
  }
}

function createFilterButton(type, label, hoverClass, isActive) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.filterType = type;
  btn.dataset.hoverClass = hoverClass;
  btn.className = isActive
    ? "btn-filter min-h-[44px] flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all bg-slate-900 text-white shadow-md uppercase tracking-widest"
    : `btn-filter min-h-[44px] flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 ${hoverClass} uppercase tracking-widest`;
  btn.textContent = label;
  btn.addEventListener("click", () => {
    window.filterGallery(type, btn);
  });
  return btn;
}

function renderDynamicFilters() {
  const container = document.getElementById("filterContainerPublic");
  if (!container) {
    return;
  }

  clearElement(container);
  const fragment = document.createDocumentFragment();

  fragment.appendChild(
    createFilterButton("SEMUA", "SEMUA", "hover:text-slate-900", true)
  );

  if (isPPDMode) {
    fragment.appendChild(
      createFilterButton("PEGAWAI", "PEGAWAI", "hover:text-blue-600", false)
    );
    fragment.appendChild(
      createFilterButton("PPD", "UNIT / SEKTOR", "hover:text-indigo-600", false)
    );
  } else {
    fragment.appendChild(
      createFilterButton("MURID", "MURID", "hover:text-blue-600", false)
    );
    fragment.appendChild(
      createFilterButton("GURU", "GURU", "hover:text-amber-600", false)
    );
    fragment.appendChild(
      createFilterButton("SEKOLAH", "SEKOLAH", "hover:text-indigo-600", false)
    );
  }

  container.appendChild(fragment);
}

window.filterGallery = function (type, btn) {
  currentCategoryFilter = type || "SEMUA";

  const container = document.getElementById("filterContainerPublic");
  if (container) {
    const allBtns = container.querySelectorAll("button.btn-filter");
    allBtns.forEach((b) => {
      const hoverCls = b.dataset.hoverClass || "hover:text-slate-900";
      const isSelected = btn ? b === btn : b.dataset.filterType === currentCategoryFilter;
      b.className = isSelected
        ? "btn-filter min-h-[44px] flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all bg-slate-900 text-white shadow-md uppercase tracking-widest"
        : `btn-filter min-h-[44px] flex-1 lg:px-6 py-2.5 rounded-xl text-[10px] font-black transition-all text-slate-500 ${hoverCls} uppercase tracking-widest`;
    });
  }

  const cloudWrapper = document.getElementById("jawatanCloudWrapper");
  if (currentCategoryFilter === "GURU" && !isPPDMode) {
    if (cloudWrapper) {
      cloudWrapper.classList.remove("hidden");
    }
    generateJawatanCloud();
  } else {
    if (cloudWrapper) {
      cloudWrapper.classList.add("hidden");
    }
    currentJawatanFilter = "ALL";
  }

  window.renderGallery(currentCategoryFilter);
};

window.renderGallery = function (filterType) {
  const grid = document.getElementById("galleryGrid");
  if (!grid) {
    return;
  }
  clearElement(grid);

  const activeType = filterType || "SEMUA";
  let filteredData =
    activeType === "SEMUA"
      ? allGalleryData
      : allGalleryData.filter((item) => item.kategori === activeType);

  if (activeType === "GURU" && currentJawatanFilter !== "ALL") {
    filteredData = filteredData.filter((item) => item.jawatan === currentJawatanFilter);
  }

  if (filteredData.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className =
      "col-span-full text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200";
    emptyBox.appendChild(createIcon("fas fa-folder-open text-4xl text-slate-200 mb-3"));
    const emptyText = document.createElement("p");
    emptyText.className = "text-slate-400 font-bold italic";
    emptyText.textContent = "Tiada rekod dijumpai untuk kategori ini.";
    emptyBox.appendChild(emptyText);
    grid.appendChild(emptyBox);
    return;
  }

  const uniqueYears = [...new Set(filteredData.map((item) => item.tahun))].sort(
    (a, b) => b - a
  );
  const fragment = document.createDocumentFragment();

  uniqueYears.forEach((year) => {
    const yearHeader = document.createElement("div");
    yearHeader.className = "col-span-full flex items-center gap-4 mt-8 mb-4 animate-fade-up";

    const yearBadge = document.createElement("span");
    yearBadge.className =
      "bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black border border-indigo-100 shadow-sm";
    yearBadge.appendChild(createIcon("fas fa-calendar-alt mr-2"));
    yearBadge.appendChild(document.createTextNode(`TAHUN ${year || "-"}`));

    const line = document.createElement("div");
    line.className = "h-px bg-slate-200 flex-grow";

    yearHeader.appendChild(yearBadge);
    yearHeader.appendChild(line);
    fragment.appendChild(yearHeader);

    const itemsInYear = filteredData.filter((item) => item.tahun === year);
    itemsInYear.forEach((item) => {
      fragment.appendChild(createCardElement(item));
    });
  });

  grid.appendChild(fragment);
};

function createCardElement(item) {
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
    borderClass = "border-t-4 border-indigo-500";
    textClass = "text-indigo-600";
    dotClass = "bg-indigo-600";
  } else if (item.kategori === "PEGAWAI") {
    borderClass = "border-t-4 border-teal-500";
    textClass = "text-teal-600";
    dotClass = "bg-teal-600";
  } else if (item.kategori === "PPD") {
    borderClass = "border-t-4 border-fuchsia-500";
    textClass = "text-fuchsia-600";
    dotClass = "bg-fuchsia-600";
  }

  const card = document.createElement("div");
  card.className = `card-gallery animate-fade-up ${borderClass} min-w-0 ${
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
    thumbBox.className = "aspect-video bg-slate-100 overflow-hidden";

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
    thumbBox.className = "aspect-video bg-black overflow-hidden relative";

    const img = document.createElement("img");
    img.src = `https://img.youtube.com/vi/${youtubeMatch[1]}/mqdefault.jpg`;
    img.alt = item.nama_pertandingan || "Video Bukti";
    img.loading = "lazy";
    img.className = "w-full h-full object-cover opacity-80 transition duration-500";
    img.addEventListener("error", () => {
      clearElement(thumbBox);
      thumbBox.className =
        "aspect-video bg-slate-900 flex items-center justify-center text-slate-500 text-3xl";
      thumbBox.appendChild(createIcon("fas fa-video-slash"));
    });

    const overlay = document.createElement("div");
    overlay.className = "absolute inset-0 flex items-center justify-center";
    overlay.appendChild(createIcon("fas fa-play-circle text-white/90 text-4xl shadow-2xl"));

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
    "absolute top-[-14px] right-3 bg-white p-1 rounded-full shadow-sm text-slate-400 text-[10px] w-7 h-7 flex items-center justify-center border border-slate-100";
  typeBadge.appendChild(createIcon(`fas ${iconType}`));
  bodyDiv.appendChild(typeBadge);

  const catRow = document.createElement("div");
  catRow.className = "flex items-center gap-1.5 mb-2";
  const dot = document.createElement("div");
  dot.className = `w-2 h-2 rounded-full ${dotClass}`;
  const catLabel = document.createElement("span");
  catLabel.className = `text-[9px] font-black uppercase tracking-wider ${textClass}`;
  catLabel.textContent = item.kategori || "-";
  catRow.appendChild(dot);
  catRow.appendChild(catLabel);
  bodyDiv.appendChild(catRow);

  const titleEl = document.createElement("h6");
  titleEl.className =
    "font-bold text-slate-800 text-xs leading-snug mb-1 whitespace-normal break-words";
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
  resultBadge.className = `text-[10px] font-black ${textClass} bg-slate-50 px-2 py-0.5 rounded border border-slate-100 uppercase truncate max-w-[140px]`;
  resultBadge.textContent = item.pencapaian || "-";

  footerDiv.appendChild(resultBadge);
  if (safeUrl) {
    footerDiv.appendChild(
      createIcon("fas fa-external-link-alt text-slate-300 text-[9px] shrink-0")
    );
  }

  bodyDiv.appendChild(footerDiv);
  card.appendChild(bodyDiv);

  return card;
}

function generateJawatanCloud() {
  const container = document.getElementById("jawatanCloudContainer");
  if (!container) {
    return;
  }

  const guruData = allGalleryData.filter((item) => item.kategori === "GURU");
  const counts = {};

  guruData.forEach((item) => {
    if (item.jawatan) {
      const j = item.jawatan.trim();
      if (j) {
        counts[j] = (counts[j] || 0) + 1;
      }
    }
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  clearElement(container);

  if (entries.length === 0) {
    const emptyP = document.createElement("p");
    emptyP.className = "text-xs text-slate-400 italic py-2";
    emptyP.textContent = "Tiada data jawatan direkodkan.";
    container.appendChild(emptyP);
    return;
  }

  const fragment = document.createDocumentFragment();

  entries.forEach(([jawatan, count]) => {
    const isActive = jawatan === currentJawatanFilter;
    let sizeStyle = "text-[10px]";
    if (count > 2) {
      sizeStyle = "text-[11px] font-bold";
    }
    if (count > 5) {
      sizeStyle = "text-[12px] font-black";
    }

    const chip = document.createElement("div");
    chip.className = `min-h-[40px] inline-flex items-center px-3 py-1.5 rounded-full border cursor-pointer transition-all m-1 shadow-sm ${
      isActive
        ? "bg-indigo-600 text-white border-indigo-600 scale-105"
        : "bg-white text-slate-500 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
    }`;
    chip.addEventListener("click", () => {
      window.filterByJawatan(jawatan);
    });

    const labelSpan = document.createElement("span");
    labelSpan.className = sizeStyle;
    labelSpan.textContent = jawatan;

    const countSpan = document.createElement("span");
    countSpan.className = `ml-2 px-1.5 rounded-full text-[9px] font-bold ${
      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
    }`;
    countSpan.textContent = String(count);

    chip.appendChild(labelSpan);
    chip.appendChild(countSpan);
    fragment.appendChild(chip);
  });

  container.appendChild(fragment);
}

window.filterByJawatan = function (jawatan) {
  currentJawatanFilter =
    jawatan === "ALL" || currentJawatanFilter === jawatan ? "ALL" : jawatan;

  const btnReset = document.getElementById("btnResetJawatan");
  if (btnReset) {
    if (currentJawatanFilter !== "ALL") {
      btnReset.classList.remove("hidden");
    } else {
      btnReset.classList.add("hidden");
    }
  }

  generateJawatanCloud();
  window.renderGallery("GURU");
};