/**
 * SCHOOL SERVICE (V3.0 - SWR & RBAC CACHE EDITION)
 * Menguruskan data profil sekolah dan dashboard.
 * Kemaskini: 
 * 1. Menggunakan Stale-While-Revalidate (SWR) untuk pemuatan UI pantas dan penyegaran latar belakang.
 * 2. Menggunakan penjanaan kunci cache (RBAC Key) dari IDBCache.
 * 3. Cache individu (getByCode) diaktifkan bagi mempercepatkan pembukaan profil.
 */

import { requireDb } from '../core/db.js';
import { cleanPhone } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';
import { IDBCache } from '../core/idb.js';

export const SchoolService = {
    /**
     * Dapatkan semua data sekolah menggunakan Stale-While-Revalidate (SWR)
     */
    async getAll() {
        // Data ini dikongsi oleh semua admin, jadi gunakan kunci GLOBAL
        const cacheKey = IDBCache.generateSecureKey('school_data_ALL', true);
        
        const fetchFactory = async () => {
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
        };

        // Guna SWR: Kembalikan cache segera jika ada, dan kemas kini senyap di latar belakang. TTL: 60 minit.
        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    },

    /**
     * Tarik data profil satu sekolah menggunakan SWR
     */
    async getByCode(kodSekolah) {
        // Cache profil spesifik untuk kelajuan pembukaan menu (mengurangkan direct DB query berulang)
        const cacheKey = IDBCache.generateSecureKey(`school_profile_${kodSekolah}`, true);

        const fetchFactory = async () => {
            const db = requireDb(); // Lazy Load
            const { data, error } = await db
                .from('smpid_sekolah_data')
                .select('*')
                .eq('kod_sekolah', kodSekolah)
                .single();

            if (error) throw error;
            return data;
        };

        // Guna SWR dengan TTL yang lebih pendek (30 minit)
        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 30);
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

        // 2. Surgical Invalidate Cache
        // Buang cache senarai penuh dan cache spesifik sekolah ini sahaja
        await IDBCache.invalidateByPrefix('GLOBAL_school_data_ALL');
        await IDBCache.invalidateByPrefix(`GLOBAL_school_profile_${kodSekolah}`);

        // 3. Hantar Notifikasi ke Deno API (Optimistic)
        if (APP_CONFIG.API.DENO_URL) {
            const sessionAuth = localStorage.getItem(APP_CONFIG.SESSION.AUTH_FLAG) === 'true';
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

    /**
     * Padam data (Reset Data Sekolah)
     */
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

        // Surgical Invalidate Cache
        await IDBCache.invalidateByPrefix('GLOBAL_school_data_ALL');
        await IDBCache.invalidateByPrefix(`GLOBAL_school_profile_${kodSekolah}`);

        return { success: true };
    }
};