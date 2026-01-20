/**
 * SMPID Telegram Bot (Deno Deploy)
 * Versi 6.0: Full Smart UI for Schools & Super Admin (M030)
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

// 3. FUNGSI UI HELPER

// A. UI SEKOLAH (Kod: MBAxxxx)
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
           "Gunakan pilihan Overwrite di bawah jika perlu.";
  }

  const isTakenByOther = (!isGpictAvailable || !isAdminAvailable);
  if (isTakenByOther) {
      keyboard.text("⚠️ Timpa Data (Overwrite)", `overwrite_menu:${sekolah.kod_sekolah}`).row();
  }

  keyboard.text("❌ Tutup", "close");
  return { text: msg, keyboard };
}

// B. UI SUPER ADMIN (Kod: M030)
async function getAdminUI(telegramId: number) {
    // Cari semua admin
    const { data: admins, error } = await supabase
        .from("smpid_admin_users")
        .select("telegram_id");

    if (error) return null;

    // Logik: Kita anggap "Admin PPD" sepatutnya eksklusif atau kita pantau siapa ada.
    // Jika table kosong -> Available
    // Jika user wujud -> "Anda"
    // Jika user lain wujud -> "Orang Lain"
    
    const amIRegistered = admins.some(a => a.telegram_id === telegramId);
    const totalAdmins = admins.length;
    
    let statusText = "";
    let isAvailable = false;

    if (totalAdmins === 0) {
        statusText = "⚪ Kosong (Boleh Daftar)";
        isAvailable = true;
    } else if (amIRegistered) {
        statusText = "✅ Anda Sudah Berdaftar (Aktif)";
        isAvailable = true; // Boleh update diri sendiri
    } else {
        statusText = `⛔ Sudah Diisi (${totalAdmins} pengguna lain)`;
        isAvailable = false;
    }

    let msg = `🛡️ *PANEL SUPER ADMIN (PPD)*\n` +
              `Kod Akses: \`M030\`\n\n` +
              `📊 *Status Akses Semasa:*\n` +
              `• Admin PPD: ${statusText}\n\n`;

    const keyboard = new InlineKeyboard();

    if (isAvailable) {
        if (totalAdmins === 0) msg += "👇 Sila tekan untuk aktifkan akses Admin.";
        else msg += "👇 Anda boleh kemaskini akses anda.";
        
        keyboard.text("🛡️ Daftar / Kemaskini Admin", "admin_ppd:register").row();
    } else {
        msg += "⚠️ *Akses Terhad.* Admin lain telah mendaftar.\n" +
               "Jika anda ingin mengambil alih akses (Reset Admin Lain), tekan butang di bawah.";
        
        keyboard.text("⚠️ Timpa Data (Overwrite)", "admin_ppd:overwrite_confirm").row();
    }

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

// B. PENGENDALI TEKS
bot.on("message:text", async (ctx) => {
  const inputTeks = ctx.message.text.trim();
  const inputKod = inputTeks.toUpperCase();
  const telegramId = ctx.from.id;

  // --- 1. SUPER ADMIN CHECK (M030) - UPDATE V6 ---
  if (inputKod === "M030") {
    const ui = await getAdminUI(telegramId);
    if (!ui) return ctx.reply("❌ Ralat sistem database admin.");
    
    return ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
  }

  // --- 2. VALIDASI FORMAT SEKOLAH ---
  if (inputKod.length < 5 || inputKod.length > 9) {
    return ctx.reply("⚠️ Format kod tidak sah. Sila masukkan Kod Sekolah (Contoh: MBA0001).");
  }

  // --- 3. PAPARKAN UI SEKOLAH ---
  const ui = await getSchoolUI(inputKod, telegramId);
  if (!ui) {
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tiada dalam rekod kami.`, { parse_mode: "Markdown" });
  }

  await ctx.reply(ui.text, {
    reply_markup: ui.keyboard,
    parse_mode: "Markdown"
  });
});

// C. PENGENDALI BUTANG
bot.on("callback_query:data", async (ctx) => {
  const dataString = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  // --- 1. GLOBAL ACTION: CLOSE ---
  if (dataString === "close") {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }

  // --- 2. SUPER ADMIN ACTIONS (M030) ---
  if (dataString.startsWith("admin_ppd:")) {
      const action = dataString.split(":")[1];

      // A. REGISTER (Normal)
      if (action === "register") {
          const { error } = await supabase
            .from("smpid_admin_users")
            .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id" });

          if (error) return ctx.answerCallbackQuery({ text: "Gagal daftar.", show_alert: true });

          await ctx.answerCallbackQuery({ text: "Akses Admin Disahkan!" });
          await ctx.editMessageText(
              "✅ **Akses Admin PPD Berjaya!**\n\n" +
              "ID Telegram anda telah direkodkan sebagai Admin PPD yang sah.", 
              { parse_mode: "Markdown" }
          );
      }
      
      // B. OVERWRITE MENU (Warning)
      else if (action === "overwrite_confirm") {
          const keyboard = new InlineKeyboard()
              .text("🔥 YA, Reset & Ambil Alih", "admin_ppd:overwrite_execute").row()
              .text("❌ Batal", "close");

          await ctx.editMessageText(
              "⚠️ **AMARAN: MOD OVERWRITE ADMIN** ⚠️\n\n" +
              "Adakah anda pasti? Tindakan ini akan:\n" +
              "1. **MEMADAM** semua Admin PPD lain yang sedia ada.\n" +
              "2. Menetapkan **ANDA** sebagai satu-satunya Admin PPD.\n\n" +
              "Teruskan hanya jika anda berhak.",
              { reply_markup: keyboard, parse_mode: "Markdown" }
          );
      }

      // C. OVERWRITE EXECUTE (Nuclear Option)
      else if (action === "overwrite_execute") {
          // Langkah 1: Delete semua row dalam admin_users (Reset)
          const { error: delError } = await supabase
            .from("smpid_admin_users")
            .delete()
            .neq("id", 0); // Delete all rows

          if (delError) return ctx.answerCallbackQuery({ text: "Gagal reset database.", show_alert: true });

          // Langkah 2: Insert diri sendiri
          const { error: insError } = await supabase
            .from("smpid_admin_users")
            .insert({ telegram_id: telegramId });

          if (insError) return ctx.answerCallbackQuery({ text: "Gagal simpan data baru.", show_alert: true });

          await ctx.answerCallbackQuery({ text: "Admin Reset Berjaya!" });
          await ctx.editMessageText(
              "✅ **Akses Admin PPD Diambil Alih!**\n\n" +
              "Semua admin lama telah dipadam. Anda kini adalah satu-satunya Admin PPD dalam sistem.", 
              { parse_mode: "Markdown" }
          );
      }
      return;
  }

  // --- 3. SCHOOL ACTIONS ---
  const parts = dataString.split(":");
  const prefix = parts[0];

  if (prefix === "back") {
      const kod = parts[1];
      const ui = await getSchoolUI(kod, telegramId);
      if (ui) await ctx.editMessageText(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
      return ctx.answerCallbackQuery();
  }

  if (prefix === "overwrite_menu") {
      const kod = parts[1];
      const keyboard = new InlineKeyboard()
         .text("⚠️ Timpa GPICT", `force:gpict:${kod}`).row()
         .text("⚠️ Timpa Admin", `force:admin:${kod}`).row()
         .text("⚠️ Timpa Kedua-dua", `force:both:${kod}`).row()
         .text("« Kembali", `back:${kod}`);
      
      await ctx.editMessageText(
          `⚠️ **MOD OVERWRITE (TIMPA DATA)** ⚠️\n\n` +
          `Sila pilih jawatan untuk diambil alih secara paksa:`,
          { reply_markup: keyboard, parse_mode: "Markdown" }
      );
      return ctx.answerCallbackQuery();
  }

  if (prefix === "role" || prefix === "force") {
      const role = parts[1];
      const kodSekolah = parts[2];
      const isForce = (prefix === "force");

      if (!isForce) {
          const { data: sekolah, error } = await supabase
            .from("smpid_sekolah_data")
            .select("telegram_id_gpict, telegram_id_admin")
            .eq("kod_sekolah", kodSekolah)
            .single();

          if (error || !sekolah) return ctx.answerCallbackQuery({ text: "Ralat data." });

          const gpictSafe = !sekolah.telegram_id_gpict || sekolah.telegram_id_gpict === telegramId;
          const adminSafe = !sekolah.telegram_id_admin || sekolah.telegram_id_admin === telegramId;

          if ((role === "gpict" && !gpictSafe) || 
              (role === "admin" && !adminSafe) || 
              (role === "both" && (!gpictSafe || !adminSafe))) {
             return alertTaken(ctx);
          }
      }

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

      const { error: errUpdate } = await supabase
        .from("smpid_sekolah_data")
        .update(updateData)
        .eq("kod_sekolah", kodSekolah);

      if (errUpdate) return ctx.answerCallbackQuery({ text: "Gagal menyimpan.", show_alert: true });

      const successTitle = isForce ? "✅ **Data Berjaya Ditimpa!**" : "✅ **Pendaftaran Berjaya!**";
      await ctx.answerCallbackQuery({ text: "Berjaya!" });
      await ctx.editMessageText(
        `${successTitle}\n\n` +
        `Sekolah: *${kodSekolah}*\n` +
        `Jawatan: *${roleText}*\n` +
        `Status: *Aktif*`, 
        { parse_mode: "Markdown" }
      );
  }
});

async function alertTaken(ctx: any) {
  await ctx.answerCallbackQuery({ text: "⚠️ Slot diambil orang lain. Guna Overwrite jika perlu.", show_alert: true });
  await ctx.deleteMessage(); 
}

Deno.serve(webhookCallback(bot, "std/http"));