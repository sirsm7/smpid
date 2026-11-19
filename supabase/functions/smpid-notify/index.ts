import { Bot, InlineKeyboard, webhookCallback } from "npm:grammy@^1.30.0";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@^2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
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

const PPD_CODES: Record<string, string> = {
  M010: "JASIN",
  M020: "MELAKA TENGAH",
  M030: "ALOR GAJAH",
  JPNMEL: "JPN MELAKA"
};

const SCHOOL_ROLE_COLUMN_MAP: Record<
  string,
  { column: keyof SchoolRecord; label: string }
> = {
  gpict: { column: "telegram_id_gpict", label: "Guru Penyelaras ICT (GPICT)" },
  admin: { column: "telegram_id_admin", label: "Admin DELIMa Sekolah" },
  pgb: { column: "telegram_id_pgb", label: "Pengetua / Guru Besar (PGB)" },
  gpk: { column: "telegram_id_gpk", label: "GPK Pentadbiran (GPK)" }
};

const PPD_ROLE_LABEL_MAP: Record<string, string> = {
  ppd_gpict: "Pegawai Meja GPICT PPD",
  ppd_admin: "Pegawai Meja DELIMa PPD",
  ppd_m010: "Pegawai USTP PPD Jasin (M010)",
  ppd_m020: "Pegawai USTP PPD Melaka Tengah (M020)",
  ppd_m030: "Pegawai USTP PPD Alor Gajah (M030)",
  jpnmel: "Pegawai Sektor Sumber Teknologi Pendidikan (JPN)"
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

function getSupabaseAdmin(): { client: SupabaseClient; schema: string } {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const rawSchema = (Deno.env.get("SUPABASE_SCHEMA") || "").trim();
  const schema = rawSchema && rawSchema.toLowerCase() !== "public" ? rawSchema : "nadim_data";

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

function getBotInstance(): Bot {
  const token = (Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim();
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN.");
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const welcomeText = [
      "<b>Selamat Datang ke Bot Rasmi NaDIM (SMPID)</b>",
      "",
      "Bot ini digunakan untuk memautkan akaun Telegram anda bagi menerima notifikasi masa nyata berkaitan profil sekolah, aduan ICT, dan tempahan bimbingan.",
      "",
      "<b>Cara Pendaftaran:</b>",
      "1. Taip <b>KOD SEKOLAH</b> anda (contoh: <code>MBA0001</code>) dan hantar.",
      "2. Pilih butang jawatan anda yang dipaparkan.",
      "",
      "<i>Untuk Pegawai PPD / JPN, sila taip kod jabatan anda (contoh: M010, M020, M030, atau JPNMEL).</i>"
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

      const lines: string[] = ["<b>Status Pautan Telegram NaDIM</b>", ""];

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
        lines.push("Akaun Telegram anda belum dipautkan ke mana-mana sekolah atau peranan PPD.");
        lines.push("Sila taip <b>KOD SEKOLAH</b> anda untuk mendaftar.");
      }

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    } catch {
      await ctx.reply("Maaf, gagal menyemak status pautan buat masa ini.");
    }
  });

  bot.on("message:text", async (ctx) => {
    const rawText = ctx.message.text.trim();
    if (rawText.startsWith("/")) {
      return;
    }

    const code = rawText.toUpperCase().replace(/\s+/g, "");

    if (PPD_CODES[code]) {
      const keyboard = new InlineKeyboard()
        .text("Pegawai Meja GPICT", "bind_ppd:ppd_gpict")
        .text("Pegawai Meja DELIMa", "bind_ppd:ppd_admin")
        .row();

      if (code === "M010") {
        keyboard.text("USTP PPD Jasin (M010)", "bind_ppd:ppd_m010");
      } else if (code === "M020") {
        keyboard.text("USTP PPD Melaka Tengah (M020)", "bind_ppd:ppd_m020");
      } else if (code === "M030") {
        keyboard.text("USTP PPD Alor Gajah (M030)", "bind_ppd:ppd_m030");
      } else if (code === "JPNMEL") {
        keyboard.text("Pegawai SSTP JPN Melaka", "bind_ppd:jpnmel");
      }

      await ctx.reply(
        `Jabatan dikesan: <b>${escapeHtml(PPD_CODES[code])} (${escapeHtml(code)})</b>\nSila pilih peranan pentadbir anda:`,
        {
          parse_mode: "HTML",
          reply_markup: keyboard
        }
      );
      return;
    }

    try {
      const { client } = getSupabaseAdmin();
      const { data: school, error } = await client
        .from("smpid_sekolah_data")
        .select("kod_sekolah, nama_sekolah, daerah")
        .eq("kod_sekolah", code)
        .maybeSingle();

      if (error || !school) {
        await ctx.reply(
          `Kod <code>${escapeHtml(code)}</code> tidak ditemui dalam pangkalan data.\nSila pastikan ejaan <b>KOD SEKOLAH</b> adalah tepat (contoh: <code>MBA0001</code>).`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const keyboard = new InlineKeyboard()
        .text("GPICT", `bind_sch:${school.kod_sekolah}:gpict`)
        .text("Admin DELIMa", `bind_sch:${school.kod_sekolah}:admin`)
        .row()
        .text("Pengetua / Guru Besar", `bind_sch:${school.kod_sekolah}:pgb`)
        .text("GPK Pentadbiran", `bind_sch:${school.kod_sekolah}:gpk`);

      await ctx.reply(
        [
          `Sekolah Ditemui: <b>${escapeHtml(school.nama_sekolah)}</b>`,
          `Kod Sekolah: <code>${escapeHtml(school.kod_sekolah)}</code>`,
          `Daerah: <b>${escapeHtml(school.daerah)}</b>`,
          "",
          "Sila pilih jawatan anda di sekolah ini:"
        ].join("\n"),
        {
          parse_mode: "HTML",
          reply_markup: keyboard
        }
      );
    } catch {
      await ctx.reply("Berlaku ralat semasa mencari maklumat sekolah. Sila cuba sebentar lagi.");
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data || "";
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.answerCallbackQuery({ text: "ID Telegram tidak sah.", show_alert: true });
      return;
    }

    if (data.startsWith("bind_sch:")) {
      const parts = data.split(":");
      const kodSekolah = parts[1] || "";
      const roleKey = parts[2] || "";
      const roleMeta = SCHOOL_ROLE_COLUMN_MAP[roleKey];

      if (!kodSekolah || !roleMeta) {
        await ctx.answerCallbackQuery({ text: "Pilihan peranan tidak sah.", show_alert: true });
        return;
      }

      try {
        const { client } = getSupabaseAdmin();
        const updatePayload: Record<string, number> = {};
        updatePayload[roleMeta.column] = telegramId;

        const { data: updated, error } = await client
          .from("smpid_sekolah_data")
          .update(updatePayload)
          .eq("kod_sekolah", kodSekolah)
          .select("kod_sekolah, nama_sekolah")
          .single();

        if (error || !updated) {
          throw new Error(error?.message || "Update failed");
        }

        await ctx.answerCallbackQuery({ text: "Pendaftaran berjaya!" });
        await ctx.editMessageText(
          [
            "<b>Pautan Akaun Berjaya!</b>",
            "",
            `Sekolah: <b>${escapeHtml(updated.nama_sekolah)}</b> (<code>${escapeHtml(updated.kod_sekolah)}</code>)`,
            `Peranan: <b>${escapeHtml(roleMeta.label)}</b>`,
            `ID Telegram: <code>${telegramId}</code>`,
            "",
            "Anda kini akan menerima notifikasi automatik daripada sistem NaDIM."
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      } catch {
        await ctx.answerCallbackQuery({
          text: "Gagal mengemas kini pangkalan data.",
          show_alert: true
        });
      }
      return;
    }

    if (data.startsWith("bind_ppd:")) {
      const role = data.split(":")[1] || "";
      const roleLabel = PPD_ROLE_LABEL_MAP[role];

      if (!role || !roleLabel) {
        await ctx.answerCallbackQuery({ text: "Peranan pentadbir tidak sah.", show_alert: true });
        return;
      }

      try {
        const { client } = getSupabaseAdmin();
        const { data: existing } = await client
          .from("smpid_admin_users")
          .select("role, telegram_id")
          .eq("role", role)
          .eq("telegram_id", telegramId)
          .maybeSingle();

        if (!existing) {
          const { error: insertError } = await client
            .from("smpid_admin_users")
            .insert({ role, telegram_id: telegramId });

          if (insertError) {
            const { error: upsertError } = await client
              .from("smpid_admin_users")
              .upsert({ role, telegram_id: telegramId }, { onConflict: "role" });

            if (upsertError) {
              throw new Error(upsertError.message);
            }
          }
        }

        await ctx.answerCallbackQuery({ text: "Pautan pentadbir berjaya!" });
        await ctx.editMessageText(
          [
            "<b>Pautan Pentadbir Berjaya!</b>",
            "",
            `Peranan: <b>${escapeHtml(roleLabel)}</b>`,
            `Kod Peranan: <code>${escapeHtml(role)}</code>`,
            `ID Telegram: <code>${telegramId}</code>`,
            "",
            "Anda akan menerima pemberitahuan aduan, tempahan bimbingan, dan kemas kini sekolah."
          ].join("\n"),
          { parse_mode: "HTML" }
        );
      } catch {
        await ctx.answerCallbackQuery({
          text: "Gagal menyimpan rekod pentadbir.",
          show_alert: true
        });
      }
      return;
    }

    await ctx.answerCallbackQuery();
  });

  return bot;
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
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
      Array.from(chatIds).filter((id) => typeof id === "number" && Number.isFinite(id) && id > 0)
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
  const kodSekolah = String(payload.kod_sekolah || "").trim().toUpperCase();
  const { school, admins } = await fetchSchoolAndAdmins(client, kodSekolah);

  const namaSekolah = String(
    payload.nama_sekolah || school?.nama_sekolah || kodSekolah || "-"
  );
  const daerah = String(payload.daerah || school?.daerah || "-");
  const peranan = String(payload.peranan || payload.role || "Penyelaras Sekolah");
  const namaPegawai = String(payload.nama_pegawai || payload.nama || "-");
  const catatan = String(payload.catatan || payload.perubahan || "Kemaskini Profil Sekolah");

  const message = [
    "<b>KEMASKINI PROFIL SEKOLAH (NaDIM)</b>",
    "",
    `<b>Sekolah:</b> ${escapeHtml(namaSekolah)} (<code>${escapeHtml(kodSekolah)}</code>)`,
    `<b>Daerah:</b> ${escapeHtml(daerah)}`,
    `<b>Peranan Dikemaskini:</b> ${escapeHtml(peranan)}`,
    `<b>Nama Pegawai:</b> ${escapeHtml(namaPegawai)}`,
    `<b>Butiran:</b> ${escapeHtml(catatan)}`
  ].join("\n");

  const recipients = [
    ...collectSchoolTelegramIds(school),
    ...filterAdminIdsByDistrict(admins, daerah, kodSekolah)
  ];

  return broadcastTelegram(botToken, recipients, message);
}

async function handleTicketNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || "").trim().toUpperCase();
  const { school, admins } = await fetchSchoolAndAdmins(client, kodSekolah);

  const namaSekolah = String(
    payload.nama_sekolah || school?.nama_sekolah || kodSekolah || "-"
  );
  const daerah = String(payload.daerah || school?.daerah || "-");
  const ticketId = payload.id ? `#${payload.id}` : "-";
  const perananPengirim = String(payload.peranan_pengirim || "-");
  const tajuk = String(payload.tajuk || "-");
  const butiran = String(payload.butiran_masalah || "-");

  const message = [
    "<b>TIKET ADUAN ICT BAHARU (HELPDESK)</b>",
    "",
    `<b>ID Tiket:</b> <code>${escapeHtml(ticketId)}</code>`,
    `<b>Sekolah:</b> ${escapeHtml(namaSekolah)} (<code>${escapeHtml(kodSekolah)}</code>)`,
    `<b>Daerah:</b> ${escapeHtml(daerah)}`,
    `<b>Pengirim:</b> ${escapeHtml(perananPengirim)}`,
    `<b>Tajuk:</b> ${escapeHtml(tajuk)}`,
    `<b>Butiran Masalah:</b>\n${escapeHtml(butiran)}`
  ].join("\n");

  const recipients = filterAdminIdsByDistrict(admins, daerah, kodSekolah);
  return broadcastTelegram(botToken, recipients, message);
}

async function handleReplyTicketNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || "").trim().toUpperCase();
  const { school } = await fetchSchoolAndAdmins(client, kodSekolah);

  const namaSekolah = String(
    payload.nama_sekolah || school?.nama_sekolah || kodSekolah || "-"
  );
  const ticketId = payload.id ? `#${payload.id}` : "-";
  const perananPengirim = String(payload.peranan_pengirim || "");
  const tajuk = String(payload.tajuk || "-");
  const status = String(payload.status || "SELESAI");
  const balasanAdmin = String(payload.balasan_admin || "-");

  const message = [
    "<b>MAKLUM BALAS TIKET ADUAN ICT</b>",
    "",
    `<b>ID Tiket:</b> <code>${escapeHtml(ticketId)}</code>`,
    `<b>Sekolah:</b> ${escapeHtml(namaSekolah)} (<code>${escapeHtml(kodSekolah)}</code>)`,
    `<b>Tajuk:</b> ${escapeHtml(tajuk)}`,
    `<b>Status Terkini:</b> <b>${escapeHtml(status)}</b>`,
    `<b>Balasan Pentadbir:</b>\n${escapeHtml(balasanAdmin)}`
  ].join("\n");

  const recipients = collectSchoolTelegramIds(school, perananPengirim);
  return broadcastTelegram(botToken, recipients, message);
}

async function handleBookingNotify(
  payload: Record<string, unknown>,
  client: SupabaseClient,
  botToken: string
) {
  const kodSekolah = String(payload.kod_sekolah || "").trim().toUpperCase();
  const { school, admins } = await fetchSchoolAndAdmins(client, kodSekolah);

  const namaSekolah = String(
    payload.nama_sekolah || school?.nama_sekolah || kodSekolah || "-"
  );
  const daerah = String(payload.daerah || school?.daerah || "-");
  const idTempahan = String(payload.id_tempahan || "-");
  const tarikh = String(payload.tarikh || "-");
  const masa = String(payload.masa || "-");
  const tajukBengkel = String(payload.tajuk_bengkel || "-");
  const namaPic = String(payload.nama_pic || "-");
  const noTelPic = String(payload.no_tel_pic || "-");

  const message = [
    "<b>TEMPAHAN BIMBINGAN & BENGKEL BAHARU</b>",
    "",
    `<b>ID Tempahan:</b> <code>${escapeHtml(idTempahan)}</code>`,
    `<b>Sekolah:</b> ${escapeHtml(namaSekolah)} (<code>${escapeHtml(kodSekolah)}</code>)`,
    `<b>Daerah:</b> ${escapeHtml(daerah)}`,
    `<b>Tarikh:</b> ${escapeHtml(tarikh)}`,
    `<b>Slot Masa:</b> ${escapeHtml(masa)}`,
    `<b>Tajuk Bengkel:</b> ${escapeHtml(tajukBengkel)}`,
    `<b>Pegawai PIC:</b> ${escapeHtml(namaPic)} (${escapeHtml(noTelPic)})`
  ].join("\n");

  const recipients = [
    ...collectSchoolTelegramIds(school),
    ...filterAdminIdsByDistrict(admins, daerah, kodSekolah)
  ];

  return broadcastTelegram(botToken, recipients, message);
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

  if (pathname.endsWith("/webhook")) {
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
    const botToken = (Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim();
    if (!botToken) {
      return jsonResponse(
        { error: "Configuration Error", message: "Missing TELEGRAM_BOT_TOKEN" },
        500
      );
    }

    const { client } = getSupabaseAdmin();

    if (pathname.endsWith("/notify")) {
      const result = await handleProfileNotify(payload, client, botToken);
      return jsonResponse({ success: true, route: "notify", ...result });
    }

    if (pathname.endsWith("/notify-ticket")) {
      const result = await handleTicketNotify(payload, client, botToken);
      return jsonResponse({ success: true, route: "notify-ticket", ...result });
    }

    if (pathname.endsWith("/reply-ticket")) {
      const result = await handleReplyTicketNotify(payload, client, botToken);
      return jsonResponse({ success: true, route: "reply-ticket", ...result });
    }

    if (pathname.endsWith("/notify-booking")) {
      const result = await handleBookingNotify(payload, client, botToken);
      return jsonResponse({ success: true, route: "notify-booking", ...result });
    }

    return jsonResponse({ error: "Not Found", path: pathname }, 404);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Notification dispatch error";
    return jsonResponse({ error: "Internal Server Error", message: msg }, 500);
  }
});