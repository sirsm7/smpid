/**
 * SCHOOL SERVICE
 * Menguruskan data profil sekolah dan dashboard.
 * Refactored: Lazy DB Loading (Safe against startup crash).
 */

import { requireDb } from '../core/db.js';
import { cleanPhone } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

export const SchoolService = {
    /**
     * Dapatkan semua data sekolah
     */
    async getAll() {
        const db = requireDb(); // Lazy Load
        const { data, error } = await db
            .from('smpid_sekolah_data')
            .select('*')
            .order('kod_sekolah', { ascending: true });

        if (error) throw error;

        return data.map(item => {
            const requiredFields = [
                item.nama_gpict, item.no_telefon_gpict, item.emel_delima_gpict,
                item.nama_admin_delima, item.no_telefon_admin_delima, item.emel_delima_admin_delima
            ];
            
            const isDataComplete = requiredFields.every(f => f && f.trim() !== "");
            const telG = cleanPhone(item.no_telefon_gpict);
            const telA = cleanPhone(item.no_telefon_admin_delima);
            const isSama = (telG && telA) && (telG === telA);

            return {
                ...item,
                jenis: item.jenis_sekolah || 'LAIN-LAIN',
                is_lengkap: isDataComplete,
                is_sama: isSama,
                is_berbeza: (telG && telA) && !isSama
            };
        });
    },

    async getByCode(kodSekolah) {
        const db = requireDb(); // Lazy Load
        const { data, error } = await db
            .from('smpid_sekolah_data')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Kemaskini profil sekolah & hantar notifikasi
     */
    async updateProfile(kodSekolah, payload) {
        const db = requireDb(); // Lazy Load
        
        // 1. Update Database
        const { error } = await db
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;

        // 2. Hantar Notifikasi ke Deno API (Optimistic)
        if (APP_CONFIG.API.DENO_URL) {
            const sessionAuth = sessionStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
            const updater = sessionAuth ? 'PENTADBIR PPD' : 'PIHAK SEKOLAH';
            const domNama = document.getElementById('dispNamaSekolah')?.innerText || kodSekolah;

            fetch(`${APP_CONFIG.API.DENO_URL}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    kod: kodSekolah, 
                    nama: domNama,
                    updated_by: updater 
                })
            }).catch(err => console.warn("[SchoolService] Bot offline:", err));
        }

        return { success: true };
    },

    async resetData(kodSekolah) {
        const db = requireDb(); // Lazy Load
        const payload = {
            nama_gpict: null, no_telefon_gpict: null, emel_delima_gpict: null, telegram_id_gpict: null,
            nama_admin_delima: null, no_telefon_admin_delima: null, emel_delima_admin_delima: null, telegram_id_admin: null
        };
        
        const { error } = await db
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    }
};