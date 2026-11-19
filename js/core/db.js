import { envReady, getEnv } from "../config/config.js";
import { IDBCache } from "./idb.js";

const DEFAULT_SUPABASE_SCHEMA = "nadim_data";

let supabaseInstance = null;
let initPromise = null;
let idbInitialized = false;

export let supabase = null;

function resolveSupabaseSchema(runtimeEnv) {
  const raw =
    runtimeEnv && typeof runtimeEnv.SUPABASE_SCHEMA === "string"
      ? runtimeEnv.SUPABASE_SCHEMA.trim()
      : typeof window !== "undefined" && typeof window.SUPABASE_SCHEMA === "string"
        ? window.SUPABASE_SCHEMA.trim()
        : "";

  if (!raw || raw.toLowerCase() === "public") {
    return DEFAULT_SUPABASE_SCHEMA;
  }
  return raw;
}

function ensureStorageLayer() {
  if (idbInitialized) {
    return;
  }
  idbInitialized = true;
  try {
    if (IDBCache && typeof IDBCache.initDB === "function") {
      IDBCache.initDB().catch(() => {});
    }
  } catch {
    idbInitialized = false;
  }
}

function waitForSupabaseSdk(timeoutMs = 10000) {
  if (
    typeof window !== "undefined" &&
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {
    return Promise.resolve(window.supabase);
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const intervalId = setInterval(() => {
      if (
        typeof window !== "undefined" &&
        window.supabase &&
        typeof window.supabase.createClient === "function"
      ) {
        clearInterval(intervalId);
        resolve(window.supabase);
      } else if (Date.now() - startTime >= timeoutMs) {
        clearInterval(intervalId);
        resolve(null);
      }
    }, 50);
  });
}

function createClientInstance() {
  ensureStorageLayer();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (
    typeof window === "undefined" ||
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    return null;
  }

  const runtimeEnv = getEnv() || window.__ENV || null;
  const supabaseUrl =
    runtimeEnv && typeof runtimeEnv.SUPABASE_URL === "string"
      ? runtimeEnv.SUPABASE_URL.trim()
      : "";
  const supabaseAnonKey =
    runtimeEnv && typeof runtimeEnv.SUPABASE_ANON_KEY === "string"
      ? runtimeEnv.SUPABASE_ANON_KEY.trim()
      : "";
  const supabaseSchema = resolveSupabaseSchema(runtimeEnv);

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: supabaseSchema
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    supabase = supabaseInstance;
    window._supabase = supabaseInstance;
    window.supabaseClient = supabaseInstance;
    window.SUPABASE_SCHEMA = supabaseSchema;
  } catch {
    supabaseInstance = null;
    supabase = null;
    return null;
  }

  return supabaseInstance;
}

export async function initDatabaseClient() {
  ensureStorageLayer();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const activeEnvPromise =
        typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
      await activeEnvPromise;
      await waitForSupabaseSdk();
      return createClientInstance();
    })().finally(() => {
      if (!supabaseInstance) {
        initPromise = null;
      }
    });

    if (typeof window !== "undefined") {
      window.DB_READY = initPromise;
    }
  }

  return initPromise;
}

export async function getDatabaseClientAsync() {
  return initDatabaseClient();
}

export function getDatabaseClient() {
  ensureStorageLayer();

  if (supabaseInstance) {
    return supabaseInstance;
  }

  return createClientInstance();
}

export function getDatabaseSchema() {
  const runtimeEnv =
    getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  return resolveSupabaseSchema(runtimeEnv);
}

export function requireDb() {
  const db = getDatabaseClient();
  if (!db) {
    throw new Error(
      "Sambungan pangkalan data disekat atau belum sedia. Sila periksa sambungan internet anda."
    );
  }
  return db;
}

export async function requireDbAsync() {
  const db = await initDatabaseClient();
  if (!db) {
    throw new Error(
      "Sambungan pangkalan data disekat atau belum sedia. Sila periksa sambungan internet anda."
    );
  }
  return db;
}

if (typeof window !== "undefined") {
  initDatabaseClient().catch(() => {});

  window.addEventListener("online", () => {
    if (!supabaseInstance) {
      initDatabaseClient().catch(() => {});
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !supabaseInstance) {
      initDatabaseClient().catch(() => {});
    }
  });
}

export default {
  initDatabaseClient,
  getDatabaseClient,
  getDatabaseClientAsync,
  getDatabaseSchema,
  requireDb,
  requireDbAsync,
  get supabase() {
    return supabaseInstance;
  }
};