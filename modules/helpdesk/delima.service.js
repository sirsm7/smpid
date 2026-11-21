import { envReady } from "../../js/config/config.js";
import { APP_CONFIG } from "../../js/config/app.config.js";
import {
  initDatabaseClient,
  getDatabaseClient,
  getDelimaDb,
  getDelimaDbAsync
} from "../../js/core/db.js";
import { IDBCache } from "../../js/core/idb.js";

const TABLE_NAME =
  (APP_CONFIG && APP_CONFIG.DB_TABLES && APP_CONFIG.DB_TABLES.DELIMA_STATUS) ||
  "smpid_delima_status";

const DELIMA_SCHOOL_TABLE =
  (APP_CONFIG && APP_CONFIG.DB_TABLES && APP_CONFIG.DB_TABLES.DELIMA_DATA_SEKOLAH) ||
  "delima_data_sekolah";

const RPC_UPDATE_STATUS_BATCH = "update_delima_status_batch";
const RPC_DELETE_STATUS = "delete_delima_status";
const VALID_STATUSES = new Set(["DALAM PROSES", "SELESAI"]);

function normalizeRecordId(rawId) {
  if (typeof rawId === "number" && Number.isSafeInteger(rawId) && rawId > 0) {
    return rawId;
  }
  const text = String(rawId ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error("ID rekod DELIMa tidak sah.");
  }
  const asNumber = Number(text);
  if (Number.isSafeInteger(asNumber) && asNumber > 0) {
    return asNumber;
  }
  return text;
}

function normalizeStatusProses(rawStatus) {
  const normalized = String(rawStatus ?? "").trim().toUpperCase();
  if (!VALID_STATUSES.has(normalized)) {
    throw new Error(`Nilai status_proses tidak sah: ${rawStatus}`);
  }
  return normalized;
}

function normalizeSchoolCode(rawCode) {
  return String(rawCode ?? "").trim().toUpperCase();
}

function normalizeSchoolOuRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const kodSekolah = normalizeSchoolCode(row.kod_sekolah);
  if (!kodSekolah) {
    return null;
  }
  const rawOu = typeof row.kod_ou === "string" ? row.kod_ou.trim() : "";
  return {
    kod_sekolah: kodSekolah,
    nama_sekolah: typeof row.nama_sekolah === "string" ? row.nama_sekolah.trim() : "",
    jenis_sekolah: typeof row.jenis_sekolah === "string" ? row.jenis_sekolah.trim() : "",
    kod_ou: rawOu || null
  };
}

function isMissingRpcError(error) {
  if (!error) {
    return false;
  }
  const message = String(error.message || "").toLowerCase();
  return (
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("could not find the function")
  );
}

async function getReadyDb() {
  const activeEnvPromise =
    typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
  await activeEnvPromise;

  const db = (await initDatabaseClient()) || getDatabaseClient();
  if (!db) {
    throw new Error("Sambungan pangkalan data Supabase belum sedia.");
  }
  return db;
}

async function getReadyDelimaDb() {
  const activeEnvPromise =
    typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
  await activeEnvPromise;

  const delimaDb =
    (typeof getDelimaDbAsync === "function" && (await getDelimaDbAsync())) ||
    (typeof getDelimaDb === "function" && getDelimaDb());

  if (!delimaDb) {
    throw new Error("Sambungan skema delima_data Supabase belum sedia.");
  }
  return delimaDb;
}

async function invalidateDelimaCache() {
  try {
    if (IDBCache && typeof IDBCache.deleteByPrefix === "function") {
      await IDBCache.deleteByPrefix("delima");
    }
  } catch {}
}

async function executeStatusBatchUpdate(db, normalizedIds, normalizedStatus) {
  const { data: rpcData, error: rpcError } = await db.rpc(RPC_UPDATE_STATUS_BATCH, {
    p_ids: normalizedIds,
    p_status_proses: normalizedStatus
  });

  if (!rpcError) {
    return Array.isArray(rpcData) ? rpcData : [];
  }

  if (!isMissingRpcError(rpcError)) {
    throw rpcError;
  }

  const { data: tableData, error: tableError } = await db
    .from(TABLE_NAME)
    .update({ status_proses: normalizedStatus })
    .in("id", normalizedIds)
    .select("id, status_proses");

  if (tableError) {
    throw tableError;
  }

  if (!Array.isArray(tableData) || tableData.length === 0) {
    throw new Error(
      "Kemas kini disekat oleh kawalan akses jadual. Sila jalankan skrip SQL RPC update_delima_status_batch di Supabase terlebih dahulu."
    );
  }

  return tableData;
}

export const DelimaService = {
  async getSchoolOuByCode(kodSekolah) {
    const normalizedCode = normalizeSchoolCode(kodSekolah);
    if (!normalizedCode) {
      return null;
    }

    const delimaDb = await getReadyDelimaDb();
    const { data, error } = await delimaDb
      .from(DELIMA_SCHOOL_TABLE)
      .select("kod_sekolah, nama_sekolah, jenis_sekolah, kod_ou")
      .eq("kod_sekolah", normalizedCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return normalizeSchoolOuRow(data);
  },

  async getAllSchoolOuRecords(kodSekolahList = null) {
    const delimaDb = await getReadyDelimaDb();
    const { data, error } = await delimaDb
      .from(DELIMA_SCHOOL_TABLE)
      .select("kod_sekolah, nama_sekolah, jenis_sekolah, kod_ou");

    if (error) {
      throw error;
    }

    const targetSet =
      Array.isArray(kodSekolahList) && kodSekolahList.length > 0
        ? new Set(kodSekolahList.map((k) => normalizeSchoolCode(k)).filter(Boolean))
        : null;

    const results = [];
    (Array.isArray(data) ? data : []).forEach((row) => {
      const normalized = normalizeSchoolOuRow(row);
      if (!normalized) {
        return;
      }
      if (!targetSet || targetSet.has(normalized.kod_sekolah)) {
        results.push(normalized);
      }
    });

    return results;
  },

  async getAllSchoolOuMap(kodSekolahList = null) {
    const records = await this.getAllSchoolOuRecords(kodSekolahList);
    const ouMap = {};
    records.forEach((item) => {
      ouMap[item.kod_sekolah] = item;
    });
    return ouMap;
  },

  async createStatusBulk(dbPayloads, webhookPayload) {
    const db = await getReadyDb();
    const { data, error } = await db
      .from(TABLE_NAME)
      .insert(dbPayloads)
      .select("id");

    if (error) {
      throw error;
    }

    await invalidateDelimaCache();

    const notifyBaseUrl =
      (APP_CONFIG &&
        APP_CONFIG.API &&
        (APP_CONFIG.API.NOTIFY_API_URL || APP_CONFIG.API.DENO_URL)) ||
      "";

    if (notifyBaseUrl && webhookPayload) {
      fetch(`${notifyBaseUrl.replace(/\/+$/, "")}/notify-delima`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      }).catch(() => {});
    }

    return { success: true, count: Array.isArray(data) ? data.length : 0 };
  },

  async getBySchool(kodSekolah, kategori) {
    const db = await getReadyDb();
    const { data, error } = await db
      .from(TABLE_NAME)
      .select("*")
      .eq("kod_sekolah", kodSekolah)
      .eq("kategori", kategori)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  },

  async getAll(kategori = "ALL", statusFilter = "ALL") {
    const db = await getReadyDb();
    let query = db
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    if (kategori && kategori !== "ALL") {
      query = query.eq("kategori", kategori);
    }

    if (statusFilter && statusFilter !== "ALL") {
      query = query.eq("status_proses", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data || [];
  },

  async updateStatus(id, statusProses) {
    const db = await getReadyDb();
    const normalizedId = normalizeRecordId(id);
    const normalizedStatus = normalizeStatusProses(statusProses);

    const updatedRows = await executeStatusBatchUpdate(
      db,
      [normalizedId],
      normalizedStatus
    );

    if (updatedRows.length === 0) {
      throw new Error(
        `Rekod ID ${normalizedId} tidak ditemui dalam jadual ${TABLE_NAME}.`
      );
    }

    await invalidateDelimaCache();
    return { success: true, record: updatedRows[0] };
  },

  async updateStatusBulk(ids, statusProses) {
    const db = await getReadyDb();
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true, count: 0, records: [] };
    }

    const normalizedIds = ids.map((rawId) => normalizeRecordId(rawId));
    const normalizedStatus = normalizeStatusProses(statusProses);

    const updatedRows = await executeStatusBatchUpdate(
      db,
      normalizedIds,
      normalizedStatus
    );

    if (updatedRows.length === 0) {
      throw new Error(
        `Tiada rekod berjaya dikemas kini secara pukal kepada ${normalizedStatus}.`
      );
    }

    await invalidateDelimaCache();
    return { success: true, count: updatedRows.length, records: updatedRows };
  },

  async deleteStatus(id) {
    const db = await getReadyDb();
    const normalizedId = normalizeRecordId(id);

    const { data: rpcData, error: rpcError } = await db.rpc(RPC_DELETE_STATUS, {
      p_id: normalizedId
    });

    if (!rpcError) {
      if (!Array.isArray(rpcData) || rpcData.length === 0) {
        throw new Error(`Rekod ID ${normalizedId} tidak ditemui untuk dipadam.`);
      }
      await invalidateDelimaCache();
      return { success: true };
    }

    if (!isMissingRpcError(rpcError)) {
      throw rpcError;
    }

    const { data: tableData, error: tableError } = await db
      .from(TABLE_NAME)
      .delete()
      .eq("id", normalizedId)
      .select("id");

    if (tableError) {
      throw tableError;
    }

    if (!Array.isArray(tableData) || tableData.length === 0) {
      throw new Error(
        "Pemadaman disekat oleh kawalan akses jadual. Sila jalankan skrip SQL RPC delete_delima_status di Supabase terlebih dahulu."
      );
    }

    await invalidateDelimaCache();
    return { success: true };
  }
};

export default DelimaService;