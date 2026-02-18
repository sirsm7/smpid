/**
 * SMPID Telegram Bot & API (Deno Deploy)
 * Versi: CORS Fixed & Modular API
 * Host: smpid.ppdag.deno.net
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// 1. KONFIGURASI ENV
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY");

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Sila tetapkan BOT_TOKEN, SUPABASE_URL, dan SUPABASE_KEY di Deno Deploy Dashboard.");
}

// 2. INISIALISASI
const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CORS HEADERS CONFIGURATION
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 3. FUNGSI UI BOT HELPER

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

  const statusGpict = !gpictOwner ? "⚪ Kosong" : gpictOwner === telegramId ? "✅ Anda" : "⛔ Orang Lain";
  const statusAdmin = !adminOwner ? "⚪ Kosong" : adminOwner === telegramId ? "✅ Anda" : "⛔ Orang Lain";

  let msg = `🏫 *${sekolah.nama_sekolah}*\nKod: \`${sekolah.kod_sekolah}\`\n\n📊 *Status:*\n• GPICT: ${statusGpict}\n• Admin: ${statusAdmin}\n\n`;

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

async function getAdminUI(telegramId: number) {
  const { data: roles, error } = await supabase.from("smpid_admin_users").select("role, telegram_id");
  if (error || !roles) return null;

  const gpRole = roles.find(r => r.role === 'ppd_gpict');
  const dlRole = roles.find(r => r.role === 'ppd_delima');

  const statusGp = !gpRole?.telegram_id ? "⚪ Kosong" : gpRole.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";
  const statusDl = !dlRole?.telegram_id ? "⚪ Kosong" : dlRole.telegram_id === telegramId ? "✅ Anda" : "⛔ Pegawai Lain";

  let msg = `🛡️ *PANEL PEGAWAI USTP*\n📊 *Status:*\n• PIC GPICT: ${statusGp}\n• PIC DELIMa: ${statusDl}\n\n`;

  const keyboard = new InlineKeyboard();
  keyboard.text("👨‍💻 Daftar PIC GPICT", "admin_act:register:ppd_gpict").row();
  keyboard.text("📂 Daftar PIC DELIMa", "admin_act:register:ppd_delima").row();
  keyboard.text("⚠️ Timpa (Overwrite)", "admin_act:overwrite_menu").row();
  keyboard.text("❌ Tutup", "close");

  return { text: msg, keyboard };
}

// 4. BOT COMMANDS & CALLBACKS
bot.command("start", (ctx) => ctx.reply("👋 Masukkan **Kod Sekolah** anda (Contoh: MBA0001) untuk pendaftaran Bot SMPID.", { parse_mode: "Markdown" }));

bot.on("message:text", async (ctx) => {
  const inputKod = ctx.message.text.trim().toUpperCase();
  if (inputKod === "M030") {
    const ui = await getAdminUI(ctx.from.id);
    return ui ? ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" }) : ctx.reply("Ralat database.");
  }
  const ui = await getSchoolUI(inputKod, ctx.from.id);
  if (!ui) return ctx.reply(`❌ Kod *${inputKod}* tidak ditemui.`);
  await ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
});

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const tid = ctx.from.id;

  if (data === "close") return ctx.deleteMessage();

  if (data.startsWith("role:") || data.startsWith("force:")) {
    const [action, role, kod] = data.split(":");
    let updateData = {};
    if (role === "gpict") updateData = { telegram_id_gpict: tid };
    else if (role === "admin") updateData = { telegram_id_admin: tid };
    else if (role === "both") updateData = { telegram_id_gpict: tid, telegram_id_admin: tid };

    await supabase.from("smpid_sekolah_data").update(updateData).eq("kod_sekolah", kod);
    await ctx.answerCallbackQuery({ text: "Pendaftaran Berjaya!" });
    await ctx.editMessageText(`✅ Berjaya mendaftar sebagai *${role.toUpperCase()}* bagi sekolah *${kod}*.`, { parse_mode: "Markdown" });
  }

  if (data.startsWith("admin_act:")) {
    const [p1, action, role] = data.split(":");
    if (action === "register" || action === "force") {
      await supabase.from("smpid_admin_users").update({ telegram_id: tid }).eq("role", role);
      await ctx.answerCallbackQuery({ text: "Akses Dikemaskini!" });
      await ctx.editMessageText("✅ Peranan Pegawai USTP telah dikemaskini.");
    }
  }
});

// 5. SERVER HANDLER (WITH CORS & API ENDPOINTS)
const handleBotUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // HANDLE CORS PREFLIGHT
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // API: NOTIFY PROFILE UPDATE
  if (req.method === "POST" && url.pathname === "/notify") {
    try {
      const { kod, nama, updated_by } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);

      if (admins) {
        const msg = `🔔 *KEMASKINI PROFIL*\n🏫 *${nama}* (${kod})\n👤 Diperbaharui oleh: *${updated_by}*`;
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, msg, { parse_mode: "Markdown" }).catch(() => {}));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); }
  }

  // API: NOTIFY TICKET
  if (req.method === "POST" && url.pathname === "/notify-ticket") {
    try {
      const { kod, peranan, tajuk, mesej } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🆘 *ADUAN BARU*\n🏫 Sekolah: *${kod}*\n👤 Pengirim: *${peranan}*\n📌 Tajuk: *${tajuk}*\n📝 Mesej: ${mesej}`;
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" }));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); }
  }

  // API: REPLY TICKET
  if (req.method === "POST" && url.pathname === "/reply-ticket") {
    try {
      const { kod, peranan, tajuk, balasan } = await req.json();
      const { data: s } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      const targetId = peranan === 'GPICT' ? s?.telegram_id_gpict : s?.telegram_id_admin;
      if (targetId) {
        const text = `✅ *STATUS TIKET: SELESAI*\n📌 Tajuk: *${tajuk}*\n💬 Respon: ${balasan}`;
        await bot.api.sendMessage(targetId, text, { parse_mode: "Markdown" });
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); }
  }

  // API: NOTIFY BOOKING (NEW)
  if (req.method === "POST" && url.pathname === "/notify-booking") {
    try {
      const { kod, nama, tarikh, masa, tajuk, pic_name } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins) {
        const text = `🗓️ *TEMPAHAN BARU*\n🏫 *${nama}* (${kod})\n📅 Tarikh: *${tarikh}* (${masa})\n📚 Tajuk: *${tajuk}*\n👤 PIC: *${pic_name}*`;
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "Markdown" }));
      }
      return new Response(JSON.stringify({ status: "ok" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); }
  }

  // DEFAULT: TELEGRAM WEBHOOK
  return handleBotUpdate(req);
});