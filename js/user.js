import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient } from "./core/db.js";
import { RealtimeManager } from "./core/realtime.js";
import {
  toggleLoading,
  checkEmailDomain,
  autoFormatPhone,
  keluarSistem,
  formatSentenceCase,
  uploadFileToDrive
} from "./core/helpers.js";
import { SchoolService } from "./services/school.service.js";
import { AuthService } from "./services/auth.service.js";
import { DcsService } from "./services/dcs.service.js";
import { SupportService } from "./services/support.service.js";
import { AchievementService } from "./services/achievement.service.js";
import { libatUrusService } from "./services/libat_urus.service.js";
import { populateDropdown } from "./config/dropdowns.js";

let analisaChart = null;
let userPencapaianList = [];
let activeSection = "menu";
let realtimeSubscribed = false;
let isSubmitting = false;

window.autoFormatPhone = autoFormatPhone;
window.keluarSistem = keluarSistem;
window.formatSentenceCase = formatSentenceCase;

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

function setButtonState(btn, iconClass, labelText) {
  if (!btn) {
    return;
  }
  clearElement(btn);
  if (iconClass) {
    btn.appendChild(createIcon(iconClass));
  }
  btn.appendChild(document.createTextNode(labelText));
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

function renderTableStatusRow(tbody, colSpan, cellClass, text) {
  if (!tbody) {
    return;
  }
  clearElement(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.className = cellClass;
  td.textContent = text;
  tr.appendChild(td);
  tbody.appendChild(tr);
}

async function refreshActiveSectionData() {
  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  if (!kod) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();

    if (activeSection === "profil" || activeSection === "menu") {
      await loadProfil(kod);
    } else if (activeSection === "aduan") {
      await window.loadTiketUser();
    } else if (activeSection === "analisa") {
      await loadAnalisaSekolah();
    } else if (activeSection === "pencapaian") {
      await window.loadPencapaianSekolah();
    } else if (activeSection === "libat-urus") {
      await window.loadLibatUrusSekolah();
    }
  } catch {}
}

function ensureUserRealtimeSync(kod) {
  if (realtimeSubscribed || !RealtimeManager || !kod) {
    return;
  }
  realtimeSubscribed = true;

  const tables = [
    {
      key: `user_school_${kod}`,
      table: "smpid_sekolah_data",
      primaryKey: "kod_sekolah",
      cacheStore: "schools_cache",
      cachePrefix: "school",
      onUpdate: () => loadProfil(kod)
    },
    {
      key: `user_ach_${kod}`,
      table: "smpid_pencapaian",
      primaryKey: "id",
      cacheStore: "achievements_cache",
      cachePrefix: "achievements",
      onUpdate: () => {
        if (activeSection === "pencapaian") {
          window.loadPencapaianSekolah();
        }
      }
    },
    {
      key: `user_ticket_${kod}`,
      table: "smpid_support_tickets",
      primaryKey: "id",
      cacheStore: "query_cache",
      cachePrefix: "tickets",
      onUpdate: () => {
        if (activeSection === "aduan") {
          window.loadTiketUser();
        }
      }
    },
    {
      key: `user_lu_${kod}`,
      table: "smpid_libat_urus",
      primaryKey: "id",
      cacheStore: "query_cache",
      cachePrefix: "libat_urus",
      onUpdate: () => {
        if (activeSection === "libat-urus") {
          window.loadLibatUrusSekolah();
        }
      }
    }
  ];

  Promise.all(
    tables.map((cfg) =>
      RealtimeManager.subscribeTable({
        key: cfg.key,
        table: cfg.table,
        primaryKey: cfg.primaryKey,
        cacheStore: cfg.cacheStore,
        cachePrefix: cfg.cachePrefix,
        onChange: async () => {
          await cfg.onUpdate();
        },
        onSync: async () => {
          await cfg.onUpdate();
        }
      })
    )
  ).catch(() => {
    realtimeSubscribed = false;
  });
}

function bindLifecycleEvents() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshActiveSectionData();
    }
  });

  window.addEventListener("online", () => {
    refreshActiveSectionData();
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
  initUserPortal();
});

async function initUserPortal() {
  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const isAdmin = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === "true";

  if (!kod && !isAdmin) {
    window.location.replace("index.html");
    return;
  }

  const currentYear = String(new Date().getFullYear());

  populateDropdown("pInputJawatan", "JAWATAN", "GURU AKADEMIK BIASA");
  populateDropdown("pInputPeringkat", "PERINGKAT", "KEBANGSAAN");
  populateDropdown("pInputPenyedia", "PENYEDIA", "LAIN-LAIN");
  populateDropdown("pInputTahun", "TAHUN", currentYear);

  const displayKod = document.getElementById("displayKodSekolah");
  const btnLogout = document.getElementById("btnLogoutMenu");

  if (isAdmin) {
    if (displayKod) {
      clearElement(displayKod);
      displayKod.appendChild(createIcon("fas fa-user-shield me-2"));
      displayKod.appendChild(document.createTextNode(`ADMIN VIEW: ${kod || "-"}`));
      displayKod.className =
        "inline-flex items-center gap-2 bg-indigo-600/20 border border-indigo-400 text-white text-xs font-bold px-4 py-1.5 rounded-full backdrop-blur-sm";
    }

    if (btnLogout) {
      clearElement(btnLogout);
      btnLogout.appendChild(createIcon("fas fa-arrow-left"));
      btnLogout.appendChild(document.createTextNode(" Kembali ke Dashboard Admin"));
      btnLogout.removeAttribute("onclick");
      btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        window.kembaliKeAdmin();
      });
      btnLogout.className =
        "w-full min-h-[44px] py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm";
    }

    const btnReset = document.getElementById("btnResetData");
    if (btnReset) {
      btnReset.classList.remove("hidden");
    }
  } else if (displayKod) {
    clearElement(displayKod);
    displayKod.appendChild(createIcon("fas fa-school"));
    displayKod.appendChild(document.createTextNode(` ${kod || "-"}`));
  }

  try {
    await envReady;
    await initDatabaseClient();
    await loadProfil(kod);
    ensureUserRealtimeSync(kod);
  } catch {}
}

window.kembaliKeAdmin = function () {
  const realRole = localStorage.getItem("smpid_real_user_role");
  const realKod = localStorage.getItem("smpid_real_user_kod");

  if (realRole) {
    localStorage.setItem(APP_CONFIG.SESSION.USER_ROLE, realRole);
    localStorage.removeItem("smpid_real_user_role");
  }
  if (realKod) {
    localStorage.setItem(APP_CONFIG.SESSION.USER_KOD, realKod);
    localStorage.removeItem("smpid_real_user_kod");
  }

  window.location.href = "admin.html";
};

// --- 1. NAVIGATION LOGIC ---

window.showSection = function (section, event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
    history.pushState(null, "", `#${section}`);
  }

  activeSection = section || "menu";

  const sections = ["menu", "profil", "aduan", "analisa", "pencapaian", "libat-urus"];
  sections.forEach((s) => {
    const el = document.getElementById(`section-${s}`);
    if (el) {
      el.classList.add("hidden");
    }
  });

  const targetEl = document.getElementById(`section-${activeSection}`);
  if (targetEl) {
    targetEl.classList.remove("hidden");
    targetEl.classList.add("animate-fade-up");
  }

  const welcomeText = document.getElementById("welcomeText");

  if (activeSection === "menu" && welcomeText) {
    welcomeText.textContent = "MENU UTAMA";
  }
  if (activeSection === "profil" && welcomeText) {
    welcomeText.textContent = "PROFIL SEKOLAH";
  }

  if (activeSection === "aduan") {
    window.loadTiketUser();
    if (welcomeText) {
      welcomeText.textContent = "HELPDESK";
    }
  }
  if (activeSection === "analisa") {
    loadAnalisaSekolah();
    if (welcomeText) {
      welcomeText.textContent = "ANALISA DIGITAL";
    }
  }
  if (activeSection === "pencapaian") {
    window.loadPencapaianSekolah();
    if (welcomeText) {
      welcomeText.textContent = "REKOD PENCAPAIAN";
    }
  }
  if (activeSection === "libat-urus") {
    window.loadLibatUrusSekolah();
    if (welcomeText) {
      welcomeText.textContent = "LAPORAN LIBAT URUS";
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// --- 2. PROFILE MANAGEMENT ---

async function loadProfil(kod) {
  if (!kod) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();

    const data = await SchoolService.getByCode(kod);
    if (!data) {
      return;
    }

    const dispNama = document.getElementById("dispNamaSekolah");
    const dispKodDaerah = document.getElementById("dispKodDaerah");
    const hiddenKod = document.getElementById("hiddenKodSekolah");

    if (dispNama) {
      dispNama.textContent = data.nama_sekolah || kod;
    }
    if (dispKodDaerah) {
      dispKodDaerah.textContent = `KOD: ${data.kod_sekolah} | DAERAH: ${data.daerah || "-"}`;
    }
    if (hiddenKod) {
      hiddenKod.value = data.kod_sekolah || kod;
    }

    const fields = {
      sekolahTel: data.no_telefon_sekolah,
      pgbNama: data.nama_pgb,
      pgbTel: data.no_telefon_pgb,
      pgbEmel: data.emel_delima_pgb,
      gpkNama: data.nama_gpk,
      gpkTel: data.no_telefon_gpk,
      gpkEmel: data.emel_delima_gpk,
      gpictNama: data.nama_gpict,
      gpictTel: data.no_telefon_gpict,
      gpictEmel: data.emel_delima_gpict,
      adminNama: data.nama_admin_delima,
      adminTel: data.no_telefon_admin_delima,
      adminEmel: data.emel_delima_admin_delima
    };

    Object.keys(fields).forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = fields[id] || "";
      }
    });

    const sbAdaRadios = document.getElementsByName("sb_ada");
    const dbSbAda = data.sb_ada || "TIDAK";
    sbAdaRadios.forEach((radio) => {
      if (radio.value === dbSbAda) {
        radio.checked = true;
      }
    });

    if (dbSbAda === "YA") {
      const sbKaedahEl = document.getElementById("sb_kaedah");
      const sbSemuaEl = document.getElementById("sb_bil_semua");
      const sbFungsiEl = document.getElementById("sb_bil_fungsi");

      if (sbKaedahEl) {
        sbKaedahEl.value = data.sb_kaedah || "";
      }
      if (sbSemuaEl) {
        sbSemuaEl.value = data.sb_bil_semua ?? "";
      }
      if (sbFungsiEl) {
        sbFungsiEl.value = data.sb_bil_fungsi ?? "";
      }

      const lokasiArray = data.sb_lokasi ? String(data.sb_lokasi).split(",") : [];
      const lokasiCheckboxes = document.getElementsByName("sb_lokasi");
      lokasiCheckboxes.forEach((cb) => {
        cb.checked = lokasiArray.includes(cb.value);
      });
    }

    if (typeof window.toggleSmartboard === "function") {
      window.toggleSmartboard();
    }
  } catch {}
}

window.simpanProfil = async function () {
  if (isSubmitting) {
    return;
  }

  const kodEl = document.getElementById("hiddenKodSekolah");
  const kod = kodEl ? kodEl.value : "";
  const emelPgbEl = document.getElementById("pgbEmel");
  const emelGpkEl = document.getElementById("gpkEmel");
  const emelGEl = document.getElementById("gpictEmel");

  const emelPgb = emelPgbEl ? emelPgbEl.value.trim() : "";
  const emelGpk = emelGpkEl ? emelGpkEl.value.trim() : "";
  const emelG = emelGEl ? emelGEl.value.trim() : "";
  const btnSubmit = document.querySelector('#dataForm button[type="submit"]');

  if (emelPgb && !checkEmailDomain(emelPgb)) {
    await showAlert({
      icon: "warning",
      title: "Format Emel PGB Salah",
      text: "Sila gunakan emel rasmi domain @moe-dl.edu.my",
      confirmButtonColor: "#f59e0b"
    });
    return;
  }

  if (emelGpk && !checkEmailDomain(emelGpk)) {
    await showAlert({
      icon: "warning",
      title: "Format Emel GPK Salah",
      text: "Sila gunakan emel rasmi domain @moe-dl.edu.my",
      confirmButtonColor: "#f59e0b"
    });
    return;
  }

  if (!checkEmailDomain(emelG)) {
    await showAlert({
      icon: "warning",
      title: "Format Emel Salah",
      text: "Sila gunakan emel rasmi domain @moe-dl.edu.my",
      confirmButtonColor: "#f59e0b"
    });
    return;
  }

  const sbAdaRadio = document.querySelector('input[name="sb_ada"]:checked');
  const sbAda = sbAdaRadio ? sbAdaRadio.value : "TIDAK";
  let sbKaedah = null;
  let sbBilSemua = null;
  let sbBilFungsi = null;
  let sbLokasi = null;

  if (sbAda === "YA") {
    const sbKaedahEl = document.getElementById("sb_kaedah");
    const sbSemuaEl = document.getElementById("sb_bil_semua");
    const sbFungsiEl = document.getElementById("sb_bil_fungsi");

    sbKaedah = sbKaedahEl ? sbKaedahEl.value : "";
    sbBilSemua = sbSemuaEl ? parseInt(sbSemuaEl.value, 10) : NaN;
    sbBilFungsi = sbFungsiEl ? parseInt(sbFungsiEl.value, 10) : NaN;

    const lokasiCheckboxes = document.querySelectorAll('input[name="sb_lokasi"]:checked');
    const lokasiValues = Array.from(lokasiCheckboxes).map((cb) => cb.value);

    if (lokasiValues.length > 0) {
      sbLokasi = lokasiValues.join(",");
    }

    if (!sbKaedah || Number.isNaN(sbBilSemua) || Number.isNaN(sbBilFungsi) || !sbLokasi) {
      await showAlert({
        icon: "warning",
        title: "Data Smart Board Tidak Lengkap",
        text: "Sila lengkapkan semua ruangan maklumat Smart Board.",
        confirmButtonColor: "#f59e0b"
      });
      return;
    }
  }

  const getUpperVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim().toUpperCase() : "";
  };
  const getRawVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  };

  const payload = {
    no_telefon_sekolah: getRawVal("sekolahTel"),
    sb_ada: sbAda,
    sb_kaedah: sbKaedah,
    sb_bil_semua: sbBilSemua,
    sb_bil_fungsi: sbBilFungsi,
    sb_lokasi: sbLokasi,
    nama_pgb: getUpperVal("pgbNama"),
    no_telefon_pgb: getRawVal("pgbTel"),
    emel_delima_pgb: emelPgb,
    nama_gpk: getUpperVal("gpkNama"),
    no_telefon_gpk: getRawVal("gpkTel"),
    emel_delima_gpk: emelGpk,
    nama_gpict: getUpperVal("gpictNama"),
    no_telefon_gpict: getRawVal("gpictTel"),
    emel_delima_gpict: emelG,
    nama_admin_delima: getUpperVal("adminNama"),
    no_telefon_admin_delima: getRawVal("adminTel"),
    emel_delima_admin_delima: getRawVal("adminEmel")
  };

  isSubmitting = true;
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.classList.add("opacity-75");
  }
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();
    await SchoolService.updateProfile(kod, payload);

    await showAlert({
      icon: "success",
      title: "Tersimpan",
      text: "Maklumat sekolah berjaya dikemaskini.",
      confirmButtonColor: "#22c55e"
    });
    window.showSection("menu");
  } catch {
    await showAlert({
      icon: "error",
      title: "Ralat",
      text: "Gagal menyimpan profil. Sila cuba lagi."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove("opacity-75");
    }
  }
};

window.salinData = function () {
  const checkSama = document.getElementById("checkSama");
  if (checkSama && checkSama.checked) {
    ["Nama", "Tel", "Emel"].forEach((suffix) => {
      const gpictEl = document.getElementById(`gpict${suffix}`);
      const adminEl = document.getElementById(`admin${suffix}`);
      if (gpictEl && adminEl) {
        adminEl.value = gpictEl.value;
      }
    });
  }
};

// --- 3. DIGITAL ANALYSIS (DCS/DELIMa) ---

async function loadAnalisaSekolah() {
  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const tableBody = document.getElementById("tableAnalisaBody");

  try {
    await envReady;
    await initDatabaseClient();

    const data = await DcsService.getBySchool(kod);

    if (!data) {
      renderTableStatusRow(
        tableBody,
        3,
        "p-8 text-center text-red-400 font-bold italic",
        "Data analisa sekolah belum tersedia."
      );
      return;
    }

    const dataKeys = Object.keys(data);
    const availableYears = dataKeys
      .filter((key) => key.startsWith("dcs_"))
      .map((key) => parseInt(key.replace("dcs_", ""), 10))
      .filter((year) => !Number.isNaN(year))
      .sort((a, b) => b - a);

    let dcsLatest = null;
    let dcsPrev = null;
    let latestYear = null;
    let prevYear = null;

    if (availableYears.length > 0) {
      latestYear = availableYears[0];
      dcsLatest = data[`dcs_${latestYear}`];

      if (availableYears.length > 1) {
        prevYear = availableYears[1];
        dcsPrev = data[`dcs_${prevYear}`];
      }
    }

    const aktifLatest =
      latestYear && data[`peratus_aktif_${latestYear}`] != null
        ? data[`peratus_aktif_${latestYear}`]
        : prevYear && data[`peratus_aktif_${prevYear}`] != null
          ? data[`peratus_aktif_${prevYear}`]
          : null;

    const valDcsEl = document.getElementById("valDcs");
    const valAktifEl = document.getElementById("valAktif");

    if (valDcsEl) {
      valDcsEl.textContent = dcsLatest != null ? Number(dcsLatest).toFixed(2) : "0.00";
    }
    if (valAktifEl) {
      valAktifEl.textContent = aktifLatest != null ? String(aktifLatest) : "0";
    }

    const trendEl = document.getElementById("trendDcs");
    if (trendEl) {
      clearElement(trendEl);
      if (dcsLatest == null || dcsPrev == null) {
        trendEl.textContent = "Tahun Semasa";
        trendEl.className =
          "inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm";
      } else if (dcsLatest > dcsPrev) {
        trendEl.appendChild(createIcon("fas fa-arrow-up text-green-300 mr-1"));
        trendEl.appendChild(document.createTextNode(" Meningkat"));
        trendEl.className =
          "inline-block bg-green-500/30 border border-green-400/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm";
      } else if (dcsLatest < dcsPrev) {
        trendEl.appendChild(createIcon("fas fa-arrow-down text-red-300 mr-1"));
        trendEl.appendChild(document.createTextNode(" Menurun"));
        trendEl.className =
          "inline-block bg-red-500/30 border border-red-400/50 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm";
      } else {
        trendEl.appendChild(createIcon("fas fa-minus text-slate-200 mr-1"));
        trendEl.appendChild(document.createTextNode(" Kekal"));
        trendEl.className =
          "inline-block bg-white/20 border border-white/30 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm";
      }
    }

    renderAnalisaTable(data, availableYears);
    renderDcsChart(data, availableYears);
  } catch {}
}

function renderAnalisaTable(data, availableYears) {
  const tableBody = document.getElementById("tableAnalisaBody");
  if (!tableBody) {
    return;
  }

  let years = availableYears;
  if (!years) {
    years = Object.keys(data)
      .filter((key) => key.startsWith("dcs_"))
      .map((key) => parseInt(key.replace("dcs_", ""), 10))
      .filter((year) => !Number.isNaN(year))
      .sort((a, b) => b - a);
  }

  const sortedYearsAsc = [...years].sort((a, b) => a - b);
  clearElement(tableBody);
  const fragment = document.createDocumentFragment();
  let rowCount = 0;

  sortedYearsAsc.forEach((year) => {
    const dcs = data[`dcs_${year}`];
    const aktif = data[`peratus_aktif_${year}`];
    if (dcs !== null || aktif !== null) {
      rowCount += 1;
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition-colors";

      const tdYear = document.createElement("td");
      tdYear.className = "px-6 py-4 font-bold text-slate-500";
      tdYear.textContent = String(year);

      const tdDcs = document.createElement("td");
      tdDcs.className = "px-6 py-4 font-black text-blue-600";
      tdDcs.textContent = dcs != null ? Number(dcs).toFixed(2) : "-";

      const tdAktif = document.createElement("td");
      tdAktif.className = "px-6 py-4 font-black text-green-600";
      tdAktif.textContent = aktif != null ? `${aktif}%` : "-";

      tr.appendChild(tdYear);
      tr.appendChild(tdDcs);
      tr.appendChild(tdAktif);
      fragment.appendChild(tr);
    }
  });

  if (rowCount === 0) {
    renderTableStatusRow(
      tableBody,
      3,
      "p-6 text-center text-slate-400 italic",
      "Tiada sejarah data ditemui."
    );
    return;
  }

  tableBody.appendChild(fragment);
}

function renderDcsChart(data, availableYears) {
  const ctx = document.getElementById("chartAnalisa");
  if (!ctx || typeof Chart === "undefined") {
    return;
  }
  if (analisaChart) {
    analisaChart.destroy();
  }

  let years = availableYears;
  if (!years) {
    years = Object.keys(data)
      .filter((key) => key.startsWith("dcs_"))
      .map((key) => parseInt(key.replace("dcs_", ""), 10))
      .filter((year) => !Number.isNaN(year))
      .sort((a, b) => a - b);
  } else {
    years = [...availableYears].sort((a, b) => a - b);
  }

  const chartYears = years.slice(-3);
  const labels = chartYears.map(String);
  const dataDcs = chartYears.map((year) => data[`dcs_${year}`]);
  const dataAktif = chartYears.map((year) => data[`peratus_aktif_${year}`]);

  analisaChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Skor DCS (0-5)",
          data: dataDcs,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          yAxisID: "y",
          tension: 0.4,
          fill: true,
          pointRadius: 6,
          pointBackgroundColor: "#3b82f6"
        },
        {
          label: "% Aktif DELIMa",
          data: dataAktif,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          yAxisID: "y1",
          tension: 0.4,
          borderDash: [5, 5],
          pointRadius: 6,
          pointBackgroundColor: "#10b981"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { weight: "bold" } } } },
      scales: {
        y: {
          min: 0,
          max: 5,
          position: "left",
          title: { display: true, text: "Skor DCS" }
        },
        y1: {
          min: 0,
          max: 100,
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "% Aktif" }
        }
      }
    }
  });
}

// --- 4. ACHIEVEMENT (KEMENJADIAN) MODULE WITH FILE UPLOAD ---

window.setPencapaianType = function (type) {
  const catEl = document.getElementById("pencapaianKategori");
  if (catEl) {
    catEl.value = type;
  }

  const tabs = ["murid", "guru", "sekolah"];
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-p-${t}`);
    if (!btn) {
      return;
    }
    if (t.toUpperCase() === type) {
      btn.className =
        "flex-1 min-h-[44px] py-2 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-md transition transform scale-105";
    } else {
      btn.className =
        "flex-1 min-h-[44px] py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition";
    }
  });

  const wrapperJenis = document.getElementById("wrapperJenisRekod");
  const divJawatan = document.getElementById("divInputJawatan");
  const inpName = document.getElementById("pInputNama");
  const lblName = document.getElementById("labelNamaPeserta");
  const radioPertandingan = document.getElementById("radioPertandingan");
  const dispNama = document.getElementById("dispNamaSekolah");

  if (type === "GURU") {
    if (wrapperJenis) {
      wrapperJenis.classList.remove("hidden");
    }
    if (divJawatan) {
      divJawatan.classList.remove("hidden");
    }
    if (inpName) {
      inpName.value = "";
      inpName.readOnly = false;
    }
    if (lblName) {
      lblName.textContent = "NAMA GURU";
    }
  } else {
    if (wrapperJenis) {
      wrapperJenis.classList.add("hidden");
    }
    if (divJawatan) {
      divJawatan.classList.add("hidden");
    }
    if (radioPertandingan) {
      radioPertandingan.checked = true;
    }

    if (type === "SEKOLAH") {
      if (inpName) {
        inpName.value = dispNama ? dispNama.textContent : "";
        inpName.readOnly = true;
      }
      if (lblName) {
        lblName.textContent = "NAMA SEKOLAH";
      }
    } else {
      if (inpName) {
        inpName.value = "";
        inpName.readOnly = false;
      }
      if (lblName) {
        lblName.textContent = "NAMA MURID / KUMPULAN";
      }
    }
  }
  window.toggleJenisPencapaian();
};

window.toggleJenisPencapaian = function () {
  const radSijil = document.getElementById("radioPensijilan");
  const isPensijilan = radSijil ? radSijil.checked : false;
  const rekodEl = document.getElementById("pInputJenisRekod");
  if (rekodEl) {
    rekodEl.value = isPensijilan ? "PENSIJILAN" : "PERTANDINGAN";
  }

  const divPenyedia = document.getElementById("divInputPenyedia");
  const colPeringkat = document.getElementById("divColPeringkat");

  if (isPensijilan) {
    if (divPenyedia) {
      divPenyedia.classList.remove("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.add("hidden");
    }
  } else {
    if (divPenyedia) {
      divPenyedia.classList.add("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.remove("hidden");
    }
  }
};

window.loadPencapaianSekolah = async function () {
  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const tbody = document.getElementById("tbodyRekodPencapaian");
  if (!tbody) {
    return;
  }

  renderTableStatusRow(
    tbody,
    3,
    "p-8 text-center text-slate-400 font-medium animate-pulse",
    "Memuatkan rekod..."
  );

  try {
    await envReady;
    await initDatabaseClient();

    const data = await AchievementService.getBySchool(kod);
    userPencapaianList = Array.isArray(data) ? data : [];

    if (userPencapaianList.length === 0) {
      renderTableStatusRow(
        tbody,
        3,
        "p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl",
        "Tiada rekod pencapaian ditemui."
      );
      return;
    }

    clearElement(tbody);
    const fragment = document.createDocumentFragment();

    userPencapaianList.forEach((item) => {
      let badgeClass = "bg-slate-100 text-slate-600";
      if (item.kategori === "MURID") {
        badgeClass = "bg-blue-100 text-blue-700 border-blue-200";
      } else if (item.kategori === "GURU") {
        badgeClass = "bg-amber-100 text-amber-700 border-amber-200";
      } else if (item.kategori === "SEKOLAH") {
        badgeClass = "bg-green-100 text-green-700 border-green-200";
      }

      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group";

      const tdCat = document.createElement("td");
      tdCat.className = "px-4 py-4 text-center w-24 align-top";

      const catBadge = document.createElement("span");
      catBadge.className = `inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeClass}`;
      catBadge.textContent = item.kategori || "-";

      const yearDiv = document.createElement("div");
      yearDiv.className = "text-[10px] text-slate-400 mt-1.5 font-mono font-bold";
      yearDiv.textContent = String(item.tahun || "-");

      tdCat.appendChild(catBadge);
      tdCat.appendChild(yearDiv);

      const tdDetail = document.createElement("td");
      tdDetail.className = "px-4 py-4 min-w-0";

      const nameDiv = document.createElement("div");
      nameDiv.className =
        "font-bold text-slate-800 text-sm leading-snug mb-0.5 uppercase whitespace-normal break-words";
      nameDiv.textContent = item.nama_peserta || "-";

      const progDiv = document.createElement("div");
      progDiv.className =
        "text-xs text-teal-600 font-bold mb-1.5 leading-tight whitespace-normal break-words";
      if (item.jenis_rekod === "PENSIJILAN") {
        const sijilBadge = document.createElement("span");
        sijilBadge.className =
          "bg-amber-50 text-amber-600 text-[9px] px-1 rounded border border-amber-200 mr-1 font-black";
        sijilBadge.textContent = "SIJIL";
        progDiv.appendChild(sijilBadge);
        progDiv.appendChild(document.createTextNode(` ${item.nama_pertandingan || "-"}`));
      } else {
        progDiv.textContent = item.nama_pertandingan || "-";
      }

      const tagsRow = document.createElement("div");
      tagsRow.className = "flex flex-wrap gap-2";

      const levelTag = document.createElement("span");
      levelTag.className =
        "bg-white text-slate-500 text-[10px] px-2 py-0.5 rounded border border-slate-200 uppercase font-medium";
      levelTag.textContent = item.peringkat || "-";

      const resultTag = document.createElement("span");
      resultTag.className =
        "bg-green-50 text-green-700 text-[10px] px-2 py-0.5 rounded border border-green-100 font-black uppercase tracking-wider";
      resultTag.textContent = item.pencapaian || "-";

      tagsRow.appendChild(levelTag);
      tagsRow.appendChild(resultTag);

      tdDetail.appendChild(nameDiv);
      tdDetail.appendChild(progDiv);
      tdDetail.appendChild(tagsRow);

      const tdActions = document.createElement("td");
      tdActions.className = "px-4 py-4 text-center w-28 align-middle";

      const actionWrap = document.createElement("div");
      actionWrap.className =
        "flex items-center justify-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className =
        "min-w-[44px] min-h-[44px] p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition shadow-sm inline-flex items-center justify-center";
      editBtn.title = "Edit";
      editBtn.appendChild(createIcon("fas fa-edit"));
      editBtn.addEventListener("click", () => {
        window.openEditPencapaianUser(item.id);
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className =
        "min-w-[44px] min-h-[44px] p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition shadow-sm inline-flex items-center justify-center";
      delBtn.title = "Padam";
      delBtn.appendChild(createIcon("fas fa-trash-alt"));
      delBtn.addEventListener("click", () => {
        window.padamPencapaian(item.id);
      });

      actionWrap.appendChild(editBtn);
      actionWrap.appendChild(delBtn);
      tdActions.appendChild(actionWrap);

      tr.appendChild(tdCat);
      tr.appendChild(tdDetail);
      tr.appendChild(tdActions);
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  } catch {
    renderTableStatusRow(
      tbody,
      3,
      "p-8 text-center text-red-500 font-bold",
      "Ralat pangkalan data."
    );
  }
};

window.simpanPencapaian = async function () {
  if (isSubmitting) {
    return;
  }

  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const btn = document.querySelector('#formPencapaian button[type="submit"]');
  const catEl = document.getElementById("pencapaianKategori");
  const rekodEl = document.getElementById("pInputJenisRekod");
  const kategori = catEl ? catEl.value : "";
  const jenisRekod = rekodEl ? rekodEl.value : "";

  let jawatan = null;
  if (kategori === "GURU") {
    const jawatanEl = document.getElementById("pInputJawatan");
    jawatan = jawatanEl ? jawatanEl.value : "";
    if (!jawatan) {
      await showAlert({
        icon: "warning",
        title: "Ralat Jawatan",
        text: "Sila pilih jawatan guru."
      });
      return;
    }
  }

  const peringkatEl = document.getElementById("pInputPeringkat");
  const penyediaEl = document.getElementById("pInputPenyedia");
  let peringkat = peringkatEl ? peringkatEl.value : "KEBANGSAAN";
  const penyedia = penyediaEl ? penyediaEl.value : "LAIN-LAIN";
  if (jenisRekod === "PENSIJILAN") {
    peringkat = "ANTARABANGSA";
  }

  const namaEl = document.getElementById("pInputNama");
  const progEl = document.getElementById("pInputProgram");
  const pencEl = document.getElementById("pInputPencapaian");
  const fileInput = document.getElementById("pInputFile");
  const tahunEl = document.getElementById("pInputTahun");

  const nama = namaEl ? namaEl.value.trim().toUpperCase() : "";
  const program = progEl ? progEl.value.trim().toUpperCase() : "";
  const pencapaian = pencEl ? pencEl.value.trim().toUpperCase() : "";
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  const tahun = tahunEl ? parseInt(tahunEl.value, 10) : NaN;

  if (!nama || !program || !pencapaian || !file || Number.isNaN(tahun)) {
    await showAlert({
      icon: "warning",
      title: "Maklumat Tidak Lengkap",
      text: "Sila isi semua ruangan bertanda termasuk muat naik fail."
    });
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    await showAlert({
      icon: "warning",
      title: "Fail Terlalu Besar",
      text: "Maksimum saiz fail adalah 5MB."
    });
    return;
  }

  isSubmitting = true;
  if (btn) {
    btn.disabled = true;
    setButtonState(btn, "fas fa-circle-notch fa-spin me-2", "MEMUAT NAIK FAIL...");
    btn.classList.add("opacity-75");
  }
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();

    const uploadedUrl = await uploadFileToDrive(file);
    const safeUrl = sanitizeExternalUrl(uploadedUrl);

    if (btn) {
      setButtonState(btn, "fas fa-circle-notch fa-spin me-2", "MENYIMPAN REKOD...");
    }

    const payload = {
      kod_sekolah: kod,
      kategori,
      nama_peserta: nama,
      nama_pertandingan: program,
      peringkat,
      tahun,
      pencapaian,
      pautan_bukti: safeUrl,
      jenis_rekod: jenisRekod,
      penyedia,
      jawatan
    };

    await AchievementService.create(payload);

    await showAlert({
      icon: "success",
      title: "Berjaya Direkod",
      text: "Maklumat dan fail bukti telah disimpan ke sistem.",
      confirmButtonColor: "#22c55e"
    });

    const formPencapaian = document.getElementById("formPencapaian");
    if (formPencapaian && typeof formPencapaian.reset === "function") {
      formPencapaian.reset();
    }
    if (fileInput) {
      fileInput.value = "";
    }
    if (tahunEl) {
      tahunEl.value = String(new Date().getFullYear());
    }
    await window.loadPencapaianSekolah();
  } catch (err) {
    await showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: err && err.message ? err.message : "Gagal menyimpan rekod. Sila cuba lagi."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
    if (btn) {
      btn.disabled = false;
      setButtonState(btn, "fas fa-save me-2", " SIMPAN REKOD");
      btn.classList.remove("opacity-75");
    }
  }
};

// --- 5. EDIT MODAL OPERATIONS (HYBRID FILE LOGIC) ---

window.openEditPencapaianUser = function (id) {
  const item = userPencapaianList.find((i) => String(i.id) === String(id));
  if (!item) {
    return;
  }

  populateDropdown("editUserJawatan", "JAWATAN", item.jawatan);
  populateDropdown("editUserPeringkat", "PERINGKAT", item.peringkat);
  populateDropdown("editUserPenyedia", "PENYEDIA", item.penyedia);
  populateDropdown("editUserTahun", "TAHUN", item.tahun);

  const editIdEl = document.getElementById("editUserId");
  if (editIdEl) {
    editIdEl.value = item.id;
  }

  const radSijil = document.getElementById("editRadioPensijilanUser");
  const radPert = document.getElementById("editRadioPertandinganUser");
  if (item.jenis_rekod === "PENSIJILAN") {
    if (radSijil) {
      radSijil.checked = true;
    }
  } else if (radPert) {
    radPert.checked = true;
  }

  const namaEl = document.getElementById("editUserNama");
  const progEl = document.getElementById("editUserProgram");
  const pencEl = document.getElementById("editUserPencapaian");
  const fileEl = document.getElementById("editUserFile");

  if (namaEl) {
    namaEl.value = item.nama_peserta || "";
  }
  if (progEl) {
    progEl.value = item.nama_pertandingan || "";
  }
  if (pencEl) {
    pencEl.value = item.pencapaian || "";
  }
  if (fileEl) {
    fileEl.value = "";
  }

  const currentProofLink = document.getElementById("currentProofLink");
  if (currentProofLink) {
    const safeUrl = sanitizeExternalUrl(item.pautan_bukti);
    currentProofLink.href = safeUrl || "#";
    currentProofLink.rel = "noopener noreferrer";
  }

  window.toggleEditUserJenis();

  const divJawatan = document.getElementById("editUserDivJawatan");
  if (divJawatan) {
    if (item.kategori === "GURU") {
      divJawatan.classList.remove("hidden");
    } else {
      divJawatan.classList.add("hidden");
    }
  }

  const modal = document.getElementById("modalEditPencapaianUser");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

window.toggleEditUserJenis = function () {
  const radChecked = document.querySelector('input[name="editRadioJenisUser"]:checked');
  const jenis = radChecked ? radChecked.value : "PERTANDINGAN";
  const divPenyedia = document.getElementById("editUserDivPenyedia");
  const colPeringkat = document.getElementById("editUserColPeringkat");

  const lblProg = document.getElementById("lblEditUserProgram");
  const lblPenc = document.getElementById("lblEditUserPencapaian");

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

window.updatePencapaianUser = async function () {
  if (isSubmitting) {
    return;
  }

  const idEl = document.getElementById("editUserId");
  const id = idEl ? idEl.value : "";
  const btn = document.querySelector('#formEditPencapaianUser button[type="submit"]');
  const radChecked = document.querySelector('input[name="editRadioJenisUser"]:checked');
  const jenis = radChecked ? radChecked.value : "PERTANDINGAN";
  const fileInput = document.getElementById("editUserFile");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (file && file.size > 5 * 1024 * 1024) {
    await showAlert({
      icon: "warning",
      title: "Ralat Saiz",
      text: "Maksimum saiz fail adalah 5MB"
    });
    return;
  }

  isSubmitting = true;
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
      if (btn) {
        setButtonState(btn, "fas fa-circle-notch fa-spin me-2", "MEMUAT NAIK FAIL...");
      }
      const uploadedUrl = await uploadFileToDrive(file);
      finalUrl = sanitizeExternalUrl(uploadedUrl);
    } else {
      const item = userPencapaianList.find((i) => String(i.id) === String(id));
      finalUrl = item ? sanitizeExternalUrl(item.pautan_bukti) || item.pautan_bukti : "";
    }

    if (btn) {
      setButtonState(btn, "fas fa-circle-notch fa-spin me-2", "MENYIMPAN KEMASKINI...");
    }

    const namaEl = document.getElementById("editUserNama");
    const progEl = document.getElementById("editUserProgram");
    const pencEl = document.getElementById("editUserPencapaian");
    const tahunEl = document.getElementById("editUserTahun");

    const payload = {
      nama_peserta: namaEl ? namaEl.value.trim().toUpperCase() : "",
      nama_pertandingan: progEl ? progEl.value.trim().toUpperCase() : "",
      pencapaian: pencEl ? pencEl.value.trim().toUpperCase() : "",
      pautan_bukti: finalUrl,
      tahun: tahunEl ? parseInt(tahunEl.value, 10) : new Date().getFullYear(),
      jenis_rekod: jenis
    };

    const divJawatan = document.getElementById("editUserDivJawatan");
    if (divJawatan && !divJawatan.classList.contains("hidden")) {
      const jawatanEl = document.getElementById("editUserJawatan");
      payload.jawatan = jawatanEl ? jawatanEl.value : null;
      payload.kategori = "GURU";
    }

    if (jenis === "PENSIJILAN") {
      const penyediaEl = document.getElementById("editUserPenyedia");
      payload.penyedia = penyediaEl ? penyediaEl.value : "LAIN-LAIN";
      payload.peringkat = "ANTARABANGSA";
    } else {
      const peringkatEl = document.getElementById("editUserPeringkat");
      payload.peringkat = peringkatEl ? peringkatEl.value : "KEBANGSAAN";
    }

    await AchievementService.update(id, payload);

    const modal = document.getElementById("modalEditPencapaianUser");
    if (modal) {
      modal.classList.add("hidden");
    }

    await showAlert({
      icon: "success",
      title: "Kemaskini Berjaya",
      timer: 1500,
      showConfirmButton: false
    });
    await window.loadPencapaianSekolah();
  } catch (e) {
    await showAlert({
      icon: "error",
      title: "Gagal",
      text: e && e.message ? e.message : "Sistem tidak dapat mengemaskini rekod."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
    if (btn) {
      btn.disabled = false;
      setButtonState(btn, null, "SIMPAN PERUBAHAN");
      btn.classList.remove("opacity-75");
    }
  }
};

window.padamPencapaian = async function (id) {
  if (isSubmitting || !id) {
    return;
  }

  const result = await showAlert({
    title: "Padam Rekod?",
    text: "Tindakan ini tidak boleh dibatalkan semula.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Ya, Padam",
    cancelButtonText: "Batal"
  });

  if (!result || !result.isConfirmed) {
    return;
  }

  isSubmitting = true;
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await AchievementService.delete(id);

    await showAlert({
      icon: "success",
      title: "Berjaya",
      text: "Rekod telah dipadam."
    });
    await window.loadPencapaianSekolah();
  } catch {
    await showAlert({
      icon: "error",
      title: "Ralat",
      text: "Gagal memadam rekod."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
  }
};

// --- 6. HELPDESK & TICKETING ---

window.hantarTiket = async function () {
  if (isSubmitting) {
    return;
  }

  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const perananEl = document.getElementById("tiketPeranan");
  const tajukEl = document.getElementById("tiketTajuk");
  const mesejEl = document.getElementById("tiketMesej");

  const peranan = perananEl ? perananEl.value : "";
  const tajuk = tajukEl ? tajukEl.value.trim().toUpperCase() : "";
  const mesej = mesejEl ? mesejEl.value.trim() : "";

  if (!peranan) {
    await showAlert({
      icon: "warning",
      title: "Peranan Wajib",
      text: "Sila pilih peranan anda."
    });
    return;
  }

  isSubmitting = true;
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();

    await SupportService.createTicket({
      kod_sekolah: kod,
      peranan_pengirim: peranan,
      tajuk,
      butiran_masalah: mesej
    });

    await showAlert({
      icon: "success",
      title: "Tiket Dihantar",
      text: "Kami akan menyemak aduan anda secepat mungkin."
    });

    const formTiket = document.getElementById("formTiket");
    if (formTiket && typeof formTiket.reset === "function") {
      formTiket.reset();
    }
    if (typeof window.switchAduanTab === "function") {
      window.switchAduanTab("semak");
    }
    await window.loadTiketUser();
  } catch {
    await showAlert({
      icon: "error",
      title: "Ralat",
      text: "Gagal menghantar tiket aduan."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
  }
};

window.loadTiketUser = async function () {
  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const container = document.getElementById("senaraiTiketContainer");
  if (!container) {
    return;
  }

  try {
    await envReady;
    await initDatabaseClient();

    const data = await SupportService.getBySchool(kod);
    const list = Array.isArray(data) ? data : [];
    clearElement(container);

    if (list.length === 0) {
      const emptyBox = document.createElement("div");
      emptyBox.className =
        "p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 font-medium italic";
      emptyBox.textContent = "Tiada tiket aduan aktif ditemui.";
      container.appendChild(emptyBox);
      return;
    }

    const fragment = document.createDocumentFragment();

    list.forEach((t) => {
      const card = document.createElement("div");
      card.className =
        "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all min-w-0";

      const topRow = document.createElement("div");
      topRow.className = "flex justify-between items-start gap-2 mb-3";

      const dateDiv = document.createElement("div");
      dateDiv.className = "text-[10px] text-slate-400 font-black uppercase tracking-widest";
      dateDiv.textContent = t.created_at
        ? new Date(t.created_at).toLocaleDateString("ms-MY")
        : "-";

      const statusBadge = document.createElement("span");
      if (t.status === "SELESAI") {
        statusBadge.className =
          "bg-green-100 text-green-700 text-[10px] px-2.5 py-1 rounded-full font-black border border-green-200 shrink-0";
        statusBadge.textContent = "SELESAI";
      } else {
        statusBadge.className =
          "bg-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-full font-black animate-pulse border border-amber-200 shrink-0";
        statusBadge.textContent = "DALAM PROSES";
      }

      topRow.appendChild(dateDiv);
      topRow.appendChild(statusBadge);

      const titleEl = document.createElement("h4");
      titleEl.className =
        "font-bold text-slate-800 text-sm mb-2 uppercase leading-tight break-words";
      titleEl.textContent = t.tajuk || "-";

      const bodyEl = document.createElement("p");
      bodyEl.className =
        "text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl break-words";
      bodyEl.textContent = t.butiran_masalah || "-";

      card.appendChild(topRow);
      card.appendChild(titleEl);
      card.appendChild(bodyEl);

      if (t.balasan_admin) {
        const replyBox = document.createElement("div");
        replyBox.className =
          "mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 break-words";

        const replyHeader = document.createElement("strong");
        replyHeader.className = "text-emerald-700 uppercase flex items-center gap-2 mb-1";
        replyHeader.appendChild(createIcon("fas fa-check-circle"));
        replyHeader.appendChild(document.createTextNode(" Respon Pentadbir:"));

        replyBox.appendChild(replyHeader);
        replyBox.appendChild(document.createTextNode(t.balasan_admin));
        card.appendChild(replyBox);
      }

      fragment.appendChild(card);
    });

    container.appendChild(fragment);
  } catch {
    clearElement(container);
    const errDiv = document.createElement("div");
    errDiv.className = "text-red-500 font-bold text-center py-6";
    errDiv.textContent = "Ralat memuatkan sejarah tiket.";
    container.appendChild(errDiv);
  }
};

// --- 7. SECURITY & MAINTENANCE ---

window.ubahKataLaluan = async function () {
  const userId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);
  if (!userId) {
    await showAlert({
      icon: "error",
      title: "Sesi Luput",
      text: "Sila log masuk semula."
    });
    return;
  }

  if (!window.Swal || typeof window.Swal.fire !== "function") {
    return;
  }

  const { value: formValues } = await window.Swal.fire({
    title: "Tukar Kata Laluan",
    html: `
      <div class="space-y-3">
        <input id="swal-old-pass" type="password" class="w-full min-h-[44px] p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Kata Laluan Lama">
        <input id="swal-new-pass" type="password" class="w-full min-h-[44px] p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Kata Laluan Baharu (Min 6)">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Simpan Perubahan",
    confirmButtonColor: "#16a34a",
    preConfirm: () => {
      const oldEl = document.getElementById("swal-old-pass");
      const newEl = document.getElementById("swal-new-pass");
      const oldP = oldEl ? oldEl.value : "";
      const newP = newEl ? newEl.value : "";
      if (!oldP || !newP) {
        window.Swal.showValidationMessage("Sila isi kedua-dua ruangan.");
        return false;
      }
      if (newP.length < 6) {
        window.Swal.showValidationMessage("Kata laluan baharu minima 6 aksara.");
        return false;
      }
      return [oldP, newP];
    }
  });

  if (formValues) {
    const [oldPass, newPass] = formValues;
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AuthService.changePassword(userId, oldPass, newPass);

      await showAlert({
        icon: "success",
        title: "Berjaya Ditukar",
        text: "Sila log masuk semula dengan kata laluan baharu.",
        confirmButtonColor: "#22c55e"
      });
      keluarSistem();
    } catch (err) {
      await showAlert({
        icon: "error",
        title: "Gagal",
        text: err && err.message ? err.message : "Gagal menukar kata laluan."
      });
    } finally {
      toggleLoading(false);
    }
  }
};

window.resetDataSekolah = async function () {
  if (isSubmitting) {
    return;
  }

  const kodEl = document.getElementById("hiddenKodSekolah");
  const kod = kodEl ? kodEl.value : "";

  if (!window.Swal || typeof window.Swal.fire !== "function") {
    return;
  }

  const { value: password } = await window.Swal.fire({
    title: "Akses Pentadbir PPD",
    text: "Masukkan kata laluan keselamatan untuk reset data:",
    input: "password",
    showCancelButton: true,
    confirmButtonText: "SAHKAN RESET",
    confirmButtonColor: "#ef4444"
  });

  if (password === "pkgag") {
    const confirmResult = await showAlert({
      title: "Sahkan Padam Semua Data?",
      text: "Data profil PGB, GPK, GPICT dan Admin DELIMa akan dipadamkan (NULL). Kod sekolah akan kekal wujud.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Ya, Padam Semua!"
    });

    if (confirmResult && confirmResult.isConfirmed) {
      isSubmitting = true;
      toggleLoading(true);
      try {
        await envReady;
        await initDatabaseClient();
        await SchoolService.resetData(kod);

        await showAlert({
          icon: "success",
          title: "Selesai",
          text: "Data sekolah telah dikosongkan."
        });
        await loadProfil(kod);
      } catch {
        await showAlert({
          icon: "error",
          title: "Ralat",
          text: "Gagal memulakan proses reset data."
        });
      } finally {
        isSubmitting = false;
        toggleLoading(false);
      }
    }
  } else if (password) {
    await showAlert({
      icon: "error",
      title: "Akses Ditolak",
      text: "Kata laluan keselamatan tidak sah."
    });
  }
};

// --- 8. LIBAT URUS DELIMa ---

window.submitLibatUrus = async function () {
  if (isSubmitting) {
    return;
  }

  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const btn = document.getElementById("btnSubmitLU");
  const form = document.getElementById("formLibatUrus");

  const katEl = document.getElementById("luKategori");
  const tarikhEl = document.getElementById("luTarikh");
  const pesertaEl = document.getElementById("luPeserta");
  const tempatEl = document.getElementById("luTempat");
  const fileInput = document.getElementById("luFile");

  const kategori = katEl ? katEl.value : "";
  const tarikh = tarikhEl ? tarikhEl.value : "";
  const peserta = pesertaEl ? pesertaEl.value : "";
  const tempat = tempatEl ? tempatEl.value.trim() : "";
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  const modPelaksanaanInput = document.querySelector('input[name="luModPelaksanaan"]:checked');
  const modPelaksanaan = modPelaksanaanInput ? modPelaksanaanInput.value : "BERSEMUKA";

  if (!kategori || !tarikh || !peserta || !tempat || !file) {
    await showAlert({
      icon: "warning",
      title: "Maklumat Tidak Lengkap",
      text: "Sila isi semua ruangan bertanda termasuk muat naik fail."
    });
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    await showAlert({
      icon: "warning",
      title: "Fail Terlalu Besar",
      text: "Maksimum saiz fail adalah 5MB."
    });
    return;
  }

  isSubmitting = true;
  if (btn) {
    btn.disabled = true;
    setButtonState(btn, "fas fa-circle-notch fa-spin me-2", "MEMUAT NAIK FAIL...");
    btn.classList.add("opacity-75");
  }
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();

    const uploadedUrl = await libatUrusService.uploadReportFile(file);
    const safeUrl = sanitizeExternalUrl(uploadedUrl);

    if (btn) {
      setButtonState(btn, "fas fa-circle-notch fa-spin me-2", "MENYIMPAN LAPORAN...");
    }

    const payload = {
      kod_sekolah: kod,
      kategori_sasar: kategori,
      tarikh_laksana: tarikh,
      tempat,
      jumlah_peserta: peserta,
      pautan_fail: safeUrl,
      mod_pelaksanaan: modPelaksanaan
    };

    await libatUrusService.createLibatUrus(payload);

    await showAlert({
      icon: "success",
      title: "Berjaya Dihantar",
      text: "Laporan Libat Urus telah direkodkan.",
      confirmButtonColor: "#ea580c"
    });

    if (form && typeof form.reset === "function") {
      form.reset();
    }
    await window.loadLibatUrusSekolah();
  } catch (error) {
    await showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: error && error.message ? error.message : "Gagal menghantar laporan."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
    if (btn) {
      btn.disabled = false;
      setButtonState(btn, "fas fa-paper-plane me-2", " HANTAR LAPORAN");
      btn.classList.remove("opacity-75");
    }
  }
};

window.loadLibatUrusSekolah = async function () {
  const kod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);
  const tbody = document.getElementById("tbodyLibatUrus");
  if (!tbody) {
    return;
  }

  renderTableStatusRow(
    tbody,
    3,
    "p-8 text-center text-slate-400 font-medium animate-pulse",
    "Memuatkan laporan..."
  );

  try {
    await envReady;
    await initDatabaseClient();

    const data = await libatUrusService.getReportsBySchool(kod);
    const list = Array.isArray(data) ? data : [];

    if (list.length === 0) {
      renderTableStatusRow(
        tbody,
        3,
        "p-8 text-center text-slate-400 italic bg-slate-50 rounded-xl",
        "Tiada rekod libat urus ditemui."
      );
      return;
    }

    clearElement(tbody);
    const fragment = document.createDocumentFragment();

    list.forEach((item) => {
      const badgeColor =
        item.kategori_sasar === "GURU"
          ? "bg-blue-100 text-blue-700 border-blue-200"
          : item.kategori_sasar === "MURID"
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : "bg-green-100 text-green-700 border-green-200";

      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition border-b border-slate-100 last:border-0 group";

      const tdInfo = document.createElement("td");
      tdInfo.className = "px-4 py-4 min-w-0";

      const badgeRow = document.createElement("div");
      badgeRow.className = "mb-1.5 flex flex-wrap items-center gap-1";

      const catSpan = document.createElement("span");
      catSpan.className = `inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeColor}`;
      catSpan.textContent = item.kategori_sasar || "-";

      const modSpan = document.createElement("span");
      if (item.mod_pelaksanaan === "DALAM TALIAN") {
        modSpan.className =
          "inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-purple-50 text-purple-600 border-purple-200";
        modSpan.appendChild(createIcon("fas fa-video mr-1"));
        modSpan.appendChild(document.createTextNode(" DALAM TALIAN"));
      } else {
        modSpan.className =
          "inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-teal-50 text-teal-600 border-teal-200";
        modSpan.appendChild(createIcon("fas fa-users mr-1"));
        modSpan.appendChild(document.createTextNode(" BERSEMUKA"));
      }

      badgeRow.appendChild(catSpan);
      badgeRow.appendChild(modSpan);

      const tempatDiv = document.createElement("div");
      tempatDiv.className = "font-bold text-slate-800 text-sm leading-snug uppercase break-words";
      tempatDiv.textContent = item.tempat || "-";

      const dateDiv = document.createElement("div");
      dateDiv.className = "text-[10px] text-slate-500 font-mono font-bold mt-1";
      dateDiv.appendChild(createIcon("far fa-calendar-alt mr-1"));
      const dateFormatted = item.tarikh_laksana
        ? new Date(item.tarikh_laksana).toLocaleDateString("ms-MY")
        : "-";
      dateDiv.appendChild(
        document.createTextNode(` ${dateFormatted} (${item.bulan || "-"})`)
      );

      tdInfo.appendChild(badgeRow);
      tdInfo.appendChild(tempatDiv);
      tdInfo.appendChild(dateDiv);

      const tdCount = document.createElement("td");
      tdCount.className = "px-4 py-4 text-center align-middle";

      const countNum = document.createElement("div");
      countNum.className = "text-2xl font-black text-slate-700";
      countNum.textContent = String(item.jumlah_peserta ?? 0);

      const countLabel = document.createElement("div");
      countLabel.className = "text-[9px] font-bold text-slate-400 uppercase tracking-widest";
      countLabel.textContent = "Peserta";

      tdCount.appendChild(countNum);
      tdCount.appendChild(countLabel);

      const tdAction = document.createElement("td");
      tdAction.className = "px-4 py-4 text-center align-middle";

      const actionWrap = document.createElement("div");
      actionWrap.className =
        "flex items-center justify-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity";

      const safeFileUrl = sanitizeExternalUrl(item.pautan_fail);
      if (safeFileUrl) {
        const viewLink = document.createElement("a");
        viewLink.href = safeFileUrl;
        viewLink.target = "_blank";
        viewLink.rel = "noopener noreferrer";
        viewLink.className =
          "min-w-[44px] min-h-[44px] p-2 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white transition shadow-sm inline-flex items-center justify-center";
        viewLink.title = "Lihat Laporan";
        viewLink.appendChild(createIcon("fas fa-external-link-alt"));
        actionWrap.appendChild(viewLink);
      }

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className =
        "min-w-[44px] min-h-[44px] p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition shadow-sm inline-flex items-center justify-center";
      delBtn.title = "Padam Laporan";
      delBtn.appendChild(createIcon("fas fa-trash-alt"));
      delBtn.addEventListener("click", () => {
        window.padamLibatUrus(item.id);
      });
      actionWrap.appendChild(delBtn);

      tdAction.appendChild(actionWrap);

      tr.appendChild(tdInfo);
      tr.appendChild(tdCount);
      tr.appendChild(tdAction);
      fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
  } catch {
    renderTableStatusRow(
      tbody,
      3,
      "p-8 text-center text-red-500 font-bold",
      "Ralat memuatkan rekod."
    );
  }
};

window.padamLibatUrus = async function (id) {
  if (isSubmitting || !id) {
    return;
  }

  const result = await showAlert({
    title: "Padam Laporan?",
    text: "Tindakan ini tidak boleh dibatalkan semula. Laporan (One-Page Report) di Google Drive tidak akan dipadam.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "Ya, Padam",
    cancelButtonText: "Batal"
  });

  if (!result || !result.isConfirmed) {
    return;
  }

  isSubmitting = true;
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await libatUrusService.deleteReport(id);

    await showAlert({
      icon: "success",
      title: "Berjaya",
      text: "Laporan telah dipadam daripada pangkalan data."
    });
    await window.loadLibatUrusSekolah();
  } catch {
    await showAlert({
      icon: "error",
      title: "Ralat",
      text: "Gagal memadam laporan. Ralat pelayan."
    });
  } finally {
    isSubmitting = false;
    toggleLoading(false);
  }
};