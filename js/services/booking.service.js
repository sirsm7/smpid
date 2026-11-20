import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "../core/db.js";

async function getReadyDbClient() {
  if (typeof window !== "undefined" && window.ENV_READY) {
    await window.ENV_READY;
  } else {
    await envReady;
  }

  const db = (await initDatabaseClient()) || getDatabaseClient();
  if (!db) {
    throw new Error("Sambungan pangkalan data belum bersedia. Sila muat semula halaman.");
  }
  return db;
}

function parseLocalIsoDate(isoDate) {
  const parts = String(isoDate || "").split("T")[0].split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return new Date(isoDate);
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function isRpcMissingError(error) {
  if (!error) {
    return false;
  }
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist")
  );
}

function formatDatabaseWriteError(error, defaultMessage) {
  if (!error) {
    return new Error(defaultMessage);
  }
  const msg = String(error.message || "");
  const status = Number(error.status || error.code || 0);
  if (
    status === 401 ||
    status === 403 ||
    msg.toLowerCase().includes("row-level security") ||
    msg.toLowerCase().includes("permission denied")
  ) {
    return new Error(
      "Akses tulis jadual disekat pelayan (401/RLS). Sila jalankan skrip fungsi RPC Supabase untuk jadual tempahan/kunci."
    );
  }
  return new Error(msg || defaultMessage);
}

export const BookingService = {
  async getMonthlyData(year, month, adminDaerahFilter = "ALL") {
    const db = await getReadyDbClient();

    const pad = (n) => String(n).padStart(2, "0");
    const startStr = `${year}-${pad(month + 1)}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endStr = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "";
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || "USER";

    let validCodes = [];
    let ppdOwner = "M030";

    if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
      if (adminDaerahFilter !== "ALL") {
        ppdOwner = adminDaerahFilter;
        const userDaerah =
          APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[adminDaerahFilter]
            ? APP_CONFIG.PPD_MAPPING[adminDaerahFilter]
            : "ALOR GAJAH";
        const { data: sList } = await db
          .from("smpid_sekolah_data")
          .select("kod_sekolah")
          .ilike("daerah", userDaerah);
        if (Array.isArray(sList)) {
          validCodes = sList.map((x) => x.kod_sekolah);
        }
      } else {
        ppdOwner = "ALL_DISTRICTS";
      }
    } else if (["ADMIN", "PPD_UNIT"].includes(userRole)) {
      ppdOwner = userKod;
      const userDaerah =
        APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[userKod]
          ? APP_CONFIG.PPD_MAPPING[userKod]
          : "ALOR GAJAH";
      const { data: sList } = await db
        .from("smpid_sekolah_data")
        .select("kod_sekolah")
        .ilike("daerah", userDaerah);
      if (Array.isArray(sList)) {
        validCodes = sList.map((x) => x.kod_sekolah);
      }
    } else if (userKod) {
      const { data: sData } = await db
        .from("smpid_sekolah_data")
        .select("daerah")
        .eq("kod_sekolah", userKod)
        .maybeSingle();
      const userDaerah =
        sData && sData.daerah ? String(sData.daerah).toUpperCase() : "ALOR GAJAH";

      if (APP_CONFIG.PPD_MAPPING) {
        for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
          if (String(v).toUpperCase() === userDaerah) {
            ppdOwner = k;
            break;
          }
        }
      }

      const { data: sList } = await db
        .from("smpid_sekolah_data")
        .select("kod_sekolah")
        .ilike("daerah", userDaerah);
      if (Array.isArray(sList)) {
        validCodes = sList.map((x) => x.kod_sekolah);
      }
    }

    let queryB = db
      .from("smpid_bb_tempahan")
      .select("*")
      .eq("status", "AKTIF")
      .gte("tarikh", startStr)
      .lte("tarikh", endStr);

    if (validCodes.length > 0) {
      queryB = queryB.in("kod_sekolah", validCodes);
    }

    const { data: bookings, error: errB } = await queryB;
    if (errB) {
      throw errB;
    }

    let queryL = db
      .from("smpid_bb_kunci")
      .select("*")
      .gte("tarikh", startStr)
      .lte("tarikh", endStr);

    if (ppdOwner !== "ALL_DISTRICTS") {
      queryL = queryL.or(`kod_ppd.ilike.%ALL%,kod_ppd.ilike.%${ppdOwner}%`);
    }

    const { data: locks, error: errL } = await queryL;
    if (errL) {
      throw errL;
    }

    const bookedSlots = {};
    (bookings || []).forEach((b) => {
      const dateOnly = String(b.tarikh || "").split("T")[0];
      if (!dateOnly) {
        return;
      }
      if (!bookedSlots[dateOnly]) {
        bookedSlots[dateOnly] = [];
      }
      bookedSlots[dateOnly].push(b.masa);
    });

    const lockedDetails = {};
    (locks || []).forEach((l) => {
      const dateOnly = String(l.tarikh || "").split("T")[0];
      if (!dateOnly) {
        return;
      }
      lockedDetails[dateOnly] = l.komen;
    });

    return { bookedSlots, lockedDetails };
  },

  async createBooking(payload) {
    const db = await getReadyDbClient();
    const {
      tarikh,
      masa,
      kod_sekolah,
      nama_sekolah,
      tajuk_bengkel,
      nama_pic,
      no_tel_pic
    } = payload;

    const { data: sData } = await db
      .from("smpid_sekolah_data")
      .select("daerah")
      .eq("kod_sekolah", kod_sekolah)
      .maybeSingle();
    const daerah =
      sData && sData.daerah ? String(sData.daerah).toUpperCase() : "ALOR GAJAH";

    let ppdOwner = "M030";
    if (APP_CONFIG.PPD_MAPPING) {
      for (const [k, v] of Object.entries(APP_CONFIG.PPD_MAPPING)) {
        if (String(v).toUpperCase() === daerah) {
          ppdOwner = k;
          break;
        }
      }
    }

    const { data: sList } = await db
      .from("smpid_sekolah_data")
      .select("kod_sekolah")
      .ilike("daerah", daerah);
    const validCodes =
      Array.isArray(sList) && sList.length > 0
        ? sList.map((x) => x.kod_sekolah)
        : [kod_sekolah];

    const dateObj = parseLocalIsoDate(tarikh);
    const day = dateObj.getDay();
    const dayOfMonth = dateObj.getDate();

    const isJasin = daerah === "JASIN";
    const isMelakaTengah = daerah === "MELAKA TENGAH";
    const isAlorGajah = !isJasin && !isMelakaTengah;

    let isAllowedDay = false;
    let errorMsg = "Sesi bimbingan tidak dibenarkan pada tarikh ini.";

    if (isJasin) {
      if ([2, 3, 4].includes(day)) {
        isAllowedDay = true;
      } else {
        errorMsg =
          "Bagi PPD Jasin, tempahan hanya dibenarkan pada hari Selasa, Rabu, dan Khamis sahaja.";
      }
    } else if (isMelakaTengah) {
      if ([1, 2, 3, 4].includes(day)) {
        isAllowedDay = true;
      } else {
        errorMsg =
          "Bagi PPD Melaka Tengah, tempahan hanya dibenarkan pada hari Isnin, Selasa, Rabu, dan Khamis sahaja.";
      }
    } else if (isAlorGajah) {
      if ([2, 3, 4].includes(day)) {
        isAllowedDay = true;
      } else if (day === 6) {
        if (dayOfMonth >= 15 && dayOfMonth <= 21) {
          isAllowedDay = true;
        } else {
          errorMsg =
            "Hari Sabtu hanya dibuka untuk tempahan pada minggu ke-3 (15hb - 21hb) setiap bulan bagi Alor Gajah.";
        }
      } else {
        errorMsg =
          "Bagi PPD Alor Gajah, tempahan hanya dibenarkan pada hari Selasa, Rabu, Khamis dan Sabtu minggu ke-3.";
      }
    }

    if (!isAllowedDay) {
      throw new Error(errorMsg);
    }

    if (day === 6 && masa !== "Pagi") {
      throw new Error(
        "Maaf, sesi bimbingan pada hari Sabtu hanya dibuka untuk slot PAGI sahaja."
      );
    }

    const isNormalDay = day !== 0 && day !== 6;
    if (masa === "1 HARI" && !isNormalDay) {
      throw new Error(
        "Opsyen '1 HARI' hanya tersedia untuk hari bekerja biasa (Isnin-Khamis) sahaja."
      );
    }
    if (masa === "Petang" && !isNormalDay) {
      throw new Error(
        "Sesi Petang tidak ditawarkan pada hari kelepasan am atau hujung minggu."
      );
    }

    const { data: lockRecord } = await db
      .from("smpid_bb_kunci")
      .select("kod_ppd")
      .eq("tarikh", tarikh)
      .or(`kod_ppd.ilike.%ALL%,kod_ppd.ilike.%${ppdOwner}%`)
      .maybeSingle();

    if (lockRecord) {
      const scopes = lockRecord.kod_ppd ? lockRecord.kod_ppd.split(",") : [];
      let isSlotLocked = false;

      for (const scope of scopes) {
        let sCode = scope;
        let sSlot = "ALL";

        if (scope.includes(":")) {
          const parts = scope.split(":");
          sCode = parts[0];
          sSlot = parts[1];
        }

        if (sCode === "ALL" || sCode === ppdOwner) {
          if (sSlot === "ALL") {
            isSlotLocked = true;
            break;
          } else if (masa === "1 HARI") {
            isSlotLocked = true;
            break;
          } else if (sSlot === "PAGI" && masa === "Pagi") {
            isSlotLocked = true;
            break;
          } else if (sSlot === "PETANG" && masa === "Petang") {
            isSlotLocked = true;
            break;
          }
        }
      }

      if (isSlotLocked) {
        throw new Error(
          "Maaf, slot tempahan pada tarikh ini telah ditutup oleh pihak pentadbir PPD bagi urusan rasmi."
        );
      }
    }

    if (masa === "1 HARI") {
      const { data: anyBooking } = await db
        .from("smpid_bb_tempahan")
        .select("id")
        .eq("tarikh", tarikh)
        .eq("status", "AKTIF")
        .in("kod_sekolah", validCodes)
        .maybeSingle();

      if (anyBooking) {
        throw new Error(
          "Permohonan '1 HARI' gagal kerana terdapat sesi lain (Pagi/Petang) yang telah ditempah pada tarikh ini."
        );
      }
    } else {
      const { data: sameSlot } = await db
        .from("smpid_bb_tempahan")
        .select("id")
        .eq("tarikh", tarikh)
        .eq("masa", masa)
        .eq("status", "AKTIF")
        .in("kod_sekolah", validCodes)
        .maybeSingle();

      if (sameSlot) {
        throw new Error(`Maaf, slot ${masa.toUpperCase()} pada tarikh tersebut telah ditempah.`);
      }

      const { data: fullDayBooking } = await db
        .from("smpid_bb_tempahan")
        .select("id")
        .eq("tarikh", tarikh)
        .eq("masa", "1 HARI")
        .eq("status", "AKTIF")
        .in("kod_sekolah", validCodes)
        .maybeSingle();

      if (fullDayBooking) {
        throw new Error("Tarikh ini telah ditempah PENUH (1 HARI) oleh sekolah lain.");
      }
    }

    const ymd = String(tarikh).replace(/-/g, "").substring(2);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const bookingId = `${ymd}-${String(kod_sekolah).slice(-3)}-${rand}`;

    const { error } = await db.from("smpid_bb_tempahan").insert([
      {
        id_tempahan: bookingId,
        tarikh,
        masa,
        kod_sekolah,
        nama_sekolah,
        tajuk_bengkel,
        nama_pic,
        no_tel_pic,
        status: "AKTIF",
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      throw formatDatabaseWriteError(error, "Gagal menyimpan tempahan baharu.");
    }

    const denoUrl = APP_CONFIG && APP_CONFIG.API ? APP_CONFIG.API.DENO_URL : "";
    if (denoUrl) {
      fetch(`${denoUrl}/notify-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kod: kod_sekolah,
          nama: nama_sekolah,
          tajuk: tajuk_bengkel,
          tarikh,
          masa,
          pic: nama_pic,
          tel: no_tel_pic
        })
      }).catch(() => {});
    }

    return { success: true, bookingId };
  },

  async getAllActiveBookings() {
    const db = await getReadyDbClient();
    const { data, error } = await db
      .from("smpid_bb_tempahan")
      .select("*")
      .eq("status", "AKTIF")
      .order("tarikh", { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  },

  async getAllBookings() {
    const db = await getReadyDbClient();
    const { data, error } = await db
      .from("smpid_bb_tempahan")
      .select("*")
      .order("tarikh", { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  },

  async getAllLocks(enforceRoleScope = true) {
    const db = await getReadyDbClient();
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "";
    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || "USER";

    let query = db
      .from("smpid_bb_kunci")
      .select("*")
      .order("tarikh", { ascending: true });

    if (enforceRoleScope && ["ADMIN", "PPD_UNIT"].includes(userRole) && userKod) {
      let ppdOwner = userKod;
      if (APP_CONFIG.PPD_MAPPING) {
        const foundKey = Object.keys(APP_CONFIG.PPD_MAPPING).find((k) => k === userKod);
        if (foundKey) {
          ppdOwner = foundKey;
        }
      }
      query = query.or(`kod_ppd.ilike.%ALL%,kod_ppd.ilike.%${ppdOwner}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }
    return data || [];
  },

  async getSchoolBookings(kodSekolah) {
    const db = await getReadyDbClient();
    const { data, error } = await db
      .from("smpid_bb_tempahan")
      .select("*")
      .eq("kod_sekolah", kodSekolah)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  },

  async adminCancelBooking(id) {
    const db = await getReadyDbClient();

    const { error: rpcError } = await db.rpc("delete_bb_tempahan", {
      p_id: Number(id)
    });

    if (!rpcError) {
      return { success: true };
    }

    if (!isRpcMissingError(rpcError)) {
      throw formatDatabaseWriteError(rpcError, "Gagal memadam rekod tempahan.");
    }

    const { error } = await db
      .from("smpid_bb_tempahan")
      .delete()
      .eq("id", id);

    if (error) {
      throw formatDatabaseWriteError(error, "Gagal memadam rekod tempahan.");
    }
    return { success: true };
  },

  async manageDateLock(action, tarikh, note, targetPpds) {
    const db = await getReadyDbClient();

    const userRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE) || "ADMIN";
    const userKod = localStorage.getItem(APP_CONFIG.SESSION.USER_KOD) || "PPD";
    const userId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);

    const dikunciOlehIdentifier = `${userRole} (${userKod})`;
    let adminEmail = null;

    if (userId) {
      const { data: userData } = await db
        .from("smpid_users")
        .select("email")
        .eq("id", userId)
        .maybeSingle();
      if (userData && userData.email) {
        adminEmail = userData.email;
      }
    }

    const { data: existingLock } = await db
      .from("smpid_bb_kunci")
      .select("*")
      .eq("tarikh", tarikh)
      .maybeSingle();

    let finalScopes = [];
    const currentScopes =
      existingLock && existingLock.kod_ppd ? existingLock.kod_ppd.split(",") : [];

    const parseScope = (s) => {
      if (s.includes(":")) {
        const p = s.split(":");
        return { kod: p[0], slot: p[1], raw: s };
      }
      return { kod: s, slot: "ALL", raw: s };
    };

    if (["SUPER_ADMIN", "JPNMEL"].includes(userRole)) {
      if (action === "UNLOCK") {
        const isUnlockAllDistricts = targetPpds.some(
          (s) => parseScope(s).kod === "ALL"
        );

        if (isUnlockAllDistricts) {
          finalScopes = [];
        } else {
          const currentHasAll = currentScopes.some(
            (s) => parseScope(s).kod === "ALL"
          );

          if (currentHasAll) {
            const allPPDs = Object.keys(APP_CONFIG.PPD_MAPPING || {});
            const originalSlot = parseScope(
              currentScopes.find((s) => parseScope(s).kod === "ALL")
            ).slot;
            const expandedScopes = allPPDs.map((k) => `${k}:${originalSlot}`);

            finalScopes = expandedScopes.filter((expanded) => {
              const expParsed = parseScope(expanded);
              const isRequestedToRemove = targetPpds.some((target) => {
                const trgParsed = parseScope(target);
                return (
                  trgParsed.kod === expParsed.kod &&
                  (trgParsed.slot === "ALL" || trgParsed.slot === expParsed.slot)
                );
              });
              return !isRequestedToRemove;
            });
          } else {
            finalScopes = currentScopes.filter((curr) => {
              const curParsed = parseScope(curr);
              const isRequestedToRemove = targetPpds.some((target) => {
                const trgParsed = parseScope(target);
                return (
                  trgParsed.kod === curParsed.kod &&
                  (trgParsed.slot === "ALL" || trgParsed.slot === curParsed.slot)
                );
              });
              return !isRequestedToRemove;
            });
          }
        }
      } else {
        finalScopes = Array.isArray(targetPpds) ? targetPpds : [targetPpds];
      }
    } else {
      const userScopeStr = `${userKod}:ALL`;

      if (action === "UNLOCK") {
        const currentHasAll = currentScopes.some(
          (s) => parseScope(s).kod === "ALL"
        );

        if (currentHasAll) {
          const allPPDs = Object.keys(APP_CONFIG.PPD_MAPPING || {});
          const originalSlot = parseScope(
            currentScopes.find((s) => parseScope(s).kod === "ALL")
          ).slot;
          const expandedScopes = allPPDs.map((k) => `${k}:${originalSlot}`);
          finalScopes = expandedScopes.filter((s) => parseScope(s).kod !== userKod);
        } else {
          finalScopes = currentScopes.filter((s) => parseScope(s).kod !== userKod);
        }
      } else {
        finalScopes = currentScopes.filter((s) => parseScope(s).kod !== userKod);
        finalScopes.push(userScopeStr);

        const allPPDs = Object.keys(APP_CONFIG.PPD_MAPPING || {});
        const currentDistrictCodes = finalScopes.map((s) => parseScope(s).kod);
        const hasAll =
          allPPDs.length > 0 &&
          allPPDs.every((k) => currentDistrictCodes.includes(k));

        if (hasAll || currentDistrictCodes.includes("ALL")) {
          finalScopes = ["ALL:ALL"];
        }
      }
    }

    const isDeleteMode = finalScopes.length === 0 || finalScopes.join("") === "";
    const joinedScopes = finalScopes.join(",");
    const resolvedNote =
      note || (existingLock && existingLock.komen ? existingLock.komen : null);

    const { error: rpcError } = await db.rpc("manage_bb_kunci", {
      p_mode: isDeleteMode ? "DELETE" : "UPSERT",
      p_tarikh: tarikh,
      p_komen: resolvedNote,
      p_kod_ppd: isDeleteMode ? null : joinedScopes,
      p_dikunci_oleh: dikunciOlehIdentifier,
      p_admin_email: adminEmail
    });

    if (!rpcError) {
      return {
        success: true,
        action: isDeleteMode ? "UNLOCKED" : existingLock ? "UPDATED" : "LOCKED"
      };
    }

    if (!isRpcMissingError(rpcError)) {
      throw formatDatabaseWriteError(rpcError, "Gagal mengemaskini kunci tarikh.");
    }

    if (isDeleteMode) {
      const { error } = await db
        .from("smpid_bb_kunci")
        .delete()
        .eq("tarikh", tarikh);
      if (error) {
        throw formatDatabaseWriteError(error, "Gagal membuka kunci tarikh.");
      }
      return { success: true, action: "UNLOCKED" };
    }

    if (existingLock) {
      const { error } = await db
        .from("smpid_bb_kunci")
        .update({
          komen: resolvedNote,
          kod_ppd: joinedScopes,
          dikunci_oleh: dikunciOlehIdentifier,
          admin_email: adminEmail,
          created_at: new Date().toISOString()
        })
        .eq("id", existingLock.id);

      if (error) {
        throw formatDatabaseWriteError(error, "Gagal mengemaskini kunci tarikh.");
      }
      return { success: true, action: "UPDATED" };
    }

    const { error } = await db.from("smpid_bb_kunci").insert([
      {
        tarikh,
        komen: note,
        kod_ppd: joinedScopes,
        dikunci_oleh: dikunciOlehIdentifier,
        admin_email: adminEmail,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      throw formatDatabaseWriteError(error, "Gagal mengunci tarikh.");
    }
    return { success: true, action: "LOCKED" };
  }
};