/**
 * SMPID Telegram Bot (Deno Deploy)
 * Versi 4.0: Smart UI & Real-time Validation
 * Host: appppdag.cloud
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// 1. KONFIGURASI ENV
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY");

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Sila tetapkan BOT_TOKEN, SUPABASE_URL, dan SUPABASE_KEY.");
}

// 2. INISIALISASI
const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. LOGIK UTAMA

// A. COMMAND /START
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Selamat Datang ke Bot SMPID*\n\n" +
    "Sila masukkan **Kod Sekolah** anda untuk semakan status & pendaftaran.\n" +
    "_(Contoh: MBA0001)_",
    { parse_mode: "Markdown" }
  );
});

// B. PENGENDALI TEKS (Kod Sekolah & Admin)
bot.on("message:text", async (ctx) => {
  const inputTeks = ctx.message.text.trim();
  const inputKod = inputTeks.toUpperCase();
  const telegramId = ctx.from.id;

  // --- 1. SUPER ADMIN CHECK ---
  if (inputKod === "M030") {
    const { error } = await supabase
      .from("smpid_admin_users")
      .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id" });

    if (error) return ctx.reply("❌ Ralat sistem.");
    return ctx.reply("✅ *Akses Admin PPD Disahkan.*", { parse_mode: "Markdown" });
  }

  // --- 2. VALIDASI FORMAT ---
  if (inputKod.length < 5 || inputKod.length > 9) {
    return ctx.reply("⚠️ Format kod tidak sah. Sila masukkan Kod Sekolah (Contoh: MBA0001).");
  }

  // --- 3. CARIAN DATABASE ---
  const { data: sekolah, error } = await supabase
    .from("smpid_sekolah_data")
    .select("kod_sekolah, nama_sekolah, telegram_id_gpict, telegram_id_admin")
    .eq("kod_sekolah", inputKod)
    .single();

  if (error || !sekolah) {
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tiada dalam rekod kami.`, { parse_mode: "Markdown" });
  }

  // --- 4. ANALISIS STATUS (LOGIK UI DINAMIK) ---
  const gpictOwner = sekolah.telegram_id_gpict;
  const adminOwner = sekolah.telegram_id_admin;

  // Tentukan status setiap jawatan
  // Logic: Available if (Nobody owns it) OR (I own it)
  const isGpictAvailable = !gpictOwner || gpictOwner === telegramId;
  const isAdminAvailable = !adminOwner || adminOwner === telegramId;

  // Bina Text Status untuk Paparan
  const statusGpict = !gpictOwner ? "⚪ Kosong (Boleh Daftar)" 
                    : gpictOwner === telegramId ? "✅ Anda (Boleh Kemaskini)" 
                    : "⛔ Sudah Diisi (Orang Lain)";

  const statusAdmin = !adminOwner ? "⚪ Kosong (Boleh Daftar)" 
                    : adminOwner === telegramId ? "✅ Anda (Boleh Kemaskini)" 
                    : "⛔ Sudah Diisi (Orang Lain)";

  let msg = `🏫 *${sekolah.nama_sekolah}*\n` +
            `Kod: \`${sekolah.kod_sekolah}\`\n\n` +
            `📊 *Status Pendaftaran Semasa:*\n` +
            `• GPICT: ${statusGpict}\n` +
            `• Admin: ${statusAdmin}\n\n`;

  // --- 5. BINA KEYBOARD BERDASARKAN KEKOSONGAN ---
  const keyboard = new InlineKeyboard();
  let buttonCount = 0;

  // Butang GPICT (Hanya jika available)
  if (isGpictAvailable) {
    keyboard.text("👨‍💻 Daftar GPICT", `role:gpict:${sekolah.kod_sekolah}`).row();
    buttonCount++;
  }

  // Butang Admin (Hanya jika available)
  if (isAdminAvailable) {
    keyboard.text("📂 Daftar Admin DELIMa", `role:admin:${sekolah.kod_sekolah}`).row();
    buttonCount++;
  }

  // Butang Kedua-dua (Hanya jika DUA-DUA available)
  if (isGpictAvailable && isAdminAvailable) {
    keyboard.text("✅ Daftar Kedua-dua Jawatan", `role:both:${sekolah.kod_sekolah}`).row();
    buttonCount++;
  }

  // Tambah mesej arahan di bawah
  if (buttonCount > 0) {
    msg += "👇 Sila pilih jawatan anda di bawah:";
  } else {
    msg += "⚠️ *Tiada slot kosong.* Semua jawatan telah didaftarkan oleh pengguna lain.\n" +
           "Sila hubungi PPD jika ini adalah kesilapan.";
  }

  await ctx.reply(msg, {
    reply_markup: keyboard,
    parse_mode: "Markdown"
  });
});

// C. PENGENDALI BUTANG (Callback Query)
// (Kekal dengan Double-Check Security untuk keselamatan tambahan)
bot.on("callback_query:data", async (ctx) => {
  const dataString = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;
  const [prefix, role, kodSekolah] = dataString.split(":");

  if (prefix !== "role") return;

  // Security Check Terakhir (Anti-Race Condition)
  const { data: sekolah, error } = await supabase
    .from("smpid_sekolah_data")
    .select("telegram_id_gpict, telegram_id_admin")
    .eq("kod_sekolah", kodSekolah)
    .single();

  if (error || !sekolah) return ctx.answerCallbackQuery({ text: "Ralat data." });

  let updateData = {};
  let roleText = "";
  
  // Logic Validasi Akhir (Sama seperti paparan, tapi di peringkat server)
  const gpictSafe = !sekolah.telegram_id_gpict || sekolah.telegram_id_gpict === telegramId;
  const adminSafe = !sekolah.telegram_id_admin || sekolah.telegram_id_admin === telegramId;

  if (role === "gpict") {
    if (!gpictSafe) return alertTaken(ctx);
    updateData = { telegram_id_gpict: telegramId };
    roleText = "Guru Penyelaras ICT";
  } 
  else if (role === "admin") {
    if (!adminSafe) return alertTaken(ctx);
    updateData = { telegram_id_admin: telegramId };
    roleText = "Admin DELIMa";
  } 
  else if (role === "both") {
    if (!gpictSafe || !adminSafe) return alertTaken(ctx);
    updateData = { telegram_id_gpict: telegramId, telegram_id_admin: telegramId };
    roleText = "Guru ICT & Admin DELIMa";
  }

  // Update Database
  const { error: errUpdate } = await supabase
    .from("smpid_sekolah_data")
    .update(updateData)
    .eq("kod_sekolah", kodSekolah);

  if (errUpdate) {
    return ctx.answerCallbackQuery({ text: "Gagal menyimpan. Cuba lagi.", show_alert: true });
  }

  await ctx.answerCallbackQuery({ text: "✅ Berjaya Disimpan!" });
  await ctx.editMessageText(
    `✅ **Pendaftaran Berjaya!**\n\n` +
    `Sekolah: *${kodSekolah}*\n` +
    `Jawatan: *${roleText}*\n` +
    `Status: *Aktif*\n\n` +
    `Data anda telah dikemaskini dalam SMPID.`, 
    { parse_mode: "Markdown" }
  );
});

// Helper Function untuk Alert
async function alertTaken(ctx: any) {
  await ctx.answerCallbackQuery({ 
    text: "⚠️ MAAF! Jawatan ini baru sahaja diambil oleh orang lain sebentar tadi.", 
    show_alert: true 
  });
  await ctx.deleteMessage(); // Padam menu lama supaya user refresh
}

Deno.serve(webhookCallback(bot, "std/http"));