/**
 * SMPID Telegram Bot (Deno Deploy)
 * Versi 5.0: Smart UI, Real-time Validation & Overwrite Mode
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

// 3. FUNGSI UI HELPER (Untuk Paparan Menu Utama)
async function getSchoolUI(kodSekolah: string, telegramId: number) {
  const { data: sekolah, error } = await supabase
    .from("smpid_sekolah_data")
    .select("kod_sekolah, nama_sekolah, telegram_id_gpict, telegram_id_admin")
    .eq("kod_sekolah", kodSekolah)
    .single();

  if (error || !sekolah) return null;

  const gpictOwner = sekolah.telegram_id_gpict;
  const adminOwner = sekolah.telegram_id_admin;

  // Logic: Available if (Nobody owns it) OR (I own it)
  const isGpictAvailable = !gpictOwner || gpictOwner === telegramId;
  const isAdminAvailable = !adminOwner || adminOwner === telegramId;

  // Status Text
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

  const keyboard = new InlineKeyboard();
  let hasSafeOptions = false;

  // --- BUTANG PENDAFTARAN SELAMAT (SAFE MODE) ---
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

  if (hasSafeOptions) {
    msg += "👇 Sila pilih jawatan anda di bawah:";
  } else {
    msg += "⚠️ *Tiada slot kosong.* Jawatan telah diisi.\n" +
           "Jika anda pengguna sah, gunakan pilihan Overwrite di bawah.";
  }

  // --- BUTANG OVERWRITE (JIKA ADA SLOT ORANG LAIN) ---
  const isTakenByOther = (!isGpictAvailable || !isAdminAvailable);
  if (isTakenByOther) {
      keyboard.text("⚠️ Timpa Data (Overwrite)", `overwrite_menu:${sekolah.kod_sekolah}`).row();
  }

  // --- BUTANG TUTUP ---
  keyboard.text("❌ Tutup", "close");

  return { text: msg, keyboard };
}


// 4. LOGIK UTAMA

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

  // --- 3. PAPARKAN UI ---
  const ui = await getSchoolUI(inputKod, telegramId);
  if (!ui) {
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tiada dalam rekod kami.`, { parse_mode: "Markdown" });
  }

  await ctx.reply(ui.text, {
    reply_markup: ui.keyboard,
    parse_mode: "Markdown"
  });
});

// C. PENGENDALI BUTANG (Callback Query)
bot.on("callback_query:data", async (ctx) => {
  const dataString = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  // --- 1. ACTION: CLOSE ---
  if (dataString === "close") {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }

  const parts = dataString.split(":");
  const prefix = parts[0];

  // --- 2. ACTION: BACK TO MAIN MENU ---
  if (prefix === "back") {
      const kod = parts[1];
      const ui = await getSchoolUI(kod, telegramId);
      if (ui) {
          await ctx.editMessageText(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
      }
      return ctx.answerCallbackQuery();
  }

  // --- 3. ACTION: OVERWRITE MENU ---
  if (prefix === "overwrite_menu") {
      const kod = parts[1];
      const keyboard = new InlineKeyboard()
         .text("⚠️ Timpa GPICT", `force:gpict:${kod}`).row()
         .text("⚠️ Timpa Admin", `force:admin:${kod}`).row()
         .text("⚠️ Timpa Kedua-dua", `force:both:${kod}`).row()
         .text("« Kembali", `back:${kod}`); // Butang Back
      
      await ctx.editMessageText(
          `⚠️ **MOD OVERWRITE (TIMPA DATA)** ⚠️\n\n` +
          `Amaran: Tindakan ini akan **membuang akses pengguna lama** bagi jawatan yang dipilih dan menggantikannya dengan ID Telegram anda.\n\n` +
          `Hanya gunakan fungsi ini jika anda adalah pemegang jawatan yang sah.\n\n` +
          `Sila pilih tindakan:`,
          { reply_markup: keyboard, parse_mode: "Markdown" }
      );
      return ctx.answerCallbackQuery();
  }

  // --- 4. ACTION: REGISTER (SAFE & FORCE) ---
  // prefix: 'role' (Safe) or 'force' (Overwrite)
  if (prefix === "role" || prefix === "force") {
      const role = parts[1];
      const kodSekolah = parts[2];
      const isForce = (prefix === "force");

      // Validasi 'Safe Mode' (Hanya untuk 'role')
      if (!isForce) {
          const { data: sekolah, error } = await supabase
            .from("smpid_sekolah_data")
            .select("telegram_id_gpict, telegram_id_admin")
            .eq("kod_sekolah", kodSekolah)
            .single();

          if (error || !sekolah) return ctx.answerCallbackQuery({ text: "Ralat data." });

          const gpictSafe = !sekolah.telegram_id_gpict || sekolah.telegram_id_gpict === telegramId;
          const adminSafe = !sekolah.telegram_id_admin || sekolah.telegram_id_admin === telegramId;

          if (role === "gpict" && !gpictSafe) return alertTaken(ctx);
          if (role === "admin" && !adminSafe) return alertTaken(ctx);
          if (role === "both" && (!gpictSafe || !adminSafe)) return alertTaken(ctx);
      }

      // Sediakan Data Update
      let updateData = {};
      let roleText = "";

      if (role === "gpict") {
        updateData = { telegram_id_gpict: telegramId };
        roleText = "Guru Penyelaras ICT";
      } else if (role === "admin") {
        updateData = { telegram_id_admin: telegramId };
        roleText = "Admin DELIMa";
      } else if (role === "both") {
        updateData = { telegram_id_gpict: telegramId, telegram_id_admin: telegramId };
        roleText = "Guru ICT & Admin DELIMa";
      }

      // Execute Update
      const { error: errUpdate } = await supabase
        .from("smpid_sekolah_data")
        .update(updateData)
        .eq("kod_sekolah", kodSekolah);

      if (errUpdate) {
        return ctx.answerCallbackQuery({ text: "Gagal menyimpan. Cuba lagi.", show_alert: true });
      }

      await ctx.answerCallbackQuery({ text: isForce ? "Data berjaya ditimpa!" : "Pendaftaran Berjaya!" });
      
      const successTitle = isForce ? "✅ **Data Berjaya Ditimpa!**" : "✅ **Pendaftaran Berjaya!**";
      
      await ctx.editMessageText(
        `${successTitle}\n\n` +
        `Sekolah: *${kodSekolah}*\n` +
        `Jawatan: *${roleText}*\n` +
        `Status: *Aktif*\n\n` +
        `Terima kasih. Rekod telah dikemaskini.`, 
        { parse_mode: "Markdown" }
      );
  }
});

// Helper Function untuk Alert
async function alertTaken(ctx: any) {
  await ctx.answerCallbackQuery({ 
    text: "⚠️ Slot ini telah diambil orang lain. Sila guna butang 'Overwrite' jika perlu.", 
    show_alert: true 
  });
  // Refresh menu untuk tunjuk butang Overwrite
  const dataString = ctx.callbackQuery.data;
  const parts = dataString.split(":");
  const kod = parts[2]; // role:type:kod
  
  // Reload UI
  // Note: We can't easily call getSchoolUI inside alert without triggering edit loop issues sometimes, 
  // but deleting helps user restart flow.
  await ctx.deleteMessage(); 
}

Deno.serve(webhookCallback(bot, "std/http"));