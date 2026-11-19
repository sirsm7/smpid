const CONFIG_ENDPOINT = "/api/config";
const REQUEST_TIMEOUT_MS = 10000;
const DEFAULT_SUPABASE_SCHEMA = "nadim_data";

let inFlightRequest = null;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSchema(value) {
  const cleaned = normalizeString(value);
  if (!cleaned || cleaned.toLowerCase() === "public") {
    return DEFAULT_SUPABASE_SCHEMA;
  }
  return cleaned;
}

function validateAndFreezeEnv(rawPayload) {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
  const supabaseUrl = normalizeString(payload.SUPABASE_URL);
  const supabaseAnonKey = normalizeString(payload.SUPABASE_ANON_KEY);
  const supabaseSchema = normalizeSchema(payload.SUPABASE_SCHEMA);
  const gasEndpointUrl = normalizeString(payload.GAS_ENDPOINT_URL || payload.GAS_URL);
  const gasUploadUrl = normalizeString(payload.GAS_UPLOAD_URL);
  const gasEmailUrl = normalizeString(payload.GAS_EMAIL_URL);
  const gasLibatUrusUrl = normalizeString(payload.GAS_LIBAT_URUS_URL);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Konfigurasi pelayan tidak lengkap: SUPABASE_URL atau SUPABASE_ANON_KEY tiada.");
  }

  const normalizedEnv = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SCHEMA: supabaseSchema
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
  window.__ENV = frozenEnv;
  window.SUPABASE_URL = frozenEnv.SUPABASE_URL;
  window.SUPABASE_ANON_KEY = frozenEnv.SUPABASE_ANON_KEY;
  window.SUPABASE_SCHEMA = frozenEnv.SUPABASE_SCHEMA;

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

  return frozenEnv;
}

async function fetchRuntimeConfig() {
  if (window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY) {
    return window.__ENV;
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

if (!window.ENV_READY) {
  window.ENV_READY = fetchRuntimeConfig();
}

export let envReady = window.ENV_READY;

export function getEnv() {
  return window.__ENV || null;
}

export function reloadEnv() {
  if (window.__ENV && window.__ENV.SUPABASE_URL && window.__ENV.SUPABASE_ANON_KEY) {
    window.ENV_READY = Promise.resolve(window.__ENV);
    envReady = window.ENV_READY;
    return window.ENV_READY;
  }
  window.ENV_READY = fetchRuntimeConfig();
  envReady = window.ENV_READY;
  return window.ENV_READY;
}

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

export default {
  envReady,
  getEnv,
  reloadEnv
};