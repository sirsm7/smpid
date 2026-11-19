import { envReady } from "../../js/config/config.js";
import { APP_CONFIG } from "../../js/config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "../../js/core/db.js";
import { IDBCache } from "../../js/core/idb.js";

const TABLE_NAME =
  (APP_CONFIG && APP_CONFIG.DB_TABLES && APP_CONFIG.DB_TABLES.DELIMA_STATUS) ||
  "smpid_delima_status";

const VALID_STATUSES = new Set(["DALAM PROSES", "SELESAI"]);

function normalizeRecordId(rawId) {
  if (typeof rawId === "number" && Number.isFinite(rawId)) {
    return rawId;
  }
  const text = String(rawId ?? "").trim();
  if (!text) {
    throw new Error("ID rekod DELIMa tidak sah.");
  }
  if (/^\d+$/.test(text)) {
    const asNumber = Number(text);
    if (Number.isSafeInteger(asNumber)) {
      return asNumber;
    }
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

async function invalidateDelimaCache() {
  try {
    if (IDBCache && typeof IDBCache.deleteByPrefix === "function") {
      await IDBCache.deleteByPrefix("delima");
    }
  } catch {}
}

export const DelimaService = {
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

    const { data, error } = await db
      .from(TABLE_NAME)
      .update({ status_proses: normalizedStatus })
      .eq("id", normalizedId)
      .select("id, status_proses");

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(
        `Rekod ID ${normalizedId} tidak ditemui atau gagal dikemas kini kepada ${normalizedStatus}.`
      );
    }

    await invalidateDelimaCache();
    return { success: true, record: data[0] };
  },

  async updateStatusBulk(ids, statusProses) {
    const db = await getReadyDb();
    if (!Array.isArray(ids) || ids.length === 0) {
      return { success: true, count: 0, records: [] };
    }

    const normalizedIds = ids.map((rawId) => normalizeRecordId(rawId));
    const normalizedStatus = normalizeStatusProses(statusProses);

    const { data, error } = await db
      .from(TABLE_NAME)
      .update({ status_proses: normalizedStatus })
      .in("id", normalizedIds)
      .select("id, status_proses");

    if (error) {
      throw error;
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(
        `Tiada rekod berjaya dikemas kini secara pukal kepada ${normalizedStatus}.`
      );
    }

    await invalidateDelimaCache();
    return { success: true, count: data.length, records: data };
  },

  async deleteStatus(id) {
    const db = await getReadyDb();
    const normalizedId = normalizeRecordId(id);

    const { error } = await db
      .from(TABLE_NAME)
      .delete()
      .eq("id", normalizedId);

    if (error) {
      throw error;
    }

    await invalidateDelimaCache();
    return { success: true };
  }
};

export default DelimaService;