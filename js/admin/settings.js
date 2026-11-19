import { envReady } from "../config/config.js";
import { APP_CONFIG } from "../config/app.config.js";
import { initDatabaseClient, getDatabaseClient } from "../core/db.js";
import { MigrationManager } from "../core/migration.js";
import { AuthService } from "../services/auth.service.js";
import { toggleLoading, keluarSistem } from "../core/helpers.js";

let csvImportBusy = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function setButtonIconAndText(button, iconClass, text) {
  if (!button) {
    return;
  }
  clearElement(button);
  if (iconClass) {
    const icon = document.createElement("i");
    icon.className = iconClass;
    button.appendChild(icon);
    button.appendChild(document.createTextNode(" "));
  }
  button.appendChild(document.createTextNode(text));
}

function showAlert(options) {
  if (typeof window !== "undefined" && window.Swal && typeof window.Swal.fire === "function") {
    return window.Swal.fire(options);
  }
  const message = options && (options.text || options.title) ? `${options.title || ""}\n${options.text || ""}`.trim() : "";
  if (options && options.showCancelButton) {
    const confirmed = window.confirm(message);
    return Promise.resolve({ isConfirmed: confirmed, value: confirmed ? options.inputValue || "" : undefined });
  }
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function downloadCsvBlob(filename, headers) {
  const csvContent = "\uFEFF" + headers.join(",") + "\n";
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }
}

function ensurePpdDropdown(addUserForm) {
  if (!addUserForm || document.getElementById("inputNewAdminPPD")) {
    return;
  }
  const formGrid = addUserForm.querySelector(".grid");
  if (!formGrid) {
    return;
  }

  formGrid.classList.remove("md:grid-cols-4");
  formGrid.classList.add("md:grid-cols-5");

  const ppdDiv = document.createElement("div");
  const label = document.createElement("label");
  label.className = "block text-xs font-bold text-slate-500 mb-1 ml-1";
  label.setAttribute("for", "inputNewAdminPPD");
  label.textContent = "PPD / Daerah";

  const select = document.createElement("select");
  select.id = "inputNewAdminPPD";
  select.className = "w-full p-2.5 rounded-lg border-2 border-slate-300 text-sm bg-white min-h-[44px]";

  const fragment = document.createDocumentFragment();
  if (APP_CONFIG.PPD_MAPPING) {
    Object.entries(APP_CONFIG.PPD_MAPPING).forEach(([kod, nama]) => {
      const option = document.createElement("option");
      option.value = kod;
      option.textContent = `${nama} (${kod})`;
      fragment.appendChild(option);
    });
  } else {
    const fallbackOpt = document.createElement("option");
    fallbackOpt.value = "M030";
    fallbackOpt.textContent = "PPD ALOR GAJAH (M030)";
    fragment.appendChild(fallbackOpt);
  }

  select.appendChild(fragment);
  ppdDiv.appendChild(label);
  ppdDiv.appendChild(select);
  formGrid.insertBefore(ppdDiv, formGrid.lastElementChild);
}

function updateRoleDropdown(currentUserRole) {
  const select = document.getElementById("inputNewAdminRole");
  if (!select) {
    return;
  }

  clearElement(select);
  const opts = [
    { val: "ADMIN", txt: "MOD ADMIN (Pengurusan Data PPD)" },
    { val: "PPD_UNIT", txt: "UNIT PPD (Pencapaian Sahaja)" }
  ];

  if (currentUserRole === "SUPER_ADMIN") {
    opts.unshift(
      { val: "SUPER_ADMIN", txt: "SUPER ADMIN (Kuasa Mutlak)" },
      { val: "JPNMEL", txt: "JPN MELAKA (Akses Penuh Negeri)" }
    );
  }

  const fragment = document.createDocumentFragment();
  opts.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.val;
    option.textContent = opt.txt;
    fragment.appendChild(option);
  });
  select.appendChild(fragment);
}

function renderLoadingBanner(wrapper) {
  clearElement(wrapper);
  const box = document.createElement("div");
  box.className = "flex flex-col items-center py-12 text-slate-400";

  const icon = document.createElement("i");
  icon.className = "fas fa-circle-notch fa-spin fa-2x mb-3 text-indigo-500";

  const text = document.createElement("p");
  text.className = "font-bold animate-pulse text-xs uppercase tracking-widest";
  text.textContent = "Menyemak Kebenaran Akses...";

  box.appendChild(icon);
  box.appendChild(text);
  wrapper.appendChild(box);
}

function renderStatusBanner(wrapper, isError, message) {
  clearElement(wrapper);
  const box = document.createElement("div");
  box.className = isError
    ? "p-8 bg-red-50 text-red-600 rounded-2xl text-center font-bold border border-red-100"
    : "p-8 bg-amber-50 text-amber-700 rounded-2xl text-center border border-amber-100 font-bold";

  const icon = document.createElement("i");
  icon.className = "fas fa-exclamation-triangle mb-2 text-xl block";

  const text = document.createElement("div");
  text.textContent = message;

  box.appendChild(icon);
  box.appendChild(text);
  wrapper.appendChild(box);
}

function buildRoleBadgeCell(user, isSelf) {
  const td = document.createElement("td");
  td.className = "px-6 py-5 text-center";

  const badge = document.createElement("span");
  if (user.role === "SUPER_ADMIN") {
    badge.className =
      "inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-red-100 text-red-700 border border-red-200 shadow-sm";
    badge.textContent = "SUPER ADMIN";
  } else if (user.role === "JPNMEL") {
    badge.className =
      "inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 shadow-sm";
    badge.textContent = "JPN MELAKA";
  } else if (user.role === "ADMIN") {
    badge.className =
      "inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200 shadow-sm";
    badge.textContent = "MOD ADMIN";
  } else {
    badge.className =
      "inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm";
    badge.textContent = "UNIT PPD";
  }
  td.appendChild(badge);

  let ppdName = user.kod_sekolah || "-";
  if (user.kod_sekolah === "ALL" || user.role === "JPNMEL" || user.role === "SUPER_ADMIN") {
    ppdName = "SELURUH NEGERI";
  } else if (APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[user.kod_sekolah]) {
    ppdName = APP_CONFIG.PPD_MAPPING[user.kod_sekolah];
  }

  const ppdDiv = document.createElement("div");
  ppdDiv.className = "text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest";
  ppdDiv.textContent = ppdName;
  td.appendChild(ppdDiv);

  if (isSelf) {
    const selfSpan = document.createElement("span");
    selfSpan.className = "ml-1 text-[8px] font-black text-slate-400 uppercase tracking-tighter italic block";
    selfSpan.textContent = "Sesi Ini";
    td.appendChild(selfSpan);
  }

  return td;
}

function buildActionButtonsCell(user, currentUserRole, isSelf) {
  const td = document.createElement("td");
  td.className = "px-6 py-5 text-center";

  const actionGroup = document.createElement("div");
  actionGroup.className = "flex items-center justify-center gap-2";

  if (currentUserRole === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN" && !isSelf) {
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className =
      "min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white transition shadow-sm group inline-flex items-center justify-center";
    delBtn.title = "Padam Akaun";

    const delIcon = document.createElement("i");
    delIcon.className = "fas fa-trash-alt group-active:scale-90 transition";
    delBtn.appendChild(delIcon);

    delBtn.addEventListener("click", () => {
      window.padamAdmin(user.id, user.email);
    });
    actionGroup.appendChild(delBtn);
  }

  let canForceReset = false;
  if (currentUserRole === "SUPER_ADMIN") {
    canForceReset = true;
  } else if (
    (currentUserRole === "ADMIN" || currentUserRole === "JPNMEL") &&
    user.role !== "SUPER_ADMIN" &&
    user.role !== "JPNMEL"
  ) {
    canForceReset = true;
  }

  if (canForceReset && !isSelf) {
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className =
      "min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white transition shadow-sm group inline-flex items-center justify-center";
    resetBtn.title = "Force Reset Password";

    const resetIcon = document.createElement("i");
    resetIcon.className = "fas fa-unlock-alt group-active:scale-90 transition";
    resetBtn.appendChild(resetIcon);

    resetBtn.addEventListener("click", () => {
      window.resetUserPass(user.id, user.email, user.role);
    });
    actionGroup.appendChild(resetBtn);
  }

  if (isSelf) {
    const selfBtn = document.createElement("button");
    selfBtn.type = "button";
    selfBtn.className =
      "min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black shadow-lg shadow-amber-500/30 transition transform active:scale-95 inline-flex items-center justify-center gap-1";
    selfBtn.title = "Tukar Kata Laluan";
    setButtonIconAndText(selfBtn, "fas fa-key", "TUKAR PASS");

    selfBtn.addEventListener("click", () => {
      window.ubahKataLaluanSendiri();
    });
    actionGroup.appendChild(selfBtn);
  }

  if (!actionGroup.hasChildNodes()) {
    const emptySpan = document.createElement("span");
    emptySpan.className = "text-[10px] text-slate-300 font-bold italic uppercase tracking-widest";
    emptySpan.textContent = "Tiada Kebenaran";
    actionGroup.appendChild(emptySpan);
  }

  td.appendChild(actionGroup);
  return td;
}

window.loadAdminList = async function () {
  const wrapper = document.getElementById("adminListWrapper");
  if (!wrapper) {
    return;
  }

  renderLoadingBanner(wrapper);

  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  const currentUserId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);

  const addUserForm = document.getElementById("addUserFormContainer");
  if (addUserForm) {
    if (currentUserRole === "SUPER_ADMIN") {
      addUserForm.classList.remove("hidden");
      ensurePpdDropdown(addUserForm);
    } else {
      addUserForm.classList.add("hidden");
    }
  }

  updateRoleDropdown(currentUserRole);

  try {
    await envReady;
    await initDatabaseClient();
    const data = await AuthService.getAllAdmins();

    if (!Array.isArray(data) || data.length === 0) {
      renderStatusBanner(wrapper, false, "TIADA DATA ADMIN DIJUMPAI");
      return;
    }

    const outerDiv = document.createElement("div");
    outerDiv.className = "overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white";

    const table = document.createElement("table");
    table.className = "w-full text-sm text-left border-collapse";

    const thead = document.createElement("thead");
    thead.className =
      "text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200";
    const headRow = document.createElement("tr");

    const headers = [
      { text: "#", cls: "px-6 py-4 font-black text-center w-16" },
      { text: "Emel Pengguna", cls: "px-6 py-4 font-black" },
      { text: "Peranan & Daerah", cls: "px-6 py-4 font-black text-center w-40" },
      { text: "Aksi Kawalan", cls: "px-6 py-4 font-black text-center w-48" }
    ];
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.className = h.cls;
      th.textContent = h.text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    tbody.className = "divide-y divide-slate-100";
    const rowFragment = document.createDocumentFragment();

    data.forEach((user, index) => {
      const isSelf = String(user.id) === String(currentUserId);
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50/80 transition-colors group";

      const tdIndex = document.createElement("td");
      tdIndex.className = "px-6 py-5 font-mono text-[10px] text-slate-400 font-bold text-center";
      tdIndex.textContent = String(index + 1);

      const tdEmail = document.createElement("td");
      tdEmail.className = "px-6 py-5 min-w-0";

      const emailDiv = document.createElement("div");
      emailDiv.className = "font-bold text-slate-700 text-sm break-all";
      emailDiv.textContent = user.email || "-";

      const idDiv = document.createElement("div");
      idDiv.className = "text-[9px] text-slate-400 font-mono mt-0.5 break-all";
      idDiv.textContent = user.id || "";

      tdEmail.appendChild(emailDiv);
      tdEmail.appendChild(idDiv);

      const tdRole = buildRoleBadgeCell(user, isSelf);
      const tdActions = buildActionButtonsCell(user, currentUserRole, isSelf);

      tr.appendChild(tdIndex);
      tr.appendChild(tdEmail);
      tr.appendChild(tdRole);
      tr.appendChild(tdActions);
      rowFragment.appendChild(tr);
    });

    tbody.appendChild(rowFragment);
    table.appendChild(tbody);
    outerDiv.appendChild(table);

    clearElement(wrapper);
    wrapper.appendChild(outerDiv);
  } catch {
    renderStatusBanner(wrapper, true, "Gagal Memuatkan Senarai Pengguna");
  }
};

window.tambahAdmin = async function () {
  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  if (currentUserRole !== "SUPER_ADMIN") {
    return showAlert({
      icon: "error",
      title: "Akses Dihalang",
      text: "Maaf, hanya Super Admin yang mempunyai kebenaran untuk menambah pengguna sistem baharu.",
      confirmButtonColor: "#ef4444"
    });
  }

  const emailEl = document.getElementById("inputNewAdminEmail");
  const roleEl = document.getElementById("inputNewAdminRole");
  const passEl = document.getElementById("inputNewAdminPass");
  const ppdEl = document.getElementById("inputNewAdminPPD");

  const email = emailEl ? emailEl.value.trim() : "";
  const role = roleEl ? roleEl.value : "ADMIN";
  const pass = passEl ? passEl.value.trim() : "";
  let kodSekolah = ppdEl ? ppdEl.value : "M030";

  if (role === "SUPER_ADMIN" || role === "JPNMEL") {
    kodSekolah = "ALL";
  }

  if (!email || !pass) {
    return showAlert({ icon: "warning", title: "Data Tidak Lengkap", text: "Sila isi emel dan kata laluan." });
  }
  if (pass.length < 6) {
    return showAlert({
      icon: "warning",
      title: "Format Salah",
      text: "Kata laluan mestilah sekurang-kurangnya 6 aksara."
    });
  }

  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await AuthService.createAdmin(email, pass, role, kodSekolah);
    toggleLoading(false);

    await showAlert({
      icon: "success",
      title: "Berjaya Ditambah",
      text: `Akaun ${role} telah diaktifkan secara sah.`,
      confirmButtonColor: "#1e293b"
    });

    if (emailEl) {
      emailEl.value = "";
    }
    if (passEl) {
      passEl.value = "";
    }
    await window.loadAdminList();
  } catch (e) {
    toggleLoading(false);
    let errorMsg = "Pastikan emel adalah unik dan sah.";
    if (e && e.code === "23514") {
      errorMsg = `Peranan '${role}' belum didaftarkan dalam CHECK CONSTRAINT jadual pangkalan data.`;
    }
    showAlert({ icon: "error", title: "Ralat Pangkalan Data", text: errorMsg });
  }
};

window.resetUserPass = async function (targetId, targetEmail, targetRole) {
  if (!window.Swal || typeof window.Swal.fire !== "function") {
    return;
  }

  const container = document.createElement("div");
  const wrapperBox = document.createElement("div");
  wrapperBox.className = "text-left mb-4";

  const labelP = document.createElement("p");
  labelP.className = "text-xs text-slate-500 font-bold uppercase mb-1";
  labelP.textContent = "Target Pengguna:";

  const targetBox = document.createElement("div");
  targetBox.className = "p-3 bg-slate-100 rounded-xl font-mono text-xs text-slate-700 border border-slate-200";
  targetBox.textContent = `${targetEmail} (${targetRole})`;

  const noteP = document.createElement("p");
  noteP.className = "text-xs text-red-500 font-medium mb-3 italic";
  noteP.textContent = "* Kata laluan lama akan dimansuhkan serta-merta.";

  wrapperBox.appendChild(labelP);
  wrapperBox.appendChild(targetBox);
  container.appendChild(wrapperBox);
  container.appendChild(noteP);

  const { value: newPass } = await window.Swal.fire({
    title: "Force Reset Password",
    html: container,
    input: "text",
    inputPlaceholder: "Masukkan Kata Laluan Baharu (Min 6)...",
    inputValue: APP_CONFIG.DEFAULTS.PASSWORD || "",
    showCancelButton: true,
    confirmButtonText: "SAHKAN RESET",
    confirmButtonColor: "#4f46e5",
    cancelButtonText: "BATAL",
    customClass: { popup: "rounded-3xl", input: "rounded-xl font-bold" }
  });

  if (newPass) {
    if (String(newPass).trim().length < 6) {
      return showAlert({ icon: "warning", title: "Ralat", text: "Kata laluan minima 6 aksara." });
    }

    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AuthService.forceResetUserPassword(targetId, String(newPass).trim());
      toggleLoading(false);
      await showAlert({
        icon: "success",
        title: "Password Direset",
        text: `Sila maklumkan kepada ${targetEmail} mengenai perubahan ini.`,
        confirmButtonColor: "#10b981"
      });
      await window.loadAdminList();
    } catch {
      toggleLoading(false);
      showAlert({ icon: "error", title: "Gagal", text: "Sistem tidak dapat mengemaskini maklumat." });
    }
  }
};

window.padamAdmin = async function (id, email) {
  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  if (currentUserRole !== "SUPER_ADMIN") {
    return showAlert({
      icon: "error",
      title: "Tiada Kuasa",
      text: "Hanya akaun Super Admin boleh melaksanakan arahan padam."
    });
  }

  const msgBox = document.createElement("p");
  msgBox.className = "text-sm text-slate-600";
  msgBox.appendChild(document.createTextNode("Anda akan memadam akses untuk "));
  const boldEmail = document.createElement("strong");
  boldEmail.textContent = email;
  msgBox.appendChild(boldEmail);
  msgBox.appendChild(document.createTextNode(" secara kekal. Tindakan ini tidak boleh dibatalkan."));

  const result = await showAlert({
    title: "Padam Akaun?",
    html: msgBox,
    text: `Padam akses untuk ${email} secara kekal?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    confirmButtonText: "YA, PADAM SEKARANG",
    cancelButtonText: "BATAL",
    customClass: { popup: "rounded-3xl" }
  });

  if (result && result.isConfirmed) {
    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AuthService.deleteUser(id);
      toggleLoading(false);
      await showAlert({ title: "Akaun Dipadam", icon: "success", timer: 1500, showConfirmButton: false });
      await window.loadAdminList();
    } catch {
      toggleLoading(false);
      showAlert({ icon: "error", title: "Ralat Sistem", text: "Gagal memproses arahan padam." });
    }
  }
};

window.resetPasswordSekolah = async function (kod) {
  const configuredDefault = APP_CONFIG.DEFAULTS.PASSWORD || "";
  let targetPassword = configuredDefault;

  if (!targetPassword && window.Swal && typeof window.Swal.fire === "function") {
    const { value: enteredPass } = await window.Swal.fire({
      title: `Reset Password ${kod}`,
      input: "text",
      inputLabel: "Masukkan Kata Laluan Baharu Sekolah (Min 6 aksara)",
      inputPlaceholder: "Kata laluan baharu...",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      confirmButtonText: "Ya, Reset",
      cancelButtonText: "Batal",
      customClass: { popup: "rounded-3xl" }
    });
    if (!enteredPass) {
      return;
    }
    targetPassword = String(enteredPass).trim();
  } else {
    const confirmRes = await showAlert({
      title: "Reset Password Sekolah?",
      text: `Tetapkan semula kata laluan ${kod} kepada lalai sistem?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#f59e0b",
      confirmButtonText: "Ya, Reset",
      cancelButtonText: "Batal",
      customClass: { popup: "rounded-3xl" }
    });
    if (!confirmRes || !confirmRes.isConfirmed) {
      return;
    }
  }

  if (!targetPassword || targetPassword.length < 6) {
    return showAlert({
      icon: "warning",
      title: "Kata Laluan Tidak Sah",
      text: "Kata laluan mestilah sekurang-kurangnya 6 aksara."
    });
  }

  toggleLoading(true);
  try {
    await envReady;
    await initDatabaseClient();
    await AuthService.resetSchoolPassword(kod, targetPassword);
    toggleLoading(false);
    showAlert({
      icon: "success",
      title: "Selesai",
      text: `Kata laluan ${kod} telah berjaya ditetapkan semula.`,
      confirmButtonColor: "#f59e0b"
    });
  } catch {
    toggleLoading(false);
    showAlert({ icon: "error", title: "Ralat", text: "Gagal menetapkan semula kata laluan." });
  }
};

window.ubahKataLaluanSendiri = async function () {
  const userId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);
  if (!userId) {
    return showAlert({ icon: "error", title: "Sesi Luput", text: "Sila log keluar dan log masuk semula." });
  }

  if (!window.Swal || typeof window.Swal.fire !== "function") {
    return;
  }

  const formContainer = document.createElement("div");
  formContainer.className = "space-y-3";

  const oldInput = document.createElement("input");
  oldInput.id = "swal-pass-old";
  oldInput.type = "password";
  oldInput.className = "w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500";
  oldInput.placeholder = "Kata Laluan Semasa";

  const newInput = document.createElement("input");
  newInput.id = "swal-pass-new";
  newInput.type = "password";
  newInput.className = "w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500";
  newInput.placeholder = "Kata Laluan Baharu (Min 6)";

  formContainer.appendChild(oldInput);
  formContainer.appendChild(newInput);

  const { value: formValues } = await window.Swal.fire({
    title: "Tukar Kata Laluan Anda",
    html: formContainer,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "SIMPAN PERUBAHAN",
    confirmButtonColor: "#16a34a",
    cancelButtonText: "BATAL",
    customClass: { popup: "rounded-3xl" },
    preConfirm: () => [oldInput.value, newInput.value]
  });

  if (formValues) {
    const [oldPass, newPass] = formValues;
    if (!oldPass || !newPass || newPass.length < 6) {
      return showAlert({
        icon: "warning",
        title: "Input Tidak Sah",
        text: "Sila pastikan kata laluan baharu minima 6 aksara."
      });
    }

    toggleLoading(true);
    try {
      await envReady;
      await initDatabaseClient();
      await AuthService.changePassword(userId, oldPass, newPass);
      toggleLoading(false);
      await showAlert({
        icon: "success",
        title: "Berjaya Ditukar",
        text: "Sila log masuk semula untuk mengesahkan perubahan.",
        confirmButtonColor: "#16a34a"
      });
      keluarSistem();
    } catch (err) {
      toggleLoading(false);
      showAlert({ icon: "error", title: "Gagal", text: err && err.message ? err.message : "Ralat tukar kata laluan." });
    }
  }
};

function createTerminalLogger() {
  const logContainer = document.getElementById("importLogContainer");
  const terminal = document.getElementById("importTerminalInner");
  const termWrapper = document.getElementById("importTerminal");
  const progressBar = document.getElementById("importProgressBar");
  const progressText = document.getElementById("importProgressText");

  if (logContainer) {
    logContainer.classList.remove("hidden");
  }
  clearElement(terminal);
  if (progressBar) {
    progressBar.classList.remove("bg-red-500");
    progressBar.classList.add("bg-emerald-500");
    progressBar.style.width = "0%";
  }
  if (progressText) {
    progressText.textContent = "0 / 0 Baris";
  }

  return {
    terminal,
    progressBar,
    progressText,
    log(msg, type = "info") {
      if (!terminal) {
        return;
      }
      const time = new Date().toLocaleTimeString("ms-MY");
      const line = document.createElement("div");
      if (type === "success") {
        line.className = "text-emerald-400";
      } else if (type === "error") {
        line.className = "text-red-400 font-bold";
      } else if (type === "warn") {
        line.className = "text-amber-400";
      } else {
        line.className = "text-slate-300";
      }
      line.textContent = `[${time}] ${msg}`;
      terminal.appendChild(line);
      if (termWrapper) {
        termWrapper.scrollTop = termWrapper.scrollHeight;
      }
    },
    setProgress(percent, label) {
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      if (progressText) {
        progressText.textContent = label;
      }
    },
    markFailed(label = "Gagal") {
      if (progressBar) {
        progressBar.style.width = "100%";
        progressBar.classList.remove("bg-emerald-500");
        progressBar.classList.add("bg-red-500");
      }
      if (progressText) {
        progressText.textContent = label;
      }
    }
  };
}

window.muatTurunTemplatCSV = function () {
  const headers = [
    "kod_sekolah",
    "nama_sekolah",
    "jenis_sekolah",
    "daerah",
    "parlimen",
    "no_telefon_sekolah",
    "nama_pgb",
    "no_telefon_pgb",
    "emel_delima_pgb",
    "nama_gpk",
    "no_telefon_gpk",
    "emel_delima_gpk",
    "nama_gpict",
    "no_telefon_gpict",
    "emel_delima_gpict",
    "nama_admin_delima",
    "no_telefon_admin_delima",
    "emel_delima_admin_delima"
  ];
  downloadCsvBlob("Templat_Data_Sekolah_NaDIM.csv", headers);
};

window.mulaImportCSV = async function () {
  if (csvImportBusy) {
    return;
  }

  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  if (currentUserRole !== "SUPER_ADMIN") {
    return showAlert({
      icon: "error",
      title: "Akses Dihalang",
      text: "Operasi kritikal ini dikhaskan untuk Super Admin sahaja."
    });
  }

  const fileInput = document.getElementById("csvFileInput");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (!file) {
    return showAlert({ icon: "warning", title: "Tiada Fail", text: "Sila pilih fail CSV terlebih dahulu." });
  }

  if (typeof window.Papa === "undefined") {
    return showAlert({ icon: "error", title: "Pustaka Belum Sedia", text: "Pustaka PapaParse tidak tersedia." });
  }

  csvImportBusy = true;
  const btn = document.getElementById("btnMulaImport");
  if (btn) {
    btn.disabled = true;
    setButtonIconAndText(btn, "fas fa-spinner fa-spin", "Sedang Membaca Fail...");
  }

  const logger = createTerminalLogger();
  logger.log("Mula mengekstrak dan menganalisis struktur fail CSV...", "info");

  const resetBtn = () => {
    csvImportBusy = false;
    if (btn) {
      btn.disabled = false;
      setButtonIconAndText(btn, "fas fa-play", "Mulakan Proses Import");
    }
    if (fileInput) {
      fileInput.value = "";
    }
  };

  window.Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const data = Array.isArray(results.data) ? results.data : [];
      logger.log(`Berjaya membaca ${data.length} baris data mentah.`, "success");

      if (data.length === 0) {
        logger.log("Kegagalan: Fail CSV ini kosong.", "error");
        resetBtn();
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(data[0], "kod_sekolah")) {
        logger.log('Ralat Integriti: Lajur mandatori "kod_sekolah" tidak wujud.', "error");
        showAlert({
          icon: "error",
          title: "Format Tidak Sah",
          text: "Pengepala (Header) CSV tidak sepadan dengan struktur pangkalan data."
        });
        resetBtn();
        return;
      }

      const validData = data.filter((row) => row.kod_sekolah && String(row.kod_sekolah).trim() !== "");
      const totalRows = validData.length;
      logger.log(`Menemui ${totalRows} rekod sekolah yang sah. Mula proses pangkalan data...`, "info");

      try {
        await envReady;
        const db = (await initDatabaseClient()) || getDatabaseClient();
        if (!db) {
          throw new Error("Sambungan pangkalan data tidak tersedia.");
        }

        let successCount = 0;
        let errorCount = 0;

        logger.log("Membuat pemetaan silang jadual smpid_users...", "info");
        const { data: existingUsers } = await db
          .from("smpid_users")
          .select("kod_sekolah")
          .eq("role", "SEKOLAH");
        const existingKods = new Set((existingUsers || []).map((u) => u.kod_sekolah));

        const CHUNK_SIZE = 50;
        const chunks = [];
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          chunks.push(validData.slice(i, i + CHUNK_SIZE));
        }

        const configuredPassword = APP_CONFIG.DEFAULTS.PASSWORD || "";

        for (let i = 0; i < chunks.length; i += 1) {
          const chunk = chunks[i];
          logger.log(`Memproses Transaksi Pukal ${i + 1} daripada ${chunks.length} (${chunk.length} rekod)...`, "info");

          const payloadSekolah = chunk.map((row) => ({
            kod_sekolah: String(row.kod_sekolah).trim().toUpperCase(),
            nama_sekolah: row.nama_sekolah ? String(row.nama_sekolah).trim().toUpperCase() : null,
            jenis_sekolah: row.jenis_sekolah ? String(row.jenis_sekolah).trim().toUpperCase() : null,
            daerah: row.daerah ? String(row.daerah).trim().toUpperCase() : "ALOR GAJAH",
            parlimen: row.parlimen ? String(row.parlimen).trim().toUpperCase() : null,
            no_telefon_sekolah: row.no_telefon_sekolah ? String(row.no_telefon_sekolah).trim() : null,
            nama_pgb: row.nama_pgb ? String(row.nama_pgb).trim().toUpperCase() : null,
            no_telefon_pgb: row.no_telefon_pgb ? String(row.no_telefon_pgb).trim() : null,
            emel_delima_pgb: row.emel_delima_pgb ? String(row.emel_delima_pgb).trim() : null,
            nama_gpk: row.nama_gpk ? String(row.nama_gpk).trim().toUpperCase() : null,
            no_telefon_gpk: row.no_telefon_gpk ? String(row.no_telefon_gpk).trim() : null,
            emel_delima_gpk: row.emel_delima_gpk ? String(row.emel_delima_gpk).trim() : null,
            nama_gpict: row.nama_gpict ? String(row.nama_gpict).trim().toUpperCase() : null,
            no_telefon_gpict: row.no_telefon_gpict ? String(row.no_telefon_gpict).trim() : null,
            emel_delima_gpict: row.emel_delima_gpict ? String(row.emel_delima_gpict).trim() : null,
            nama_admin_delima: row.nama_admin_delima ? String(row.nama_admin_delima).trim().toUpperCase() : null,
            no_telefon_admin_delima: row.no_telefon_admin_delima ? String(row.no_telefon_admin_delima).trim() : null,
            emel_delima_admin_delima: row.emel_delima_admin_delima
              ? String(row.emel_delima_admin_delima).trim()
              : null
          }));

          const newUsers = [];
          chunk.forEach((row) => {
            const kod = String(row.kod_sekolah).trim().toUpperCase();
            if (!existingKods.has(kod)) {
              const generatedPass = configuredPassword || `${kod}@${new Date().getFullYear()}`;
              newUsers.push({
                id: crypto.randomUUID(),
                email: `${kod.toLowerCase()}@moe.gov.my`,
                password: generatedPass,
                role: "SEKOLAH",
                kod_sekolah: kod
              });
              existingKods.add(kod);
            }
          });

          try {
            const { error: errSekolah } = await db
              .from("smpid_sekolah_data")
              .upsert(payloadSekolah, { onConflict: "kod_sekolah" });
            if (errSekolah) {
              throw errSekolah;
            }

            if (newUsers.length > 0) {
              const { error: errUsers } = await db.from("smpid_users").insert(newUsers);
              if (errUsers) {
                throw errUsers;
              }
              logger.log(`Pengaktifan akaun log masuk: ${newUsers.length} akaun direkodkan.`, "success");
            }

            successCount += chunk.length;
            logger.log(`Kumpulan ${i + 1} diselaraskan tanpa ralat.`, "success");
          } catch (err) {
            errorCount += chunk.length;
            logger.log(`Kegagalan pada Kumpulan ${i + 1}: ${err && err.message ? err.message : "Ralat"}`, "error");
          }

          const processed = Math.min((i + 1) * CHUNK_SIZE, totalRows);
          const percent = totalRows > 0 ? Math.round((processed / totalRows) * 100) : 100;
          logger.setProgress(percent, `${processed} / ${totalRows} Baris`);
        }

        logger.log(
          `OPERASI TAMAT. Berjaya: ${successCount} rekod | Gagal: ${errorCount} rekod`,
          successCount > 0 ? "success" : "error"
        );
        resetBtn();

        await showAlert({
          icon: errorCount === 0 ? "success" : "warning",
          title: "Data Disegerakkan",
          text: `Sistem telah memproses ${totalRows} baris data. Berjaya: ${successCount} rekod. Gagal: ${errorCount} rekod.`,
          confirmButtonColor: "#059669",
          customClass: { popup: "rounded-3xl" }
        });

        if (typeof window.fetchDashboardData === "function") {
          await window.fetchDashboardData();
        }
        await window.loadAdminList();
      } catch (err) {
        logger.log(`Ralat sambungan: ${err && err.message ? err.message : "Gagal memproses"}`, "error");
        logger.markFailed("Gagal");
        resetBtn();
      }
    },
    error: (err) => {
      logger.log(`Ralat pembacaan luaran: ${err && err.message ? err.message : "Format rosak"}`, "error");
      showAlert({ icon: "error", title: "Ralat Fail", text: "Format CSV tidak dapat dibaca." });
      resetBtn();
    }
  });
};

window.muatTurunTemplatAnalisaCSV = function () {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const headers = [
    "kod_sekolah",
    `dcs_${prevYear}`,
    `peratus_aktif_${prevYear}`,
    `dcs_${currentYear}`,
    `peratus_aktif_${currentYear}`
  ];
  downloadCsvBlob(`Templat_Analisa_DCS_${currentYear}.csv`, headers);
};

window.mulaImportAnalisaCSV = async function () {
  if (csvImportBusy) {
    return;
  }

  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  if (currentUserRole !== "SUPER_ADMIN") {
    return showAlert({
      icon: "error",
      title: "Akses Dihalang",
      text: "Operasi kritikal ini dikhaskan untuk Super Admin sahaja."
    });
  }

  const fileInput = document.getElementById("csvAnalisaInput");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  if (!file) {
    return showAlert({ icon: "warning", title: "Tiada Fail", text: "Sila pilih fail CSV Analisa terlebih dahulu." });
  }

  if (typeof window.Papa === "undefined") {
    return showAlert({ icon: "error", title: "Pustaka Belum Sedia", text: "Pustaka PapaParse tidak tersedia." });
  }

  csvImportBusy = true;
  const btn = document.getElementById("btnMulaImportAnalisa");
  if (btn) {
    btn.disabled = true;
    setButtonIconAndText(btn, "fas fa-spinner fa-spin", "Sedang Membaca Fail...");
  }

  const logger = createTerminalLogger();
  logger.log("Mula mengekstrak data CSV Analisa PPPDM & DCS...", "info");

  const resetBtn = () => {
    csvImportBusy = false;
    if (btn) {
      btn.disabled = false;
      setButtonIconAndText(btn, "fas fa-play", "Import Data Analisa");
    }
    if (fileInput) {
      fileInput.value = "";
    }
  };

  window.Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const data = Array.isArray(results.data) ? results.data : [];
      logger.log(`Berjaya membaca ${data.length} baris data mentah.`, "success");

      if (data.length === 0) {
        logger.log("Kegagalan: Fail CSV ini kosong.", "error");
        resetBtn();
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(data[0], "kod_sekolah")) {
        logger.log('Ralat Integriti: Lajur mandatori "kod_sekolah" tidak wujud.', "error");
        showAlert({
          icon: "error",
          title: "Format Tidak Sah",
          text: "Pengepala (Header) CSV tidak sepadan dengan struktur pangkalan data."
        });
        resetBtn();
        return;
      }

      const validData = data.filter((row) => row.kod_sekolah && String(row.kod_sekolah).trim() !== "");
      const totalRows = validData.length;
      logger.log(`Menemui ${totalRows} rekod analisis yang sah. Mula proses pangkalan data...`, "info");

      try {
        await envReady;
        const db = (await initDatabaseClient()) || getDatabaseClient();
        if (!db) {
          throw new Error("Sambungan pangkalan data tidak tersedia.");
        }

        let successCount = 0;
        let errorCount = 0;
        const existingDataMap = {};
        const metricColumns = new Set();

        const { data: dbData, error: dbError } = await db.from("smpid_dcs_analisa").select("*");
        if (dbError) {
          throw dbError;
        }

        if (Array.isArray(dbData) && dbData.length > 0) {
          dbData.forEach((row) => {
            if (row.kod_sekolah) {
              existingDataMap[String(row.kod_sekolah).toUpperCase()] = row;
            }
          });
          Object.keys(dbData[0]).forEach((k) => {
            if (k.startsWith("dcs_") || k.startsWith("peratus_aktif_")) {
              metricColumns.add(k);
            }
          });
        }

        if (validData.length > 0) {
          Object.keys(validData[0]).forEach((k) => {
            if (k.startsWith("dcs_") || k.startsWith("peratus_aktif_")) {
              metricColumns.add(k);
            }
          });
        }

        const sekolahMap = {};
        const { data: sekData } = await db
          .from("smpid_sekolah_data")
          .select("kod_sekolah, nama_sekolah, jenis_sekolah, daerah");
        if (Array.isArray(sekData)) {
          sekData.forEach((s) => {
            if (s.kod_sekolah) {
              sekolahMap[String(s.kod_sekolah).toUpperCase()] = s;
            }
          });
        }

        const allMetricKeys = Array.from(metricColumns);
        const CHUNK_SIZE = 50;
        const chunks = [];
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          chunks.push(validData.slice(i, i + CHUNK_SIZE));
        }

        for (let i = 0; i < chunks.length; i += 1) {
          const chunk = chunks[i];
          logger.log(`Memproses Transaksi Analisa ${i + 1} daripada ${chunks.length} (${chunk.length} rekod)...`, "info");

          const payloadAnalisa = chunk.map((row) => {
            const kod = String(row.kod_sekolah).trim().toUpperCase();
            const finalObj = {
              kod_sekolah: kod,
              nama_sekolah:
                (sekolahMap[kod] && sekolahMap[kod].nama_sekolah) ||
                (existingDataMap[kod] && existingDataMap[kod].nama_sekolah) ||
                "TIADA REKOD",
              jenis_sekolah:
                (sekolahMap[kod] && sekolahMap[kod].jenis_sekolah) ||
                (existingDataMap[kod] && existingDataMap[kod].jenis_sekolah) ||
                "LAIN-LAIN",
              daerah:
                (sekolahMap[kod] && sekolahMap[kod].daerah) ||
                (existingDataMap[kod] && existingDataMap[kod].daerah) ||
                "ALOR GAJAH"
            };

            allMetricKeys.forEach((k) => {
              finalObj[k] = null;
            });

            if (existingDataMap[kod]) {
              allMetricKeys.forEach((k) => {
                if (existingDataMap[kod][k] !== undefined) {
                  finalObj[k] = existingDataMap[kod][k];
                }
              });
            }

            Object.keys(row).forEach((key) => {
              if (allMetricKeys.includes(key)) {
                const valStr = String(row[key] ?? "").trim();
                if (valStr !== "") {
                  const val = parseFloat(valStr);
                  finalObj[key] = Number.isNaN(val) ? null : val;
                }
              }
            });

            return finalObj;
          });

          try {
            const { error: errAnalisa } = await db
              .from("smpid_dcs_analisa")
              .upsert(payloadAnalisa, { onConflict: "kod_sekolah" });
            if (errAnalisa) {
              throw errAnalisa;
            }

            payloadAnalisa.forEach((updatedRow) => {
              existingDataMap[updatedRow.kod_sekolah] = updatedRow;
            });

            successCount += chunk.length;
            logger.log(`Kumpulan ${i + 1} Analisa diselaraskan tanpa ralat.`, "success");
          } catch (err) {
            errorCount += chunk.length;
            logger.log(`Kegagalan pada Kumpulan ${i + 1}: ${err && err.message ? err.message : "Ralat"}`, "error");
          }

          const processed = Math.min((i + 1) * CHUNK_SIZE, totalRows);
          const percent = totalRows > 0 ? Math.round((processed / totalRows) * 100) : 100;
          logger.setProgress(percent, `${processed} / ${totalRows} Baris`);
        }

        logger.log(
          `OPERASI TAMAT. Berjaya: ${successCount} rekod | Gagal: ${errorCount} rekod`,
          successCount > 0 ? "success" : "error"
        );
        resetBtn();

        showAlert({
          icon: errorCount === 0 ? "success" : "warning",
          title: "Data Analisa Disegerakkan",
          text: `Sistem telah memproses ${totalRows} baris data analisis. Berjaya: ${successCount} rekod. Gagal: ${errorCount} rekod.`,
          confirmButtonColor: "#059669",
          customClass: { popup: "rounded-3xl" }
        });
      } catch (err) {
        logger.log(`Ralat pemprosesan: ${err && err.message ? err.message : "Gagal memproses"}`, "error");
        logger.markFailed("Gagal");
        resetBtn();
      }
    },
    error: (err) => {
      logger.log(`Ralat pembacaan luaran: ${err && err.message ? err.message : "Format rosak"}`, "error");
      showAlert({ icon: "error", title: "Ralat Fail", text: "Format CSV tidak dapat dibaca." });
      resetBtn();
    }
  });
};

window.muatTurunBackupKeseluruhan = async function () {
  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  if (currentUserRole !== "SUPER_ADMIN") {
    return showAlert({
      icon: "error",
      title: "Akses Dihalang",
      text: "Operasi kritikal ini dikhaskan untuk Super Admin sahaja."
    });
  }

  if (MigrationManager.isBusy()) {
    return showAlert({
      icon: "info",
      title: "Operasi Sedang Berjalan",
      text: "Sila tunggu sehingga proses sandaran atau pemulihan semasa selesai."
    });
  }

  const logger = createTerminalLogger();
  toggleLoading(true);

  try {
    const result = await MigrationManager.exportBackupJson({
      statusContainer: logger.terminal,
      onProgress: (entry) => {
        if (entry && typeof entry.step === "number" && typeof entry.total === "number" && entry.total > 0) {
          const pct = Math.round((entry.step / entry.total) * 100);
          logger.setProgress(pct, `${entry.step} / ${entry.total} Jadual`);
        }
      }
    });

    logger.setProgress(100, `${result.tableCount} Jadual (${result.totalRows} Rekod)`);
    toggleLoading(false);

    showAlert({
      icon: "success",
      title: "Sandaran JSON Berjaya",
      text: `Fail ${result.filename} (${result.tableCount} jadual, ${result.totalRows} rekod) telah dimuat turun.`,
      confirmButtonColor: "#059669"
    });
  } catch (error) {
    toggleLoading(false);
    logger.markFailed("Gagal");
    showAlert({
      icon: "error",
      title: "Ralat Sandaran",
      text: error && error.message ? error.message : "Gagal mengeksport data sandaran."
    });
  }
};

window.mulaRestoreKeseluruhan = async function () {
  const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
  if (currentUserRole !== "SUPER_ADMIN") {
    return showAlert({
      icon: "error",
      title: "Akses Dihalang",
      text: "Operasi kritikal ini dikhaskan untuk Super Admin sahaja."
    });
  }

  if (MigrationManager.isBusy()) {
    return showAlert({
      icon: "info",
      title: "Operasi Sedang Berjalan",
      text: "Sila tunggu sehingga proses sandaran atau pemulihan semasa selesai."
    });
  }

  const fileInput = document.getElementById("jsonBackupInput");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (!file) {
    return showAlert({ icon: "warning", title: "Tiada Fail", text: "Sila pilih fail sandaran .json terlebih dahulu." });
  }

  if (!file.name.toLowerCase().endsWith(".json")) {
    return showAlert({
      icon: "error",
      title: "Format Tidak Sah",
      text: "Hanya fail sambungan .json (application/json) diterima."
    });
  }

  const warningMsg = document.createElement("p");
  warningMsg.className = "text-sm text-slate-600";
  warningMsg.appendChild(document.createTextNode("Tindakan ini akan "));
  const boldText = document.createElement("strong");
  boldText.textContent = "MENIMPA (UPSERT)";
  warningMsg.appendChild(boldText);
  warningMsg.appendChild(
    document.createTextNode(
      " data sedia ada di pangkalan data serta menyelaraskan semula jujukan ID secara automatik. Teruskan?"
    )
  );

  const confirmResult = await showAlert({
    title: "Amaran Kritikal!",
    html: warningMsg,
    text: "Tindakan ini akan menimpa data sedia ada di pangkalan data. Teruskan?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Ya, Mulakan Restore",
    cancelButtonText: "Batal",
    customClass: { popup: "rounded-3xl" }
  });

  if (!confirmResult || !confirmResult.isConfirmed) {
    return;
  }

  const btn = document.getElementById("btnMulaRestore");
  if (btn) {
    btn.disabled = true;
    setButtonIconAndText(btn, "fas fa-spinner fa-spin", "Sedang Memulihkan...");
  }

  const logger = createTerminalLogger();
  logger.setProgress(10, "Mengesahkan Skema JSON...");

  try {
    const restoreSummary = await MigrationManager.importBackupJson(file, {
      statusContainer: logger.terminal,
      onProgress: (entry) => {
        if (entry && typeof entry.step === "number" && typeof entry.total === "number" && entry.total > 0) {
          const pct = Math.min(95, Math.max(15, Math.round((entry.step / entry.total) * 90)));
          logger.setProgress(pct, `${entry.step} / ${entry.total} Jadual`);
        }
      },
      onCompleted: async () => {
        if (typeof window.fetchDashboardData === "function") {
          await window.fetchDashboardData();
        }
        await window.loadAdminList();
      }
    });

    logger.setProgress(100, `Selesai (${restoreSummary.totalRows} Rekod)`);

    showAlert({
      icon: "success",
      title: "Pemulihan 1-ke-1 Selesai",
      text: `Sebanyak ${restoreSummary.tableCount} jadual (${restoreSummary.totalRows} rekod) telah dipulihkan dan jujukan ID diselaraskan.`,
      confirmButtonColor: "#059669",
      customClass: { popup: "rounded-3xl" }
    });
  } catch (error) {
    logger.markFailed("Gagal");
    showAlert({
      icon: "error",
      title: "Ralat Pemulihan",
      text: error && error.message ? error.message : "Gagal memulihkan data daripada fail sandaran."
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      setButtonIconAndText(btn, "fas fa-sync", "Mulakan Pemulihan Data");
    }
    if (fileInput) {
      fileInput.value = "";
    }
  }
};