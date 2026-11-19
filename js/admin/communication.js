import { envReady, getEnv } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient } from "../core/db.js";
import { SupportService } from "../services/support.service.js";
import { toggleLoading } from "../core/helpers.js";

let quill = null;
let quillInitRetryCount = 0;
let emailBlastBusy = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message =
    options && (options.text || options.title)
      ? `${options.title || ""}\n${options.text || ""}`.trim()
      : "";
  if (options && options.showCancelButton) {
    const confirmed = window.confirm(message);
    return Promise.resolve({ isConfirmed: confirmed });
  }
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function resolveGasEmailUrl() {
  const env = getEnv() || (typeof window !== "undefined" ? window.__ENV : null);
  const candidate =
    (APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.GAS_EMAIL_URL) ||
    (env && (env.GAS_EMAIL_URL || env.GAS_ENDPOINT_URL)) ||
    (typeof window !== "undefined" ? window.GAS_URL : "") ||
    "";
  return typeof candidate === "string" ? candidate.trim() : "";
}

function applyDefaultQuillTemplate(editor) {
  if (!editor || typeof editor.setContents !== "function") {
    return;
  }

  editor.setContents([
    { insert: "Assalamualaikum & Salam Sejahtera Tuan/Puan,\n\n" },
    {
      insert:
        "Mohon kerjasama Tuan/Puan selaku Guru Penyelaras ICT (GPICT) atau Admin DELIMa sekolah untuk mengesahkan peranan anda dalam sistem NaDIM melalui Bot Telegram rasmi kami.\n\n"
    },
    { insert: "Sila ikuti langkah mudah berikut:", attributes: { bold: true } },
    { insert: "\n" },
    { insert: "Buka pautan bot rasmi: " },
    {
      insert: "https://t.me/smpid_bot",
      attributes: { link: "https://t.me/smpid_bot" }
    },
    { insert: "\n", attributes: { list: "ordered" } },
    { insert: "Tekan butang " },
    { insert: "'Start'", attributes: { bold: true } },
    { insert: " atau taip arahan " },
    { insert: "/start", attributes: { italic: true } },
    { insert: "." },
    { insert: "\n", attributes: { list: "ordered" } },
    { insert: "Masukkan " },
    { insert: "KOD SEKOLAH", attributes: { bold: true } },
    { insert: " anda (contoh: MBA0001)." },
    { insert: "\n", attributes: { list: "ordered" } },
    { insert: "Pilih butang peranan jawatan yang tepat bagi sekolah anda." },
    { insert: "\n", attributes: { list: "ordered" } },
    {
      insert:
        "\nKerjasama dan komitmen Tuan/Puan dalam menyempurnakan ekosistem digital daerah amat dihargai.\nSekian, terima kasih.\n\n"
    },
    { insert: "Unit Sumber Teknologi Pendidikan (USTP)", attributes: { bold: true } },
    { insert: "\nSektor Pembelajaran, Pejabat Pendidikan Daerah.\n" }
  ]);
}

window.initEmailEditor = function () {
  const editorContainer = document.getElementById("editor-container");
  if (!editorContainer || quill) {
    return;
  }

  const QuillLib =
    (typeof window !== "undefined" && window.Quill) ||
    (typeof Quill !== "undefined" ? Quill : null);

  if (!QuillLib) {
    if (quillInitRetryCount < 25) {
      quillInitRetryCount += 1;
      setTimeout(window.initEmailEditor, 120);
    }
    return;
  }

  const parentContainer = editorContainer.parentElement;
  if (parentContainer) {
    const oldToolbars = parentContainer.querySelectorAll(".ql-toolbar");
    oldToolbars.forEach((tb) => tb.remove());
  }
  clearElement(editorContainer);

  try {
    quill = new QuillLib("#editor-container", {
      theme: "snow",
      placeholder: "Tulis draf hebahan rasmi anda di sini...",
      modules: {
        toolbar: [
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ header: [1, 2, 3, false] }],
          [{ color: [] }, { background: [] }],
          ["link", "clean"]
        ]
      }
    });

    applyDefaultQuillTemplate(quill);
  } catch {
    quill = null;
  }
};

window.generateList = function () {
  const checkGpictEl = document.getElementById("checkGpict");
  const checkAdminEl = document.getElementById("checkAdmin");
  const statusFilterEl = document.getElementById("statusFilter");

  const includeGpict = checkGpictEl ? checkGpictEl.checked : true;
  const includeAdmin = checkAdminEl ? checkAdminEl.checked : true;
  const filterStatus = statusFilterEl ? statusFilterEl.value : "all";
  const uniqueEmails = new Set();

  if (!quill) {
    window.initEmailEditor();
  }

  if (!window.globalDashboardData || window.globalDashboardData.length === 0) {
    if (typeof window.fetchDashboardData === "function") {
      window
        .fetchDashboardData()
        .then(() => {
          window.generateList();
        })
        .catch(() => {});
    }
    return;
  }

  const ppdCodes =
    APP_CONFIG && APP_CONFIG.PPD_MAPPING
      ? Object.keys(APP_CONFIG.PPD_MAPPING)
      : ["M010", "M020", "M030"];

  window.globalDashboardData.forEach((row) => {
    if (!row || row.jenis === "PPD" || ppdCodes.includes(row.kod_sekolah)) {
      return;
    }

    if (includeGpict && row.emel_delima_gpict) {
      const hasId = Boolean(row.telegram_id_gpict);
      if (
        filterStatus === "all" ||
        (filterStatus === "unregistered" && !hasId) ||
        (filterStatus === "registered" && hasId)
      ) {
        const emel = String(row.emel_delima_gpict).trim();
        if (emel) {
          uniqueEmails.add(emel);
        }
      }
    }

    if (includeAdmin && row.emel_delima_admin_delima) {
      const hasId = Boolean(row.telegram_id_admin);
      if (
        filterStatus === "all" ||
        (filterStatus === "unregistered" && !hasId) ||
        (filterStatus === "registered" && hasId)
      ) {
        const emel = String(row.emel_delima_admin_delima).trim();
        if (emel) {
          uniqueEmails.add(emel);
        }
      }
    }
  });

  const arr = Array.from(uniqueEmails);
  const countEl = document.getElementById("countEmail");
  const outputEl = document.getElementById("emailOutput");

  if (countEl) {
    countEl.textContent = String(arr.length);
  }
  if (outputEl) {
    outputEl.value = arr.join(", ");
  }
};

window.kemaskiniKiraanEmel = function () {
  const outputEl = document.getElementById("emailOutput");
  const countEl = document.getElementById("countEmail");
  if (!outputEl || !countEl) {
    return;
  }

  const emailStr = outputEl.value.trim();
  if (!emailStr) {
    countEl.textContent = "0";
    return;
  }

  const emailArray = emailStr
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  countEl.textContent = String(emailArray.length);
};

window.copyEmails = function () {
  const outputEl = document.getElementById("emailOutput");
  if (!outputEl || !outputEl.value.trim()) {
    showAlert({
      icon: "info",
      title: "Senarai Kosong",
      text: "Tiada emel untuk disalin.",
      timer: 1500,
      showConfirmButton: false
    });
    return;
  }

  outputEl.select();
  outputEl.setSelectionRange(0, 99999);

  const notifyCopied = () => {
    showAlert({
      icon: "success",
      title: "Disalin!",
      text: "Senarai emel telah disalin ke papan keratan.",
      timer: 1200,
      showConfirmButton: false,
      confirmButtonColor: "#22c55e"
    });
  };

  const fallbackCopy = () => {
    try {
      document.execCommand("copy");
      notifyCopied();
    } catch {}
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(outputEl.value).then(notifyCopied).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
};

function buildConfirmBlastContent(recipientCount, chunkCount) {
  const wrapper = document.createElement("div");
  wrapper.className = "text-sm text-slate-600";

  wrapper.appendChild(document.createTextNode("Anda akan menghantar emel ini kepada "));
  const boldRecipients = document.createElement("strong");
  boldRecipients.textContent = String(recipientCount);
  wrapper.appendChild(boldRecipients);

  wrapper.appendChild(document.createTextNode(" penerima melalui "));
  const boldChunks = document.createElement("strong");
  boldChunks.textContent = String(chunkCount);
  wrapper.appendChild(boldChunks);
  wrapper.appendChild(document.createTextNode(" peringkat kelompok penghantaran."));

  const subNote = document.createElement("p");
  subNote.className = "text-xs text-slate-500 mt-3";
  subNote.textContent = "Adakah anda pasti untuk meneruskan?";
  wrapper.appendChild(subNote);

  return wrapper;
}

function buildProgressModalContent(step, total, chunkLength) {
  const wrapper = document.createElement("div");
  wrapper.className = "text-sm text-slate-600";

  wrapper.appendChild(document.createTextNode("Memproses kelompok "));
  const boldStep = document.createElement("strong");
  boldStep.textContent = String(step);
  wrapper.appendChild(boldStep);

  wrapper.appendChild(document.createTextNode(" daripada "));
  const boldTotal = document.createElement("strong");
  boldTotal.textContent = String(total);
  wrapper.appendChild(boldTotal);

  if (typeof chunkLength === "number") {
    wrapper.appendChild(document.createTextNode(` (${chunkLength} penerima)...`));
  } else {
    wrapper.appendChild(document.createTextNode("..."));
  }

  const subNote = document.createElement("p");
  subNote.className = "text-xs text-slate-400 mt-2";
  subNote.textContent = "Sila kekalkan tetingkap ini dibuka.";
  wrapper.appendChild(subNote);

  return wrapper;
}

window.hantarEmelSistem = async function () {
  if (emailBlastBusy) {
    return;
  }

  if (!quill) {
    window.initEmailEditor();
    if (!quill) {
      showAlert({
        icon: "warning",
        title: "Editor Belum Sedia",
        text: "Sila pastikan editor telah dimuatkan sepenuhnya sebelum menghantar."
      });
      return;
    }
  }

  const outputEl = document.getElementById("emailOutput");
  const subjectEl = document.getElementById("msgSubject");
  const senderEl = document.getElementById("msgSenderName");

  const emailList = outputEl ? outputEl.value.trim() : "";
  const subject = subjectEl ? subjectEl.value.trim() : "";
  const senderName = senderEl ? senderEl.value.trim() : "Admin NaDIM";
  const htmlBody = quill.root.innerHTML;
  const textContent = quill.getText().trim();

  if (!emailList) {
    return showAlert({
      icon: "warning",
      title: "Senarai Penerima Kosong",
      text: "Sila jana atau masukkan sekurang-kurangnya satu alamat emel penerima.",
      confirmButtonColor: "#f59e0b"
    });
  }

  if (!subject || !textContent) {
    return showAlert({
      icon: "warning",
      title: "Maklumat Tidak Lengkap",
      text: "Sila lengkapkan tajuk perkara (subject) dan kandungan mesej emel.",
      confirmButtonColor: "#f59e0b"
    });
  }

  const bccArray = emailList
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (bccArray.length === 0) {
    return showAlert({
      icon: "warning",
      title: "Format Tidak Sah",
      text: "Pastikan format alamat emel dipisahkan dengan tanda koma (,).",
      confirmButtonColor: "#f59e0b"
    });
  }

  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < bccArray.length; i += CHUNK_SIZE) {
    chunks.push(bccArray.slice(i, i + CHUNK_SIZE));
  }

  const confirmResult = await showAlert({
    title: "Sahkan Penghantaran Pukal",
    html: buildConfirmBlastContent(bccArray.length, chunks.length),
    text: `Hantar emel ini kepada ${bccArray.length} penerima dalam ${chunks.length} kelompok?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#16a34a",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Ya, Teruskan Hantar",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" }
  });

  if (!confirmResult || !confirmResult.isConfirmed) {
    return;
  }

  await envReady;
  const gasEmailUrl = resolveGasEmailUrl();
  if (!gasEmailUrl) {
    return showAlert({
      icon: "error",
      title: "Konfigurasi Tiada",
      text: "Titik akhir Google Apps Script bagi penghantaran emel belum dikonfigurasikan."
    });
  }

  emailBlastBusy = true;
  const btnSend = document.getElementById("btnSendSystemEmail");
  if (btnSend) {
    btnSend.disabled = true;
    btnSend.classList.add("opacity-60", "cursor-not-allowed");
  }

  let successCount = 0;
  let failCount = 0;

  if (window.Swal && typeof window.Swal.fire === "function") {
    window.Swal.fire({
      title: "Sedang Menghantar...",
      html: buildProgressModalContent(1, chunks.length),
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        window.Swal.showLoading();
      }
    });
  }

  try {
    for (let i = 0; i < chunks.length; i += 1) {
      const currentChunk = chunks[i];

      if (window.Swal && typeof window.Swal.update === "function") {
        window.Swal.update({
          html: buildProgressModalContent(i + 1, chunks.length, currentChunk.length)
        });
      }

      const payload = {
        bcc: currentChunk.join(","),
        subject,
        htmlBody,
        name: senderName || "Admin NaDIM"
      };

      try {
        const response = await fetch(gasEmailUrl, {
          method: "POST",
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain"
          },
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let resData = null;
        try {
          resData = rawText ? JSON.parse(rawText) : null;
        } catch {
          resData = null;
        }

        if (response.ok && resData && resData.status === "success") {
          successCount += currentChunk.length;
        } else {
          failCount += currentChunk.length;
        }
      } catch {
        failCount += currentChunk.length;
      }
    }
  } finally {
    emailBlastBusy = false;
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.classList.remove("opacity-60", "cursor-not-allowed");
    }
  }

  if (failCount === 0) {
    showAlert({
      icon: "success",
      title: "Penghantaran Berjaya",
      text: `Kesemua ${successCount} emel telah berjaya dihantar ke peti masuk penerima.`,
      confirmButtonColor: "#16a34a",
      customClass: { popup: "rounded-3xl" }
    });
  } else {
    showAlert({
      icon: "warning",
      title: "Penghantaran Selesai Sebahagian",
      text: `Berjaya: ${successCount} emel | Gagal: ${failCount} emel. Had kuota emel harian Google atau gangguan sambungan mungkin berlaku bagi kelompok terjejas.`,
      confirmButtonColor: "#f59e0b",
      customClass: { popup: "rounded-3xl" }
    });
  }
};

function renderHelpdeskLoading(wrapper) {
  clearElement(wrapper);
  const box = document.createElement("div");
  box.className = "text-center py-10 text-slate-400 font-medium animate-pulse";

  const icon = document.createElement("i");
  icon.className = "fas fa-circle-notch fa-spin text-2xl mr-2 text-red-500";

  box.appendChild(icon);
  box.appendChild(document.createTextNode("Memuatkan rekod tiket aduan..."));
  wrapper.appendChild(box);
}

function renderHelpdeskEmpty(wrapper, isError, message) {
  clearElement(wrapper);
  const box = document.createElement("div");
  box.className = isError
    ? "text-center text-red-500 font-bold py-10 bg-red-50 rounded-2xl border border-red-100"
    : "text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-medium";

  if (isError) {
    const icon = document.createElement("i");
    icon.className = "fas fa-exclamation-triangle mr-2";
    box.appendChild(icon);
  }
  box.appendChild(document.createTextNode(message));
  wrapper.appendChild(box);
}

function buildTicketCard(ticket) {
  const dateStr = ticket.created_at
    ? new Date(ticket.created_at).toLocaleString("ms-MY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "-";

  let schoolName = ticket.kod_sekolah || "-";
  if (Array.isArray(window.globalDashboardData)) {
    const schoolMatch = window.globalDashboardData.find(
      (s) => s.kod_sekolah === ticket.kod_sekolah
    );
    if (schoolMatch && schoolMatch.nama_sekolah) {
      schoolName = schoolMatch.nama_sekolah;
    }
  }

  let roleIconClass = "fas fa-user";
  let roleColor = "bg-slate-100 text-slate-600 border-slate-200";
  if (ticket.peranan_pengirim === "GPICT") {
    roleIconClass = "fas fa-laptop-code";
    roleColor = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (ticket.peranan_pengirim === "ADMIN") {
    roleIconClass = "fas fa-user-shield";
    roleColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  const isSelesai = ticket.status === "SELESAI";
  const borderClass = isSelesai
    ? "border-l-4 border-l-emerald-500"
    : "border-l-4 border-l-amber-500 ring-1 ring-slate-200 hover:ring-slate-300";

  const card = document.createElement("div");
  card.className = `bg-white rounded-2xl shadow-sm overflow-hidden ${borderClass} mb-5 transition-all duration-300`;

  const headerDiv = document.createElement("div");
  headerDiv.className =
    "p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4";

  const metaCol = document.createElement("div");
  metaCol.className = "flex flex-col w-full md:w-auto min-w-0";

  const schoolRow = document.createElement("div");
  schoolRow.className = "flex items-center gap-3 mb-2 min-w-0";

  const kodBadge = document.createElement("span");
  kodBadge.className =
    "bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold tracking-widest shadow-sm shrink-0";
  kodBadge.textContent = ticket.kod_sekolah || "-";

  const schoolSpan = document.createElement("span");
  schoolSpan.className = "text-sm font-bold text-slate-800 wrap-safe break-words leading-snug";
  schoolSpan.textContent = schoolName;

  schoolRow.appendChild(kodBadge);
  schoolRow.appendChild(schoolSpan);

  const subRow = document.createElement("div");
  subRow.className = "flex flex-wrap items-center gap-3";

  const roleSpan = document.createElement("span");
  roleSpan.className = `${roleColor} text-[9px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-widest inline-flex items-center gap-1.5 border shadow-sm`;
  const roleIcon = document.createElement("i");
  roleIcon.className = roleIconClass;
  roleSpan.appendChild(roleIcon);
  roleSpan.appendChild(document.createTextNode(ticket.peranan_pengirim || "PENGGUNA"));

  const dateSpan = document.createElement("span");
  dateSpan.className = "text-[10px] text-slate-400 font-bold inline-flex items-center gap-1.5";
  const calIcon = document.createElement("i");
  calIcon.className = "far fa-calendar-alt";
  dateSpan.appendChild(calIcon);
  dateSpan.appendChild(document.createTextNode(dateStr));

  subRow.appendChild(roleSpan);
  subRow.appendChild(dateSpan);

  metaCol.appendChild(schoolRow);
  metaCol.appendChild(subRow);

  const statusWrap = document.createElement("div");
  statusWrap.className = "shrink-0 self-start md:self-auto mt-2 md:mt-0";

  const statusBadge = document.createElement("span");
  const statusIcon = document.createElement("i");
  if (isSelesai) {
    statusBadge.className =
      "inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-200 shadow-sm";
    statusIcon.className = "fas fa-check";
    statusBadge.appendChild(statusIcon);
    statusBadge.appendChild(document.createTextNode("SELESAI"));
  } else {
    statusBadge.className =
      "inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border border-amber-200 shadow-sm animate-pulse";
    statusIcon.className = "fas fa-clock";
    statusBadge.appendChild(statusIcon);
    statusBadge.appendChild(document.createTextNode("DALAM PROSES"));
  }
  statusWrap.appendChild(statusBadge);

  headerDiv.appendChild(metaCol);
  headerDiv.appendChild(statusWrap);
  card.appendChild(headerDiv);

  const bodyDiv = document.createElement("div");
  bodyDiv.className = "p-6";

  const titleEl = document.createElement("h4");
  titleEl.className =
    "font-black text-slate-800 text-base md:text-lg mb-4 leading-tight uppercase tracking-tight wrap-safe break-words";
  titleEl.textContent = ticket.tajuk || "TIADA TAJUK";

  const quoteBox = document.createElement("div");
  quoteBox.className =
    "bg-amber-50/40 p-4 md:p-5 rounded-2xl border border-amber-100/60 text-slate-700 text-sm leading-relaxed relative";

  const quoteIcon = document.createElement("i");
  quoteIcon.className = "fas fa-quote-left absolute top-4 left-4 text-amber-200/50 text-3xl";

  const detailText = document.createElement("div");
  detailText.className = "relative z-10 pl-8 wrap-safe whitespace-pre-wrap break-words";
  detailText.textContent = ticket.butiran_masalah || "-";

  quoteBox.appendChild(quoteIcon);
  quoteBox.appendChild(detailText);

  bodyDiv.appendChild(titleEl);
  bodyDiv.appendChild(quoteBox);
  card.appendChild(bodyDiv);

  if (!isSelesai) {
    const actionArea = document.createElement("div");
    actionArea.className = "bg-slate-50 p-5 border-t border-slate-100";

    const replyLabel = document.createElement("label");
    replyLabel.className =
      "block text-xs font-bold text-slate-600 uppercase tracking-widest mb-3";
    replyLabel.setAttribute("for", `reply-${ticket.id}`);
    const replyIcon = document.createElement("i");
    replyIcon.className = "fas fa-reply text-indigo-400 mr-2";
    replyLabel.appendChild(replyIcon);
    replyLabel.appendChild(document.createTextNode("Tindakan Maklum Balas"));

    const textarea = document.createElement("textarea");
    textarea.id = `reply-${ticket.id}`;
    textarea.className =
      "w-full p-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none mb-3 transition-shadow placeholder-slate-400 wrap-safe";
    textarea.rows = 2;
    textarea.placeholder = "Taip cadangan penyelesaian kepada pihak sekolah di sini...";

    const btnGroup = document.createElement("div");
    btnGroup.className = "flex flex-wrap justify-end gap-3";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className =
      "min-h-[44px] px-4 py-2 rounded-xl border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 text-xs font-bold transition inline-flex items-center gap-2";
    const delIcon = document.createElement("i");
    delIcon.className = "fas fa-trash-alt";
    delBtn.appendChild(delIcon);
    delBtn.appendChild(document.createTextNode("Padam"));
    delBtn.addEventListener("click", () => {
      window.padamTiket(ticket.id);
    });

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className =
      "min-h-[44px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/30 inline-flex items-center gap-2";
    const submitIcon = document.createElement("i");
    submitIcon.className = "fas fa-paper-plane";
    submitBtn.appendChild(submitIcon);
    submitBtn.appendChild(document.createTextNode("Hantar & Tutup Tiket"));
    submitBtn.addEventListener("click", () => {
      window.submitBalasanAdmin(ticket.id);
    });

    btnGroup.appendChild(delBtn);
    btnGroup.appendChild(submitBtn);

    actionArea.appendChild(replyLabel);
    actionArea.appendChild(textarea);
    actionArea.appendChild(btnGroup);
    card.appendChild(actionArea);
  } else {
    const resolvedArea = document.createElement("div");
    resolvedArea.className =
      "bg-emerald-50/50 p-5 border-t border-emerald-100 flex flex-col sm:flex-row justify-between items-start gap-4";

    const infoCol = document.createElement("div");
    infoCol.className = "flex-1 min-w-0";

    const headerNote = document.createElement("div");
    headerNote.className =
      "text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5";
    const checkIcon = document.createElement("i");
    checkIcon.className = "fas fa-check-double text-emerald-500";
    headerNote.appendChild(checkIcon);
    headerNote.appendChild(document.createTextNode("Respon Dihantar:"));

    const replyBody = document.createElement("p");
    replyBody.className =
      "text-sm text-slate-700 font-medium leading-relaxed bg-white/70 p-3 rounded-lg border border-emerald-100/50 wrap-safe whitespace-pre-wrap break-words";
    replyBody.textContent = ticket.balasan_admin || "Tiada catatan balasan.";

    infoCol.appendChild(headerNote);
    infoCol.appendChild(replyBody);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className =
      "min-w-[44px] min-h-[44px] shrink-0 p-2.5 rounded-xl border-2 border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 transition mt-1 sm:mt-0 inline-flex items-center justify-center";
    delBtn.title = "Padam Tiket";
    const delIcon = document.createElement("i");
    delIcon.className = "fas fa-trash-alt";
    delBtn.appendChild(delIcon);
    delBtn.addEventListener("click", () => {
      window.padamTiket(ticket.id);
    });

    resolvedArea.appendChild(infoCol);
    resolvedArea.appendChild(delBtn);
    card.appendChild(resolvedArea);
  }

  return card;
}

window.loadTiketAdmin = async function () {
  const wrapper = document.getElementById("adminTiketWrapper");
  if (!wrapper) {
    return;
  }

  renderHelpdeskLoading(wrapper);

  const filterEl = document.getElementById("filterTiketAdmin");
  const filterValue = filterEl ? filterEl.value : "ALL";

  try {
    await envReady;
    await initDatabaseClient();
    const data = await SupportService.getAll(filterValue);

    if (!Array.isArray(data) || data.length === 0) {
      renderHelpdeskEmpty(wrapper, false, "Tiada tiket aduan dalam kategori tapisan ini.");
      return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach((ticket) => {
      fragment.appendChild(buildTicketCard(ticket));
    });

    clearElement(wrapper);
    wrapper.appendChild(fragment);
  } catch {
    renderHelpdeskEmpty(
      wrapper,
      true,
      "Ralat memuatkan tiket aduan dari pangkalan data."
    );
  }
};

window.submitBalasanAdmin = async function (id) {
  const replyInput = document.getElementById(`reply-${id}`);
  const replyText = replyInput ? replyInput.value.trim() : "";

  if (!replyText) {
    return showAlert({
      icon: "warning",
      title: "Maklum Balas Kosong",
      text: "Sila masukkan tindakan atau cadangan penyelesaian sebelum menutup tiket.",
      confirmButtonColor: "#f59e0b"
    });
  }

  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await SupportService.update(id, {
      status: "SELESAI",
      balasan_admin: replyText,
      tarikh_balas: new Date().toISOString()
    });

    toggleLoading(false);
    await showAlert({
      icon: "success",
      title: "Tiket Selesai",
      text: "Tiket aduan telah ditutup dan notifikasi telah dihantar.",
      timer: 1800,
      showConfirmButton: false,
      confirmButtonColor: "#22c55e"
    });
    await window.loadTiketAdmin();
  } catch {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: "Gagal mengemas kini maklum balas tiket ke pangkalan data."
    });
  }
};

window.padamTiket = async function (id) {
  const result = await showAlert({
    title: "Padam Tiket Ini?",
    text: "Tindakan ini tidak boleh dikembalikan.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Ya, Padam",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" }
  });

  if (!result || !result.isConfirmed) {
    return;
  }

  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await SupportService.delete(id);
    toggleLoading(false);
    await showAlert({
      icon: "success",
      title: "Dipadam",
      timer: 1000,
      showConfirmButton: false
    });
    await window.loadTiketAdmin();
  } catch {
    toggleLoading(false);
    showAlert({
      icon: "error",
      title: "Ralat Pangkalan Data",
      text: "Gagal memadam tiket."
    });
  }
};