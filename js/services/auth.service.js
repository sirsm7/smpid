import { initDatabaseClient, requireDbAsync } from "../core/db.js";
import { APP_CONFIG } from "../config/app.config.js";

function getDefaultPassword() {
  if (
    APP_CONFIG &&
    APP_CONFIG.DEFAULTS &&
    typeof APP_CONFIG.DEFAULTS.PASSWORD === "string" &&
    APP_CONFIG.DEFAULTS.PASSWORD.trim() !== ""
  ) {
    return APP_CONFIG.DEFAULTS.PASSWORD;
  }
  return "ppdag@12345";
}

async function getReadyDb() {
  if (typeof requireDbAsync === "function") {
    return requireDbAsync();
  }
  const client = await initDatabaseClient();
  if (!client) {
    throw new Error(
      "Sambungan pangkalan data disekat atau belum sedia. Sila periksa sambungan internet anda."
    );
  }
  return client;
}

export const AuthService = {
  async login(email, password) {
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const rawPassword = typeof password === "string" ? password : "";

    if (!cleanEmail || !rawPassword) {
      throw new Error("Sila masukkan emel dan kata laluan yang sah.");
    }

    const db = await getReadyDb();
    const { data, error } = await db
      .from("smpid_users")
      .select("id, kod_sekolah, role, email, password")
      .eq("email", cleanEmail)
      .single();

    if (error || !data) {
      throw new Error("Emel pengguna tidak ditemui.");
    }

    const storedPassword = typeof data.password === "string" ? data.password : "";
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    if (isBcryptHash) {
      const { data: rpcResult, error: rpcError } = await db.rpc("login_manual", {
        input_email: cleanEmail,
        input_password: rawPassword
      });

      if (
        rpcError ||
        !rpcResult ||
        rpcResult.success === false ||
        rpcResult.status === "error"
      ) {
        throw new Error("Kata laluan salah.");
      }
    } else if (storedPassword !== rawPassword) {
      throw new Error("Kata laluan salah.");
    }

    return {
      id: data.id,
      kod_sekolah: data.kod_sekolah,
      role: data.role,
      email: data.email || cleanEmail
    };
  },

  async getAllAdmins() {
    const db = await getReadyDb();
    const { data, error } = await db
      .from("smpid_users")
      .select("id, email, role, kod_sekolah")
      .in("role", ["SUPER_ADMIN", "JPNMEL", "ADMIN", "PPD_UNIT"])
      .order("role", { ascending: true });

    if (error) {
      throw error;
    }
    return Array.isArray(data) ? data : [];
  },

  async createAdmin(email, password, role, kodSekolah = "M030") {
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanRole = typeof role === "string" ? role.trim().toUpperCase() : "";
    const cleanKod =
      typeof kodSekolah === "string" && kodSekolah.trim()
        ? kodSekolah.trim().toUpperCase()
        : "M030";

    if (!cleanEmail || !password || !cleanRole) {
      throw new Error("Maklumat emel, kata laluan, dan peranan wajib diisi.");
    }

    const db = await getReadyDb();
    const newId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const { error } = await db.from("smpid_users").insert([
      {
        id: newId,
        kod_sekolah: cleanKod,
        email: cleanEmail,
        password: String(password),
        role: cleanRole
      }
    ]);

    if (error) {
      throw error;
    }
    return { success: true };
  },

  async changePassword(userId, oldPassword, newPassword) {
    if (!userId || !oldPassword || !newPassword) {
      throw new Error("Maklumat kata laluan tidak lengkap.");
    }

    const db = await getReadyDb();
    const { data: user, error: fetchError } = await db
      .from("smpid_users")
      .select("email, password")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      throw new Error("Pengguna tidak ditemui.");
    }

    const storedPassword = typeof user.password === "string" ? user.password : "";
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(storedPassword);

    if (isBcryptHash && user.email) {
      const { data: changed, error: rpcError } = await db.rpc("change_my_password", {
        input_email: user.email,
        old_pass: oldPassword,
        new_pass: newPassword
      });

      if (rpcError || changed === false) {
        throw new Error("Kata laluan lama tidak sah.");
      }
      return { success: true };
    }

    if (storedPassword !== oldPassword) {
      throw new Error("Kata laluan lama tidak sah.");
    }

    const { error: updateError } = await db
      .from("smpid_users")
      .update({ password: newPassword })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }
    return { success: true };
  },

  async forceResetUserPassword(targetUserId, newPassword = getDefaultPassword()) {
    if (!targetUserId) {
      throw new Error("ID pengguna sasaran tidak sah.");
    }

    const db = await getReadyDb();
    const { error } = await db
      .from("smpid_users")
      .update({ password: newPassword })
      .eq("id", targetUserId);

    if (error) {
      throw error;
    }
    return { success: true };
  },

  async resetSchoolPassword(kodSekolah, defaultPass = getDefaultPassword()) {
    const cleanKod = typeof kodSekolah === "string" ? kodSekolah.trim().toUpperCase() : "";
    if (!cleanKod) {
      throw new Error("Kod sekolah tidak sah.");
    }

    const db = await getReadyDb();
    const { error } = await db
      .from("smpid_users")
      .update({ password: defaultPass })
      .eq("kod_sekolah", cleanKod);

    if (error) {
      throw error;
    }
    return { success: true };
  },

  async deleteUser(id) {
    if (!id) {
      throw new Error("ID pengguna tidak sah.");
    }

    const db = await getReadyDb();
    const { error } = await db.from("smpid_users").delete().eq("id", id);

    if (error) {
      throw error;
    }
    return { success: true };
  }
};

if (typeof window !== "undefined") {
  window.AuthService = AuthService;
}

export default AuthService;