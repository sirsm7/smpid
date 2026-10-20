/**
 * ACHIEVEMENT SERVICE (V3.0 - SWR & RBAC CACHE EDITION)
 * Menguruskan rekod pencapaian (kemenjadian), galeri, dan tapisan.
 * Kemaskini: 
 * 1. Menggunakan Stale-While-Revalidate (SWR) untuk pemuatan UI pantas.
 * 2. Menggunakan penjanaan kunci cache pintar (RBAC Key) dari IDBCache.
 * 3. Pembersihan cache (invalidasi) dilakukan secara bersasar tanpa mengganggu cache yang tidak berkaitan.
 */

import { getDatabaseClient } from '../core/db.js';
import { IDBCache } from '../core/idb.js';

export const AchievementService = {
    /**
     * Dapatkan senarai tahun yang ada dalam database.
     * Menggunakan SWR kerana ia dipaparkan pada Admin dan Awam.
     */
    async getAvailableYears() {
        const cacheKey = IDBCache.generateSecureKey('achievement_years', true);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            const { data, error } = await db
                .from('smpid_pencapaian')
                .select('tahun');
                
            if (error) throw error;
            return [...new Set(data.map(item => item.tahun))].sort((a, b) => b - a);
        };

        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    },

    /**
     * Dapatkan semua pencapaian (Admin Master List)
     * Menggunakan SWR dengan kunci berasaskan identiti supaya data antara admin tidak bercampur.
     */
    async getAll(tahun = 'ALL') {
        const cacheKey = IDBCache.generateSecureKey(`achievement_all_${tahun}`, false);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            let query = db.from('smpid_pencapaian').select('*');
            
            if (tahun !== 'ALL') {
                query = query.eq('tahun', parseInt(tahun));
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            return data;
        };

        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    },

    /**
     * Dapatkan pencapaian mengikut sekolah (Untuk Portal Sekolah & Galeri)
     * Kunci ini dianggap global untuk sekolah terbabit, supaya Galeri (Awam) dan Portal Sekolah kongsi cache.
     */
    async getBySchool(kodSekolah) {
        const cacheKey = IDBCache.generateSecureKey(`achievement_school_${kodSekolah}`, true);

        const fetchFactory = async () => {
            const db = getDatabaseClient();
            const { data, error } = await db
                .from('smpid_pencapaian')
                .select('*')
                .eq('kod_sekolah', kodSekolah)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        };

        return await IDBCache.staleWhileRevalidate(cacheKey, fetchFactory, null, 60);
    },

    /**
     * Fungsi Bantuan: Invalidasi Bersasar (Surgical Invalidation)
     * Hanya memadam cache senarai penuh admin dan senarai profil sekolah yang terlibat.
     * Tidak memadam cache `achievement_years` melainkan perlu (untuk jimat query).
     */
    async _invalidateTargetedCache(kodSekolah = null) {
        // Padam semua cache 'achievement_all' untuk semua jenis role/tahun (sebab senarai admin merangkumi semua)
        await IDBCache.invalidateByPrefix('achievement_all_'); 
        
        if (kodSekolah) {
            // Padam cache spesifik untuk sekolah tersebut (bagi galeri dan profil pengguna sekolah)
            await IDBCache.invalidateByPrefix(`GLOBAL_achievement_school_${kodSekolah}`);
        }
        
        // Padam cache senarai tahun sekiranya ada tahun baharu (Boleh diperhalusi kelak, tapi untuk selamat kita invalidate)
        await IDBCache.invalidateByPrefix('GLOBAL_achievement_years');
    },

    /**
     * Tambah rekod pencapaian baru
     */
    async create(payload) {
        const db = getDatabaseClient();
        const { error } = await db
            .from('smpid_pencapaian')
            .insert([payload]);

        if (error) throw error;

        await this._invalidateTargetedCache(payload.kod_sekolah);
        return { success: true };
    },

    /**
     * Kemaskini rekod sedia ada
     */
    async update(id, payload) {
        const db = getDatabaseClient();
        
        // Perlu tahu kod sekolah rekod ini untuk invalidasi bersasar
        const { data: record } = await db.from('smpid_pencapaian').select('kod_sekolah').eq('id', id).single();
        
        const { error } = await db
            .from('smpid_pencapaian')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        if (payload.kategori === 'GURU' && payload.jawatan && payload.nama_peserta) {
            await this.syncTeacherPosition(payload.nama_peserta, payload.jawatan, id);
        }

        await this._invalidateTargetedCache(record ? record.kod_sekolah : null);
        return { success: true };
    },

    /**
     * Padam rekod
     */
    async delete(id) {
        const db = getDatabaseClient();
        
        // Perlu tahu kod sekolah rekod ini untuk invalidasi bersasar
        const { data: record } = await db.from('smpid_pencapaian').select('kod_sekolah').eq('id', id).single();

        const { error } = await db
            .from('smpid_pencapaian')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await this._invalidateTargetedCache(record ? record.kod_sekolah : null);
        return { success: true };
    },

    /**
     * Padam rekod secara pukal (Bulk Delete)
     */
    async deleteBulk(ids) {
        const db = getDatabaseClient();
        
        // Ambil senarai sekolah yang terjejas untuk invalidasi
        const { data: records } = await db.from('smpid_pencapaian').select('kod_sekolah').in('id', ids);

        const { error } = await db
            .from('smpid_pencapaian')
            .delete()
            .in('id', ids);

        if (error) throw error;

        // Invalidate senarai penuh admin
        await IDBCache.invalidateByPrefix('achievement_all_'); 
        
        // Invalidate setiap sekolah yang terjejas
        if (records) {
            const uniqueSchools = [...new Set(records.map(r => r.kod_sekolah))];
            for (const kod of uniqueSchools) {
                await IDBCache.invalidateByPrefix(`GLOBAL_achievement_school_${kod}`);
            }
        }

        return { success: true };
    },

    /**
     * Fungsi Dalaman: Menyelaraskan jawatan guru merentas semua rekod
     */
    async syncTeacherPosition(namaGuru, jawatanBaru, excludeId) {
        try {
            const db = getDatabaseClient();
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
     * Kemaskini Pukal Nama Program & Skor Serentak (Standardization Komposit)
     */
    async batchUpdateStandardize(oldProg, oldSkor, newProg, newSkor) {
        const db = getDatabaseClient();
        
        // Kerana operasi pukal mungkin menyentuh pelbagai sekolah, kita invalidate secara umum
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ nama_pertandingan: newProg, pencapaian: newSkor })
            .eq('nama_pertandingan', oldProg)
            .eq('pencapaian', oldSkor);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('GLOBAL_achievement_school_');
        await IDBCache.invalidateByPrefix('achievement_all_');
        return { success: true };
    },

    /**
     * Kemaskini Penyedia (Provider) secara Pukal berdasarkan IDs
     */
    async batchUpdatePenyedia(ids, newPenyedia) {
        const db = getDatabaseClient();
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ penyedia: newPenyedia })
            .in('id', ids);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('GLOBAL_achievement_school_');
        await IDBCache.invalidateByPrefix('achievement_all_');
        return { success: true };
    },

    /**
     * Kemaskini Kategori secara Pukal berdasarkan IDs
     */
    async batchUpdateKategori(ids, newKategori) {
        const db = getDatabaseClient();
        const { error } = await db
            .from('smpid_pencapaian')
            .update({ kategori: newKategori })
            .in('id', ids);

        if (error) throw error;

        await IDBCache.invalidateByPrefix('GLOBAL_achievement_school_');
        await IDBCache.invalidateByPrefix('achievement_all_');
        return { success: true };
    }
};