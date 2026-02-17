/**
 * SMPID Telegram Bot & API (Deno Deploy)
 * Versi: 5.1 (Full Production & Build-Safe Edition)
 * Host: tech4ag.my
 * Author: CodeArchitect
 * Description: Mengendalikan pendaftaran bot, notifikasi tempahan, 
 * dan integrasi sistem aduan dengan perlindungan CORS penuh.
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// 1. KONFIGURASI PERSEKITARAN
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY");

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Sila tetapkan variabel persekitaran: BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY.");
}

// DEFINISI HEADER CORS UNTUK AKSES WEB (BROWSER SAFETY)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 2. INISIALISASI CLIENTS
const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. FUNGSI UI HELPER TELEGRAM

/**
 * Menjana antaramuka pendaftaran bagi pihak sekolah.
 */
async function getSchoolUI(kodSekolah: string, telegramId: number) {
  const { data: sekolah, error } = await supabase
    .from("smpid_sekolah_data")
    .select("kod_sekolah, nama_sekolah, telegram_id_gpict, telegram_id_admin")
    .eq("kod_sekolah", kodSekolah)
    .single();

  if (error || !sekolah) return null;

  const gpictOwner = sekolah.telegram_id_gpict;
  const adminOwner = sekolah.telegram_id_admin;

  const isGpictAvailable = !gpictOwner || gpictOwner === telegramId;
  const isAdminAvailable = !adminOwner || adminOwner === telegramId;

  const statusGpict = !gpictOwner ? "⚪ Kosong" : gpictOwner === telegramId ? "✅ Anda" : "⛔ Diisi";
  const statusAdmin = !adminOwner ? "⚪ Kosong" : adminOwner === telegramId ? "✅ Anda" : "⛔ Diisi";

  let msg = `🏫 *${sekolah.nama_sekolah}*\n` +
            `Kod: \`${sekolah.kod_sekolah}\`\n\n` +
            `📊 *Status Pendaftaran Semasa:*\n` +
            `• GPICT: ${statusGpict}\n` +
            `• Admin: ${statusAdmin}\n\n`;

  const keyboard = new InlineKeyboard();
  
  if (isGpictAvailable) {
    keyboard.text("👨‍💻 Daftar GPICT", `role:gpict:${sekolah.kod_sekolah}`).row();
  }
  if (isAdminAvailable) {
    keyboard.text("📂 Daftar Admin DELIMa", `role:admin:${sekolah.kod_sekolah}`).row();
  }
  if (isGpictAvailable && isAdminAvailable) {
    keyboard.text("✅ Daftar Kedua-dua Jawatan", `role:both:${sekolah.kod_sekolah}`).row();
  }

  // Mod Timpa jika data sudah diisi oleh orang lain
  if (!isGpictAvailable || !isAdminAvailable) {
    keyboard.text("⚠️ Timpa Data (Overwrite)", `overwrite_menu:${sekolah.kod_sekolah}`).row();
  }

  keyboard.text("❌ Tutup", "close");
  return { text: msg, keyboard };
}

/**
 * Menjana antaramuka khas bagi Pegawai PPD (M030).
 */
async function getAdminUI(telegramId: number) {
  const { data: roles, error } = await supabase
    .from("smpid_admin_users")
    .select("role, telegram_id");

  if (error || !roles) return null;

  const gpictRole = roles.find(r => r.role === 'ppd_gpict');
  const delimaRole = roles.find(r => r.role === 'ppd_delima');

  const statusGpict = !gpictRole?.telegram_id ? "⚪ Kosong" : gpictRole.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";
  const statusDelima = !delimaRole?.telegram_id ? "⚪ Kosong" : delimaRole.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";

  let msg = `🛡️ *PANEL PEGAWAI USTP (PPD)*\n` +
            `Kod Akses: \`M030\`\n\n` +
            `📊 *Status Pegawai Meja:*\n` +
            `• PIC GPICT: ${statusGpict}\n` +
            `• PIC DELIMa: ${statusDelima}\n\n`;

  const keyboard = new InlineKeyboard()
    .text("👨‍💻 Daftar PIC GPICT", "admin_act:register:ppd_gpict").row()
    .text("📂 Daftar PIC DELIMa", "admin_act:register:ppd_delima").row()
    .text("❌ Tutup", "close");

  return { text: msg, keyboard };
}

// 4. PENGENDALI BOT UTAMA (GRAMMY)

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Selamat Datang ke Bot SMPID*\n\n" +
    "Sila masukkan **Kod Sekolah** anda untuk pengaktifan ID Telegram.\n" +
    "_(Contoh: MBA0001)_",
    { parse_mode: "Markdown" }
  );
});

bot.on("message:text", async (ctx) => {
  if (!ctx.from) return;
  const inputKod = ctx.message.text.trim().toUpperCase();
  const telegramId = ctx.from.id;

  // Semakan Admin PPD
  if (inputKod === "M030") {
    const ui = await getAdminUI(telegramId);
    if (ui) return ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
  }

  // Semakan Format Kod Sekolah
  if (inputKod.length < 5) {
    return ctx.reply("⚠️ Format kod tidak sah. Sila masukkan Kod Sekolah yang betul.");
  }

  // Semakan Data Sekolah
  const ui = await getSchoolUI(inputKod, telegramId);
  if (!ui) {
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tiada dalam rekod sistem.`, { parse_mode: "Markdown" });
  }

  await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data || !ctx.from) return;
  const telegramId = ctx.from.id;

  // Tindakan: Tutup Mesej
  if (data === "close") {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage().catch(() => {});
  }

  const parts = data.split(":");
  const action = parts[0];

  // LOGIK NAVIGASI: Kembali ke Menu Utama
  if (action === "back") {
    const kod = parts[1];
    const ui = await getSchoolUI(kod, telegramId);
    if (ui) await ctx.editMessageText(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
    return ctx.answerCallbackQuery();
  }

  // LOGIK NAVIGASI: Menu Overwrite
  if (action === "overwrite_menu") {
    const kod = parts[1];
    const keyboard = new InlineKeyboard()
       .text("⚠️ Timpa GPICT", `force:gpict:${kod}`).row()
       .text("⚠️ Timpa Admin", `force:admin:${kod}`).row()
       .text("⚠️ Timpa Kedua-dua", `force:both:${kod}`).row()
       .text("« Kembali", `back:${kod}`);
    
    await ctx.editMessageText(
        `⚠️ **MOD TIMPA DATA (OVERWRITE)** ⚠️\n\nSila pilih jawatan yang ingin diambil alih secara paksa:`,
        { reply_markup: keyboard, parse_mode: "Markdown" }
    );
    return ctx.answerCallbackQuery();
  }

  // LOGIK PENDAFTARAN: Simpan ke DB
  if (action === "role" || action === "force" || data.startsWith("admin_act:register")) {
    const role = (action === "role" || action === "force") ? parts[1] : parts[2];
    const kod = (action === "role" || action === "force") ? parts[2] : "M030";

    const updateData: Record<string, number> = {};
    if (role === "gpict" || role === "ppd_gpict") updateData.telegram_id_gpict = telegramId;
    if (role === "admin" || role === "ppd_delima") updateData.telegram_id_admin = telegramId;
    if (role === "both") {
      updateData.telegram_id_gpict = telegramId;
      updateData.telegram_id_admin = telegramId;
    }

    try {
      if (kod === "M030") {
        await supabase.from("smpid_admin_users").update({ telegram_id: telegramId }).eq("role", role);
      } else {
        await supabase.from("smpid_sekolah_data").update(updateData).eq("kod_sekolah", kod);
      }
      
      await ctx.answerCallbackQuery({ text: "Berjaya!" });
      await ctx.editMessageText("✅ **Pendaftaran Berjaya!**\nID Telegram anda kini telah dipautkan ke sistem SMPID.", { parse_mode: "Markdown" });
    } catch (e) {
      console.error("DB Update Error:", e);
      await ctx.answerCallbackQuery({ text: "Ralat pangkalan data.", show_alert: true });
    }
  }
});

// 5. PELAYAN API HTTP (DENO SERVE)

const handleBotUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  // A. KAWALAN CORS & PREFLIGHT
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // B. HEALTH CHECK & ROOT PATH
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(JSON.stringify({ status: "healthy", version: "5.1" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // C. API ENDPOINTS (NOTIFIKASI)
  try {
    
    // 1. Notifikasi Kemaskini Profil
    if (req.method === "POST" && url.pathname === "/notify") {
      const { kod, nama, updated_by } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🔔 *KEMASKINI DATA SEKOLAH*\n\n🏫 *${nama}* (${kod})\n👤 Oleh: ${updated_by}`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Notifikasi Tempahan Bimbingan (Booking)
    if (req.method === "POST" && url.pathname === "/notify-booking") {
      const { kod, nama, tarikh, masa, tajuk, pic_name, pic_phone } = await req.json();

      // Notifikasi ke PPD
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const waLink = `https://wa.me/${pic_phone.replace(/[^0-9]/g, '')}`;
        const msgPpd = `📅 *TEMPAHAN BENGKEL BARU*\n\n🏫 Sekolah: *${nama}*\n📌 Fokus: *${tajuk}*\n🗓️ Tarikh: *${tarikh}* | *${masa}*\n👤 PIC: *${pic_name}*\n📞 Hubungi: [${pic_phone}](${waLink})`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, msgPpd, { parse_mode: "Markdown", disable_web_page_preview: true })));
      }

      // Notifikasi ke Sekolah (Penerima DM)
      const { data: sch } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      if (sch) {
        const msgSch = `✅ *PENGESAHAN TEMPAHAN*\n\nPermohonan sekolah anda telah direkodkan.\n\n📌 Fokus: *${tajuk}*\n🗓️ Tarikh: *${tarikh}* (${masa})\n\n_Sila tunggu maklum balas daripada USTP PPD Alor Gajah._`;
        const ids = [sch.telegram_id_gpict, sch.telegram_id_admin].filter(id => id);
        await Promise.all(ids.map(id => bot.api.sendMessage(id, msgSch, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Notifikasi Aduan Tiket Baru
    if (req.method === "POST" && url.pathname === "/notify-ticket") {
      const { kod, peranan, tajuk, mesej } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🆘 *TIKET ADUAN BARU*\n\n🏫 Sekolah: *${kod}*\n👤 Peranan: *${peranan}*\n📌 Tajuk: *${tajuk}*\n\n📝 Mesej: ${mesej}`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Notifikasi Balasan Tiket (Admin ke Sekolah)
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
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // D. FALLBACK UNTUK TELEGRAM WEBHOOK
    return await handleBotUpdate(req);

  } catch (err) {
    console.error("Critical Server Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});