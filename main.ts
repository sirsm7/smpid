/**
 * MAIN.TS (GABUNGAN)
 * Mengandungi:
 * 1. Logik Bot Asal (Pendaftaran ID Telegram)
 * 2. Logik Baru (API untuk Helpdesk Web)
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// --- KONFIGURASI ---
// Pastikan ENV variables ini wujud di Deno Deploy Project Settings
const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY")!;

const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// BAHAGIAN 1: LOGIK BOT ASAL (PENDAFTARAN)
// ============================================================

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Selamat Datang ke Bot SMPID*\\n\\nSila masukkan **Kod Sekolah** anda untuk pendaftaran.\\n_(Contoh: MBA0001)_",
    { parse_mode: "Markdown" }
  );
});

// Semak mesej teks untuk Kod Sekolah
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim().toUpperCase();
  // Regex: 3 Huruf + 4 Digit (Contoh: MBA1234 atau MEA0001)
  const codeRegex = /^[A-Z]{3}\d{4}$/; 

  if (codeRegex.test(text)) {
    // Cari sekolah dalam database
    const { data: school, error } = await supabase
        .from("sekolah_data")
        .select("*")
        .eq("kod_sekolah", text)
        .single();

    if (error || !school) {
      return ctx.reply("❌ Kod sekolah tidak ditemui dalam sistem. Sila semak semula.");
    }

    // Paparkan butang pilihan peranan
    const keyboard = new InlineKeyboard()
      .text("Guru Penyelaras ICT", `reg_gpict_${text}`).row()
      .text("Admin DELIMa", `reg_admin_${text}`).row()
      .text("Kedua-duanya", `reg_both_${text}`);

    await ctx.reply(
      `🏫 **${school.nama_sekolah}** ditemui.\n\nSila pilih peranan anda untuk pendaftaran ID Telegram:`, 
      { reply_markup: keyboard, parse_mode: "Markdown" }
    );
  }
});

// Handle butang yang ditekan
bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;

  // Format callback: reg_ROLE_KODSEKOLAH
  if (data.startsWith("reg_")) {
    const parts = data.split("_");
    const role = parts[1]; // gpict / admin / both
    const kodSekolah = parts[2];
    const telegramId = ctx.callbackQuery.from.id;

    let updateData = {};
    
    if (role === 'gpict') {
       updateData = { telegram_id_gpict: telegramId };
    } else if (role === 'admin') {
       updateData = { telegram_id_admin: telegramId };
    } else if (role === 'both') {
       updateData = { telegram_id_gpict: telegramId, telegram_id_admin: telegramId };
    }

    // Kemaskini DB
    const { error } = await supabase
      .from("sekolah_data")
      .update(updateData)
      .eq("kod_sekolah", kodSekolah);

    if (error) {
      await ctx.answerCallbackQuery({ text: "Ralat Sistem! Cuba lagi.", show_alert: true });
    } else {
      await ctx.answerCallbackQuery({ text: "Pendaftaran Berjaya!" });
      await ctx.editMessageText(
        `✅ Tahniah! ID Telegram anda telah direkodkan untuk sekolah **${kodSekolah}**.\n\nTerima kasih.`, 
        { parse_mode: "Markdown" }
      );
    }
  }
});

// ============================================================
// BAHAGIAN 2: LOGIK API BARU (UNTUK HELPDESK WEB)
// ============================================================

const handleUpdate = webhookCallback(bot, "std/http");

serve(async (req) => {
  const url = new URL(req.url);

  // 1. Endpoint: Web App hantar arahan notifikasi ke sini
  if (req.method === "POST" && url.pathname === "/api/notify") {
    try {
      const body = await req.json();
      const { target_kod, message, type } = body; 

      // SENARIO A: Sekolah hantar mesej (Notify Admin PPD)
      if (type === 'to_admin') {
         // Dapatkan semua Superadmin (atau hardcode ID anda sementara waktu jika table admin_users tiada)
         const { data: admins } = await supabase.from("admin_users").select("telegram_id");
         
         if (admins && admins.length > 0) {
            const text = `📨 **Mesej Baru Helpdesk**\n\n🏫 Daripada: \`${target_kod}\`\n💬 Mesej: ${message}\n\n_Sila buka Portal Web untuk membalas._`;
            
            for (const admin of admins) {
               // Hantar notifikasi kepada setiap admin
               try { await bot.api.sendMessage(admin.telegram_id, text, { parse_mode: "Markdown" }); } catch (e) {}
            }
         }
      }

      // SENARIO B: Admin PPD balas mesej (Notify Sekolah)
      else if (type === 'to_school') {
         // Cari ID Telegram Guru & Admin sekolah tersebut
         const { data: school } = await supabase
            .from("sekolah_data")
            .select("telegram_id_gpict, telegram_id_admin")
            .eq("kod_sekolah", target_kod)
            .single();
         
         if (school) {
            // Gabungkan ID (buang null jika salah seorang belum daftar)
            const recipientIds = [school.telegram_id_gpict, school.telegram_id_admin].filter(id => id);
            
            const text = `🔔 **Maklumbalas PPD**\n\n💬 ${message}\n\n_Sila semak Portal Web Helpdesk._`;
            
            for (const id of recipientIds) {
               try { await bot.api.sendMessage(id, text, { parse_mode: "Markdown" }); } catch (e) {}
            }
         }
      }

      return new Response(JSON.stringify({ success: true }), { 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  // 2. Handle CORS (Wajib untuk browser fetch)
  if (req.method === "OPTIONS") {
     return new Response(null, { 
         headers: { 
             "Access-Control-Allow-Origin": "*", 
             "Access-Control-Allow-Methods": "POST", 
             "Access-Control-Allow-Headers": "Content-Type" 
         } 
     });
  }

  // 3. Fallback: Telegram Webhook Update (Supaya bot reply user biasa)
  return await handleUpdate(req);
});