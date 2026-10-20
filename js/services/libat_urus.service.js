/**
 * @file libat_urus.service.js
 * @description Service class handling Supabase and GAS integration for Libat Urus DELIMa module.
 * @module LibatUrusService
 * KEMASKINI V3.0 (SWR CACHE EDITION): 
 * Menerapkan cache IndexedDB Stale-While-Revalidate untuk tarikan data yang berat,
 * meminimumkan pertanyaan pangkalan data yang berulang.
 */

import { APP_CONFIG } from '../config/app.config.js';
import { getDatabaseClient } from '../core/db.js';
import { IDBCache } from '../core/idb.js'; // Disuntik untuk keupayaan SWR Cache

class LibatUrusService {
    constructor() {
        this.tableName = APP_CONFIG.DB_TABLES.LIBAT_URUS;
        this.gasUrl = APP_CONFIG.API.GAS_LIBAT_URUS_URL;
    }

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

    async createLibatUrus(data) {
        const dateObj = new Date(data.tarikh_laksana);
        const monthsInMalay = [
            'JANUARI', 'FEBRUARI', 'MAC', 'APRIL', 'MEI', 'JUN',
            'JULAI', 'OGOS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DISEMBER'
        ];
        const bulan = monthsInMalay[dateObj.getMonth()];

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

        const db = getDatabaseClient();
        if (!db) throw new Error("Sambungan pangkalan data disekat. Sila matikan pelanjutan AdBlocker atau Brave Shields anda.");

        const { data: insertedData, error } = await db
            .from(this.tableName)
            .insert([payload])
            .select();

        if (error) {
            console.error('Error inserting Libat Urus record:', error);
            throw new Error(error.message);
        }

        // Cache Invalidation (Surgical)
        await IDBCache.invalidateByPrefix('GLOBAL_lu_all'); // Buang senarai penuh untuk Admin
        await IDBCache.invalidateByPrefix(`GLOBAL_lu_school_${data.kod_sekolah}`); // Buang senarai sekolah khusus ini

        return insertedData[0];
    }

    /**
     * Mengambil laporan penuh (Admin View) menggunakan SWR Cache
     */
    async getAllReports(daerahFilter = null) {
        // Jana kunci unik, abaikan daerahFilter dari kunci kerana tapisan daerah 
        // dilakukan di atas data penuh (client-side) di fail `libat_urus.js`. 
        // Kita simpan SATU salinan penuh pangkalan data di cache.
        const cacheKey = IDBCache.generateSecureKey('lu_all', true);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            if (!db) throw new Error("Sambungan pangkalan data disekat.");

            // 1. Ambil data Libat Urus
            const { data: libatUrusData, error: libatUrusError } = await db
                .from(this.tableName)
                .select('*')
                .order('tarikh_laksana', { ascending: false });

            if (libatUrusError) throw new Error(libatUrusError.message);

            // 2. Ambil data rujukan sekolah untuk cantuman
            const { data: schoolData, error: schoolError } = await db
                .from('smpid_sekolah_data')
                .select('kod_sekolah, nama_sekolah, daerah');

            if (schoolError) throw new Error(schoolError.message);

            // 3. Bina pemetaan berindeks (Hash Map)
            const schoolMap = {};
            if (schoolData) {
                schoolData.forEach(s => {
                    schoolMap[s.kod_sekolah] = { nama_sekolah: s.nama_sekolah, daerah: s.daerah };
                });
            }

            // 4. Cantumkan secara In-Memory
            return libatUrusData.map(item => ({
                ...item,
                school: schoolMap[item.kod_sekolah] || null
            }));
        };

        // Tunggu data diproses oleh SWR
        const allData = await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);

        // Lakukan post-filter (sekiranya dipanggil dengan daerahFilter) selepas mendapat data
        if (daerahFilter) {
            const normalizedDaerah = daerahFilter.trim().toUpperCase();
            return allData.filter(item => 
                item.school && item.school.daerah && item.school.daerah.toUpperCase() === normalizedDaerah
            );
        }

        return allData;
    }

    /**
     * Mengambil laporan sekolah menggunakan SWR Cache
     */
    async getReportsBySchool(kodSekolah) {
        const cacheKey = IDBCache.generateSecureKey(`lu_school_${kodSekolah}`, true);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            if (!db) throw new Error("Sambungan pangkalan data disekat.");

            const { data: libatUrusData, error: libatUrusError } = await db
                .from(this.tableName)
                .select('*')
                .eq('kod_sekolah', kodSekolah)
                .order('tarikh_laksana', { ascending: false });

            if (libatUrusError) throw new Error(libatUrusError.message);

            const { data: schoolData, error: schoolError } = await db
                .from('smpid_sekolah_data')
                .select('nama_sekolah, daerah')
                .eq('kod_sekolah', kodSekolah)
                .single();

            const schoolObj = (!schoolError && schoolData) ? schoolData : null;

            return libatUrusData.map(item => ({
                ...item,
                school: schoolObj
            }));
        };

        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    }

    async deleteReport(id) {
        const db = getDatabaseClient();
        if (!db) throw new Error("Sambungan pangkalan data disekat.");

        // Sebelum padam, ambil kod sekolah rekod ini untuk invalidasi
        const { data: record } = await db.from(this.tableName).select('kod_sekolah').eq('id', id).single();

        const { error } = await db
            .from(this.tableName)
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`Error deleting report with ID ${id}:`, error);
            throw new Error(error.message);
        }

        // Cache Invalidation (Surgical)
        await IDBCache.invalidateByPrefix('GLOBAL_lu_all'); 
        if (record && record.kod_sekolah) {
            await IDBCache.invalidateByPrefix(`GLOBAL_lu_school_${record.kod_sekolah}`);
        }

        return true;
    }
}

export const libatUrusService = new LibatUrusService();