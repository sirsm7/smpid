import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient } from "./core/db.js";
import { clearSessionState } from "./core/auth.guard.js";
import { AuthService } from "./services/auth.service.js";
import { toggleLoading } from "./core/helpers.js";

const ADMIN_ROLES = new Set(["ADMIN", "PPD_UNIT", "SUPER_ADMIN", "JPNMEL"]);

let loginBusy = false;

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

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message =
    options && (options.text || options.title)
      ? `${options.title || ""}\n${options.text || ""}`.trim()
      : "";
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
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

  const inputEmail = document.getElementById("inputEmail");
  const inputPass = document.getElementById("inputPassword");
  const btnLogin =
    document.getElementById("btnLogin") ||
    document.querySelector('button[onclick*="prosesLogin"]');

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
    await showAlert({
      icon: "error",
      title: "Gagal",
      text: err && err.message ? err.message : "Ralat sistem."
    });
  } finally {
    toggleLoading(false);
    if (btnLogin) {
      btnLogin.disabled = false;
    }
    loginBusy = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  clearSessionState();
  window.history.replaceState(null, "", window.location.href);
  renderLoginHeader();
});

if (typeof window !== "undefined") {
  window.togglePass = togglePass;
  window.prosesLogin = prosesLogin;
}