/**
 * BOOKING SERVICE (MODUL BIMBINGAN & BENGKEL - BB)
 * Purpose: Manages CRUD operations for workshop bookings and admin date locks.
 * Version: 5.1 (Full Integrity & Hard Delete)
 * --- UPDATE V5.1 ---
 * 1. Hard Delete Implementation: adminCancelBooking kini memadam terus rekod dari Supabase.
 * 2. Data Retrieval: Ditambah fungsi getAllLocks() untuk pelaporan menyeluruh Admin.
 * 3. Logic Preservation: Mengekalkan setiap baris kod asal tanpa sebarang singkatan.
 */

import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

export const BookingService = {
    /**
     * Mengambil data tempahan dan tarikh dikunci untuk bulan tertentu.
     * Digunakan untuk menjana grid kalendar interaktif.
     * @param {number} year - Tahun yang dipilih.
     * @param {number} month - Indeks bulan (0-11).
     */
    async getMonthlyData(year, month) {
        const db = getDatabaseClient();
        
        // Memastikan format bulan 2 digit dan menentukan julat tarikh
        const pad = (n) => n.toString().padStart(2, '0');
        const startStr = `${year}-${pad(month + 1)}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        // 1. Ambil Tempahan Aktif dalam julat tarikh tersebut
        const { data: bookings, error: errB } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errB) {
            console.error("[BookingService] Ralat mengambil data tempahan:", errB);
            throw errB;
        }

        // 2. Ambil Kunci Tarikh Admin dalam julat tarikh tersebut
        const { data: locks, error: errL } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errL) {
            console.error("[BookingService] Ralat mengambil data kunci:", errL);
            throw errL;
        }

        // Susun tempahan ke dalam objek mengikut tarikh (ISO string)
        const bookedSlots = {};
        bookings.forEach(b => {
            const dateOnly = b.tarikh.split('T')[0]; 
            if (!bookedSlots[dateOnly]) bookedSlots[dateOnly] = [];
            bookedSlots[dateOnly].push(b.masa);
        });

        // Susun kunci tarikh ke dalam objek mengikut tarikh (ISO string)
        const lockedDetails = {};
        locks.forEach(l => {
            const dateOnly = l.tarikh.split('T')[0];
            lockedDetails[dateOnly] = l.komen;
        });

        return { bookedSlots, lockedDetails };
    },

    /**
     * Menghantar tempahan baharu dengan validasi ketat dan notifikasi Telegram.
     * @param {Object} payload - Data butiran tempahan.
     */
    async createBooking(payload) {
        const db = getDatabaseClient();
        const { tarikh, masa, kod_sekolah, nama_sekolah, tajuk_bengkel, nama_pic, no_tel_pic } = payload;

        // Validasi 1: Hari Operasi yang Dibenarkan (Sel, Rab, Kha, Sab)
        const day = new Date(tarikh).getDay();
        const allowedDays = [2, 3, 4, 6];
        if (!allowedDays.includes(day)) {
            throw new Error("Sesi bimbingan hanya dibenarkan pada hari Selasa, Rabu, Khamis dan Sabtu sahaja.");
        }

        // Validasi 2: Logik Hari Sabtu (Hanya Pagi - Polisi V3.7)
        if (day === 6 && masa === 'Petang') {
            throw new Error("Maaf, sesi bimbingan pada hari Sabtu hanya dibuka untuk slot PAGI sahaja.");
        }

        // Validasi 3: Semak jika tarikh telah dikunci oleh Admin
        const { data: isLocked } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();
        
        if (isLocked) {
            throw new Error("Tarikh ini telah dikunci oleh pentadbir bagi urusan rasmi daerah.");
        }

        // Validasi 4: Semak jika slot spesifik (Pagi/Petang) sudah diambil
        const { data: existing } = await db
            .from('smpid_bb_tempahan')
            .select('id')
            .eq('tarikh', tarikh)
            .eq('masa', masa)
            .eq('status', 'AKTIF')
            .maybeSingle();

        if (existing) {
            throw new Error(`Maaf, slot ${masa.toUpperCase()} pada tarikh tersebut telah ditempah oleh sekolah lain.`);
        }

        // Logik: Jana ID Tempahan Unik (Format: YYMMDD-SCH-RAND)
        const ymd = tarikh.replace(/-/g, '').substring(2); 
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const bookingId = `${ymd}-${kod_sekolah.slice(-3)}-${rand}`;

        // Tindakan DB: Masukkan rekod baharu
        const { error } = await db
            .from('smpid_bb_tempahan')
            .insert([{
                id_tempahan: bookingId,
                tarikh: tarikh,
                masa: masa,
                kod_sekolah: kod_sekolah,
                nama_sekolah: nama_sekolah,
                tajuk_bengkel: tajuk_bengkel,
                nama_pic: nama_pic,
                no_tel_pic: no_tel_pic,
                status: 'AKTIF',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;

        // Enjin Notifikasi Telegram
        if (APP_CONFIG.API.DENO_URL) {
            fetch(`${APP_CONFIG.API.DENO_URL}/notify-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kod: kod_sekolah,
                    nama: nama_sekolah,
                    tajuk: tajuk_bengkel,
                    tarikh: tarikh,
                    masa: masa,
                    pic: nama_pic,
                    tel: no_tel_pic
                })
            }).catch(err => console.warn("[BookingService] Kegagalan notifikasi senyap:", err));
        }

        return { success: true, bookingId };
    },

    /**
     * Admin Function: Mengambil semua tempahan aktif untuk paparan senarai.
     */
    async getAllActiveBookings() {
        const db = getDatabaseClient();
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .order('tarikh', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Admin Function: Mengambil semua data tarikh yang dikunci secara global.
     * Fungsi baharu untuk Versi 5.1 bagi menyokong paparan integrasi Admin.
     */
    async getAllLocks() {
        const db = getDatabaseClient();
        const { data, error } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .order('tarikh', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * User Function: Mengambil sejarah tempahan mengikut kod sekolah.
     * @param {string} kodSekolah - Kod sekolah pengguna.
     */
    async getSchoolBookings(kodSekolah) {
        const db = getDatabaseClient();
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Admin Function: Memadam rekod tempahan secara kekal (Hard Delete).
     * Mengikut arahan, data ini tidak memerlukan audit dan dihapuskan terus.
     * @param {number} id - Kunci utama dalam pangkalan data.
     */
    async adminCancelBooking(id) {
        const db = getDatabaseClient();
        
        // Menjalankan operasi DELETE secara fizikal pada pangkalan data
        const { error } = await db
            .from('smpid_bb_tempahan')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Admin Function: Menukar status kunci pada tarikh tertentu (Toggle).
     * @param {string} tarikh - Rentetan tarikh ISO.
     * @param {string} note - Sebab atau ulasan kunci.
     * @param {string} adminEmail - Identiti admin yang melakukan perubahan.
     */
    async toggleDateLock(tarikh, note, adminEmail) {
        const db = getDatabaseClient();
        
        // Semak jika kunci sudah wujud untuk tarikh ini
        const { data: existing } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();

        if (existing) {
            // Jika wujud, lakukan operasi padam (Buka Kunci)
            const { error } = await db
                .from('smpid_bb_kunci')
                .delete()
                .eq('tarikh', tarikh);
            
            if (error) throw error;
            return { success: true, action: 'UNLOCKED' };
        } else {
            // Jika tiada, lakukan operasi tambah (Kunci Tarikh)
            const { error } = await db
                .from('smpid_bb_kunci')
                .insert([{
                    tarikh: tarikh,
                    komen: note,
                    admin_email: adminEmail,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, action: 'LOCKED' };
        }
    }
};