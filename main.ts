/**
 * SMPID Telegram Bot & API (Deno Deploy)
 * Versi: 5.2 (Ultra-Stable & Build-Safe Edition)
 * Host: tech4ag.my
 * Author: CodeArchitect
 * Description: Pendaftaran bot, notifikasi tempahan (Double-DM), 
 * dan integrasi aduan dengan pengurusan CORS yang dioptimumkan.
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// 1. PENGURUSAN PERSEKITARAN (ENVIRONMENT VARIABLES)
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY") || "";

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("KRITIKAL: Variabel persekitaran tidak lengkap.");
}

// DEFINISI HEADER CORS GLOBAL
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 2. INISIALISASI CLIENTS
const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. FUNGSI PEMBANTU UI (TELEGRAM LOGIC)

/**
 * Menjana antaramuka pendaftaran sekolah.
 */
async function getSchoolUI(kodSekolah: string, telegramId: number) {
  const { data: sekolah, error } = await supabase
    .from("smpid_sekolah_data")
    .select("kod_sekolah, nama_sekolah, telegram_id_gpict, telegram_id_admin")
    .eq("kod_sekolah", kodSekolah)
    .single();

  if (error || !sekolah) return null;

  const gpictId = sekolah.telegram_id_gpict;
  const adminId = sekolah.telegram_id_admin;

  const isGpictOk = !gpictId || gpictId === telegramId;
  const isAdminOk = !adminId || adminId === telegramId;

  const statusGpict = !gpictId ? "⚪ Kosong" : gpictId === telegramId ? "✅ Anda" : "⛔ Diisi";
  const statusAdmin = !adminId ? "⚪ Kosong" : adminId === telegramId ? "✅ Anda" : "⛔ Diisi";

  const msg = `🏫 *${sekolah.nama_sekolah}*\n` +
              `Kod: \`${sekolah.kod_sekolah}\`\n\n` +
              `📊 *Status Pendaftaran:*\n` +
              `• GPICT: ${statusGpict}\n` +
              `• Admin: ${statusAdmin}\n\n` +
              `👇 Pilih jawatan anda:`;

  const keyboard = new InlineKeyboard();
  
  if (isGpictOk) keyboard.text("👨‍💻 Daftar GPICT", `role:gpict:${sekolah.kod_sekolah}`).row();
  if (isAdminOk) keyboard.text("📂 Daftar Admin DELIMa", `role:admin:${sekolah.kod_sekolah}`).row();
  if (isGpictOk && isAdminOk) keyboard.text("✅ Daftar Kedua-dua", `role:both:${sekolah.kod_sekolah}`).row();

  if (!isGpictOk || !isAdminOk) {
    keyboard.text("⚠️ Timpa Data (Overwrite)", `overwrite_menu:${sekolah.kod_sekolah}`).row();
  }

  keyboard.text("❌ Tutup", "close");
  return { text: msg, keyboard };
}

/**
 * Menjana antaramuka Pegawai PPD (M030).
 */
async function getAdminUI(telegramId: number) {
  const { data: roles } = await supabase.from("smpid_admin_users").select("role, telegram_id");
  if (!roles) return null;

  const gpict = roles.find(r => r.role === 'ppd_gpict');
  const delima = roles.find(r => r.role === 'ppd_delima');

  const statusG = !gpict?.telegram_id ? "⚪ Kosong" : gpict.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";
  const statusD = !delima?.telegram_id ? "⚪ Kosong" : delima.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";

  const msg = `🛡️ *PANEL PEGAWAI USTP (PPD)*\n` +
              `Kod: \`M030\`\n\n` +
              `📊 *Status Pegawai Meja:*\n` +
              `• PIC GPICT: ${statusG}\n` +
              `• PIC DELIMa: ${statusD}\n\n`;

  const keyboard = new InlineKeyboard()
    .text("👨‍💻 Daftar PIC GPICT", "admin_act:register:ppd_gpict").row()
    .text("📂 Daftar PIC DELIMa", "admin_act:register:ppd_delima").row()
    .text("❌ Tutup", "close");

  return { text: msg, keyboard };
}

// 4. PENGENDALI BOT (GRAMMY HANDLERS)

bot.command("start", (ctx) => ctx.reply("👋 *Selamat Datang*\nSila masukkan **Kod Sekolah** anda. (Contoh: MBA0001)", { parse_mode: "Markdown" }));

bot.on("message:text", async (ctx) => {
  if (!ctx.from) return;
  const input = ctx.message.text.trim().toUpperCase();
  const tId = ctx.from.id;

  if (input === "M030") {
    const ui = await getAdminUI(tId);
    if (ui) return ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
  }

  if (input.length < 5) return ctx.reply("⚠️ Sila masukkan kod sekolah yang sah.");

  const ui = await getSchoolUI(input, tId);
  if (!ui) return ctx.reply(`❌ Rekod bagi *${input}* tidak ditemui.`, { parse_mode: "Markdown" });

  await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data || !ctx.from) return;
  const tId = ctx.from.id;

  if (data === "close") return ctx.deleteMessage().catch(() => {});

  const parts = data.split(":");
  const action = parts[0];

  if (action === "back") {
    const ui = await getSchoolUI(parts[1], tId);
    if (ui) await ctx.editMessageText(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
    return ctx.answerCallbackQuery();
  }

  if (action === "overwrite_menu") {
    const kod = parts[1];
    const keyboard = new InlineKeyboard()
       .text("⚠️ Timpa GPICT", `force:gpict:${kod}`).row()
       .text("⚠️ Timpa Admin", `force:admin:${kod}`).row()
       .text("⚠️ Timpa Kedua-dua", `force:both:${kod}`).row()
       .text("« Kembali", `back:${kod}`);
    
    await ctx.editMessageText(`⚠️ **MOD TIMPA DATA** ⚠️\n\nPilih jawatan untuk diambil alih:`, { reply_markup: keyboard, parse_mode: "Markdown" });
    return ctx.answerCallbackQuery();
  }

  if (action === "role" || action === "force" || data.startsWith("admin_act:register")) {
    const role = (action === "role" || action === "force") ? parts[1] : parts[2];
    const targetKod = (action === "role" || action === "force") ? parts[2] : "M030";

    const updateMap: Record<string, number> = {};
    if (role === "gpict" || role === "ppd_gpict") updateMap.telegram_id_gpict = tId;
    if (role === "admin" || role === "ppd_delima") updateMap.telegram_id_admin = tId;
    if (role === "both") { updateMap.telegram_id_gpict = tId; updateMap.telegram_id_admin = tId; }

    try {
      if (targetKod === "M030") {
        await supabase.from("smpid_admin_users").update({ telegram_id: tId }).eq("role", role);
      } else {
        await supabase.from("smpid_sekolah_data").update(updateMap).eq("kod_sekolah", targetKod);
      }
      await ctx.answerCallbackQuery({ text: "Berjaya!" });
      await ctx.editMessageText("✅ **Berjaya!**\nID Telegram anda telah didaftarkan.", { parse_mode: "Markdown" });
    } catch (e) {
      console.error(e);
      await ctx.answerCallbackQuery({ text: "Ralat sistem.", show_alert: true });
    }
  }
});

// 5. PELAYAN API HTTP (DENO SERVE INTEGRATION)

const handleBotUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  // A. PREFLIGHT HANDLER
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // B. HEALTH CHECK
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(JSON.stringify({ status: "healthy", service: "SMPID-Bot", version: "5.2" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // C. API ENDPOINTS
  try {
    const headers = { ...corsHeaders, "Content-Type": "application/json" };

    // 1. Notifikasi Profil
    if (req.method === "POST" && url.pathname === "/notify") {
      const { kod, nama, updated_by } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🔔 *KEMASKINI DATA*\n\n🏫 *${nama}* (${kod})\n👤 Oleh: ${updated_by}`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    // 2. Notifikasi Tempahan (Booking)
    if (req.method === "POST" && url.pathname === "/notify-booking") {
      const { kod, nama, tarikh, masa, tajuk, pic_name, pic_phone } = await req.json();

      // PPD Admins
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const wa = `https://wa.me/${pic_phone.replace(/[^0-9]/g, '')}`;
        const msg = `📅 *TEMPAHAN BENGKEL BARU*\n\n🏫 Sekolah: *${nama}*\n📌 Fokus: *${tajuk}*\n🗓️ Tarikh: *${tarikh}* | *${masa}*\n👤 PIC: *${pic_name}*\n📞 Hubungi: [${pic_phone}](${wa})`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, msg, { parse_mode: "Markdown", disable_web_page_preview: true })));
      }

      // PIC Sekolah
      const { data: sch } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      if (sch) {
        const msgSch = `✅ *PENGESAHAN TEMPAHAN*\n\nPermohonan sekolah anda telah direkodkan.\n\n📌 Fokus: *${tajuk}*\n🗓️ Tarikh: *${tarikh}* (${masa})`;
        const ids = [sch.telegram_id_gpict, sch.telegram_id_admin].filter(id => id);
        await Promise.all(ids.map(id => bot.api.sendMessage(id, msgSch, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    // 3. Notifikasi Tiket Baru
    if (req.method === "POST" && url.pathname === "/notify-ticket") {
      const { kod, peranan, tajuk, mesej } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🆘 *TIKET ADUAN BARU*\n\n🏫 Sekolah: *${kod}*\n👤 Peranan: *${peranan}*\n📌 Tajuk: *${tajuk}*\n\n📝 Mesej: ${mesej}`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    // 4. Notifikasi Balasan Tiket
    if (req.method === "POST" && url.pathname === "/reply-ticket") {
      const { kod, peranan, tajuk, balasan } = await req.json();
      const { data: sch } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      if (sch) {
        const targetId = peranan === 'GPICT' ? sch.telegram_id_gpict : sch.telegram_id_admin;
        if (targetId) {
          const text = `✅ *STATUS TIKET: SELESAI*\n\n📌 Tajuk: *${tajuk}*\n💬 Respon Admin: ${balasan}`;
          await bot.api.sendMessage(targetId, text, { parse_mode: "Markdown" });
        }
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers });
    }

    // D. TELEGRAM WEBHOOK HANDLER
    return await handleBotUpdate(req);

  } catch (err) {
    console.error("Server Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});