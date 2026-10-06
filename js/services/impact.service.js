/**
 * IMPACT SERVICE (MODUL PENILAIAN IMPAK BBM BERBANTUKAN AI)
 * Menguruskan interaksi dengan pangkalan data Supabase untuk
 * menyimpan maklum balas murid dan mendapatkan analitik untuk admin.
 * KEMASKINI: Menambah fungsi `resetSchoolImpactData` untuk kebolehan pemadaman rekod oleh Admin.
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const ImpactService = {
    /**
     * Menghantar maklum balas murid ke pangkalan data melalui RPC.
     * RPC akan menyemak kuota 10 respons sah secara automatik.
     * @param {Object} payload Data soal selidik dari borang awam
     */
    async submitImpact(payload) {
        if (!db) throw new Error("Tiada sambungan pangkalan data.");

        const { data, error } = await db.rpc('check_and_submit_impak_bbm', {
            p_kod_sekolah: payload.kod_sekolah,
            p_jantina: payload.jantina,
            p_kumpulan_umur: payload.kumpulan_umur,
            p_q1: payload.q1_kefahaman,
            p_q2: payload.q2_penguasaan,
            p_q3: payload.q3_ingatan,
            p_q4: payload.q4_minat,
            p_q5: payload.q5_idea,
            p_q6: payload.q6_keyakinan,
            p_q7: payload.q7_persediaan_ujian,
            p_q8: payload.q8_keseluruhan,
            p_q9: payload.q9_penglibatan,
            p_q10: payload.q10_penerangan_guru,
            p_q11: payload.q11_komponen_bbm, // Dihantar sebagai Array (JSONB akan diparse oleh Supabase)
            p_q12: payload.q12_perkara_dipelajari || null, // Kini Data Berstruktur (Bukan Subjektif)
            p_q13: payload.q13_cadangan || null,           // Kini Data Berstruktur Array (JSONB diparse oleh Supabase)
            p_q14: payload.q14_pengesahan_sesi             // Kini Merupakan Mata Pelajaran (Bukan Ya/Tidak)
        });

        if (error) throw error;

        // Urus respon JSON dari fungsi RPC PostgreSQL
        const result = typeof data === 'string' ? JSON.parse(data) : data;

        if (result.status === 'error') {
            throw new Error(result.message || 'Sistem menolak penyertaan.');
        }

        return result;
    },

    /**
     * Menyemak status kuota sekolah semasa.
     * Dipanggil apabila murid membuka pautan sekolah.
     * @param {string} kodSekolah Kod sekolah (Cth: MBA0001)
     */
    async checkSchoolQuota(kodSekolah) {
        if (!db) throw new Error("Tiada sambungan pangkalan data.");

        const { count, error } = await db
            .from('smpid_impak_bbm')
            .select('*', { count: 'exact', head: true })
            .eq('kod_sekolah', kodSekolah)
            .eq('is_valid', true);

        if (error) throw error;

        const totalSah = count || 0;
        return {
            totalSah: totalSah,
            isClosed: totalSah >= 10
        };
    },

    /**
     * Mendapatkan semua data respons.
     * Digunakan oleh Papan Pemuka Admin untuk pelaporan analitik berkelompok.
     */
    async getAllImpactData() {
        if (!db) throw new Error("Tiada sambungan pangkalan data.");

        const { data, error } = await db
            .from('smpid_impak_bbm')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Memadam semua rekod impak bagi sesebuah sekolah.
     * Tindakan ini hanya boleh dilakukan oleh Admin untuk mereset data.
     * @param {string} kodSekolah Kod Sekolah (Cth: MBA0001)
     * @returns {Promise<boolean>} Status kejayaan
     */
    async resetSchoolImpactData(kodSekolah) {
        if (!db) throw new Error("Tiada sambungan pangkalan data.");
        if (!kodSekolah) throw new Error("Kod Sekolah wajib disertakan untuk tindakan pemadaman.");

        const { error } = await db
            .from('smpid_impak_bbm')
            .delete()
            .eq('kod_sekolah', kodSekolah);

        if (error) {
            console.error("Gagal memadam jadual:", error);
            throw new Error("Gagal mereset data sekolah dari pangkalan data.");
        }

        return true;
    }
};