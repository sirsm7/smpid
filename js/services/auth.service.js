/**
 * AUTHENTICATION SERVICE
 * Menguruskan log masuk, pendaftaran admin, dan reset kata laluan.
 */

import { getDatabaseClient } from '../core/db.js';

const db = getDatabaseClient();

export const AuthService = {
    /**
     * Log masuk pengguna (Admin atau Sekolah)
     * @param {string} email 
     * @param {string} password 
     */
    async login(email, password) {
        const { data, error } = await db
            .from('smpid_users')
            .select('id, kod_sekolah, role, password')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !data) {
            throw new Error('Emel pengguna tidak ditemui.');
        }

        // Nota: Dalam produksi sebenar, password sepatutnya di-hash (bcrypt).
        if (data.password !== password) {
            throw new Error('Kata laluan salah.');
        }

        return data;
    },

    /**
     * Dapatkan senarai semua admin
     * Nota: Kita TIDAK select 'password' untuk keselamatan paparan.
     */
    async getAllAdmins() {
        const { data, error } = await db
            .from('smpid_users')
            .select('id, email, role, kod_sekolah') // Exclude password
            .in('role', ['SUPER_ADMIN', 'ADMIN', 'PPD_UNIT'])
            .order('role', { ascending: true }); // Sort by role priority visually if possible, or email

        if (error) throw error;
        return data;
    },

    /**
     * Tambah admin baru
     */
    async createAdmin(email, password, role) {
        const newId = crypto.randomUUID();
        const { error } = await db
            .from('smpid_users')
            .insert([{
                id: newId,
                kod_sekolah: 'M030', // PPD Code
                email: email,
                password: password,
                role: role
            }]);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Tukar kata laluan pengguna (Self-service - Perlu password lama)
     */
    async changePassword(userId, oldPassword, newPassword) {
        // 1. Sahkan password lama
        const { data: user, error: fetchError } = await db
            .from('smpid_users')
            .select('password')
            .eq('id', userId)
            .single();

        if (fetchError || !user) throw new Error("Pengguna tidak ditemui.");
        if (user.password !== oldPassword) throw new Error("Kata laluan lama tidak sah.");

        // 2. Simpan password baru
        const { error: updateError } = await db
            .from('smpid_users')
            .update({ password: newPassword })
            .eq('id', userId);

        if (updateError) throw updateError;
        return { success: true };
    },

    /**
     * Reset Paksa Kata Laluan (Admin Action - Tanpa password lama)
     * Digunakan oleh SUPER ADMIN atau ADMIN untuk reset user lain.
     */
    async forceResetUserPassword(targetUserId, newPassword) {
        const { error } = await db
            .from('smpid_users')
            .update({ password: newPassword })
            .eq('id', targetUserId);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Reset kata laluan sekolah kepada default (Admin Action)
     */
    async resetSchoolPassword(kodSekolah, defaultPass = 'ppdag@12345') {
        const { error } = await db
            .from('smpid_users')
            .update({ password: defaultPass })
            .eq('kod_sekolah', kodSekolah);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Padam akaun admin
     */
    async deleteUser(id) {
        const { error } = await db
            .from('smpid_users')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    }
};