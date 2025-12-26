/**
 * SMPID Telegram Bot (Deno Deploy)
 * Bahasa: TypeScript
 * Framework: grammY
 * Database: Supabase
 */

import { Bot, InlineKeyboard, webhookCallback } from "https://deno.land/x/grammy@v1.21.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// 1. KONFIGURASI ENV
const BOT_TOKEN = Deno.env.get("BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_KEY");
const SECRET_KEY = Deno.env.get("SECRET_KEY") || "rahsia_ppd_melaka"; 

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Sila tetapkan BOT_TOKEN, SUPABASE_URL, dan SUPABASE_KEY.");
}

// 2. INISIALISASI
const bot = new Bot(BOT_TOKEN);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. LOGIK BOT (COMMANDS)

bot.command("start", async (ctx) => {
  await ctx.reply(
    "👋 *Selamat Datang ke Bot SMPID*\n\n" +
    "Sila masukkan **Kod Sekolah** anda untuk memulakan pendaftaran.\n" +
    "_(Contoh: MBA0001)_",
    { parse_mode: "Markdown" }
  );
});

bot.on("message:text", async (ctx) => {
  const inputTeks = ctx.message.text.trim();
  const inputKod = inputTeks.toUpperCase();
  const telegramId = ctx.from.id;

  if (inputKod === "M030") {
    const { error } = await supabase
      .from("admin_users")
      .upsert({ telegram_id: telegramId }, { onConflict: "telegram_id" });

    if (error) {
      console.error("Ralat Pendaftaran Admin:", error);
      return ctx.reply("❌ Ralat sistem. Sila cuba sebentar lagi.");
    }
    return ctx.reply(
      "✅ *Akses Admin Disahkan.*\nID Telegram anda telah direkodkan dalam sistem PPD.",
      { parse_mode: "Markdown" }
    );
  }

  if (inputKod.length < 5 || inputKod.length > 9) {
    return ctx.reply("⚠️ Format kod sekolah tidak sah. Sila cuba lagi (Contoh: MBA0001).");
  }

  const { data, error } = await supabase
    .from("sekolah_data")
    .select("kod_sekolah, nama_sekolah")
    .eq("kod_sekolah", inputKod)
    .single();

  if (error || !data) {
    return ctx.reply(`❌ Kod sekolah *${inputKod}* tidak dijumpai.`, { parse_mode: "Markdown" });
  }

  const keyboard = new InlineKeyboard()
    .text("👨‍💻 Saya Guru Penyelaras ICT", `role:gpict:${data.kod_sekolah}`).row()
    .text("📂 Saya Admin DELIMa", `role:admin:${data.kod_sekolah}`).row()
    .text("✅ Saya Memegang Kedua-dua Jawatan", `role:both:${data.kod_sekolah}`);

  await ctx.reply(
    `🏫 **Sekolah Ditemui:**\n${data.nama_sekolah}\n(${data.kod_sekolah})\n\nSila pilih peranan anda di sekolah ini:`,
    { reply_markup: keyboard, parse_mode: "Markdown" }
  );
});

bot.on("callback_query:data", async (ctx) => {
  const dataString = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;
  const [prefix, role, kodSekolah] = dataString.split(":");

  if (prefix !== "role") return;

  let updateData = {};
  let roleText = "";

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

  const { error } = await supabase
    .from("sekolah_data")
    .update(updateData)
    .eq("kod_sekolah", kodSekolah);

  if (error) {
    await ctx.answerCallbackQuery({ text: "Gagal menyimpan data.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Pendaftaran Berjaya!" });
  await ctx.editMessageText(
    `✅ **Pendaftaran Berjaya!**\n\nSekolah: *${kodSekolah}*\nPeranan: *${roleText}*\nID Telegram: \`${telegramId}\`\n\nTerima kasih.`,
    { parse_mode: "Markdown" }
  );
});


// 4. API HANDLER (CORS DIPERBAIKI)
const handleBlastRequest = async (req: Request) => {
  // HEADER CORS GLOBAL
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*", // Benarkan semua domain (termasuk GitHub Pages)
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  // 1. Handle Preflight Request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Hanya benarkan POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { secret, ids, message } = body;

    if (secret !== SECRET_KEY) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { 
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (!ids || !Array.isArray(ids) || !message) {
      return new Response(JSON.stringify({ success: false, error: "Invalid Data" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let successCount = 0;
    for (const id of ids) {
      try {
        await bot.api.sendMessage(id, message, { parse_mode: "Markdown" });
        successCount++;
      } catch (e) {
        console.error(`Gagal hantar ke ${id}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent_count: successCount }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json", ...corsHeaders } 
    });
  }
};


// 5. JALANKAN PELAYAN
Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Laluan API
  if (url.pathname === "/api/blast") {
    return handleBlastRequest(req);
  }

  // Laluan Bot Telegram (Webhook)
  return await webhookCallback(bot, "std/http")(req);
});