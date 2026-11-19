let supabaseClient = null;
window.supabaseClient = null;

async function resolveRuntimeEnv() {
  if (window.ENV_READY && typeof window.ENV_READY.then === "function") {
    try {
      await window.ENV_READY;
    } catch {}
  }

  if (window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY) {
    return window.__ENV;
  }

  try {
    const response = await fetch("/api/config", {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (response.ok) {
      const cfg = await response.json();
      if (cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
        const frozen = Object.freeze({
          SUPABASE_URL: String(cfg.SUPABASE_URL).trim(),
          SUPABASE_ANON_KEY: String(cfg.SUPABASE_ANON_KEY).trim(),
          GAS_ENDPOINT_URL: cfg.GAS_ENDPOINT_URL ? String(cfg.GAS_ENDPOINT_URL).trim() : "",
          SUPABASE_SCHEMA: cfg.SUPABASE_SCHEMA ? String(cfg.SUPABASE_SCHEMA).trim() : "public"
        });
        window.__ENV = frozen;
        return frozen;
      }
    }
  } catch {}

  return window.__ENV || null;
}

async function initUtilsSupabase() {
  if (supabaseClient) {
    window.supabaseClient = supabaseClient;
    return supabaseClient;
  }

  if (window._supabase) {
    supabaseClient = window._supabase;
    window.supabaseClient = supabaseClient;
    return supabaseClient;
  }

  const env = await resolveRuntimeEnv();
  if (
    env &&
    env.SUPABASE_URL &&
    env.SUPABASE_ANON_KEY &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    try {
      const schemaOption =
        env.SUPABASE_SCHEMA && env.SUPABASE_SCHEMA !== "public"
          ? { db: { schema: env.SUPABASE_SCHEMA } }
          : undefined;
      supabaseClient = schemaOption
        ? window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, schemaOption)
        : window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
      window._supabase = supabaseClient;
      window.supabaseClient = supabaseClient;
      return supabaseClient;
    } catch {
      return null;
    }
  }

  return null;
}

window.utilsReady = initUtilsSupabase();

window.getSupabaseClient = async function () {
  if (supabaseClient) {
    return supabaseClient;
  }
  return initUtilsSupabase();
};

function toggleLoading(show) {
  const el = document.getElementById("loadingOverlay");
  if (el) {
    if (show) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }
}

function cleanPhone(phone) {
  if (!phone) {
    return "";
  }
  let cleaned = String(phone).replace(/[^0-9]/g, "");
  if (cleaned.length === 0) {
    return "";
  }
  if (cleaned.startsWith("0")) {
    cleaned = `6${cleaned}`;
  }
  return cleaned;
}

function autoFormatPhone(input) {
  if (!input) {
    return;
  }
  const val = String(input.value || "").replace(/[^0-9]/g, "");
  if (val.length < 5) {
    return;
  }

  if (val.startsWith("60")) {
    input.value = `+${val}`;
  } else if (val.startsWith("0")) {
    input.value = `+6${val}`;
  } else {
    input.value = `+6${val}`;
  }
}

function checkEmailDomain(email) {
  return Boolean(email && String(email).toLowerCase().includes("@moe-dl.edu.my"));
}

function formatSentenceCase(str) {
  if (!str) {
    return "";
  }
  return String(str)
    .toLowerCase()
    .replace(/(?:^|[.!?]\s+)([a-z])/g, (match) => match.toUpperCase());
}

function generateWhatsAppLink(nama, noTel, isRaw = false) {
  const cleanNum = cleanPhone(noTel);
  if (!cleanNum) {
    return null;
  }

  if (isRaw) {
    return `https://wa.me/${cleanNum}`;
  }

  const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ""}, ini adalah mesej automatik NADIM.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
  return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
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

function getSessionStorageKeys() {
  if (window.APP_CONFIG && window.APP_CONFIG.SESSION) {
    return {
      authKey: window.APP_CONFIG.SESSION.AUTH_FLAG || "smpid_auth",
      kodKey: window.APP_CONFIG.SESSION.USER_KOD || "smpid_user_kod"
    };
  }
  return {
    authKey: "smpid_auth",
    kodKey: "smpid_user_kod"
  };
}

function runSecurityCheck() {
  const bodyId = document.body ? document.body.id : "";
  const { authKey, kodKey } = getSessionStorageKeys();

  const isAuth = localStorage.getItem(authKey) === "true";
  const userKod = localStorage.getItem(kodKey);
  const protectedPages = ["page-user", "page-admin"];

  if (protectedPages.includes(bodyId)) {
    if (!isAuth && (!userKod || userKod === "null")) {
      window.location.replace("index.html");
    }
  }
}

function performLogoutCleanup() {
  try {
    if (
      window.RealtimeManager &&
      typeof window.RealtimeManager.removeAllChannels === "function"
    ) {
      window.RealtimeManager.removeAllChannels();
    }
  } catch {}
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("index.html");
}

function keluarSistem() {
  if (typeof window.Swal !== "undefined" && typeof window.Swal.fire === "function") {
    window.Swal.fire({
      title: "Log Keluar?",
      text: "Anda perlu log masuk semula untuk mengakses sistem.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Ya, Log Keluar",
      cancelButtonText: "Batal",
      customClass: { popup: "rounded-3xl" }
    }).then((result) => {
      if (result && result.isConfirmed) {
        performLogoutCleanup();
      }
    });
    return;
  }

  if (window.confirm("Log Keluar? Anda perlu log masuk semula untuk mengakses sistem.")) {
    performLogoutCleanup();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  runSecurityCheck();
});

window.addEventListener("pageshow", (event) => {
  const navEntries =
    typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
      ? performance.getEntriesByType("navigation")
      : [];
  const isBackForward =
    navEntries.length > 0 && navEntries[0] && navEntries[0].type === "back_forward";

  if (event.persisted || isBackForward) {
    runSecurityCheck();
  }
});

window.toggleLoading = toggleLoading;
window.cleanPhone = cleanPhone;
window.autoFormatPhone = autoFormatPhone;
window.checkEmailDomain = checkEmailDomain;
window.formatSentenceCase = formatSentenceCase;
window.generateWhatsAppLink = generateWhatsAppLink;
window.sanitizeExternalUrl = sanitizeExternalUrl;
window.keluarSistem = keluarSistem;
window.runSecurityCheck = runSecurityCheck;