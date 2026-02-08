/**
 * DCS DATA SERVICE
 * Menguruskan data DCS, DELIMa, dan statistik digital.
 * (Dijenamakan semula dari analytics.service.js untuk elak sekatan adblocker)
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const DcsService = {
    /**
     * Dapatkan data analisa mengikut sekolah
     */
    async getBySchool(kodSekolah) {
        const { data, error } = await db
            .from('smpid_dcs_analisa')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Dapatkan semua data analisa (Admin Dashboard)
     */
    async getAll() {
        const { data, error } = await db
            .from('smpid_dcs_analisa')
            .select('*')
            .order('nama_sekolah');

        if (error) throw error;
        return data;
    },

    /**
     * Kemaskini data analisa (Admin)
     */
    async update(kodSekolah, payload) {
        const { error } = await db
            .from('smpid_dcs_analisa')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    }
};