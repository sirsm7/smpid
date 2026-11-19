import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient } from "./core/db.js";
import * as authGuard from "./core/auth.guard.js?v=2026.4";
import { AuthService } from "./services/auth.service.js";
import { toggleLoading } from "./core/helpers.js";

const ADMIN_ROLES = new Set(["ADMIN", "PPD_UNIT", "SUPER_ADMIN", "JPNMEL"]);
const DEFAULT_OFFLINE_MSG =
  "Sambungan ke pangkalan data terputus. Log masuk dan penggunaan sistem disekat sehingga sambungan dipulihkan.";

let loginBusy = false;
let isDatabaseConnected = true;
let lastDisconnectReason = DEFAULT_OFFLINE_MSG;
let activeProbePromise = null;
let lifecycleListenersBound = false;

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

function setButtonContent(button, iconClass, labelText) {
  if (!button) {
    return;
  }
  clearElement(button);
  if (iconClass) {
    const icon = document.createElement("i");
    icon.className = iconClass;
    button.appendChild(icon);
  }
  const span = document.createElement("span");
  span.textContent = labelText;
  button.appendChild(span);
}

function resetClientSession() {
  if (authGuard && typeof authGuard.clearSessionState === "function") {
    authGuard.clearSessionState();
    return;
  }
  if (
    authGuard &&
    authGuard.default &&
    typeof authGuard.default.clearSessionState === "function"
  ) {
    authGuard.default.clearSessionState();
    return;
  }
  const sessionCfg = (APP_CONFIG && APP_CONFIG.SESSION) || {};
  const keys = [
    sessionCfg.AUTH_FLAG || "smpid_auth",
    sessionCfg.USER_KOD || "smpid_user_kod",
    sessionCfg.USER_ROLE || "smpid_user_role",
    sessionCfg.USER_ID || "smpid_user_id",
    "smpid_auth",
    "smpid_user_kod",
    "smpid_user_role",
    "smpid_user_id"
  ];
  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
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

function getLoginControls() {
  const inputEmail = document.getElementById("inputEmail");
  const inputPass = document.getElementById("inputPassword");
  const btnLogin =
    document.getElementById("btnLogin") ||
    document.querySelector('button[onclick*="prosesLogin"]');
  return { inputEmail, inputPass, btnLogin };
}

function ensureConnectionBanner() {
  let banner = document.getElementById("dbConnectionBanner");
  let messageEl = document.getElementById("dbConnectionMessage");
  let retryBtn = document.getElementById("btnRetryDbConnection");

  if (!banner) {
    const { inputEmail } = getLoginControls();
    const anchorTarget =
      (inputEmail && inputEmail.closest("form")) ||
      (inputEmail && inputEmail.parentElement);

    if (!anchorTarget || !anchorTarget.parentNode) {
      return { banner: null, messageEl: null, retryBtn: null };
    }

    banner = document.createElement("div");
    banner.id = "dbConnectionBanner";
    banner.setAttribute("role", "alert");
    banner.className =
      "hidden mb-5 p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 shadow-sm";

    const headerRow = document.createElement("div");
    headerRow.className = "flex items-start gap-3";

    const iconWrap = document.createElement("div");
    iconWrap.className =
      "w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5";
    const warnIcon = document.createElement("i");
    warnIcon.className = "fas fa-database";
    iconWrap.appendChild(warnIcon);

    const textCol = document.createElement("div");
    textCol.className = "flex-1 min-w-0";

    const heading = document.createElement("p");
    heading.className = "text-xs font-black uppercase tracking-wider text-red-700 mb-1";
    heading.textContent = "Sekatan Sambungan Pangkalan Data";

    messageEl = document.createElement("p");
    messageEl.id = "dbConnectionMessage";
    messageEl.className = "text-xs text-red-800 leading-relaxed font-medium break-words";
    messageEl.textContent = DEFAULT_OFFLINE_MSG;

    textCol.appendChild(heading);
    textCol.appendChild(messageEl);
    headerRow.appendChild(iconWrap);
    headerRow.appendChild(textCol);

    retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.id = "btnRetryDbConnection";
    retryBtn.className =
      "mt-3 w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-sm";
    setButtonContent(retryBtn, "fas fa-sync-alt", "Semak Semula Sambungan");

    banner.appendChild(headerRow);
    banner.appendChild(retryBtn);
    anchorTarget.parentNode.insertBefore(banner, anchorTarget);
  }

  if (retryBtn && retryBtn.dataset.bound !== "true") {
    retryBtn.dataset.bound = "true";
    retryBtn.addEventListener("click", () => {
      verifyDatabaseAvailability(true);
    });
  }

  return { banner, messageEl, retryBtn };
}

function applyDatabaseLockState(connected, reason = "") {
  isDatabaseConnected = Boolean(connected);
  lastDisconnectReason = isDatabaseConnected ? "" : reason || DEFAULT_OFFLINE_MSG;

  const { inputEmail, inputPass, btnLogin } = getLoginControls();
  const shouldDisable = !isDatabaseConnected;

  if (inputEmail) {
    inputEmail.disabled = shouldDisable;
  }
  if (inputPass) {
    inputPass.disabled = shouldDisable;
  }
  if (btnLogin) {
    btnLogin.disabled = shouldDisable || loginBusy;
    if (shouldDisable) {
      btnLogin.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      btnLogin.classList.remove("opacity-50", "cursor-not-allowed");
    }
  }

  const { banner, messageEl } = ensureConnectionBanner();
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

function clearOfflineQueryParam() {
  if (typeof window === "undefined" || !window.history || !window.location) {
    return;
  }
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has("db")) {
    currentUrl.searchParams.delete("db");
    window.history.replaceState(null, "", currentUrl.toString());
  }
}

export async function verifyDatabaseAvailability(isManualRetry = false) {
  if (activeProbePromise) {
    return activeProbePromise;
  }

  const { retryBtn } = ensureConnectionBanner();
  if (retryBtn) {
    retryBtn.disabled = true;
    setButtonContent(retryBtn, "fas fa-circle-notch fa-spin", "Menyemak Sambungan...");
  }

  activeProbePromise = (async () => {
    try {
      await awaitRuntimeEnv();
      const status =
        AuthService && typeof AuthService.checkDatabaseConnection === "function"
          ? await AuthService.checkDatabaseConnection()
          : { connected: true };

      if (status && status.connected) {
        applyDatabaseLockState(true, "");
        clearOfflineQueryParam();
        if (isManualRetry) {
          await showAlert({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "Sambungan Dipulihkan",
            text: "Pangkalan data aktif. Anda boleh log masuk sekarang.",
            timer: 2000,
            showConfirmButton: false
          });
        }
        return true;
      }

      const reason = (status && status.reason) || DEFAULT_OFFLINE_MSG;
      applyDatabaseLockState(false, reason);
      if (isManualRetry) {
        await showAlert({
          icon: "error",
          title: "Sambungan Masih Terputus",
          text: reason
        });
      }
      return false;
    } catch {
      applyDatabaseLockState(false, DEFAULT_OFFLINE_MSG);
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
      activeProbePromise = null;
    }
  })();

  return activeProbePromise;
}

function isDatabaseDisconnectError(err) {
  if (!err || typeof err.message !== "string") {
    return false;
  }
  const msg = err.message.toLowerCase();
  return (
    msg.includes("pangkalan data terputus") ||
    msg.includes("tiada sambungan internet") ||
    msg.includes("tamat masa") ||
    msg.includes("sambungan pangkalan data disekat")
  );
}

function persistUserSession(user, isAdmin) {
  const sessionCfg = (APP_CONFIG && APP_CONFIG.SESSION) || {};
  const kodKey = sessionCfg.USER_KOD || "smpid_user_kod";
  const roleKey = sessionCfg.USER_ROLE || "smpid_user_role";
  const idKey = sessionCfg.USER_ID || "smpid_user_id";
  const authKey = sessionCfg.AUTH_FLAG || "smpid_auth";

  const kodVal = String(user.kod_sekolah || "").trim();
  const roleVal = String(user.role || "").trim().toUpperCase();
  const idVal = String(user.id || "").trim();
  const authVal = isAdmin ? "true" : "false";

  localStorage.setItem(kodKey, kodVal);
  localStorage.setItem(roleKey, roleVal);
  localStorage.setItem(idKey, idVal);
  localStorage.setItem(authKey, authVal);

  localStorage.setItem("smpid_user_kod", kodVal);
  localStorage.setItem("smpid_user_role", roleVal);
  localStorage.setItem("smpid_user_id", idVal);
  localStorage.setItem("smpid_auth", authVal);
}

function renderLoginHeader() {
  const params = new URLSearchParams(window.location.search);
  const kod = params.get("kod");
  const mod = params.get("mod");

  const titleEl = document.getElementById("loginTitle");
  if (!titleEl) {
    return;
  }

  if (mod === "admin") {
    clearElement(titleEl);
    const shieldIcon = document.createElement("i");
    shieldIcon.className = "fas fa-user-shield mr-2";
    titleEl.appendChild(shieldIcon);
    titleEl.appendChild(document.createTextNode("LOG MASUK PENTADBIR"));
  } else if (kod && kod.trim() !== "") {
    clearElement(titleEl);
    titleEl.appendChild(document.createTextNode("LOG MASUK "));
    const codeSpan = document.createElement("span");
    codeSpan.className = "text-brand-600";
    codeSpan.textContent = kod.trim().toUpperCase();
    titleEl.appendChild(codeSpan);
  }
}

export function togglePass() {
  const input = document.getElementById("inputPassword");
  const icon = document.getElementById("iconEye");

  if (!input || !icon) {
    return;
  }

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

export async function prosesLogin() {
  if (loginBusy) {
    return;
  }

  if (!isDatabaseConnected) {
    const reconnected = await verifyDatabaseAvailability(false);
    if (!reconnected) {
      await showAlert({
        icon: "error",
        title: "Akses Disekat",
        text: lastDisconnectReason || DEFAULT_OFFLINE_MSG
      });
      return;
    }
  }

  const { inputEmail, inputPass, btnLogin } = getLoginControls();

  if (!inputEmail || !inputPass) {
    return;
  }

  const email = inputEmail.value.trim();
  const password = inputPass.value;

  if (!email || !password || password.trim() === "") {
    await showAlert({
      icon: "warning",
      title: "Ralat",
      text: "Sila masukkan emel dan kata laluan."
    });
    return;
  }

  loginBusy = true;
  if (btnLogin) {
    btnLogin.disabled = true;
  }
  toggleLoading(true);

  try {
    await awaitRuntimeEnv();
    await initDatabaseClient();

    const user = await AuthService.login(email, password);
    const normalizedRole = String(user.role || "").trim().toUpperCase();
    const isAdmin = ADMIN_ROLES.has(normalizedRole);

    persistUserSession(user, isAdmin);

    if (isAdmin) {
      let welcomeTitle = "Admin Disahkan";
      let welcomeMsg = "Selamat kembali, Admin PPD.";

      if (normalizedRole === "PPD_UNIT") {
        welcomeTitle = "Akses Unit PPD";
        welcomeMsg = "Log masuk sebagai Unit PPD.";
      } else if (normalizedRole === "SUPER_ADMIN") {
        welcomeTitle = "Akses Super Admin";
        welcomeMsg = "Log masuk dengan kuasa penuh.";
      } else if (normalizedRole === "JPNMEL") {
        welcomeTitle = "Akses JPN Melaka";
        welcomeMsg = "Log masuk pentadbir peringkat negeri.";
      }

      await showAlert({
        icon: "success",
        title: welcomeTitle,
        text: welcomeMsg,
        timer: 800,
        showConfirmButton: false
      });
      window.location.replace("admin.html");
    } else {
      await showAlert({
        icon: "success",
        title: "Log Masuk Berjaya",
        text: `Kod Sekolah: ${user.kod_sekolah}`,
        timer: 800,
        showConfirmButton: false
      });
      window.location.replace("user.html");
    }
  } catch (err) {
    const errMsg = err && err.message ? err.message : "Ralat sistem.";
    if (isDatabaseDisconnectError(err)) {
      applyDatabaseLockState(false, errMsg);
    }
    await showAlert({
      icon: "error",
      title: "Gagal",
      text: errMsg
    });
  } finally {
    toggleLoading(false);
    loginBusy = false;
    applyDatabaseLockState(isDatabaseConnected, lastDisconnectReason);
  }
}

function bindConnectionLifecycleListeners() {
  if (lifecycleListenersBound || typeof window === "undefined") {
    return;
  }
  lifecycleListenersBound = true;

  window.addEventListener("offline", () => {
    applyDatabaseLockState(false, "Tiada sambungan internet dikesan pada peranti anda.");
  });

  window.addEventListener("online", () => {
    verifyDatabaseAvailability(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      verifyDatabaseAvailability(false);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  resetClientSession();
  window.history.replaceState(null, "", window.location.href);
  renderLoginHeader();
  ensureConnectionBanner();
  bindConnectionLifecycleListeners();

  const params = new URLSearchParams(window.location.search);
  if (params.get("db") === "offline") {
    applyDatabaseLockState(false, DEFAULT_OFFLINE_MSG);
  }

  verifyDatabaseAvailability(false);
});

if (typeof window !== "undefined") {
  window.togglePass = togglePass;
  window.prosesLogin = prosesLogin;
  window.verifyDatabaseAvailability = verifyDatabaseAvailability;
}