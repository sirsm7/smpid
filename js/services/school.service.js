/**
 * SCHOOL SERVICE (V2.0 - IDB CACHE EDITION)
 * Menguruskan data profil sekolah dan dashboard.
 * Refactored: Lazy DB Loading (Safe against startup crash).
 * Kemaskini: Integrasi IndexedDB Cache untuk menangani saiz data yang besar
 * berpandukan rujukan dari fail "Data Supabase.docx" bagi mengelak UI 'tergantung'.
 */

import { requireDb } from '../core/db.js';
import { cleanPhone } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';
import { IDBCache } from '../core/idb.js';

export const SchoolService = {
    /**
     * Dapatkan semua data sekolah (Corak Cache-First / Stale-While-Revalidate)
     */
    async getAll() {
        const cacheKey = 'school_data_ALL';
        
        // 1. Cuba tarik dari cache (IndexedDB)
        const cachedData = await IDBCache.getCache(cacheKey);

        if (cachedData) {
            // 2. Jika cache wujud, pulangkan terus kepada UI supaya laman dimuatkan tanpa lengah.
            // Di latar belakang (background), semak Supabase untuk kemas kini cache sesi seterusnya.
            this._fetchAndCacheAll(cacheKey).catch(e => console.warn("[SchoolService] Background sync failed:", e));
            return cachedData;
        }

        // 3. Jika tiada cache (pengguna pertama kali), tunggu panggilan ke Supabase
        return await this._fetchAndCacheAll(cacheKey);
    },

    /**
     * Fungsi dalaman: Tarik dari pangkalan data dan simpan ke Cache
     * @private
     */
    async _fetchAndCacheAll(cacheKey) {
        const db = requireDb(); // Lazy Load
        const { data, error } = await db
            .from('smpid_sekolah_data')
            .select('*')
            .order('kod_sekolah', { ascending: true });

        if (error) throw error;

        const processedData = data.map(item => {
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

        // Simpan ke IndexedDB dengan jangka hayat 60 minit
        await IDBCache.setCache(cacheKey, processedData, 60);

        return processedData;
    },

    /**
     * Tarik data profil satu sekolah (Direct Query)
     */
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

        // 2. Invalidate Cache (Buang cache sekolah utama supaya tarikan seterusnya menggunakan data segar)
        await IDBCache.removeCache('school_data_ALL');

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

        // Invalidate Cache
        await IDBCache.removeCache('school_data_ALL');

        return { success: true };
    }
};