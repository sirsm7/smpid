import { envReady, getEnv } from "../config/config.js";
import { IDBCache } from "./idb.js";

const DEFAULT_SUPABASE_SCHEMA = "nadim_data";
const DEFAULT_DELIMA_SCHEMA = "delima_data";

let supabaseInstance =
  typeof window !== "undefined" ? window._supabase || window.supabaseClient || null : null;
let initPromise =
  typeof window !== "undefined" && window.DB_READY ? window.DB_READY : null;
let idbInitialized =
  typeof window !== "undefined" ? Boolean(window.__NADIM_IDB_INITIALIZED) : false;

export let supabase = supabaseInstance;

function syncSharedClient(client) {
  if (!client) {
    return null;
  }
  supabaseInstance = client;
  supabase = client;
  if (typeof window !== "undefined") {
    window._supabase = client;
    window.supabaseClient = client;
  }
  return client;
}

function getExistingSharedClient() {
  if (supabaseInstance) {
    return syncSharedClient(supabaseInstance);
  }
  if (typeof window !== "undefined") {
    const shared = window._supabase || window.supabaseClient || null;
    if (shared) {
      return syncSharedClient(shared);
    }
  }
  return null;
}

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

function resolveDelimaSchema(runtimeEnv) {
  const raw =
    runtimeEnv && typeof runtimeEnv.SUPABASE_DELIMA_SCHEMA === "string"
      ? runtimeEnv.SUPABASE_DELIMA_SCHEMA.trim()
      : typeof window !== "undefined" && typeof window.SUPABASE_DELIMA_SCHEMA === "string"
        ? window.SUPABASE_DELIMA_SCHEMA.trim()
        : "";

  if (!raw || raw.toLowerCase() === "public") {
    return DEFAULT_DELIMA_SCHEMA;
  }
  return raw;
}

function ensureStorageLayer() {
  if (idbInitialized || (typeof window !== "undefined" && window.__NADIM_IDB_INITIALIZED)) {
    idbInitialized = true;
    return;
  }
  idbInitialized = true;
  if (typeof window !== "undefined") {
    window.__NADIM_IDB_INITIALIZED = true;
  }
  try {
    if (IDBCache && typeof IDBCache.initDB === "function") {
      IDBCache.initDB().catch(() => {});
    }
  } catch {
    idbInitialized = false;
    if (typeof window !== "undefined") {
      window.__NADIM_IDB_INITIALIZED = false;
    }
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

  const existing = getExistingSharedClient();
  if (existing) {
    return existing;
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
  const delimaSchema = resolveDelimaSchema(runtimeEnv);

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const createdClient = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: supabaseSchema
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    });

    window.SUPABASE_SCHEMA = supabaseSchema;
    window.SUPABASE_DELIMA_SCHEMA = delimaSchema;
    return syncSharedClient(createdClient);
  } catch {
    supabaseInstance = null;
    supabase = null;
    return null;
  }
}

export async function initDatabaseClient() {
  ensureStorageLayer();

  const existing = getExistingSharedClient();
  if (existing) {
    return existing;
  }

  if (typeof window !== "undefined" && window.DB_READY && !initPromise) {
    initPromise = window.DB_READY;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const activeEnvPromise =
        typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
      await activeEnvPromise;
      await waitForSupabaseSdk();
      return createClientInstance();
    })().finally(() => {
      if (!getExistingSharedClient()) {
        initPromise = null;
        if (typeof window !== "undefined") {
          window.DB_READY = null;
        }
      }
    });

    if (typeof window !== "undefined") {
      window.DB_READY = initPromise;
    }
  }

  const resolvedClient = await initPromise;
  return syncSharedClient(resolvedClient);
}

export async function getDatabaseClientAsync() {
  return initDatabaseClient();
}

export function getDatabaseClient() {
  ensureStorageLayer();

  const existing = getExistingSharedClient();
  if (existing) {
    return existing;
  }

  return createClientInstance();
}

export function getDatabaseSchema() {
  const runtimeEnv =
    getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  return resolveSupabaseSchema(runtimeEnv);
}

export function getDelimaSchema() {
  const runtimeEnv =
    getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  return resolveDelimaSchema(runtimeEnv);
}

export function getDelimaDb() {
  const db = getDatabaseClient();
  if (!db) {
    return null;
  }
  const delimaSchema = getDelimaSchema();
  return typeof db.schema === "function" ? db.schema(delimaSchema) : db;
}

export async function getDelimaDbAsync() {
  const db = await initDatabaseClient();
  if (!db) {
    return null;
  }
  const delimaSchema = getDelimaSchema();
  return typeof db.schema === "function" ? db.schema(delimaSchema) : db;
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

export function requireDelimaDb() {
  const db = requireDb();
  const delimaSchema = getDelimaSchema();
  return typeof db.schema === "function" ? db.schema(delimaSchema) : db;
}

export async function requireDelimaDbAsync() {
  const db = await requireDbAsync();
  const delimaSchema = getDelimaSchema();
  return typeof db.schema === "function" ? db.schema(delimaSchema) : db;
}

if (typeof window !== "undefined") {
  initDatabaseClient().catch(() => {});

  if (!window.__NADIM_DB_LISTENERS_BOUND) {
    window.__NADIM_DB_LISTENERS_BOUND = true;

    window.addEventListener("online", () => {
      if (!getExistingSharedClient()) {
        initDatabaseClient().catch(() => {});
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !getExistingSharedClient()) {
        initDatabaseClient().catch(() => {});
      }
    });
  }
}

export default {
  initDatabaseClient,
  getDatabaseClient,
  getDatabaseClientAsync,
  getDatabaseSchema,
  getDelimaSchema,
  getDelimaDb,
  getDelimaDbAsync,
  requireDb,
  requireDbAsync,
  requireDelimaDb,
  requireDelimaDbAsync,
  get supabase() {
    return getExistingSharedClient();
  }
};