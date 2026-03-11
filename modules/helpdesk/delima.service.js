/**
 * DELIMA STATUS SERVICE
 * Menguruskan rekod perubahan status ID DELIMa (Guru & Murid).
 * Mempunyai fungsi CRUD lengkap untuk portal sekolah dan panel Admin.
 */

import { getDatabaseClient } from '../../js/core/db.js';

const db = getDatabaseClient();

export const DelimaService = {
    /**
     * Tambah rekod status DELIMa baharu (Dipanggil oleh pihak sekolah)
     * @param {Object} payload Butiran borang
     */
    async createStatus(payload) {
        const { error } = await db
            .from('smpid_delima_status')
            .insert([payload]);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Dapatkan senarai rekod mengikut kod sekolah dan kategori
     * @param {string} kodSekolah Kod sekolah semasa
     * @param {string} kategori 'GURU' atau 'MURID'
     */
    async getBySchool(kodSekolah, kategori) {
        const { data, error } = await db
            .from('smpid_delima_status')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .eq('kategori', kategori)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Dapatkan semua rekod (Untuk paparan Master List Admin PPD)
     * @param {string} kategori 'ALL', 'GURU', atau 'MURID'
     * @param {string} statusFilter 'ALL', 'DALAM PROSES', atau 'SELESAI'
     */
    async getAll(kategori = 'ALL', statusFilter = 'ALL') {
        let query = db.from('smpid_delima_status').select('*').order('created_at', { ascending: false });

        if (kategori !== 'ALL') {
            query = query.eq('kategori', kategori);
        }
        
        if (statusFilter !== 'ALL') {
            query = query.eq('status_proses', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    /**
     * Kemaskini status pemprosesan (Dilaksanakan oleh Admin PPD)
     * @param {number} id ID Rekod
     * @param {string} statusProses 'SELESAI' atau 'DALAM PROSES'
     */
    async updateStatus(id, statusProses) {
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: statusProses })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Padam rekod (Untuk kegunaan Admin PPD jika perlu)
     * @param {number} id ID Rekod
     */
    async deleteStatus(id) {
        const { error } = await db
            .from('smpid_delima_status')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    }
};