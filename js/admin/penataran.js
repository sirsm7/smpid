import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { PenataranService } from "../services/penataran.service.js";
import { toggleLoading } from "../core/helpers.js";

let masterPenataranList = [];
let filteredPenataranList = [];
let activePenataranFilter = "ALL";
let activeDaerahPenataran = "ALL";
let purataSemasa = 0;
let realtimeSubscribed = false;
let deleteBusy = false;

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
    return Promise.resolve({ isConfirmed: confirmed });
  }
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function renderTbodyStatus(tbody, iconClass, text, rowClass) {
  if (!tbody) {
    return;
  }
  clearElement(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 7;
  td.className = rowClass;
  if (iconClass) {
    td.appendChild(createIcon(iconClass));
  }
  td.appendChild(document.createTextNode(text));
  tr.appendChild(td);
  tbody.appendChild(tr);
}

function mapAndScopePenataranData(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  let mapped = list.map((d) => {
    const s = Array.isArray(window.globalDashboardData)
      ? window.globalDashboardData.find((x) => x.kod_sekolah === d.kod_sekolah)
      : null;
    const mappedDaerah =
      (s && s.daerah) ||
      (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[d.kod_sekolah]) ||
      "TIADA REKOD";
    return { ...d, daerah: mappedDaerah };
  });

  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

  if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
    const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
    if (userKod) {
      validSchoolCodes.push(userKod);
    }
    mapped = mapped.filter((p) => validSchoolCodes.includes(p.kod_sekolah));
  }

  return mapped;
}

async function silentRefreshPenataran() {
  if (!document.getElementById("tbodyAdminPenataran")) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();
    const dataRaw = await PenataranService.getAll();
    masterPenataranList = mapAndScopePenataranData(dataRaw);
    window.applyFilterPenataran();
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_penataran_digital",
    table: "smpid_penataran_digital",
    primaryKey: "kod_sekolah",
    cacheStore: "query_cache",
    cachePrefix: "penataran",
    onChange: async () => {
      await silentRefreshPenataran();
    },
    onSync: async () => {
      await silentRefreshPenataran();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

window.muatSenaraiPenataran = async function () {
  const tbody = document.getElementById("tbodyAdminPenataran");
  if (!tbody) {
    return;
  }

  renderTbodyStatus(
    tbody,
    "fas fa-spinner fa-spin mr-2",
    "Menyegerak data pelayan...",
    "p-10 text-center text-sky-600 font-bold animate-pulse"
  );

  try {
    await envReady;
    await initDatabaseClient();

    const dataRaw = await PenataranService.getAll();
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

    masterPenataranList = mapAndScopePenataranData(dataRaw);

    renderDaerahDropdownPenataran(userRole);
    window.applyFilterPenataran();
    ensureRealtimeSync();
  } catch {
    renderTbodyStatus(
      tbody,
      "fas fa-exclamation-triangle mr-2",
      "Gagal memuatkan data penataran.",
      "p-8 text-center text-red-500 font-bold bg-red-50 border border-red-100 rounded-xl"
    );
  }
};

function renderDaerahDropdownPenataran(userRole) {
  const container = document.getElementById("penataranDaerahFilterContainer");
  if (!container) {
    return;
  }

  clearElement(container);

  if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
    const select = document.createElement("select");
    select.id = "filterDaerahPenataran";
    select.className =
      "w-full md:w-48 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold outline-none focus:border-sky-500 bg-white text-slate-700 shadow-sm";

    const fragment = document.createDocumentFragment();
    const allOpt = document.createElement("option");
    allOpt.value = "ALL";
    allOpt.textContent = "SEMUA DAERAH";
    fragment.appendChild(allOpt);

    if (APP_CONFIG.PPD_MAPPING) {
      const uniqueDaerahs = [...new Set(Object.values(APP_CONFIG.PPD_MAPPING))].sort();
      uniqueDaerahs.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        fragment.appendChild(opt);
      });
    }

    select.appendChild(fragment);
    select.value = activeDaerahPenataran;
    select.addEventListener("change", (e) => {
      window.setDaerahPenataran(e.target.value);
    });

    container.appendChild(select);
  }
}

window.setDaerahPenataran = function (daerah) {
  activeDaerahPenataran = daerah || "ALL";
  window.applyFilterPenataran();
};

window.setFilterPenataran = function (filter) {
  activePenataranFilter = filter || "ALL";

  ["ALL", "5STAR", "AVG"].forEach((f) => {
    const el = document.getElementById(`card-penataran-${f}`);
    if (el) {
      el.classList.remove(
        "border-sky-400",
        "border-emerald-400",
        "border-amber-400",
        "opacity-100",
        "shadow-md"
      );
      el.classList.add("border-transparent", "opacity-80", "shadow-sm");
    }
  });

  const activeEl = document.getElementById(`card-penataran-${activePenataranFilter}`);
  if (activeEl) {
    activeEl.classList.remove("border-transparent", "opacity-80", "shadow-sm");
    activeEl.classList.add("opacity-100", "shadow-md");
    if (activePenataranFilter === "ALL") {
      activeEl.classList.add("border-sky-400");
    }
    if (activePenataranFilter === "5STAR") {
      activeEl.classList.add("border-emerald-400");
    }
    if (activePenataranFilter === "AVG") {
      activeEl.classList.add("border-amber-400");
    }
  }

  window.applyFilterPenataran();
};

window.applyFilterPenataran = function () {
  const searchEl = document.getElementById("searchPenataran");
  const query = searchEl ? searchEl.value.toUpperCase().trim() : "";

  let baseData = masterPenataranList;
  if (activeDaerahPenataran !== "ALL") {
    baseData = baseData.filter((d) => d.daerah === activeDaerahPenataran);
  }

  kemaskiniKPI(baseData);

  filteredPenataranList = baseData.filter((item) => {
    const penarafanStr = String(item.penarafan || "");
    const skorNum = Number(item.jumlah_skor) || 0;

    let cardMatch = true;
    if (activePenataranFilter === "5STAR") {
      cardMatch = penarafanStr.includes("5 Bintang");
    } else if (activePenataranFilter === "AVG") {
      cardMatch = skorNum >= purataSemasa;
    }

    let textMatch = true;
    if (query) {
      const nama = String(item.nama_sekolah || "").toUpperCase();
      const kod = String(item.kod_sekolah || "").toUpperCase();
      textMatch = nama.includes(query) || kod.includes(query);
    }

    return cardMatch && textMatch;
  });

  renderJadualPenataran();
};

function kemaskiniKPI(data) {
  purataSemasa = 0;
  if (data.length > 0) {
    const sum = data.reduce((acc, curr) => acc + (Number(curr.jumlah_skor) || 0), 0);
    purataSemasa = Math.round(sum / data.length);
  }

  const totalEl = document.getElementById("kpiPenataranTotal");
  const cemEl = document.getElementById("kpiPenataranCemerlang");
  const avgEl = document.getElementById("kpiPenataranPurata");

  if (totalEl) {
    totalEl.textContent = String(data.length);
  }

  if (cemEl) {
    const cemerlang = data.filter((i) => String(i.penarafan || "").includes("5 Bintang")).length;
    cemEl.textContent = String(cemerlang);
  }

  if (avgEl) {
    avgEl.textContent = String(purataSemasa);
  }
}

function renderJadualPenataran() {
  const tbody = document.getElementById("tbodyAdminPenataran");
  if (!tbody) {
    return;
  }

  clearElement(tbody);

  if (filteredPenataranList.length === 0) {
    renderTbodyStatus(
      tbody,
      null,
      "Tiada rekod penilaian sekolah ditemui.",
      "p-12 text-center text-slate-400 font-medium italic bg-slate-50/50"
    );
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayList = filteredPenataranList.slice(0, limit);
  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];
  const fragment = document.createDocumentFragment();

  displayList.forEach((item, index) => {
    let displayNama = item.nama_sekolah || item.kod_sekolah || "-";
    if (senaraiKodPPD.includes(item.kod_sekolah)) {
      displayNama =
        APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[item.kod_sekolah]
          ? `PPD ${APP_CONFIG.PPD_MAPPING[item.kod_sekolah]}`
          : "PEJABAT PENDIDIKAN DAERAH";
    }

    const penarafanText = String(item.penarafan || "");
    let starColor = "text-red-500";
    let bgStyle = "bg-red-50 border-red-200 text-red-700";

    if (penarafanText.includes("5 Bintang")) {
      starColor = "text-emerald-500 drop-shadow-md";
      bgStyle = "bg-emerald-50 border-emerald-200 text-emerald-700";
    } else if (penarafanText.includes("4 Bintang")) {
      starColor = "text-blue-500";
      bgStyle = "bg-blue-50 border-blue-200 text-blue-700";
    } else if (penarafanText.includes("3 Bintang")) {
      starColor = "text-amber-500";
      bgStyle = "bg-amber-50 border-amber-200 text-amber-700";
    } else if (penarafanText.includes("2 Bintang")) {
      starColor = "text-orange-500";
      bgStyle = "bg-orange-50 border-orange-200 text-orange-700";
    }

    const starCount = parseInt(penarafanText.charAt(0), 10) || 1;
    const dateStr = item.updated_at
      ? new Date(item.updated_at).toLocaleDateString("ms-MY", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        })
      : "-";

    const tr = document.createElement("tr");
    tr.className =
      "hover:bg-sky-50/30 transition-colors border-b border-slate-100 last:border-0 group";

    const tdBil = document.createElement("td");
    tdBil.className = "px-6 py-5 text-center font-mono font-bold text-slate-400 align-middle";
    tdBil.textContent = String(index + 1);

    const tdKod = document.createElement("td");
    tdKod.className = "px-6 py-5 font-mono font-black text-slate-600 align-middle";
    const kodBadge = document.createElement("span");
    kodBadge.className =
      "bg-slate-100 border border-slate-200 px-2 py-1 rounded shadow-sm group-hover:border-sky-300 transition-colors";
    kodBadge.textContent = item.kod_sekolah || "-";
    tdKod.appendChild(kodBadge);

    const tdSchool = document.createElement("td");
    tdSchool.className = "px-6 py-5 align-middle min-w-0";

    const schoolDiv = document.createElement("div");
    schoolDiv.className =
      "font-bold text-slate-800 text-sm leading-snug uppercase break-words";
    schoolDiv.textContent = displayNama;

    const metaRow = document.createElement("div");
    metaRow.className = "flex flex-wrap items-center gap-2 mt-1.5";

    const daerahSpan = document.createElement("span");
    daerahSpan.className =
      "text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 uppercase";
    daerahSpan.textContent = item.daerah || "TIADA REKOD";

    const dateSpan = document.createElement("span");
    dateSpan.className = "text-[9px] text-slate-400 font-bold tracking-wider uppercase";
    dateSpan.appendChild(createIcon("far fa-clock mr-1"));
    dateSpan.appendChild(document.createTextNode(` Diserah: ${dateStr}`));

    metaRow.appendChild(daerahSpan);
    metaRow.appendChild(dateSpan);
    tdSchool.appendChild(schoolDiv);
    tdSchool.appendChild(metaRow);

    const tdSkor = document.createElement("td");
    tdSkor.className =
      "px-6 py-5 text-center bg-sky-50/20 align-middle font-black text-sky-700 text-lg";
    tdSkor.textContent = String(item.jumlah_skor ?? 0);

    const tdPeratus = document.createElement("td");
    tdPeratus.className =
      "px-6 py-5 text-center bg-sky-50/20 align-middle font-bold text-slate-600";
    tdPeratus.textContent = item.peratus !== null && item.peratus !== undefined ? String(item.peratus) : "-";

    const tdStar = document.createElement("td");
    tdStar.className = "px-6 py-4 text-center align-middle";

    const starWrap = document.createElement("div");
    starWrap.className = "mb-1.5";
    for (let i = 0; i < 5; i += 1) {
      starWrap.appendChild(
        createIcon(i < starCount ? `fas fa-star ${starColor} mx-0.5` : "far fa-star text-slate-200 mx-0.5")
      );
    }

    const labelPill = document.createElement("span");
    labelPill.className = `inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${bgStyle}`;
    const bracketPart = penarafanText.split("(")[1];
    labelPill.textContent = bracketPart ? bracketPart.replace(")", "") : penarafanText || "-";

    tdStar.appendChild(starWrap);
    tdStar.appendChild(labelPill);

    const tdAction = document.createElement("td");
    tdAction.className = "px-6 py-5 text-center align-middle";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className =
      "min-w-[44px] min-h-[44px] p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm group-hover:shadow-md inline-flex items-center justify-center";
    delBtn.title = "Reset (Padam) Rekod Ini";
    delBtn.appendChild(createIcon("fas fa-trash-alt"));
    delBtn.addEventListener("click", () => {
      window.padamRekodPenataran(item.kod_sekolah);
    });
    tdAction.appendChild(delBtn);

    tr.appendChild(tdBil);
    tr.appendChild(tdKod);
    tr.appendChild(tdSchool);
    tr.appendChild(tdSkor);
    tr.appendChild(tdPeratus);
    tr.appendChild(tdStar);
    tr.appendChild(tdAction);
    fragment.appendChild(tr);
  });

  if (filteredPenataranList.length > limit) {
    const infoTr = document.createElement("tr");
    infoTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
    const infoTd = document.createElement("td");
    infoTd.colSpan = 7;
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
    bTotal.textContent = String(filteredPenataranList.length);
    leftSpan.appendChild(bTotal);
    leftSpan.appendChild(
      document.createTextNode(" sekolah. Gunakan carian untuk melihat sekolah spesifik.")
    );

    const rightSpan = document.createElement("span");
    rightSpan.className =
      "text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full font-black uppercase tracking-wider";
    rightSpan.textContent = `Eksport CSV Menyimpan 100% Data (${filteredPenataranList.length} Rekod)`;

    flexWrap.appendChild(leftSpan);
    flexWrap.appendChild(rightSpan);
    infoTd.appendChild(flexWrap);
    infoTr.appendChild(infoTd);
    fragment.appendChild(infoTr);
  }

  tbody.appendChild(fragment);
}

window.padamRekodPenataran = async function (kod) {
  if (deleteBusy || !kod) {
    return;
  }

  const result = await showAlert({
    title: `Reset Data ${kod}?`,
    text: "Tindakan ini akan memadam borang penataran sekolah ini dari sistem PPD secara kekal.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Ya, Padam",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" }
  });

  if (!result || !result.isConfirmed) {
    return;
  }

  deleteBusy = true;
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await PenataranService.deleteRecord(kod);
    toggleLoading(false);

    await showAlert({
      icon: "success",
      title: "Dipadam",
      timer: 1500,
      showConfirmButton: false
    });

    await window.muatSenaraiPenataran();
  } catch {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: "Gagal memadam rekod."
    });
  } finally {
    deleteBusy = false;
  }
};

window.eksportPenataranCSV = function () {
  if (!filteredPenataranList || filteredPenataranList.length === 0) {
    showAlert({
      icon: "info",
      title: "Tiada Data",
      text: "Jadual kosong."
    });
    return;
  }

  let csvContent =
    "BIL,KOD SEKOLAH,NAMA SEKOLAH,DAERAH,TARIKH SERAHAN,JUMLAH SKOR,PERATUS,PENARAFAN BINTANG,SKOR DIMENSI 1,SKOR DIMENSI 2,SKOR DIMENSI 3,SKOR DIMENSI 4,SKOR DIMENSI 5,SKOR DIMENSI 6\n";

  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];

  filteredPenataranList.forEach((s, index) => {
    let displayNama = s.nama_sekolah || s.kod_sekolah || "";
    if (senaraiKodPPD.includes(s.kod_sekolah)) {
      displayNama =
        APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[s.kod_sekolah]
          ? `PPD ${APP_CONFIG.PPD_MAPPING[s.kod_sekolah]}`
          : "PEJABAT PENDIDIKAN DAERAH";
    }

    const cleanNama = `"${String(displayNama).replace(/"/g, '""')}"`;
    const tarikh = s.updated_at ? new Date(s.updated_at).toLocaleDateString("ms-MY") : "-";
    const dimensi = s.skor_dimensi || {};

    const row = [
      index + 1,
      s.kod_sekolah || "",
      cleanNama,
      s.daerah || "",
      tarikh,
      s.jumlah_skor ?? 0,
      s.peratus ?? 0,
      String(s.penarafan || "").replace(/,/g, ""),
      dimensi.d1 || 0,
      dimensi.d2 || 0,
      dimensi.d3 || 0,
      dimensi.d4 || 0,
      dimensi.d5 || 0,
      dimensi.d6 || 0
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Pemantauan_Penataran_Digital_${new Date().toISOString().slice(0, 10)}.csv`;
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