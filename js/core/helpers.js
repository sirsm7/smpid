import { envReady, getEnv } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";

export function toggleLoading(show) {
  const el = document.getElementById("loadingOverlay");
  if (!el) {
    return;
  }
  if (show) {
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
}

export function cleanPhone(phone) {
  if (!phone) {
    return "";
  }
  let cleaned = String(phone).replace(/[^0-9]/g, "");
  if (cleaned.length === 0) {
    return "";
  }
  if (cleaned.startsWith("0")) {
    cleaned = "6" + cleaned;
  }
  return cleaned;
}

export function autoFormatPhone(input) {
  if (!input) {
    return;
  }
  const val = String(input.value || "").replace(/[^0-9]/g, "");
  if (val.length < 5) {
    return;
  }
  if (val.startsWith("60")) {
    input.value = "+" + val;
  } else if (val.startsWith("0")) {
    input.value = "+6" + val;
  } else {
    input.value = "+6" + val;
  }
}

export function formatSentenceCase(str) {
  if (!str) {
    return "";
  }
  return String(str).replace(/(?:^|[.!?]\s+)([a-z])/g, (match) => match.toUpperCase());
}

export function checkEmailDomain(email) {
  return Boolean(email && String(email).includes("@moe-dl.edu.my"));
}

export function generateWhatsAppLink(nama, noTel, isRaw = false) {
  const cleanNum = cleanPhone(noTel);
  if (!cleanNum) {
    return null;
  }
  if (isRaw) {
    return `https://wa.me/${cleanNum}`;
  }
  const rawMsg = `Assalamualaikum / Salam Sejahtera Cikgu ${nama || ""}, ini adalah mesej automatik NADIM.\n\nMohon kerjasama cikgu untuk aktifkan ID Telegram di bot kami. Sila klik https://t.me/smpid_bot , tekan Start, masukkan kod sekolah, dan pilih peranan.\n\nTerima kasih.`;
  return `https://wa.me/${cleanNum}?text=${encodeURIComponent(rawMsg)}`;
}

export function keluarSistem() {
  const performLogout = async () => {
    try {
      if (
        typeof window !== "undefined" &&
        window.RealtimeManager &&
        typeof window.RealtimeManager.unsubscribeAll === "function"
      ) {
        await window.RealtimeManager.unsubscribeAll();
      }
    } catch {}
    try {
      localStorage.clear();
    } catch {}
    window.location.replace("index.html");
  };

  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    window.Swal.fire({
      title: "Log Keluar?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Ya, Keluar",
      cancelButtonText: "Batal"
    }).then((result) => {
      if (result && result.isConfirmed) {
        performLogout();
      }
    });
    return;
  }

  if (typeof window !== "undefined" && window.confirm("Log Keluar?")) {
    performLogout();
  }
}

function resolveGasUploadUrl() {
  const env = getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  const candidate =
    (APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.GAS_UPLOAD_URL) ||
    (env && (env.GAS_UPLOAD_URL || env.GAS_ENDPOINT_URL)) ||
    (typeof window !== "undefined" ? window.GAS_URL : "") ||
    "";
  return typeof candidate === "string" ? candidate.trim() : "";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = typeof reader.result === "string" ? reader.result : "";
      const parts = resultStr.split(",");
      if (parts.length < 2 || !parts[1]) {
        reject(new Error("Gagal mengekstrak kandungan Base64 fail."));
        return;
      }
      resolve(parts[1]);
    };
    reader.onerror = () => {
      reject(new Error("Gagal membaca fail yang dimuat naik."));
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToDrive(file) {
  if (!file) {
    throw new Error("Tiada fail dipilih untuk dimuat naik.");
  }

  const maxMb =
    APP_CONFIG && APP_CONFIG.UPLOADS && typeof APP_CONFIG.UPLOADS.MAX_FILE_SIZE_MB === "number"
      ? APP_CONFIG.UPLOADS.MAX_FILE_SIZE_MB
      : 5;
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Saiz fail melebihi had maksimum ${maxMb}MB.`);
  }

  await envReady;

  const uploadUrl = resolveGasUploadUrl();
  if (!uploadUrl) {
    throw new Error("Konfigurasi titik akhir muat naik Google Apps Script tidak tersedia.");
  }

  const base64Data = await readFileAsBase64(file);
  const payload = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    base64Data
  };

  let response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    throw new Error("Gagal menyambung ke pelayan muat naik. Sila semak capaian internet anda.");
  }

  const rawText = await response.text();
  let result;
  try {
    result = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error("Tindak balas pelayan muat naik bukan format JSON yang sah.");
  }

  if (!response.ok || !result || result.status !== "success" || !result.url) {
    const errorMsg =
      result && typeof result.message === "string" && result.message.trim()
        ? result.message.trim()
        : "Ralat semasa proses muat naik fail ke Google Drive.";
    throw new Error(errorMsg);
  }

  return result.url;
}

if (typeof window !== "undefined") {
  window.toggleLoading = toggleLoading;
  window.autoFormatPhone = autoFormatPhone;
  window.cleanPhone = cleanPhone;
  window.generateWhatsAppLink = generateWhatsAppLink;
  window.formatSentenceCase = formatSentenceCase;
  window.checkEmailDomain = checkEmailDomain;
  window.keluarSistem = keluarSistem;
  window.uploadFileToDrive = uploadFileToDrive;
}