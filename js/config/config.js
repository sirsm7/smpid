const CONFIG_ENDPOINT = "/api/config";
const REQUEST_TIMEOUT_MS = 10000;
const ENV_SESSION_CACHE_KEY = "nadim_runtime_env_v1";
const DEFAULT_SUPABASE_SCHEMA = "nadim_data";
const DEFAULT_SUPABASE_DELIMA_SCHEMA = "delima_data";
const DEFAULT_NOTIFY_API_URL = "/api/functions/v1/smpid-notify";

let inFlightRequest = null;
let backgroundRefreshScheduled = false;

function readSessionEnv() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(ENV_SESSION_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.SUPABASE_URL === "string" && typeof parsed.SUPABASE_ANON_KEY === "string") {
      return parsed;
    }
  } catch {}
  return null;
}

function writeSessionEnv(payload) {
  if (typeof window === "undefined" || !window.sessionStorage || !payload) {
    return;
  }
  try {
    window.sessionStorage.setItem(ENV_SESSION_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSchema(value, fallback = DEFAULT_SUPABASE_SCHEMA) {
  const cleaned = normalizeString(value);
  if (!cleaned || cleaned.toLowerCase() === "public") {
    return fallback;
  }
  return cleaned;
}

function normalizeEndpointUrl(value, fallback = "") {
  const cleaned = normalizeString(value) || fallback;
  return cleaned.replace(/\/+$/, "");
}

function validateAndFreezeEnv(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const supabaseUrl = normalizeString(payload.SUPABASE_URL);
  const supabaseAnonKey = normalizeString(payload.SUPABASE_ANON_KEY);
  const supabaseSchema = normalizeSchema(payload.SUPABASE_SCHEMA, DEFAULT_SUPABASE_SCHEMA);
  const supabaseDelimaSchema = normalizeSchema(
    payload.SUPABASE_DELIMA_SCHEMA,
    DEFAULT_SUPABASE_DELIMA_SCHEMA
  );
  const gasEndpointUrl = normalizeString(payload.GAS_ENDPOINT_URL || payload.GAS_URL);
  const gasUploadUrl = normalizeString(payload.GAS_UPLOAD_URL);
  const gasEmailUrl = normalizeString(payload.GAS_EMAIL_URL);
  const gasLibatUrusUrl = normalizeString(payload.GAS_LIBAT_URUS_URL);
  const notifyApiUrl = normalizeEndpointUrl(
    payload.NOTIFY_API_URL || payload.EDGE_NOTIFY_URL || payload.DENO_API_URL,
    DEFAULT_NOTIFY_API_URL
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Konfigurasi pelayan tidak lengkap: SUPABASE_URL atau SUPABASE_ANON_KEY tiada.");
  }

  const normalizedEnv = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SCHEMA: supabaseSchema,
    SUPABASE_DELIMA_SCHEMA: supabaseDelimaSchema,
    NOTIFY_API_URL: notifyApiUrl,
    EDGE_NOTIFY_URL: notifyApiUrl,
    DENO_API_URL: notifyApiUrl
  };

  const primaryGasUrl = gasEndpointUrl || gasUploadUrl || gasEmailUrl || gasLibatUrusUrl;
  if (primaryGasUrl) {
    normalizedEnv.GAS_ENDPOINT_URL = primaryGasUrl;
    normalizedEnv.GAS_URL = primaryGasUrl;
  }

  if (gasUploadUrl) {
    normalizedEnv.GAS_UPLOAD_URL = gasUploadUrl;
  }

  if (gasEmailUrl) {
    normalizedEnv.GAS_EMAIL_URL = gasEmailUrl;
  }

  if (gasLibatUrusUrl) {
    normalizedEnv.GAS_LIBAT_URUS_URL = gasLibatUrusUrl;
  }

  const frozenEnv = Object.freeze(normalizedEnv);
  if (typeof window !== "undefined") {
    window.__ENV = frozenEnv;
    window.SUPABASE_URL = frozenEnv.SUPABASE_URL;
    window.SUPABASE_ANON_KEY = frozenEnv.SUPABASE_ANON_KEY;
    window.SUPABASE_SCHEMA = frozenEnv.SUPABASE_SCHEMA;
    window.SUPABASE_DELIMA_SCHEMA = frozenEnv.SUPABASE_DELIMA_SCHEMA;
    window.NOTIFY_API_URL = frozenEnv.NOTIFY_API_URL;
    window.EDGE_NOTIFY_URL = frozenEnv.EDGE_NOTIFY_URL;
    window.DENO_API_URL = frozenEnv.DENO_API_URL;
    window.DENO_URL = frozenEnv.NOTIFY_API_URL;

    if (frozenEnv.GAS_ENDPOINT_URL) {
      window.GAS_ENDPOINT_URL = frozenEnv.GAS_ENDPOINT_URL;
      window.GAS_URL = frozenEnv.GAS_ENDPOINT_URL;
    }

    if (frozenEnv.GAS_UPLOAD_URL) {
      window.GAS_UPLOAD_URL = frozenEnv.GAS_UPLOAD_URL;
    }

    if (frozenEnv.GAS_EMAIL_URL) {
      window.GAS_EMAIL_URL = frozenEnv.GAS_EMAIL_URL;
    }

    if (frozenEnv.GAS_LIBAT_URUS_URL) {
      window.GAS_LIBAT_URUS_URL = frozenEnv.GAS_LIBAT_URUS_URL;
    }
  }

  return frozenEnv;
}

async function fetchRuntimeConfig(forceNetwork = false) {
  if (
    !forceNetwork &&
    typeof window !== "undefined" &&
    window.__ENV &&
    window.__ENV.SUPABASE_URL &&
    window.__ENV.SUPABASE_ANON_KEY
  ) {
    return window.__ENV;
  }

  if (!forceNetwork) {
    const cachedSessionPayload = readSessionEnv();
    if (cachedSessionPayload) {
      try {
        const hydratedEnv = validateAndFreezeEnv(cachedSessionPayload);
        if (!backgroundRefreshScheduled) {
          backgroundRefreshScheduled = true;
          fetchRuntimeConfig(true).catch(() => {});
        }
        return hydratedEnv;
      } catch {}
    }
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  inFlightRequest = (async () => {
    try {
      const response = await fetch(CONFIG_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      const rawText = await response.text();
      let parsedData = null;

      try {
        parsedData = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error("Tindak balas konfigurasi bukan format JSON yang sah.");
      }

      if (!response.ok) {
        const serverMsg =
          parsedData && typeof parsedData.message === "string"
            ? parsedData.message
            : `Gagal mendapatkan konfigurasi pelayan (HTTP ${response.status}).`;
        throw new Error(serverMsg);
      }

      writeSessionEnv(parsedData);
      return validateAndFreezeEnv(parsedData);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Permintaan konfigurasi /api/config melebihi had masa.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

const initialReadyPromise =
  typeof window !== "undefined" && window.ENV_READY
    ? window.ENV_READY
    : fetchRuntimeConfig();

if (typeof window !== "undefined" && !window.ENV_READY) {
  window.ENV_READY = initialReadyPromise;
}

export let envReady = initialReadyPromise;

export function getEnv() {
  return typeof window !== "undefined" ? window.__ENV || null : null;
}

export function reloadEnv() {
  if (
    typeof window !== "undefined" &&
    window.__ENV &&
    window.__ENV.SUPABASE_URL &&
    window.__ENV.SUPABASE_ANON_KEY
  ) {
    const resolved = Promise.resolve(window.__ENV);
    window.ENV_READY = resolved;
    envReady = resolved;
    return resolved;
  }

  const nextReadyPromise = fetchRuntimeConfig();
  if (typeof window !== "undefined") {
    window.ENV_READY = nextReadyPromise;
  }
  envReady = nextReadyPromise;
  return nextReadyPromise;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (!window.__ENV) {
      reloadEnv().catch(() => {});
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !window.__ENV) {
      reloadEnv().catch(() => {});
    }
  });
}

export default {
  envReady,
  getEnv,
  reloadEnv
};