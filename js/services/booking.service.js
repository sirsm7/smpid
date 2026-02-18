/**
 * BOOKING SERVICE (MODUL BIMBINGAN & BENGKEL - BB)
 * Fungsi: Menguruskan CRUD bagi tempahan bengkel dan kunci tarikh admin.
 * Refactored: Lazy DB Loading.
 */

import { requireDb } from '../core/db.js';

export const BookingService = {
    /**
     * Mengambil data tempahan dan tarikh dikunci untuk paparan kalendar.
     * @param {number} year 
     * @param {number} month (0-11)
     */
    async getMonthlyData(year, month) {
        const db = requireDb(); // Lazy Load
        
        const pad = (n) => n.toString().padStart(2, '0');
        const startStr = `${year}-${pad(month + 1)}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        // 1. Ambil Tempahan Aktif
        const { data: bookings, error: errB } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errB) throw errB;

        // 2. Ambil Tarikh Dikunci Admin
        const { data: locks, error: errL } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errL) throw errL;

        const bookedSlots = {};
        bookings.forEach(b => {
            const dateOnly = b.tarikh.split('T')[0]; 
            if (!bookedSlots[dateOnly]) bookedSlots[dateOnly] = [];
            bookedSlots[dateOnly].push(b.masa);
        });

        const lockedDetails = {};
        locks.forEach(l => {
            const dateOnly = l.tarikh.split('T')[0];
            lockedDetails[dateOnly] = l.komen;
        });

        return { bookedSlots, lockedDetails };
    },

    /**
     * Menghantar tempahan baharu dengan validasi slot.
     */
    async createBooking(payload) {
        const db = requireDb(); // Lazy Load
        const { tarikh, masa, kod_sekolah } = payload;

        const day = new Date(tarikh).getDay();
        const allowedDays = [2, 3, 4, 6];
        if (!allowedDays.includes(day)) {
            throw new Error("Tempahan hanya dibenarkan pada hari Selasa, Rabu, Khamis dan Sabtu sahaja.");
        }

        // --- NEW LOGIC: SEKATAN SABTU PETANG ---
        // Jika hari Sabtu (6) dan masa Petang, tolak permintaan.
        if (day === 6 && masa === 'Petang') {
            throw new Error("Maaf, sesi bimbingan hari Sabtu hanya dibuka untuk slot Pagi sahaja.");
        }
        // ----------------------------------------

        // Semak Kunci
        const { data: isLocked } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();
        
        if (isLocked) throw new Error("Maaf, tarikh ini telah dikunci oleh pentadbir.");

        // Semak Slot
        const { data: existing } = await db
            .from('smpid_bb_tempahan')
            .select('id')
            .eq('tarikh', tarikh)
            .eq('masa', masa)
            .eq('status', 'AKTIF')
            .maybeSingle();

        if (existing) throw new Error(`Slot ${masa} pada tarikh tersebut telah ditempah.`);

        // ID Tempahan
        const ymd = tarikh.replace(/-/g, '').substring(2); 
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const bookingId = `${ymd}-${kod_sekolah.slice(-3)}-${rand}`;

        const { error } = await db
            .from('smpid_bb_tempahan')
            .insert([{
                id_tempahan: bookingId,
                ...payload,
                status: 'AKTIF',
                created_at: new Date().toISOString()
            }]);

        if (error) throw error;
        return { success: true, bookingId };
    },

    /**
     * Mendapatkan semua tempahan aktif untuk Panel Admin.
     */
    async getAllActiveBookings() {
        const db = requireDb();
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .order('tarikh', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Mendapatkan sejarah tempahan sekolah tertentu (User View).
     */
    async getSchoolBookings(kodSekolah) {
        const db = requireDb();
        const { data, error } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('kod_sekolah', kodSekolah)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Admin: Membatalkan tempahan.
     */
    async adminCancelBooking(id, reason) {
        const db = requireDb();
        const newNote = `Dibatalkan oleh Admin pada ${new Date().toLocaleString('ms-MY')}. Sebab: ${reason}`;
        
        const { error } = await db
            .from('smpid_bb_tempahan')
            .update({ 
                status: 'BATAL',
                catatan: newNote
            })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Admin: Kunci atau Buka Kunci Tarikh.
     */
    async toggleDateLock(tarikh, note, adminEmail) {
        const db = requireDb();
        
        const { data: existing } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();

        if (existing) {
            const { error } = await db
                .from('smpid_bb_kunci')
                .delete()
                .eq('tarikh', tarikh);
            
            if (error) throw error;
            return { success: true, action: 'UNLOCKED' };
        } else {
            const { error } = await db
                .from('smpid_bb_kunci')
                .insert([{
                    tarikh,
                    komen: note,
                    admin_email: adminEmail,
                    created_at: new Date().toISOString()
                }]);

            if (error) throw error;
            return { success: true, action: 'LOCKED' };
        }
    }
};