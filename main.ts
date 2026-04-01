/**
 * NADIM Telegram Bot & API (Deno Deploy)
 * Menyokong penerimaan parameter pukal bagi senarai ID guru dan murid.
 * Dikemas kini dengan paparan maklumat daerah untuk rujukan pantas pentadbir.
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY");

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("CRITICAL: Sila tetapkan BOT_TOKEN, SUPABASE_URL, dan SUPABASE_KEY di Deno Deploy.");
}

const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Naik taraf fungsi untuk mengambil nama dan daerah serentak
async function getSchoolInfo(kod: string): Promise<{ nama: string; daerah: string }> {
  try {
    const { data } = await supabase
      .from("smpid_sekolah_data")
      .select("nama_sekolah, daerah")
      .eq("kod_sekolah", kod)
      .single();
    return {
      nama: data?.nama_sekolah || kod,
      daerah: data?.daerah || "TIADA MAKLUMAT"
    };
  } catch (e) {
    return { nama: kod, daerah: "TIADA MAKLUMAT" };
  }
}

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

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Selamat Datang ke Bot NADIM*\n\n" +
    "Sila masukkan **Kod Sekolah** anda untuk semakan status & pendaftaran.\n" +
    "_(Contoh: MBA0001)_",
    { parse_mode: "Markdown" }
  );
});

bot.on("message:text", async (ctx) => {
  const inputTeks = ctx.message.text.trim();
  const inputKod = inputTeks.toUpperCase();
  const telegramId = ctx.from.id;

  if (inputKod === "M030") {
    const ui = await getAdminUI(telegramId);
    if (!ui) return ctx.reply("❌ Ralat sistem database admin. Sila pastikan pangkalan data sedia.");
    return ctx.reply(ui.text, { reply_markup: ui.keyboard, parse_mode: "Markdown" });
  }

  if (inputKod.length < 3 || inputKod.length > 9) {
    return ctx.reply("⚠️ Format kod tidak sah. Sila masukkan Kod Sekolah (Contoh: MBA0001).");
  }

  const ui = await getSchoolUI(inputKod, telegramId);
  if (!ui) {
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tiada dalam rekod kami.`, { parse_mode: "Markdown" });
  }

  await ctx.reply(ui.text, {
    reply_markup: ui.keyboard,
    parse_mode: "Markdown"
  });
});

bot.on("callback_query:data", async (ctx) => {
  const dataString = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  if (dataString === "close") {
    await ctx.answerCallbackQuery();
    return ctx.deleteMessage();
  }

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

const handleBotUpdate = webhookCallback(bot, "std/http");

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, ""); 

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const createRes = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  };

  try {
    if (path === "/notify" && req.method === "POST") {
      const { kod, nama, updated_by } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      
      if (admins && admins.length > 0) {
        let icon = "🔔";
        let act = "dikemaskini oleh pihak sekolah.";
        if (updated_by === 'PENTADBIR PPD') { icon = "🛡️"; act = "dikemaskini oleh PENTADBIR PPD."; }
        
        const msg = `${icon} <b>KEMASKINI DATA SEKOLAH</b>\n\n🏫 <b>${nama}</b>\nKod: <code>${kod}</code>\n\nStatus: Maklumat sekolah ini baru sahaja ${act}`;
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, msg, { parse_mode: "HTML" }).catch(() => {}));
      }
      return createRes({ status: "success" });
    }

    if (path === "/notify-ticket" && req.method === "POST") {
      const { kod, peranan, tajuk, mesej } = await req.json();
      const schoolInfo = await getSchoolInfo(kod);
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      
      if (admins && admins.length > 0) {
        const text = `🆘 <b>TIKET ADUAN BARU</b>\n\n🏫 Sekolah: <b>${schoolInfo.nama}</b> (<code>${kod}</code>)\n📍 Daerah: <b>${schoolInfo.daerah}</b>\n👤 Pengirim: <b>${peranan}</b>\n📌 Tajuk: <b>${tajuk}</b>\n\n📝 Mesej: <i>${mesej}</i>`;
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "HTML" }).catch(() => {}));
      }
      return createRes({ status: "success" });
    }

    if (path === "/reply-ticket" && req.method === "POST") {
      const { kod, peranan, tajuk, balasan } = await req.json();
      const schoolInfo = await getSchoolInfo(kod);
      const { data: sek } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      
      if (sek) {
        const targetId = (peranan === 'GPICT') ? sek.telegram_id_gpict : sek.telegram_id_admin;
        if (targetId) {
          const text = `✅ <b>STATUS TIKET: SELESAI</b>\n\n🏫 Sekolah: <b>${schoolInfo.nama}</b>\n📌 Tajuk: <b>${tajuk}</b>\n💬 Respon PPD: <i>${balasan}</i>`;
          await bot.api.sendMessage(targetId, text, { parse_mode: "HTML" }).catch(() => {});
        }
      }
      return createRes({ status: "success" });
    }

    if (path === "/notify-booking" && req.method === "POST") {
      const { kod, nama, tajuk, tarikh, masa, pic, tel } = await req.json();
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      
      if (admins && admins.length > 0) {
        const dt = new Date(tarikh).toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' });
        const text = `📅 <b>TEMPAHAN BIMBINGAN BARU</b>\n\n🏫 <b>${nama}</b> (<code>${kod}</code>)\n📌 <b>${tajuk}</b>\n🗓️ <b>${dt}</b> (<b>${masa.toUpperCase()}</b>)\n👤 PIC: <b>${pic}</b>\n📞 <a href="https://wa.me/${tel.replace(/[^0-9]/g, '')}">${tel}</a>`;
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "HTML" }).catch(() => {}));
      }
      return createRes({ status: "success" });
    }

    if (path === "/notify-delima" && req.method === "POST") {
      const { kod, kategori, catatan, senarai_calon } = await req.json();
      const schoolInfo = await getSchoolInfo(kod);
      
      let title = "KEMASKINI STATUS ID (KELOMPOK)";
      if (catatan === 'Berpindah MASUK ke sekolah ini') {
          title = "MOHON PINDAH MASUK ID (KELOMPOK)";
      }

      let senaraiHTML = "";
      senarai_calon.forEach((c: any, index: number) => {
          senaraiHTML += `${index + 1}. <b>${c.nama}</b>\n   📧 <i>${c.id_delima || 'Tiada emel'}</i>\n`;
      });

      const text = `🔄 <b>${title}</b>\n\n🏫 Sekolah: <b>${schoolInfo.nama}</b> (<code>${kod}</code>)\n📍 Daerah: <b>${schoolInfo.daerah}</b>\n👥 Kategori: <b>${kategori}</b>\n📝 Catatan: <i>${catatan}</i>\n\n📋 <b>Senarai Calon:</b>\n${senaraiHTML}`;
      
      await bot.api.sendMessage("-1003371951236", text, { parse_mode: "HTML" }).catch(e => console.error("Ralat hantar ke group:", e));
      
      const { data: admins } = await supabase.from("smpid_admin_users").select("telegram_id").not("telegram_id", "is", null);
      if (admins && admins.length > 0) {
        admins.forEach(a => bot.api.sendMessage(a.telegram_id, text, { parse_mode: "HTML" }).catch(() => {}));
      }
      
      return createRes({ status: "success" });
    }

    if (path === "/reply-delima" && req.method === "POST") {
      const { kod, kategori, nama, status } = await req.json();
      const schoolInfo = await getSchoolInfo(kod);
      const { data: sek } = await supabase.from("smpid_sekolah_data").select("telegram_id_gpict, telegram_id_admin").eq("kod_sekolah", kod).single();
      
      if (sek) {
        const targetId = sek.telegram_id_admin || sek.telegram_id_gpict;
        if (targetId) {
          const text = `✅ <b>STATUS DELIMA: ${status}</b>\n\n🏫 Sekolah: <b>${schoolInfo.nama}</b>\n👥 Kategori: <b>${kategori}</b>\n👤 Nama: <b>${nama}</b>\n💬 Tindakan PPD telah selesai.`;
          await bot.api.sendMessage(targetId, text, { parse_mode: "HTML" }).catch(() => {});
        }
      }
      return createRes({ status: "success" });
    }

    return await handleBotUpdate(req);

  } catch (err) {
    console.error("Critical Server Error:", err);
    return createRes({ status: "error", message: String(err) }, 500);
  }
});