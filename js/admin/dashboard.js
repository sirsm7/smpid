import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { SchoolService } from "../services/school.service.js";
import { toggleLoading, generateWhatsAppLink } from "../core/helpers.js";

let dashboardData = [];
let currentFilteredList = [];
let activeStatus = "ALL";
let activeType = "ALL";
let activeDaerah = "ALL";
let searchTerm = "";
let reminderQueue = [];
let qIndex = 0;
let realtimeSubscribed = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function applyRbacAndSplitSchools(rawList) {
  let data = Array.isArray(rawList) ? rawList : [];
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

  if (
    ["ADMIN", "PPD_UNIT"].includes(userRole) &&
    userKod &&
    APP_CONFIG.PPD_MAPPING &&
    APP_CONFIG.PPD_MAPPING[userKod]
  ) {
    const daerahDibenarkan = APP_CONFIG.PPD_MAPPING[userKod];
    data = data.filter(
      (item) => item.daerah === daerahDibenarkan || item.kod_sekolah === userKod
    );
  }

  window.globalDashboardData = data;

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  dashboardData = data.filter((item) => !senaraiKodPPD.includes(item.kod_sekolah));
}

async function silentRefreshDashboardData() {
  try {
    await envReady;
    await initDatabaseClient();
    const freshData = await SchoolService.getAll();
    applyRbacAndSplitSchools(freshData);
    window.runFilter();
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_dashboard_schools",
    table: "smpid_sekolah_data",
    primaryKey: "kod_sekolah",
    cacheStore:
      APP_CONFIG.IDB && APP_CONFIG.IDB.STORES
        ? APP_CONFIG.IDB.STORES.SCHOOLS
        : "schools_cache",
    cachePrefix: "schools",
    onChange: async () => {
      await silentRefreshDashboardData();
    },
    onSync: async () => {
      await silentRefreshDashboardData();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

window.fetchDashboardData = async function () {
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    const data = await SchoolService.getAll();

    applyRbacAndSplitSchools(data);
    renderFilters();
    window.runFilter();
    ensureRealtimeSync();
  } catch {
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire("Ralat", "Gagal memuatkan data dashboard.", "error");
    }
  } finally {
    toggleLoading(false);
  }
};

function createFilterButton(statusKey, labelText, countId, baseClass, badgeClass) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id =
    statusKey === "ALL"
      ? "badgeAll"
      : statusKey === "LENGKAP"
        ? "badgeLengkap"
        : statusKey === "BELUM"
          ? "badgeBelum"
          : statusKey === "SAMA"
            ? "badgeSama"
            : statusKey === "BERBEZA"
              ? "badgeBerbeza"
              : "badgeTiadaPengurusan";
  btn.className = baseClass;
  btn.appendChild(document.createTextNode(`${labelText} `));

  const countSpan = document.createElement("span");
  countSpan.id = countId;
  countSpan.className = badgeClass;
  countSpan.textContent = "0";
  btn.appendChild(countSpan);

  btn.addEventListener("click", () => {
    window.setFilter(statusKey);
  });

  return btn;
}

function renderFilters() {
  const container = document.getElementById("filterContainer");
  if (!container) {
    return;
  }

  const types = [...new Set(dashboardData.map((i) => i.jenis).filter(Boolean))].sort();
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

  const outerBox = document.createElement("div");
  outerBox.className =
    "flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100";

  const leftGroup = document.createElement("div");
  leftGroup.className = "flex flex-wrap gap-2 justify-center md:justify-start";

  const filterDefinitions = [
    {
      key: "ALL",
      label: "Semua",
      cntId: "cntAll",
      btnCls:
        "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200",
      cntCls: "bg-white text-slate-600 px-2 py-0.5 rounded-full text-[10px] shadow-sm"
    },
    {
      key: "LENGKAP",
      label: "Lengkap",
      cntId: "cntLengkap",
      btnCls:
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50",
      cntCls: "bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px]"
    },
    {
      key: "BELUM",
      label: "Belum",
      cntId: "cntBelum",
      btnCls:
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-red-200 text-red-600 hover:bg-red-50",
      cntCls: "bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px]"
    },
    {
      key: "SAMA",
      label: "Sama",
      cntId: "cntSama",
      btnCls:
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-purple-200 text-purple-600 hover:bg-purple-50",
      cntCls: "bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px]"
    },
    {
      key: "BERBEZA",
      label: "Berbeza",
      cntId: "cntBerbeza",
      btnCls:
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-amber-200 text-amber-600 hover:bg-amber-50",
      cntCls: "bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px]"
    },
    {
      key: "TIADA_PENGURUSAN",
      label: "Tiada PGB/GPK",
      cntId: "cntTiadaPengurusan",
      btnCls:
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-rose-200 text-rose-600 hover:bg-rose-50",
      cntCls: "bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px]"
    }
  ];

  filterDefinitions.forEach((def) => {
    leftGroup.appendChild(
      createFilterButton(def.key, def.label, def.cntId, def.btnCls, def.cntCls)
    );
  });

  const rightGroup = document.createElement("div");
  rightGroup.className = "flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end";

  if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
    const daerahSelect = document.createElement("select");
    daerahSelect.id = "filterDaerahSelect";
    daerahSelect.className =
      "w-full md:w-40 min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-brand-500 bg-slate-50 text-slate-700";

    const allDaerahOpt = document.createElement("option");
    allDaerahOpt.value = "ALL";
    allDaerahOpt.textContent = "SEMUA DAERAH";
    daerahSelect.appendChild(allDaerahOpt);

    if (APP_CONFIG.PPD_MAPPING) {
      const uniqueDaerahs = [...new Set(Object.values(APP_CONFIG.PPD_MAPPING))].sort();
      uniqueDaerahs.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        daerahSelect.appendChild(opt);
      });
    }

    daerahSelect.value = activeDaerah;
    daerahSelect.addEventListener("change", (e) => {
      window.setDaerah(e.target.value);
    });
    rightGroup.appendChild(daerahSelect);
  }

  const typeSelect = document.createElement("select");
  typeSelect.id = "filterTypeSelect";
  typeSelect.className =
    "w-full md:w-48 min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold outline-none focus:border-brand-500 bg-slate-50";

  const allTypeOpt = document.createElement("option");
  allTypeOpt.value = "ALL";
  allTypeOpt.textContent = "SEMUA JENIS";
  typeSelect.appendChild(allTypeOpt);

  types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  });

  typeSelect.value = activeType;
  typeSelect.addEventListener("change", (e) => {
    window.setType(e.target.value);
  });
  rightGroup.appendChild(typeSelect);

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className =
    "min-w-[40px] min-h-[40px] bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-red-200 transition-colors shadow-sm inline-flex items-center justify-center";
  resetBtn.title = "Reset Semua Filter";
  const resetIcon = document.createElement("i");
  resetIcon.className = "fas fa-sync-alt";
  resetBtn.appendChild(resetIcon);
  resetBtn.addEventListener("click", () => {
    window.resetDashboardFilters();
  });
  rightGroup.appendChild(resetBtn);

  outerBox.appendChild(leftGroup);
  outerBox.appendChild(rightGroup);

  clearElement(container);
  container.appendChild(outerBox);
}

window.setFilter = function (s) {
  activeStatus = s;
  window.runFilter();
};

window.setType = function (t) {
  activeType = t;
  window.runFilter();
};

window.setDaerah = function (d) {
  activeDaerah = d;
  window.runFilter();
};

window.handleSearch = function (val) {
  searchTerm = String(val || "").toUpperCase().trim();
  window.runFilter();
};

window.resetDashboardFilters = function () {
  activeStatus = "ALL";
  activeType = "ALL";
  activeDaerah = "ALL";
  searchTerm = "";

  const searchInput = document.getElementById("adminSearchInput");
  if (searchInput) {
    searchInput.value = "";
  }

  const typeSelect = document.getElementById("filterTypeSelect");
  if (typeSelect) {
    typeSelect.value = "ALL";
  }

  const daerahSelect = document.getElementById("filterDaerahSelect");
  if (daerahSelect) {
    daerahSelect.value = "ALL";
  }

  window.runFilter();

  if (typeof window !== "undefined" && window.Swal) {
    window.Swal.fire({
      icon: "success",
      title: "Filter Direset",
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 1000
    });
  }
};

window.runFilter = function () {
  const filtered = dashboardData.filter((i) => {
    const statMatch =
      activeStatus === "ALL" ||
      (activeStatus === "LENGKAP" && i.is_lengkap) ||
      (activeStatus === "BELUM" && !i.is_lengkap) ||
      (activeStatus === "SAMA" && i.is_sama) ||
      (activeStatus === "BERBEZA" && i.is_berbeza) ||
      (activeStatus === "TIADA_PENGURUSAN" && (!i.nama_pgb || !i.nama_gpk));

    const typeMatch = activeType === "ALL" || i.jenis === activeType;
    const daerahMatch = activeDaerah === "ALL" || i.daerah === activeDaerah;

    const searchMatch =
      !searchTerm ||
      (i.kod_sekolah && i.kod_sekolah.includes(searchTerm)) ||
      (i.nama_sekolah && i.nama_sekolah.includes(searchTerm)) ||
      (i.nama_pgb && i.nama_pgb.includes(searchTerm)) ||
      (i.nama_gpk && i.nama_gpk.includes(searchTerm));

    return statMatch && typeMatch && searchMatch && daerahMatch;
  });

  currentFilteredList = filtered;
  updateBadgeCounts();
  renderGrid(filtered);
  renderSmartBoardKPI(filtered);
};

function updateBadgeCounts() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.remove("ring-2", "ring-offset-1", "shadow-md", "scale-105");
    if (btn.id === "badgeAll") {
      btn.className =
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
    } else if (btn.id === "badgeLengkap") {
      btn.className =
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50";
    } else if (btn.id === "badgeBelum") {
      btn.className =
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-red-200 text-red-600 hover:bg-red-50";
    } else if (btn.id === "badgeSama") {
      btn.className =
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-purple-200 text-purple-600 hover:bg-purple-50";
    } else if (btn.id === "badgeBerbeza") {
      btn.className =
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-amber-200 text-amber-600 hover:bg-amber-50";
    } else if (btn.id === "badgeTiadaPengurusan") {
      btn.className =
        "filter-btn min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-white border-rose-200 text-rose-600 hover:bg-rose-50";
    }
  });

  const map = {
    ALL: "badgeAll",
    LENGKAP: "badgeLengkap",
    BELUM: "badgeBelum",
    SAMA: "badgeSama",
    BERBEZA: "badgeBerbeza",
    TIADA_PENGURUSAN: "badgeTiadaPengurusan"
  };

  const activeId = map[activeStatus];
  if (activeId) {
    const btn = document.getElementById(activeId);
    if (btn) {
      if (activeStatus === "ALL") {
        btn.className =
          "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-slate-600 text-white border-slate-600 shadow-md scale-105";
      } else if (activeStatus === "LENGKAP") {
        btn.className =
          "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-emerald-500 text-white border-emerald-500 shadow-md scale-105";
      } else if (activeStatus === "BELUM") {
        btn.className =
          "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-red-500 text-white border-red-500 shadow-md scale-105";
      } else if (activeStatus === "SAMA") {
        btn.className =
          "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-purple-500 text-white border-purple-500 shadow-md scale-105";
      } else if (activeStatus === "BERBEZA") {
        btn.className =
          "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-amber-500 text-white border-amber-500 shadow-md scale-105";
      } else if (activeStatus === "TIADA_PENGURUSAN") {
        btn.className =
          "filter-btn active min-h-[38px] px-4 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 bg-rose-500 text-white border-rose-500 shadow-md scale-105";
      }

      const span = btn.querySelector("span");
      if (span) {
        span.className = "bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px]";
      }
    }
  }

  const context = dashboardData.filter((i) => {
    const typeMatch = activeType === "ALL" || i.jenis === activeType;
    const daerahMatch = activeDaerah === "ALL" || i.daerah === activeDaerah;
    const searchMatch =
      !searchTerm ||
      (i.kod_sekolah && i.kod_sekolah.includes(searchTerm)) ||
      (i.nama_sekolah && i.nama_sekolah.includes(searchTerm)) ||
      (i.nama_pgb && i.nama_pgb.includes(searchTerm)) ||
      (i.nama_gpk && i.nama_gpk.includes(searchTerm));
    return typeMatch && searchMatch && daerahMatch;
  });

  const setTxt = (id, count) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = String(count);
    }
  };
  setTxt("cntAll", context.length);
  setTxt("cntLengkap", context.filter((i) => i.is_lengkap).length);
  setTxt("cntBelum", context.filter((i) => !i.is_lengkap).length);
  setTxt("cntSama", context.filter((i) => i.is_sama).length);
  setTxt("cntBerbeza", context.filter((i) => i.is_berbeza).length);
  setTxt("cntTiadaPengurusan", context.filter((i) => !i.nama_pgb || !i.nama_gpk).length);
}

function renderSmartBoardKPI(data) {
  const kpiPanel = document.getElementById("smartBoardKpiPanel");
  if (!kpiPanel) {
    return;
  }

  let countSekolah = 0;
  let totalUnit = 0;
  let totalFungsi = 0;

  data.forEach((s) => {
    if (s.sb_ada === "YA") {
      countSekolah += 1;
      totalUnit += parseInt(s.sb_bil_semua, 10) || 0;
      totalFungsi += parseInt(s.sb_bil_fungsi, 10) || 0;
    }
  });

  const elSekolah = document.getElementById("kpiSbSekolah");
  const elUnit = document.getElementById("kpiSbUnit");
  const elFungsi = document.getElementById("kpiSbFungsi");

  if (elSekolah) {
    elSekolah.textContent = String(countSekolah);
  }
  if (elUnit) {
    elUnit.textContent = String(totalUnit);
  }
  if (elFungsi) {
    elFungsi.textContent = String(totalFungsi);
  }

  kpiPanel.classList.remove("hidden");
}

function createWaElement(nama, tel, label) {
  const link = generateWhatsAppLink(nama, tel, true);
  if (link) {
    const anchor = document.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className =
      "min-h-[26px] px-1 py-1 bg-green-50 text-green-700 hover:bg-green-500 hover:text-white rounded text-[8px] font-black border border-green-200 transition-colors flex items-center justify-center gap-1 shadow-sm w-full uppercase";
    anchor.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    const icon = document.createElement("i");
    icon.className = "fab fa-whatsapp";
    anchor.appendChild(icon);
    anchor.appendChild(document.createTextNode(` ${label}`));
    return anchor;
  }

  const span = document.createElement("span");
  span.className =
    "min-h-[26px] px-1 py-1 bg-slate-50 text-slate-400 rounded text-[8px] font-bold border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1 w-full uppercase";
  const icon = document.createElement("i");
  icon.className = "fab fa-whatsapp";
  span.appendChild(icon);
  span.appendChild(document.createTextNode(` ${label} (X)`));
  return span;
}

window.copyTelSekolah = function (text, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!text || text === "-") {
    return;
  }

  const notifySuccess = (str) => {
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "No. Telefon Disalin!",
        text: str,
        showConfirmButton: false,
        timer: 2000,
        customClass: { popup: "colored-toast" }
      });
    }
  };

  const fallbackCopy = (str) => {
    const el = document.createElement("textarea");
    el.value = str;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand("copy");
      notifySuccess(str);
    } catch {}
    document.body.removeChild(el);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        notifySuccess(text);
      })
      .catch(() => {
        fallbackCopy(text);
      });
  } else {
    fallbackCopy(text);
  }
};

function createSmartBoardCell(s) {
  const td = document.createElement("td");
  td.className = "px-2 py-3 border-r border-slate-100 align-top text-center";

  if (s.sb_ada === "YA") {
    const fungsi = parseInt(s.sb_bil_fungsi, 10) || 0;
    const semua = parseInt(s.sb_bil_semua, 10) || 0;
    const sbColor =
      fungsi === 0
        ? "text-red-500 bg-red-50 border-red-200"
        : fungsi < semua
          ? "text-amber-600 bg-amber-50 border-amber-200"
          : "text-teal-600 bg-teal-50 border-teal-200";

    const wrap = document.createElement("div");
    wrap.className = "flex flex-col items-center justify-center gap-1";
    wrap.title = `Kaedah: ${s.sb_kaedah || "-"}\nLokasi: ${s.sb_lokasi || "-"}`;

    const badge = document.createElement("span");
    badge.className = `inline-flex items-center justify-center w-6 h-6 rounded-full border shadow-sm ${sbColor}`;
    const icon = document.createElement("i");
    icon.className = "fas fa-tv text-[10px]";
    badge.appendChild(icon);

    const ratio = document.createElement("span");
    ratio.className = "text-[9px] font-black text-slate-500";
    ratio.textContent = `${fungsi}/${semua}`;

    wrap.appendChild(badge);
    wrap.appendChild(ratio);
    td.appendChild(wrap);
  } else if (s.sb_ada === "TIDAK") {
    const badge = document.createElement("span");
    badge.className =
      "inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 bg-slate-100 text-slate-400 shadow-sm";
    badge.title = "Tiada Smart Board";
    const icon = document.createElement("i");
    icon.className = "fas fa-times text-[10px]";
    badge.appendChild(icon);
    td.appendChild(badge);
  } else {
    const emptySpan = document.createElement("span");
    emptySpan.className = "text-[10px] font-bold text-slate-300";
    emptySpan.textContent = "-";
    td.appendChild(emptySpan);
  }

  return td;
}

function createPersonNameCell(personName) {
  const td = document.createElement("td");
  td.className = "px-2 py-3 border-r border-slate-100 align-top";

  const wrapper = document.createElement("div");
  wrapper.className = "font-bold text-slate-700 leading-tight";

  if (personName) {
    wrapper.textContent = personName;
  } else {
    const emptySpan = document.createElement("span");
    emptySpan.className = "text-slate-300 italic";
    emptySpan.textContent = "Tiada Rekod";
    wrapper.appendChild(emptySpan);
  }

  td.appendChild(wrapper);
  return td;
}

function renderGrid(data) {
  const wrapper = document.getElementById("schoolGridWrapper");
  if (!wrapper) {
    return;
  }

  clearElement(wrapper);

  if (data.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className =
      "col-span-full text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 font-medium";
    emptyBox.textContent = "Tiada data untuk paparan ini.";
    wrapper.appendChild(emptyBox);
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayData = data.slice(0, limit);

  const outerCard = document.createElement("div");
  outerCard.className =
    "col-span-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-x-auto relative";

  const table = document.createElement("table");
  table.className =
    "w-full text-[10px] text-left whitespace-normal break-words table-fixed min-w-[1000px]";

  const thead = document.createElement("thead");
  thead.className =
    "text-[9px] text-slate-500 uppercase bg-slate-100 border-b-2 border-slate-200 sticky top-0 z-10 font-black tracking-widest";
  const headRow = document.createElement("tr");

  const columns = [
    { text: "BIL", cls: "px-2 py-3 text-center border-r border-slate-200 w-[3%]" },
    { text: "JENIS", cls: "px-2 py-3 border-r border-slate-200 w-[4%]" },
    { text: "KOD", cls: "px-2 py-3 border-r border-slate-200 text-brand-600 w-[5%]" },
    { text: "NAMA SEKOLAH", cls: "px-2 py-3 border-r border-slate-200 w-[14%]" },
    { text: "DAERAH", cls: "px-2 py-3 border-r border-slate-200 text-center w-[5%]" },
    {
      text: " SB",
      icon: "fas fa-tv",
      title: "Ketersediaan Smart Board",
      cls: "px-2 py-3 border-r border-slate-200 text-center text-teal-600 w-[4%]"
    },
    { text: "NAMA PGB", cls: "px-2 py-3 border-r border-slate-200 w-[11%]" },
    { text: "NAMA GPK", cls: "px-2 py-3 border-r border-slate-200 w-[11%]" },
    { text: "NAMA GPICT", cls: "px-2 py-3 border-r border-slate-200 w-[10%]" },
    { text: "NAMA ADMIN", cls: "px-2 py-3 border-r border-slate-200 w-[10%]" },
    { text: "RESET", cls: "px-2 py-3 text-center border-r border-slate-200 w-[6%]" },
    { text: "WHATSAPP", cls: "px-2 py-3 text-center border-r border-slate-200 w-[7%]" },
    { text: "EDIT", cls: "px-2 py-3 text-center w-[5%]" }
  ];

  columns.forEach((col) => {
    const th = document.createElement("th");
    th.className = col.cls;
    if (col.title) {
      th.title = col.title;
    }
    if (col.icon) {
      const ic = document.createElement("i");
      ic.className = col.icon;
      th.appendChild(ic);
    }
    th.appendChild(document.createTextNode(col.text));
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  tbody.className = "divide-y divide-slate-100";
  const rowFragment = document.createDocumentFragment();

  displayData.forEach((s, index) => {
    const tr = document.createElement("tr");
    const rowClass = s.is_lengkap
      ? "bg-white hover:bg-emerald-50/30"
      : "bg-red-50/10 hover:bg-red-50/50";
    tr.className = `${rowClass} transition-colors group`;

    const tdBil = document.createElement("td");
    tdBil.className =
      "px-2 py-3 text-center font-mono font-bold text-slate-400 border-r border-slate-100 align-top";
    tdBil.textContent = String(index + 1);

    const tdJenis = document.createElement("td");
    tdJenis.className =
      "px-2 py-3 font-black text-slate-600 border-r border-slate-100 align-top leading-tight";
    tdJenis.textContent = s.jenis || "-";

    const tdKod = document.createElement("td");
    tdKod.className = "px-2 py-3 border-r border-slate-100 align-top";
    const kodBadge = document.createElement("span");
    kodBadge.className =
      "inline-block bg-brand-50 text-brand-700 font-mono font-black px-1.5 py-0.5 rounded border border-brand-200 shadow-sm";
    kodBadge.textContent = s.kod_sekolah || "-";
    tdKod.appendChild(kodBadge);

    const tdNama = document.createElement("td");
    tdNama.className =
      "px-2 py-3 font-bold text-slate-800 leading-tight border-r border-slate-100 align-top";
    const nameDiv = document.createElement("div");
    nameDiv.className = "mb-1";
    nameDiv.textContent = s.nama_sekolah || "-";
    tdNama.appendChild(nameDiv);

    if (s.no_telefon_sekolah) {
      const telBadge = document.createElement("div");
      telBadge.className =
        "text-[9px] font-mono text-slate-500 bg-slate-100 inline-block px-1.5 py-0.5 rounded border border-slate-200 shadow-sm mt-0.5 cursor-pointer hover:bg-slate-200 hover:text-brand-600 transition-colors";
      telBadge.title = "Klik untuk salin nombor";
      const phoneIcon = document.createElement("i");
      phoneIcon.className = "fas fa-phone-alt mr-1";
      telBadge.appendChild(phoneIcon);
      telBadge.appendChild(document.createTextNode(s.no_telefon_sekolah));
      telBadge.addEventListener("click", (event) => {
        window.copyTelSekolah(s.no_telefon_sekolah, event);
      });
      tdNama.appendChild(telBadge);
    }

    const tdDaerah = document.createElement("td");
    tdDaerah.className =
      "px-2 py-3 font-bold text-slate-500 border-r border-slate-100 align-top text-center uppercase tracking-wider";
    tdDaerah.textContent = s.daerah || "AG";

    const tdSb = createSmartBoardCell(s);
    const tdPgb = createPersonNameCell(s.nama_pgb);
    const tdGpk = createPersonNameCell(s.nama_gpk);
    const tdGpict = createPersonNameCell(s.nama_gpict);
    const tdAdmin = createPersonNameCell(s.nama_admin_delima);

    const tdReset = document.createElement("td");
    tdReset.className =
      "px-2 py-3 border-r border-slate-100 align-top bg-slate-50/50 text-center";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className =
      "min-h-[44px] px-2 py-2 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white rounded text-[8px] font-black border border-amber-200 transition-colors shadow-sm w-full uppercase tracking-wider flex flex-col items-center justify-center";
    const keyIcon = document.createElement("i");
    keyIcon.className = "fas fa-key mb-1 text-xs";
    resetBtn.appendChild(keyIcon);
    resetBtn.appendChild(document.createTextNode("RESET"));
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeof window.resetPasswordSekolah === "function") {
        window.resetPasswordSekolah(s.kod_sekolah);
      }
    });
    tdReset.appendChild(resetBtn);

    const tdWa = document.createElement("td");
    tdWa.className = "px-1.5 py-1.5 border-r border-slate-100 align-top bg-slate-50/50";
    const waStack = document.createElement("div");
    waStack.className = "flex flex-col gap-1 w-full";
    waStack.appendChild(createWaElement(s.nama_pgb, s.no_telefon_pgb, "PGB"));
    waStack.appendChild(createWaElement(s.nama_gpk, s.no_telefon_gpk, "GPK"));
    waStack.appendChild(createWaElement(s.nama_gpict, s.no_telefon_gpict, "ICT"));
    waStack.appendChild(createWaElement(s.nama_admin_delima, s.no_telefon_admin_delima, "ADM"));
    tdWa.appendChild(waStack);

    const tdEdit = document.createElement("td");
    tdEdit.className = "px-2 py-3 text-center align-top";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className =
      "min-h-[44px] px-2 py-2 bg-slate-800 hover:bg-brand-600 text-white rounded text-[8px] font-black uppercase tracking-widest transition-all shadow-lg flex flex-col items-center justify-center w-full transform active:scale-95";
    const editIcon = document.createElement("i");
    editIcon.className = "fas fa-edit mb-1 text-xs";
    editBtn.appendChild(editIcon);
    editBtn.appendChild(document.createTextNode("EDIT"));
    editBtn.addEventListener("click", () => {
      window.viewSchoolProfile(s.kod_sekolah);
    });
    tdEdit.appendChild(editBtn);

    tr.appendChild(tdBil);
    tr.appendChild(tdJenis);
    tr.appendChild(tdKod);
    tr.appendChild(tdNama);
    tr.appendChild(tdDaerah);
    tr.appendChild(tdSb);
    tr.appendChild(tdPgb);
    tr.appendChild(tdGpk);
    tr.appendChild(tdGpict);
    tr.appendChild(tdAdmin);
    tr.appendChild(tdReset);
    tr.appendChild(tdWa);
    tr.appendChild(tdEdit);

    rowFragment.appendChild(tr);
  });

  tbody.appendChild(rowFragment);
  table.appendChild(tbody);
  outerCard.appendChild(table);

  if (data.length > limit) {
    const infoBar = document.createElement("div");
    infoBar.className =
      "p-3 bg-amber-50 border-t border-amber-200 flex flex-col sm:flex-row justify-between items-center px-6 gap-2";

    const leftNote = document.createElement("span");
    leftNote.className = "text-xs font-bold text-amber-800 flex items-center gap-2";
    const infoIcon = document.createElement("i");
    infoIcon.className = "fas fa-info-circle text-amber-500 text-sm";
    leftNote.appendChild(infoIcon);
    leftNote.appendChild(document.createTextNode("Memaparkan "));
    const boldLimit = document.createElement("strong");
    boldLimit.textContent = String(limit);
    leftNote.appendChild(boldLimit);
    leftNote.appendChild(document.createTextNode(" daripada "));
    const boldTotal = document.createElement("strong");
    boldTotal.textContent = String(data.length);
    leftNote.appendChild(boldTotal);
    leftNote.appendChild(
      document.createTextNode(" sekolah. Gunakan carian untuk sekolah spesifik.")
    );

    const rightBadge = document.createElement("span");
    rightBadge.className =
      "text-[10px] font-black text-amber-700 uppercase bg-amber-100 px-3 py-1 rounded-full border border-amber-300";
    rightBadge.textContent = `Eksport CSV Menyimpan 100% Data (${data.length} Rekod)`;

    infoBar.appendChild(leftNote);
    infoBar.appendChild(rightBadge);
    outerCard.appendChild(infoBar);
  }

  wrapper.appendChild(outerCard);
}

window.viewSchoolProfile = function (kod) {
  const currentRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const currentKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

  if (currentRole && currentRole !== "SEKOLAH") {
    localStorage.setItem("smpid_real_user_role", currentRole);
    if (currentKod) {
      localStorage.setItem("smpid_real_user_kod", currentKod);
    }
    localStorage.setItem(APP_CONFIG.SESSION.USER_ROLE, "SEKOLAH");
  }

  localStorage.setItem(APP_CONFIG.SESSION.USER_KOD, kod);
  window.location.href = "user.html";
};

window.eksportDataTapis = function () {
  if (!currentFilteredList || currentFilteredList.length === 0) {
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire("Tiada Data", "", "info");
    }
    return;
  }

  let csvContent =
    "BIL,KOD,NAMA,JENIS,DAERAH,NO TEL SEKOLAH,SB ADA,SB KAEDAH,SB BIL SEMUA,SB BIL FUNGSI,SB LOKASI,NAMA PGB,TEL PGB,EMEL PGB,NAMA GPK,TEL GPK,EMEL GPK,NAMA GPICT,TEL GPICT,EMEL GPICT,NAMA ADMIN,TEL ADMIN,EMEL ADMIN,STATUS PENGISIAN\n";

  currentFilteredList.forEach((s, index) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const row = [
      index + 1,
      clean(s.kod_sekolah),
      clean(s.nama_sekolah),
      clean(s.jenis),
      clean(s.daerah),
      clean(s.no_telefon_sekolah),
      clean(s.sb_ada),
      clean(s.sb_kaedah),
      s.sb_bil_semua || 0,
      s.sb_bil_fungsi || 0,
      clean(s.sb_lokasi),
      clean(s.nama_pgb),
      clean(s.no_telefon_pgb),
      clean(s.emel_delima_pgb),
      clean(s.nama_gpk),
      clean(s.no_telefon_gpk),
      clean(s.emel_delima_gpk),
      clean(s.nama_gpict),
      clean(s.no_telefon_gpict),
      clean(s.emel_delima_gpict),
      clean(s.nama_admin_delima),
      clean(s.no_telefon_admin_delima),
      clean(s.emel_delima_admin_delima),
      s.is_lengkap ? "LENGKAP" : "BELUM"
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Profil_Penuh_Sekolah_${activeStatus}_${new Date().toISOString().slice(0, 10)}.csv`;
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

window.janaSenaraiTelegram = function () {
  const list = dashboardData.filter((i) => {
    const typeMatch = activeType === "ALL" || i.jenis === activeType;
    const daerahMatch = activeDaerah === "ALL" || i.daerah === activeDaerah;
    return typeMatch && daerahMatch;
  });

  let txt = "";
  let pending = [];

  if (activeStatus === "TIADA_PENGURUSAN") {
    txt = `**SENARAI TIADA PGB/GPK (${activeType})**\n\n`;
    pending = list.filter((i) => !i.nama_pgb || !i.nama_gpk);
  } else {
    txt = `**STATUS PENGISIAN NADIM (${activeType})**\n\n`;
    pending = list.filter((i) => !i.is_lengkap);
  }

  if (pending.length === 0) {
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire("Hebat", "Semua lengkap!", "success");
    }
    return;
  }

  pending.forEach((i) => {
    txt += `- ${i.kod_sekolah} ${i.nama_sekolah}\n`;
  });
  txt += "\nMohon tindakan segera.";

  const notifyCopied = () => {
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire("Disalin!", "Senarai disalin.", "success");
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(txt)
      .then(notifyCopied)
      .catch(() => {
        const area = document.createElement("textarea");
        area.value = txt;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand("copy");
          notifyCopied();
        } catch {}
        document.body.removeChild(area);
      });
  }
};

window.mulaTindakanPantas = function () {
  const list = dashboardData.filter((i) => {
    const typeMatch = activeType === "ALL" || i.jenis === activeType;
    const daerahMatch = activeDaerah === "ALL" || i.daerah === activeDaerah;
    return typeMatch && daerahMatch;
  });

  reminderQueue = [];

  list.forEach((i) => {
    if (i.no_telefon_gpict && !i.telegram_id_gpict) {
      reminderQueue.push({
        role: "GPICT",
        ...i,
        targetName: i.nama_gpict,
        targetTel: i.no_telefon_gpict
      });
    }
    if (i.no_telefon_admin_delima && !i.telegram_id_admin) {
      reminderQueue.push({
        role: "Admin",
        ...i,
        targetName: i.nama_admin_delima,
        targetTel: i.no_telefon_admin_delima
      });
    }
  });

  if (reminderQueue.length === 0) {
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire("Tiada Sasaran", "Tiada data untuk disusuli.", "info");
    }
    return;
  }

  qIndex = 0;
  const modal = document.getElementById("queueModal");
  if (modal) {
    modal.classList.remove("hidden");
  }
  renderQueue();
};

function renderQueue() {
  if (qIndex >= reminderQueue.length) {
    const modal = document.getElementById("queueModal");
    if (modal) {
      modal.classList.add("hidden");
    }
    if (typeof window !== "undefined" && window.Swal) {
      window.Swal.fire("Selesai", "Semakan tamat.", "success");
    }
    return;
  }

  const item = reminderQueue[qIndex];
  const elProgress = document.getElementById("qProgress");
  const elBadge = document.getElementById("qRoleBadge");
  const elSchool = document.getElementById("qSchoolName");
  const elCode = document.getElementById("qCode");
  const elPerson = document.getElementById("qPersonName");

  if (elProgress) {
    elProgress.textContent = `${qIndex + 1} / ${reminderQueue.length}`;
  }
  if (elBadge) {
    elBadge.textContent = item.role || "-";
  }
  if (elSchool) {
    elSchool.textContent = item.nama_sekolah || "-";
  }
  if (elCode) {
    elCode.textContent = item.kod_sekolah || "-";
  }
  if (elPerson) {
    elPerson.textContent = item.targetName || "-";
  }

  const link = generateWhatsAppLink(item.targetName, item.targetTel);
  const btn = document.getElementById("qWaBtn");
  if (btn) {
    if (link) {
      btn.href = link;
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
      btn.removeAttribute("href");
      btn.classList.add("opacity-50", "cursor-not-allowed");
    }
  }
}

window.nextQueue = function () {
  qIndex += 1;
  renderQueue();
};

window.prevQueue = function () {
  if (qIndex > 0) {
    qIndex -= 1;
    renderQueue();
  }
};