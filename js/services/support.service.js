/**
 * SUPPORT SERVICE
 * Menguruskan tiket aduan dan helpdesk.
 * Kemaskini: Tambah fungsi update (balas) dan delete.
 */

import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

const db = getDatabaseClient();

export const SupportService = {
    /**
     * Hantar tiket baru
     */
    async createTicket(payload) {
        const { error } = await db
            .from('smpid_aduan')
            .insert([payload]);

        if (error) throw error;

        // Notifikasi ke Telegram
        if (APP_CONFIG.API.DENO_URL) {
            fetch(`${APP_CONFIG.API.DENO_URL}/notify-ticket`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: payload.kod_sekolah, 
                    peranan: payload.peranan_pengirim, 
                    tajuk: payload.tajuk, 
                    mesej: payload.butiran_masalah 
                })
            }).catch(e => console.warn("Bot offline:", e));
        }

        return { success: true };
    },

    /**
     * Kemaskini tiket (Balasan Admin / Status)
     */
    async update(id, payload) {
        const { error } = await db
            .from('smpid_aduan')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        // Jika ini adalah balasan admin (status SELESAI), cuba hantar notifikasi 'reply-ticket'
        if (payload.status === 'SELESAI' && APP_CONFIG.API.DENO_URL) {
            // Kita perlu fetch data tiket asal untuk dapatkan kod & tajuk bagi notifikasi
            // ATAU kita hantar apa yang ada. API Deno perlukan {kod, peranan, tajuk, balasan}
            
            // Fetch ringkas metadata tiket
            const { data: ticket } = await db.from('smpid_aduan').select('kod_sekolah, peranan_pengirim, tajuk').eq('id', id).single();
            
            if (ticket) {
                fetch(`${APP_CONFIG.API.DENO_URL}/reply-ticket`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        kod: ticket.kod_sekolah, 
                        peranan: ticket.peranan_pengirim, 
                        tajuk: ticket.tajuk, 
                        balasan: payload.balasan_admin 
                    })
                }).catch(e => console.warn("[SupportService] Bot reply error:", e));
            }
        }

        return { success: true };
    },

    /**
     * Padam tiket
     */
    async delete(id) {
        const { error } = await db
            .from('smpid_aduan')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    async getBySchool(kodSekolah) {
        const { data, error } = await db
            .from('smpid_aduan')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async getAll(statusFilter = 'ALL') {
        let query = db.from('smpid_aduan').select('*').order('created_at', { ascending: false });
        
        if (statusFilter !== 'ALL') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    }
};