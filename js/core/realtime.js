import { envReady, getEnv } from "../config/config.js";
import { initDatabaseClient, getDatabaseClient, getDatabaseSchema } from "./db.js";
import { IDBCache } from "./idb.js";

const DEFAULT_CACHE_STORE = "query_cache";
const DEFAULT_SUPABASE_SCHEMA = "nadim_data";
const FOREGROUND_SYNC_COOLDOWN_MS = 3000;
const EVENT_DEBOUNCE_MS = 250;
const INITIAL_CONNECT_DELAY_MS = 300;

const subscriptions = new Map();
const syncHandlers = new Map();
const changeDebounceTimers = new Map();
let lifecycleInitialized = false;
let lastForegroundSyncAt = 0;

function resolveTargetSchema(explicitSchema) {
  if (
    typeof explicitSchema === "string" &&
    explicitSchema.trim() &&
    explicitSchema.trim().toLowerCase() !== "public"
  ) {
    return explicitSchema.trim();
  }

  const runtimeEnv =
    getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  if (
    runtimeEnv &&
    typeof runtimeEnv.SUPABASE_SCHEMA === "string" &&
    runtimeEnv.SUPABASE_SCHEMA.trim() &&
    runtimeEnv.SUPABASE_SCHEMA.trim().toLowerCase() !== "public"
  ) {
    return runtimeEnv.SUPABASE_SCHEMA.trim();
  }

  if (typeof getDatabaseSchema === "function") {
    const dbSchema = getDatabaseSchema();
    if (dbSchema && dbSchema.toLowerCase() !== "public") {
      return dbSchema;
    }
  }

  return DEFAULT_SUPABASE_SCHEMA;
}

function extractRecordKey(record, primaryKey) {
  if (!record || typeof record !== "object") {
    return null;
  }
  if (primaryKey && record[primaryKey] !== undefined && record[primaryKey] !== null) {
    return String(record[primaryKey]);
  }
  if (record.id !== undefined && record.id !== null) {
    return String(record.id);
  }
  if (record.kod_sekolah !== undefined && record.kod_sekolah !== null) {
    return String(record.kod_sekolah);
  }
  return null;
}

function findCachedRecordInMemory(table, primaryKey, targetRecord) {
  if (typeof window === "undefined" || !window.__memoryCache || !targetRecord) {
    return null;
  }
  const targetId = extractRecordKey(targetRecord, primaryKey);
  if (!targetId) {
    return null;
  }

  const entries = Object.entries(window.__memoryCache);
  for (let i = 0; i < entries.length; i += 1) {
    const [cacheKey, entry] = entries[i];
    if (!cacheKey.includes(table) || !entry || !entry.data) {
      continue;
    }
    const payload = entry.data;
    if (Array.isArray(payload)) {
      const found = payload.find((row) => extractRecordKey(row, primaryKey) === targetId);
      if (found) {
        return found;
      }
    } else if (typeof payload === "object" && extractRecordKey(payload, primaryKey) === targetId) {
      return payload;
    }
  }
  return null;
}

function hasValidTimestamp(record) {
  if (!record || typeof record !== "object") {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(record, "updated_at")) {
    return false;
  }
  const val = record.updated_at;
  return val !== null && val !== undefined && String(val).trim() !== "";
}

export function shouldApplyRealtimeUpdate(newRecord, cachedRecord) {
  if (!newRecord || typeof newRecord !== "object") {
    return true;
  }
  if (!cachedRecord || typeof cachedRecord !== "object") {
    return true;
  }
  if (!hasValidTimestamp(newRecord) || !hasValidTimestamp(cachedRecord)) {
    return true;
  }

  const incomingParsed = Date.parse(String(newRecord.updated_at));
  const cachedParsed = Date.parse(String(cachedRecord.updated_at));

  if (!Number.isNaN(incomingParsed) && !Number.isNaN(cachedParsed)) {
    return incomingParsed >= cachedParsed;
  }

  return String(newRecord.updated_at) >= String(cachedRecord.updated_at);
}

async function detachChannel(client, channel) {
  if (!channel) {
    return;
  }
  const activeClient = client || getDatabaseClient();
  try {
    if (activeClient && typeof activeClient.removeChannel === "function") {
      await activeClient.removeChannel(channel);
    } else if (typeof channel.unsubscribe === "function") {
      await channel.unsubscribe();
    }
  } catch {}
}

function scheduleDebouncedChange(config, eventPayload) {
  const debounceKey = config.key;
  const existingTimer = changeDebounceTimers.get(debounceKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timerId = setTimeout(async () => {
    changeDebounceTimers.delete(debounceKey);
    const targetStore = config.cacheStore || DEFAULT_CACHE_STORE;
    const prefix = config.cachePrefix || config.table;
    if (prefix && IDBCache && typeof IDBCache.invalidateByPrefix === "function") {
      await IDBCache.invalidateByPrefix(prefix, targetStore);
    }

    if (typeof config.onChange === "function") {
      try {
        await config.onChange(eventPayload);
      } catch {}
    }
  }, EVENT_DEBOUNCE_MS);

  changeDebounceTimers.set(debounceKey, timerId);
}

async function createChannelSubscription(config) {
  if (config.deferInitialConnect) {
    await new Promise((resolve) => setTimeout(resolve, INITIAL_CONNECT_DELAY_MS));
  }

  const activeEnvPromise =
    typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
  await activeEnvPromise;

  const client = await initDatabaseClient();
  if (!client || typeof client.channel !== "function") {
    return null;
  }

  const schema = resolveTargetSchema(config.schema);
  const event = config.event || "*";
  const channelName = `nadim_rt_${schema}_${config.key}_${Date.now()}`;

  const pgConfig = {
    event,
    schema,
    table: config.table
  };

  if (config.filter) {
    pgConfig.filter = config.filter;
  }

  const channel = client
    .channel(channelName)
    .on("postgres_changes", pgConfig, async (payload) => {
      const eventType = payload && payload.eventType ? payload.eventType : event;
      const newRecord = payload && payload.new ? payload.new : null;
      const oldRecord = payload && payload.old ? payload.old : null;
      const referenceRecord = newRecord || oldRecord;

      if (eventType === "INSERT" || eventType === "UPDATE") {
        let cachedRecord = null;
        if (typeof config.getCachedRecord === "function") {
          try {
            cachedRecord = await config.getCachedRecord(referenceRecord, payload);
          } catch {
            cachedRecord = null;
          }
        }
        if (!cachedRecord) {
          cachedRecord = findCachedRecordInMemory(
            config.table,
            config.primaryKey,
            referenceRecord
          );
        }

        if (!shouldApplyRealtimeUpdate(newRecord, cachedRecord)) {
          return;
        }
      }

      scheduleDebouncedChange(config, {
        eventType,
        table: config.table,
        schema,
        newRecord,
        oldRecord,
        raw: payload
      });
    })
    .subscribe((status) => {
      if (typeof config.onStatusChange === "function") {
        try {
          config.onStatusChange(status, config.key);
        } catch {}
      }
    });

  return channel;
}

async function runForegroundRevalidation(force = false) {
  const now = Date.now();
  if (!force && now - lastForegroundSyncAt < FOREGROUND_SYNC_COOLDOWN_MS) {
    return;
  }
  lastForegroundSyncAt = now;

  const activeEnvPromise =
    typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
  await activeEnvPromise;
  const client = await initDatabaseClient();

  const entries = Array.from(subscriptions.entries());
  for (let i = 0; i < entries.length; i += 1) {
    const [key, entry] = entries[i];
    const currentState = entry.channel && entry.channel.state ? entry.channel.state : "";
    const isHealthy = currentState === "joined" || currentState === "joining";

    if (!isHealthy) {
      await detachChannel(client, entry.channel);
      const nextChannel = await createChannelSubscription(entry.config);
      if (nextChannel) {
        entry.channel = nextChannel;
        subscriptions.set(key, entry);
      }
    }

    if (typeof entry.config.onSync === "function") {
      try {
        await entry.config.onSync(key);
      } catch {}
    }
  }

  const extraSyncs = Array.from(syncHandlers.values());
  for (let i = 0; i < extraSyncs.length; i += 1) {
    const fn = extraSyncs[i];
    if (typeof fn === "function") {
      try {
        await fn();
      } catch {}
    }
  }
}

function bindLifecycleListeners() {
  if (lifecycleInitialized || typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  lifecycleInitialized = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      runForegroundRevalidation(false).catch(() => {});
    }
  });

  window.addEventListener("online", () => {
    runForegroundRevalidation(true).catch(() => {});
  });

  window.addEventListener("pagehide", () => {
    RealtimeManager.unsubscribeAll().catch(() => {});
  });
}

export const RealtimeManager = {
  async subscribeTable(options) {
    if (!options || !options.table) {
      throw new Error("Nama jadual (table) diperlukan untuk langganan Realtime.");
    }

    bindLifecycleListeners();

    const activeSchema = resolveTargetSchema(options.schema);
    const key = options.key || `${activeSchema}:${options.table}:${options.filter || "all"}`;
    if (subscriptions.has(key)) {
      await this.unsubscribe(key);
    }

    const normalizedConfig = {
      key,
      table: options.table,
      schema: activeSchema,
      event: options.event || "*",
      filter: options.filter || null,
      primaryKey: options.primaryKey || "id",
      cachePrefix: options.cachePrefix || options.table,
      cacheStore: options.cacheStore || DEFAULT_CACHE_STORE,
      deferInitialConnect: options.deferInitialConnect !== false,
      getCachedRecord: options.getCachedRecord || null,
      onChange: options.onChange || null,
      onSync: options.onSync || null,
      onStatusChange: options.onStatusChange || null
    };

    const channel = await createChannelSubscription(normalizedConfig);
    if (channel) {
      subscriptions.set(key, {
        config: normalizedConfig,
        channel
      });
    }

    return key;
  },

  async unsubscribe(key) {
    const entry = subscriptions.get(key);
    if (!entry) {
      return false;
    }
    const pendingTimer = changeDebounceTimers.get(key);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      changeDebounceTimers.delete(key);
    }
    subscriptions.delete(key);
    const client = getDatabaseClient();
    await detachChannel(client, entry.channel);
    return true;
  },

  async unsubscribeAll() {
    const client = getDatabaseClient();
    changeDebounceTimers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    changeDebounceTimers.clear();
    const entries = Array.from(subscriptions.values());
    subscriptions.clear();

    for (let i = 0; i < entries.length; i += 1) {
      await detachChannel(client, entries[i].channel);
    }
  },

  registerSyncHandler(key, callback) {
    if (!key || typeof callback !== "function") {
      return;
    }
    bindLifecycleListeners();
    syncHandlers.set(key, callback);
  },

  unregisterSyncHandler(key) {
    syncHandlers.delete(key);
  },

  async syncNow() {
    await runForegroundRevalidation(true);
  },

  getActiveCount() {
    return subscriptions.size;
  }
};

if (typeof window !== "undefined") {
  window.RealtimeManager = RealtimeManager;
}

export default RealtimeManager;