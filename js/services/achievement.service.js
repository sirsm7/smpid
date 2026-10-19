/**
 * ACHIEVEMENT SERVICE (V2.1 - STRICT CACHE EDITION)
 * Menguruskan rekod pencapaian (kemenjadian), galeri, dan tapisan.
 * Kemaskini: Membuang logik background sync (Stale-While-Revalidate) untuk
 * menjimatkan operasi bacaan (reads) di Supabase. Cache akan dikemaskini 
 * apabila tamat tempoh hayat atau selepas operasi mutasi (Create/Update/Delete).
 */

import { getDatabaseClient } from '../core/db.js';
import { IDBCache } from '../core/idb.js';

const db = getDatabaseClient();

export const AchievementService = {
    /**
     * Dapatkan senarai tahun yang ada dalam database (Strict Cache-First)
     */
    async getAvailableYears() {
        const cacheKey = 'achievement_years';
        const cached = await IDBCache.getCache(cacheKey);

        if (cached) {
            // Panggilan latar belakang (background sync) dihapuskan
            return cached;
        }

        return await this._fetchAvailableYears(cacheKey);
    },

    async _fetchAvailableYears(cacheKey) {
        const { data, error } = await db
            .from('smpid_pencapaian')
            .select('tahun');
            
        if (error) throw error;
        const years = [...new Set(data.map(item => item.tahun))].sort((a, b) => b - a);
        
        await IDBCache.setCache(cacheKey, years, 60);
        return years;
    },

    /**
     * Dapatkan semua pencapaian (Admin Master List - Strict Cache-First)
     * @param {string} tahun - 'ALL' atau tahun spesifik
     */
    async getAll(tahun = 'ALL') {
        const cacheKey = `achievement_all_${tahun}`;
        const cached = await IDBCache.getCache(cacheKey);

        if (cached) {
            // Panggilan latar belakang (background sync) dihapuskan
            return cached;
        }

        return await this._fetchAll(tahun, cacheKey);
    },

    async _fetchAll(tahun, cacheKey) {
        let query = db.from('smpid_pencapaian').select('*');
        
        if (tahun !== 'ALL') {
            query = query.eq('tahun', parseInt(tahun));
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;

        await IDBCache.setCache(cacheKey, data, 60);
        return data;
    },

    /**
     * Dapatkan pencapaian mengikut sekolah (Untuk Portal Sekolah & Galeri)
     */
    async getBySchool(kodSekolah) {
        const cacheKey = `achievement_school_${kodSekolah}`;
        const cached = await IDBCache.getCache(cacheKey);

        if (cached) {
            // Panggilan latar belakang (background sync) dihapuskan
            return cached;
        }

        return await this._fetchBySchool(kodSekolah, cacheKey);
    },

    async _fetchBySchool(kodSekolah, cacheKey) {
        const { data, error } = await db
            .from('smpid_pencapaian')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;

        await IDBCache.setCache(cacheKey, data, 60);
        return data;
    },

    /**
     * Tambah rekod pencapaian baru
     */
    async create(payload) {
        const { error } = await db
            .from('smpid_pencapaian')
            .insert([payload]);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Kemaskini rekod sedia ada
     */
    async update(id, payload) {
        const { error } = await db
            .from('smpid_pencapaian')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        if (payload.kategori === 'GURU' && payload.jawatan && payload.nama_peserta) {
            await this.syncTeacherPosition(payload.nama_peserta, payload.jawatan, id);
        }

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Padam rekod
     */
    async delete(id) {
        const { error } = await db
            .from('smpid_pencapaian')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Padam rekod secara pukal (Bulk Delete)
     */
    async deleteBulk(ids) {
        const { error } = await db
            .from('smpid_pencapaian')
            .delete()
            .in('id', ids);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Fungsi Dalaman: Menyelaraskan jawatan guru merentas semua rekod
     */
    async syncTeacherPosition(namaGuru, jawatanBaru, excludeId) {
        try {
            const { error } = await db
                .from('smpid_pencapaian')
                .update({ jawatan: jawatanBaru })
                .eq('nama_peserta', namaGuru)
                .eq('kategori', 'GURU')
                .neq('id', excludeId); 
            
            if (error) console.warn("[Service] Auto-sync jawatan gagal:", error);
        } catch (e) {
            console.error("[Service] Ralat sync jawatan:", e);
        }
    },

    /**
     * Kemaskini Pukal Nama Program (Standardization)
     */
    async batchUpdateProgramName(oldName, newName) {
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ nama_pertandingan: newName })
            .eq('nama_pertandingan', oldName);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Kemaskini Pukal Skor / Pencapaian (Standardization)
     */
    async batchUpdateSkor(oldSkor, newSkor) {
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ pencapaian: newSkor })
            .eq('pencapaian', oldSkor);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Kemaskini Penyedia (Provider) secara Pukal berdasarkan IDs
     */
    async batchUpdatePenyedia(ids, newPenyedia) {
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ penyedia: newPenyedia })
            .in('id', ids);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    },

    /**
     * Kemaskini Kategori secara Pukal berdasarkan IDs
     */
    async batchUpdateKategori(ids, newKategori) {
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ kategori: newKategori })
            .in('id', ids);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('achievement_');
        return { success: true };
    }
};