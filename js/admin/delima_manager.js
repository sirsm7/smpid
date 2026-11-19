import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";

let rawDataGuru = [];
let rawDataMurid = [];
const mapKodOuGlobal = {};
let realtimeSubscribed = false;
let bulkActionBusy = false;
let deleteActionBusy = false;

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

function setButtonIconAndText(button, iconClass, text) {
  if (!button) {
    return;
  }
  clearElement(button);
  if (iconClass) {
    button.appendChild(createIcon(iconClass));
    button.appendChild(document.createTextNode(" "));
  }
  button.appendChild(document.createTextNode(text));
}

function showToastOrAlert(options) {
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
  if (message && !(options && options.toast)) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function renderTbodyMessage(tbody, iconClass, text, isError = false) {
  if (!tbody) {
    return;
  }
  clearElement(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 4;
  td.className = isError
    ? "p-8 text-center text-red-500 font-bold bg-red-50"
    : "p-8 text-center text-slate-400 font-medium";

  if (iconClass) {
    td.appendChild(createIcon(iconClass));
  }
  td.appendChild(document.createTextNode(text));
  tr.appendChild(td);
  tbody.appendChild(tr);
}

async function fetchCategoryRecords(db, kategori) {
  const { data: delimaData, error: delimaError } = await db
    .from("smpid_delima_status")
    .select("*")
    .eq("kategori", kategori)
    .order("created_at", { ascending: false });

  if (delimaError) {
    throw delimaError;
  }

  let fetchedData = delimaData || [];
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

  if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
    const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
    if (userKod) {
      validSchoolCodes.push(userKod);
    }
    fetchedData = fetchedData.filter((item) => validSchoolCodes.includes(item.kod_sekolah));
  }

  if (kategori === "GURU") {
    rawDataGuru = fetchedData;
  } else {
    rawDataMurid = fetchedData;
  }

  const unikKodSekolah = [
    ...new Set(fetchedData.map((item) => item.kod_sekolah).filter(Boolean))
  ];
  const missingKodOu = unikKodSekolah.filter(
    (kod) => !Object.prototype.hasOwnProperty.call(mapKodOuGlobal, kod)
  );

  if (missingKodOu.length > 0) {
    const { data: sekolahData, error: sekolahError } = await db
      .from("delima_data_sekolah")
      .select("kod_sekolah, kod_ou")
      .in("kod_sekolah", missingKodOu);

    if (!sekolahError && Array.isArray(sekolahData)) {
      sekolahData.forEach((sek) => {
        if (sek && sek.kod_sekolah) {
          mapKodOuGlobal[sek.kod_sekolah] = sek.kod_ou;
        }
      });
    }
  }

  return fetchedData;
}

async function silentRefreshDelimaCategories() {
  try {
    await envReady;
    const db = (await initDatabaseClient()) || getDatabaseClient();
    if (!db) {
      return;
    }
    if (document.getElementById("tbodyAdminGuru") && rawDataGuru.length > 0) {
      await fetchCategoryRecords(db, "GURU");
      await window.loadSenaraiDelimaAdmin("GURU", false);
    }
    if (document.getElementById("tbodyAdminMurid") && rawDataMurid.length > 0) {
      await fetchCategoryRecords(db, "MURID");
      await window.loadSenaraiDelimaAdmin("MURID", false);
    }
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_delima_status",
    table: "smpid_delima_status",
    primaryKey: "id",
    cacheStore: "query_cache",
    cachePrefix: "delima",
    onChange: async () => {
      await silentRefreshDelimaCategories();
    },
    onSync: async () => {
      await silentRefreshDelimaCategories();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

function buildDelimaRow(item, index, kategori, senaraiKodPPD) {
  const isGuru = kategori === "GURU";
  const dateObj = new Date(item.created_at);
  const formatTarikh = dateObj.toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const formatMasa = dateObj.toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit"
  });

  let schoolName = item.kod_sekolah || "-";
  if (senaraiKodPPD.includes(item.kod_sekolah)) {
    schoolName =
      APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[item.kod_sekolah]
        ? `PPD ${APP_CONFIG.PPD_MAPPING[item.kod_sekolah]}`
        : "PEJABAT PENDIDIKAN DAERAH";
  } else if (Array.isArray(window.globalDashboardData)) {
    const schoolMatch = window.globalDashboardData.find(
      (s) => s.kod_sekolah === item.kod_sekolah
    );
    if (schoolMatch && schoolMatch.nama_sekolah) {
      schoolName = schoolMatch.nama_sekolah;
    }
  }

  const kodOu = mapKodOuGlobal[item.kod_sekolah] || "Tiada Kod OU";
  const paparKodSekolahGabungan = `${item.kod_sekolah || "-"} (${kodOu})`;

  const isSelesai = item.status_proses === "SELESAI";
  const tr = document.createElement("tr");
  tr.className = isSelesai
    ? "bg-slate-50/50 hover:bg-slate-100 opacity-80 grayscale-[0.2] border-b border-slate-100 transition-colors group"
    : "hover:bg-slate-50/80 border-b border-slate-100 transition-colors group";

  const tdCheck = document.createElement("td");
  tdCheck.className =
    "px-6 py-5 text-center font-mono font-bold text-slate-400 text-xs align-top pt-6";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = isGuru
    ? "cb-delima-GURU w-4 h-4 accent-blue-600 cursor-pointer rounded mb-2"
    : "cb-delima-MURID w-4 h-4 accent-cyan-600 cursor-pointer rounded mb-2";
  cb.value = String(item.id);
  cb.dataset.email = item.id_delima || "";
  cb.dataset.status = item.status_proses || "";
  cb.addEventListener("change", () => {
    window.checkBulkStatus(kategori);
  });

  tdCheck.appendChild(cb);
  tdCheck.appendChild(document.createElement("br"));
  tdCheck.appendChild(document.createTextNode(String(index + 1)));

  const tdSchool = document.createElement("td");
  tdSchool.className = "px-6 py-5 align-top min-w-0";

  const schoolDiv = document.createElement("div");
  schoolDiv.className = "font-bold text-slate-800 tracking-tight break-words";
  schoolDiv.textContent = schoolName;

  const ouBadge = document.createElement("div");
  ouBadge.className =
    "inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest text-indigo-700 bg-indigo-50 px-2 py-1 rounded mt-1.5 border border-indigo-100 shadow-sm";
  ouBadge.appendChild(createIcon("fas fa-building text-indigo-400"));
  ouBadge.appendChild(document.createTextNode(` ${paparKodSekolahGabungan}`));

  const userCard = document.createElement("div");
  userCard.className = "mt-3 p-3 bg-white border-2 border-slate-100 rounded-xl shadow-sm";

  const nameSpan = document.createElement("span");
  nameSpan.className = "font-bold text-slate-700 block mb-1 text-xs uppercase break-words";
  nameSpan.appendChild(createIcon("fas fa-user-circle text-slate-400 mr-1.5"));
  nameSpan.appendChild(document.createTextNode(item.nama || "-"));

  const idRow = document.createElement("div");
  idRow.className = "flex flex-wrap items-center gap-2 mt-1";

  const idBadge = document.createElement("div");
  idBadge.className =
    "text-[10px] text-slate-500 font-mono font-bold bg-slate-50 px-2 py-1 rounded-md inline-block border border-slate-200 shadow-sm wrap-safe break-all";
  idBadge.textContent = item.id_delima || "TIADA REKOD";
  idRow.appendChild(idBadge);

  if (item.id_delima) {
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = isGuru
      ? "min-w-[36px] min-h-[36px] p-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 hover:text-blue-800 transition-colors shadow-sm inline-flex items-center justify-center"
      : "min-w-[36px] min-h-[36px] p-1.5 bg-cyan-50 text-cyan-600 rounded-md hover:bg-cyan-100 hover:text-cyan-800 transition-colors shadow-sm inline-flex items-center justify-center";
    copyBtn.title = "Salin ID DELIMa";
    copyBtn.appendChild(createIcon("far fa-copy"));
    copyBtn.addEventListener("click", () => {
      window.salinIdDelimaAdmin(item.id_delima);
    });
    idRow.appendChild(copyBtn);
  }

  userCard.appendChild(nameSpan);
  userCard.appendChild(idRow);

  tdSchool.appendChild(schoolDiv);
  tdSchool.appendChild(ouBadge);
  tdSchool.appendChild(userCard);

  const tdNote = document.createElement("td");
  tdNote.className = "px-6 py-5 align-top min-w-0";

  const noteCard = document.createElement("div");
  noteCard.className =
    "text-xs font-bold text-slate-700 bg-sky-50 border-l-4 border-sky-400 p-3 rounded-r-xl shadow-sm mb-3 relative overflow-hidden";

  const quoteIcon = createIcon(
    "fas fa-quote-right absolute right-2 bottom-2 text-3xl text-sky-500/10 z-0"
  );
  const noteHeader = document.createElement("span");
  noteHeader.className =
    "block text-[9px] uppercase tracking-widest text-sky-600 mb-1 z-10 relative";
  noteHeader.textContent = "Isu / Catatan Permohonan:";

  const noteBody = document.createElement("span");
  noteBody.className = "z-10 relative break-words";
  noteBody.textContent = item.catatan || "-";

  noteCard.appendChild(quoteIcon);
  noteCard.appendChild(noteHeader);
  noteCard.appendChild(noteBody);
  tdNote.appendChild(noteCard);

  if (item.catatan === "Berpindah MASUK ke sekolah ini") {
    const destBox = document.createElement("span");
    destBox.className = isGuru
      ? "text-blue-700 font-bold mt-2 block text-xs bg-blue-50 p-2.5 rounded-lg border border-blue-100 shadow-sm wrap-safe"
      : "text-cyan-700 font-bold mt-2 block text-xs bg-cyan-50 p-2.5 rounded-lg border border-cyan-100 shadow-sm wrap-safe";
    destBox.appendChild(
      createIcon(
        isGuru
          ? "fas fa-download mr-1.5 text-blue-500"
          : "fas fa-download mr-1.5 text-cyan-500"
      )
    );
    destBox.appendChild(document.createTextNode("Mohon Tarik Ke:"));
    destBox.appendChild(document.createElement("br"));

    const ouCodeSpan = document.createElement("span");
    ouCodeSpan.className =
      "text-[10px] text-slate-500 font-mono mt-1 block tracking-wider bg-white px-2 py-1 rounded inline-block wrap-safe break-all";
    ouCodeSpan.textContent = `OU: ${item.unit_organisasi_baharu || item.kod_sekolah || "-"}`;
    destBox.appendChild(ouCodeSpan);
    tdNote.appendChild(destBox);
  }

  const timeRow = document.createElement("div");
  timeRow.className =
    "flex flex-wrap items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-3";

  const datePill = document.createElement("span");
  datePill.className = "bg-slate-100 px-2 py-1 rounded";
  datePill.appendChild(createIcon("fas fa-calendar-alt mr-1"));
  datePill.appendChild(document.createTextNode(formatTarikh));

  const timePill = document.createElement("span");
  timePill.className = "bg-slate-100 px-2 py-1 rounded";
  timePill.appendChild(createIcon("fas fa-clock mr-1"));
  timePill.appendChild(document.createTextNode(formatMasa));

  timeRow.appendChild(datePill);
  timeRow.appendChild(timePill);
  tdNote.appendChild(timeRow);

  const tdAction = document.createElement("td");
  tdAction.className = "px-6 py-5 text-center align-top";

  const statusWrap = document.createElement("div");
  statusWrap.className = "mb-3";
  const statusPill = document.createElement("span");
  if (isSelesai) {
    statusPill.className =
      "bg-emerald-100 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest inline-flex items-center";
    statusPill.appendChild(createIcon("fas fa-check-double mr-1"));
    statusPill.appendChild(document.createTextNode("SELESAI"));
  } else {
    statusPill.className =
      "bg-amber-100 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest inline-flex items-center";
    statusPill.appendChild(createIcon("fas fa-clock mr-1"));
    statusPill.appendChild(document.createTextNode("PROSES"));
  }
  statusWrap.appendChild(statusPill);
  tdAction.appendChild(statusWrap);

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  if (!isSelesai) {
    toggleBtn.className =
      "mt-3 w-full min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md transform active:scale-95";
    setButtonIconAndText(toggleBtn, "fas fa-check-circle mr-1", "Tanda Selesai");
    toggleBtn.addEventListener("click", () => {
      window.kemaskiniStatusDelima(item.id, "SELESAI", kategori, toggleBtn);
    });
  } else {
    toggleBtn.className =
      "mt-3 w-full min-h-[44px] bg-white border-2 border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-600 hover:text-amber-600 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm transform active:scale-95";
    setButtonIconAndText(toggleBtn, "fas fa-undo mr-1", "Buka Semula");
    toggleBtn.addEventListener("click", () => {
      window.kemaskiniStatusDelima(item.id, "DALAM PROSES", kategori, toggleBtn);
    });
  }
  tdAction.appendChild(toggleBtn);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className =
    "mt-1.5 w-full min-h-[40px] bg-white border border-red-100 hover:bg-red-50 text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm";
  setButtonIconAndText(deleteBtn, "fas fa-trash-alt mr-1", "Padam");
  deleteBtn.addEventListener("click", () => {
    window.padamRekodDelima(item.id, kategori);
  });
  tdAction.appendChild(deleteBtn);

  tr.appendChild(tdCheck);
  tr.appendChild(tdSchool);
  tr.appendChild(tdNote);
  tr.appendChild(tdAction);

  return tr;
}

window.loadSenaraiDelimaAdmin = async function (kategori, forceRefresh = true) {
  await envReady;
  const db = (await initDatabaseClient()) || getDatabaseClient();

  if (!db) {
    showToastOrAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: "Pangkalan data tidak bersambung. Sila muat semula halaman."
    });
    return;
  }

  try {
    const tbodyId = kategori === "GURU" ? "tbodyAdminGuru" : "tbodyAdminMurid";
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
      return;
    }

    const statusFilterId =
      kategori === "GURU" ? "filterDelimaGuruAdmin" : "filterDelimaMuridAdmin";
    const catatanFilterId =
      kategori === "GURU" ? "filterCatatanGuruAdmin" : "filterCatatanMuridAdmin";
    const sekolahFilterId =
      kategori === "GURU" ? "filterSekolahGuruAdmin" : "filterSekolahMuridAdmin";
    const lokasiFilterId =
      kategori === "GURU" ? "filterLokasiGuruAdmin" : "filterLokasiMuridAdmin";

    const statusSelect = document.getElementById(statusFilterId);
    const catatanSelect = document.getElementById(catatanFilterId);
    const sekolahSelect = document.getElementById(sekolahFilterId);
    const lokasiSelect = document.getElementById(lokasiFilterId);

    const statusVal = statusSelect ? statusSelect.value : "ALL";
    let catVal = catatanSelect ? catatanSelect.value : "ALL";
    let sekVal = sekolahSelect ? sekolahSelect.value : "ALL";
    const lokVal = lokasiSelect ? lokasiSelect.value : "ALL";

    let dataToProcess = kategori === "GURU" ? rawDataGuru : rawDataMurid;

    if (forceRefresh || dataToProcess.length === 0) {
      renderTbodyMessage(
        tbody,
        "fas fa-circle-notch fa-spin mr-2",
        `Mengumpul dan menyegerak pangkalan data ${kategori}...`,
        false
      );
      dataToProcess = await fetchCategoryRecords(db, kategori);
    }

    let preFilteredData = dataToProcess;

    if (statusVal !== "ALL") {
      preFilteredData = preFilteredData.filter((item) => item.status_proses === statusVal);
    }

    if (lokVal !== "ALL") {
      if (lokVal === "DALAM NEGERI") {
        preFilteredData = preFilteredData.filter(
          (item) =>
            item.nama &&
            (item.nama.includes("(DALAM DAERAH)") || item.nama.includes("(LUAR DAERAH)"))
        );
      } else if (lokVal === "LUAR NEGERI") {
        preFilteredData = preFilteredData.filter(
          (item) => item.nama && item.nama.includes("(LUAR NEGERI)")
        );
      } else {
        preFilteredData = preFilteredData.filter(
          (item) => item.nama && item.nama.includes(`(${lokVal})`)
        );
      }
    }

    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
      ? Object.keys(APP_CONFIG.PPD_MAPPING)
      : ["M010", "M020", "M030"];

    if (catatanSelect && sekolahSelect) {
      const uniqueCatatan = [
        ...new Set(preFilteredData.map((item) => item.catatan).filter(Boolean))
      ].sort();

      clearElement(catatanSelect);
      const catFragment = document.createDocumentFragment();
      const allCatOpt = document.createElement("option");
      allCatOpt.value = "ALL";
      allCatOpt.textContent = "Semua Catatan";
      catFragment.appendChild(allCatOpt);

      uniqueCatatan.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        catFragment.appendChild(opt);
      });
      catatanSelect.appendChild(catFragment);

      if (catVal !== "ALL" && uniqueCatatan.includes(catVal)) {
        catatanSelect.value = catVal;
      } else {
        catVal = "ALL";
        catatanSelect.value = "ALL";
      }

      const uniqueSekolah = [
        ...new Set(preFilteredData.map((item) => item.kod_sekolah).filter(Boolean))
      ].sort();

      clearElement(sekolahSelect);
      const sekFragment = document.createDocumentFragment();
      const allSekOpt = document.createElement("option");
      allSekOpt.value = "ALL";
      allSekOpt.textContent = "Semua Sekolah";
      sekFragment.appendChild(allSekOpt);

      uniqueSekolah.forEach((kod) => {
        let namaSekolah = kod;
        if (senaraiKodPPD.includes(kod)) {
          namaSekolah = APP_CONFIG.PPD_MAPPING[kod]
            ? `PPD ${APP_CONFIG.PPD_MAPPING[kod]}`
            : "PEJABAT PENDIDIKAN DAERAH";
        } else if (Array.isArray(window.globalDashboardData)) {
          const schoolMatch = window.globalDashboardData.find(
            (s) => s.kod_sekolah === kod
          );
          if (schoolMatch && schoolMatch.nama_sekolah) {
            namaSekolah = schoolMatch.nama_sekolah;
          }
        }
        const opt = document.createElement("option");
        opt.value = kod;
        opt.textContent = `${namaSekolah} (${kod})`;
        sekFragment.appendChild(opt);
      });
      sekolahSelect.appendChild(sekFragment);

      if (sekVal !== "ALL" && uniqueSekolah.includes(sekVal)) {
        sekolahSelect.value = sekVal;
      } else {
        sekVal = "ALL";
        sekolahSelect.value = "ALL";
      }
    }

    let filteredData = preFilteredData;
    if (sekVal !== "ALL") {
      filteredData = filteredData.filter((item) => item.kod_sekolah === sekVal);
    }
    if (catVal !== "ALL") {
      filteredData = filteredData.filter((item) => item.catatan === catVal);
    }

    const capitalizedKategori =
      kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
    const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);

    if (!filteredData || filteredData.length === 0) {
      renderTbodyMessage(
        tbody,
        "fas fa-inbox text-3xl mb-3 opacity-20 block",
        "Tiada rekod permohonan padan dengan tapisan ini.",
        false
      );
      window.resetBulkState(kategori);
      if (selectAllCb) {
        selectAllCb.classList.add("hidden");
      }
      ensureRealtimeSync();
      return;
    }

    if (selectAllCb) {
      selectAllCb.classList.remove("hidden");
    }

    const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
    const displayData = filteredData.slice(0, limit);
    const rowsFragment = document.createDocumentFragment();

    displayData.forEach((item, index) => {
      rowsFragment.appendChild(buildDelimaRow(item, index, kategori, senaraiKodPPD));
    });

    if (filteredData.length > limit) {
      const infoTr = document.createElement("tr");
      infoTr.className = "bg-amber-50/80 border-t-2 border-amber-200";
      const infoTd = document.createElement("td");
      infoTd.colSpan = 4;
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
      bTotal.textContent = String(filteredData.length);
      leftSpan.appendChild(bTotal);
      leftSpan.appendChild(
        document.createTextNode(
          " permohonan. Gunakan tapisan untuk melihat permohonan spesifik."
        )
      );

      const rightSpan = document.createElement("span");
      rightSpan.className =
        "text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full font-black uppercase tracking-wider";
      rightSpan.textContent = `Eksport CSV Mengandungi 100% Data (${filteredData.length} Rekod)`;

      flexWrap.appendChild(leftSpan);
      flexWrap.appendChild(rightSpan);
      infoTd.appendChild(flexWrap);
      infoTr.appendChild(infoTd);
      rowsFragment.appendChild(infoTr);
    }

    clearElement(tbody);
    tbody.appendChild(rowsFragment);
    window.resetBulkState(kategori);
    ensureRealtimeSync();
  } catch {
    const tbodyId = kategori === "GURU" ? "tbodyAdminGuru" : "tbodyAdminMurid";
    renderTbodyMessage(
      document.getElementById(tbodyId),
      "fas fa-exclamation-triangle mr-2",
      "Gagal menarik data permohonan DELIMa atau Kod OU.",
      true
    );
    showToastOrAlert({
      icon: "error",
      title: "Ralat Pangkalan Data",
      text: "Gagal menarik data permohonan DELIMa atau Kod OU.",
      confirmButtonColor: "#3085d6",
      confirmButtonText: "Tutup"
    });
  }
};

window.resetBulkState = function (kategori) {
  const capitalizedKategori =
    kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
  const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);
  if (selectAllCb) {
    selectAllCb.checked = false;
  }
  window.checkBulkStatus(kategori);
};

window.toggleSelectAll = function (kategori, element) {
  const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}`);
  checkboxes.forEach((cb) => {
    cb.checked = Boolean(element && element.checked);
  });
  window.checkBulkStatus(kategori);
};

window.checkBulkStatus = function (kategori) {
  const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
  const count = checkboxes.length;
  const capitalizedKategori =
    kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();

  const bulkContainer = document.getElementById(`bulkActions${capitalizedKategori}`);
  const btnSalin = document.getElementById(`btnSalinPukal${capitalizedKategori}`);
  const btnSelesai = document.getElementById(`btnSelesaiPukal${capitalizedKategori}`);
  const btnBukaSemula = document.getElementById(`btnBukaSemulaPukal${capitalizedKategori}`);
  const btnEksport = document.getElementById(`btnEksportPukal${capitalizedKategori}`);
  const countSpan = document.getElementById(`countPukal${capitalizedKategori}`);

  let hasDalamProses = false;
  let hasSelesai = false;

  checkboxes.forEach((cb) => {
    if (cb.dataset.status === "DALAM PROSES") {
      hasDalamProses = true;
    }
    if (cb.dataset.status === "SELESAI") {
      hasSelesai = true;
    }
  });

  const statusFilterId =
    kategori === "GURU" ? "filterDelimaGuruAdmin" : "filterDelimaMuridAdmin";
  const filterEl = document.getElementById(statusFilterId);
  const currentFilter = filterEl ? filterEl.value : "ALL";

  if (count > 0) {
    if (bulkContainer) {
      bulkContainer.classList.remove("hidden");
    }
    if (btnSalin) {
      btnSalin.disabled = false;
    }
    if (btnEksport) {
      btnEksport.disabled = false;
    }
    if (countSpan) {
      countSpan.textContent = String(count);
    }

    if (btnSelesai) {
      btnSelesai.disabled = !hasDalamProses;
    }
    if (btnBukaSemula) {
      btnBukaSemula.disabled = !hasSelesai;
      if (currentFilter === "DALAM PROSES") {
        btnBukaSemula.classList.add("hidden");
      } else {
        btnBukaSemula.classList.remove("hidden");
      }
    }
  } else {
    if (bulkContainer) {
      bulkContainer.classList.add("hidden");
    }
    if (btnSalin) {
      btnSalin.disabled = true;
    }
    if (btnSelesai) {
      btnSelesai.disabled = true;
    }
    if (btnEksport) {
      btnEksport.disabled = true;
    }
    if (countSpan) {
      countSpan.textContent = "0";
    }

    if (btnBukaSemula) {
      btnBukaSemula.disabled = true;
      if (currentFilter === "DALAM PROSES") {
        btnBukaSemula.classList.add("hidden");
      } else {
        btnBukaSemula.classList.remove("hidden");
      }
    }

    const selectAllCb = document.getElementById(`selectAll${capitalizedKategori}`);
    if (selectAllCb) {
      selectAllCb.checked = false;
    }
  }
};

window.eksportCsvPukal = function (kategori) {
  const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
  if (checkboxes.length === 0) {
    return;
  }

  const selectedIds = Array.from(checkboxes).map((cb) => cb.value);
  const dataPool = kategori === "GURU" ? rawDataGuru : rawDataMurid;
  const recordsToExport = dataPool.filter((item) => selectedIds.includes(String(item.id)));

  if (recordsToExport.length === 0) {
    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "warning",
      title: "Tiada Data",
      text: "Tiada rekod sah untuk dieksport.",
      showConfirmButton: false,
      timer: 2000
    });
    return;
  }

  let csvContent =
    "BIL,KOD SEKOLAH,KOD OU,NAMA,ID DELIMA,KATEGORI,CATATAN,STATUS PROSES,TARIKH MOHON\n";

  recordsToExport.forEach((item, index) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const kodOu = mapKodOuGlobal[item.kod_sekolah] || "TIADA KOD OU";
    const tarikhStr = item.created_at
      ? new Date(item.created_at).toLocaleDateString("ms-MY")
      : "-";

    const row = [
      index + 1,
      clean(item.kod_sekolah),
      clean(kodOu),
      clean(item.nama),
      clean(item.id_delima),
      clean(item.kategori),
      clean(item.catatan),
      clean(item.status_proses),
      clean(tarikhStr)
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Eksport_ID_${kategori}_Terpilih_${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  showToastOrAlert({
    toast: true,
    position: "top-end",
    icon: "success",
    title: "Berjaya Dieksport!",
    text: `${recordsToExport.length} rekod dimuat turun.`,
    showConfirmButton: false,
    timer: 2000,
    customClass: { popup: "colored-toast" }
  });
};

window.salinEmelPukal = function (kategori) {
  const checkboxes = document.querySelectorAll(`.cb-delima-${kategori}:checked`);
  const emails = [];

  checkboxes.forEach((cb) => {
    const email = cb.getAttribute("data-email");
    if (email && email !== "-" && email.trim() !== "") {
      emails.push(email.trim());
    }
  });

  if (emails.length === 0) {
    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "warning",
      title: "Tiada Emel Sah",
      text: "Pilihan anda tidak mengandungi emel yang sah.",
      showConfirmButton: false,
      timer: 2000
    });
    return;
  }

  const textToCopy = emails.join("\n");

  const notifyCopied = () => {
    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Berjaya Disalin!",
      text: "Senarai emel sedia ditampal di Excel (Satu lajur).",
      showConfirmButton: false,
      timer: 2000,
      customClass: { popup: "colored-toast" }
    });
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
      notifyCopied();
    } catch {}
    document.body.removeChild(textArea);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(textToCopy)
      .then(notifyCopied)
      .catch(() => {
        fallbackCopy(textToCopy);
      });
  } else {
    fallbackCopy(textToCopy);
  }
};

async function executeBulkStatusTransition(kategori, sourceStatus, targetStatus, buttonId, defaultIcon, defaultLabel) {
  if (bulkActionBusy) {
    return;
  }

  await envReady;
  const db = (await initDatabaseClient()) || getDatabaseClient();
  if (!db) {
    return;
  }

  const checkboxes = document.querySelectorAll(
    `.cb-delima-${kategori}:checked[data-status="${sourceStatus}"]`
  );
  if (checkboxes.length === 0) {
    return;
  }

  bulkActionBusy = true;
  const btn = document.getElementById(buttonId);
  if (btn) {
    setButtonIconAndText(btn, "fas fa-circle-notch fa-spin mr-2", "Memproses...");
    btn.disabled = true;
  }

  const idsToUpdate = [];
  const rowsToRemove = [];

  checkboxes.forEach((cb) => {
    idsToUpdate.push(cb.value);
    const tr = cb.closest("tr");
    if (tr) {
      rowsToRemove.push(tr);
    }
  });

  try {
    const { error } = await db
      .from("smpid_delima_status")
      .update({ status_proses: targetStatus })
      .in("id", idsToUpdate);

    if (error) {
      throw error;
    }

    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "success",
      title: targetStatus === "SELESAI" ? "Selesai Pukal!" : "Berjaya!",
      text:
        targetStatus === "SELESAI"
          ? `${idsToUpdate.length} permohonan dikemaskini.`
          : `${idsToUpdate.length} permohonan dibuka semula.`,
      showConfirmButton: false,
      timer: 2000,
      customClass: { popup: "colored-toast" }
    });

    const dataArray = kategori === "GURU" ? rawDataGuru : rawDataMurid;
    idsToUpdate.forEach((id) => {
      const idx = dataArray.findIndex((item) => String(item.id) === String(id));
      if (idx !== -1) {
        dataArray[idx].status_proses = targetStatus;
      }
    });

    const statusFilterId =
      kategori === "GURU" ? "filterDelimaGuruAdmin" : "filterDelimaMuridAdmin";
    const filterEl = document.getElementById(statusFilterId);
    const statusFilter = filterEl ? filterEl.value : "ALL";

    if (statusFilter !== "ALL") {
      rowsToRemove.forEach((row) => {
        row.style.transition = "all 0.3s ease-out";
        row.style.opacity = "0";
        row.style.transform = "translateX(20px)";
      });

      setTimeout(() => {
        let parentTbody = null;
        rowsToRemove.forEach((row) => {
          parentTbody = row.parentNode;
          row.remove();
        });

        window.resetBulkState(kategori);

        if (parentTbody && parentTbody.children.length === 0) {
          renderTbodyMessage(
            parentTbody,
            "fas fa-inbox text-3xl mb-3 opacity-20 block",
            "Tiada rekod permohonan padan dengan tapisan ini.",
            false
          );
        }
      }, 300);
    } else {
      await window.loadSenaraiDelimaAdmin(kategori, false);
    }
  } catch {
    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "error",
      title: "Ralat Rangkaian",
      text: "Gagal memproses tindakan pukal.",
      showConfirmButton: false,
      timer: 2500
    });
  } finally {
    bulkActionBusy = false;
    if (btn) {
      setButtonIconAndText(btn, defaultIcon, defaultLabel);
      btn.disabled = false;
    }
  }
}

window.tandaSelesaiPukal = async function (kategori) {
  const capitalizedKategori =
    kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
  await executeBulkStatusTransition(
    kategori,
    "DALAM PROSES",
    "SELESAI",
    `btnSelesaiPukal${capitalizedKategori}`,
    "fas fa-check-double mr-1",
    "Tanda Selesai"
  );
};

window.bukaSemulaPukal = async function (kategori) {
  const capitalizedKategori =
    kategori.charAt(0).toUpperCase() + kategori.slice(1).toLowerCase();
  await executeBulkStatusTransition(
    kategori,
    "SELESAI",
    "DALAM PROSES",
    `btnBukaSemulaPukal${capitalizedKategori}`,
    "fas fa-undo mr-1",
    "Buka Semula"
  );
};

window.kemaskiniStatusDelima = async function (id, statusBaru, kategori, btnElement) {
  await envReady;
  const db = (await initDatabaseClient()) || getDatabaseClient();
  if (!db || !btnElement) {
    return;
  }

  const isToSelesai = statusBaru === "SELESAI";
  const rowElement = btnElement.closest("tr");

  setButtonIconAndText(btnElement, "fas fa-circle-notch fa-spin mr-1", "Tunggu...");
  btnElement.disabled = true;
  btnElement.classList.add("opacity-70", "cursor-not-allowed");

  try {
    const { error } = await db
      .from("smpid_delima_status")
      .update({ status_proses: statusBaru })
      .eq("id", id);

    if (error) {
      throw error;
    }

    const dataArray = kategori === "GURU" ? rawDataGuru : rawDataMurid;
    const index = dataArray.findIndex((item) => String(item.id) === String(id));
    if (index !== -1) {
      dataArray[index].status_proses = statusBaru;
    }

    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Selesai!",
      text: `Status ditala ke ${statusBaru}`,
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: "colored-toast" }
    });

    const statusFilterId =
      kategori === "GURU" ? "filterDelimaGuruAdmin" : "filterDelimaMuridAdmin";
    const filterEl = document.getElementById(statusFilterId);
    const statusFilter = filterEl ? filterEl.value : "ALL";

    if (statusFilter !== "ALL" && statusFilter !== statusBaru) {
      if (rowElement) {
        rowElement.style.transition = "all 0.3s ease-out";
        rowElement.style.opacity = "0";
        rowElement.style.transform = "translateX(20px)";

        setTimeout(() => {
          const tbody = rowElement.parentNode;
          rowElement.remove();
          window.checkBulkStatus(kategori);

          if (tbody && tbody.children.length === 0) {
            renderTbodyMessage(
              tbody,
              "fas fa-inbox text-3xl mb-3 opacity-20 block",
              "Tiada rekod permohonan padan dengan tapisan ini.",
              false
            );
          }
        }, 300);
      }
    } else {
      await window.loadSenaraiDelimaAdmin(kategori, false);
    }
  } catch {
    setButtonIconAndText(
      btnElement,
      isToSelesai ? "fas fa-check-circle mr-1" : "fas fa-undo mr-1",
      isToSelesai ? "Tanda Selesai" : "Buka Semula"
    );
    btnElement.disabled = false;
    btnElement.classList.remove("opacity-70", "cursor-not-allowed");

    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "error",
      title: "Ralat Keselamatan",
      text: "Gagal mengemas kini status.",
      showConfirmButton: false,
      timer: 2500
    });
  }
};

window.salinIdDelimaAdmin = function (emel) {
  if (!emel || emel === "-" || String(emel).trim() === "") {
    return;
  }

  const cleanText = String(emel).trim();
  const notifyCopied = () => {
    showToastOrAlert({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Disalin!",
      text: cleanText,
      showConfirmButton: false,
      timer: 2000,
      customClass: { popup: "colored-toast" }
    });
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      if (successful) {
        notifyCopied();
      }
    } catch {}
    document.body.removeChild(textArea);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(cleanText)
      .then(notifyCopied)
      .catch(() => {
        fallbackCopy(cleanText);
      });
  } else {
    fallbackCopy(cleanText);
  }
};

window.padamRekodDelima = async function (id, kategori) {
  if (deleteActionBusy) {
    return;
  }

  const confirmResult = await showToastOrAlert({
    title: "Padam Rekod?",
    text: "Tindakan ini tidak boleh diundur. Rekod permohonan akan dihapuskan sepenuhnya.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#cbd5e1",
    confirmButtonText: "Ya, Padam",
    cancelButtonText: "Batal"
  });

  if (!confirmResult || !confirmResult.isConfirmed) {
    return;
  }

  deleteActionBusy = true;
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    window.Swal.fire({
      title: "Melaksanakan arahan...",
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        window.Swal.showLoading();
      }
    });
  }

  try {
    await envReady;
    const db = (await initDatabaseClient()) || getDatabaseClient();
    if (!db) {
      throw new Error("Pangkalan data tidak tersedia.");
    }

    const { error } = await db.from("smpid_delima_status").delete().eq("id", id);
    if (error) {
      throw error;
    }

    await showToastOrAlert({
      icon: "success",
      title: "Terpadam",
      text: "Rekod berjaya dibersihkan dari sistem.",
      timer: 1500,
      showConfirmButton: false
    });
    await window.loadSenaraiDelimaAdmin(kategori, true);
  } catch {
    showToastOrAlert({
      icon: "error",
      title: "Akses Ditolak",
      text: "Ralat berlaku semasa cuba memadam rekod pangkalan data.",
      confirmButtonColor: "#ef4444"
    });
  } finally {
    deleteActionBusy = false;
  }
};