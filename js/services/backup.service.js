import { MigrationManager } from "../core/migration.js";
import { APP_CONFIG } from "../config/app.config.js";

function normalizeToJsonFile(input) {
  if (typeof File !== "undefined" && input instanceof File) {
    return input;
  }

  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return new File([input], "nadim_restore.json", { type: "application/json" });
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Format fail sandaran tidak sah. Sila muat naik fail .json yang sah.");
  }

  let normalizedDoc = input;

  if (!input.metadata && !input.tables && input.data && typeof input.data === "object") {
    const legacyTableNames = Object.keys(input.data);
    const tablesMap = {};

    for (let i = 0; i < legacyTableNames.length; i += 1) {
      const tableName = legacyTableNames[i];
      const rows = Array.isArray(input.data[tableName]) ? input.data[tableName] : [];
      const firstRow = rows.length > 0 && rows[0] && typeof rows[0] === "object" ? rows[0] : {};
      const inferredCols = Object.keys(firstRow);
      const pk = inferredCols.includes("kod_sekolah")
        ? "kod_sekolah"
        : inferredCols.includes("role")
          ? "role"
          : "id";

      tablesMap[tableName] = {
        table_name: tableName,
        primary_key: pk,
        headers: inferredCols.length > 0 ? [pk] : [],
        optional_headers: inferredCols.filter((col) => col !== pk),
        rows
      };
    }

    normalizedDoc = {
      metadata: {
        app: "nadim",
        schema_version: typeof input.version === "string" ? input.version : APP_CONFIG.APP_VERSION,
        exported_at: typeof input.timestamp === "string" ? input.timestamp : new Date().toISOString(),
        table_order: legacyTableNames
      },
      tables: tablesMap
    };
  }

  const serialized = JSON.stringify(normalizedDoc);
  return new File([serialized], "nadim_restore.json", { type: "application/json" });
}

export const BackupService = {
  isBusy() {
    return MigrationManager.isBusy();
  },

  cancelActiveOperation() {
    MigrationManager.cancelActiveOperation();
  },

  async exportBackupJson(options = {}) {
    return MigrationManager.exportBackupJson(options);
  },

  async importBackupJson(file, options = {}) {
    return MigrationManager.importBackupJson(file, options);
  },

  async exportAllData(options = {}) {
    const result = await MigrationManager.exportBackupJson(options);
    return result.document;
  },

  async restoreAllData(backupInput, options = {}) {
    const jsonFile = normalizeToJsonFile(backupInput);
    const result = await MigrationManager.importBackupJson(jsonFile, options);
    const summaryMessages = result.tableOrder.map(
      (tableName) => `Jadual ${tableName} berjaya dipulihkan.`
    );

    return {
      success: summaryMessages,
      errors: [],
      tableCount: result.tableCount,
      totalRows: result.totalRows,
      tableOrder: result.tableOrder
    };
  }
};

if (typeof window !== "undefined") {
  window.BackupService = BackupService;
}