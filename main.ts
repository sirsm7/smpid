/**
 * SMPID Telegram Bot & API (Deno Deploy)
 * Versi: 5.5 (Final Build-Safe & CORS Robust Edition)
 * Host: tech4ag.my
 * Author: CodeArchitect
 * Description: Mengendalikan pendaftaran bot, notifikasi tempahan, 
 * dan integrasi sistem aduan dengan pengoptimuman 'build artifact'.
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.20.3/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8?target=deno";

// 1. KONFIGURASI PERSEKITARAN
const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY") || "";

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("KRITIKAL: Variabel persekitaran (Environment Variables) tidak lengkap!");
}

// DEFINISI HEADER CORS (PENTING UNTUK KOMUNIKASI WEB)
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

  const msg = `🏫 *${sekolah.nama_sekolah}*\n` +
              `Kod: \`${sekolah.kod_sekolah}\`\n\n` +
              `📊 *Status Pendaftaran:*\n` +
              `• GPICT: ${statusGpict}\n` +
              `• Admin: ${statusAdmin}\n\n` +
              `👇 Pilih peranan anda di bawah:`;

  const keyboard = new InlineKeyboard();
  
  if (isGpictAvailable) keyboard.text("👨‍💻 Daftar GPICT", `role:gpict:${sekolah.kod_sekolah}`).row();
  if (isAdminAvailable) keyboard.text("📂 Daftar Admin DELIMa", `role:admin:${sekolah.kod_sekolah}`).row();
  if (isGpictAvailable && isAdminAvailable) keyboard.text("✅ Daftar Kedua-dua", `role:both:${sekolah.kod_sekolah}`).row();

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
  const { data: roles } = await supabase.from("smpid_admin_users").select("role, telegram_id");
  if (!roles) return null;

  const gpict = roles.find(r => r.role === 'ppd_gpict');
  const delima = roles.find(r => r.role === 'ppd_delima');

  const statusG = !gpict?.telegram_id ? "⚪ Kosong" : gpict.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";
  const statusD = !delima?.telegram_id ? "⚪ Kosong" : delima.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";

  const msg = `🛡️ *PANEL PEGAWAI USTP (PPD)*\n` +
              `Kod Akses: \`M030\`\n\n` +
              `📊 *Status Pegawai Meja:*\n` +
              `• PIC GPICT: ${statusG}\n` +
              `• PIC DELIMa: ${statusD}\n\n`;

  const keyboard = new InlineKeyboard()
    .text("👨‍💻 Daftar PIC GPICT", "admin_act:register:ppd_gpict").row()
    .text("📂 Daftar PIC DELIMa", "admin_act:register:ppd_delima").row()
    .text("❌ Tutup", "close");

  return { text: msg, keyboard };
}

// 4. PENGENDALI BOT UTAMA (GRAMMY)

bot.command("start", (ctx) => ctx.reply("👋 *Selamat Datang ke Bot SMPID*\nSila masukkan **Kod Sekolah** anda. (Cth: MBA0001)", { parse_mode: "Markdown" }));

bot.on("message:text", async (ctx) => {
  if (!ctx.from) return;
  const inputKod = ctx.message.text.trim().toUpperCase();
  const telegramId = ctx.from.id;

  if (inputKod === "M030") {
    const ui = await getAdminUI(telegramId);
    if (ui) return ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
  }

  if (inputKod.length < 5) return ctx.reply("⚠️ Sila masukkan Kod Sekolah yang sah.");

  const ui = await getSchoolUI(inputKod, telegramId);
  if (!ui) return ctx.reply(`❌ Kod sekolah *${inputKod}* tiada dalam pangkalan data.`, { parse_mode: "Markdown" });

  await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (!data || !ctx.from) return;
  const telegramId = ctx.from.id;

  if (data === "close") return ctx.deleteMessage().catch(() => {});

  const parts = data.split(":");
  const action = parts[0];

  if (action === "back") {
    const ui = await getSchoolUI(parts[1], telegramId);
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
    
    await ctx.editMessageText(`⚠️ **MOD TIMPA DATA (OVERWRITE)** ⚠️\n\nPilih jawatan untuk diambil alih secara paksa:`, { reply_markup: keyboard, parse_mode: "Markdown" });
    return ctx.answerCallbackQuery();
  }

  if (action === "role" || action === "force" || data.startsWith("admin_act:register")) {
    const role = (action === "role" || action === "force") ? parts[1] : parts[2];
    const kod = (action === "role" || action === "force") ? parts[2] : "M030";

    const updateData: Record<string, number> = {};
    if (role === "gpict" || role === "ppd_gpict") updateData.telegram_id_gpict = telegramId;
    if (role === "admin" || role === "ppd_delima") updateData.telegram_id_admin = telegramId;
    if (role === "both") { updateData.telegram_id_gpict = telegramId; updateData.telegram_id_admin = telegramId; }

    try {
      if (kod === "M030") {
        await supabase.from("smpid_admin_users").update({ telegram_id: telegramId }).eq("role", role);
      } else {
        await supabase.from("smpid_sekolah_data").update(updateData).eq("kod_sekolah", kod);
      }
      await ctx.answerCallbackQuery({ text: "Berjaya!" });
      await ctx.editMessageText("✅ **Pendaftaran Berjaya!**\nID Telegram anda kini telah dipautkan ke sistem SMPID.", { parse_mode: "Markdown" });
    } catch (e) {
      console.error("Database Error:", e);
      await ctx.answerCallbackQuery({ text: "Ralat pangkalan data.", show_alert: true });
    }
  }
});

// 5. PELAYAN API HTTP (DENO SERVE)

const handleBotUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  // --- KAWALAN CORS (PRIORITI TINGGI) ---
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Laluan Root (Health Check)
  if (url.pathname === "/" || url.pathname === "") {
    return new Response(JSON.stringify({ status: "online", service: "SMPID Bot", version: "5.5" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

    // 1. Endpoint: Notifikasi Kemaskini Profil
    if (req.method === "POST" && url.pathname === "/notify") {
      const { kod, nama, updated_by } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🔔 *KEMASKINI DATA*\n\n🏫 *${nama}* (${kod})\n👤 Oleh: ${updated_by}`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
    }

    // 2. Endpoint: Notifikasi Tempahan (Double-DM Routing)
    if (req.method === "POST" && url.pathname === "/notify-booking") {
      const { kod, nama, tarikh, masa, tajuk, pic_name, pic_phone } = await req.json();

      // Broadcast kepada PPD
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const wa = `https://wa.me/${pic_phone.replace(/[^0-9]/g, '')}`;
        const msgPpd = `📅 *TEMPAHAN BENGKEL BARU*\n\n🏫 Sekolah: *${nama}*\n📌 Fokus: *${tajuk}*\n🗓️ Tarikh: *${tarikh}* | *${masa}*\n👤 PIC: *${pic_name}*\n📞 Hubungi: [${pic_phone}](${wa})`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, msgPpd, { parse_mode: "Markdown", disable_web_page_preview: true })));
      }

      // DM Terus kepada PIC Sekolah (GPICT / Admin)
      const { data: sch } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      if (sch) {
        const msgSch = `✅ *PENGESAHAN TEMPAHAN*\n\nSistem telah merekodkan permohonan bimbingan untuk sekolah anda.\n\n📌 Fokus: *${tajuk}*\n🗓️ Tarikh: *${tarikh}* (${masa})\n\n_Sila tunggu maklum balas daripada PPD._`;
        const ids = [sch.telegram_id_gpict, sch.telegram_id_admin].filter(i => i);
        await Promise.all(ids.map(id => bot.api.sendMessage(id, msgSch, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
    }

    // 3. Endpoint: Notifikasi Aduan Baru
    if (req.method === "POST" && url.pathname === "/notify-ticket") {
      const { kod, peranan, tajuk, mesej } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🆘 *TIKET ADUAN BARU*\n\n🏫 *${kod}*\n👤 *${peranan}*\n📌 *${tajuk}*\n\n📝 "${mesej}"`;
        await Promise.all(admins.map(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" })));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
    }

    // 4. Endpoint: Notifikasi Balasan Tiket (Admin ke User)
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
      return new Response(JSON.stringify({ status: "ok" }), { headers: jsonHeaders });
    }

    // fallback untuk Telegram Webhook
    return await handleBotUpdate(req);

  } catch (err) {
    console.error("API Error:", err);
    return new Response(JSON.stringify({ status: "error", message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});