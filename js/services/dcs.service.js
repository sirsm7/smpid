/**
 * DCS DATA SERVICE (V3.0 - SWR CACHE EDITION)
 * Menguruskan data DCS, DELIMa, dan statistik digital.
 * Kemaskini: 
 * 1. Menerapkan corak Stale-While-Revalidate (SWR) dari IDBCache.
 * 2. Caching data penuh dan data mengikut sekolah untuk meminimumkan pertanyaan pangkalan data.
 */

import { getDatabaseClient } from '../core/db.js';
import { IDBCache } from '../core/idb.js';

export const DcsService = {
    /**
     * Dapatkan data analisa mengikut sekolah menggunakan SWR
     */
    async getBySchool(kodSekolah) {
        // Cache boleh dikongsi antara admin dan pengguna sekolah untuk kod ini
        const cacheKey = IDBCache.generateSecureKey(`dcs_school_${kodSekolah}`, true);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            const { data, error } = await db
                .from('smpid_dcs_analisa')
                .select('*')
                .eq('kod_sekolah', kodSekolah)
                .single();

            // PGRST116: Tiada baris ditemui (Not found), kita benarkan tanpa melempar ralat
            if (error && error.code !== 'PGRST116') throw error;
            return data || null; 
        };

        // Simpan cache selama 60 minit, UI dapat respons pantas jika cache ada
        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    },

    /**
     * Dapatkan semua data analisa (Admin Dashboard) menggunakan SWR
     */
    async getAll() {
        // Data penuh hanya diakses oleh admin, jana kunci RBAC yang selamat
        const cacheKey = IDBCache.generateSecureKey('dcs_all', false);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            const { data, error } = await db
                .from('smpid_dcs_analisa')
                .select('*')
                .order('nama_sekolah');

            if (error) throw error;
            return data;
        };

        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    },

    /**
     * Kemaskini data analisa (Admin) dan bersihkan cache
     */
    async update(kodSekolah, payload) {
        const db = getDatabaseClient();
        const { error } = await db
            .from('smpid_dcs_analisa')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;

        // Bersihkan cache spesifik dan senarai penuh supaya data baharu ditarik
        await IDBCache.invalidateByPrefix(`GLOBAL_dcs_school_${kodSekolah}`);
        await IDBCache.invalidateByPrefix('dcs_all_');

        return { success: true };
    }
};