(function () {
  const ADMIN_ROLES = ["ADMIN", "PPD_UNIT", "SUPER_ADMIN", "JPNMEL"];
  let redirectInProgress = false;

  function getSessionKeys() {
    const cfg =
      typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG.SESSION
        ? window.APP_CONFIG.SESSION
        : null;
    return {
      authFlag: (cfg && cfg.AUTH_FLAG) || "smpid_auth",
      userKod: (cfg && cfg.USER_KOD) || "smpid_user_kod",
      userRole: (cfg && cfg.USER_ROLE) || "smpid_user_role",
      userId: (cfg && cfg.USER_ID) || "smpid_user_id"
    };
  }

  function isValidValue(val) {
    if (val === null || val === undefined) {
      return false;
    }
    const normalized = String(val).trim();
    return normalized !== "" && normalized !== "null" && normalized !== "undefined";
  }

  function readStoragePair(primaryKey, legacyKey) {
    let val = null;
    try {
      val = localStorage.getItem(primaryKey);
      if (!isValidValue(val) && legacyKey && legacyKey !== primaryKey) {
        val = localStorage.getItem(legacyKey);
      }
      if (!isValidValue(val)) {
        val = sessionStorage.getItem(primaryKey);
      }
      if (!isValidValue(val) && legacyKey && legacyKey !== primaryKey) {
        val = sessionStorage.getItem(legacyKey);
      }
    } catch {}
    return isValidValue(val) ? String(val).trim() : "";
  }

  function syncStoragePair(primaryKey, legacyKey, value) {
    if (!isValidValue(value)) {
      return;
    }
    const cleanVal = String(value).trim();
    try {
      localStorage.setItem(primaryKey, cleanVal);
      sessionStorage.setItem(primaryKey, cleanVal);
      if (legacyKey && legacyKey !== primaryKey) {
        localStorage.setItem(legacyKey, cleanVal);
        sessionStorage.setItem(legacyKey, cleanVal);
      }
    } catch {}
  }

  function resolveModuleLoginUrl() {
    const path = (typeof window !== "undefined" && window.location && window.location.pathname) || "";
    if (path.indexOf("/modules/") !== -1) {
      return "../../index.html";
    }
    return "index.html";
  }

  function verifyModuleBridgeSession() {
    if (redirectInProgress) {
      return false;
    }

    const keys = getSessionKeys();
    const resolvedKod = readStoragePair(keys.userKod, "smpid_user_kod");
    const resolvedAuth = readStoragePair(keys.authFlag, "smpid_auth").toLowerCase();
    const resolvedRole = readStoragePair(keys.userRole, "smpid_user_role").toUpperCase();
    const resolvedId = readStoragePair(keys.userId, "smpid_user_id");

    const isAdminFlag = resolvedAuth === "true";
    const hasValidAdminSession = isAdminFlag && ADMIN_ROLES.indexOf(resolvedRole) !== -1;

    if (!resolvedKod && !hasValidAdminSession) {
      redirectInProgress = true;
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Sila log masuk melalui Portal NaDIM dahulu.");
      }
      window.location.replace(resolveModuleLoginUrl());
      return false;
    }

    if (resolvedKod) {
      syncStoragePair(keys.userKod, "smpid_user_kod", resolvedKod);
    }
    if (resolvedRole) {
      syncStoragePair(keys.userRole, "smpid_user_role", resolvedRole);
    }
    if (resolvedId) {
      syncStoragePair(keys.userId, "smpid_user_id", resolvedId);
    }
    if (resolvedAuth === "true" || resolvedAuth === "false") {
      syncStoragePair(keys.authFlag, "smpid_auth", resolvedAuth);
    }

    return true;
  }

  verifyModuleBridgeSession();

  window.addEventListener("pageshow", function (event) {
    const navEntries =
      typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
        ? performance.getEntriesByType("navigation")
        : [];
    const isBackForward =
      navEntries.length > 0 && navEntries[0] && navEntries[0].type === "back_forward";

    if (event.persisted || isBackForward) {
      verifyModuleBridgeSession();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      verifyModuleBridgeSession();
    }
  });

  window.addEventListener("storage", function (event) {
    if (!event.key || event.key.indexOf("auth") !== -1 || event.key.indexOf("user_") !== -1) {
      verifyModuleBridgeSession();
    }
  });

  window.verifyModuleBridgeSession = verifyModuleBridgeSession;
})();