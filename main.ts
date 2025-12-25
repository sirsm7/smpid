/**
 * SMPID Telegram Bot (Deno Deploy)
 * Bahasa: TypeScript
 * Framework: grammY
 * Database: Supabase
 */

import { Bot, Context, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// 1. KONFIGURASI ENV
// Pastikan variable ini diset dalam Settings -> Environment Variables di Deno Deploy
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY");

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Sila tetapkan BOT_TOKEN, SUPABASE_URL, dan SUPABASE_KEY.");
}

// 2. INISIALISASI
const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. LOGIK BOT

// Mesej aluan (/start)
bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Selamat Datang ke Bot SMPID*\n\n" +
    "Sila masukkan **Kod Sekolah** anda untuk memulakan pendaftaran.\n" +
    "_(Contoh: MBA0001)_",
    { parse_mode: "Markdown" }
  );
});

// Pengendali input teks (Mencari Kod Sekolah)
bot.on("message:text", async (ctx) => {
  const inputKod = ctx.message.text.trim().toUpperCase();

  // Semakan pantas (elak query jika input terlalu panjang/pendek)
  if (inputKod.length < 5 || inputKod.length > 9) {
    return ctx.reply("⚠️ Format kod sekolah tidak sah. Sila cuba lagi (Contoh: MBA0001).");
  }

  // Cari dalam Supabase
  const { data, error } = await supabase
    .from("sekolah_data")
    .select("kod_sekolah, nama_sekolah")
    .eq("kod_sekolah", inputKod)
    .single();

  if (error || !data) {
    console.error(`Carian gagal untuk ${inputKod}:`, error);
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tidak dijumpai dalam pangkalan data. Sila semak dan cuba lagi.`, { parse_mode: "Markdown" });
  }

  // Jika jumpa, bina butang (Stateless: Kita pasang kod sekolah dalam callback_data)
  // Format data: "role:PILIHAN:KOD_SEKOLAH"
  const keyboard = new InlineKeyboard()
    .text("👨‍💻 Saya Guru Penyelaras ICT", `role:gpict:${data.kod_sekolah}`).row()
    .text("📂 Saya Admin DELIMa", `role:admin:${data.kod_sekolah}`).row()
    .text("✅ Saya Memegang Kedua-dua Jawatan", `role:both:${data.kod_sekolah}`);

  await ctx.reply(
    `🏫 **Sekolah Ditemui:**\n${data.nama_sekolah}\n(${data.kod_sekolah})\n\nSila pilih peranan anda di sekolah ini:`,
    {
      reply_markup: keyboard,
      parse_mode: "Markdown"
    }
  );
});

// Pengendali Butang (Callback Query)
bot.on("callback_query:data", async (ctx) => {
  const dataString = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  // Pecahkan data string: "role:gpict:MBA0001" -> ["role", "gpict", "MBA0001"]
  const [prefix, role, kodSekolah] = dataString.split(":");

  if (prefix !== "role") return; // Abaikan jika bukan data butang peranan

  let updateData = {};
  let roleText = "";

  // Tentukan lajur mana nak dikemaskini
  switch (role) {
    case "gpict":
      updateData = { telegram_id_gpict: telegramId };
      roleText = "Guru Penyelaras ICT";
      break;
    case "admin":
      updateData = { telegram_id_admin: telegramId };
      roleText = "Admin DELIMa";
      break;
    case "both":
      updateData = { telegram_id_gpict: telegramId, telegram_id_admin: telegramId };
      roleText = "Guru ICT & Admin DELIMa";
      break;
    default:
      return ctx.answerCallbackQuery({ text: "Ralat data." });
  }

  // Lakukan kemaskini ke Supabase
  const { error } = await supabase
    .from("sekolah_data")
    .update(updateData)
    .eq("kod_sekolah", kodSekolah);

  if (error) {
    console.error("Supabase Update Error:", error);
    await ctx.answerCallbackQuery({ text: "Gagal menyimpan data. Sila cuba lagi.", show_alert: true });
    return;
  }

  // Beritahu Telegram loading dah habis
  await ctx.answerCallbackQuery({ text: "Pendaftaran Berjaya!" });

  // Edit mesej asal supaya pengguna tahu proses selesai
  await ctx.editMessageText(
    `✅ **Pendaftaran Berjaya!**\n\n` +
    `Sekolah: *${kodSekolah}*\n` +
    `Peranan: *${roleText}*\n` +
    `ID Telegram: \`${telegramId}\`\n\n` +
    `Terima kasih. Anda kini berdaftar dalam sistem SMPID.`,
    { parse_mode: "Markdown" }
  );
});

// 4. JALANKAN PELAYAN (WEBHOOK)
// Deno.serve sesuai untuk Deno Deploy
Deno.serve(webhookCallback(bot, "std/http"));