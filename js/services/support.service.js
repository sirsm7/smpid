import { envReady, getEnv } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "../core/db.js";

const MUTABLE_TICKET_FIELDS = [
  "status",
  "balasan_admin",
  "tarikh_balas",
  "tajuk",
  "butiran_masalah"
];

async function getReadyDbClient() {
  await envReady;
  const db = (await initDatabaseClient()) || getDatabaseClient();
  if (!db) {
    throw new Error("Sambungan pangkalan data tidak tersedia.");
  }
  return db;
}

function resolveNotifyBaseUrl() {
  const env = typeof getEnv === "function" ? getEnv() : null;
  const winEnv = typeof window !== "undefined" && window.__ENV ? window.__ENV : null;
  const apiCfg = APP_CONFIG && APP_CONFIG.API ? APP_CONFIG.API : {};
  const candidate =
    (env && (env.NOTIFY_API_URL || env.EDGE_NOTIFY_URL)) ||
    (winEnv && (winEnv.NOTIFY_API_URL || winEnv.EDGE_NOTIFY_URL)) ||
    apiCfg.NOTIFY_API_URL ||
    apiCfg.EDGE_NOTIFY_URL ||
    apiCfg.DENO_URL ||
    "";
  return typeof candidate === "string" ? candidate.trim().replace(/\/+$/, "") : "";
}

function normalizeTicketId(id) {
  if (typeof id === "number" && Number.isInteger(id) && id > 0) {
    return id;
  }
  const raw = String(id ?? "").trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error("ID tiket tidak sah.");
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("ID tiket di luar julat sah.");
  }
  return parsed;
}

function sanitizeUpdatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Muatan kemas kini tiket tidak sah.");
  }

  const sanitized = {};

  MUTABLE_TICKET_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field) && payload[field] !== undefined) {
      if (field === "status" && payload[field] !== null) {
        sanitized[field] = String(payload[field]).trim().toUpperCase();
      } else if (typeof payload[field] === "string") {
        sanitized[field] = payload[field].trim();
      } else {
        sanitized[field] = payload[field];
      }
    }
  });

  if (sanitized.status === "SELESAI" && !sanitized.tarikh_balas) {
    sanitized.tarikh_balas = new Date().toISOString();
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error("Tiada medan sah untuk dikemas kini pada tiket.");
  }

  return sanitized;
}

async function dispatchTicketWebhook(endpointPath, bodyPayload) {
  const baseUrl = resolveNotifyBaseUrl();
  if (!baseUrl) {
    return;
  }

  try {
    await fetch(`${baseUrl}${endpointPath}`, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(bodyPayload)
    });
  } catch {}
}

export const SupportService = {
  async createTicket(payload) {
    const db = await getReadyDbClient();

    const record = {
      kod_sekolah: String(payload?.kod_sekolah ?? "").trim().toUpperCase(),
      peranan_pengirim: String(payload?.peranan_pengirim ?? "").trim().toUpperCase(),
      tajuk: String(payload?.tajuk ?? "").trim(),
      butiran_masalah: String(payload?.butiran_masalah ?? "").trim(),
      status: String(payload?.status ?? "DALAM PROSES").trim().toUpperCase() || "DALAM PROSES"
    };

    const { data, error } = await db
      .from("smpid_aduan")
      .insert([record])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await dispatchTicketWebhook("/notify-ticket", {
      kod: record.kod_sekolah,
      peranan: record.peranan_pengirim,
      tajuk: record.tajuk,
      mesej: record.butiran_masalah
    });

    return { success: true, data };
  },

  async update(id, payload) {
    const db = await getReadyDbClient();
    const normalizedId = normalizeTicketId(id);
    const sanitizedPayload = sanitizeUpdatePayload(payload);

    const { data: updatedRows, error } = await db.rpc("update_aduan_tiket", {
      p_id: normalizedId,
      p_status: sanitizedPayload.status ?? null,
      p_balasan_admin: Object.prototype.hasOwnProperty.call(sanitizedPayload, "balasan_admin")
        ? sanitizedPayload.balasan_admin
        : null,
      p_tarikh_balas: sanitizedPayload.tarikh_balas ?? null,
      p_tajuk: sanitizedPayload.tajuk ?? null,
      p_butiran_masalah: sanitizedPayload.butiran_masalah ?? null
    });

    if (error) {
      throw error;
    }

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      throw new Error("Rekod tiket tidak ditemui atau gagal dikemas kini di pangkalan data.");
    }

    const updatedTicket = updatedRows[0];

    if (updatedTicket.status === "SELESAI") {
      await dispatchTicketWebhook("/reply-ticket", {
        kod: updatedTicket.kod_sekolah,
        peranan: updatedTicket.peranan_pengirim,
        tajuk: updatedTicket.tajuk,
        balasan: updatedTicket.balasan_admin || ""
      });
    }

    return { success: true, data: updatedTicket };
  },

  async delete(id) {
    const db = await getReadyDbClient();
    const normalizedId = normalizeTicketId(id);

    const { data: deletedId, error } = await db.rpc("delete_aduan_tiket", {
      p_id: normalizedId
    });

    if (error) {
      throw error;
    }

    if (deletedId === null || deletedId === undefined) {
      throw new Error("Rekod tiket tidak ditemui atau gagal dipadam di pangkalan data.");
    }

    return { success: true, id: deletedId };
  },

  async getBySchool(kodSekolah) {
    const db = await getReadyDbClient();
    const normalizedKod = String(kodSekolah ?? "").trim().toUpperCase();

    const { data, error } = await db
      .from("smpid_aduan")
      .select("*")
      .eq("kod_sekolah", normalizedKod)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  },

  async getAll(statusFilter = "ALL") {
    const db = await getReadyDbClient();
    const normalizedStatus = String(statusFilter ?? "ALL").trim().toUpperCase();

    let query = db
      .from("smpid_aduan")
      .select("*")
      .order("created_at", { ascending: false });

    if (normalizedStatus && normalizedStatus !== "ALL") {
      query = query.eq("status", normalizedStatus);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }
};