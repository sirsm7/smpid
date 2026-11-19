import { envReady, getEnv } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient, getDatabaseSchema } from "./db.js";
import { IDBCache } from "./idb.js";
import { RealtimeManager } from "./realtime.js";

const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 100;
const UPSERT_BATCH_RPC = "nadim_upsert_batch";
const SEQUENCE_RESET_RPC = "nadim_reset_sequences";
const DEFAULT_SUPABASE_SCHEMA = "nadim_data";

const CORE_TABLE_REGISTRY = {
  smpid_sekolah_data: {
    table_name: "smpid_sekolah_data",
    primary_key: "kod_sekolah",
    unique_keys: ["kod_sekolah"],
    depends_on: [],
    fallback_headers: ["kod_sekolah"],
    fallback_optional: [
      "nama_sekolah",
      "jenis_sekolah",
      "daerah",
      "nama_gpict",
      "no_telefon_gpict",
      "emel_delima_gpict",
      "nama_admin_delima",
      "no_telefon_admin_delima",
      "emel_delima_admin_delima",
      "created_at",
      "telegram_id_gpict",
      "telegram_id_admin",
      "parlimen",
      "nama_pgb",
      "no_telefon_pgb",
      "emel_delima_pgb",
      "telegram_id_pgb",
      "nama_gpk",
      "no_telefon_gpk",
      "emel_delima_gpk",
      "telegram_id_gpk",
      "no_telefon_sekolah",
      "sb_ada",
      "sb_kaedah",
      "sb_bil_semua",
      "sb_bil_fungsi",
      "sb_lokasi"
    ]
  },
  smpid_pppdm_program: {
    table_name: "smpid_pppdm_program",
    primary_key: "id",
    unique_keys: ["id", "kod_program"],
    depends_on: [],
    fallback_headers: ["kod_program", "nama_program"],
    fallback_optional: ["id", "kategori", "status_aktif"]
  },
  smpid_admin_users: {
    table_name: "smpid_admin_users",
    primary_key: "role",
    unique_keys: ["role", "telegram_id"],
    depends_on: [],
    fallback_headers: ["role"],
    fallback_optional: ["telegram_id", "created_at"]
  },
  smpid_users: {
    table_name: "smpid_users",
    primary_key: "id",
    unique_keys: ["id", "email"],
    depends_on: [],
    fallback_headers: ["email", "role"],
    fallback_optional: ["id", "kod_sekolah", "password", "created_at"]
  },
  smpid_dcs_analisa: {
    table_name: "smpid_dcs_analisa",
    primary_key: "id",
    unique_keys: ["id", "kod_sekolah"],
    depends_on: [],
    fallback_headers: ["kod_sekolah", "nama_sekolah"],
    fallback_optional: [
      "id",
      "jenis_sekolah",
      "daerah",
      "dcs_2023",
      "peratus_aktif_2023",
      "dcs_2024",
      "peratus_aktif_2024",
      "dcs_2025",
      "peratus_aktif_2025",
      "dcs_2026",
      "peratus_aktif_2026",
      "created_at"
    ]
  },
  smpid_penataran_digital: {
    table_name: "smpid_penataran_digital",
    primary_key: "id",
    unique_keys: ["id", "kod_sekolah"],
    depends_on: [],
    fallback_headers: [
      "kod_sekolah",
      "nama_sekolah",
      "jumlah_skor",
      "peratus",
      "penarafan",
      "skor_dimensi"
    ],
    fallback_optional: ["id", "bil_guru", "bil_murid", "created_at", "updated_at"]
  },
  smpid_bb_kunci: {
    table_name: "smpid_bb_kunci",
    primary_key: "id",
    unique_keys: ["id", "tarikh"],
    depends_on: [],
    fallback_headers: ["tarikh"],
    fallback_optional: ["id", "komen", "admin_email", "kod_ppd", "dikunci_oleh", "created_at"]
  },
  smpid_bb_tempahan: {
    table_name: "smpid_bb_tempahan",
    primary_key: "id",
    unique_keys: ["id", "id_tempahan"],
    depends_on: [],
    fallback_headers: [
      "id_tempahan",
      "tarikh",
      "masa",
      "nama_pic",
      "no_tel_pic",
      "kod_sekolah",
      "nama_sekolah"
    ],
    fallback_optional: ["id", "status", "catatan", "tajuk_bengkel", "created_at"]
  },
  smpid_aduan: {
    table_name: "smpid_aduan",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: ["kod_sekolah", "peranan_pengirim", "tajuk", "butiran_masalah"],
    fallback_optional: ["id", "status", "balasan_admin", "tarikh_balas", "created_at"]
  },
  smpid_delima_status: {
    table_name: "smpid_delima_status",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: ["kod_sekolah", "kategori", "nama", "id_delima", "catatan"],
    fallback_optional: ["id", "unit_organisasi_baharu", "status_proses", "created_at"]
  },
  smpid_libat_urus: {
    table_name: "smpid_libat_urus",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: [],
    fallback_headers: [
      "kod_sekolah",
      "kategori_sasar",
      "tarikh_laksana",
      "bulan",
      "tempat",
      "jumlah_peserta",
      "pautan_fail"
    ],
    fallback_optional: ["id", "mod_pelaksanaan", "created_at"]
  },
  smpid_pencapaian: {
    table_name: "smpid_pencapaian",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: ["smpid_sekolah_data"],
    fallback_headers: [
      "kod_sekolah",
      "kategori",
      "nama_peserta",
      "nama_pertandingan",
      "peringkat",
      "tahun",
      "pencapaian"
    ],
    fallback_optional: ["id", "jawatan", "pautan_bukti", "jenis_rekod", "penyedia", "created_at"]
  },
  smpid_impak_bbm: {
    table_name: "smpid_impak_bbm",
    primary_key: "id",
    unique_keys: ["id"],
    depends_on: ["smpid_sekolah_data"],
    fallback_headers: [
      "kod_sekolah",
      "jantina",
      "kumpulan_umur",
      "q1_kefahaman",
      "q2_penguasaan",
      "q3_ingatan",
      "q4_minat",
      "q5_idea",
      "q6_keyakinan",
      "q7_persediaan_ujian",
      "q8_keseluruhan",
      "q9_penglibatan",
      "q10_penerangan_guru",
      "q14_pengesahan_sesi"
    ],
    fallback_optional: [
      "id",
      "q11_komponen_bbm",
      "q12_perkara_dipelajari",
      "q13_cadangan",
      "is_valid",
      "created_at"
    ]
  },
  smpid_pppdm_penyertaan: {
    table_name: "smpid_pppdm_penyertaan",
    primary_key: "id",
    unique_keys: ["id", "kod_sekolah,program_id,tahun"],
    depends_on: ["smpid_sekolah_data", "smpid_pppdm_program"],
    fallback_headers: ["kod_sekolah", "tahun"],
    fallback_optional: ["id", "program_id", "penyertaan", "created_at"]
  }
};

let activeMigrationController = null;
let operationInProgress = false;

function runWithTimeout(taskPromise, timeoutMs, fallbackValue = null) {
  let timerId = null;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  return Promise.race([
    Promise.resolve(taskPromise).catch(() => fallbackValue),
    timeoutPromise
  ]).finally(() => {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  });
}

function resolveActiveSchema() {
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

function sortTablesByDependency(tableNames) {
  const uniqueNames = Array.from(new Set(tableNames));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name) || visiting.has(name)) {
      return;
    }
    visiting.add(name);
    const meta = CORE_TABLE_REGISTRY[name];
    const parents = meta && Array.isArray(meta.depends_on) ? meta.depends_on : [];
    for (let i = 0; i < parents.length; i += 1) {
      if (uniqueNames.includes(parents[i])) {
        visit(parents[i]);
      }
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(name);
  }

  for (let i = 0; i < uniqueNames.length; i += 1) {
    visit(uniqueNames[i]);
  }

  return ordered;
}

async function resolveProjectSchemas() {
  const targetNames = Object.keys(CORE_TABLE_REGISTRY);
  const orderedNames = sortTablesByDependency(targetNames);
  const schemas = {};

  for (let i = 0; i < orderedNames.length; i += 1) {
    const tableName = orderedNames[i];
    const reg = CORE_TABLE_REGISTRY[tableName];
    const headers = [...reg.fallback_headers];
    const optionalHeaders = [...reg.fallback_optional];
    const allColumns = Array.from(new Set([...headers, ...optionalHeaders]));

    schemas[tableName] = {
      table_name: tableName,
      primary_key: reg.primary_key || "id",
      unique_keys: Array.isArray(reg.unique_keys) ? [...reg.unique_keys] : [reg.primary_key || "id"],
      depends_on: Array.isArray(reg.depends_on) ? [...reg.depends_on] : [],
      headers,
      optional_headers: optionalHeaders,
      all_columns: allColumns,
      properties: {}
    };
  }

  return {
    tableOrder: orderedNames,
    schemas
  };
}

function renderStatusFeedback(container, entries) {
  if (!container || typeof document === "undefined") {
    return;
  }

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    const line = document.createElement("div");
    line.className = "py-1 text-xs font-mono border-b border-slate-100 last:border-0";

    if (item.level === "error") {
      line.classList.add("text-red-500", "font-bold");
    } else if (item.level === "success") {
      line.classList.add("text-emerald-400", "font-bold");
    } else if (item.level === "warn") {
      line.classList.add("text-amber-400");
    } else {
      line.classList.add("text-slate-300");
    }

    line.textContent = item.text;
    fragment.appendChild(line);
  }

  container.appendChild(fragment);
}

function reportProgress(onProgress, statusContainer, logBuffer, level, text, extra = {}) {
  const entry = {
    level,
    text,
    timestamp: new Date().toISOString(),
    ...extra
  };
  logBuffer.push(entry);

  if (statusContainer) {
    renderStatusFeedback(statusContainer, logBuffer);
  }
  if (typeof onProgress === "function") {
    try {
      onProgress(entry);
    } catch {}
  }
}

async function fetchAllTableRows(client, tableName, signal) {
  const rows = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    if (signal && signal.aborted) {
      throw new DOMException("Operasi eksport dibatalkan.", "AbortError");
    }

    const to = from + PAGE_SIZE - 1;
    let query = client.from(tableName).select("*").range(from, to);
    if (signal && typeof query.abortSignal === "function") {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return { rows: [], skipped: true };
      }
      throw new Error(`Gagal membaca jadual ${tableName}: ${error.message}`);
    }

    const batch = Array.isArray(data) ? data : [];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return { rows, skipped: false };
}

function deriveColumnsFromRows(rows, schema) {
  const discovered = new Set(schema.all_columns);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row && typeof row === "object") {
      Object.keys(row).forEach((col) => discovered.add(col));
    }
  }

  const allCols = Array.from(discovered);
  const requiredSet = new Set(schema.headers);
  const headers = allCols.filter((col) => requiredSet.has(col));
  const optionalHeaders = allCols.filter((col) => !requiredSet.has(col));

  return {
    headers,
    optionalHeaders,
    allColumns: allCols
  };
}

function triggerJsonFileDownload(filename, jsonString) {
  const blob = new Blob([jsonString], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  }
}

function resolveConflictTarget(schema, sampleRow) {
  const uniqueKeys = Array.isArray(schema.unique_keys) ? schema.unique_keys : [schema.primary_key];
  const pk = schema.primary_key;

  if (
    pk &&
    sampleRow &&
    Object.prototype.hasOwnProperty.call(sampleRow, pk) &&
    sampleRow[pk] !== null &&
    sampleRow[pk] !== undefined &&
    sampleRow[pk] !== ""
  ) {
    return pk;
  }

  for (let i = 0; i < uniqueKeys.length; i += 1) {
    const candidate = uniqueKeys[i];
    if (candidate === pk) {
      continue;
    }
    const parts = candidate.split(",").map((p) => p.trim());
    const allPresent =
      sampleRow &&
      parts.every(
        (col) =>
          Object.prototype.hasOwnProperty.call(sampleRow, col) &&
          sampleRow[col] !== null &&
          sampleRow[col] !== undefined &&
          sampleRow[col] !== ""
      );
    if (allPresent) {
      return candidate;
    }
  }

  return pk;
}

async function resolveSuperAdminContext(client) {
  let authUser = null;
  try {
    const { data: authData } = await client.auth.getUser();
    authUser = authData && authData.user ? authData.user : null;
  } catch {}

  let existingSuperAdmins = [];
  try {
    const { data: saRows } = await client
      .from("smpid_users")
      .select("id, email, role")
      .in("role", ["SUPER_ADMIN", "SUPER ADMIN"]);
    if (Array.isArray(saRows)) {
      existingSuperAdmins = saRows;
    }
  } catch {}

  let callerIdentifier = "";
  if (authUser && authUser.email) {
    callerIdentifier = String(authUser.email).trim().toLowerCase();
  } else if (typeof window !== "undefined" && window.localStorage) {
    const roleKey =
      (APP_CONFIG && APP_CONFIG.SESSION && APP_CONFIG.SESSION.USER_ROLE) || "smpid_user_role";
    const idKey =
      (APP_CONFIG && APP_CONFIG.SESSION && APP_CONFIG.SESSION.USER_ID) || "smpid_user_id";
    const storedRole = String(window.localStorage.getItem(roleKey) || "").trim().toUpperCase();
    const storedId = String(
      window.localStorage.getItem(idKey) ||
      window.localStorage.getItem("smpid_user_email") ||
      ""
    ).trim();

    if (storedId) {
      callerIdentifier = storedId;
    } else if ((storedRole === "SUPER_ADMIN" || storedRole === "SUPER ADMIN") && existingSuperAdmins.length > 0) {
      callerIdentifier = String(existingSuperAdmins[0].email || existingSuperAdmins[0].id || "").trim();
    }
  }

  return {
    authUser,
    existingSuperAdmins,
    callerIdentifier
  };
}

function preserveSuperAdminsInUsersRows(rows, superAdminContext) {
  const { authUser, existingSuperAdmins } = superAdminContext || {};
  const canonicalByEmail = new Map();

  if (Array.isArray(existingSuperAdmins)) {
    existingSuperAdmins.forEach((sa) => {
      if (sa && sa.email && sa.id) {
        canonicalByEmail.set(String(sa.email).trim().toLowerCase(), {
          id: sa.id,
          email: String(sa.email).trim().toLowerCase(),
          role: "SUPER_ADMIN"
        });
      }
    });
  }

  if (authUser && authUser.id && authUser.email) {
    const normEmail = String(authUser.email).trim().toLowerCase();
    canonicalByEmail.set(normEmail, {
      id: authUser.id,
      email: normEmail,
      role: "SUPER_ADMIN"
    });
  }

  if (canonicalByEmail.size === 0) {
    return rows;
  }

  const seenEmails = new Set();
  const preserved = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowEmail = row && row.email ? String(row.email).trim().toLowerCase() : "";

    if (rowEmail && canonicalByEmail.has(rowEmail)) {
      const canonical = canonicalByEmail.get(rowEmail);
      seenEmails.add(rowEmail);
      preserved.push({
        ...row,
        id: canonical.id,
        email: canonical.email,
        role: "SUPER_ADMIN"
      });
    } else {
      preserved.push(row);
    }
  }

  canonicalByEmail.forEach((canonical, emailKey) => {
    if (!seenEmails.has(emailKey)) {
      preserved.push({
        id: canonical.id,
        kod_sekolah: null,
        email: canonical.email,
        role: "SUPER_ADMIN"
      });
    }
  });

  return preserved;
}

function validateAndNormalizeBackupPayload(rawJson, liveSchemas) {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    throw new Error("Struktur fail sandaran tidak sah: objek JSON utama diperlukan.");
  }

  const metadata = rawJson.metadata;
  const tablesObj = rawJson.tables;

  if (!metadata || typeof metadata !== "object") {
    throw new Error("Struktur fail sandaran tidak sah: bahagian 'metadata' tiada.");
  }
  if (!Array.isArray(metadata.table_order) || metadata.table_order.length === 0) {
    throw new Error("Struktur fail sandaran tidak sah: 'metadata.table_order' kosong atau tiada.");
  }
  if (!tablesObj || typeof tablesObj !== "object" || Array.isArray(tablesObj)) {
    throw new Error("Struktur fail sandaran tidak sah: bahagian 'tables' tiada.");
  }

  const sortedOrder = sortTablesByDependency(metadata.table_order);
  const normalizedTables = {};

  for (let i = 0; i < sortedOrder.length; i += 1) {
    const tableName = sortedOrder[i];
    const tableEntry = tablesObj[tableName];

    if (!tableEntry || typeof tableEntry !== "object") {
      throw new Error(`Definisi jadual '${tableName}' tiada dalam bahagian 'tables'.`);
    }
    if (tableEntry.table_name !== tableName) {
      throw new Error(
        `Ketidaksepadanan nama jadual: dijangka '${tableName}', ditemui '${tableEntry.table_name || ""}'.`
      );
    }
    if (typeof tableEntry.primary_key !== "string" || !tableEntry.primary_key.trim()) {
      throw new Error(`Jadual '${tableName}' tidak mempunyai takrifan 'primary_key' yang sah.`);
    }
    if (!Array.isArray(tableEntry.headers)) {
      throw new Error(`Jadual '${tableName}' tidak mempunyai tatasusunan 'headers' yang sah.`);
    }
    if (!Array.isArray(tableEntry.rows)) {
      throw new Error(`Jadual '${tableName}' tidak mempunyai tatasusunan 'rows' yang sah.`);
    }

    const liveSchema = liveSchemas[tableName];
    if (!liveSchema) {
      continue;
    }

    const declaredOptional = Array.isArray(tableEntry.optional_headers)
      ? tableEntry.optional_headers
      : [];
    const allowedInBackup = new Set([...tableEntry.headers, ...declaredOptional]);
    const validTargetColumns =
      liveSchema.all_columns.length > 0 ? new Set(liveSchema.all_columns) : allowedInBackup;

    const missingRequiredInBackup = liveSchema.headers.filter(
      (reqCol) => !allowedInBackup.has(reqCol)
    );
    if (missingRequiredInBackup.length > 0) {
      throw new Error(
        `Jadual '${tableName}' kehilangan lajur wajib (NOT NULL): ${missingRequiredInBackup.join(", ")}.`
      );
    }

    const seenUniqueValues = new Map();
    liveSchema.unique_keys.forEach((uk) => seenUniqueValues.set(uk, new Set()));

    const normalizedRows = [];

    for (let r = 0; r < tableEntry.rows.length; r += 1) {
      const sourceRow = tableEntry.rows[r];
      if (!sourceRow || typeof sourceRow !== "object" || Array.isArray(sourceRow)) {
        throw new Error(`Baris ke-${r + 1} dalam jadual '${tableName}' bukan objek rekod yang sah.`);
      }

      for (let h = 0; h < liveSchema.headers.length; h += 1) {
        const reqCol = liveSchema.headers[h];
        const val = sourceRow[reqCol];
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          throw new Error(
            `Pelanggaran kekangan NOT NULL pada jadual '${tableName}', baris ke-${r + 1}, lajur '${reqCol}'.`
          );
        }
      }

      for (let u = 0; u < liveSchema.unique_keys.length; u += 1) {
        const uk = liveSchema.unique_keys[u];
        const ukCols = uk.split(",").map((c) => c.trim());
        const hasAllValues = ukCols.every(
          (col) => sourceRow[col] !== undefined && sourceRow[col] !== null && sourceRow[col] !== ""
        );
        if (hasAllValues) {
          const compositeVal = ukCols.map((col) => String(sourceRow[col])).join("::");
          const tracker = seenUniqueValues.get(uk);
          if (tracker.has(compositeVal)) {
            throw new Error(
              `Pelanggaran kekangan UNIQUE (${uk}) pada jadual '${tableName}', baris ke-${r + 1}: nilai pendua '${compositeVal}'.`
            );
          }
          tracker.add(compositeVal);
        }
      }

      const cleanRow = {};
      allowedInBackup.forEach((col) => {
        if (
          validTargetColumns.has(col) &&
          Object.prototype.hasOwnProperty.call(sourceRow, col) &&
          sourceRow[col] !== undefined
        ) {
          cleanRow[col] = sourceRow[col];
        }
      });

      normalizedRows.push(cleanRow);
    }

    normalizedTables[tableName] = {
      schema: liveSchema,
      rows: normalizedRows
    };
  }

  return {
    tableOrder: sortedOrder.filter((name) => Boolean(normalizedTables[name])),
    tables: normalizedTables
  };
}

async function upsertTableBatchWithFallback(client, tableName, batch, conflictTarget, callerIdentifier, signal) {
  const { error: rpcError } = await client.rpc(UPSERT_BATCH_RPC, {
    p_table: tableName,
    p_rows: batch,
    p_conflict_column: conflictTarget,
    p_admin_email: callerIdentifier || null
  });

  if (!rpcError) {
    return;
  }

  const errMsgLower = String(rpcError.message || "").toLowerCase();
  const isMissingRpc =
    rpcError.code === "42883" ||
    rpcError.code === "PGRST202" ||
    errMsgLower.includes("could not find the function");

  if (!isMissingRpc) {
    throw new Error(`Ralat pemulihan pada jadual ${tableName}: ${rpcError.message}`);
  }

  let query = client
    .from(tableName)
    .upsert(batch, { onConflict: conflictTarget, ignoreDuplicates: false });

  if (signal && typeof query.abortSignal === "function") {
    query = query.abortSignal(signal);
  }

  const { error: upsertError } = await query;
  if (upsertError) {
    throw new Error(`Ralat pemulihan pada jadual ${tableName}: ${upsertError.message}`);
  }
}

export const MigrationManager = {
  isBusy() {
    return operationInProgress;
  },

  cancelActiveOperation() {
    if (activeMigrationController) {
      activeMigrationController.abort();
      activeMigrationController = null;
    }
  },

  async exportBackupJson(options = {}) {
    if (operationInProgress) {
      throw new Error("Operasi sandaran atau pemulihan sedang berjalan. Sila tunggu sehingga selesai.");
    }

    operationInProgress = true;
    const controller = new AbortController();
    activeMigrationController = controller;
    const logBuffer = [];
    const statusContainer = options.statusContainer || null;
    const onProgress = options.onProgress || null;

    try {
      const activeSchema = resolveActiveSchema();
      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "info",
        `Memulakan pengesanan skema (${activeSchema}) pangkalan data Supabase...`
      );

      const activeEnvPromise =
        typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
      await activeEnvPromise;

      const client = await initDatabaseClient();
      if (!client) {
        throw new Error("Sambungan pangkalan data Supabase tidak tersedia.");
      }

      const { tableOrder, schemas } = await resolveProjectSchemas();
      const activeOrder = [];
      const exportedTables = {};
      let totalRowsExported = 0;

      for (let i = 0; i < tableOrder.length; i += 1) {
        const tableName = tableOrder[i];
        const schema = schemas[tableName];

        reportProgress(
          onProgress,
          statusContainer,
          logBuffer,
          "info",
          `Mengeksport jadual [${i + 1}/${tableOrder.length}]: ${tableName}...`,
          { table: tableName, step: i + 1, total: tableOrder.length }
        );

        const { rows, skipped } = await fetchAllTableRows(client, tableName, controller.signal);
        if (skipped) {
          continue;
        }

        const { headers, optionalHeaders, allColumns } = deriveColumnsFromRows(rows, schema);
        const normalizedRows = rows.map((row) => {
          const item = {};
          for (let c = 0; c < allColumns.length; c += 1) {
            const col = allColumns[c];
            item[col] = Object.prototype.hasOwnProperty.call(row, col) ? row[col] : null;
          }
          return item;
        });

        activeOrder.push(tableName);
        totalRowsExported += normalizedRows.length;

        exportedTables[tableName] = {
          table_name: tableName,
          primary_key: schema.primary_key,
          headers,
          optional_headers: optionalHeaders,
          rows: normalizedRows
        };
      }

      const backupDocument = {
        metadata: {
          app: "nadim",
          schema_name: activeSchema,
          schema_version: APP_CONFIG.APP_VERSION || "3.0.0",
          exported_at: new Date().toISOString(),
          table_order: activeOrder
        },
        tables: exportedTables
      };

      const timestampSlug = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = options.filename || `nadim_backup_${timestampSlug}.json`;
      const jsonContent = JSON.stringify(backupDocument, null, 2);

      triggerJsonFileDownload(filename, jsonContent);

      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "success",
        `Eksport selesai: ${activeOrder.length} jadual (${totalRowsExported} rekod) dimuat turun ke ${filename}.`,
        { step: activeOrder.length, total: activeOrder.length }
      );

      return {
        filename,
        tableCount: activeOrder.length,
        totalRows: totalRowsExported,
        document: backupDocument
      };
    } catch (error) {
      const msg =
        error && error.name === "AbortError"
          ? "Eksport sandaran dibatalkan oleh pengguna."
          : error && error.message
            ? error.message
            : "Ralat tidak diketahui semasa eksport sandaran.";
      reportProgress(onProgress, statusContainer, logBuffer, "error", msg);
      throw new Error(msg);
    } finally {
      operationInProgress = false;
      activeMigrationController = null;
    }
  },

  async importBackupJson(file, options = {}) {
    if (operationInProgress) {
      throw new Error("Operasi sandaran atau pemulihan sedang berjalan. Sila tunggu sehingga selesai.");
    }

    if (!file) {
      throw new Error("Sila pilih fail sandaran .json terlebih dahulu.");
    }

    const fileName = typeof file.name === "string" ? file.name.trim().toLowerCase() : "";
    const fileType = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
    const validExtension = fileName.endsWith(".json");
    const validMime = fileType === "" || fileType === "application/json" || fileType === "text/json";

    if (!validExtension || !validMime) {
      throw new Error("Format fail tidak sah. Hanya fail sambungan .json (application/json) diterima.");
    }

    operationInProgress = true;
    const controller = new AbortController();
    activeMigrationController = controller;
    const logBuffer = [];
    const statusContainer = options.statusContainer || null;
    const onProgress = options.onProgress || null;

    try {
      const activeSchema = resolveActiveSchema();
      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "info",
        `Membaca dan mengesahkan fail ${file.name} untuk skema ${activeSchema}...`
      );

      const rawText = await file.text();
      if (controller.signal.aborted) {
        throw new DOMException("Operasi pemulihan dibatalkan.", "AbortError");
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        throw new Error("Fail .json rosak atau mempunyai ralat sintaks JSON.");
      }

      const activeEnvPromise =
        typeof window !== "undefined" && window.ENV_READY ? window.ENV_READY : envReady;
      await activeEnvPromise;

      const client = await initDatabaseClient();
      if (!client) {
        throw new Error("Sambungan pangkalan data Supabase tidak tersedia.");
      }

      const superAdminContext = await resolveSuperAdminContext(client);
      const { schemas } = await resolveProjectSchemas();
      const validated = validateAndNormalizeBackupPayload(parsedJson, schemas);

      if (validated.tableOrder.length === 0) {
        throw new Error("Tiada jadual sasaran yang sepadan ditemui dalam fail sandaran.");
      }

      let totalRestoredRows = 0;

      for (let i = 0; i < validated.tableOrder.length; i += 1) {
        if (controller.signal.aborted) {
          throw new DOMException("Operasi pemulihan dibatalkan.", "AbortError");
        }

        const tableName = validated.tableOrder[i];
        const tableBundle = validated.tables[tableName];
        let rows = tableBundle.rows;

        if (tableName === "smpid_users" && rows.length > 0) {
          rows = preserveSuperAdminsInUsersRows(rows, superAdminContext);
        }

        if (rows.length === 0) {
          reportProgress(
            onProgress,
            statusContainer,
            logBuffer,
            "info",
            `Melangkau jadual kosong [${i + 1}/${validated.tableOrder.length}]: ${tableName} (0 rekod).`,
            { table: tableName, step: i + 1, total: validated.tableOrder.length }
          );
          continue;
        }

        reportProgress(
          onProgress,
          statusContainer,
          logBuffer,
          "info",
          `Memulihkan jadual [${i + 1}/${validated.tableOrder.length}]: ${tableName} (${rows.length} rekod)...`,
          { table: tableName, step: i + 1, total: validated.tableOrder.length }
        );

        const conflictTarget = resolveConflictTarget(tableBundle.schema, rows[0]);

        for (let start = 0; start < rows.length; start += UPSERT_BATCH_SIZE) {
          if (controller.signal.aborted) {
            throw new DOMException("Operasi pemulihan dibatalkan.", "AbortError");
          }

          const batch = rows.slice(start, start + UPSERT_BATCH_SIZE);
          await upsertTableBatchWithFallback(
            client,
            tableName,
            batch,
            conflictTarget,
            superAdminContext.callerIdentifier,
            controller.signal
          );
        }

        totalRestoredRows += rows.length;
      }

      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "info",
        `Menyelaraskan jujukan ID dalam skema ${activeSchema} (setval)...`
      );

      const seqResult = await runWithTimeout(
        client.rpc(SEQUENCE_RESET_RPC, {
          p_tables: validated.tableOrder,
          p_admin_email: superAdminContext.callerIdentifier || null
        }),
        15000,
        { error: null }
      );

      if (seqResult && seqResult.error) {
        throw new Error(`Pemulihan baris selesai tetapi penyelarasan jujukan gagal: ${seqResult.error.message}`);
      }

      if (IDBCache && typeof IDBCache.clearAll === "function") {
        await runWithTimeout(IDBCache.clearAll(), 3000, false);
      }

      if (RealtimeManager && typeof RealtimeManager.syncNow === "function") {
        await runWithTimeout(RealtimeManager.syncNow(), 3000, null);
      }

      if (typeof options.onCompleted === "function") {
        await runWithTimeout(
          Promise.resolve().then(() =>
            options.onCompleted({
              tableOrder: validated.tableOrder,
              totalRows: totalRestoredRows
            })
          ),
          4000,
          null
        );
      }

      reportProgress(
        onProgress,
        statusContainer,
        logBuffer,
        "success",
        `Pemulihan 1-ke-1 berjaya ke skema ${activeSchema}: ${validated.tableOrder.length} jadual (${totalRestoredRows} rekod) dipulihkan dan jujukan diselaraskan.`,
        { step: validated.tableOrder.length, total: validated.tableOrder.length }
      );

      return {
        tableCount: validated.tableOrder.length,
        totalRows: totalRestoredRows,
        tableOrder: validated.tableOrder
      };
    } catch (error) {
      const msg =
        error && error.name === "AbortError"
          ? "Pemulihan data dibatalkan oleh pengguna."
          : error && error.message
            ? error.message
            : "Ralat tidak diketahui semasa pemulihan data.";
      reportProgress(onProgress, statusContainer, logBuffer, "error", msg);
      throw new Error(msg);
    } finally {
      operationInProgress = false;
      activeMigrationController = null;
    }
  }
};

function bindAdminBackupUiHelpers() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  window.MigrationManager = MigrationManager;

  const getLogUiElements = () => {
    const logContainer = document.getElementById("importLogContainer");
    const progressBar = document.getElementById("importProgressBar");
    const progressText = document.getElementById("importProgressText");
    const terminalInner = document.getElementById("importTerminalInner");

    if (logContainer) {
      logContainer.classList.remove("hidden");
    }

    return {
      terminalInner,
      onProgress: (entry) => {
        if (
          typeof entry.step === "number" &&
          typeof entry.total === "number" &&
          entry.total > 0
        ) {
          const pct = Math.min(100, Math.round((entry.step / entry.total) * 100));
          if (progressBar) {
            progressBar.style.width = `${pct}%`;
          }
          if (progressText) {
            progressText.textContent = `${entry.step} / ${entry.total} Jadual`;
          }
        }
      }
    };
  };

  if (typeof window.muatTurunBackupKeseluruhan !== "function") {
    window.muatTurunBackupKeseluruhan = async function () {
      const { terminalInner, onProgress } = getLogUiElements();
      try {
        await MigrationManager.exportBackupJson({
          statusContainer: terminalInner,
          onProgress
        });
      } catch (err) {
        if (window.Swal && typeof window.Swal.fire === "function") {
          window.Swal.fire({
            icon: "error",
            title: "Gagal Eksport Sandaran",
            text: err && err.message ? err.message : "Ralat tidak diketahui."
          });
        }
      }
    };
  }

  if (typeof window.mulaRestoreKeseluruhan !== "function") {
    window.mulaRestoreKeseluruhan = async function () {
      const fileInput = document.getElementById("jsonBackupInput");
      const restoreBtn = document.getElementById("btnMulaRestore");
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;

      if (!file) {
        if (window.Swal && typeof window.Swal.fire === "function") {
          window.Swal.fire({
            icon: "warning",
            title: "Fail Tiada",
            text: "Sila pilih fail sandaran .json terlebih dahulu."
          });
        }
        return;
      }

      if (restoreBtn) {
        restoreBtn.disabled = true;
      }

      const { terminalInner, onProgress } = getLogUiElements();

      try {
        const summary = await MigrationManager.importBackupJson(file, {
          statusContainer: terminalInner,
          onProgress,
          onCompleted: async () => {
            if (typeof window.fetchDashboardData === "function") {
              await window.fetchDashboardData();
            }
          }
        });

        if (fileInput) {
          fileInput.value = "";
        }

        if (window.Swal && typeof window.Swal.fire === "function") {
          window.Swal.fire({
            icon: "success",
            title: "Pemulihan Selesai",
            text: `${summary.tableCount} jadual (${summary.totalRows} rekod) telah dipulihkan.`
          });
        }
      } catch (err) {
        if (window.Swal && typeof window.Swal.fire === "function") {
          window.Swal.fire({
            icon: "error",
            title: "Gagal Memulihkan Data",
            text: err && err.message ? err.message : "Ralat tidak diketahui."
          });
        }
      } finally {
        if (restoreBtn) {
          restoreBtn.disabled = false;
        }
      }
    };
  }
}

bindAdminBackupUiHelpers();

export default MigrationManager;