/**
 * PENATARAN DIGITAL SERVICE (V2.0 - AUTO-SAVE EDITION)
 * Menguruskan rekod penilaian kendiri sekolah bagi Modul Penataran Sekolah Digital.
 * Dipertingkatkan untuk menyokong operasi penyimpanan auto (Auto-Save) berterusan.
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const PenataranService = {
    /**
     * Menyimpan atau mengemaskini (Upsert) laporan penataran sekolah.
     * Digunakan secara berterusan oleh enjin Auto-Save di latar belakang.
     * @param {Object} payload - Data laporan penataran separa atau penuh (Skor, Peratus, Dimensi)
     */
    async submitReport(payload) {
        // Semak sama ada sekolah ini telah mempunyai deraf/laporan sebelum ini
        const { data: existing } = await db
            .from('smpid_penataran_digital')
            .select('id')
            .eq('kod_sekolah', payload.kod_sekolah)
            .maybeSingle();

        // Suntik masa kemaskini terkini untuk log sistem
        payload.updated_at = new Date().toISOString();

        if (existing) {
            // Lakukan proses Kemaskini (Update) ke atas deraf/rekod sedia ada
            const { error } = await db
                .from('smpid_penataran_digital')
                .update(payload)
                .eq('id', existing.id);
                
            if (error) throw error;
            return { success: true, action: 'UPDATED' };
        } else {
            // Lakukan proses Sisipan Baharu (Insert) untuk kali pertama
            const { error } = await db
                .from('smpid_penataran_digital')
                .insert([payload]);
                
            if (error) throw error;
            return { success: true, action: 'INSERTED' };
        }
    },

    /**
     * Mendapatkan laporan atau deraf terkini sekolah.
     * Digunakan dalam Portal Sekolah untuk memaparkan semula jawapan yang telah disimpan secara auto.
     * @param {string} kodSekolah - Kod sekolah pengguna (Cth: MBA0001)
     */
    async getBySchool(kodSekolah) {
        const { data, error } = await db
            .from('smpid_penataran_digital')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Mendapatkan senarai penuh semua laporan sekolah.
     * Digunakan oleh Admin PPD untuk pemantauan daerah.
     * Disusun mengikut jumlah skor tertinggi secara lalai.
     */
    async getAll() {
        const { data, error } = await db
            .from('smpid_penataran_digital')
            .select('*')
            .order('jumlah_skor', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Memadam rekod penataran bagi sekolah tertentu.
     * Kegunaan eksklusif untuk fungsi 'Reset Data' oleh Admin PPD.
     * @param {string} kodSekolah - Kod sekolah sasaran
     */
    async deleteRecord(kodSekolah) {
        const { error } = await db
            .from('smpid_penataran_digital')
            .delete()
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    }
};