import { APP_CONFIG } from "../config/app.config.js";

const FREE_PAGE_IDS = new Set(["page-login", "page-public", "page-landing"]);
const ADMIN_ROLES = new Set(["ADMIN", "PPD_UNIT", "SUPER_ADMIN", "JPNMEL"]);

function isNonEmptyValue(value) {
  return typeof value === "string" && value.trim() !== "" && value !== "null" && value !== "undefined";
}

function getSessionState() {
  const sessionCfg = (APP_CONFIG && APP_CONFIG.SESSION) || {};
  const authKey = sessionCfg.AUTH_FLAG || "smpid_auth";
  const kodKey = sessionCfg.USER_KOD || "smpid_user_kod";
  const roleKey = sessionCfg.USER_ROLE || "smpid_user_role";
  const idKey = sessionCfg.USER_ID || "smpid_user_id";

  const rawAuth = localStorage.getItem(authKey) ?? localStorage.getItem("smpid_auth");
  const rawKod = localStorage.getItem(kodKey) ?? localStorage.getItem("smpid_user_kod");
  const rawRole = localStorage.getItem(roleKey) ?? localStorage.getItem("smpid_user_role");
  const rawId = localStorage.getItem(idKey) ?? localStorage.getItem("smpid_user_id");

  return {
    isAuth: rawAuth === "true",
    userKod: isNonEmptyValue(rawKod) ? rawKod.trim() : "",
    userRole: isNonEmptyValue(rawRole) ? rawRole.trim().toUpperCase() : "",
    userId: isNonEmptyValue(rawId) ? rawId.trim() : ""
  };
}

export function clearSessionState() {
  const sessionCfg = (APP_CONFIG && APP_CONFIG.SESSION) || {};
  const keysToRemove = new Set([
    sessionCfg.AUTH_FLAG || "smpid_auth",
    sessionCfg.USER_KOD || "smpid_user_kod",
    sessionCfg.USER_ROLE || "smpid_user_role",
    sessionCfg.USER_ID || "smpid_user_id",
    "smpid_auth",
    "smpid_user_kod",
    "smpid_user_role",
    "smpid_user_id"
  ]);

  keysToRemove.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  });
}

export function runSecurityCheck() {
  if (typeof document === "undefined" || !document.body) {
    return true;
  }

  const bodyId = document.body.id || "";
  if (FREE_PAGE_IDS.has(bodyId)) {
    return true;
  }

  const { isAuth, userKod, userRole } = getSessionState();

  if (bodyId === "page-admin") {
    const hasAdminAccess = isAuth && (!userRole || ADMIN_ROLES.has(userRole));
    if (!hasAdminAccess) {
      window.location.replace("index.html");
      return false;
    }
    return true;
  }

  const hasValidSession = isAuth || Boolean(userKod);
  if (!hasValidSession) {
    window.location.replace("index.html");
    return false;
  }

  return true;
}

if (typeof window !== "undefined") {
  window.runSecurityCheck = runSecurityCheck;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runSecurityCheck, { once: true });
  } else {
    runSecurityCheck();
  }

  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.includes("auth") || event.key.includes("user_")) {
      runSecurityCheck();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      runSecurityCheck();
    }
  });
}

export default {
  runSecurityCheck,
  clearSessionState
};