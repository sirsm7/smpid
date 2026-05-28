/**
 * @file libat_urus.service.js
 * @description Service class handling Supabase and GAS integration for Libat Urus DELIMa module.
 * @module LibatUrusService
 */

import { APP_CONFIG } from '../config/app.config.js';
// ── SURGICAL EDIT START: Membetulkan ralat import dan menggunakan getInstance pattern untuk keselamatan Anti-Crash ──
import { getDatabaseClient } from '../core/db.js';
// ── SURGICAL EDIT END ──

class LibatUrusService {
    constructor() {
        this.tableName = APP_CONFIG.DB_TABLES.LIBAT_URUS;
        this.gasUrl = APP_CONFIG.API.GAS_LIBAT_URUS_URL;
    }

    /**
     * Uploads the One-Page Report file to Google Drive via GAS endpoint
     * @param {File} file - The file object from the input element
     * @returns {Promise<string>} - Returns the shared URL of the uploaded file
     */
    async uploadReportFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                try {
                    const base64Data = reader.result.split(',')[1];
                    const payload = {
                        base64Data: base64Data,
                        mimeType: file.type,
                        fileName: `${Date.now()}_${file.name}`
                    };

                    const response = await fetch(this.gasUrl, {
                        method: 'POST',
                        mode: 'cors',
                        headers: {
                            'Content-Type': 'text/plain;charset=utf-8'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        throw new Error(`GAS upload request failed with status: ${response.status}`);
                    }

                    const result = await response.json();
                    if (result.status === 'success') {
                        resolve(result.url);
                    } else {
                        reject(new Error(result.message || 'Unknown error occurred during GAS upload.'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
        });
    }

    /**
     * Creates a new Libat Urus record in Supabase
     * @param {Object} data - The report payload
     * @param {string} data.kod_sekolah - School code
     * @param {string} data.kategori_sasar - Target category (GURU, MURID, IBU-BAPA)
     * @param {string} data.tarikh_laksana - ISO Date string (YYYY-MM-DD)
     * @param {string} data.tempat - Meeting room link or physical location
     * @param {number} data.jumlah_peserta - Number of participants
     * @param {string} data.pautan_fail - Google Drive sharing URL from uploadReportFile
     * @returns {Promise<Object>} - Inserted record payload
     */
    async createLibatUrus(data) {
        // Auto generate month name in Malay based on tarikh_laksana
        const dateObj = new Date(data.tarikh_laksana);
        const monthsInMalay = [
            'JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN',
            'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'
        ];
        const bulan = monthsInMalay[dateObj.getMonth()];

// ── SURGICAL EDIT START: Memastikan mod_pelaksanaan dimasukkan ke dalam payload pangkalan data ──
        const payload = {
            kod_sekolah: data.kod_sekolah,
            kategori_sasar: data.kategori_sasar,
            tarikh_laksana: data.tarikh_laksana,
            bulan: bulan,
            tempat: data.tempat,
            jumlah_peserta: parseInt(data.jumlah_peserta, 10),
            pautan_fail: data.pautan_fail,
            mod_pelaksanaan: data.mod_pelaksanaan
        };
// ── SURGICAL EDIT END ──

// ── SURGICAL EDIT START: Menggunakan db instance yang sah dan memeriksa sambungan ──
        const db = getDatabaseClient();
        if (!db) throw new Error("Sambungan pangkalan data disekat. Sila matikan pelanjutan AdBlocker atau Brave Shields anda.");

        const { data: insertedData, error } = await db
            .from(this.tableName)
            .insert([payload])
            .select();
// ── SURGICAL EDIT END ──

        if (error) {
            console.error('Error inserting Libat Urus record:', error);
            throw new Error(error.message);
        }

        return insertedData[0];
    }

    /**
     * Retrieves all Libat Urus records for JPN/Super Admin view with Optional District filters
     * Joined with school details to aggregate school name, district, and user roles.
     * @param {string} [daerahFilter] - Optional filter by district name
     * @returns {Promise<Array>} - List of records with joined details
     */
    async getAllReports(daerahFilter = null) {
// ── SURGICAL EDIT START: Melaksanakan In-Memory Join bagi mengelakkan ralat Foreign Key Supabase ──
        const db = getDatabaseClient();
        if (!db) throw new Error("Sambungan pangkalan data disekat. Sila matikan pelanjutan AdBlocker atau Brave Shields anda.");

        // 1. Ambil data Libat Urus secara bebas tanpa rantaian
        const { data: libatUrusData, error: libatUrusError } = await db
            .from(this.tableName)
            .select('*')
            .order('tarikh_laksana', { ascending: false });

        if (libatUrusError) {
            console.error('Error fetching all Libat Urus reports:', libatUrusError);
            throw new Error(libatUrusError.message);
        }

        // 2. Ambil data rujukan sekolah untuk cantuman
        // ── SURGICAL EDIT START: Menetapkan nama jadual sebenar 'smpid_sekolah_data' ──
        const { data: schoolData, error: schoolError } = await db
            .from('smpid_sekolah_data')
            .select('kod_sekolah, nama_sekolah, daerah');
        // ── SURGICAL EDIT END ──

        if (schoolError) {
            console.error('Error fetching schools data for mapping:', schoolError);
            throw new Error(schoolError.message);
        }

        // 3. Bina pemetaan berindeks (Hash Map) untuk carian pantas O(1)
        const schoolMap = {};
        if (schoolData) {
            schoolData.forEach(s => {
                schoolMap[s.kod_sekolah] = { nama_sekolah: s.nama_sekolah, daerah: s.daerah };
            });
        }

        // 4. Cantumkan secara In-Memory
        const mappedData = libatUrusData.map(item => ({
            ...item,
            school: schoolMap[item.kod_sekolah] || null
        }));

        // 5. Post-filter by district if specified
        if (daerahFilter) {
            const normalizedDaerah = daerahFilter.trim().toUpperCase();
            return mappedData.filter(item => 
                item.school && item.school.daerah && item.school.daerah.toUpperCase() === normalizedDaerah
            );
        }

        return mappedData;
// ── SURGICAL EDIT END ──
    }

    /**
     * Retrieves Libat Urus records submitted by a specific school
     * @param {string} kodSekolah - School code
     * @returns {Promise<Array>}
     */
    async getReportsBySchool(kodSekolah) {
// ── SURGICAL EDIT START: Melaksanakan In-Memory Join bagi mengelakkan ralat Foreign Key Supabase ──
        const db = getDatabaseClient();
        if (!db) throw new Error("Sambungan pangkalan data disekat. Sila matikan pelanjutan AdBlocker atau Brave Shields anda.");

        // 1. Ambil data Libat Urus untuk sekolah tertentu tanpa rantaian
        const { data: libatUrusData, error: libatUrusError } = await db
            .from(this.tableName)
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('tarikh_laksana', { ascending: false });

        if (libatUrusError) {
            console.error(`Error fetching reports for school ${kodSekolah}:`, libatUrusError);
            throw new Error(libatUrusError.message);
        }

        // 2. Ambil data spesifik nama dan daerah sekolah tersebut
        // ── SURGICAL EDIT START: Menetapkan nama jadual sebenar 'smpid_sekolah_data' ──
        const { data: schoolData, error: schoolError } = await db
            .from('smpid_sekolah_data')
            .select('nama_sekolah, daerah')
            .eq('kod_sekolah', kodSekolah)
            .single();
        // ── SURGICAL EDIT END ──

        // 3. Jika ralat (cth: kod sekolah tiada), biar nilai schoolObj menjadi null untuk mengelak crash
        const schoolObj = (!schoolError && schoolData) ? schoolData : null;

        // 4. Cantum dan kembalikan tatasusunan data
        return libatUrusData.map(item => ({
            ...item,
            school: schoolObj
        }));
// ── SURGICAL EDIT END ──
    }

    /**
     * Delete a specific Libat Urus report record
     * @param {number} id - Record ID
     * @returns {Promise<boolean>}
     */
    async deleteReport(id) {
// ── SURGICAL EDIT START: Menggunakan db instance yang sah dan memeriksa sambungan ──
        const db = getDatabaseClient();
        if (!db) throw new Error("Sambungan pangkalan data disekat. Sila matikan pelanjutan AdBlocker atau Brave Shields anda.");

        const { error } = await db
            .from(this.tableName)
// ── SURGICAL EDIT END ──
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error deleting report with ID ${id}:`, error);
            throw new Error(error.message);
        }

        return true;
    }
}

export const libatUrusService = new LibatUrusService();