import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";
import { ImpactService } from "../services/impact.service.js";
import { toggleLoading } from "../core/helpers.js";

let rawImpactData = [];
let impactChartInstance = null;
let chartQ12Instance = null;
let chartQ13Instance = null;
let realtimeSubscribed = false;
let resetBusy = false;

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

function applyRbacToImpactData(data) {
  const list = Array.isArray(data) ? data : [];
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD);

  if (["ADMIN", "PPD_UNIT"].includes(userRole) && Array.isArray(window.globalDashboardData)) {
    const validSchoolCodes = window.globalDashboardData.map((s) => s.kod_sekolah);
    if (userKod) {
      validSchoolCodes.push(userKod);
    }
    return list.filter((d) => validSchoolCodes.includes(d.kod_sekolah));
  }

  return list;
}

function renderTableStatusRow(tbody, message, isError = false) {
  if (!tbody) {
    return;
  }
  clearElement(tbody);
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.className = isError
    ? "p-10 text-center text-red-500 font-bold bg-red-50 rounded-xl"
    : "p-10 text-center text-slate-400 font-medium italic";

  if (!isError) {
    td.appendChild(createIcon("fas fa-circle-notch fa-spin mr-2"));
  }
  td.appendChild(document.createTextNode(message));
  tr.appendChild(td);
  tbody.appendChild(tr);
}

async function silentRefreshImpactAdmin() {
  if (!document.getElementById("tbodyImpactAdmin")) {
    return;
  }
  try {
    await envReady;
    await initDatabaseClient();
    const data = await ImpactService.getAllImpactData();
    rawImpactData = applyRbacToImpactData(data);
    calculateImpactDashboard(rawImpactData);
    renderImpactTable(rawImpactData);
  } catch {}
}

function ensureRealtimeSync() {
  if (realtimeSubscribed || !RealtimeManager) {
    return;
  }
  realtimeSubscribed = true;

  RealtimeManager.subscribeTable({
    key: "admin_impak_bbm",
    table: "smpid_impak_bbm",
    primaryKey: "id",
    cacheStore: "query_cache",
    cachePrefix: "impact",
    onChange: async () => {
      await silentRefreshImpactAdmin();
    },
    onSync: async () => {
      await silentRefreshImpactAdmin();
    }
  }).catch(() => {
    realtimeSubscribed = false;
  });
}

window.loadImpactAdmin = async function () {
  const tbody = document.getElementById("tbodyImpactAdmin");
  if (!tbody) {
    return;
  }

  renderTableStatusRow(tbody, "Menganalisis maklumat...", false);

  try {
    toggleLoading(true);
    await envReady;
    await initDatabaseClient();

    const data = await ImpactService.getAllImpactData();
    rawImpactData = applyRbacToImpactData(data);

    calculateImpactDashboard(rawImpactData);
    renderImpactTable(rawImpactData);
    ensureRealtimeSync();
  } catch {
    renderTableStatusRow(tbody, "Gagal memuatkan pangkalan data analitik.", true);
    showAlert({
      icon: "error",
      title: "Ralat Rangkaian",
      text: "Sistem tidak dapat berhubung dengan pangkalan data."
    });
  } finally {
    toggleLoading(false);
  }
};

function calculateImpactDashboard(data) {
  let muridCount = 0;
  const validData = data.filter((d) => d && d.is_valid === true);
  const componentCounts = {};
  let totalPositiveResponses = 0;
  let totalUjianPositive = 0;

  const positiveLabels = ["Sangat Setuju", "Setuju", "Sangat membantu", "Membantu"];

  validData.forEach((item) => {
    muridCount += 1;

    if (Array.isArray(item.q11_komponen_bbm)) {
      item.q11_komponen_bbm.forEach((komp) => {
        if (komp) {
          componentCounts[komp] = (componentCounts[komp] || 0) + 1;
        }
      });
    }

    if (positiveLabels.includes(item.q8_keseluruhan)) {
      totalPositiveResponses += 1;
    }

    if (positiveLabels.includes(item.q7_persediaan_ujian)) {
      totalUjianPositive += 1;
    }
  });

  let sekolahTercapaiCount = 0;
  const schoolResponses = {};
  validData.forEach((item) => {
    if (item.kod_sekolah) {
      schoolResponses[item.kod_sekolah] = (schoolResponses[item.kod_sekolah] || 0) + 1;
    }
  });

  Object.keys(schoolResponses).forEach((kod) => {
    if (schoolResponses[kod] >= 10) {
      sekolahTercapaiCount += 1;
    }
  });

  const kpiSekolahEl = document.getElementById("impactKpiSekolah");
  const kpiMuridEl = document.getElementById("impactKpiMurid");
  const kpiPositifEl = document.getElementById("impactKpiPositif");
  const kpiUjianEl = document.getElementById("impactKpiUjian");

  if (kpiSekolahEl) {
    kpiSekolahEl.textContent = String(sekolahTercapaiCount);
  }
  if (kpiMuridEl) {
    kpiMuridEl.textContent = String(muridCount);
  }

  const percentPositive =
    muridCount > 0 ? Math.round((totalPositiveResponses / muridCount) * 100) : 0;
  const percentUjian =
    muridCount > 0 ? Math.round((totalUjianPositive / muridCount) * 100) : 0;

  if (kpiPositifEl) {
    kpiPositifEl.textContent = `${percentPositive}%`;
  }
  if (kpiUjianEl) {
    kpiUjianEl.textContent = `${percentUjian}%`;
  }

  renderBBMChart(componentCounts);
  renderLikertBars(validData);
}

function renderLikertBars(validData) {
  const container = document.getElementById("impactLikertBars");
  if (!container) {
    return;
  }

  clearElement(container);

  if (validData.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "text-center py-10 text-slate-400 text-sm";
    emptyDiv.textContent = "Tiada respons sah direkodkan lagi.";
    container.appendChild(emptyDiv);
    return;
  }

  const total = validData.length;
  const positiveKeywords = [
    "Sangat Setuju",
    "Setuju",
    "Sangat membantu",
    "Membantu",
    "Lebih berminat",
    "Sedikit lebih berminat",
    "Sangat yakin",
    "Yakin"
  ];

  const calculatePositivePercent = (questionKey) => {
    const count = validData.filter((d) => positiveKeywords.includes(d[questionKey])).length;
    return Math.round((count / total) * 100);
  };

  const metrics = [
    {
      label: "Kefahaman Topik",
      pct: calculatePositivePercent("q1_kefahaman"),
      icon: "fa-brain",
      color: "bg-blue-500"
    },
    {
      label: "Lebih Berminat Belajar",
      pct: calculatePositivePercent("q4_minat"),
      icon: "fa-heart",
      color: "bg-red-500"
    },
    {
      label: "Mendapat Idea Baharu",
      pct: calculatePositivePercent("q5_idea"),
      icon: "fa-lightbulb",
      color: "bg-amber-500"
    },
    {
      label: "Keyakinan Menjawab",
      pct: calculatePositivePercent("q6_keyakinan"),
      icon: "fa-shield-alt",
      color: "bg-emerald-500"
    },
    {
      label: "Memahami Penerangan Guru",
      pct: calculatePositivePercent("q10_penerangan_guru"),
      icon: "fa-chalkboard-teacher",
      color: "bg-indigo-500"
    }
  ];

  const fragment = document.createDocumentFragment();

  metrics.forEach((m) => {
    const rowWrap = document.createElement("div");
    rowWrap.className = "mb-3";

    const headerFlex = document.createElement("div");
    headerFlex.className = "flex justify-between items-center mb-1 gap-2";

    const labelSpan = document.createElement("span");
    labelSpan.className = "text-xs font-bold text-slate-700 uppercase tracking-widest";
    labelSpan.appendChild(createIcon(`fas ${m.icon} w-4 text-center mr-1 text-slate-400`));
    labelSpan.appendChild(document.createTextNode(` ${m.label}`));

    const pctSpan = document.createElement("span");
    pctSpan.className = "text-xs font-black text-slate-800 shrink-0";
    pctSpan.textContent = `${m.pct}%`;

    headerFlex.appendChild(labelSpan);
    headerFlex.appendChild(pctSpan);

    const track = document.createElement("div");
    track.className = "w-full bg-slate-100 rounded-full h-2";

    const fill = document.createElement("div");
    fill.className = `${m.color} h-2 rounded-full transition-all duration-300`;
    fill.style.width = `${m.pct}%`;

    track.appendChild(fill);
    rowWrap.appendChild(headerFlex);
    rowWrap.appendChild(track);
    fragment.appendChild(rowWrap);
  });

  container.appendChild(fragment);
}

function renderBBMChart(componentCounts) {
  const ctx = document.getElementById("impactBBMChart");
  const emptyMsg = document.getElementById("impactBBMEmpty");

  if (!ctx) {
    return;
  }
  if (impactChartInstance) {
    impactChartInstance.destroy();
    impactChartInstance = null;
  }

  const components = Object.keys(componentCounts);

  if (components.length === 0) {
    ctx.style.display = "none";
    if (emptyMsg) {
      emptyMsg.classList.remove("hidden");
    }
    return;
  }

  ctx.style.display = "block";
  if (emptyMsg) {
    emptyMsg.classList.add("hidden");
  }

  const sortedEntries = Object.entries(componentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const labels = sortedEntries.map((e) => e[0]);
  const data = sortedEntries.map((e) => e[1]);

  if (typeof window === "undefined" || typeof window.Chart === "undefined") {
    return;
  }

  impactChartInstance = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Kekerapan Pilihan Murid",
          data,
          backgroundColor: "rgba(16, 185, 129, 0.2)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.raw} Pilihan`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { stepSize: 1 }
        },
        y: {
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10, weight: "bold" } }
        }
      }
    }
  });
}

function renderImpactTable(data) {
  const tbody = document.getElementById("tbodyImpactAdmin");
  if (!tbody) {
    return;
  }

  clearElement(tbody);

  if (data.length === 0) {
    const emptyTr = document.createElement("tr");
    const emptyTd = document.createElement("td");
    emptyTd.colSpan = 6;
    emptyTd.className = "p-12 text-center text-slate-400 font-medium italic bg-slate-50/50";
    emptyTd.textContent = "Tiada rekod tinjauan impak diterima.";
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  const schoolAggregates = {};
  const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
    ? Object.keys(APP_CONFIG.PPD_MAPPING)
    : ["M010", "M020", "M030"];

  data.forEach((item) => {
    if (!item || !item.kod_sekolah || senaraiKodPPD.includes(item.kod_sekolah)) {
      return;
    }

    if (!schoolAggregates[item.kod_sekolah]) {
      let namaSekolah = item.kod_sekolah;
      if (Array.isArray(window.globalDashboardData)) {
        const sMatch = window.globalDashboardData.find(
          (s) => s.kod_sekolah === item.kod_sekolah
        );
        if (sMatch && sMatch.nama_sekolah) {
          namaSekolah = sMatch.nama_sekolah;
        }
      }

      schoolAggregates[item.kod_sekolah] = {
        kod_sekolah: item.kod_sekolah,
        nama_sekolah: namaSekolah,
        valid_count: 0,
        total_count: 0
      };
    }

    schoolAggregates[item.kod_sekolah].total_count += 1;
    if (item.is_valid) {
      schoolAggregates[item.kod_sekolah].valid_count += 1;
    }
  });

  const aggregateArray = Object.values(schoolAggregates).sort(
    (a, b) => b.valid_count - a.valid_count
  );

  if (aggregateArray.length === 0) {
    const emptyTr = document.createElement("tr");
    const emptyTd = document.createElement("td");
    emptyTd.colSpan = 6;
    emptyTd.className = "p-12 text-center text-slate-400 font-medium italic bg-slate-50/50";
    emptyTd.textContent = "Tiada rekod sekolah ditemui.";
    emptyTr.appendChild(emptyTd);
    tbody.appendChild(emptyTr);
    return;
  }

  const limit = APP_CONFIG.ADMIN_TABLE_LIMIT || 50;
  const displayList = aggregateArray.slice(0, limit);
  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const fragment = document.createDocumentFragment();

  displayList.forEach((s, index) => {
    const isReached = s.valid_count >= 10;
    const rowClass = isReached
      ? "bg-slate-50/50 grayscale-[0.2]"
      : "bg-white hover:bg-slate-50";

    const tr = document.createElement("tr");
    tr.className = `${rowClass} transition-colors border-b border-slate-100 last:border-0 group`;

    const tdBil = document.createElement("td");
    tdBil.className = "px-6 py-5 text-center font-mono font-bold text-slate-400 align-middle";
    tdBil.textContent = String(index + 1);

    const tdKod = document.createElement("td");
    tdKod.className = "px-6 py-5 font-mono font-black text-indigo-600 align-middle";
    tdKod.textContent = s.kod_sekolah;

    const tdSchool = document.createElement("td");
    tdSchool.className = "px-6 py-5 align-middle min-w-0";

    const schoolNameDiv = document.createElement("div");
    schoolNameDiv.className =
      "font-bold text-slate-800 text-sm leading-snug uppercase break-words";
    schoolNameDiv.textContent = s.nama_sekolah;

    const totalSubDiv = document.createElement("div");
    totalSubDiv.className = "text-[9px] text-slate-400 font-bold mt-1";
    totalSubDiv.textContent = `JUMLAH KESELURUHAN (TERMASUK TIDAK SAH): ${s.total_count}`;

    tdSchool.appendChild(schoolNameDiv);
    tdSchool.appendChild(totalSubDiv);

    const tdValid = document.createElement("td");
    tdValid.className = "px-6 py-5 text-center bg-indigo-50/50 align-middle";
    const validSpan = document.createElement("span");
    validSpan.className = "text-xl font-black text-indigo-700";
    validSpan.textContent = String(s.valid_count);
    tdValid.appendChild(validSpan);

    const tdStatus = document.createElement("td");
    tdStatus.className = "px-6 py-5 text-center align-middle";
    const badgeSpan = document.createElement("span");
    if (isReached) {
      badgeSpan.className =
        "inline-flex items-center bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest border border-emerald-200";
      badgeSpan.appendChild(createIcon("fas fa-check-double mr-1"));
      badgeSpan.appendChild(document.createTextNode("MINIMUM TERCAPAI"));
    } else {
      badgeSpan.className =
        "inline-flex items-center bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest border border-red-200";
      badgeSpan.appendChild(createIcon("fas fa-hourglass-half mr-1"));
      badgeSpan.appendChild(document.createTextNode("BELUM MENCAPAI MINIMUM"));
    }
    tdStatus.appendChild(badgeSpan);

    const tdAction = document.createElement("td");
    tdAction.className = "px-6 py-5 text-center align-middle";

    const actionFlex = document.createElement("div");
    actionFlex.className = "flex items-center justify-center gap-2";

    const detailBtn = document.createElement("button");
    detailBtn.type = "button";
    detailBtn.className =
      "min-h-[44px] px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] transition-all shadow-md uppercase tracking-wider inline-flex items-center justify-center gap-2 transform active:scale-95";
    detailBtn.appendChild(createIcon("fas fa-chart-pie"));
    detailBtn.appendChild(document.createTextNode(" Analisis"));
    detailBtn.addEventListener("click", () => {
      window.viewImpactDetail(s.kod_sekolah, s.nama_sekolah);
    });
    actionFlex.appendChild(detailBtn);

    if (currentUserRole === "SUPER_ADMIN") {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className =
        "min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 border border-transparent hover:border-red-200 transition-all shadow-sm inline-flex items-center justify-center";
      resetBtn.title = "Reset (Padam) Jadual Impak Sekolah Ini";
      resetBtn.appendChild(createIcon("fas fa-trash-alt"));
      resetBtn.addEventListener("click", () => {
        window.resetImpactDataAdmin(s.kod_sekolah);
      });
      actionFlex.appendChild(resetBtn);
    }

    tdAction.appendChild(actionFlex);

    tr.appendChild(tdBil);
    tr.appendChild(tdKod);
    tr.appendChild(tdSchool);
    tr.appendChild(tdValid);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAction);
    fragment.appendChild(tr);
  });

  if (aggregateArray.length > limit) {
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
    bTotal.textContent = String(aggregateArray.length);
    leftSpan.appendChild(bTotal);
    leftSpan.appendChild(document.createTextNode(" sekolah."));

    const rightSpan = document.createElement("span");
    rightSpan.className =
      "text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full font-black uppercase tracking-wider";
    rightSpan.textContent = `Eksport CSV Mengandungi 100% Data (${rawImpactData.length} Respons Mentah)`;

    flexWrap.appendChild(leftSpan);
    flexWrap.appendChild(rightSpan);
    infoTd.appendChild(flexWrap);
    infoTr.appendChild(infoTd);
    fragment.appendChild(infoTr);
  }

  tbody.appendChild(fragment);
}

window.resetImpactDataAdmin = async function (kodSekolah) {
  if (resetBusy || !kodSekolah) {
    return;
  }

  const msgBox = document.createElement("div");
  msgBox.className = "text-sm text-slate-600";
  msgBox.appendChild(document.createTextNode("Anda pasti mahu memadam "));
  const boldAll = document.createElement("strong");
  boldAll.textContent = "SEMUA";
  msgBox.appendChild(boldAll);
  msgBox.appendChild(document.createTextNode(" rekod respons Impak BBM untuk sekolah "));
  const boldKod = document.createElement("strong");
  boldKod.textContent = kodSekolah;
  msgBox.appendChild(boldKod);
  msgBox.appendChild(document.createTextNode("?"));
  msgBox.appendChild(document.createElement("br"));
  msgBox.appendChild(document.createElement("br"));
  msgBox.appendChild(document.createTextNode("Tindakan ini tidak boleh dibatalkan."));

  const result = await showAlert({
    title: "Padam Jadual Tinjauan Impak?",
    html: msgBox,
    text: `Padam SEMUA rekod respons Impak BBM untuk sekolah ${kodSekolah}? Tindakan ini tidak boleh dibatalkan.`,
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

  resetBusy = true;
  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await ImpactService.resetSchoolImpactData(kodSekolah);
    toggleLoading(false);

    await showAlert({
      icon: "success",
      title: "Data Direset",
      text: "Jadual maklum balas sekolah ini telah dikosongkan.",
      timer: 1500,
      showConfirmButton: false
    });

    await window.loadImpactAdmin();
  } catch (e) {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: e && e.message ? e.message : "Gagal memadam rekod pangkalan data."
    });
  } finally {
    resetBusy = false;
  }
};

window.viewImpactDetail = function (kodSekolah, namaSekolah) {
  const subtitle = document.getElementById("impactDetailSubtitle");
  if (subtitle) {
    subtitle.textContent = `${namaSekolah} (${kodSekolah})`;
  }

  const schoolData = rawImpactData.filter(
    (d) => d && d.kod_sekolah === kodSekolah && d.is_valid === true
  );

  const q12Counts = {};
  schoolData.forEach((item) => {
    if (item.q12_perkara_dipelajari) {
      const label = item.q12_perkara_dipelajari;
      q12Counts[label] = (q12Counts[label] || 0) + 1;
    }
  });

  const q13Counts = {};
  schoolData.forEach((item) => {
    if (Array.isArray(item.q13_cadangan)) {
      item.q13_cadangan.forEach((cadangan) => {
        if (cadangan) {
          q13Counts[cadangan] = (q13Counts[cadangan] || 0) + 1;
        }
      });
    }
  });

  renderQ12Chart(q12Counts);
  renderQ13Chart(q13Counts);

  const modal = document.getElementById("modalImpactDetail");
  if (modal) {
    modal.classList.remove("hidden");
  }
};

function renderQ12Chart(dataObj) {
  const ctx = document.getElementById("chartQ12Detail");
  if (!ctx) {
    return;
  }
  if (chartQ12Instance) {
    chartQ12Instance.destroy();
    chartQ12Instance = null;
  }

  const labels = Object.keys(dataObj);
  const dataValues = Object.values(dataObj);

  if (typeof window === "undefined" || typeof window.Chart === "undefined") {
    return;
  }

  if (labels.length === 0) {
    chartQ12Instance = new window.Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Tiada Rekod"],
        datasets: [{ data: [1], backgroundColor: ["#e2e8f0"] }]
      },
      options: { plugins: { tooltip: { enabled: false }, legend: { display: false } } }
    });
    return;
  }

  chartQ12Instance = new window.Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"],
          borderWidth: 0,
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 15,
            font: { family: "'Inter', sans-serif", size: 10, weight: "bold" }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${context.raw} Orang Murid`;
            }
          }
        }
      }
    }
  });
}

function renderQ13Chart(dataObj) {
  const ctx = document.getElementById("chartQ13Detail");
  if (!ctx) {
    return;
  }
  if (chartQ13Instance) {
    chartQ13Instance.destroy();
    chartQ13Instance = null;
  }

  const sortedEntries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
  const labels = sortedEntries.map((e) => e[0]);
  const dataValues = sortedEntries.map((e) => e[1]);

  if (typeof window === "undefined" || typeof window.Chart === "undefined") {
    return;
  }

  if (labels.length === 0) {
    chartQ13Instance = new window.Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Tiada Cadangan"],
        datasets: [{ data: [0], backgroundColor: "#e2e8f0" }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { display: false }, x: { display: false } }
      }
    });
    return;
  }

  chartQ13Instance = new window.Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Kekerapan Cadangan",
          data: dataValues,
          backgroundColor: "rgba(245, 158, 11, 0.2)",
          borderColor: "rgba(245, 158, 11, 1)",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return ` Dicadangkan oleh ${context.raw} Murid`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 10 } },
          grid: { borderDash: [2, 4], color: "#f1f5f9" }
        },
        x: {
          ticks: {
            font: { size: 9, weight: "bold" },
            maxRotation: 45,
            minRotation: 45
          },
          grid: { display: false }
        }
      }
    }
  });
}

window.eksportImpactData = function () {
  if (!rawImpactData || rawImpactData.length === 0) {
    showAlert({
      icon: "info",
      title: "Tiada Data",
      text: "Tiada rekod untuk dieksport."
    });
    return;
  }

  let csvContent =
    "KOD_SEKOLAH,TARIKH,SAH,JANTINA,UMUR,Q1_KEFAHAMAN,Q2_PENGUASAAN,Q3_INGATAN,Q4_MINAT,Q5_IDEA,Q6_KEYAKINAN,Q7_PERSEDIAAN_UJIAN,Q8_KESELURUHAN,Q9_PENGLIBATAN,Q10_PENERANGAN_GURU,Q11_KOMPONEN_BBM,Q12_DIPELAJARI,Q13_CADANGAN,Q14_SUBJEK\n";

  rawImpactData.forEach((item) => {
    const clean = (str) => `"${String(str ?? "").replace(/"/g, '""')}"`;
    const tarikh = item.created_at
      ? new Date(item.created_at).toLocaleDateString("ms-MY")
      : "-";

    const komponenBBM = Array.isArray(item.q11_komponen_bbm)
      ? item.q11_komponen_bbm.join(", ")
      : item.q11_komponen_bbm;
    const cadanganBBM = Array.isArray(item.q13_cadangan)
      ? item.q13_cadangan.join(", ")
      : item.q13_cadangan;

    const row = [
      clean(item.kod_sekolah),
      clean(tarikh),
      item.is_valid ? "YA" : "TIDAK",
      clean(item.jantina),
      clean(item.kumpulan_umur),
      clean(item.q1_kefahaman),
      clean(item.q2_penguasaan),
      clean(item.q3_ingatan),
      clean(item.q4_minat),
      clean(item.q5_idea),
      clean(item.q6_keyakinan),
      clean(item.q7_persediaan_ujian),
      clean(item.q8_keseluruhan),
      clean(item.q9_penglibatan),
      clean(item.q10_penerangan_guru),
      clean(komponenBBM),
      clean(item.q12_perkara_dipelajari),
      clean(cadanganBBM),
      clean(item.q14_pengesahan_sesi)
    ];

    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `Data_Mentah_Impak_BBM_${new Date().toISOString().slice(0, 10)}.csv`;
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