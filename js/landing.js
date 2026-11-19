import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "./core/db.js";
import { SchoolService } from "./services/school.service.js";
import { AuthService } from "./services/auth.service.js";

const DEFAULT_OFFLINE_MSG =
  "Sambungan ke pangkalan data terputus. Semua modul, carian direktori sekolah, dan log masuk disekat buat sementara waktu sehingga sambungan dipulihkan.";

const RESTRICTED_HREF_TOKENS = [
  "modules/",
  "public.html",
  "gallery.html",
  "login.html",
  "admin.html",
  "user.html"
];

let allSchools = [];
let presenceChannel = null;
let presenceSessionId = "";
let isLoadingSchools = false;
let isSettingUpPresence = false;
let lifecycleBound = false;
let isDatabaseConnected = true;
let lastDisconnectReason = DEFAULT_OFFLINE_MSG;
let activeLandingProbe = null;

function getActiveSchoolSessionKey() {
  return (
    (APP_CONFIG && APP_CONFIG.SESSION && APP_CONFIG.SESSION.ACTIVE_SCHOOL) ||
    "smpid_active_school"
  );
}

function awaitRuntimeEnv() {
  if (typeof window !== "undefined" && window.ENV_READY) {
    return window.ENV_READY;
  }
  return envReady;
}

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

function setButtonContent(button, iconClass, labelText) {
  if (!button) {
    return;
  }
  clearElement(button);
  if (iconClass) {
    button.appendChild(createIcon(iconClass));
  }
  const span = document.createElement("span");
  span.textContent = labelText;
  button.appendChild(span);
}

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message =
    options && (options.text || options.title)
      ? `${options.title || ""}\n${options.text || ""}`.trim()
      : "";
  if (message && !(options && options.toast)) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function isRestrictedAnchor(anchor) {
  if (!anchor) {
    return false;
  }
  if (anchor.hasAttribute("data-requires-db")) {
    return true;
  }
  const rawHref = (anchor.getAttribute("href") || "").trim().toLowerCase();
  if (!rawHref || rawHref === "#" || rawHref === "index.html" || rawHref === "./") {
    return false;
  }
  return RESTRICTED_HREF_TOKENS.some((token) => rawHref.includes(token));
}

function ensureLandingConnectionBanner() {
  let banner = document.getElementById("dbConnectionBannerLanding");
  let messageEl = document.getElementById("dbConnectionMessageLanding");
  let retryBtn = document.getElementById("btnRetryDbConnectionLanding");

  if (!banner) {
    const mainEl = document.querySelector("main") || document.body;
    if (!mainEl) {
      return { banner: null, messageEl: null, retryBtn: null };
    }

    banner = document.createElement("div");
    banner.id = "dbConnectionBannerLanding";
    banner.setAttribute("role", "alert");
    banner.className =
      "hidden mb-6 p-4 md:p-5 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 shadow-lg";

    const layout = document.createElement("div");
    layout.className = "flex flex-col sm:flex-row sm:items-center justify-between gap-4";

    const infoRow = document.createElement("div");
    infoRow.className = "flex items-start gap-3 min-w-0";

    const iconBox = document.createElement("div");
    iconBox.className =
      "w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5";
    iconBox.appendChild(createIcon("fas fa-database text-base"));

    const textCol = document.createElement("div");
    textCol.className = "flex-1 min-w-0";

    const titleEl = document.createElement("p");
    titleEl.className = "text-xs font-black uppercase tracking-wider text-red-700 mb-1";
    titleEl.textContent = "Sekatan Sambungan Pangkalan Data";

    messageEl = document.createElement("p");
    messageEl.id = "dbConnectionMessageLanding";
    messageEl.className = "text-xs text-red-800 leading-relaxed font-medium break-words";
    messageEl.textContent = DEFAULT_OFFLINE_MSG;

    textCol.appendChild(titleEl);
    textCol.appendChild(messageEl);
    infoRow.appendChild(iconBox);
    infoRow.appendChild(textCol);

    retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.id = "btnRetryDbConnectionLanding";
    retryBtn.className =
      "w-full sm:w-auto shrink-0 min-h-[44px] px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-sm";
    setButtonContent(retryBtn, "fas fa-sync-alt", "Semak Semula Sambungan");

    layout.appendChild(infoRow);
    layout.appendChild(retryBtn);
    banner.appendChild(layout);

    if (mainEl.firstChild) {
      mainEl.insertBefore(banner, mainEl.firstChild);
    } else {
      mainEl.appendChild(banner);
    }
  }

  if (retryBtn && retryBtn.dataset.bound !== "true") {
    retryBtn.dataset.bound = "true";
    retryBtn.addEventListener("click", () => {
      verifyLandingDatabaseAvailability(true);
    });
  }

  return { banner, messageEl, retryBtn };
}

function syncRestrictedLinksState(locked) {
  if (typeof document === "undefined") {
    return;
  }
  const anchors = document.querySelectorAll("a[href]");
  anchors.forEach((anchor) => {
    if (!isRestrictedAnchor(anchor)) {
      return;
    }
    if (locked) {
      anchor.dataset.dbLocked = "true";
      anchor.setAttribute("aria-disabled", "true");
      anchor.setAttribute("tabindex", "-1");
      anchor.classList.add("opacity-50", "pointer-events-none", "cursor-not-allowed");
    } else if (anchor.dataset.dbLocked === "true") {
      delete anchor.dataset.dbLocked;
      anchor.removeAttribute("aria-disabled");
      anchor.removeAttribute("tabindex");
      anchor.classList.remove("opacity-50", "pointer-events-none", "cursor-not-allowed");
    }
  });
}

function applyLandingLockState(connected, reason = "") {
  isDatabaseConnected = Boolean(connected);
  lastDisconnectReason = isDatabaseConnected ? "" : reason || DEFAULT_OFFLINE_MSG;
  const locked = !isDatabaseConnected;

  const searchInput = document.getElementById("mainSearch");
  if (searchInput) {
    searchInput.disabled = locked;
    if (locked) {
      searchInput.classList.add("opacity-60", "cursor-not-allowed");
    } else {
      searchInput.classList.remove("opacity-60", "cursor-not-allowed");
    }
  }

  syncRestrictedLinksState(locked);

  const { banner, messageEl } = ensureLandingConnectionBanner();
  if (banner) {
    if (isDatabaseConnected) {
      banner.classList.add("hidden");
    } else {
      if (messageEl) {
        messageEl.textContent = lastDisconnectReason;
      }
      banner.classList.remove("hidden");
    }
  }
}

export async function verifyLandingDatabaseAvailability(isManualRetry = false) {
  if (activeLandingProbe) {
    return activeLandingProbe;
  }

  const { retryBtn } = ensureLandingConnectionBanner();
  if (retryBtn) {
    retryBtn.disabled = true;
    setButtonContent(retryBtn, "fas fa-circle-notch fa-spin", "Menyemak Sambungan...");
  }

  activeLandingProbe = (async () => {
    try {
      await awaitRuntimeEnv();
      const status =
        AuthService && typeof AuthService.checkDatabaseConnection === "function"
          ? await AuthService.checkDatabaseConnection()
          : { connected: true };

      if (status && status.connected) {
        const wasDisconnected = !isDatabaseConnected;
        applyLandingLockState(true, "");
        if (allSchools.length === 0) {
          await loadSchools();
        }
        if (wasDisconnected) {
          setupLiveCounter(true).catch(() => {});
        }
        if (isManualRetry) {
          await showAlert({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "Sambungan Dipulihkan",
            text: "Pangkalan data aktif. Semua modul boleh diakses semula.",
            timer: 2000,
            showConfirmButton: false
          });
        }
        return true;
      }

      const reason = (status && status.reason) || DEFAULT_OFFLINE_MSG;
      applyLandingLockState(false, reason);
      if (isManualRetry) {
        await showAlert({
          icon: "error",
          title: "Sambungan Masih Terputus",
          text: reason
        });
      }
      return false;
    } catch {
      applyLandingLockState(false, DEFAULT_OFFLINE_MSG);
      if (isManualRetry) {
        await showAlert({
          icon: "error",
          title: "Sambungan Masih Terputus",
          text: DEFAULT_OFFLINE_MSG
        });
      }
      return false;
    } finally {
      if (retryBtn) {
        retryBtn.disabled = false;
        setButtonContent(retryBtn, "fas fa-sync-alt", "Semak Semula Sambungan");
      }
      activeLandingProbe = null;
    }
  })();

  return activeLandingProbe;
}

function generateSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "session-xxx-xxx".replace(/[x]/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

function updateCounterUI(count) {
  const counterEl = document.getElementById("liveCounterVal");
  if (counterEl) {
    counterEl.textContent = String(count > 0 ? count : 1);
  }
}

async function teardownLiveCounter() {
  if (!presenceChannel) {
    return;
  }
  const channelToClose = presenceChannel;
  presenceChannel = null;
  try {
    const db = getDatabaseClient();
    if (db && typeof db.removeChannel === "function") {
      await db.removeChannel(channelToClose);
    }
  } catch {}
}

async function setupLiveCounter(forceReconnect = false) {
  if (!isDatabaseConnected || isSettingUpPresence) {
    return;
  }

  if (
    !forceReconnect &&
    presenceChannel &&
    presenceChannel.state === "joined"
  ) {
    return;
  }

  isSettingUpPresence = true;

  try {
    await awaitRuntimeEnv();
    const db = (await initDatabaseClient()) || getDatabaseClient();
    if (!db || typeof db.channel !== "function") {
      return;
    }

    await teardownLiveCounter();

    if (!presenceSessionId) {
      presenceSessionId = generateSessionId();
    }

    const channel = db.channel("room-nadim-live", {
      config: {
        presence: {
          key: presenceSessionId
        }
      }
    });

    presenceChannel = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        if (presenceChannel !== channel) {
          return;
        }
        const state = channel.presenceState();
        const activeCount = state ? Object.keys(state).length : 1;
        updateCounterUI(activeCount);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && presenceChannel === channel) {
          try {
            await channel.track({
              online_at: new Date().toISOString()
            });
          } catch {}
        }
      });
  } catch {
  } finally {
    isSettingUpPresence = false;
  }
}

function bindLifecycleEvents() {
  if (lifecycleBound) {
    return;
  }
  lifecycleBound = true;

  document.addEventListener(
    "click",
    (event) => {
      if (isDatabaseConnected) {
        return;
      }
      const targetAnchor =
        event.target && typeof event.target.closest === "function"
          ? event.target.closest("a[href]")
          : null;
      if (targetAnchor && isRestrictedAnchor(targetAnchor)) {
        event.preventDefault();
        event.stopPropagation();
        showAlert({
          icon: "error",
          title: "Akses Modul Disekat",
          text: lastDisconnectReason || DEFAULT_OFFLINE_MSG
        });
      }
    },
    true
  );

  window.addEventListener("offline", () => {
    applyLandingLockState(false, "Tiada sambungan internet dikesan pada peranti anda.");
    teardownLiveCounter().catch(() => {});
  });

  window.addEventListener("online", () => {
    verifyLandingDatabaseAvailability(false).catch(() => {});
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      verifyLandingDatabaseAvailability(false)
        .then((connected) => {
          if (connected) {
            const needsReconnect = !presenceChannel || presenceChannel.state !== "joined";
            if (needsReconnect) {
              setupLiveCounter(true).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  });

  window.addEventListener("beforeunload", () => {
    teardownLiveCounter().catch(() => {});
  });

  window.addEventListener("pagehide", () => {
    teardownLiveCounter().catch(() => {});
  });
}

async function loadSchools() {
  if (isLoadingSchools) {
    return;
  }
  isLoadingSchools = true;

  try {
    await awaitRuntimeEnv();
    await initDatabaseClient();

    const schools = await SchoolService.getLightweightList();
    allSchools = Array.isArray(schools) ? schools : [];

    populateDatalist(allSchools);
    checkSession();
  } catch {
    applyLandingLockState(false, DEFAULT_OFFLINE_MSG);
  } finally {
    isLoadingSchools = false;
    const loadingEl = document.getElementById("loadingOverlay");
    if (loadingEl) {
      loadingEl.classList.add("hidden");
    }
  }
}

function checkSession() {
  const savedKod = sessionStorage.getItem(getActiveSchoolSessionKey());

  if (savedKod && allSchools.length > 0) {
    const school = allSchools.find((s) => s.kod_sekolah === savedKod);
    if (school) {
      const input = document.getElementById("mainSearch");
      if (input) {
        input.value = `${school.kod_sekolah} - ${school.nama_sekolah}`;
      }
      renderSchoolCard(school);
    }
  }
}

function populateDatalist(data) {
  const list = document.getElementById("schoolList");
  if (!list) {
    return;
  }

  clearElement(list);
  const fragment = document.createDocumentFragment();

  data.forEach((s) => {
    if (!s || !s.kod_sekolah) {
      return;
    }
    const opt = document.createElement("option");
    opt.value = `${s.kod_sekolah} - ${s.nama_sekolah || ""}`;
    fragment.appendChild(opt);
  });

  list.appendChild(fragment);
}

function matchSchoolFromQuery(rawValue) {
  const val = String(rawValue || "").trim();
  if (!val) {
    return null;
  }

  const candidateKod = val.split(" - ")[0].trim().toUpperCase();
  return (
    allSchools.find(
      (s) => s.kod_sekolah && s.kod_sekolah.toUpperCase() === candidateKod
    ) || null
  );
}

function setupSearchListener() {
  const input = document.getElementById("mainSearch");
  if (!input) {
    return;
  }

  input.addEventListener("input", (e) => {
    if (!isDatabaseConnected) {
      return;
    }
    const val = e.target.value || "";
    const parts = val.split(" - ");

    if (parts.length >= 2) {
      const school = matchSchoolFromQuery(val);
      if (school) {
        renderSchoolCard(school);
        input.blur();
      }
    } else if (val === "") {
      window.resetSearch();
    }
  });

  input.addEventListener("change", (e) => {
    if (!isDatabaseConnected) {
      return;
    }
    const val = e.target.value || "";
    const school = matchSchoolFromQuery(val);
    if (school) {
      input.value = `${school.kod_sekolah} - ${school.nama_sekolah || ""}`;
      renderSchoolCard(school);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (!isDatabaseConnected) {
        e.preventDefault();
        return;
      }
      const school = matchSchoolFromQuery(input.value);
      if (school) {
        e.preventDefault();
        input.value = `${school.kod_sekolah} - ${school.nama_sekolah || ""}`;
        renderSchoolCard(school);
        input.blur();
      }
    }
  });
}

function createActionTile(href, iconClass, titleText, descText, theme) {
  const link = document.createElement("a");
  link.href = href;
  link.className = `group relative min-h-[44px] flex flex-col items-center justify-center p-6 rounded-2xl ${theme.cardBg} border ${theme.cardBorder} ${theme.cardHoverBg} ${theme.cardHoverBorder} hover:shadow-lg hover:-translate-y-1 transition-all duration-300 min-w-0`;

  const iconCircle = document.createElement("div");
  iconCircle.className = `w-14 h-14 bg-white ${theme.iconText} rounded-full flex items-center justify-center text-2xl mb-4 shadow-sm group-hover:bg-white/20 group-hover:text-white transition-colors shrink-0`;
  iconCircle.appendChild(createIcon(iconClass));

  const titleEl = document.createElement("h6");
  titleEl.className = `font-bold ${theme.titleText} mb-1 group-hover:text-white transition-colors text-center`;
  titleEl.textContent = titleText;

  const descEl = document.createElement("span");
  descEl.className = `text-xs ${theme.descText} text-center leading-tight ${theme.descHoverText} transition-colors break-words`;
  descEl.textContent = descText;

  link.appendChild(iconCircle);
  link.appendChild(titleEl);
  link.appendChild(descEl);
  return link;
}

function renderSchoolCard(school) {
  const kodSekolah = String(school.kod_sekolah || "").trim();
  const namaSekolah = String(school.nama_sekolah || kodSekolah).trim();
  const encodedKod = encodeURIComponent(kodSekolah);

  sessionStorage.setItem(getActiveSchoolSessionKey(), kodSekolah);

  const container = document.getElementById("schoolCardContainer");
  const welcome = document.getElementById("welcomeMessage");

  if (welcome) {
    welcome.classList.add("hidden");
  }
  if (!container) {
    return;
  }

  container.classList.remove("hidden");
  clearElement(container);

  const card = document.createElement("div");
  card.className =
    "bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 transform transition-all duration-500 animate-fade-up min-w-0";

  const header = document.createElement("div");
  header.className =
    "bg-gradient-to-r from-brand-50 to-white p-6 md:p-8 text-center border-b border-brand-100";

  const codeBadge = document.createElement("span");
  codeBadge.className =
    "inline-block bg-brand-100 text-brand-700 text-xs font-bold px-3 py-1 rounded-full mb-3 shadow-sm border border-brand-200";
  codeBadge.textContent = kodSekolah;

  const schoolHeading = document.createElement("h3");
  schoolHeading.className =
    "text-2xl md:text-3xl font-extrabold text-slate-800 leading-tight mb-2 break-words";
  schoolHeading.textContent = namaSekolah;

  const subHeading = document.createElement("p");
  subHeading.className = "text-slate-500 text-sm font-medium";
  subHeading.textContent = "Portal Rasmi Sekolah";

  header.appendChild(codeBadge);
  header.appendChild(schoolHeading);
  header.appendChild(subHeading);

  const body = document.createElement("div");
  body.className = "p-6 md:p-8";

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-3 gap-6";

  grid.appendChild(
    createActionTile(
      `public.html?kod=${encodedKod}`,
      "fas fa-paper-plane",
      "SERAHAN DATA",
      "Isi pencapaian murid/guru di sini.",
      {
        cardBg: "bg-emerald-50",
        cardBorder: "border-emerald-100",
        cardHoverBg: "hover:bg-emerald-600",
        cardHoverBorder: "hover:border-emerald-600",
        iconText: "text-emerald-500",
        titleText: "text-emerald-800",
        descText: "text-emerald-600/80",
        descHoverText: "group-hover:text-emerald-100"
      }
    )
  );

  grid.appendChild(
    createActionTile(
      `gallery.html?kod=${encodedKod}`,
      "fas fa-images",
      "GALERI SEKOLAH",
      "Lihat papan pencapaian digital.",
      {
        cardBg: "bg-blue-50",
        cardBorder: "border-blue-100",
        cardHoverBg: "hover:bg-blue-600",
        cardHoverBorder: "hover:border-blue-600",
        iconText: "text-blue-500",
        titleText: "text-blue-800",
        descText: "text-blue-600/80",
        descHoverText: "group-hover:text-blue-100"
      }
    )
  );

  grid.appendChild(
    createActionTile(
      `login.html?kod=${encodedKod}`,
      "fas fa-user-lock",
      "ADMIN SEKOLAH",
      "Log masuk GPICT & Admin DELIMa.",
      {
        cardBg: "bg-purple-50",
        cardBorder: "border-purple-100",
        cardHoverBg: "hover:bg-purple-600",
        cardHoverBorder: "hover:border-purple-600",
        iconText: "text-purple-500",
        titleText: "text-purple-800",
        descText: "text-purple-600/80",
        descHoverText: "group-hover:text-purple-100"
      }
    )
  );

  const footer = document.createElement("div");
  footer.className = "mt-8 text-center pt-6 border-t border-slate-100";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className =
    "min-h-[44px] px-4 py-2 text-slate-400 hover:text-red-500 text-sm font-bold inline-flex items-center justify-center gap-2 mx-auto transition-colors";
  resetBtn.appendChild(createIcon("fas fa-times-circle"));
  resetBtn.appendChild(document.createTextNode(" Tutup / Cari Sekolah Lain"));
  resetBtn.addEventListener("click", () => {
    window.resetSearch();
  });

  footer.appendChild(resetBtn);
  body.appendChild(grid);
  body.appendChild(footer);
  card.appendChild(header);
  card.appendChild(body);
  container.appendChild(card);

  syncRestrictedLinksState(!isDatabaseConnected);
}

window.resetSearch = function () {
  sessionStorage.removeItem(getActiveSchoolSessionKey());

  const input = document.getElementById("mainSearch");
  if (input) {
    input.value = "";
    if (isDatabaseConnected) {
      input.focus();
    }
  }

  const cardContainer = document.getElementById("schoolCardContainer");
  if (cardContainer) {
    cardContainer.classList.add("hidden");
    clearElement(cardContainer);
  }

  const welcomeMsg = document.getElementById("welcomeMessage");
  if (welcomeMsg) {
    welcomeMsg.classList.remove("hidden");
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = document.getElementById("loadingOverlay");
  if (loadingEl) {
    loadingEl.classList.remove("hidden");
  }

  ensureLandingConnectionBanner();
  setupSearchListener();
  bindLifecycleEvents();

  const connected = await verifyLandingDatabaseAvailability(false);
  if (connected) {
    await loadSchools();
  } else if (loadingEl) {
    loadingEl.classList.add("hidden");
  }

  if (connected) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        setupLiveCounter();
      });
    } else {
      setTimeout(() => {
        setupLiveCounter();
      }, 200);
    }
  }
});

if (typeof window !== "undefined") {
  window.verifyLandingDatabaseAvailability = verifyLandingDatabaseAvailability;
}