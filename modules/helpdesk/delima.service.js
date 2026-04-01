/**
 * DELIMA STATUS SERVICE
 * Menguruskan rekod perubahan status ID DELIMa (Guru & Murid).
 * Dipertingkat untuk menyokong sisipan pukal (Bulk Insert).
 */

import { getDatabaseClient } from '../../js/core/db.js';
import { APP_CONFIG } from '../../js/config/app.config.js';

const db = getDatabaseClient();

export const DelimaService = {
    /**
     * Tambah rekod status DELIMa secara berkelompok
     * @param {Array} dbPayloads Senarai objek untuk disisip ke DB
     * @param {Object} webhookPayload Objek untuk dihantar ke Telegram
     */
    async createStatusBulk(dbPayloads, webhookPayload) {
        const { error } = await db
            .from('smpid_delima_status')
            .insert(dbPayloads);

        if (error) throw error;

        if (APP_CONFIG.API.DENO_URL) {
            fetch(`${APP_CONFIG.API.DENO_URL}/notify-delima`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            }).catch(e => console.warn("[DelimaService] Bot offline:", e));
        }

        return { success: true };
    },

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

    async updateStatus(id, statusProses) {
        const { error } = await db
            .from('smpid_delima_status')
            .update({ status_proses: statusProses })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    async deleteStatus(id) {
        const { error } = await db
            .from('smpid_delima_status')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    }
};