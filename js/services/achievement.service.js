/**
 * ACHIEVEMENT SERVICE
 * Menguruskan rekod pencapaian (kemenjadian), galeri, dan tapisan.
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const AchievementService = {
    /**
     * Dapatkan senarai tahun yang ada dalam database
     */
    async getAvailableYears() {
        const { data, error } = await db
            .from('smpid_pencapaian')
            .select('tahun');
            
        if (error) throw error;
        // Kembalikan tahun unik, susunan menurun
        return [...new Set(data.map(item => item.tahun))].sort((a, b) => b - a);
    },

    /**
     * Dapatkan semua pencapaian (Admin Master List)
     * @param {string} tahun - 'ALL' atau tahun spesifik
     */
    async getAll(tahun = 'ALL') {
        let query = db.from('smpid_pencapaian').select('*');
        
        if (tahun !== 'ALL') {
            query = query.eq('tahun', parseInt(tahun));
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    /**
     * Dapatkan pencapaian mengikut sekolah (Untuk Portal Sekolah & Galeri)
     */
    async getBySchool(kodSekolah) {
        const { data, error } = await db
            .from('smpid_pencapaian')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;
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
        return { success: true };
    },

    /**
     * Kemaskini rekod sedia ada
     */
    async update(id, payload) {
        // 1. Update rekod utama
        const { error } = await db
            .from('smpid_pencapaian')
            .update(payload)
            .eq('id', id);

        if (error) throw error;

        // 2. Logic Khas: Auto-Sync Jawatan Guru
        // Jika nama guru dan jawatan dikemaskini, selaraskan rekod lain untuk guru yang sama
        if (payload.kategori === 'GURU' && payload.jawatan && payload.nama_peserta) {
            await this.syncTeacherPosition(payload.nama_peserta, payload.jawatan, id);
        }

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
                .neq('id', excludeId); // Jangan update rekod yang sedang diedit (sebab dah update)
            
            if (error) console.warn("[Service] Auto-sync jawatan gagal:", error);
        } catch (e) {
            console.error("[Service] Ralat sync jawatan:", e);
        }
    }
};