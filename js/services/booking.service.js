/**
 * BOOKING SERVICE (MODUL BIMBINGAN & BENGKEL - BB)
 * Purpose: Manages CRUD operations for workshop bookings and admin date locks.
 * Version: 4.0 (Full Integration with Telegram Notifications)
 * Compatibility: Designed to replace the original 199-line file with zero regressions.
 */

import { getDatabaseClient } from '../core/db.js';
import { APP_CONFIG } from '../config/app.config.js';

export const BookingService = {
    /**
     * Retrieves booking data and locked dates for a specific month.
     * Used for rendering the interactive calendar grid.
     * @param {number} year - The selected year.
     * @param {number} month - The selected month index (0-11).
     */
    async getMonthlyData(year, month) {
        const db = getDatabaseClient();
        
        // Pad month and determine the date range for the query
        const pad = (n) => n.toString().padStart(2, '0');
        const startStr = `${year}-${pad(month + 1)}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        // 1. Fetch Active Bookings within the range
        const { data: bookings, error: errB } = await db
            .from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errB) {
            console.error("[BookingService] Error fetching bookings:", errB);
            throw errB;
        }

        // 2. Fetch Admin Date Locks within the range
        const { data: locks, error: errL } = await db
            .from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);

        if (errL) {
            console.error("[BookingService] Error fetching locks:", errL);
            throw errL;
        }

        // Organize bookings into an object keyed by date string
        const bookedSlots = {};
        bookings.forEach(b => {
            const dateOnly = b.tarikh.split('T')[0]; 
            if (!bookedSlots[dateOnly]) bookedSlots[dateOnly] = [];
            bookedSlots[dateOnly].push(b.masa);
        });

        // Organize locks into an object keyed by date string
        const lockedDetails = {};
        locks.forEach(l => {
            const dateOnly = l.tarikh.split('T')[0];
            lockedDetails[dateOnly] = l.komen;
        });

        return { bookedSlots, lockedDetails };
    },

    /**
     * Submits a new booking with strict validation rules and Telegram notification.
     * @param {Object} payload - Booking details (tarikh, masa, kod_sekolah, etc.)
     */
    async createBooking(payload) {
        const db = getDatabaseClient();
        const { tarikh, masa, kod_sekolah, nama_sekolah, tajuk_bengkel, nama_pic, no_tel_pic } = payload;

        // Validation 1: Allowed Operating Days (Tue, Wed, Thu, Sat)
        const day = new Date(tarikh).getDay();
        const allowedDays = [2, 3, 4, 6];
        if (!allowedDays.includes(day)) {
            throw new Error("Sesi bimbingan hanya dibenarkan pada hari Selasa, Rabu, Khamis dan Sabtu sahaja.");
        }

        // Validation 2: Saturday Logic (Morning Only - V3.7 Policy)
        if (day === 6 && masa === 'Petang') {
            throw new Error("Maaf, sesi bimbingan pada hari Sabtu hanya dibuka untuk slot PAGI sahaja.");
        }

        // Validation 3: Check if the date is locked by Admin
        const { data: isLocked } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();
        
        if (isLocked) {
            throw new Error("Tarikh ini telah dikunci oleh pentadbir bagi urusan rasmi daerah.");
        }

        // Validation 4: Check if the specific slot (Morning/Afternoon) is already taken
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

        // Logic: Generate a unique Booking ID (Format: YYMMDD-SCH-RAND)
        const ymd = tarikh.replace(/-/g, '').substring(2); 
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const bookingId = `${ymd}-${kod_sekolah.slice(-3)}-${rand}`;

        // DB Action: Insert the record
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

        // --- TELEGRAM NOTIFICATION ENGINE (NEW v4.0) ---
        // Fire-and-forget notification to the Deno API endpoint
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
            }).catch(err => console.warn("[BookingService] Silent notification failure:", err));
        }

        return { success: true, bookingId };
    },

    /**
     * Admin Function: Retrieves all active bookings sorted by date.
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
     * User Function: Retrieves booking history for a specific school.
     * @param {string} kodSekolah - The school code.
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
     * Admin Function: Cancels a booking with a recorded reason.
     * @param {number} id - DB Primary Key.
     * @param {string} reason - The cancellation reason.
     */
    async adminCancelBooking(id, reason) {
        const db = getDatabaseClient();
        const currentTimestamp = new Date().toLocaleString('ms-MY');
        const cancellationNote = `Dibatalkan oleh Admin pada ${currentTimestamp}. Sebab: ${reason}`;
        
        const { error } = await db
            .from('smpid_bb_tempahan')
            .update({ 
                status: 'BATAL',
                catatan: cancellationNote
            })
            .eq('id', id);

        if (error) throw error;
        return { success: true };
    },

    /**
     * Admin Function: Toggles the locked status of a specific date.
     * @param {string} tarikh - ISO date string.
     * @param {string} note - Reason for locking.
     * @param {string} adminEmail - Identifier of the admin making the change.
     */
    async toggleDateLock(tarikh, note, adminEmail) {
        const db = getDatabaseClient();
        
        // Check if a lock already exists for this date
        const { data: existing } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .maybeSingle();

        if (existing) {
            // Unlock: Delete the record
            const { error } = await db
                .from('smpid_bb_kunci')
                .delete()
                .eq('tarikh', tarikh);
            
            if (error) throw error;
            return { success: true, action: 'UNLOCKED' };
        } else {
            // Lock: Insert a new record
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