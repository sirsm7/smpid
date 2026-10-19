/**
 * BACKUP & RESTORE SERVICE
 * Menguruskan eksport dan import keseluruhan pangkalan data (JSON).
 * Memastikan kebergantungan jadual (Foreign Keys) terjaga melalui susunan.
 */

import { getDatabaseClient } from '../core/db.js';

// Senarai jadual mengikut urutan kebergantungan (Foreign Keys).
// Jadual rujukan utama mesti di-restore dahulu untuk mengelakkan ralat constraint.
const TABLES = [
    'smpid_sekolah_data',
    'smpid_users',
    'smpid_admin_users',
    'smpid_pencapaian',
    'smpid_aduan',
    'smpid_dcs_analisa',
    'smpid_bb_tempahan',
    'smpid_bb_kunci',
    'smpid_delima_status',
    'smpid_penataran_digital',
    'smpid_libat_urus',
    'smpid_impak_bbm'
];

export const BackupService = {
    /**
     * Menarik keseluruhan data dari semua jadual yang tersenarai.
     * @returns {Promise<Object>} Objek JSON berstruktur.
     */
    async exportAllData() {
        const db = getDatabaseClient();
        if (!db) throw new Error("Tiada sambungan pangkalan data.");

        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {}
        };

        for (const table of TABLES) {
            // Had 100,000 baris untuk memintas had lalai Supabase bagi backup pukal
            const { data, error } = await db.from(table).select('*').limit(100000);
            if (error) {
                console.error(`[BackupService] Gagal mengeksport jadual ${table}:`, error);
                throw new Error(`Ralat menarik jadual ${table}: ${error.message}`);
            }
            backupData.data[table] = data || [];
        }

        return backupData;
    },

    /**
     * Memulihkan data dari fail JSON ke dalam pangkalan data menggunakan upsert.
     * @param {Object} backupJson Objek JSON dari fail yang dimuat naik.
     * @returns {Promise<Object>} Laporan kejayaan dan ralat.
     */
    async restoreAllData(backupJson) {
        const db = getDatabaseClient();
        if (!db) throw new Error("Tiada sambungan pangkalan data.");

        if (!backupJson || !backupJson.data) {
            throw new Error("Format fail backup tidak sah. Sila gunakan fail yang dijanakan oleh sistem ini.");
        }

        const dataToRestore = backupJson.data;
        const logResults = {
            success: [],
            errors: []
        };

        for (const table of TABLES) {
            const tableData = dataToRestore[table];
            
            if (tableData && tableData.length > 0) {
                try {
                    // Pemprosesan secara berkelompok (Chunking) untuk mengelakkan ralat saiz muatan (Payload Too Large)
                    const CHUNK_SIZE = 1000;
                    for (let i = 0; i < tableData.length; i += CHUNK_SIZE) {
                        const chunk = tableData.slice(i, i + CHUNK_SIZE);
                        const { error } = await db.from(table).upsert(chunk);
                        
                        if (error) throw error;
                    }
                    logResults.success.push(`Jadual ${table} - ${tableData.length} rekod dimuatnaik.`);
                } catch (error) {
                    console.error(`[BackupService] Gagal memulihkan jadual ${table}:`, error);
                    logResults.errors.push(`Jadual ${table}: ${error.message}`);
                }
            } else {
                logResults.success.push(`Jadual ${table} - Kosong (Tiada data).`);
            }
        }

        return logResults;
    }
};