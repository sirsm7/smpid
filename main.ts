/**
 * SMPID Telegram Bot & API (Deno Deploy)
 * Versi: 4.5 (Booking Notification & Cross-PIC Routing Added)
 * Host: tech4ag.my
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
    const { data: roles, error } = await supabase
        .from("smpid_admin_users")
        .select("role, telegram_id");

    if (error || !roles) return null;

    const gpictRole = roles.find(r => r.role === 'ppd_gpict');
    const delimaRole = roles.find(r => r.role === 'ppd_delima');

    const gpictOwner = gpictRole?.telegram_id;
    const delimaOwner = delimaRole?.telegram_id;

    const isGpictAvailable = !gpictOwner || gpictOwner === telegramId;
    const isDelimaAvailable = !delimaOwner || delimaOwner === telegramId;

    const statusGpict = !gpictOwner ? "⚪ Kosong" 
                      : gpictOwner === telegramId ? "✅ Anda" 
                      : "⛔ Pegawai Lain";

    const statusDelima = !delimaOwner ? "⚪ Kosong" 
                       : delimaOwner === telegramId ? "✅ Anda" 
                       : "⛔ Pegawai Lain";

    let msg = `🛡️ *PANEL PEGAWAI USTP (PPD)*\n` +
              `Kod Akses: \`M030\`\n\n` +
              `📊 *Status Pegawai Meja:*\n` +
              `• PIC GPICT: ${statusGpict}\n` +
              `• PIC DELIMa: ${statusDelima}\n\n`;

    const keyboard = new InlineKeyboard();
    let hasSafeOptions = false;

    if (isGpictAvailable) {
        keyboard.text("👨‍💻 Daftar PIC GPICT", "admin_act:register:ppd_gpict").row();
        hasSafeOptions = true;
    }
    if (isDelimaAvailable) {
        keyboard.text("📂 Daftar PIC DELIMa", "admin_act:register:ppd_delima").row();
        hasSafeOptions = true;
    }

    if (hasSafeOptions) {
        msg += "👇 Sila pilih portfolio anda:";
    } else {
        msg += "⚠️ Semua slot pegawai telah diisi.";
    }

    if ((!isGpictAvailable || !isDelimaAvailable)) {
        keyboard.text("⚠️ Timpa Data (Overwrite)", "admin_act:overwrite_menu").row();
    }

    keyboard.text("❌ Tutup", "close");
    return { text: msg, keyboard };
}

// 4. LOGIK BOT UTAMA

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

  // SUPER ADMIN CHECK (M030)
  if (inputKod === "M030") {
    const ui = await getAdminUI(telegramId);
    if (!ui) return ctx.reply("❌ Ralat sistem database admin. Sila pastikan SQL migration telah dijalankan.");
    return ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
  }

  // VALIDASI FORMAT SEKOLAH
  if (inputKod.length < 5 || inputKod.length > 9) {
    return ctx.reply("⚠️ Format kod tidak sah. Sila masukkan Kod Sekolah (Contoh: MBA0001).");
  }

  // PAPARKAN UI SEKOLAH
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

  // GLOBAL ACTION: CLOSE
  if (dataString === "close") {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }

  // ADMIN PPD ACTIONS (M030)
  if (dataString.startsWith("admin_act:")) {
      const parts = dataString.split(":");
      const action = parts[1];
      const role = parts[2]; 

      if (action === "back") {
          const ui = await getAdminUI(telegramId);
          if (ui) await ctx.editMessageText(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
          return ctx.answerCallbackQuery();
      }

      if (action === "register") {
          const { data: currentRole } = await supabase.from("smpid_admin_users").select("telegram_id").eq("role", role).single();
          if (currentRole?.telegram_id && currentRole.telegram_id !== telegramId) {
             return alertTaken(ctx);
          }
          const { error } = await supabase.from("smpid_admin_users").update({ telegram_id: telegramId }).eq("role", role);
          if (error) return ctx.answerCallbackQuery({ text: "Gagal simpan.", show_alert: true });

          const roleName = role === 'ppd_gpict' ? "PIC GPICT" : "PIC Admin DELIMa";
          await ctx.answerCallbackQuery({ text: "Berjaya!" });
          await ctx.editMessageText(`✅ **Pendaftaran Pegawai Berjaya!**\n\nAnda kini berdaftar sebagai: *${roleName}*`, { parse_mode: "Markdown" });
      }

      else if (action === "overwrite_menu") {
          const keyboard = new InlineKeyboard()
             .text("⚠️ Timpa PIC GPICT", "admin_act:force:ppd_gpict").row()
             .text("⚠️ Timpa PIC DELIMa", "admin_act:force:ppd_delima").row()
             .text("« Kembali", "admin_act:back");
          
          await ctx.editMessageText(
              "⚠️ **MOD TIMPA DATA (OVERWRITE)** ⚠️\n\nSila pilih jawatan pegawai yang ingin diambil alih:",
              { reply_markup: keyboard, parse_mode: "Markdown" }
          );
      }

      else if (action === "force") {
          const { error } = await supabase.from("smpid_admin_users").update({ telegram_id: telegramId }).eq("role", role);
          if (error) return ctx.answerCallbackQuery({ text: "Gagal overwrite.", show_alert: true });

          const roleName = role === 'ppd_gpict' ? "PIC GPICT" : "PIC Admin DELIMa";
          await ctx.answerCallbackQuery({ text: "Berjaya Timpa Data!" });
          await ctx.editMessageText(`✅ **Akses Diambil Alih!**\n\nAnda kini berdaftar sebagai: *${roleName}*`, { parse_mode: "Markdown" });
      }
      return;
  }

  // SCHOOL ACTIONS (MBAxxxx)
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
          `⚠️ **MOD OVERWRITE (SEKOLAH)** ⚠️\n\n` +
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

          if ((role === "gpict" && !gpictSafe) || (role === "admin" && !adminSafe) || (role === "both" && (!gpictSafe || !adminSafe))) {
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

      const { error: errUpdate } = await supabase.from("smpid_sekolah_data").update(updateData).eq("kod_sekolah", kodSekolah);

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

// 5. API SERVER & WEBHOOK HANDLER
const handleBotUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Endpoint: /notify (Data Profil Dikemaskini)
  if (req.method === "POST" && url.pathname === "/notify") {
    try {
      const body = await req.json();
      const { kod, nama, updated_by } = body; 

      const { data: admins } = await supabase
        .from("smpid_admin_users")
        .select("telegram_id")
        .not("telegram_id", "is", null);

      if (admins && admins.length > 0) {
        let titleIcon = "🔔";
        let actionText = "dikemaskini oleh pihak sekolah.";
        
        if (updated_by === 'PENTADBIR PPD') {
            titleIcon = "🛡️";
            actionText = "dikemaskini oleh PENTADBIR PPD.";
        }

        const message = 
          `${titleIcon} *KEMASKINI DATA SEKOLAH*\n\n` +
          `🏫 *${nama}*\n` +
          `Kod: \`${kod}\`\n\n` +
          `Status: Maklumat sekolah ini baru sahaja ${actionText}`;

        const sendPromises = admins.map(admin => 
           bot.api.sendMessage(admin.telegram_id, message, { parse_mode: "Markdown" })
             .catch(err => console.error(`Gagal hantar ke ${admin.telegram_id}`, err))
        );
        await Promise.all(sendPromises);
      }
      return new Response(JSON.stringify({ status: "success" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ status: "error" }), { status: 500 });
    }
  }

  // --- Endpoint /notify-booking (BARU: Notifikasi Tempahan) ---
  if (req.method === "POST" && url.pathname === "/notify-booking") {
      try {
          const body = await req.json();
          const { kod, nama, tarikh, masa, tajuk, pic_name, pic_phone } = body;

          // A. Notifikasi ke Admin PPD
          const { data: admins } = await supabase
              .from("smpid_admin_users")
              .select("telegram_id")
              .not("telegram_id", "is", null);

          if (admins && admins.length > 0) {
              const waLink = `https://wa.me/${pic_phone.replace(/[^0-9]/g, '')}`;
              const ppdText = 
                  `📅 *TEMPAHAN BENGKEL BARU*\n\n` +
                  `🏫 Sekolah: *${nama}* (${kod})\n` +
                  `📌 Fokus: *${tajuk}*\n` +
                  `🗓️ Tarikh: *${tarikh}* | *${masa}*\n` +
                  `👤 PIC: *${pic_name}*\n` +
                  `📞 Telefon: [${pic_phone}](${waLink})\n\n` +
                  `_Sila semak kalendar bimbingan untuk pengesahan._`;

              const ppdPromises = admins.map(admin => 
                  bot.api.sendMessage(admin.telegram_id, ppdText, { parse_mode: "Markdown", disable_web_page_preview: true })
                  .catch(err => console.error(err))
              );
              await Promise.all(ppdPromises);
          }

          // B. Notifikasi ke PIC Sekolah (Pendaftar Bot)
          const { data: sekolah } = await supabase
              .from("smpid_sekolah_data")
              .select("telegram_id_gpict, telegram_id_admin")
              .eq("kod_sekolah", kod)
              .single();

          if (sekolah) {
              const schoolText = 
                  `✅ *PENGESAHAN TEMPAHAN*\n\n` +
                  `Sistem telah merekodkan permohonan bimbingan untuk sekolah anda.\n\n` +
                  `📌 Fokus: *${tajuk}*\n` +
                  `🗓️ Tarikh: *${tarikh}* (${masa})\n\n` +
                  `_Sila tunggu maklum balas daripada pegawai USTP PPD Alor Gajah._`;

              const schoolPicIds = [sekolah.telegram_id_gpict, sekolah.telegram_id_admin].filter(id => id);
              const schoolPromises = schoolPicIds.map(id => 
                  bot.api.sendMessage(id, schoolText, { parse_mode: "Markdown" })
                  .catch(err => console.error(err))
              );
              await Promise.all(schoolPromises);
          }

          return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) {
          return new Response(JSON.stringify({ status: "error" }), { status: 500 });
      }
  }

  // --- Endpoint /notify-ticket (User Hantar Tiket -> Admin PPD) ---
  if (req.method === "POST" && url.pathname === "/notify-ticket") {
      try {
          const body = await req.json();
          const { kod, peranan, tajuk, mesej } = body;

          const { data: admins } = await supabase
              .from("smpid_admin_users")
              .select("telegram_id")
              .not("telegram_id", "is", null);

          if (admins && admins.length > 0) {
              const text = 
                  `🆘 *TIKET ADUAN BARU*\n\n` +
                  `🏫 Sekolah: *${kod}*\n` +
                  `👤 Pengirim: *${peranan}*\n` +
                  `📌 Tajuk: *${tajuk}*\n\n` +
                  `📝 Mesej: ${mesej}\n\n` +
                  `_Sila buka panel admin untuk membalas._`;

              const sendPromises = admins.map(admin => 
                  bot.api.sendMessage(admin.telegram_id, text, { parse_mode: "Markdown" })
                  .catch(err => console.error(err))
              );
              await Promise.all(sendPromises);
          }
          return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) {
          return new Response(JSON.stringify({ status: "error" }), { status: 500 });
      }
  }

  // --- Endpoint /reply-ticket (Admin Balas -> User Sekolah) ---
  if (req.method === "POST" && url.pathname === "/reply-ticket") {
      try {
          const body = await req.json();
          const { kod, peranan, tajuk, balasan } = body;

          const { data: sekolah } = await supabase
              .from("smpid_sekolah_data")
              .select("telegram_id_gpict, telegram_id_admin")
              .eq("kod_sekolah", kod)
              .single();

          if (sekolah) {
              let targetId = null;
              if (peranan === 'GPICT') targetId = sekolah.telegram_id_gpict;
              else if (peranan === 'ADMIN') targetId = sekolah.telegram_id_admin;

              if (targetId) {
                  const text = 
                      `✅ *STATUS TIKET: SELESAI*\n\n` +
                      `📌 Tajuk: *${tajuk}*\n` +
                      `👤 Dibalas Oleh: *PPD (Admin)*\n\n` +
                      `💬 Respon: ${balasan}\n\n` +
                      `_Sila semak portal untuk maklumat lanjut._`;

                  await bot.api.sendMessage(targetId, text, { parse_mode: "Markdown" });
              }
          }
          return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) {
          return new Response(JSON.stringify({ status: "error" }), { status: 500 });
      }
  }

  // Handle Telegram Webhook
  if (req.method === "OPTIONS") {
      return new Response(null, {
          headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" }
      });
  }

  return await handleBotUpdate(req);
});