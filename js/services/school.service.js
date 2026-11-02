/**
 * @file js/services/school.service.js
 * @description SCHOOL SERVICE (V3.4 - RESILIENT SWR & IDB OBJECT STORE EDITION)
 * Menguruskan data profil sekolah, penarafan, maklumat pengurusan, dan spesifikasi Smart Board.
 * Memanfaatkan storan berasingan IndexedDB (schools_cache) dengan corak Stale-While-Revalidate (SWR)
 * bagi memastikan pemuatan serta-merta tanpa pembekuan pelayar.
 * @module SchoolService
 */

import { requireDb } from '../core/db.js';
import { cleanPhone } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';
import { IDBCache } from '../core/idb.js';

const SCHOOL_STORE = (APP_CONFIG && APP_CONFIG.IDB && APP_CONFIG.IDB.STORES && APP_CONFIG.IDB.STORES.SCHOOLS)
    ? APP_CONFIG.IDB.STORES.SCHOOLS
    : 'schools_cache';

export const SchoolService = {
    /**
     * Dapatkan senarai ringan (kod, nama, jenis, daerah) khusus untuk carian pantas & datalist landing page.
     * Mengurangkan saiz muatan rangkaian (payload) sehingga 90% berbanding getAll().
     */
    async getLightweightList() {
        const cacheKey = IDBCache.generateSecureKey('school_data_LIGHT', true);

        const fetchFactory = async () => {
            const db = requireDb();
            const { data, error } = await db
                .from('smpid_sekolah_data')
                .select('kod_sekolah, nama_sekolah, jenis_sekolah, daerah')
                .order('kod_sekolah', { ascending: true });

            if (error) throw error;
            return data || [];
        };

        const onRevalidated = (freshData) => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('nadim:schools-light-updated', { detail: freshData }));
            }
        };

        // Menggunakan SWR dengan tempoh hayat cache 120 minit pada store khusus sekolah
        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, onRevalidated, 120, SCHOOL_STORE);
    },

    /**
     * Dapatkan semua data sekolah terperinci menggunakan Stale-While-Revalidate (SWR)
     */
    async getAll() {
        // Data ini dikongsi oleh semua admin, jadi gunakan kunci GLOBAL
        const cacheKey = IDBCache.generateSecureKey('school_data_ALL', true);
        
        const fetchFactory = async () => {
            const db = requireDb();
            const { data, error } = await db
                .from('smpid_sekolah_data')
                .select('*')
                .order('kod_sekolah', { ascending: true });

            if (error) throw error;

            return (data || []).map(item => {
                const requiredFields = [
                    item.nama_gpict, item.no_telefon_gpict, item.emel_delima_gpict,
                    item.nama_admin_delima, item.no_telefon_admin_delima, item.emel_delima_admin_delima
                ];
                
                const isDataComplete = requiredFields.every(f => f && String(f).trim() !== "");
                const telG = cleanPhone(item.no_telefon_gpict);
                const telA = cleanPhone(item.no_telefon_admin_delima);
                const isSama = Boolean(telG && telA && telG === telA);

                return {
                    ...item,
                    jenis: item.jenis_sekolah || 'LAIN-LAIN',
                    is_lengkap: isDataComplete,
                    is_sama: isSama,
                    is_berbeza: Boolean(telG && telA && !isSama)
                };
            });
        };

        const onRevalidated = (freshData) => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('nadim:schools-updated', { detail: freshData }));
            }
        };

        // Guna SWR: Kembalikan cache segera jika ada, dan kemas kini senyap di latar belakang. TTL: 60 minit.
        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, onRevalidated, 60, SCHOOL_STORE);
    },

    /**
     * Tarik data profil satu sekolah menggunakan SWR
     */
    async getByCode(kodSekolah) {
        if (!kodSekolah) return null;

        const cacheKey = IDBCache.generateSecureKey(`school_profile_${kodSekolah}`, true);

        const fetchFactory = async () => {
            const db = requireDb();
            const { data, error } = await db
                .from('smpid_sekolah_data')
                .select('*')
                .eq('kod_sekolah', kodSekolah)
                .single();

            if (error) throw error;
            return data;
        };

        const onRevalidated = (freshData) => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(`nadim:school-${kodSekolah}-updated`, { detail: freshData }));
            }
        };

        // Guna SWR dengan TTL 30 minit pada store khusus sekolah
        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, onRevalidated, 30, SCHOOL_STORE);
    },

    /**
     * Kemaskini profil sekolah & hantar notifikasi
     */
    async updateProfile(kodSekolah, payload) {
        if (!kodSekolah) throw new Error("Kod sekolah diperlukan untuk mengemas kini profil.");

        const db = requireDb();
        
        // 1. Kemaskini Pangkalan Data Upstream
        const { error } = await db
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;

        // 2. Pembersihan Cache Bersasar (Surgical Invalidate)
        await IDBCache.invalidateByPrefix('GLOBAL_school_data_ALL', SCHOOL_STORE);
        await IDBCache.invalidateByPrefix('GLOBAL_school_data_LIGHT', SCHOOL_STORE);
        await IDBCache.invalidateByPrefix(`GLOBAL_school_profile_${kodSekolah}`, SCHOOL_STORE);

        // 3. Penghantaran Notifikasi ke Deno API (Secara Optimistik)
        if (APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.DENO_URL) {
            try {
                const authFlagKey = (APP_CONFIG.SESSION && APP_CONFIG.SESSION.AUTH_FLAG) ? APP_CONFIG.SESSION.AUTH_FLAG : 'smpid_auth';
                const sessionAuth = localStorage.getItem(authFlagKey) === 'true';
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
            } catch (notifyErr) {
                console.warn("[SchoolService] Ralat penghantaran notifikasi:", notifyErr);
            }
        }

        return { success: true };
    },

    /**
     * Padam data (Reset Data Pegawai Meja Sekolah)
     */
    async resetData(kodSekolah) {
        if (!kodSekolah) throw new Error("Kod sekolah diperlukan untuk menetapkan semula data.");

        const db = requireDb();
        const payload = {
            nama_gpict: null, 
            no_telefon_gpict: null, 
            emel_delima_gpict: null, 
            telegram_id_gpict: null,
            nama_admin_delima: null, 
            no_telefon_admin_delima: null, 
            emel_delima_admin_delima: null, 
            telegram_id_admin: null
        };
        
        const { error } = await db
            .from('smpid_sekolah_data')
            .update(payload)
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;

        // Pembersihan Cache Bersasar
        await IDBCache.invalidateByPrefix('GLOBAL_school_data_ALL', SCHOOL_STORE);
        await IDBCache.invalidateByPrefix('GLOBAL_school_data_LIGHT', SCHOOL_STORE);
        await IDBCache.invalidateByPrefix(`GLOBAL_school_profile_${kodSekolah}`, SCHOOL_STORE);

        return { success: true };
    }
};