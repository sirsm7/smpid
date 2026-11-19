import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { AchievementService } from "../services/achievement.service.js";
import { toggleLoading, uploadFileToDrive } from "../core/helpers.js";
import { populateDropdown } from "../config/dropdowns.js";

let pencapaianList = [];
let currentPencapaianFiltered = [];
let currentCardFilter = "ALL";
let currentJawatanFilter = "ALL";
let currentKategoriFilter = "ALL";
let currentProgramFilter = [];
let currentDaerahFilter = "ALL";
let sortState = { column: "created_at", direction: "desc" };

let standardizationList = [];
let filteredStandardizationList = [];
let realtimeSubscribed = false;
let editSubmitBusy = false;
let ppdSubmitBusy = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function setButtonIconAndText(button, iconClass, text) {
  if (!button) {
    return;
  }
  clearElement(button);
  if (iconClass) {
    const icon = document.createElement("i");
    icon.className = iconClass;
    button.appendChild(icon);
    button.appendChild(document.createTextNode(" "));
  }
  button.appendChild(document.createTextNode(text));
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
    return Promise.resolve({ isConfirmed: confirmed });
  }
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
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

function getSessionKey(type) {
  try {
    return APP_CONFIG.SESSION[type];
  } catch {
    return type === "USER_ROLE" ? "user_role" : "user_kod";
  }
}

function getPpdCodeList() {
  try {
    return Object.keys(APP_CONFIG.PPD_MAPPING);
  } catch {
    return ["M010", "M020", "M030"];
  }
}

function getPpdName(kod) {
  try {
    return APP_CONFIG.PPD_MAPPING[kod];
  } catch {
    return null;
  }
}

function isSuperAdminRole() {
  try {
    return localStorage.getItem(getSessionKey("USER_ROLE")) === "SUPER_ADMIN";
  } catch {
    return false;
  }
}

function getSchoolMetaByKod(kodSekolah) {
  if (!Array.isArray(window.globalDashboardData) || !kodSekolah) {
    return null;
  }
  return window.globalDashboardData.find((s) => s.kod_sekolah === kodSekolah) || null;
}

function getPencapaianDaerah(item) {
  const kodSekolah = item && item.kod_sekolah;
  if (!kodSekolah) {
    return "";
  }

  const ppdName = getPpdName(kodSekolah);
  if (ppdName) {
    return ppdName;
  }

  const schoolMeta = getSchoolMetaByKod(kodSekolah);
  return schoolMeta && schoolMeta.daerah ? schoolMeta.daerah : "";
}

function applyRbacToPencapaian(rawList) {
  let data = Array.isArray(rawList) ? rawList : [];
  const userRole = localStorage.getItem(getSessionKey("USER_ROLE"));
  const userKod = localStorage.getItem(getSessionKey("USER_KOD"));

  if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
    const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
    if (userKod) {
      validSchoolCodes.push(userKod);
    }
    data = data.filter((p) => validSchoolCodes.includes(p.kod_sekolah));
  }
  return data;
}

async function silentRefreshPencapaian() {
  try {
    await envReady;
    await initDatabaseClient();
    const tahunEl = document.getElementById("filterTahunPencapaian");
    const tahun = tahunEl ? tahunEl.value : "ALL";
    const dataRaw = await AchievementService.getAll(tahun);
    pencapaianList = applyRbacToPencapaian(dataRaw);

    populateDaerahFilter();
    const scopedData = getDaerahFilteredPencapaianSource();
    populateSekolahFilter(scopedData);
    populateProgramFilter(scopedData);
    window.renderPencapaianTable();
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_achievement_master",
    table: "smpid_pencapaian",
    primaryKey: "id",
    cacheStore:
      APP_CONFIG.IDB && APP_CONFIG.IDB.STORES
        ? APP_CONFIG.IDB.STORES.ACHIEVEMENTS
        : "achievements_cache",
    cachePrefix: "achievements",
    onChange: async () => {
      await silentRefreshPencapaian();
    },
    onSync: async () => {
      await silentRefreshPencapaian();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

function populateDaerahFilter() {
  const wrapper = document.getElementById("filterDaerahPencapaianWrapper");
  const select = document.getElementById("filterDaerahPencapaian");
  if (!wrapper || !select) {
    return;
  }

  if (!isSuperAdminRole()) {
    wrapper.classList.add("hidden");
    select.value = "ALL";
    currentDaerahFilter = "ALL";
    return;
  }

  wrapper.classList.remove("hidden");

  const oldVal = select.value || currentDaerahFilter || "ALL";
  let daerahList = [];

  if (APP_CONFIG && APP_CONFIG.PPD_MAPPING) {
    daerahList = Object.values(APP_CONFIG.PPD_MAPPING);
  }

  if (Array.isArray(window.globalDashboardData)) {
    window.globalDashboardData.forEach((s) => {
      if (s && s.daerah) {
        daerahList.push(s.daerah);
      }
    });
  }

  daerahList = [...new Set(daerahList.filter(Boolean))].sort();

  clearElement(select);
  const fragment = document.createDocumentFragment();

  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = "SEMUA DAERAH";
  fragment.appendChild(allOpt);

  daerahList.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    fragment.appendChild(opt);
  });

  select.appendChild(fragment);

  if (oldVal !== "ALL" && daerahList.includes(oldVal)) {
    select.value = oldVal;
    currentDaerahFilter = oldVal;
  } else {
    select.value = "ALL";
    currentDaerahFilter = "ALL";
  }
}

function getDaerahFilteredPencapaianSource() {
  if (!isSuperAdminRole() || currentDaerahFilter === "ALL") {
    return pencapaianList;
  }
  return pencapaianList.filter((item) => getPencapaianDaerah(item) === currentDaerahFilter);
}

function populateProgramFilter(data) {
  const selectEl = document.getElementById("filterProgramPencapaian");
  if (!selectEl) {
    return;
  }

  const counts = {};
  (data || []).forEach((item) => {
    const program = (item.nama_pertandingan || "").trim();
    if (!program) {
      return;
    }
    counts[program] = (counts[program] || 0) + 1;
  });

  const sortedPrograms = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));

  let isDropdownOpen = false;
  let currentSearchValue = "";
  let currentScrollPos = 0;

  const existingMenu = document.getElementById("customProgramDropdownMenu");
  if (existingMenu) {
    isDropdownOpen = !existingMenu.classList.contains("hidden");
    const searchInput = document.getElementById("progSearchInput");
    if (searchInput) {
      currentSearchValue = searchInput.value || "";
    }
    const scrollContainer = document.getElementById("progDropdownList");
    if (scrollContainer) {
      currentScrollPos = scrollContainer.scrollTop || 0;
    }
  }

  let customDropdown = document.getElementById("customProgramDropdown");
  if (!customDropdown) {
    selectEl.style.display = "none";
    customDropdown = document.createElement("div");
    customDropdown.id = "customProgramDropdown";
    customDropdown.className = "relative w-full lg:col-span-2 mt-1 lg:mt-0";
    selectEl.after(customDropdown);
  }

  const btnText =
    currentProgramFilter.length > 0
      ? `${currentProgramFilter.length} PROGRAM DIPILIH`
      : "SEMUA PROGRAM";
  const btnClass =
    currentProgramFilter.length > 0
      ? "text-indigo-700 font-bold bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200"
      : "text-slate-500 bg-white border-slate-200";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = `w-full h-full min-h-[44px] text-left px-4 py-2.5 border rounded-xl shadow-sm focus:outline-none flex justify-between items-center text-sm font-semibold transition-all ${btnClass}`;

  const btnLabelSpan = document.createElement("span");
  btnLabelSpan.className = "truncate pr-2";
  btnLabelSpan.textContent = btnText;

  const chevronIcon = document.createElement("i");
  chevronIcon.className = "fas fa-chevron-down opacity-50";

  toggleBtn.appendChild(btnLabelSpan);
  toggleBtn.appendChild(chevronIcon);

  const menuDiv = document.createElement("div");
  menuDiv.id = "customProgramDropdownMenu";
  menuDiv.className = `${
    isDropdownOpen ? "" : "hidden"
  } absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col`;
  menuDiv.style.maxHeight = "28rem";

  toggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    menuDiv.classList.toggle("hidden");
  });

  const stickyHeader = document.createElement("div");
  stickyHeader.className =
    "p-2 sticky top-0 bg-white border-b border-slate-100 z-10 flex flex-col gap-2 shadow-sm rounded-t-xl";

  const headerTopRow = document.createElement("div");
  headerTopRow.className = "flex justify-between items-center px-1";

  const headerTitle = document.createElement("span");
  headerTitle.className = "text-[10px] font-black text-slate-400 tracking-wider";
  headerTitle.textContent = "PILIHAN BERBILANG";
  headerTopRow.appendChild(headerTitle);

  if (currentProgramFilter.length > 0) {
    const resetInlineBtn = document.createElement("button");
    resetInlineBtn.type = "button";
    resetInlineBtn.className =
      "min-h-[32px] text-[10px] font-bold bg-red-500 text-white px-3 py-1 rounded shadow-sm hover:bg-red-600 transition";
    resetInlineBtn.textContent = "RESET";
    resetInlineBtn.addEventListener("click", () => {
      window.filterPencapaianByProgram("ALL");
    });
    headerTopRow.appendChild(resetInlineBtn);
  }

  const searchBoxWrap = document.createElement("div");
  searchBoxWrap.className = "relative";

  const searchIcon = document.createElement("i");
  searchIcon.className = "fas fa-search absolute left-2.5 top-2.5 text-slate-400 text-xs";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "progSearchInput";
  searchInput.placeholder = "Cari nama program...";
  searchInput.value = currentSearchValue;
  searchInput.className =
    "w-full min-h-[36px] pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  searchBoxWrap.appendChild(searchIcon);
  searchBoxWrap.appendChild(searchInput);

  stickyHeader.appendChild(headerTopRow);
  stickyHeader.appendChild(searchBoxWrap);
  menuDiv.appendChild(stickyHeader);

  const ul = document.createElement("ul");
  ul.id = "progDropdownList";
  ul.className = "p-1.5 flex flex-col gap-0.5 overflow-y-auto";

  const searchLower = String(currentSearchValue).toLowerCase();
  const listFragment = document.createDocumentFragment();

  if (sortedPrograms.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "px-3 py-4 text-center text-xs text-slate-400 italic";
    emptyLi.textContent = "Tiada data program";
    listFragment.appendChild(emptyLi);
  } else {
    sortedPrograms.forEach(([program, count]) => {
      const isChecked = currentProgramFilter.includes(program);
      const searchTarget = program.toLowerCase();

      const li = document.createElement("li");
      li.className = "prog-item";
      li.setAttribute("data-search", searchTarget);
      if (!searchTarget.includes(searchLower)) {
        li.style.display = "none";
      }

      const label = document.createElement("label");
      label.className = `flex items-start px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100 ${
        isChecked ? "bg-indigo-50/50" : ""
      }`;

      const cbWrap = document.createElement("div");
      cbWrap.className = "flex items-center h-5";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className =
        "form-checkbox h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer";
      checkbox.checked = isChecked;
      checkbox.addEventListener("change", () => {
        window.filterPencapaianByProgram(program);
      });
      cbWrap.appendChild(checkbox);

      const textWrap = document.createElement("div");
      textWrap.className = "ml-2 flex-1 min-w-0";

      const textDiv = document.createElement("div");
      textDiv.className = `text-xs font-bold leading-tight ${
        isChecked ? "text-indigo-700" : "text-slate-600"
      } whitespace-normal break-words`;
      textDiv.title = program;
      textDiv.textContent = program;
      textWrap.appendChild(textDiv);

      const countBadge = document.createElement("span");
      countBadge.className =
        "text-[9px] bg-white border border-slate-200 text-slate-500 font-bold px-1.5 py-0.5 rounded-full ml-2 whitespace-nowrap shadow-sm";
      countBadge.textContent = String(count);

      label.appendChild(cbWrap);
      label.appendChild(textWrap);
      label.appendChild(countBadge);
      li.appendChild(label);
      listFragment.appendChild(li);
    });
  }

  ul.appendChild(listFragment);
  menuDiv.appendChild(ul);

  searchInput.addEventListener("input", () => {
    const v = searchInput.value.toLowerCase();
    ul.querySelectorAll(".prog-item").forEach((el) => {
      const target = el.getAttribute("data-search") || "";
      el.style.display = target.includes(v) ? "" : "none";
    });
  });

  clearElement(customDropdown);
  customDropdown.appendChild(toggleBtn);
  customDropdown.appendChild(menuDiv);

  setTimeout(() => {
    ul.scrollTop = currentScrollPos;
  }, 0);
}

document.addEventListener("click", (e) => {
  const menu = document.getElementById("customProgramDropdownMenu");
  const dropdown = document.getElementById("customProgramDropdown");
  if (menu && !menu.classList.contains("hidden")) {
    if (dropdown && !dropdown.contains(e.target)) {
      menu.classList.add("hidden");
    }
  }
});

function renderTableLoadingRow(tbody, message) {
  if (!tbody) {
    return;
  }
  clearElement(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 9;
  td.className = "text-center py-10";

  const icon = document.createElement("i");
  icon.className = "fas fa-circle-notch fa-spin text-brand-500 text-3xl mb-3";

  const p = document.createElement("p");
  p.className = "font-bold text-slate-500";
  p.textContent = message;

  td.appendChild(icon);
  td.appendChild(p);
  tr.appendChild(td);
  tbody.appendChild(tr);
}

window.populateTahunFilter = async function () {
  const select = document.getElementById("filterTahunPencapaian");
  const tbody = document.getElementById("tbodyPencapaianMaster");

  renderTableLoadingRow(tbody, "Menyemak pangkalan data...");

  if (!select) {
    window.loadMasterPencapaian();
    return;
  }

  if (select.options.length > 1 && !select.textContent.includes("Memuatkan")) {
    window.loadMasterPencapaian();
    return;
  }

  try {
    await envReady;
    await initDatabaseClient();
    const years = await AchievementService.getAvailableYears();

    clearElement(select);
    const fragment = document.createDocumentFragment();

    const allOpt = document.createElement("option");
    allOpt.value = "ALL";
    allOpt.textContent = "SEMUA TAHUN";
    fragment.appendChild(allOpt);

    (years || []).forEach((y) => {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = `TAHUN ${y}`;
      fragment.appendChild(opt);
    });

    select.appendChild(fragment);

    const currentYear = String(new Date().getFullYear());
    if (Array.isArray(years) && years.includes(currentYear)) {
      select.value = currentYear;
    }
  } catch {
    clearElement(select);
    const fallbackOpt = document.createElement("option");
    fallbackOpt.value = "ALL";
    fallbackOpt.textContent = "SEMUA TAHUN";
    select.appendChild(fallbackOpt);
  } finally {
    window.loadMasterPencapaian();
  }
};

window.loadMasterPencapaian = async function () {
  const tbody = document.getElementById("tbodyPencapaianMaster");
  if (!tbody) {
    return;
  }

  renderTableLoadingRow(tbody, "Memuat turun data Kemenjadian...");

  const tahunEl = document.getElementById("filterTahunPencapaian");
  const tahun = tahunEl ? tahunEl.value : "ALL";

  try {
    await envReady;
    await initDatabaseClient();
    const dataRaw = await AchievementService.getAll(tahun);
    pencapaianList = applyRbacToPencapaian(dataRaw);

    populateDaerahFilter();
    const scopedData = getDaerahFilteredPencapaianSource();
    populateSekolahFilter(scopedData);
    populateProgramFilter(scopedData);

    window.renderPencapaianTable();
    ensureRealtimeSync();
  } catch {
    clearElement(tbody);
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 9;
    td.className = "text-center text-red-500 font-bold p-4 bg-red-50 rounded-xl";
    td.textContent = "Gagal memuatkan data dari pangkalan data pusat.";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
};

function populateSekolahFilter(data) {
  const select = document.getElementById("filterSekolahPencapaian");
  if (!select) {
    return;
  }
  const seen = new Set();
  const oldVal = select.value;
  const senaraiKodPPD = getPpdCodeList();

  clearElement(select);
  const fragment = document.createDocumentFragment();

  const allOpt = document.createElement("option");
  allOpt.value = "ALL";
  allOpt.textContent = "SEMUA SEKOLAH";
  fragment.appendChild(allOpt);

  const sortedData = [...data].sort((a, b) => {
    if (senaraiKodPPD.includes(a.kod_sekolah)) {
      return -1;
    }
    if (senaraiKodPPD.includes(b.kod_sekolah)) {
      return 1;
    }

    let nameA = a.kod_sekolah || "";
    let nameB = b.kod_sekolah || "";

    if (Array.isArray(window.globalDashboardData)) {
      const sA = window.globalDashboardData.find((x) => x.kod_sekolah === a.kod_sekolah);
      const sB = window.globalDashboardData.find((x) => x.kod_sekolah === b.kod_sekolah);
      if (sA && sA.nama_sekolah) {
        nameA = sA.nama_sekolah;
      }
      if (sB && sB.nama_sekolah) {
        nameB = sB.nama_sekolah;
      }
    }

    return nameA.localeCompare(nameB);
  });

  sortedData.forEach((i) => {
    if (!seen.has(i.kod_sekolah)) {
      let label = i.kod_sekolah;
      if (senaraiKodPPD.includes(i.kod_sekolah)) {
        const ppdName = getPpdName(i.kod_sekolah);
        label = ppdName
          ? `PPD ${ppdName} (${i.kod_sekolah})`
          : `PEJABAT PENDIDIKAN DAERAH (${i.kod_sekolah})`;
      } else if (Array.isArray(window.globalDashboardData)) {
        const s = window.globalDashboardData.find((x) => x.kod_sekolah === i.kod_sekolah);
        if (s && s.nama_sekolah) {
          label = `${s.nama_sekolah} (${i.kod_sekolah})`;
        }
      }
      const count = data.filter((d) => d.kod_sekolah === i.kod_sekolah).length;

      const opt = document.createElement("option");
      opt.value = i.kod_sekolah;
      opt.textContent = `${label} (${count})`;
      fragment.appendChild(opt);
      seen.add(i.kod_sekolah);
    }
  });

  select.appendChild(fragment);

  if (seen.has(oldVal)) {
    select.value = oldVal;
  } else {
    select.value = "ALL";
  }
}

window.renderPencapaianTable = function () {
  const tbody = document.getElementById("tbodyPencapaianMaster");
  if (!tbody) {
    return;
  }

  const elKat = document.getElementById("filterKategoriPencapaian");
  if (elKat) {
    currentKategoriFilter = elKat.value;
  }

  const elDaerah = document.getElementById("filterDaerahPencapaian");
  if (elDaerah && isSuperAdminRole()) {
    currentDaerahFilter = elDaerah.value || "ALL";
  } else {
    currentDaerahFilter = "ALL";
  }

  const katFilter = currentKategoriFilter;
  const elSek = document.getElementById("filterSekolahPencapaian");
  const sekFilter = elSek ? elSek.value : "ALL";

  const elJenis = document.getElementById("filterJenisPencapaian");
  const jenisFilter = elJenis ? elJenis.value : "ALL";

  const searchInput = document.getElementById("searchPencapaianInput");
  const search = searchInput ? searchInput.value.toUpperCase() : "";

  const senaraiKodPPD = getPpdCodeList();

  const applyCoreFilters = (i, options = {}) => {
    const ignoreProgram = options.ignoreProgram === true;

    if (currentDaerahFilter !== "ALL" && getPencapaianDaerah(i) !== currentDaerahFilter) {
      return false;
    }
    if (sekFilter !== "ALL" && i.kod_sekolah !== sekFilter) {
      return false;
    }
    if (katFilter !== "ALL" && i.kategori !== katFilter) {
      return false;
    }
    if (jenisFilter !== "ALL" && i.jenis_rekod !== jenisFilter) {
      return false;
    }

    if (
      !ignoreProgram &&
      currentProgramFilter.length > 0 &&
      !currentProgramFilter.includes(i.nama_pertandingan)
    ) {
      return false;
    }

    if (search) {
      const namaSekolah = senaraiKodPPD.includes(i.kod_sekolah)
        ? getPpdName(i.kod_sekolah)
          ? `PPD ${getPpdName(i.kod_sekolah)}`
          : "PEJABAT PENDIDIKAN DAERAH"
        : (getSchoolMetaByKod(i.kod_sekolah) && getSchoolMetaByKod(i.kod_sekolah).nama_sekolah) ||
          "";
      const searchTarget =
        `${i.kod_sekolah} ${namaSekolah} ${i.nama_peserta} ${i.nama_pertandingan} ${i.pencapaian}`.toUpperCase();
      if (!searchTarget.includes(search)) {
        return false;
      }
    }

    if (currentCardFilter === "KEBANGSAAN" && i.peringkat !== "KEBANGSAAN") {
      return false;
    }
    if (
      currentCardFilter === "ANTARABANGSA" &&
      !["ANTARABANGSA"].includes(i.peringkat) &&
      i.jenis_rekod !== "PENSIJILAN"
    ) {
      return false;
    }
    if (
      ["GOOGLE", "APPLE", "MICROSOFT"].includes(currentCardFilter) &&
      i.penyedia !== currentCardFilter
    ) {
      return false;
    }
    if (
      currentCardFilter === "LAIN-LAIN" &&
      (i.jenis_rekod !== "PENSIJILAN" || i.penyedia !== "LAIN-LAIN")
    ) {
      return false;
    }

    if (currentJawatanFilter !== "ALL" && i.jawatan !== currentJawatanFilter) {
      return false;
    }

    return true;
  };

  const dataForProgramFilter = pencapaianList.filter((i) =>
    applyCoreFilters(i, { ignoreProgram: true })
  );
  populateProgramFilter(dataForProgramFilter);
  updateProgramCloud(dataForProgramFilter);

  const data = pencapaianList.filter((i) => applyCoreFilters(i));

  updateStats(data);
  updateCloud(data);

  data.sort((a, b) => {
    let valA = a[sortState.column] || "";
    let valB = b[sortState.column] || "";
    if (sortState.column === "nama_sekolah") {
      valA = a.kod_sekolah;
      valB = b.kod_sekolah;
    }
    if (sortState.direction === "asc") {
      return valA > valB ? 1 : -1;
    }
    return valA < valB ? 1 : -1;
  });

  currentPencapaianFiltered = data;

  renderTopSchools(data);
  renderTopPensijilanLists(data);

  const selectAllCb = document.getElementById("selectAllPencapaian");
  if (selectAllCb) {
    selectAllCb.checked = false;
  }
  if (typeof window.checkBulkStatusPencapaian === "function") {
    window.checkBulkStatusPencapaian();
  }

  clearElement(tbody);

  if (data.length === 0) {
    const emptyTr = document.createElement("tr");
    const emptyTd = document.createElement("td");
    emptyTd.colSpan = 9;
    emptyTd.className = "text-center py-10";

    const p = document.createElement("p");
    p.className = "text-slate-400 font-medium italic";
    const icon = document.createElement("i");
    icon.className = "fas fa-folder-open text-2xl mb-2 block text-slate-300";
    p.appendChild(icon);
    p.appendChild(document.createTextNode("Tiada rekod ditemui untuk kriteria semasa."));

    emptyTd.appendChild(p);
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayData = data.slice(0, limit);
  const rowFragment = document.createDocumentFragment();

  displayData.forEach((i) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0";

    const tdCb = document.createElement("td");
    tdCb.className = "px-4 py-3 text-center border-r border-slate-100 w-12";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "cb-pencapaian w-4 h-4 accent-red-500 cursor-pointer rounded";
    cb.value = String(i.id);
    cb.addEventListener("change", () => {
      window.checkBulkStatusPencapaian();
    });
    tdCb.appendChild(cb);

    const tdKod = document.createElement("td");
    tdKod.className = "px-6 py-4 font-mono text-xs font-bold text-slate-400 w-24";
    tdKod.textContent = i.kod_sekolah || "-";

    const tdSekolah = document.createElement("td");
    tdSekolah.className =
      "px-6 py-4 text-xs font-semibold text-slate-700 leading-snug w-64 whitespace-normal break-words";
    if (senaraiKodPPD.includes(i.kod_sekolah)) {
      const ppdName = getPpdName(i.kod_sekolah);
      const ppdSpan = document.createElement("span");
      ppdSpan.className = "text-indigo-600 font-black";
      ppdSpan.textContent = ppdName ? `PPD ${ppdName}` : "PEJABAT PENDIDIKAN DAERAH";
      tdSekolah.appendChild(ppdSpan);
    } else {
      let namaSek = i.kod_sekolah || "-";
      if (Array.isArray(window.globalDashboardData)) {
        const s = window.globalDashboardData.find((x) => x.kod_sekolah === i.kod_sekolah);
        if (s && s.nama_sekolah) {
          namaSek = s.nama_sekolah;
        }
      }
      tdSekolah.textContent = namaSek;
    }

    const tdKategori = document.createElement("td");
    tdKategori.className = "px-6 py-4 text-center";
    let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
    if (i.kategori === "MURID") {
      badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
    } else if (i.kategori === "GURU") {
      badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
    } else if (i.kategori === "SEKOLAH") {
      badgeClass = "bg-green-100 text-green-700 border-green-200";
    } else if (i.kategori === "PEGAWAI") {
      badgeClass = "bg-slate-800 text-white border-slate-700";
    } else if (i.kategori === "PPD") {
      badgeClass = "bg-indigo-100 text-indigo-700 border-indigo-200";
    }
    const katSpan = document.createElement("span");
    katSpan.className = `inline-block whitespace-nowrap px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`;
    katSpan.textContent = i.kategori || "-";
    tdKategori.appendChild(katSpan);

    const tdPeserta = document.createElement("td");
    tdPeserta.className = "px-6 py-4 whitespace-normal break-words";
    const pesertaDiv = document.createElement("div");
    pesertaDiv.className = "font-bold text-slate-800 text-sm mb-0.5";
    pesertaDiv.textContent = i.nama_peserta || "-";
    tdPeserta.appendChild(pesertaDiv);
    if (i.jawatan) {
      const jawSpan = document.createElement("span");
      jawSpan.className =
        "text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block";
      jawSpan.textContent = i.jawatan;
      tdPeserta.appendChild(jawSpan);
    }

    const tdProgram = document.createElement("td");
    tdProgram.className = "px-6 py-4 whitespace-normal break-words";
    const badgeWrap = document.createElement("div");
    badgeWrap.className = "mb-1";
    const jenisSpan = document.createElement("span");
    if (i.jenis_rekod === "PENSIJILAN") {
      jenisSpan.className =
        "bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black px-1 rounded mr-1";
      jenisSpan.textContent = "SIJIL";
    } else {
      jenisSpan.className =
        "bg-blue-50 text-blue-600 border border-blue-200 text-[9px] font-black px-1 rounded mr-1";
      jenisSpan.textContent = "PROG";
    }
    badgeWrap.appendChild(jenisSpan);
    tdProgram.appendChild(badgeWrap);

    const progTitleDiv = document.createElement("div");
    progTitleDiv.className = "text-brand-600 text-xs font-bold leading-tight";
    progTitleDiv.textContent = i.nama_pertandingan || "-";
    tdProgram.appendChild(progTitleDiv);

    if (i.jenis_rekod === "PENSIJILAN" && i.penyedia) {
      const penyediaSpan = document.createElement("span");
      penyediaSpan.className =
        "block text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-wider";
      const bIcon = document.createElement("i");
      bIcon.className = "fas fa-building mr-1";
      penyediaSpan.appendChild(bIcon);
      penyediaSpan.appendChild(document.createTextNode(i.penyedia));
      tdProgram.appendChild(penyediaSpan);
    }

    const tdPencapaian = document.createElement("td");
    tdPencapaian.className =
      "px-6 py-4 text-center font-black text-slate-700 text-xs w-32 whitespace-normal break-words bg-slate-50/50";
    tdPencapaian.textContent = i.pencapaian || "-";

    const tdBukti = document.createElement("td");
    tdBukti.className = "px-6 py-4 text-center w-24";
    const safeUrl = sanitizeExternalUrl(i.pautan_bukti);
    if (safeUrl) {
      const proofLink = document.createElement("a");
      proofLink.href = safeUrl;
      proofLink.target = "_blank";
      proofLink.rel = "noopener noreferrer";
      proofLink.className =
        "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition";
      proofLink.title = "Lihat Bukti";
      const linkIcon = document.createElement("i");
      linkIcon.className = "fas fa-link";
      proofLink.appendChild(linkIcon);
      tdBukti.appendChild(proofLink);
    } else {
      const noLinkSpan = document.createElement("span");
      noLinkSpan.className =
        "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg text-slate-200 cursor-not-allowed";
      noLinkSpan.title = "Tiada Pautan Sah";
      const linkIcon = document.createElement("i");
      linkIcon.className = "fas fa-link";
      noLinkSpan.appendChild(linkIcon);
      tdBukti.appendChild(noLinkSpan);
    }

    const tdAction = document.createElement("td");
    tdAction.className = "px-6 py-4 text-center w-32";
    const btnGroup = document.createElement("div");
    btnGroup.className = "flex items-center justify-center gap-1";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className =
      "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition";
    editBtn.title = "Edit";
    const editIcon = document.createElement("i");
    editIcon.className = "fas fa-edit";
    editBtn.appendChild(editIcon);
    editBtn.addEventListener("click", () => {
      window.openEditPencapaian(i.id);
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className =
      "min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition";
    delBtn.title = "Padam";
    const delIcon = document.createElement("i");
    delIcon.className = "fas fa-trash-alt";
    delBtn.appendChild(delIcon);
    delBtn.addEventListener("click", () => {
      window.hapusPencapaianAdmin(i.id);
    });

    btnGroup.appendChild(editBtn);
    btnGroup.appendChild(delBtn);
    tdAction.appendChild(btnGroup);

    tr.appendChild(tdCb);
    tr.appendChild(tdKod);
    tr.appendChild(tdSekolah);
    tr.appendChild(tdKategori);
    tr.appendChild(tdPeserta);
    tr.appendChild(tdProgram);
    tr.appendChild(tdPencapaian);
    tr.appendChild(tdBukti);
    tr.appendChild(tdAction);

    rowFragment.appendChild(tr);
  });

  if (data.length > limit) {
    const infoTr = document.createElement("tr");
    infoTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
    const infoTd = document.createElement("td");
    infoTd.colSpan = 9;
    infoTd.className = "p-3 px-6 text-center text-xs font-bold text-amber-800";

    const flexWrap = document.createElement("div");
    flexWrap.className = "flex flex-col sm:flex-row items-center justify-between gap-2";

    const leftSpan = document.createElement("span");
    leftSpan.className = "flex items-center gap-1.5";
    const infoIcon = document.createElement("i");
    infoIcon.className = "fas fa-info-circle text-amber-500 text-sm";
    leftSpan.appendChild(infoIcon);
    leftSpan.appendChild(document.createTextNode("Memaparkan "));
    const boldLimit = document.createElement("strong");
    boldLimit.textContent = String(limit);
    leftSpan.appendChild(boldLimit);
    leftSpan.appendChild(document.createTextNode(" daripada "));
    const boldTotal = document.createElement("strong");
    boldTotal.textContent = String(data.length);
    leftSpan.appendChild(boldTotal);
    leftSpan.appendChild(
      document.createTextNode(" rekod pencapaian. Gunakan carian untuk melihat rekod spesifik.")
    );

    const rightSpan = document.createElement("span");
    rightSpan.className =
      "text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full font-black uppercase tracking-wider";
    rightSpan.textContent = `Eksport CSV Mengandungi 100% Data (${data.length} Rekod)`;

    flexWrap.appendChild(leftSpan);
    flexWrap.appendChild(rightSpan);
    infoTd.appendChild(flexWrap);
    infoTr.appendChild(infoTd);
    rowFragment.appendChild(infoTr);
  }

  tbody.appendChild(rowFragment);
};

function renderTopSchools(data) {
  const table = document.getElementById("tableTopContributors");
  const badge = document.getElementById("totalRecordsBadge");
  if (badge) {
    badge.textContent = `${data.length} Rekod`;
  }
  if (!table) {
    return;
  }

  const senaraiKodPPD = getPpdCodeList();
  const schoolCounts = {};
  data.forEach((i) => {
    if (!senaraiKodPPD.includes(i.kod_sekolah)) {
      schoolCounts[i.kod_sekolah] = (schoolCounts[i.kod_sekolah] || 0) + 1;
    }
  });

  const sorted = Object.entries(schoolCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  clearElement(table);
  const fragment = document.createDocumentFragment();

  if (sorted.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.className = "text-center p-4 text-slate-400 text-xs italic";
    td.textContent = "Tiada data sekolah.";
    tr.appendChild(td);
    fragment.appendChild(tr);
    table.appendChild(fragment);
    return;
  }

  sorted.forEach(([kod, count], idx) => {
    let nama = kod;
    if (Array.isArray(window.globalDashboardData)) {
      const s = window.globalDashboardData.find((x) => x.kod_sekolah === kod);
      if (s && s.nama_sekolah) {
        nama = s.nama_sekolah;
      }
    }

    const tr = document.createElement("tr");
    tr.className =
      "hover:bg-slate-50 transition border-b border-slate-50 last:border-0 cursor-pointer group";
    tr.addEventListener("click", () => {
      window.filterBySchoolFromTop5(kod);
    });

    const td = document.createElement("td");
    td.className = "p-3";

    const rowFlex = document.createElement("div");
    rowFlex.className = "flex items-center justify-between gap-2";

    const leftFlex = document.createElement("div");
    leftFlex.className = "flex items-center gap-3 min-w-0";

    const rankCircle = document.createElement("div");
    rankCircle.className =
      "w-6 h-6 rounded-full bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 flex items-center justify-center text-[10px] font-black transition-colors shrink-0";
    rankCircle.textContent = String(idx + 1);

    const textWrap = document.createElement("div");
    textWrap.className = "min-w-0";

    const nameDiv = document.createElement("div");
    nameDiv.className =
      "text-xs font-black text-slate-800 leading-tight whitespace-normal break-words";
    nameDiv.title = nama;
    nameDiv.textContent = nama;

    const kodDiv = document.createElement("div");
    kodDiv.className = "text-[9px] font-mono text-slate-400 font-bold";
    kodDiv.textContent = kod;

    textWrap.appendChild(nameDiv);
    textWrap.appendChild(kodDiv);
    leftFlex.appendChild(rankCircle);
    leftFlex.appendChild(textWrap);

    const countBadge = document.createElement("span");
    countBadge.className =
      "text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full shrink-0";
    countBadge.textContent = String(count);

    rowFlex.appendChild(leftFlex);
    rowFlex.appendChild(countBadge);
    td.appendChild(rowFlex);
    tr.appendChild(td);
    fragment.appendChild(tr);
  });

  table.appendChild(fragment);
}

function renderTopPensijilanLists(data) {
  const container = document.getElementById("topPensijilanContainer");
  if (!container) {
    return;
  }

  const elJenis = document.getElementById("filterJenisPencapaian");
  const jenisFilter = elJenis ? elJenis.value : "ALL";

  if (jenisFilter !== "PENSIJILAN") {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");

  const penyediaUtama = ["GOOGLE", "APPLE", "MICROSOFT"];
  const dataPensijilan = data.filter(
    (i) => i.jenis_rekod === "PENSIJILAN" && penyediaUtama.includes(i.penyedia)
  );

  const countPPD = {};
  const countSM = {};
  const countSR = {};
  const senaraiKodPPD = getPpdCodeList();

  dataPensijilan.forEach((item) => {
    const kod = item.kod_sekolah;
    const rekodDaerah = getPencapaianDaerah(item);

    if (rekodDaerah) {
      let targetKodPpd = Object.keys(APP_CONFIG.PPD_MAPPING).find(
        (key) => APP_CONFIG.PPD_MAPPING[key].toUpperCase() === rekodDaerah.toUpperCase()
      );
      if (!targetKodPpd && senaraiKodPPD.includes(kod)) {
        targetKodPpd = kod;
      }
      if (targetKodPpd) {
        countPPD[targetKodPpd] = (countPPD[targetKodPpd] || 0) + 1;
      }
    }

    if (!senaraiKodPPD.includes(kod)) {
      const meta = getSchoolMetaByKod(kod);
      if (meta) {
        const jenis = (meta.jenis_sekolah || "").toUpperCase();
        const isSM = ["SMK", "SBP", "SM SABK", "KV"].some((keyword) => jenis.includes(keyword));
        const isSR = ["SK", "SJKC", "SJKT", "SR SABK"].some((keyword) => jenis.includes(keyword));

        if (isSM) {
          countSM[kod] = (countSM[kod] || 0) + 1;
        } else if (isSR) {
          countSR[kod] = (countSR[kod] || 0) + 1;
        }
      }
    }
  });

  const renderRankingList = (targetEl, countObj, limit) => {
    if (!targetEl) {
      return;
    }
    clearElement(targetEl);
    const fragment = document.createDocumentFragment();

    const sorted = Object.entries(countObj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);

    if (sorted.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "text-center text-xs text-slate-400 italic py-4";
      emptyDiv.textContent = "Tiada rekod pensijilan.";
      fragment.appendChild(emptyDiv);
      targetEl.appendChild(fragment);
      return;
    }

    sorted.forEach(([kod, count], idx) => {
      let nama = kod;
      if (senaraiKodPPD.includes(kod)) {
        nama = getPpdName(kod) ? `PPD ${getPpdName(kod)}` : "PEJABAT PENDIDIKAN DAERAH";
      } else {
        const meta = getSchoolMetaByKod(kod);
        if (meta && meta.nama_sekolah) {
          nama = meta.nama_sekolah;
        }
      }

      let rankColor = "bg-slate-100 text-slate-500";
      if (idx === 0) {
        rankColor = "bg-amber-100 text-amber-600";
      } else if (idx === 1) {
        rankColor = "bg-slate-200 text-slate-600";
      } else if (idx === 2) {
        rankColor = "bg-orange-100 text-orange-600";
      }

      const rowDiv = document.createElement("div");
      rowDiv.className =
        "flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100 group cursor-pointer";
      rowDiv.addEventListener("click", () => {
        window.filterBySchoolFromTop5(kod);
      });

      const leftDiv = document.createElement("div");
      leftDiv.className = "flex items-center gap-3 w-4/5 min-w-0";

      const badge = document.createElement("div");
      badge.className = `w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${rankColor}`;
      badge.textContent = String(idx + 1);

      const infoWrap = document.createElement("div");
      infoWrap.className = "min-w-0";

      const titleDiv = document.createElement("div");
      titleDiv.className =
        "text-xs font-bold text-slate-700 wrap-safe leading-snug group-hover:text-indigo-600 transition-colors break-words";
      titleDiv.title = nama;
      titleDiv.textContent = nama;

      const codeDiv = document.createElement("div");
      codeDiv.className = "text-[9px] font-mono text-slate-400 font-bold";
      codeDiv.textContent = kod;

      infoWrap.appendChild(titleDiv);
      infoWrap.appendChild(codeDiv);
      leftDiv.appendChild(badge);
      leftDiv.appendChild(infoWrap);

      const countSpan = document.createElement("span");
      countSpan.className =
        "text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 shadow-sm shrink-0";
      countSpan.textContent = String(count);

      rowDiv.appendChild(leftDiv);
      rowDiv.appendChild(countSpan);
      fragment.appendChild(rowDiv);
    });

    targetEl.appendChild(fragment);
  };

  renderRankingList(document.getElementById("topPensijilanPPDList"), countPPD, 5);
  renderRankingList(document.getElementById("topPensijilanSMList"), countSM, 3);
  renderRankingList(document.getElementById("topPensijilanSRList"), countSR, 3);
}

function updateStats(data) {
  const categories = ["MURID", "GURU", "SEKOLAH", "PEGAWAI", "PPD"];

  categories.forEach((cat) => {
    const el = document.getElementById(
      `statTotal${cat.charAt(0) + cat.slice(1).toLowerCase()}`
    );
    const card = document.getElementById(`cardStat-${cat}`);

    if (el) {
      el.textContent = String(data.filter((i) => i.kategori === cat).length);
    }

    if (card) {
      const isActive = currentKategoriFilter === cat;
      const classes = ["p-3", "rounded-xl", "border", "cursor-pointer", "transition-all"];
      const spanEl = card.querySelector("span");
      const h4El = card.querySelector("h4");

      if (cat === "MURID") {
        classes.push(
          ...(isActive
            ? ["bg-blue-600", "border-blue-600", "shadow-md", "scale-105"]
            : ["bg-blue-50", "border-blue-100", "hover:bg-blue-100"])
        );
        card.className = classes.join(" ");
        if (spanEl) {
          spanEl.className = isActive
            ? "text-[10px] font-black text-white uppercase tracking-widest"
            : "text-[10px] font-black text-blue-600 uppercase tracking-widest";
        }
        if (h4El) {
          h4El.className = isActive
            ? "text-xl font-black text-white"
            : "text-xl font-black text-blue-800";
        }
      } else if (cat === "GURU") {
        classes.push(
          ...(isActive
            ? ["bg-amber-500", "border-amber-500", "shadow-md", "scale-105"]
            : ["bg-amber-50", "border-amber-100", "hover:bg-amber-100"])
        );
        card.className = classes.join(" ");
        if (spanEl) {
          spanEl.className = isActive
            ? "text-[10px] font-black text-white uppercase tracking-widest"
            : "text-[10px] font-black text-amber-600 uppercase tracking-widest";
        }
        if (h4El) {
          h4El.className = isActive
            ? "text-xl font-black text-white"
            : "text-xl font-black text-amber-800";
        }
      } else if (cat === "SEKOLAH") {
        classes.push(
          ...(isActive
            ? ["bg-green-600", "border-green-600", "shadow-md", "scale-105"]
            : ["bg-green-50", "border-green-100", "hover:bg-green-100"])
        );
        card.className = classes.join(" ");
        if (spanEl) {
          spanEl.className = isActive
            ? "text-[10px] font-black text-white uppercase tracking-widest"
            : "text-[10px] font-black text-green-700 uppercase tracking-widest";
        }
        if (h4El) {
          h4El.className = isActive
            ? "text-xl font-black text-white"
            : "text-xl font-black text-green-800";
        }
      } else if (cat === "PEGAWAI") {
        classes.push(
          ...(isActive
            ? ["bg-slate-800", "border-slate-800", "shadow-md", "scale-105"]
            : ["bg-slate-50", "border-slate-200", "hover:bg-slate-100"])
        );
        card.className = classes.join(" ");
        if (spanEl) {
          spanEl.className = isActive
            ? "text-[10px] font-black text-white uppercase tracking-widest"
            : "text-[10px] font-black text-slate-600 uppercase tracking-widest";
        }
        if (h4El) {
          h4El.className = isActive
            ? "text-xl font-black text-white"
            : "text-xl font-black text-slate-800";
        }
      } else if (cat === "PPD") {
        classes.push(
          ...(isActive
            ? ["bg-indigo-600", "border-indigo-600", "shadow-md", "scale-105"]
            : ["bg-indigo-50", "border-indigo-100", "hover:bg-indigo-100"])
        );
        card.className = classes.join(" ");
        if (spanEl) {
          spanEl.className = isActive
            ? "text-[10px] font-black text-white uppercase tracking-widest"
            : "text-[10px] font-black text-indigo-600 uppercase tracking-widest";
        }
        if (h4El) {
          h4El.className = isActive
            ? "text-xl font-black text-white"
            : "text-xl font-black text-indigo-800";
        }
      }
    }
  });

  const setTxt = (id, count) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = String(count);
    }
  };

  setTxt("statKebangsaan", data.filter((i) => i.peringkat === "KEBANGSAAN").length);
  setTxt(
    "statAntarabangsa",
    data.filter((i) => i.peringkat === "ANTARABANGSA" || i.jenis_rekod === "PENSIJILAN").length
  );

  const pensijilan = data.filter((i) => i.jenis_rekod === "PENSIJILAN");
  setTxt("statGoogle", pensijilan.filter((i) => i.penyedia === "GOOGLE").length);
  setTxt("statApple", pensijilan.filter((i) => i.penyedia === "APPLE").length);
  setTxt("statMicrosoft", pensijilan.filter((i) => i.penyedia === "MICROSOFT").length);
  setTxt("statLain", pensijilan.filter((i) => i.penyedia === "LAIN-LAIN").length);

  const specialCards = ["KEBANGSAAN", "ANTARABANGSA", "GOOGLE", "APPLE", "MICROSOFT", "LAIN-LAIN"];
  specialCards.forEach((card) => {
    const el = document.getElementById(`card-${card}`);
    if (el) {
      el.classList.remove(
        "ring-4",
        "ring-offset-2",
        "ring-indigo-400",
        "shadow-xl",
        "scale-[1.03]",
        "z-10",
        "opacity-60"
      );
      if (card === currentCardFilter) {
        el.classList.add(
          "ring-4",
          "ring-offset-2",
          "ring-indigo-400",
          "shadow-xl",
          "scale-[1.03]",
          "z-10"
        );
      } else if (currentCardFilter !== "ALL") {
        el.classList.add("opacity-60");
      }
    }
  });
}

function updateCloud(data) {
  const container = document.getElementById("jawatanCloudContainer");
  const wrapper = document.getElementById("jawatanCloudWrapper");
  if (!container) {
    return;
  }

  const guruData = data.filter((i) => i.kategori === "GURU" && i.jawatan);

  if (guruData.length === 0) {
    if (wrapper) {
      wrapper.classList.add("hidden");
    }
    clearElement(container);
    return;
  }

  if (wrapper) {
    wrapper.classList.remove("hidden");
  }
  const counts = {};
  guruData.forEach((i) => {
    const j = i.jawatan.trim();
    counts[j] = (counts[j] || 0) + 1;
  });

  clearElement(container);
  const fragment = document.createDocumentFragment();

  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([j, c]) => {
      const isActive = currentJawatanFilter === j;
      let sizeClass = "text-[10px]";
      if (c > 2) {
        sizeClass = "text-[11px] font-bold";
      }
      if (c > 5) {
        sizeClass = "text-[12px] font-black";
      }

      const pill = document.createElement("div");
      pill.className = `inline-flex items-center px-3 py-1 rounded-full border cursor-pointer transition-all m-1 shadow-sm ${
        isActive
          ? "bg-indigo-600 text-white border-indigo-600 scale-105 shadow-md"
          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
      }`;
      pill.addEventListener("click", () => {
        window.filterPencapaianByJawatan(j);
      });

      const labelSpan = document.createElement("span");
      labelSpan.className = sizeClass;
      labelSpan.textContent = j;

      const countSpan = document.createElement("span");
      countSpan.className = `ml-2 px-1.5 rounded-full text-[9px] font-bold ${
        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
      }`;
      countSpan.textContent = String(c);

      pill.appendChild(labelSpan);
      pill.appendChild(countSpan);
      fragment.appendChild(pill);
    });

  container.appendChild(fragment);
}

function updateProgramCloud(data) {
  const container = document.getElementById("programCloudContainer");
  const wrapper = document.getElementById("programCloudWrapper");
  if (!container) {
    return;
  }

  const programData = (data || []).filter((i) => i.nama_pertandingan);

  if (programData.length === 0) {
    if (wrapper) {
      wrapper.classList.add("hidden");
    }
    clearElement(container);
    return;
  }

  if (wrapper) {
    wrapper.classList.remove("hidden");
  }

  const counts = {};
  programData.forEach((i) => {
    const program = i.nama_pertandingan.trim();
    if (!program) {
      return;
    }
    counts[program] = (counts[program] || 0) + 1;
  });

  const sortedPrograms = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  clearElement(container);
  const fragment = document.createDocumentFragment();

  sortedPrograms.forEach(([program, count]) => {
    const isActive = currentProgramFilter.includes(program);
    let sizeClass = "text-[10px]";
    if (count > 2) {
      sizeClass = "text-[11px] font-bold";
    }
    if (count > 5) {
      sizeClass = "text-[12px] font-black";
    }

    const pill = document.createElement("div");
    pill.title = program;
    pill.className = `inline-flex items-center px-3 py-1.5 rounded-full border cursor-pointer transition-all m-1 shadow-sm max-w-full ${
      isActive
        ? "bg-indigo-600 text-white border-indigo-600 scale-105 shadow-md"
        : "bg-white text-slate-600 border-indigo-100 hover:border-indigo-400 hover:text-indigo-600"
    }`;
    pill.addEventListener("click", () => {
      window.filterPencapaianByProgram(program);
    });

    const titleSpan = document.createElement("span");
    titleSpan.className = `${sizeClass} truncate max-w-[240px]`;
    titleSpan.textContent = program;

    const countSpan = document.createElement("span");
    countSpan.className = `ml-2 px-1.5 rounded-full text-[9px] font-bold ${
      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400"
    }`;
    countSpan.textContent = String(count);

    pill.appendChild(titleSpan);
    pill.appendChild(countSpan);
    fragment.appendChild(pill);
  });

  container.appendChild(fragment);

  const btnReset = document.getElementById("btnResetProgram");
  if (btnReset) {
    btnReset.className =
      "hidden text-[10px] font-bold bg-red-500 text-white px-4 py-1.5 rounded-lg shadow-sm hover:bg-red-600 transition ml-auto flex-shrink-0 cursor-pointer flex items-center";
    setButtonIconAndText(btnReset, "fas fa-times mr-1.5", "RESET PILIHAN");

    if (currentProgramFilter.length > 0) {
      btnReset.classList.remove("hidden");
    }
  }
}

window.filterByKategori = function (k) {
  currentKategoriFilter = currentKategoriFilter === k ? "ALL" : k;
  currentJawatanFilter = "ALL";

  const elKat = document.getElementById("filterKategoriPencapaian");
  if (elKat) {
    elKat.value = currentKategoriFilter;
  }

  window.renderPencapaianTable();
};

window.filterByCard = function (c) {
  currentCardFilter = currentCardFilter === c ? "ALL" : c;
  window.renderPencapaianTable();
};

window.filterPencapaianByJawatan = function (j) {
  currentJawatanFilter = currentJawatanFilter === j ? "ALL" : j;

  const btnReset = document.getElementById("btnResetJawatan");
  if (btnReset) {
    if (currentJawatanFilter !== "ALL") {
      btnReset.classList.remove("hidden");
    } else {
      btnReset.classList.add("hidden");
    }
  }

  window.renderPencapaianTable();
};

window.filterPencapaianByProgram = function (program) {
  if (program === "ALL") {
    currentProgramFilter = [];
  } else {
    const index = currentProgramFilter.indexOf(program);
    if (index > -1) {
      currentProgramFilter.splice(index, 1);
    } else {
      currentProgramFilter.push(program);
    }
  }
  window.renderPencapaianTable();
};

window.setPencapaianDaerahFilter = function (daerah) {
  currentDaerahFilter = daerah || "ALL";
  currentProgramFilter = [];
  currentJawatanFilter = "ALL";

  const selectDaerah = document.getElementById("filterDaerahPencapaian");
  if (selectDaerah) {
    selectDaerah.value = currentDaerahFilter;
  }

  const selectSekolah = document.getElementById("filterSekolahPencapaian");
  if (selectSekolah) {
    selectSekolah.value = "ALL";
  }

  const btnResetProgram = document.getElementById("btnResetProgram");
  if (btnResetProgram) {
    btnResetProgram.classList.add("hidden");
  }

  const btnResetJawatan = document.getElementById("btnResetJawatan");
  if (btnResetJawatan) {
    btnResetJawatan.classList.add("hidden");
  }

  const scopedData = getDaerahFilteredPencapaianSource();
  populateSekolahFilter(scopedData);
  populateProgramFilter(scopedData);
  window.renderPencapaianTable();
};

window.filterBySchoolFromTop5 = function (kod) {
  const el = document.getElementById("filterSekolahPencapaian");
  if (el) {
    el.value = el.value === kod ? "ALL" : kod;
    window.renderPencapaianTable();
  }
};

window.resetPencapaianFilters = function () {
  currentCardFilter = "ALL";
  currentJawatanFilter = "ALL";
  currentKategoriFilter = "ALL";
  currentProgramFilter = [];
  currentDaerahFilter = "ALL";

  const mainSearch = document.getElementById("searchPencapaianInput");
  if (mainSearch) {
    mainSearch.value = "";
  }

  const progSearchInput = document.getElementById("progSearchInput");
  if (progSearchInput) {
    progSearchInput.value = "";
    document.querySelectorAll(".prog-item").forEach((el) => {
      el.style.display = "";
    });
  }

  const elSek = document.getElementById("filterSekolahPencapaian");
  if (elSek) {
    elSek.value = "ALL";
  }

  const elDaerah = document.getElementById("filterDaerahPencapaian");
  if (elDaerah) {
    elDaerah.value = "ALL";
  }

  const btnResetProgram = document.getElementById("btnResetProgram");
  if (btnResetProgram) {
    btnResetProgram.classList.add("hidden");
  }

  const btnResetJawatan = document.getElementById("btnResetJawatan");
  if (btnResetJawatan) {
    btnResetJawatan.classList.add("hidden");
  }

  const elKat = document.getElementById("filterKategoriPencapaian");
  if (elKat) {
    elKat.value = "ALL";
  }

  const elJenis = document.getElementById("filterJenisPencapaian");
  if (elJenis) {
    elJenis.value = "ALL";
  }

  const elTahun = document.getElementById("filterTahunPencapaian");
  if (elTahun) {
    elTahun.value = "ALL";
  }

  window.loadMasterPencapaian();
  showAlert({
    icon: "success",
    title: "Tapis Direset",
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 1000
  });
};

window.handleSort = function (col) {
  if (sortState.column === col) {
    sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
  } else {
    sortState.column = col;
    sortState.direction = "asc";
  }
  window.renderPencapaianTable();
};

window.handlePencapaianSearch = function () {
  window.renderPencapaianTable();
};

window.toggleSelectAllPencapaian = function (element) {
  const checkboxes = document.querySelectorAll(".cb-pencapaian");
  checkboxes.forEach((cb) => {
    cb.checked = Boolean(element && element.checked);
  });
  window.checkBulkStatusPencapaian();
};

window.checkBulkStatusPencapaian = function () {
  const checkboxes = document.querySelectorAll(".cb-pencapaian:checked");
  const count = checkboxes.length;

  const bulkContainer = document.getElementById("bulkActionsPencapaian");
  const countSpan = document.getElementById("countPukalPencapaian");

  if (count > 0) {
    if (bulkContainer) {
      bulkContainer.classList.remove("hidden");
    }
    if (countSpan) {
      countSpan.textContent = String(count);
    }
  } else {
    if (bulkContainer) {
      bulkContainer.classList.add("hidden");
    }
    if (countSpan) {
      countSpan.textContent = "0";
    }

    const selectAllCb = document.getElementById("selectAllPencapaian");
    if (selectAllCb) {
      selectAllCb.checked = false;
    }
  }
};

window.padamPukalPencapaianAdmin = async function () {
  const checkboxes = document.querySelectorAll(".cb-pencapaian:checked");
  if (checkboxes.length === 0) {
    return;
  }

  const idsToDelete = Array.from(checkboxes).map((cb) => cb.value);

  const result = await showAlert({
    title: "Padam Pukal Rekod?",
    text: `Anda pasti mahu memadam ${idsToDelete.length} rekod ini? Tindakan ini tidak boleh dikembalikan.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Ya, Padam Pukal",
    cancelButtonText: "Batal"
  });

  if (result && result.isConfirmed) {
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AchievementService.deleteBulk(idsToDelete);
      toggleLoading(false);

      const selectAllCb = document.getElementById("selectAllPencapaian");
      if (selectAllCb) {
        selectAllCb.checked = false;
      }
      window.checkBulkStatusPencapaian();

      await showAlert({
        icon: "success",
        title: "Dipadam",
        text: `${idsToDelete.length} rekod telah berjaya dipadam.`,
        timer: 1500,
        showConfirmButton: false
      });
      await window.loadMasterPencapaian();
    } catch {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat",
        text: "Gagal memadam rekod secara pukal."
      });
    }
  }
};

window.ubahPenyediaPukalAdmin = async function () {
  const checkboxes = document.querySelectorAll(".cb-pencapaian:checked");
  if (checkboxes.length === 0 || !window.Swal) {
    return;
  }

  const idsToUpdate = Array.from(checkboxes).map((cb) => cb.value);

  const infoDiv = document.createElement("div");
  infoDiv.className = "text-sm text-slate-600";
  infoDiv.appendChild(document.createTextNode("Sila pilih penyedia baharu untuk "));
  const boldCount = document.createElement("strong");
  boldCount.textContent = String(idsToUpdate.length);
  infoDiv.appendChild(boldCount);
  infoDiv.appendChild(document.createTextNode(" rekod pensijilan yang ditandakan."));

  const { value: newPenyedia } = await window.Swal.fire({
    title: "Ubah Penyedia (Pukal)",
    html: infoDiv,
    input: "select",
    inputOptions: {
      GOOGLE: "GOOGLE FOR EDUCATION",
      APPLE: "APPLE EDUCATION",
      MICROSOFT: "MICROSOFT EDUCATION",
      "LAIN-LAIN": "LAIN-LAIN / TIADA"
    },
    inputPlaceholder: "- Sila Pilih Penyedia -",
    showCancelButton: true,
    confirmButtonColor: "#2563eb",
    confirmButtonText: "Simpan Pukal",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" },
    inputValidator: (value) => {
      if (!value) {
        return "Anda mesti memilih salah satu penyedia!";
      }
      return null;
    }
  });

  if (newPenyedia) {
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AchievementService.batchUpdatePenyedia(idsToUpdate, newPenyedia);
      toggleLoading(false);

      const selectAllCb = document.getElementById("selectAllPencapaian");
      if (selectAllCb) {
        selectAllCb.checked = false;
      }
      window.checkBulkStatusPencapaian();

      await showAlert({
        icon: "success",
        title: "Berjaya",
        text: `${idsToUpdate.length} rekod telah dikemaskini.`,
        timer: 1500,
        showConfirmButton: false
      });
      await window.loadMasterPencapaian();
    } catch {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat",
        text: "Gagal mengubah penyedia secara pukal."
      });
    }
  }
};

window.ubahKategoriPukalAdmin = async function () {
  const checkboxes = document.querySelectorAll(".cb-pencapaian:checked");
  if (checkboxes.length === 0 || !window.Swal) {
    return;
  }

  const idsToUpdate = Array.from(checkboxes).map((cb) => cb.value);

  const infoDiv = document.createElement("div");
  infoDiv.className = "text-sm text-slate-600";
  infoDiv.appendChild(document.createTextNode("Sila pilih kategori baharu untuk "));
  const boldCount = document.createElement("strong");
  boldCount.textContent = String(idsToUpdate.length);
  infoDiv.appendChild(boldCount);
  infoDiv.appendChild(document.createTextNode(" rekod yang ditandakan."));

  const warnP = document.createElement("p");
  warnP.className = "text-xs text-red-500 font-bold mt-3";
  warnP.textContent =
    "Amaran: Pastikan rekod yang dipilih benar-benar milik kategori baharu ini.";
  infoDiv.appendChild(warnP);

  const { value: newKategori } = await window.Swal.fire({
    title: "Ubah Kategori (Pukal)",
    html: infoDiv,
    input: "select",
    inputOptions: {
      MURID: "MURID",
      GURU: "GURU",
      SEKOLAH: "SEKOLAH",
      PEGAWAI: "PEGAWAI PPD",
      PPD: "UNIT PPD"
    },
    inputPlaceholder: "- Sila Pilih Kategori -",
    showCancelButton: true,
    confirmButtonColor: "#10b981",
    confirmButtonText: "Simpan Pukal",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" },
    inputValidator: (value) => {
      if (!value) {
        return "Anda mesti memilih salah satu kategori!";
      }
      return null;
    }
  });

  if (newKategori) {
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AchievementService.batchUpdateKategori(idsToUpdate, newKategori);
      toggleLoading(false);

      const selectAllCb = document.getElementById("selectAllPencapaian");
      if (selectAllCb) {
        selectAllCb.checked = false;
      }
      window.checkBulkStatusPencapaian();

      await showAlert({
        icon: "success",
        title: "Berjaya",
        text: `${idsToUpdate.length} rekod telah dikemaskini kategorinya.`,
        timer: 1500,
        showConfirmButton: false
      });
      await window.loadMasterPencapaian();
    } catch {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat",
        text: "Gagal mengubah kategori secara pukal."
      });
    }
  }
};

window.openEditPencapaian = function (id) {
  const item = pencapaianList.find((i) => String(i.id) === String(id));
  if (!item) {
    return;
  }

  populateDropdown("editInputJawatan", "JAWATAN", item.jawatan);
  populateDropdown("editInputPeringkat", "PERINGKAT", item.peringkat);
  populateDropdown("editInputPenyedia", "PENYEDIA", item.penyedia);
  populateDropdown("editInputTahun", "TAHUN", item.tahun);

  const editIdEl = document.getElementById("editIdPencapaian");
  const editSekEl = document.getElementById("editNamaSekolah");
  const editNamaEl = document.getElementById("editInputNama");
  const editProgEl = document.getElementById("editInputProgram");
  const editPencEl = document.getElementById("editInputPencapaian");
  const editFileEl = document.getElementById("editInputFileAdmin");

  if (editIdEl) {
    editIdEl.value = id;
  }
  if (editSekEl) {
    editSekEl.value = item.kod_sekolah || "";
  }
  if (editNamaEl) {
    editNamaEl.value = item.nama_peserta || "";
  }
  if (editProgEl) {
    editProgEl.value = item.nama_pertandingan || "";
  }
  if (editPencEl) {
    editPencEl.value = item.pencapaian || "";
  }
  if (editFileEl) {
    editFileEl.value = "";
  }

  const currentProofLinkAdmin = document.getElementById("currentProofLinkAdmin");
  if (currentProofLinkAdmin) {
    const safeProof = sanitizeExternalUrl(item.pautan_bukti);
    if (safeProof) {
      currentProofLinkAdmin.href = safeProof;
      currentProofLinkAdmin.classList.remove("pointer-events-none", "opacity-40");
    } else {
      currentProofLinkAdmin.href = "#";
      currentProofLinkAdmin.classList.add("pointer-events-none", "opacity-40");
    }
  }

  const radPensijilan = document.getElementById("editRadioPensijilan");
  const radPertandingan = document.getElementById("editRadioPertandingan");
  if (item.jenis_rekod === "PENSIJILAN") {
    if (radPensijilan) {
      radPensijilan.checked = true;
    }
  } else if (radPertandingan) {
    radPertandingan.checked = true;
  }

  const divJawatan = document.getElementById("divEditJawatan");
  if (divJawatan) {
    if (item.kategori === "GURU") {
      divJawatan.classList.remove("hidden");
    } else {
      divJawatan.classList.add("hidden");
    }
  }

  window.toggleEditJenis();
  const modal = document.getElementById("modalEditPencapaian");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

window.toggleEditJenis = function () {
  const jenisInput = document.querySelector('input[name="editRadioJenis"]:checked');
  if (!jenisInput) {
    return;
  }
  const jenis = jenisInput.value;

  const divPenyedia = document.getElementById("divEditPenyedia");
  const colPeringkat = document.getElementById("divEditColPeringkat");
  const lblProg = document.getElementById("lblEditProgramAdmin");
  const lblPenc = document.getElementById("lblEditPencapaianAdmin");

  if (jenis === "PENSIJILAN") {
    if (divPenyedia) {
      divPenyedia.classList.remove("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.add("hidden");
    }
    if (lblProg) {
      lblProg.textContent = "NAMA SIJIL / PROGRAM";
    }
    if (lblPenc) {
      lblPenc.textContent = "TAHAP / SKOR";
    }
  } else {
    if (divPenyedia) {
      divPenyedia.classList.add("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.remove("hidden");
    }
    if (lblProg) {
      lblProg.textContent = "NAMA PERTANDINGAN";
    }
    if (lblPenc) {
      lblPenc.textContent = "PENCAPAIAN";
    }
  }
};

window.simpanEditPencapaian = async function () {
  if (editSubmitBusy) {
    return;
  }

  const idEl = document.getElementById("editIdPencapaian");
  const id = idEl ? idEl.value : "";
  const jenisInput = document.querySelector('input[name="editRadioJenis"]:checked');
  const fileInput = document.getElementById("editInputFileAdmin");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  const btn = document.querySelector('#formEditPencapaian button[type="submit"]');

  if (!jenisInput || !id) {
    return;
  }
  const jenis = jenisInput.value;

  const maxMb =
    APP_CONFIG && APP_CONFIG.UPLOADS && typeof APP_CONFIG.UPLOADS.MAX_FILE_SIZE_MB === "number"
      ? APP_CONFIG.UPLOADS.MAX_FILE_SIZE_MB
      : 5;

  if (file && file.size > maxMb * 1024 * 1024) {
    return showAlert({
      icon: "warning",
      title: "Ralat Saiz",
      text: `Maksimum saiz fail adalah ${maxMb}MB`
    });
  }

  editSubmitBusy = true;
  if (btn) {
    btn.disabled = true;
    btn.classList.add("opacity-75");
  }
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();

    let finalUrl = "";
    if (file) {
      setButtonIconAndText(btn, "fas fa-circle-notch fa-spin me-2", "MEMUAT NAIK FAIL...");
      finalUrl = await uploadFileToDrive(file);
    } else {
      const item = pencapaianList.find((i) => String(i.id) === String(id));
      finalUrl = item ? item.pautan_bukti : "";
    }

    setButtonIconAndText(btn, "fas fa-circle-notch fa-spin me-2", "MENYIMPAN KEMASKINI...");

    const payload = {
      nama_peserta: document.getElementById("editInputNama").value.toUpperCase(),
      nama_pertandingan: document.getElementById("editInputProgram").value.toUpperCase(),
      pencapaian: document.getElementById("editInputPencapaian").value.toUpperCase(),
      pautan_bukti: finalUrl,
      tahun: parseInt(document.getElementById("editInputTahun").value, 10),
      jenis_rekod: jenis
    };

    const divJawatan = document.getElementById("divEditJawatan");
    if (divJawatan && !divJawatan.classList.contains("hidden")) {
      payload.jawatan = document.getElementById("editInputJawatan").value;
      payload.kategori = "GURU";
    }

    if (jenis === "PENSIJILAN") {
      payload.penyedia = document.getElementById("editInputPenyedia").value;
      payload.peringkat = "ANTARABANGSA";
    } else {
      payload.peringkat = document.getElementById("editInputPeringkat").value;
    }

    await AchievementService.update(id, payload);
    toggleLoading(false);

    const modal = document.getElementById("modalEditPencapaian");
    if (modal) {
      modal.classList.add("hidden");
    }

    await showAlert({
      icon: "success",
      title: "Tersimpan",
      text: "Rekod telah dikemaskini.",
      timer: 1500,
      showConfirmButton: false
    });
    await window.loadMasterPencapaian();
  } catch (e) {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: e && e.message ? e.message : "Gagal mengemaskini rekod."
    });
  } finally {
    editSubmitBusy = false;
    if (btn) {
      btn.disabled = false;
      setButtonIconAndText(btn, null, "SIMPAN PERUBAHAN");
      btn.classList.remove("opacity-75");
    }
  }
};

window.openModalPPD = function () {
  const currentYear = String(new Date().getFullYear());
  populateDropdown("ppdInputPeringkat", "PERINGKAT", "KEBANGSAAN");
  populateDropdown("ppdInputPenyedia", "PENYEDIA", "LAIN-LAIN");
  populateDropdown("ppdInputTahun", "TAHUN", currentYear);

  const modal = document.getElementById("modalRekodPPD");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

window.toggleKategoriPPD = function () {
  const radUnit = document.getElementById("radUnit");
  const isUnit = Boolean(radUnit && radUnit.checked);
  const lbl = document.getElementById("lblPpdNamaPeserta");
  const inp = document.getElementById("ppdInputNama");

  if (isUnit) {
    if (lbl) {
      lbl.textContent = "NAMA UNIT / SEKTOR";
    }
    if (inp) {
      inp.placeholder = "CONTOH: SEKTOR PEMBELAJARAN";
    }
  } else {
    if (lbl) {
      lbl.textContent = "NAMA PEGAWAI";
    }
    if (inp) {
      inp.placeholder = "TAIP NAMA PENUH...";
    }
  }
};

window.toggleJenisPencapaianPPD = function () {
  const radPensijilan = document.getElementById("radPpdPensijilan");
  const isPensijilan = Boolean(radPensijilan && radPensijilan.checked);
  const hiddenJenis = document.getElementById("ppdInputJenisRekod");
  if (hiddenJenis) {
    hiddenJenis.value = isPensijilan ? "PENSIJILAN" : "PERTANDINGAN";
  }

  const divPenyedia = document.getElementById("divPpdPenyedia");
  const colPeringkat = document.getElementById("divPpdColPeringkat");
  const lblProg = document.getElementById("lblPpdProgram");
  const inpProg = document.getElementById("ppdInputProgram");
  const lblPenc = document.getElementById("lblPpdPencapaian");
  const inpPenc = document.getElementById("ppdInputPencapaian");

  if (isPensijilan) {
    if (divPenyedia) {
      divPenyedia.classList.remove("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.add("hidden");
    }
    if (lblProg) {
      lblProg.textContent = "NAMA SIJIL / PROGRAM";
    }
    if (inpProg) {
      inpProg.placeholder = "CONTOH: GOOGLE CERTIFIED EDUCATOR L1";
    }
    if (lblPenc) {
      lblPenc.textContent = "TAHAP / SKOR / BAND";
    }
    if (inpPenc) {
      inpPenc.placeholder = "CONTOH: LULUS / BAND C2";
    }
  } else {
    if (divPenyedia) {
      divPenyedia.classList.add("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.remove("hidden");
    }
    if (lblProg) {
      lblProg.textContent = "NAMA PERTANDINGAN";
    }
    if (inpProg) {
      inpProg.placeholder = "CONTOH: DIGITAL COMPETENCY 2025";
    }
    if (lblPenc) {
      lblPenc.textContent = "PENCAPAIAN";
    }
    if (inpPenc) {
      inpPenc.placeholder = "CONTOH: JOHAN / EMAS";
    }
  }
};

window.simpanPencapaianPPD = async function () {
  if (ppdSubmitBusy) {
    return;
  }

  const btn = document.querySelector('#formPencapaianPPD button[type="submit"]');
  const radKategoriInput = document.querySelector('input[name="radKatPPD"]:checked');
  if (!radKategoriInput) {
    return;
  }
  const radKategori = radKategoriInput.value;

  const jenisRekod = document.getElementById("ppdInputJenisRekod").value;
  const nama = document.getElementById("ppdInputNama").value.trim().toUpperCase();
  const fileInput = document.getElementById("ppdInputFile");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  let peringkat = "KEBANGSAAN";
  let penyedia = "LAIN-LAIN";
  const tahunVal = document.getElementById("ppdInputTahun").value;
  const tahun = parseInt(tahunVal, 10);

  if (jenisRekod === "PENSIJILAN") {
    penyedia = document.getElementById("ppdInputPenyedia").value;
    peringkat = "ANTARABANGSA";
  } else {
    peringkat = document.getElementById("ppdInputPeringkat").value;
  }

  const program = document.getElementById("ppdInputProgram").value.trim().toUpperCase();
  const pencapaian = document.getElementById("ppdInputPencapaian").value.trim().toUpperCase();

  if (!nama || !program || !pencapaian || !file || !tahun) {
    return showAlert({
      icon: "warning",
      title: "Tidak Lengkap",
      text: "Sila isi semua maklumat dan fail bukti."
    });
  }

  const maxMb =
    APP_CONFIG && APP_CONFIG.UPLOADS && typeof APP_CONFIG.UPLOADS.MAX_FILE_SIZE_MB === "number"
      ? APP_CONFIG.UPLOADS.MAX_FILE_SIZE_MB
      : 5;

  if (file.size > maxMb * 1024 * 1024) {
    return showAlert({
      icon: "warning",
      title: "Fail Terlalu Besar",
      text: `Maksimum saiz fail adalah ${maxMb}MB.`
    });
  }

  ppdSubmitBusy = true;
  if (btn) {
    btn.disabled = true;
    setButtonIconAndText(btn, "fas fa-circle-notch fa-spin me-2", "MEMUAT NAIK FAIL...");
    btn.classList.add("opacity-75");
  }
  toggleLoading(true);

  const userKod = localStorage.getItem(getSessionKey("USER_KOD")) || "M030";

  try {
    await envReady;
    await initDatabaseClient();

    const uploadedUrl = await uploadFileToDrive(file);

    setButtonIconAndText(btn, "fas fa-circle-notch fa-spin me-2", "MENYIMPAN REKOD PPD...");

    const payload = {
      kod_sekolah: userKod,
      kategori: radKategori,
      nama_peserta: nama,
      nama_pertandingan: program,
      peringkat,
      tahun,
      pencapaian,
      pautan_bukti: uploadedUrl,
      jenis_rekod: jenisRekod,
      penyedia
    };

    await AchievementService.create(payload);

    toggleLoading(false);

    const modal = document.getElementById("modalRekodPPD");
    if (modal) {
      modal.classList.add("hidden");
    }
    const form = document.getElementById("formPencapaianPPD");
    if (form) {
      form.reset();
    }
    if (fileInput) {
      fileInput.value = "";
    }

    await showAlert({
      icon: "success",
      title: "Berjaya",
      text: "Rekod PPD telah disimpan."
    });
    await window.loadMasterPencapaian();
  } catch (e) {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat",
      text: e && e.message ? e.message : "Gagal menyimpan rekod."
    });
  } finally {
    ppdSubmitBusy = false;
    if (btn) {
      btn.disabled = false;
      setButtonIconAndText(btn, "fas fa-save mr-2", "Simpan Rekod PPD");
      btn.classList.remove("opacity-75");
    }
  }
};

window.hapusPencapaianAdmin = async function (id) {
  const result = await showAlert({
    title: "Padam Rekod?",
    text: "Tindakan ini tidak boleh dikembalikan.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Ya, Padam",
    cancelButtonText: "Batal"
  });

  if (result && result.isConfirmed) {
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AchievementService.delete(id);
      toggleLoading(false);
      await showAlert({
        icon: "success",
        title: "Dipadam",
        timer: 1000,
        showConfirmButton: false
      });
      await window.loadMasterPencapaian();
    } catch {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat",
        text: "Gagal memadam."
      });
    }
  }
};

window.eksportPencapaian = function () {
  if (!currentPencapaianFiltered || currentPencapaianFiltered.length === 0) {
    showAlert({
      icon: "info",
      title: "Tiada Data",
      text: "Tiada rekod untuk dieksport."
    });
    return;
  }

  let csvContent =
    "BIL,KOD,NAMA SEKOLAH,JENIS REKOD,KATEGORI,PESERTA,JAWATAN,PROGRAM,PERINGKAT,PENCAPAIAN,TAHUN,PAUTAN BUKTI\n";

  const senaraiKodPPD = getPpdCodeList();

  currentPencapaianFiltered.forEach((i, index) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;

    let namaSekolah = i.kod_sekolah;
    if (senaraiKodPPD.includes(i.kod_sekolah)) {
      const ppdName = getPpdName(i.kod_sekolah);
      namaSekolah = ppdName ? `PPD ${ppdName}` : "PEJABAT PENDIDIKAN DAERAH";
    } else if (Array.isArray(window.globalDashboardData)) {
      const s = window.globalDashboardData.find((x) => x.kod_sekolah === i.kod_sekolah);
      if (s && s.nama_sekolah) {
        namaSekolah = s.nama_sekolah;
      }
    }

    const row = [
      index + 1,
      clean(i.kod_sekolah),
      clean(namaSekolah),
      clean(i.jenis_rekod),
      clean(i.kategori),
      clean(i.nama_peserta),
      clean(i.jawatan || "-"),
      clean(i.nama_pertandingan),
      clean(i.peringkat || "-"),
      clean(i.pencapaian),
      i.tahun,
      clean(i.pautan_bukti)
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Laporan_Pencapaian_NaDIM_${new Date().toISOString().slice(0, 10)}.csv`;
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

window.refreshStandardizeUI = function () {
  const counts = {};
  standardizationList = [];
  filteredStandardizationList = [];

  pencapaianList.forEach((item) => {
    const prog = item.nama_pertandingan || "TIADA NAMA";
    const skor = item.pencapaian || "TIADA SKOR";
    const key = `${prog} | ${skor}`;

    if (!counts[key]) {
      counts[key] = { prog, skor, count: 0 };
    }
    counts[key].count += 1;
  });

  Object.keys(counts)
    .sort()
    .forEach((key) => {
      standardizationList.push({
        key,
        prog: counts[key].prog,
        skor: counts[key].skor,
        count: counts[key].count
      });
    });

  filteredStandardizationList = standardizationList;

  const searchEl = document.getElementById("standardizeSearch");
  const searchVal = searchEl ? searchEl.value : "";
  if (searchVal) {
    window.handleStandardizeSearch(searchVal);
  } else {
    window.renderStandardizeTable(filteredStandardizationList);
  }
};

window.openStandardizeModal = function () {
  const searchEl = document.getElementById("standardizeSearch");
  if (searchEl) {
    searchEl.value = "";
  }
  window.refreshStandardizeUI();
  const modal = document.getElementById("modalStandardize");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

window.renderStandardizeTable = function (list) {
  const tbody = document.getElementById("tbodyStandardize");
  if (!tbody) {
    return;
  }

  clearElement(tbody);
  const fragment = document.createDocumentFragment();

  if (!Array.isArray(list) || list.length === 0) {
    const emptyTr = document.createElement("tr");
    const emptyTd = document.createElement("td");
    emptyTd.colSpan = 5;
    emptyTd.className = "text-center py-5 text-slate-400 font-bold";
    emptyTd.textContent = "Tiada padanan carian.";
    emptyTr.appendChild(emptyTd);
    fragment.appendChild(emptyTr);
    tbody.appendChild(fragment);
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayList = list.slice(0, limit);

  displayList.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.className =
      "border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors";

    const tdBil = document.createElement("td");
    tdBil.className = "text-center font-bold text-xs text-slate-300 p-4 align-top pt-6";
    tdBil.textContent = String(index + 1);

    const tdAsal = document.createElement("td");
    tdAsal.className = "p-4 align-top";

    const progDiv = document.createElement("div");
    progDiv.className = "font-bold text-slate-800 text-xs leading-snug mb-2 uppercase break-words";
    progDiv.textContent = item.prog;

    const skorDiv = document.createElement("div");
    skorDiv.className =
      "text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block uppercase tracking-widest";
    skorDiv.textContent = item.skor;

    tdAsal.appendChild(progDiv);
    tdAsal.appendChild(skorDiv);

    const tdCount = document.createElement("td");
    tdCount.className = "text-center p-4 align-top pt-6";
    const countBadge = document.createElement("span");
    countBadge.className =
      "bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[10px] font-black border border-indigo-100 shadow-sm";
    countBadge.textContent = `${item.count} REKOD`;
    tdCount.appendChild(countBadge);

    const tdInputs = document.createElement("td");
    tdInputs.className = "p-4 align-top";

    const inputStack = document.createElement("div");
    inputStack.className = "flex flex-col gap-2";

    const progWrap = document.createElement("div");
    const progLbl = document.createElement("label");
    progLbl.className =
      "block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1";
    progLbl.setAttribute("for", `std-prog-${index}`);
    progLbl.textContent = "Nama Program";

    const progInput = document.createElement("input");
    progInput.type = "text";
    progInput.id = `std-prog-${index}`;
    progInput.className =
      "w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-bold text-xs uppercase-input focus:border-indigo-500 outline-none bg-white shadow-sm";
    progInput.placeholder = "Kemas kini program...";
    progInput.value = item.prog;
    progInput.addEventListener("input", () => {
      progInput.value = progInput.value.toUpperCase();
    });

    progWrap.appendChild(progLbl);
    progWrap.appendChild(progInput);

    const skorWrap = document.createElement("div");
    const skorLbl = document.createElement("label");
    skorLbl.className =
      "block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1";
    skorLbl.setAttribute("for", `std-skor-${index}`);
    skorLbl.textContent = "Skor Pencapaian";

    const skorInput = document.createElement("input");
    skorInput.type = "text";
    skorInput.id = `std-skor-${index}`;
    skorInput.className =
      "w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 text-emerald-700 font-bold text-xs uppercase-input focus:border-emerald-500 outline-none bg-emerald-50 shadow-sm";
    skorInput.placeholder = "Kemas kini skor...";
    skorInput.value = item.skor;
    skorInput.addEventListener("input", () => {
      skorInput.value = skorInput.value.toUpperCase();
    });

    skorWrap.appendChild(skorLbl);
    skorWrap.appendChild(skorInput);

    inputStack.appendChild(progWrap);
    inputStack.appendChild(skorWrap);
    tdInputs.appendChild(inputStack);

    const tdAction = document.createElement("td");
    tdAction.className = "text-center p-4 align-middle";

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className =
      "w-full min-h-[44px] px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black shadow-md transition transform active:scale-95 flex flex-col items-center gap-1 justify-center";

    const magicIcon = document.createElement("i");
    magicIcon.className = "fas fa-magic text-sm mb-0.5";
    applyBtn.appendChild(magicIcon);
    applyBtn.appendChild(document.createTextNode("SET KEMASKINI"));

    applyBtn.addEventListener("click", () => {
      window.executeStandardization(index, item.prog, item.skor);
    });

    tdAction.appendChild(applyBtn);

    tr.appendChild(tdBil);
    tr.appendChild(tdAsal);
    tr.appendChild(tdCount);
    tr.appendChild(tdInputs);
    tr.appendChild(tdAction);
    fragment.appendChild(tr);
  });

  if (list.length > limit) {
    const limitTr = document.createElement("tr");
    limitTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
    const limitTd = document.createElement("td");
    limitTd.colSpan = 5;
    limitTd.className = "p-3 px-6 text-center text-xs font-bold text-amber-800";

    const icon = document.createElement("i");
    icon.className = "fas fa-info-circle text-amber-500 mr-1.5";
    limitTd.appendChild(icon);
    limitTd.appendChild(document.createTextNode("Memaparkan "));
    const bLimit = document.createElement("strong");
    bLimit.textContent = String(limit);
    limitTd.appendChild(bLimit);
    limitTd.appendChild(document.createTextNode(" daripada "));
    const bTotal = document.createElement("strong");
    bTotal.textContent = String(list.length);
    limitTd.appendChild(bTotal);
    limitTd.appendChild(
      document.createTextNode(" kombinasi data. Gunakan carian di atas untuk kombinasi tertentu.")
    );

    limitTr.appendChild(limitTd);
    fragment.appendChild(limitTr);
  }

  tbody.appendChild(fragment);
};

window.handleStandardizeSearch = function (val) {
  const term = String(val || "").toUpperCase().trim();
  if (!term) {
    filteredStandardizationList = standardizationList;
  } else {
    filteredStandardizationList = standardizationList.filter(
      (item) =>
        item.prog.toUpperCase().includes(term) || item.skor.toUpperCase().includes(term)
    );
  }
  window.renderStandardizeTable(filteredStandardizationList);
};

window.executeStandardization = async function (index, oldProg, oldSkor) {
  const progEl = document.getElementById(`std-prog-${index}`);
  const skorEl = document.getElementById(`std-skor-${index}`);
  const newProg = progEl ? progEl.value.trim().toUpperCase() : "";
  const newSkor = skorEl ? skorEl.value.trim().toUpperCase() : "";

  if (!newProg || !newSkor) {
    return showAlert({
      icon: "warning",
      title: "Ralat",
      text: "Nama program dan skor tidak boleh dibiarkan kosong."
    });
  }
  if (newProg === oldProg && newSkor === oldSkor) {
    return showAlert({
      icon: "info",
      title: "Tiada Perubahan",
      text: "Tiada data yang diubah."
    });
  }

  const wrapper = document.createElement("div");

  const card = document.createElement("div");
  card.className = "text-left text-sm bg-slate-50 p-4 rounded-xl border border-slate-200";

  const oldP = document.createElement("p");
  oldP.className = "mb-2";
  const oldLbl = document.createElement("span");
  oldLbl.className = "font-bold text-slate-500 text-[10px] uppercase block";
  oldLbl.textContent = "Data Asal:";
  const oldProgText = document.createElement("span");
  oldProgText.className = "block break-words";
  oldProgText.textContent = oldProg;
  const oldSkorText = document.createElement("span");
  oldSkorText.className = "text-emerald-600 font-bold text-xs block";
  oldSkorText.textContent = oldSkor;
  oldP.appendChild(oldLbl);
  oldP.appendChild(oldProgText);
  oldP.appendChild(oldSkorText);

  const hr = document.createElement("hr");
  hr.className = "my-2 border-slate-200";

  const newP = document.createElement("p");
  const newLbl = document.createElement("span");
  newLbl.className = "font-bold text-slate-500 text-[10px] uppercase block";
  newLbl.textContent = "Data Baharu:";
  const newProgText = document.createElement("span");
  newProgText.className = "font-bold text-indigo-700 block break-words";
  newProgText.textContent = newProg;
  const newSkorText = document.createElement("span");
  newSkorText.className = "text-emerald-600 font-bold text-xs block";
  newSkorText.textContent = newSkor;
  newP.appendChild(newLbl);
  newP.appendChild(newProgText);
  newP.appendChild(newSkorText);

  card.appendChild(oldP);
  card.appendChild(hr);
  card.appendChild(newP);

  const warnP = document.createElement("p");
  warnP.className = "mt-4 text-xs font-bold text-red-500";
  warnP.textContent =
    "Amaran: Semua rekod yang sepadan dengan data asal akan dikemaskini serentak.";

  wrapper.appendChild(card);
  wrapper.appendChild(warnP);

  const result = await showAlert({
    title: "Sahkan Penyeragaman Komposit?",
    html: wrapper,
    text: `Seragamkan '${oldProg}' (${oldSkor}) kepada '${newProg}' (${newSkor})?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#1e293b",
    confirmButtonText: "Ya, Seragamkan!",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" }
  });

  if (result && result.isConfirmed) {
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AchievementService.batchUpdateStandardize(oldProg, oldSkor, newProg, newSkor);

      toggleLoading(false);
      await showAlert({
        title: "Berjaya!",
        text: "Data gabungan telah diseragamkan.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
      await window.loadMasterPencapaian();
      window.refreshStandardizeUI();
    } catch {
      toggleLoading(false);
      showAlert({
        icon: "error",
        title: "Ralat",
        text: "Gagal mengemaskini data ke pangkalan data."
      });
    }
  }
};