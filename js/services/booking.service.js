/**
 * BOOKING SERVICE (MODUL BIMBINGAN & BENGKEL - BB)
 * Purpose: Manages CRUD operations for workshop bookings and admin date locks.
 * Version: 8.4 (Surgical RBAC Calibration & Non-Destructive Lock Merge)
 * --- UPDATE V8.4 ---
 * 1. Pengecaman Daerah Kebal: Membina pemetaan padanan huruf besar (.toUpperCase()) dan pencarian
 * ilike supaya pentadbir dan sekolah tidak jatuh ke zon M030 (fallback) secara salah.
 * 2. Cantuman Kunci Bersilang (Non-Destructive Overwrite): Membina logik "Tarik & Cantum".
 * Apabila Admin daerah mengunci/membuka tarikh, sistem menggabungkan daerahnya dengan
 * senarai daerah sedia ada (M010,M020), bukannya memadam rekod daerah lain.
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

        // --- RBAC DAERAH INJECTION ---
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || '';
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || 'USER';
        
        let validCodes = [];
        let ppdOwner = 'M030'; // Lalai sandaran
        
        // Penentuan hak milik paparan yang jitu
        if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
            ppdOwner = 'ALL_DISTRICTS';
        } else if (['ADMIN', 'PPD_UNIT'].includes(userRole)) {
            ppdOwner = userKod;
            const userDaerah = (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[userKod]) ? APP_CONFIG.PPD_MAPPING[userKod] : 'ALOR GAJAH';
            // Tarik sekolah milik admin
            const { data: sList } = await db.from('smpid_sekolah_data').select('kod_sekolah').ilike('daerah', userDaerah);
            if (sList) validCodes = sList.map(x => x.kod_sekolah);
        } else if (userKod) {
            // Sekolah biasa (USER)
            const { data: sData } = await db.from('smpid_sekolah_data').select('daerah').eq('kod_sekolah', userKod).maybeSingle();
            const userDaerah = sData && sData.daerah ? sData.daerah.toUpperCase() : 'ALOR GAJAH';
            
            // Padanan selamat mengelak case-sensitive mismatches
            if (APP_CONFIG.PPD_MAPPING) {
                for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                    if (v.toUpperCase() === userDaerah) { ppdOwner = k; break; }
                }
            }
            
            const { data: sList } = await db.from('smpid_sekolah_data').select('kod_sekolah').ilike('daerah', userDaerah);
            if (sList) validCodes = sList.map(x => x.kod_sekolah);
        }

        // 1. Ambil Tempahan Aktif (Ditapis mengikut daerah kecuali Super Admin)
        let queryB = db.from('smpid_bb_tempahan')
            .select('*')
            .eq('status', 'AKTIF')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);
            
        if (!['SUPER_ADMIN', 'JPNMEL'].includes(userRole) && validCodes.length > 0) {
            queryB = queryB.in('kod_sekolah', validCodes);
        }

        const { data: bookings, error: errB } = await queryB;

        if (errB) {
            console.error("[BookingService] Ralat mengambil data tempahan:", errB);
            throw errB;
        }

        // 2. Ambil Kunci Tarikh Admin (Statewide 'ALL' atau Spesifik PPD - Menggunakan iLike untuk Pencarian String)
        let queryL = db.from('smpid_bb_kunci')
            .select('*')
            .gte('tarikh', startStr)
            .lte('tarikh', endStr);
            
        if (!['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
            queryL = queryL.or(`kod_ppd.ilike.%ALL%,kod_ppd.ilike.%${ppdOwner}%`); 
        }

        const { data: locks, error: errL } = await queryL;

        if (errL) {
            console.error("[BookingService] Ralat mengambil data kunci:", errL);
            throw errL;
        }

        // Susun tempahan ke dalam objek mengikut tarikh (ISO string)
        const bookedSlots = {};
        bookings.forEach(b => {
            const dateOnly = b.tarikh.split('T')[0]; 
            if (!bookedSlots[dateOnly]) bookedSlots[dateOnly] = [];
            // Masukkan nilai slot ('Pagi', 'Petang', atau '1 HARI')
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

        // Validasi 2: Logik Spesifik Hari & Masa
        // Sabtu: Hanya Pagi
        if (day === 6 && masa !== 'Pagi') {
            throw new Error("Maaf, sesi bimbingan pada hari Sabtu hanya dibuka untuk slot PAGI sahaja.");
        }
        // '1 HARI': Hanya Selasa (2), Rabu (3), Khamis (4)
        if (masa === '1 HARI' && ![2, 3, 4].includes(day)) {
            throw new Error("Opsyen '1 HARI' hanya tersedia untuk hari Selasa, Rabu, dan Khamis sahaja.");
        }

        // --- RBAC DAERAH INJECTION UNTUK KAWALAN PERTINDIHAN (COLLISION) ---
        const { data: sData } = await db.from('smpid_sekolah_data').select('daerah').eq('kod_sekolah', kod_sekolah).maybeSingle();
        const daerah = sData && sData.daerah ? sData.daerah.toUpperCase() : 'ALOR GAJAH';
        
        let ppdOwner = 'M030';
        if (APP_CONFIG.PPD_MAPPING) {
            for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
                if (v.toUpperCase() === daerah) { ppdOwner = k; break; }
            }
        }
        
        const { data: sList } = await db.from('smpid_sekolah_data').select('kod_sekolah').ilike('daerah', daerah);
        const validCodes = sList ? sList.map(x => x.kod_sekolah) : [kod_sekolah];

        // Validasi 3: Semak jika tarikh telah dikunci oleh Admin (Global atau Daerah ini menggunakan iLike)
        const { data: isLocked } = await db
            .from('smpid_bb_kunci')
            .select('id')
            .eq('tarikh', tarikh)
            .or(`kod_ppd.ilike.%ALL%,kod_ppd.ilike.%${ppdOwner}%`)
            .maybeSingle();
        
        if (isLocked) {
            throw new Error("Tarikh ini telah dikunci oleh pentadbir bagi urusan rasmi jabatan.");
        }

        // Validasi 4: Konflik Masa & Kapasiti (Saringan Khusus Daerah)
        if (masa === '1 HARI') {
            // Jika user minta 1 HARI, pastikan TIADA sebarang tempahan lain (Pagi atau Petang) dalam daerah ini
            const { data: anyBooking } = await db
                .from('smpid_bb_tempahan')
                .select('id')
                .eq('tarikh', tarikh)
                .eq('status', 'AKTIF')
                .in('kod_sekolah', validCodes)
                .maybeSingle();
            
            if (anyBooking) {
                throw new Error("Permohonan '1 HARI' gagal kerana terdapat sesi lain (Pagi/Petang) yang telah ditempah pada tarikh ini.");
            }
        } else {
            // A. Cek konflik langsung (Slot sama diambil dalam daerah yang sama)
            const { data: sameSlot } = await db
                .from('smpid_bb_tempahan')
                .select('id')
                .eq('tarikh', tarikh)
                .eq('masa', masa)
                .eq('status', 'AKTIF')
                .in('kod_sekolah', validCodes)
                .maybeSingle();

            if (sameSlot) {
                throw new Error(`Maaf, slot ${masa.toUpperCase()} pada tarikh tersebut telah ditempah.`);
            }

            // B. Cek konflik dengan '1 HARI' (Slot Full Day diambil oleh orang lain di daerah sama)
            const { data: fullDayBooking } = await db
                .from('smpid_bb_tempahan')
                .select('id')
                .eq('tarikh', tarikh)
                .eq('masa', '1 HARI')
                .eq('status', 'AKTIF')
                .in('kod_sekolah', validCodes)
                .maybeSingle();
            
            if (fullDayBooking) {
                throw new Error("Tarikh ini telah ditempah PENUH (1 HARI) oleh sekolah lain.");
            }
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
     * Ditapis mengikut PPD supaya paparan senarai terkawal (Menggunakan iLike).
     */
    async getAllLocks() {
        const db = getDatabaseClient();
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || '';
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || 'USER';
        
        let query = db.from('smpid_bb_kunci').select('*').order('tarikh', { ascending: true });

        // Tapis mengikut PPD jika pengguna bukan Super Admin / JPNMEL
        if (['ADMIN', 'PPD_UNIT'].includes(userRole) && userKod) {
            let ppdOwner = userKod;
            if (APP_CONFIG.PPD_MAPPING) {
                // Cuba dapatkan kunci tepat sekiranya mereka menggunakan ID selain yang ada dalam senarai
                const foundKey = Object.keys(APP_CONFIG.PPD_MAPPING).find(k => k === userKod);
                if (foundKey) ppdOwner = foundKey; 
            }
            query = query.or(`kod_ppd.ilike.%ALL%,kod_ppd.ilike.%${ppdOwner}%`);
        }

        const { data, error } = await query;

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
     * Admin Function: Menguruskan kunci tarikh menggunakan *Single-Row Storage String*.
     * Kaedah ini lebih berkesan menangani kekangan pangkalan data (Constraint) dengan
     * memadamkan baris tarikh dan memasukkannya semula sebagai satu rentetan gabungan (String Join).
     * @param {string} action - 'LOCK', 'UNLOCK', atau 'UPDATE'
     * @param {string} tarikh - Rentetan tarikh ISO.
     * @param {string} note - Sebab atau ulasan kunci.
     * @param {Array<string>} targetPpds - Senarai kod PPD baharu untuk dikunci (contoh: ['M010', 'M020'] atau ['ALL']).
     */
    async manageDateLock(action, tarikh, note, targetPpds) {
        const db = getDatabaseClient();

        // Dapatkan Identiti Pentadbir untuk Jejak Audit
        const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || 'ADMIN';
        const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || 'PPD';
        const userId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);
        
        const dikunciOlehIdentifier = `${userRole} (${userKod})`;
        let adminEmail = null;

        // Tarik emel admin dari pangkalan data (smpid_users) untuk direkodkan
        if (userId) {
            const { data: userData } = await db.from('smpid_users').select('email').eq('id', userId).maybeSingle();
            if (userData && userData.email) {
                adminEmail = userData.email;
            }
        }

        // 1. Tarik rekod kunci yang sudah wujud pada tarikh tersebut (Jika ada)
        const { data: existingLock } = await db.from('smpid_bb_kunci').select('*').eq('tarikh', tarikh).maybeSingle();
        
        let finalScopes = [];
        let currentScopes = (existingLock && existingLock.kod_ppd) ? existingLock.kod_ppd.split(',') : [];

        // 2. Logik Penggabungan Pintar (Smart Merge)
        if (['SUPER_ADMIN', 'JPNMEL'].includes(userRole)) {
            // Super Admin mengawal secara mutlak kotak semak (checkbox)
            finalScopes = Array.isArray(targetPpds) ? targetPpds : [targetPpds];
        } else {
            // Admin PPD Biasa -> Tambah/Buang diri sendiri dari cantuman daerah
            if (action === 'UNLOCK') {
                if (currentScopes.includes('ALL')) {
                    const allPPDs = Object.keys(APP_CONFIG.PPD_MAPPING || {});
                    finalScopes = allPPDs.filter(k => k !== userKod); // Tolak diri sendiri dari ALL
                } else {
                    finalScopes = currentScopes.filter(code => code !== userKod);
                }
            } else {
                // LOCK & UPDATE Action
                finalScopes = [...new Set([...currentScopes, userKod])];
                const allPPDs = Object.keys(APP_CONFIG.PPD_MAPPING || {});
                const hasAll = allPPDs.length > 0 && allPPDs.every(k => finalScopes.includes(k));
                if (hasAll || finalScopes.includes('ALL')) finalScopes = ['ALL'];
            }
        }

        // Persediaan Rentetan Keseluruhan
        if (finalScopes.includes('ALL')) finalScopes = ['ALL'];
        const joinedScopes = finalScopes.join(',');

        // 3. Pelaksanaan Pangkalan Data (Non-Destructive Overwrite)
        if (finalScopes.length === 0 || joinedScopes === '') {
            // Pembersihan Total Jika Tiada Lagi Daerah Berkunci
            const { error } = await db.from('smpid_bb_kunci').delete().eq('tarikh', tarikh);
            if (error) throw error;
            return { success: true, action: 'UNLOCKED' };
        } else {
            if (existingLock) {
                // Cantuman / Pengemaskinian Rekod Bersilang
                const { error } = await db.from('smpid_bb_kunci').update({
                    komen: note || existingLock.komen,
                    kod_ppd: joinedScopes,
                    dikunci_oleh: dikunciOlehIdentifier,
                    admin_email: adminEmail,
                    created_at: new Date().toISOString()
                }).eq('id', existingLock.id);
                
                if (error) throw error;
                return { success: true, action: 'UPDATED' };
            } else {
                // Rekod Kunci Pertama Kali
                const { error } = await db.from('smpid_bb_kunci').insert([{
                    tarikh: tarikh,
                    komen: note,
                    kod_ppd: joinedScopes,
                    dikunci_oleh: dikunciOlehIdentifier,
                    admin_email: adminEmail,
                    created_at: new Date().toISOString()
                }]);
                
                if (error) throw error;
                return { success: true, action: 'LOCKED' };
            }
        }
    }
};