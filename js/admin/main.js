import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { RealtimeManager } from "../core/realtime.js";

const ADMIN_MODULE_VERSION = "2026.9";
const PREFETCHABLE_TABS = new Set(["penataran", "analisa", "impact", "pencapaian", "tempahan", "email", "helpdesk", "libat-urus", "admin-users"]);
const TAB_MODULE_MAP = {
  dashboard: ["./dashboard.js"],
  penataran: ["./penataran.js"],
  analisa: ["./analysis.js"],
  impact: ["./impact.js"],
  pencapaian: ["./achievement.js"],
  gallery: ["./gallery_manager.js", "./dashboard.js"],
  tempahan: ["./booking_manager.js"],
  email: ["./communication.js"],
  helpdesk: ["./communication.js", "./delima_manager.js"],
  "admin-users": ["./settings.js"],
  "import-data": ["./settings.js"],
  "libat-urus": ["./libat_urus.js"]
};

const moduleRegistry = new Map();
let currentTabId = "dashboard";

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

async function loadModule(modulePath) {
  const versionedPath = modulePath.includes("?") ? modulePath : `${modulePath}?v=${ADMIN_MODULE_VERSION}`;
  if (!moduleRegistry.has(versionedPath)) {
    const importPromise = import(versionedPath).catch((err) => {
      moduleRegistry.delete(versionedPath);
      throw err;
    });
    moduleRegistry.set(versionedPath, importPromise);
  }
  return moduleRegistry.get(versionedPath);
}

function bindTabHoverPrefetch() {
  const tabButtons = document.querySelectorAll('[id$="-tab"]');
  tabButtons.forEach((btn) => {
    const tabKey = btn.id.replace(/-tab$/, "");
    if (!PREFETCHABLE_TABS.has(tabKey)) {
      return;
    }
    const prefetch = () => {
      const targets = TAB_MODULE_MAP[tabKey] || [];
      targets.forEach((path) => {
        loadModule(path).catch(() => {});
      });
    };
    btn.addEventListener("pointerenter", prefetch, { once: true, passive: true });
    btn.addEventListener("focus", prefetch, { once: true, passive: true });
  });
}

function updateRoleDisplay(userRole) {
  const displayRole = document.getElementById("displayUserRole");
  if (!displayRole) {
    return;
  }
  clearElement(displayRole);

  if (userRole === "SUPER_ADMIN") {
    displayRole.textContent = "SUPER ADMIN";
    displayRole.className = "text-xs font-bold text-red-400 font-black";
  } else if (userRole === "JPNMEL") {
    displayRole.textContent = "JPN MELAKA";
    displayRole.className = "text-xs font-bold text-fuchsia-400 font-black";
  } else if (userRole === "PPD_UNIT") {
    displayRole.textContent = "UNIT PPD";
    displayRole.className = "text-xs font-bold text-slate-300";
  } else {
    displayRole.textContent = "MOD ADMIN";
    displayRole.className = "text-xs font-bold text-slate-300";
  }
}

function setupUnitView() {
  const hideButtons = [
    "dashboard-tab",
    "analisa-tab",
    "impact-tab",
    "gallery-tab",
    "tempahan-tab",
    "email-tab",
    "helpdesk-tab",
    "import-data-tab",
    "libat-urus-tab"
  ];
  hideButtons.forEach((btnId) => {
    const el = document.getElementById(btnId);
    if (el) {
      el.classList.add("hidden", "pointer-events-none");
      el.removeAttribute("id");
    }
  });
}

function determineInitialTab(userRole) {
  const hash = window.location.hash.replace("#", "");
  if (userRole === "PPD_UNIT") {
    if (!hash || hash === "dashboard" || hash === "") {
      return "pencapaian";
    }
    return hash;
  }
  return hash || "dashboard";
}

async function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    try {
      await envReady;
      await loadModuleData(currentTabId);
    } catch {}
  }
}

async function handleOnline() {
  try {
    await envReady;
    await loadModuleData(currentTabId);
  } catch {}
}

function handleBeforeUnload() {
  if (RealtimeManager && typeof RealtimeManager.unsubscribeAll === "function") {
    RealtimeManager.unsubscribeAll().catch(() => {});
  }
}

function bindLifecycleEvents() {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handleBeforeUnload);
}

async function initAdminPanel() {
  const isAuth = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === "true";
  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);

  if (!isAuth) {
    window.location.replace("index.html");
    return;
  }

  updateRoleDisplay(userRole);

  const importTabBtn = document.getElementById("import-data-tab");
  if (importTabBtn) {
    if (userRole === "SUPER_ADMIN") {
      importTabBtn.classList.remove("hidden");
    } else {
      importTabBtn.classList.add("hidden");
    }
  }

  if (userRole === "PPD_UNIT") {
    setupUnitView();
  }

  try {
    await envReady;
    await initDatabaseClient();
  } catch {
    return;
  }

  bindLifecycleEvents();
  bindTabHoverPrefetch();

  let initialTab = determineInitialTab(userRole);

  if (userRole !== "PPD_UNIT" && initialTab !== "dashboard") {
    loadModule("./dashboard.js")
      .then(() => {
        if (typeof window.fetchDashboardData === "function") {
          window.fetchDashboardData();
        }
      })
      .catch(() => {});
  }

  await switchAdminTab(initialTab);

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "") || "dashboard";
    switchAdminTab(hash);
  });
}

async function loadModuleData(tabId) {
  try {
    switch (tabId) {
      case "dashboard":
        await loadModule("./dashboard.js");
        if (typeof window.fetchDashboardData === "function") {
          window.fetchDashboardData();
        }
        break;

      case "penataran":
        await loadModule("./penataran.js");
        if (typeof window.muatSenaraiPenataran === "function") {
          window.muatSenaraiPenataran();
        }
        break;

      case "analisa":
        await loadModule("./analysis.js");
        if (typeof window.loadDcsAdmin === "function") {
          window.loadDcsAdmin();
        }
        break;

      case "impact":
        await loadModule("./impact.js");
        if (typeof window.loadImpactAdmin === "function") {
          window.loadImpactAdmin();
        }
        break;

      case "pencapaian":
        await loadModule("./achievement.js");
        if (typeof window.populateTahunFilter === "function") {
          window.populateTahunFilter();
        }
        break;

      case "gallery":
        await Promise.all([
          loadModule("./gallery_manager.js"),
          loadModule("./dashboard.js")
        ]);
        if (
          (!window.globalDashboardData || window.globalDashboardData.length === 0) &&
          typeof window.fetchDashboardData === "function"
        ) {
          await window.fetchDashboardData();
        }
        if (typeof window.initAdminGallery === "function") {
          window.initAdminGallery();
        }
        break;

      case "tempahan":
        await loadModule("./booking_manager.js");
        if (typeof window.initAdminBooking === "function") {
          window.initAdminBooking();
        }
        break;

      case "email":
        await loadModule("./communication.js");
        if (typeof window.generateList === "function") {
          window.generateList();
        }
        break;

      case "helpdesk":
        await Promise.all([
          loadModule("./communication.js"),
          loadModule("./delima_manager.js")
        ]);
        if (typeof window.loadTiketAdmin === "function") {
          window.loadTiketAdmin();
        }
        break;

      case "admin-users":
        await loadModule("./settings.js");
        if (typeof window.loadAdminList === "function") {
          window.loadAdminList();
        }
        break;

      case "import-data":
        await loadModule("./settings.js");
        break;

      case "libat-urus":
        await loadModule("./libat_urus.js");
        if (typeof window.loadAdminLibatUrus === "function") {
          window.loadAdminLibatUrus();
        }
        break;

      default:
        break;
    }
  } catch {}
}

async function switchAdminTab(tabId, event) {
  if (event && event.preventDefault) {
    event.preventDefault();
    history.pushState(null, "", `#${tabId}`);
  }

  const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const forbiddenForUnit = [
    "dashboard",
    "analisa",
    "impact",
    "gallery",
    "tempahan",
    "email",
    "helpdesk",
    "import-data",
    "libat-urus"
  ];
  const forbiddenForMod = ["import-data"];

  let targetTab = tabId;
  if (userRole === "PPD_UNIT" && forbiddenForUnit.includes(targetTab)) {
    targetTab = "pencapaian";
    history.replaceState(null, "", "#pencapaian");
  } else if (["ADMIN", "JPNMEL"].includes(userRole) && forbiddenForMod.includes(targetTab)) {
    targetTab = "dashboard";
    history.replaceState(null, "", "#dashboard");
  }

  currentTabId = targetTab;

  const allContents = document.querySelectorAll('[id^="tab-"]');
  allContents.forEach((el) => {
    el.classList.add("hidden");
  });

  const targetContent = document.getElementById(`tab-${targetTab}`);
  if (targetContent) {
    targetContent.classList.remove("hidden");
  } else {
    return;
  }

  const allButtons = document.querySelectorAll('[id$="-tab"]');
  allButtons.forEach((btn) => {
    btn.classList.remove("tab-active");
    btn.classList.add("tab-inactive");
  });

  const activeButton = document.getElementById(`${targetTab}-tab`);
  if (activeButton) {
    activeButton.classList.remove("tab-inactive");
    activeButton.classList.add("tab-active");
  }

  await loadModuleData(targetTab);
}

window.switchAdminTab = switchAdminTab;

document.addEventListener("DOMContentLoaded", () => {
  initAdminPanel();
});