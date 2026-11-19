import { APP_CONFIG } from "../config/app.config.js";

const DB_NAME =
  APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.DB_NAME
    ? APP_CONFIG.IDB.DB_NAME
    : "nadim_storage_v2";
const DB_VERSION =
  APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.DB_VERSION
    ? APP_CONFIG.IDB.DB_VERSION
    : 3;
const DEFAULT_STORE_NAME = "query_cache";
const DEFAULT_TTL_MS =
  APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.CACHE_TTL_MS
    ? APP_CONFIG.IDB.CACHE_TTL_MS
    : 86400000;

let dbPromise = null;
let useMemoryFallback = false;
let versionCheckCompleted = false;
const inflightRevalidations = new Map();

function getMemoryStore() {
  if (typeof window === "undefined") {
    return null;
  }
  if (!window.__memoryCache || typeof window.__memoryCache !== "object") {
    window.__memoryCache = {};
  }
  return window.__memoryCache;
}

getMemoryStore();

function checkIndexedDBSupport() {
  try {
    return (
      typeof window !== "undefined" &&
      "indexedDB" in window &&
      window.indexedDB !== null
    );
  } catch {
    return false;
  }
}

function getAllStoreNames(db = null) {
  const names = new Set([DEFAULT_STORE_NAME]);
  if (APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.STORES) {
    Object.values(APP_CONFIG.IDB.STORES).forEach((storeName) => {
      if (typeof storeName === "string" && storeName.trim()) {
        names.add(storeName.trim());
      }
    });
  }
  if (db && db.objectStoreNames) {
    Array.from(db.objectStoreNames).forEach((storeName) => {
      names.add(storeName);
    });
  }
  return Array.from(names);
}

function checkAndMigrateAppVersion() {
  if (versionCheckCompleted) {
    return;
  }
  versionCheckCompleted = true;

  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    const currentVersion = APP_CONFIG.APP_VERSION;
    const versionKey =
      APP_CONFIG.SESSION && APP_CONFIG.SESSION.APP_VERSION_KEY
        ? APP_CONFIG.SESSION.APP_VERSION_KEY
        : "smpid_app_version";
    const storedVersion = localStorage.getItem(versionKey);

    if (storedVersion && storedVersion !== currentVersion) {
      if (checkIndexedDBSupport() && typeof window.indexedDB.deleteDatabase === "function") {
        try {
          window.indexedDB.deleteDatabase("nadim_cache_db");
          window.indexedDB.deleteDatabase("smpid_db");
        } catch {}
      }
      window.__memoryCache = {};
    }
    localStorage.setItem(versionKey, currentVersion);
  } catch {}
}

function readFromMemory(storeName, key, now) {
  const mem = getMemoryStore();
  if (!mem) {
    return null;
  }
  const compositeKey = `${storeName}_${key}`;
  const entry = mem[compositeKey];
  if (!entry) {
    return null;
  }
  if (typeof entry.expiry === "number" && now > entry.expiry) {
    delete mem[compositeKey];
    return null;
  }
  return entry.data;
}

function writeToMemory(storeName, key, payload) {
  const mem = getMemoryStore();
  if (!mem) {
    return;
  }
  mem[`${storeName}_${key}`] = payload;
}

function deleteFromMemory(storeName, key) {
  const mem = getMemoryStore();
  if (!mem) {
    return;
  }
  delete mem[`${storeName}_${key}`];
}

export const IDBCache = {
  generateSecureKey(baseKey, isGlobal = false) {
    if (isGlobal) {
      return `GLOBAL_${baseKey}`;
    }

    try {
      const roleKey =
        APP_CONFIG.SESSION && APP_CONFIG.SESSION.USER_ROLE
          ? APP_CONFIG.SESSION.USER_ROLE
          : "smpid_user_role";
      const kodKey =
        APP_CONFIG.SESSION && APP_CONFIG.SESSION.USER_KOD
          ? APP_CONFIG.SESSION.USER_KOD
          : "smpid_user_kod";
      const role = localStorage.getItem(roleKey) || "ANON";
      const kod = localStorage.getItem(kodKey) || "NOKOD";
      return `${baseKey}_${role}_${kod}`;
    } catch {
      return `FALLBACK_${baseKey}`;
    }
  },

  async initDB() {
    checkAndMigrateAppVersion();

    if (useMemoryFallback || !checkIndexedDBSupport()) {
      useMemoryFallback = true;
      return null;
    }

    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onblocked = () => {
          dbPromise = null;
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          const tx = event.target.transaction;
          const targetStores = getAllStoreNames();
          targetStores.forEach((storeName) => {
            if (!db.objectStoreNames.contains(storeName)) {
              db.createObjectStore(storeName, { keyPath: "key" });
            } else if (tx) {
              try {
                tx.objectStore(storeName).clear();
              } catch {}
            }
          });
        };

        request.onsuccess = () => {
          const db = request.result;

          db.onversionchange = () => {
            try {
              db.close();
            } catch {}
            dbPromise = null;
          };

          setTimeout(() => {
            this._sweepStaleCache(db);
          }, 1500);
          resolve(db);
        };

        request.onerror = () => {
          useMemoryFallback = true;
          dbPromise = null;
          resolve(null);
        };
      } catch {
        useMemoryFallback = true;
        dbPromise = null;
        resolve(null);
      }
    });

    return dbPromise;
  },

  async _sweepStaleCache(db) {
    if (!db || useMemoryFallback) {
      return;
    }
    try {
      const storesToCheck = getAllStoreNames(db);
      const now = Date.now();

      storesToCheck.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          return;
        }
        try {
          const transaction = db.transaction(storeName, "readwrite");
          const store = transaction.objectStore(storeName);
          const request = store.openCursor();

          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              if (cursor.value && cursor.value.expiry && now > cursor.value.expiry) {
                cursor.delete();
              }
              cursor.continue();
            }
          };
        } catch {}
      });
    } catch {}
  },

  async getCache(key, storeName = DEFAULT_STORE_NAME) {
    const now = Date.now();

    if (useMemoryFallback || !checkIndexedDBSupport()) {
      return readFromMemory(storeName, key, now);
    }

    try {
      const db = await this.initDB();
      if (!db || !db.objectStoreNames.contains(storeName)) {
        return readFromMemory(storeName, key, now);
      }

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(storeName, "readonly");
          const store = transaction.objectStore(storeName);
          const request = store.get(key);

          request.onsuccess = () => {
            const result = request.result;
            if (!result) {
              resolve(null);
              return;
            }

            if (typeof result.expiry === "number" && now > result.expiry) {
              this.removeCache(key, storeName);
              resolve(null);
              return;
            }
            resolve(result.data);
          };

          request.onerror = () => {
            resolve(readFromMemory(storeName, key, now));
          };
        } catch {
          dbPromise = null;
          resolve(readFromMemory(storeName, key, now));
        }
      });
    } catch {
      return readFromMemory(storeName, key, now);
    }
  },

  async setCache(key, data, ttlMinutes = 60, storeName = DEFAULT_STORE_NAME) {
    const now = Date.now();
    const ttlMs =
      typeof ttlMinutes === "number" && ttlMinutes > 0
        ? ttlMinutes * 60 * 1000
        : DEFAULT_TTL_MS;
    const expiry = now + ttlMs;

    const payload = {
      key,
      data,
      expiry,
      timestamp: now
    };

    writeToMemory(storeName, key, payload);

    if (useMemoryFallback || !checkIndexedDBSupport()) {
      return true;
    }

    try {
      const db = await this.initDB();
      if (!db || !db.objectStoreNames.contains(storeName)) {
        return true;
      }

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(storeName, "readwrite");
          const store = transaction.objectStore(storeName);
          store.put(payload);
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          dbPromise = null;
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  },

  async removeCache(key, storeName = DEFAULT_STORE_NAME) {
    deleteFromMemory(storeName, key);

    if (useMemoryFallback || !checkIndexedDBSupport()) {
      return true;
    }

    try {
      const db = await this.initDB();
      if (!db || !db.objectStoreNames.contains(storeName)) {
        return true;
      }

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(storeName, "readwrite");
          const store = transaction.objectStore(storeName);
          store.delete(key);
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  },

  async invalidateByPrefix(prefix, storeName = DEFAULT_STORE_NAME) {
    const mem = getMemoryStore();
    if (mem) {
      const fullPrefix = `${storeName}_${prefix}`;
      Object.keys(mem).forEach((k) => {
        if (k.startsWith(fullPrefix) || k.startsWith(prefix)) {
          delete mem[k];
        }
      });
    }

    if (useMemoryFallback || !checkIndexedDBSupport()) {
      return true;
    }

    try {
      const db = await this.initDB();
      if (!db || !db.objectStoreNames.contains(storeName)) {
        return true;
      }

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(storeName, "readwrite");
          const store = transaction.objectStore(storeName);
          const request = store.getAllKeys();

          request.onsuccess = (event) => {
            const keys = event.target.result;
            if (keys && keys.length > 0) {
              keys.forEach((key) => {
                if (typeof key === "string" && key.startsWith(prefix)) {
                  store.delete(key);
                }
              });
            }
          };

          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  },

  async staleWhileRevalidate(
    key,
    fetchPromiseFactory,
    onRevalidated = null,
    ttlMinutes = 60,
    storeName = DEFAULT_STORE_NAME
  ) {
    const cachedData = await this.getCache(key, storeName);
    const inflightKey = `${storeName}::${key}`;

    const backgroundFetch = () => {
      if (inflightRevalidations.has(inflightKey)) {
        return inflightRevalidations.get(inflightKey);
      }

      const task = (async () => {
        try {
          const freshData = await fetchPromiseFactory();
          if (freshData === null || freshData === undefined) {
            return cachedData;
          }

          const isChanged =
            cachedData === null ||
            cachedData === undefined ||
            JSON.stringify(cachedData) !== JSON.stringify(freshData);

          if (isChanged) {
            await this.setCache(key, freshData, ttlMinutes, storeName);
            if (typeof onRevalidated === "function") {
              onRevalidated(freshData);
            }
          }
          return freshData;
        } catch {
          return cachedData;
        } finally {
          inflightRevalidations.delete(inflightKey);
        }
      })();

      inflightRevalidations.set(inflightKey, task);
      return task;
    };

    if (cachedData !== null && cachedData !== undefined) {
      backgroundFetch();
      return cachedData;
    }

    return backgroundFetch();
  },

  async clearAll(storeName = null) {
    const mem = getMemoryStore();
    if (mem) {
      if (storeName) {
        const prefix = `${storeName}_`;
        Object.keys(mem).forEach((k) => {
          if (k.startsWith(prefix)) {
            delete mem[k];
          }
        });
      } else {
        window.__memoryCache = {};
      }
    }

    if (useMemoryFallback || !checkIndexedDBSupport()) {
      return true;
    }

    try {
      const db = await this.initDB();
      if (!db) {
        return true;
      }

      const targetStores = storeName
        ? [storeName]
        : Array.from(db.objectStoreNames);

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(targetStores, "readwrite");
          targetStores.forEach((s) => {
            if (db.objectStoreNames.contains(s)) {
              transaction.objectStore(s).clear();
            }
          });
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
          transaction.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      });
    } catch {
      return false;
    }
  },

  async purgeDatabase() {
    window.__memoryCache = {};
    inflightRevalidations.clear();

    if (dbPromise) {
      try {
        const db = await dbPromise;
        if (db) {
          db.close();
        }
      } catch {}
      dbPromise = null;
    }

    if (checkIndexedDBSupport() && typeof window.indexedDB.deleteDatabase === "function") {
      return new Promise((resolve) => {
        const request = window.indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
        request.onblocked = () => resolve(false);
      });
    }
    return true;
  }
};

if (typeof window !== "undefined") {
  window.IDBCache = IDBCache;
}