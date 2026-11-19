import { Bot, Context, InlineKeyboard, webhookCallback } from "npm:grammy@^1.30.0";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@^2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token, x-requested-with",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400"
};

interface SchoolRecord {
  kod_sekolah: string;
  nama_sekolah: string | null;
  jenis_sekolah: string | null;
  daerah: string | null;
  nama_gpict: string | null;
  no_telefon_gpict: string | null;
  emel_delima_gpict: string | null;
  telegram_id_gpict: number | null;
  nama_admin_delima: string | null;
  no_telefon_admin_delima: string | null;
  emel_delima_admin_delima: string | null;
  telegram_id_admin: number | null;
  nama_pgb: string | null;
  no_telefon_pgb: string | null;
  emel_delima_pgb: string | null;
  telegram_id_pgb: number | null;
  nama_gpk: string | null;
  no_telefon_gpk: string | null;
  emel_delima_gpk: string | null;
  telegram_id_gpk: number | null;
}

interface AdminUserRecord {
  role: string;
  telegram_id: number | null;
}

interface SchoolInfo {
  nama: string;
  daerah: string;
  admin_nama: string;
  admin_tel: string;
  kod_ou: string;
}

const PPD_CODES: Record<string, string> = {
  M010: "PPD JASIN",
  M020: "PPD MELAKA TENGAH",
  M030: "PPD ALOR GAJAH",
  JPNMEL: "JPN MELAKA"
};

const SCHOOL_ROLE_META: Record<
  string,
  { column: keyof SchoolRecord; label: string }
> = {
  gpict: { column: "telegram_id_gpict", label: "Guru Penyelaras ICT (GPICT)" },
  admin: { column: "telegram_id_admin", label: "Admin DELIMa" },
  pgb: { column: "telegram_id_pgb", label: "Pengetua / Guru Besar (PGB)" },
  gpk: { column: "telegram_id_gpk", label: "GPK Pentadbiran (GPK)" }
};

const PPD_ROLE_LABEL_MAP: Record<string, string> = {
  ppd_gpict: "PIC GPICT",
  ppd_delima: "PIC Admin DELIMa",
  ppd_admin: "PIC Admin DELIMa",
  ppd_m010: "Pegawai USTP PPD Jasin (M010)",
  ppd_m020: "Pegawai USTP PPD Melaka Tengah (M020)",
  ppd_m030: "Pegawai USTP PPD Alor Gajah (M030)",
  jpnmel: "Pegawai SSTP JPN Melaka"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? "-" : String(value).trim();
  if (!str) {
    return "-";
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) {
    return "";
  }
  const normalized = digits.startsWith("0") ? `6${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function formatMalayDate(rawDate: string): string {
  const trimmed = rawDate.trim();
  if (!trimmed || trimmed === "-") {
    return "-";
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  return parsed.toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
  if (
    raw &&
    typeof raw.record === "object" &&
    raw.record !== null &&
    !Array.isArray(raw.record)
  ) {
    return raw.record as Record<string, unknown>;
  }
  return raw || {};
}

function getBotToken(): string {
  const token = (
    Deno.env.get("TELEGRAM_BOT_TOKEN") ||
    Deno.env.get("BOT_TOKEN") ||
    ""
  ).trim();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN.");
  }
  return token;
}

function getSupabaseAdmin(): { client: SupabaseClient; schema: string } {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_KEY") ||
    ""
  ).trim();
  const rawSchema = (Deno.env.get("SUPABASE_SCHEMA") || "").trim();
  const schema =
    rawSchema && rawSchema.toLowerCase() !== "public" ? rawSchema : "nadim_data";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    db: { schema },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return { client, schema };
}

async function getSchoolInfo(
  client: SupabaseClient,
  kod: string
): Promise<SchoolInfo> {
  const cleanKod = kod.trim().toUpperCase();
  if (!cleanKod) {
    return {
      nama: "-",
      daerah: "TIADA MAKLUMAT",
      admin_nama: "",
      admin_tel: "",
      kod_ou: "TIADA KOD OU"
    };
  }

  try {
    const { data } = await client
      .from("smpid_sekolah_data")
      .select("nama_sekolah, daerah, nama_admin_delima, no_telefon_admin_delima")
      .eq("kod_sekolah", cleanKod)
      .maybeSingle();

    let kodOu = "TIADA KOD OU";
    try {
      const { data: dataOu } = await client
        .from("delima_data_sekolah")
        .select("kod_ou")
        .eq("kod_sekolah", cleanKod)
        .maybeSingle();
      if (dataOu && typeof dataOu.kod_ou === "string" && dataOu.kod_ou.trim()) {
        kodOu = dataOu.kod_ou.trim();
      }
    } catch {
      kodOu = "TIADA KOD OU";
    }

    return {
      nama: data?.nama_sekolah || cleanKod,
      daerah: data?.daerah || "TIADA MAKLUMAT",
      admin_nama: data?.nama_admin_delima || "",
      admin_tel: data?.no_telefon_admin_delima || "",
      kod_ou: kodOu
    };
  } catch {
    return {
      nama: cleanKod,
      daerah: "TIADA MAKLUMAT",
      admin_nama: "",
      admin_tel: "",
      kod_ou: "TIADA KOD OU"
    };
  }
}

function formatSlotStatus(ownerId: number | null | undefined, telegramId: number): string {
  if (!ownerId) {
    return "⚪ Kosong (Boleh Daftar)";
  }
  if (Number(ownerId) === telegramId) {
    return "✅ Anda (Boleh Kemaskini)";
  }
  return "⛔ Sudah Diisi (Orang Lain)";
}

async function getSchoolUI(
  client: SupabaseClient,
  kodSekolah: string,
  telegramId: number
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const { data: sekolah, error } = await client
    .from("smpid_sekolah_data")
    .select(
      "kod_sekolah, nama_sekolah, daerah, telegram_id_gpict, telegram_id_admin, telegram_id_pgb, telegram_id_gpk"
    )
    .eq("kod_sekolah", kodSekolah)
    .maybeSingle();

  if (error || !sekolah) {
    return null;
  }

  const gpictOwner = sekolah.telegram_id_gpict ? Number(sekolah.telegram_id_gpict) : null;
  const adminOwner = sekolah.telegram_id_admin ? Number(sekolah.telegram_id_admin) : null;
  const pgbOwner = sekolah.telegram_id_pgb ? Number(sekolah.telegram_id_pgb) : null;
  const gpkOwner = sekolah.telegram_id_gpk ? Number(sekolah.telegram_id_gpk) : null;

  const isGpictAvailable = !gpictOwner || gpictOwner === telegramId;
  const isAdminAvailable = !adminOwner || adminOwner === telegramId;
  const isPgbAvailable = !pgbOwner || pgbOwner === telegramId;
  const isGpkAvailable = !gpkOwner || gpkOwner === telegramId;

  const lines: string[] = [
    `🏫 <b>${escapeHtml(sekolah.nama_sekolah)}</b>`,
    `Kod: <code>${escapeHtml(sekolah.kod_sekolah)}</code>`,
    `Daerah: <b>${escapeHtml(sekolah.daerah)}</b>`,
    "",
    "📊 <b>Status Pendaftaran Semasa:</b>",
    `• GPICT: ${formatSlotStatus(gpictOwner, telegramId)}`,
    `• Admin DELIMa: ${formatSlotStatus(adminOwner, telegramId)}`,
    `• PGB: ${formatSlotStatus(pgbOwner, telegramId)}`,
    `• GPK: ${formatSlotStatus(gpkOwner, telegramId)}`,
    ""
  ];

  const keyboard = new InlineKeyboard();
  let hasSafeOptions = false;

  if (isGpictAvailable) {
    keyboard.text("👨‍💻 Daftar GPICT", `role:gpict:${sekolah.kod_sekolah}`).row();
    hasSafeOptions = true;
  }
  if (isAdminAvailable) {
    keyboard.text("📂 Daftar Admin DELIMa", `role:admin:${sekolah.kod_sekolah}`).row();
    hasSafeOptions = true;
  }
  if (isGpictAvailable && isAdminAvailable) {
    keyboard.text("✅ Daftar Kedua-dua Jawatan", `role:both:${sekolah.kod_sekolah}`).row();
  }
  if (isPgbAvailable) {
    keyboard.text("🎓 Daftar Pengetua / Guru Besar", `role:pgb:${sekolah.kod_sekolah}`).row();
    hasSafeOptions = true;
  }
  if (isGpkAvailable) {
    keyboard.text("📋 Daftar GPK Pentadbiran", `role:gpk:${sekolah.kod_sekolah}`).row();
    hasSafeOptions = true;
  }

  if (hasSafeOptions) {
    lines.push("👇 Sila pilih jawatan anda di bawah:");
  } else {
    lines.push("⚠️ <b>Tiada slot kosong.</b> Jawatan telah diisi.");
    lines.push("Gunakan pilihan Overwrite di bawah jika perlu.");
  }

  const isTakenByOther =
    !isGpictAvailable || !isAdminAvailable || !isPgbAvailable || !isGpkAvailable;
  if (isTakenByOther) {
    keyboard.text("⚠️ Timpa Data (Overwrite)", `overwrite_menu:${sekolah.kod_sekolah}`).row();
  }

  keyboard.text("❌ Tutup", "close");
  return { text: lines.join("\n"), keyboard };
}

async function getAdminUI(
  client: SupabaseClient,
  accessCode: string,
  telegramId: number
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const { data: roles, error } = await client
    .from("smpid_admin_users")
    .select("role, telegram_id");

  if (error || !roles) {
    return null;
  }

  const gpictRole = roles.find((r) => r.role === "ppd_gpict");
  const delimaRole = roles.find(
    (r) => r.role === "ppd_delima" || r.role === "ppd_admin"
  );
  const delimaRoleKey = delimaRole ? delimaRole.role : "ppd_delima";

  const gpictOwner = gpictRole?.telegram_id ? Number(gpictRole.telegram_id) : null;
  const delimaOwner = delimaRole?.telegram_id ? Number(delimaRole.telegram_id) : null;

  const isGpictAvailable = !gpictOwner || gpictOwner === telegramId;
  const isDelimaAvailable = !delimaOwner || delimaOwner === telegramId;

  const statusGpict = !gpictOwner
    ? "⚪ Kosong"
    : gpictOwner === telegramId
    ? "✅ Anda"
    : "⛔ Pegawai Lain";

  const statusDelima = !delimaOwner
    ? "⚪ Kosong"
    : delimaOwner === telegramId
    ? "✅ Anda"
    : "⛔ Pegawai Lain";

  const lines: string[] = [
    "🛡️ <b>PANEL PEGAWAI USTP (PPD)</b>",
    `Kod Akses: <code>${escapeHtml(accessCode)}</code>`,
    "",
    "📊 <b>Status Pegawai Meja:</b>",
    `• PIC GPICT: ${statusGpict}`,
    `• PIC DELIMa: ${statusDelima}`,
    ""
  ];

  const keyboard = new InlineKeyboard();
  let hasSafeOptions = false;

  if (isGpictAvailable) {
    keyboard.text("👨‍💻 Daftar PIC GPICT", "admin_act:register:ppd_gpict").row();
    hasSafeOptions = true;
  }
  if (isDelimaAvailable) {
    keyboard.text("📂 Daftar PIC DELIMa", `admin_act:register:${delimaRoleKey}`).row();
    hasSafeOptions = true;
  }

  if (hasSafeOptions) {
    lines.push("👇 Sila pilih portfolio anda:");
  } else {
    lines.push("⚠️ Semua slot pegawai telah diisi.");
  }

  if (!isGpictAvailable || !isDelimaAvailable) {
    keyboard.text("⚠️ Timpa Data (Overwrite)", `admin_act:overwrite_menu:${delimaRoleKey}`).row();
  }

  keyboard.text("❌ Tutup", "close");
  return { text: lines.join("\n"), keyboard };
}

async function assignAdminRole(
  client: SupabaseClient,
  role: string,
  telegramId: number
): Promise<boolean> {
  await client
    .from("smpid_admin_users")
    .update({ telegram_id: null })
    .eq("telegram_id", telegramId)
    .neq("role", role);

  const { data: existing } = await client
    .from("smpid_admin_users")
    .select("role")
    .eq("role", role)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from("smpid_admin_users")
      .update({ telegram_id: telegramId })
      .eq("role", role);
    return !error;
  }

  const { error } = await client
    .from("smpid_admin_users")
    .insert({ role, telegram_id: telegramId });
  return !error;
}

async function alertTaken(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({
    text: "⚠️ Slot diambil orang lain. Guna Overwrite jika perlu.",
    show_alert: true
  });
  try {
    await ctx.deleteMessage();
  } catch {
    return;
  }
}

function getBotInstance(): Bot {
  const token = getBotToken();
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const welcomeText = [
      "👋 <b>Selamat Datang ke Bot NADIM</b>",
      "",
      "Sila masukkan <b>Kod Sekolah</b> anda untuk semakan status &amp; pendaftaran.",
      "<i>(Contoh: MBA0001)</i>",
      "",
      "Gunakan /status untuk menyemak pautan akaun semasa anda."
    ].join("\n");

    await ctx.reply(welcomeText, { parse_mode: "HTML" });
  });

  bot.command("status", async (ctx) => {
    const chatId = ctx.from?.id;
    if (!chatId) {
      return;
    }

    try {
      const { client } = getSupabaseAdmin();
      const { data: schools } = await client
        .from("smpid_sekolah_data")
        .select(
          "kod_sekolah, nama_sekolah, telegram_id_gpict, telegram_id_admin, telegram_id_pgb, telegram_id_gpk"
        )
        .or(
          `telegram_id_gpict.eq.${chatId},telegram_id_admin.eq.${chatId},telegram_id_pgb.eq.${chatId},telegram_id_gpk.eq.${chatId}`
        );

      const { data: admins } = await client
        .from("smpid_admin_users")
        .select("role, telegram_id")
        .eq("telegram_id", chatId);

      const lines: string[] = ["📊 <b>Status Pautan Telegram NADIM</b>", ""];

      if (Array.isArray(schools) && schools.length > 0) {
        schools.forEach((s) => {
          const roles: string[] = [];
          if (Number(s.telegram_id_gpict) === chatId) roles.push("GPICT");
          if (Number(s.telegram_id_admin) === chatId) roles.push("Admin DELIMa");
          if (Number(s.telegram_id_pgb) === chatId) roles.push("PGB");
          if (Number(s.telegram_id_gpk) === chatId) roles.push("GPK");
          lines.push(
            `• <b>${escapeHtml(s.nama_sekolah)}</b> (<code>${escapeHtml(s.kod_sekolah)}</code>) — ${escapeHtml(roles.join(", "))}`
          );
        });
      }

      if (Array.isArray(admins) && admins.length > 0) {
        admins.forEach((a) => {
          const label = PPD_ROLE_LABEL_MAP[a.role] || a.role;
          lines.push(`• <b>Pentadbir:</b> ${escapeHtml(label)}`);
        });
      }

      if (lines.length === 2) {
        lines.push("⚪ Akaun Telegram anda belum dipautkan ke mana-mana sekolah atau peranan PPD.");
        lines.push("Sila masukkan <b>Kod Sekolah</b> anda untuk mendaftar.");
      }

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    } catch {
      await ctx.reply("❌ Maaf, gagal menyemak status pautan buat masa ini.");
    }
  });

  bot.on("message:text", async (ctx) => {
    const inputTeks = ctx.message.text.trim();
    if (inputTeks.startsWith("/")) {
      return;
    }

    const inputKod = inputTeks.toUpperCase().replace(/\s+/g, "");
    const telegramId = ctx.from?.id;
    if (!telegramId) {
      return;
    }

    try {
      const { client } = getSupabaseAdmin();

      if (PPD_CODES[inputKod]) {
        const ui = await getAdminUI(client, inputKod, telegramId);
        if (!ui) {
          await ctx.reply("❌ Ralat sistem database admin. Sila pastikan pangkalan data sedia.");
          return;
        }
        await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "HTML" });
        return;
      }

      if (inputKod.length < 3 || inputKod.length > 12) {
        await ctx.reply(
          "⚠️ Format kod tidak sah. Sila masukkan <b>Kod Sekolah</b> (Contoh: <code>MBA0001</code>).",
          { parse_mode: "HTML" }
        );
        return;
      }

      const ui = await getSchoolUI(client, inputKod, telegramId);
      if (!ui) {
        await ctx.reply(
          `❌ Kod sekolah <code>${escapeHtml(inputKod)}</code> tiada dalam rekod kami.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      await ctx.reply(ui.text, {
        reply_markup: ui.keyboard,
        parse_mode: "HTML"
      });
    } catch {
      await ctx.reply("❌ Berlaku ralat semasa mencari maklumat. Sila cuba sebentar lagi.");
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const dataString = ctx.callbackQuery.data || "";
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCallbackQuery({ text: "ID Telegram tidak sah.", show_alert: true });
      return;
    }

    if (dataString === "close") {
      await ctx.answerCallbackQuery();
      try {
        await ctx.deleteMessage();
      } catch {
        return;
      }
      return;
    }

    const { client } = getSupabaseAdmin();

    if (dataString.startsWith("admin_act:")) {
      const parts = dataString.split(":");
      const action = parts[1] || "";
      const role = parts[2] || "ppd_delima";

      if (action === "back") {
        const ui = await getAdminUI(client, "M030", telegramId);
        if (ui) {
          await ctx.editMessageText(ui.text, {
            reply_markup: ui.keyboard,
            parse_mode: "HTML"
          });
        }
        await ctx.answerCallbackQuery();
        return;
      }

      if (action === "register") {
        const { data: currentRole } = await client
          .from("smpid_admin_users")
          .select("telegram_id")
          .eq("role", role)
          .maybeSingle();

        if (
          currentRole?.telegram_id &&
          Number(currentRole.telegram_id) !== telegramId
        ) {
          await alertTaken(ctx);
          return;
        }

        const ok = await assignAdminRole(client, role, telegramId);
        if (!ok) {
          await ctx.answerCallbackQuery({ text: "Gagal simpan.", show_alert: true });
          return;
        }

        const roleName = PPD_ROLE_LABEL_MAP[role] || role;
        await ctx.answerCallbackQuery({ text: "Berjaya!" });
        await ctx.editMessageText(
          [
            "✅ <b>Pendaftaran Pegawai Berjaya!</b>",
            "",
            `Anda kini berdaftar sebagai: <b>${escapeHtml(roleName)}</b>`
          ].join("\n"),
          { parse_mode: "HTML" }
        );
        return;
      }

      if (action === "overwrite_menu") {
        const delimaRoleKey = role || "ppd_delima";
        const keyboard = new InlineKeyboard()
          .text("⚠️ Timpa PIC GPICT", "admin_act:force:ppd_gpict")
          .row()
          .text("⚠️ Timpa PIC DELIMa", `admin_act:force:${delimaRoleKey}`)
          .row()
          .text("« Kembali", "admin_act:back");

        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          "⚠️ <b>MOD TIMPA DATA (OVERWRITE)</b> ⚠️\n\nSila pilih jawatan pegawai yang ingin diambil alih:",
          { reply_markup: keyboard, parse_mode: "HTML" }
        );
        return;
      }

      if (action === "force") {
        const ok = await assignAdminRole(client, role, telegramId);
        if (!ok) {
          await ctx.answerCallbackQuery({ text: "Gagal overwrite.", show_alert: true });
          return;
        }

        const roleName = PPD_ROLE_LABEL_MAP[role] || role;
        await ctx.answerCallbackQuery({ text: "Berjaya Timpa Data!" });
        await ctx.editMessageText(
          [
            "✅ <b>Akses Diambil Alih!</b>",
            "",
            `Anda kini berdaftar sebagai: <b>${escapeHtml(roleName)}</b>`
          ].join("\n"),
          { parse_mode: "HTML" }
        );
        return;
      }
    }

    if (dataString.startsWith("bind_ppd:")) {
      const role = dataString.split(":")[1] || "";
      const roleLabel = PPD_ROLE_LABEL_MAP[role];
      if (!role || !roleLabel) {
        await ctx.answerCallbackQuery({ text: "Peranan pentadbir tidak sah.", show_alert: true });
        return;
      }

      const ok = await assignAdminRole(client, role, telegramId);
      if (!ok) {
        await ctx.answerCallbackQuery({ text: "Gagal menyimpan rekod pentadbir.", show_alert: true });
        return;
      }

      await ctx.answerCallbackQuery({ text: "Pautan pentadbir berjaya!" });
      await ctx.editMessageText(
        [
          "✅ <b>Pendaftaran Pegawai Berjaya!</b>",
          "",
          `Anda kini berdaftar sebagai: <b>${escapeHtml(roleLabel)}</b>`
        ].join("\n"),
        { parse_mode: "HTML" }
      );
      return;
    }

    const parts = dataString.split(":");
    const prefix = parts[0] || "";

    if (prefix === "back") {
      const kod = parts[1] || "";
      const ui = await getSchoolUI(client, kod, telegramId);
      if (ui) {
        await ctx.editMessageText(ui.text, {
          reply_markup: ui.keyboard,
          parse_mode: "HTML"
        });
      }
      await ctx.answerCallbackQuery();
      return;
    }

    if (prefix === "overwrite_menu") {
      const kod = parts[1] || "";
      const keyboard = new InlineKeyboard()
        .text("⚠️ Timpa GPICT", `force:gpict:${kod}`)
        .row()
        .text("⚠️ Timpa Admin DELIMa", `force:admin:${kod}`)
        .row()
        .text("⚠️ Timpa Kedua-dua", `force:both:${kod}`)
        .row()
        .text("⚠️ Timpa PGB", `force:pgb:${kod}`)
        .text("⚠️ Timpa GPK", `force:gpk:${kod}`)
        .row()
        .text("« Kembali", `back:${kod}`);

      await ctx.answerCallbackQuery();
      await ctx.editMessageText(
        "⚠️ <b>MOD OVERWRITE (SEKOLAH)</b> ⚠️\n\nSila pilih jawatan untuk diambil alih secara paksa:",
        { reply_markup: keyboard, parse_mode: "HTML" }
      );
      return;
    }

    if (prefix === "role" || prefix === "force" || prefix === "bind_sch") {
      const isLegacy = prefix === "bind_sch";
      const role = isLegacy ? parts[2] || "" : parts[1] || "";
      const kodSekolah = isLegacy ? parts[1] || "" : parts[2] || "";
      const isForce = prefix === "force";

      if (!kodSekolah || !role) {
        await ctx.answerCallbackQuery({ text: "Pilihan tidak sah.", show_alert: true });
        return;
      }

      const { data: sekolah, error } = await client
        .from("smpid_sekolah_data")
        .select(
          "kod_sekolah, nama_sekolah, telegram_id_gpict, telegram_id_admin, telegram_id_pgb, telegram_id_gpk"
        )
        .eq("kod_sekolah", kodSekolah)
        .maybeSingle();

      if (error || !sekolah) {
        await ctx.answerCallbackQuery({ text: "Ralat data sekolah.", show_alert: true });
        return;
      }

      if (!isForce) {
        const gpictSafe =
          !sekolah.telegram_id_gpict || Number(sekolah.telegram_id_gpict) === telegramId;
        const adminSafe =
          !sekolah.telegram_id_admin || Number(sekolah.telegram_id_admin) === telegramId;
        const pgbSafe =
          !sekolah.telegram_id_pgb || Number(sekolah.telegram_id_pgb) === telegramId;
        const gpkSafe =
          !sekolah.telegram_id_gpk || Number(sekolah.telegram_id_gpk) === telegramId;

        if (
          (role === "gpict" && !gpictSafe) ||
          (role === "admin" && !adminSafe) ||
          (role === "both" && (!gpictSafe || !adminSafe)) ||
          (role === "pgb" && !pgbSafe) ||
          (role === "gpk" && !gpkSafe)
        ) {
          await alertTaken(ctx);
          return;
        }
      }

      let updateData: Record<string, number> = {};
      let roleText = "";

      if (role === "both") {
        updateData = {
          telegram_id_gpict: telegramId,
          telegram_id_admin: telegramId
        };
        roleText = "Guru Penyelaras ICT & Admin DELIMa";
      } else {
        const meta = SCHOOL_ROLE_META[role];
        if (!meta) {
          await ctx.answerCallbackQuery({ text: "Pilihan jawatan tidak sah.", show_alert: true });
          return;
        }
        updateData[meta.column] = telegramId;
        roleText = meta.label;
      }

      const { error: errUpdate } = await client
        .from("smpid_sekolah_data")
        .update(updateData)
        .eq("kod_sekolah", kodSekolah);

      if (errUpdate) {
        await ctx.answerCallbackQuery({ text: "Gagal menyimpan.", show_alert: true });
        return;
      }

      const successTitle = isForce
        ? "✅ <b>Data Berjaya Ditimpa!</b>"
        : "✅ <b>Pendaftaran Berjaya!</b>";

      await ctx.answerCallbackQuery({ text: "Berjaya!" });
      await ctx.editMessageText(
        [
          successTitle,
          "",
          `Sekolah: <b>${escapeHtml(sekolah.nama_sekolah)}</b> (<code>${escapeHtml(kodSekolah)}</code>)`,
          `Jawatan: <b>${escapeHtml(roleText)}</b>`,
          "Status: <b>Aktif</b>"
        ].join("\n"),
        { parse_mode: "HTML" }
      );
      return;
    }

    await ctx.answerCallbackQuery();
  });

  return bot;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  htmlText: string
): Promise<boolean> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: htmlText,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
  return response.ok;
}

async function broadcastTelegram(
  botToken: string,
  chatIds: Iterable<number>,
  htmlText: string
): Promise<{ sent: number; failed: number }> {
  const uniqueIds = Array.from(
    new Set(
      Array.from(chatIds).filter(
        (id) => typeof id === "number" && Number.isFinite(id) && id > 0
      )
    )
  );

  let sent = 0;
  let failed = 0;

  for (const chatId of uniqueIds) {
    try {
      const ok = await sendTelegramMessage(botToken, chatId, htmlText);
      if (ok) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { sent, failed };
}

function collectSchoolTelegramIds(
  school: Partial<SchoolRecord> | null,
  preferredRole?: string
): number[] {
  if (!school) {
    return [];
  }

  const normalizedRole = (preferredRole || "").toUpperCase();
  const prioritized: number[] = [];
  const allBound: number[] = [];

  if (school.telegram_id_gpict) {
    const id = Number(school.telegram_id_gpict);
    allBound.push(id);
    if (normalizedRole.includes("GPICT")) prioritized.push(id);
  }
  if (school.telegram_id_admin) {
    const id = Number(school.telegram_id_admin);
    allBound.push(id);
    if (normalizedRole.includes("ADMIN") || normalizedRole.includes("DELIMA")) {
      prioritized.push(id);
    }
  }
  if (school.telegram_id_pgb) {
    const id = Number(school.telegram_id_pgb);
    allBound.push(id);
    if (
      normalizedRole.includes("PGB") ||
      normalizedRole.includes("PENGETUA") ||
      normalizedRole.includes("GURU BESAR")
    ) {
      prioritized.push(id);
    }
  }
  if (school.telegram_id_gpk) {
    const id = Number(school.telegram_id_gpk);
    allBound.push(id);
    if (normalizedRole.includes("GPK")) prioritized.push(id);
  }

  return prioritized.length > 0 ? prioritized : allBound;
}

function filterAdminIdsByDistrict(
  adminRows: AdminUserRecord[],
  daerah: string | null | undefined,
  kodSekolah: string | null | undefined
): number[] {
  const targetDaerah = (daerah || "").toUpperCase();
  const targetKod = (kodSekolah || "").toUpperCase();
  const result: number[] = [];

  for (const row of adminRows) {
    if (!row.telegram_id) {
      continue;
    }
    const roleLower = (row.role || "").toLowerCase();
    const id = Number(row.telegram_id);

    const isJasinRole = roleLower.includes("m010") || roleLower.includes("jasin");
    const isMelakaTengahRole =
      roleLower.includes("m020") ||
      roleLower.includes("melaka_tengah") ||
      roleLower.includes("melakatengah");
    const isAlorGajahRole =
      roleLower.includes("m030") ||
      roleLower.includes("alor_gajah") ||
      roleLower.includes("alorgajah");

    if (isJasinRole || isMelakaTengahRole || isAlorGajahRole) {
      if (isJasinRole && (targetDaerah.includes("JASIN") || targetKod === "M010")) {
        result.push(id);
      } else if (
        isMelakaTengahRole &&
        (targetDaerah.includes("MELAKA TENGAH") || targetKod === "M020")
      ) {
        result.push(id);
      } else if (
        isAlorGajahRole &&
        (targetDaerah.includes("ALOR GAJAH") || targetKod === "M030")
      ) {
        result.push(id);
      }
    } else {
      result.push(id);
    }
  }

  return result;
}

async function fetchSchoolAndAdmins(
  client: SupabaseClient,
  kodSekolah: string
): Promise<{ school: SchoolRecord | null; admins: AdminUserRecord[] }> {
  const [schoolRes, adminRes] = await Promise.all([
    kodSekolah
      ? client
          .from("smpid_sekolah_data")
          .select("*")
          .eq("kod_sekolah", kodSekolah)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from("smpid_admin_users")
      .select("role, telegram_id")
      .not("telegram_id", "is", null)
  ]);

  return {
    school: (schoolRes.data as SchoolRecord | null) || null,
    admins: (adminRes.data as AdminUserRecord[] | null) || []
  };
}

async function handleProfileNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || payload.kod || "")
    .trim()
    .toUpperCase();
  const { school, admins } = await fetchSchoolAndAdmins(client, kodSekolah);

  const namaSekolah = String(
    payload.nama_sekolah || payload.nama || school?.nama_sekolah || kodSekolah || "-"
  );
  const daerah = String(payload.daerah || school?.daerah || "-");
  const updatedBy = String(payload.updated_by || "").trim().toUpperCase();
  const catatan = String(payload.catatan || payload.perubahan || "").trim();

  const isPpdUpdate = updatedBy === "PENTADBIR PPD";
  const icon = isPpdUpdate ? "🛡️" : "🔔";
  const actText = isPpdUpdate
    ? "dikemaskini oleh PENTADBIR PPD."
    : "dikemaskini oleh pihak sekolah.";

  const lines: string[] = [
    `${icon} <b>KEMASKINI DATA SEKOLAH</b>`,
    "",
    `🏫 <b>${escapeHtml(namaSekolah)}</b>`,
    `Kod: <code>${escapeHtml(kodSekolah)}</code>`,
    "",
    `Status: Maklumat sekolah ini baru sahaja ${escapeHtml(actText)}`
  ];

  if (catatan) {
    lines.push(`Butiran: <i>${escapeHtml(catatan)}</i>`);
  }

  const recipients = filterAdminIdsByDistrict(admins, daerah, kodSekolah);
  return broadcastTelegram(botToken, recipients, lines.join("\n"));
}

async function handleTicketNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || payload.kod || "")
    .trim()
    .toUpperCase();
  const [schoolInfo, { admins }] = await Promise.all([
    getSchoolInfo(client, kodSekolah),
    fetchSchoolAndAdmins(client, kodSekolah)
  ]);

  const namaSekolah = String(
    payload.nama_sekolah || payload.nama || schoolInfo.nama || kodSekolah || "-"
  );
  const daerah = String(payload.daerah || schoolInfo.daerah || "-");
  const perananPengirim = String(
    payload.peranan_pengirim || payload.peranan || "-"
  );
  const tajuk = String(payload.tajuk || "-");
  const mesej = String(payload.butiran_masalah || payload.mesej || "-");
  const ticketId = payload.id ? `#${payload.id}` : "";

  const lines: string[] = [
    "🆘 <b>TIKET ADUAN BARU</b>",
    ""
  ];

  if (ticketId) {
    lines.push(`🆔 ID Tiket: <code>${escapeHtml(ticketId)}</code>`);
  }

  lines.push(
    `🏫 Sekolah: <b>${escapeHtml(namaSekolah)}</b> (<code>${escapeHtml(kodSekolah)}</code>)`,
    `📍 Daerah: <b>${escapeHtml(daerah)}</b>`,
    `👤 Pengirim: <b>${escapeHtml(perananPengirim)}</b>`,
    `📌 Tajuk: <b>${escapeHtml(tajuk)}</b>`,
    "",
    `📝 Mesej: <i>${escapeHtml(mesej)}</i>`
  );

  const recipients = filterAdminIdsByDistrict(admins, daerah, kodSekolah);
  return broadcastTelegram(botToken, recipients, lines.join("\n"));
}

async function handleReplyTicketNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || payload.kod || "")
    .trim()
    .toUpperCase();
  const [schoolInfo, { school }] = await Promise.all([
    getSchoolInfo(client, kodSekolah),
    fetchSchoolAndAdmins(client, kodSekolah)
  ]);

  const namaSekolah = String(
    payload.nama_sekolah || payload.nama || schoolInfo.nama || kodSekolah || "-"
  );
  const perananPengirim = String(
    payload.peranan_pengirim || payload.peranan || ""
  );
  const tajuk = String(payload.tajuk || "-");
  const status = String(payload.status || "SELESAI").trim().toUpperCase();
  const balasan = String(payload.balasan_admin || payload.balasan || "-");

  const message = [
    `✅ <b>STATUS TIKET: ${escapeHtml(status)}</b>`,
    "",
    `🏫 Sekolah: <b>${escapeHtml(namaSekolah)}</b> (<code>${escapeHtml(kodSekolah)}</code>)`,
    `📌 Tajuk: <b>${escapeHtml(tajuk)}</b>`,
    `💬 Respon PPD: <i>${escapeHtml(balasan)}</i>`
  ].join("\n");

  const recipients = collectSchoolTelegramIds(school, perananPengirim);
  return broadcastTelegram(botToken, recipients, message);
}

async function handleBookingNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || payload.kod || "")
    .trim()
    .toUpperCase();
  const { school, admins } = await fetchSchoolAndAdmins(client, kodSekolah);

  const namaSekolah = String(
    payload.nama_sekolah || payload.nama || school?.nama_sekolah || kodSekolah || "-"
  );
  const daerah = String(payload.daerah || school?.daerah || "-");
  const tajuk = String(payload.tajuk_bengkel || payload.tajuk || "-");
  const rawTarikh = String(payload.tarikh || "-");
  const masa = String(payload.masa || "-").trim().toUpperCase();
  const pic = String(payload.nama_pic || payload.pic || "-");
  const tel = String(payload.no_tel_pic || payload.tel || "-").trim();

  const formattedDate = formatMalayDate(rawTarikh);
  const waUrl = formatWhatsAppUrl(tel);
  const contactLine = waUrl
    ? `📞 <a href="${escapeHtml(waUrl)}">${escapeHtml(tel)}</a>`
    : `📞 <b>${escapeHtml(tel)}</b>`;

  const message = [
    "📅 <b>TEMPAHAN BIMBINGAN BARU</b>",
    "",
    `🏫 <b>${escapeHtml(namaSekolah)}</b> (<code>${escapeHtml(kodSekolah)}</code>)`,
    `📌 <b>${escapeHtml(tajuk)}</b>`,
    `🗓️ <b>${escapeHtml(formattedDate)}</b> (<b>${escapeHtml(masa)}</b>)`,
    `👤 PIC: <b>${escapeHtml(pic)}</b>`,
    contactLine
  ].join("\n");

  const recipients = filterAdminIdsByDistrict(admins, daerah, kodSekolah);
  return broadcastTelegram(botToken, recipients, message);
}

async function handleDelimaNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || payload.kod || "")
    .trim()
    .toUpperCase();
  const kategori = String(payload.kategori || "-");
  const catatan = String(payload.catatan || "-");
  const senaraiRaw = Array.isArray(payload.senarai_calon)
    ? payload.senarai_calon
    : Array.isArray(payload.senarai_pemilik)
    ? payload.senarai_pemilik
    : [];

  const [schoolInfo, { admins }] = await Promise.all([
    getSchoolInfo(client, kodSekolah),
    fetchSchoolAndAdmins(client, kodSekolah)
  ]);

  let title = "KEMASKINI STATUS ID (KELOMPOK)";
  if (catatan === "Berpindah MASUK ke sekolah ini") {
    title = "MOHON PINDAH MASUK ID (KELOMPOK)";
  }

  const senaraiLines: string[] = [];
  senaraiRaw.forEach((item: unknown, index: number) => {
    const entry = (typeof item === "object" && item !== null ? item : {}) as Record<
      string,
      unknown
    >;
    const nama = escapeHtml(entry.nama || "-");
    const emel = escapeHtml(entry.id_delima || "Tiada emel");
    senaraiLines.push(`${index + 1}. <b>${nama}</b>\n   📧 <i>${emel}</i>`);
  });

  const senaraiHtml = senaraiLines.length > 0 ? senaraiLines.join("\n") : "-";

  const lines: string[] = [
    `🔄 <b>${escapeHtml(title)}</b>`,
    "",
    `🏫 Sekolah: <b>${escapeHtml(schoolInfo.nama)}</b> (<code>${escapeHtml(kodSekolah)}</code>)`,
    `📍 Daerah: <b>${escapeHtml(schoolInfo.daerah)}</b>`,
    `🏢 Kod OU: <code>${escapeHtml(schoolInfo.kod_ou)}</code>`
  ];

  if (schoolInfo.admin_tel) {
    const waUrl = formatWhatsAppUrl(schoolInfo.admin_tel);
    lines.push(`👨‍💻 <b>Admin DELIMa:</b> ${escapeHtml(schoolInfo.admin_nama || "-")}`);
    if (waUrl) {
      lines.push(`💬 <a href="${escapeHtml(waUrl)}">WhatsApp Admin</a>`);
    }
  }

  lines.push(
    `👥 Kategori: <b>${escapeHtml(kategori)}</b>`,
    `📝 Catatan: <i>${escapeHtml(catatan)}</i>`,
    "",
    "📋 <b>Senarai Pemilik ID:</b>",
    senaraiHtml
  );

  const message = lines.join("\n");
  const groupChatId = (
    Deno.env.get("DELIMA_GROUP_CHAT_ID") || "-1003371951236"
  ).trim();

  let groupSent = false;
  if (groupChatId) {
    try {
      groupSent = await sendTelegramMessage(botToken, groupChatId, message);
    } catch {
      groupSent = false;
    }
  }

  const adminIds = filterAdminIdsByDistrict(admins, schoolInfo.daerah, kodSekolah);
  const broadcastResult = await broadcastTelegram(botToken, adminIds, message);

  return {
    groupSent,
    ...broadcastResult
  };
}

async function handleReplyDelimaNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || payload.kod || "")
    .trim()
    .toUpperCase();
  const kategori = String(payload.kategori || "-");
  const nama = String(payload.nama || payload.nama_pemilik || "-");
  const status = String(payload.status || "SELESAI").trim().toUpperCase();

  const [schoolInfo, { school }] = await Promise.all([
    getSchoolInfo(client, kodSekolah),
    fetchSchoolAndAdmins(client, kodSekolah)
  ]);

  const message = [
    `✅ <b>STATUS DELIMA: ${escapeHtml(status)}</b>`,
    "",
    `🏫 Sekolah: <b>${escapeHtml(schoolInfo.nama)}</b> (<code>${escapeHtml(kodSekolah)}</code>)`,
    `👥 Kategori: <b>${escapeHtml(kategori)}</b>`,
    `👤 Nama: <b>${escapeHtml(nama)}</b>`,
    "💬 Tindakan PPD telah selesai."
  ].join("\n");

  const targetId = school?.telegram_id_admin || school?.telegram_id_gpict;
  if (!targetId) {
    return { sent: 0, failed: 0 };
  }

  return broadcastTelegram(botToken, [Number(targetId)], message);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (
    req.method === "GET" &&
    (pathname.endsWith("/smpid-notify") || pathname.endsWith("/health"))
  ) {
    const schema = (Deno.env.get("SUPABASE_SCHEMA") || "nadim_data").trim();
    return jsonResponse({
      status: "ok",
      service: "smpid-notify",
      schema
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  const isApiRoute =
    pathname.endsWith("/notify") ||
    pathname.endsWith("/notify-ticket") ||
    pathname.endsWith("/reply-ticket") ||
    pathname.endsWith("/notify-booking") ||
    pathname.endsWith("/notify-delima") ||
    pathname.endsWith("/reply-delima");

  if (!isApiRoute) {
    const expectedSecret = (Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "").trim();
    if (expectedSecret) {
      const providedSecret = (
        req.headers.get("x-telegram-bot-api-secret-token") || ""
      ).trim();
      if (providedSecret !== expectedSecret) {
        return jsonResponse({ error: "Unauthorized Webhook Request" }, 401);
      }
    }

    try {
      const bot = getBotInstance();
      const handleUpdate = webhookCallback(bot, "std/http");
      return await handleUpdate(req);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Webhook processing error";
      return jsonResponse({ error: "Internal Server Error", message: msg }, 500);
    }
  }

  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Bad Request", message: "Invalid JSON payload" }, 400);
  }

  const payload = normalizePayload(rawBody);

  try {
    const botToken = getBotToken();
    const { client } = getSupabaseAdmin();

    if (pathname.endsWith("/notify")) {
      const result = await handleProfileNotify(payload, client, botToken);
      return jsonResponse({ status: "success", success: true, route: "notify", ...result });
    }

    if (pathname.endsWith("/notify-ticket")) {
      const result = await handleTicketNotify(payload, client, botToken);
      return jsonResponse({
        status: "success",
        success: true,
        route: "notify-ticket",
        ...result
      });
    }

    if (pathname.endsWith("/reply-ticket")) {
      const result = await handleReplyTicketNotify(payload, client, botToken);
      return jsonResponse({
        status: "success",
        success: true,
        route: "reply-ticket",
        ...result
      });
    }

    if (pathname.endsWith("/notify-booking")) {
      const result = await handleBookingNotify(payload, client, botToken);
      return jsonResponse({
        status: "success",
        success: true,
        route: "notify-booking",
        ...result
      });
    }

    if (pathname.endsWith("/notify-delima")) {
      const result = await handleDelimaNotify(payload, client, botToken);
      return jsonResponse({
        status: "success",
        success: true,
        route: "notify-delima",
        ...result
      });
    }

    if (pathname.endsWith("/reply-delima")) {
      const result = await handleReplyDelimaNotify(payload, client, botToken);
      return jsonResponse({
        status: "success",
        success: true,
        route: "reply-delima",
        ...result
      });
    }

    return jsonResponse({ error: "Not Found", path: pathname }, 404);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Notification dispatch error";
    return jsonResponse({ status: "error", error: "Internal Server Error", message: msg }, 500);
  }
});