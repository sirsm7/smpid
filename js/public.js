import { envReady } from "./config/config.js";
import { APP_CONFIG } from "./config/app.config.js";
import { initDatabaseClient } from "./core/db.js";
import { SchoolService } from "./services/school.service.js";
import { AchievementService } from "./services/achievement.service.js";
import { ImpactService } from "./services/impact.service.js";
import { toggleLoading, formatSentenceCase, uploadFileToDrive } from "./core/helpers.js";
import { populateDropdown, DROPDOWN_DATA } from "./config/dropdowns.js";

let globalSchoolList = [];
let currentPpdCode = null;
let isImpakClosed = false;
let isSubmitting = false;

function clearElement(el) {
  if (!el) {
    return;
  }
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function createIcon(iconClass) {
  const icon = document.createElement("i");
  icon.className = iconClass;
  return icon;
}

function sanitizeExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return null;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === "#") {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
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
  if (message) {
    window.alert(message);
  }
  return Promise.resolve({ isConfirmed: true });
}

function enableForm() {
  const formSection = document.getElementById("formSection");
  if (formSection) {
    formSection.classList.remove("disabled-form");
    formSection.classList.add("enabled-form");
  }
}

function disableForm() {
  const formSection = document.getElementById("formSection");
  if (formSection) {
    formSection.classList.remove("enabled-form");
    formSection.classList.add("disabled-form");
  }
}

function resetFormState() {
  const finalInput = document.getElementById("finalKodSekolah");
  if (finalInput) {
    finalInput.value = "";
  }
  disableForm();
  const btnGallery = document.getElementById("btnViewGallery");
  if (btnGallery) {
    btnGallery.classList.add("hidden");
  }
}

function updateImpakUmurDropdown(school) {
  const selectUmur = document.getElementById("impakUmur");
  if (!selectUmur || !DROPDOWN_DATA || !DROPDOWN_DATA.UMUR_MURID) {
    return;
  }

  const jenisSekolah = String(school.jenis_sekolah || "").toUpperCase();
  const umurData = DROPDOWN_DATA.UMUR_MURID;

  const isSekolahMenengah = ["SMK", "SBP", "SM SABK", "KV"].some((keyword) =>
    jenisSekolah.includes(keyword)
  );
  const isSekolahRendah = ["SK", "SJKC", "SJKT", "SR SABK"].some((keyword) =>
    jenisSekolah.includes(keyword)
  );

  clearElement(selectUmur);

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.disabled = true;
  defaultOpt.selected = true;
  defaultOpt.textContent = "- SILA PILIH -";
  selectUmur.appendChild(defaultOpt);

  const fragment = document.createDocumentFragment();

  umurData.forEach((item) => {
    const val = item.val || "";
    let shouldAdd = false;

    if (isSekolahMenengah) {
      if (val.includes("TINGKATAN")) {
        shouldAdd = true;
      }
    } else if (isSekolahRendah) {
      if (val.includes("TAHUN")) {
        shouldAdd = true;
      }
    } else {
      shouldAdd = true;
    }

    if (shouldAdd) {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = item.txt;
      fragment.appendChild(opt);
    }
  });

  selectUmur.appendChild(fragment);
}

function updateImpakUI() {
  const formImpak = document.getElementById("formImpak");
  const impakClosedMsg = document.getElementById("impakClosedMsg");

  if (isImpakClosed) {
    if (formImpak) {
      formImpak.classList.add("hidden");
    }
    if (impakClosedMsg) {
      impakClosedMsg.classList.remove("hidden");
    }
  } else {
    if (formImpak) {
      formImpak.classList.remove("hidden");
    }
    if (impakClosedMsg) {
      impakClosedMsg.classList.add("hidden");
    }
  }
}

async function checkImpakStatus(kodSekolah) {
  try {
    const result = await ImpactService.checkSchoolQuota(kodSekolah);
    isImpakClosed = result && result.isClosed === true;

    const catEl = document.getElementById("pubKategori");
    if (catEl && catEl.value === "IMPAK") {
      updateImpakUI();
    }
  } catch {
    isImpakClosed = false;
  }
}

function setupManualSearch() {
  const input = document.getElementById("inputCariSekolah");
  const finalInput = document.getElementById("finalKodSekolah");
  const btnGallery = document.getElementById("btnViewGallery");

  if (!input) {
    return;
  }

  input.disabled = false;
  input.addEventListener("change", async (e) => {
    const val = e.target.value || "";
    const parts = val.split(" - ");

    if (parts.length >= 2) {
      const kodPotensi = parts[0].trim().toUpperCase();
      const school = globalSchoolList.find(
        (s) => s.kod_sekolah && s.kod_sekolah.toUpperCase() === kodPotensi
      );

      if (school) {
        if (finalInput) {
          finalInput.value = school.kod_sekolah;
        }

        await checkImpakStatus(school.kod_sekolah);
        updateImpakUmurDropdown(school);

        enableForm();
        if (btnGallery) {
          btnGallery.classList.remove("hidden");
          btnGallery.href = `gallery.html?kod=${encodeURIComponent(school.kod_sekolah)}`;
        }
      } else {
        resetFormState();
      }
    } else {
      resetFormState();
    }
  });
}

async function validateAndLockSchool(kod) {
  const safeKod = String(kod || "")
    .trim()
    .toUpperCase();
  const school = globalSchoolList.find(
    (s) => s.kod_sekolah && s.kod_sekolah.toUpperCase() === safeKod
  );

  const input = document.getElementById("inputCariSekolah");
  const statusMsg = document.getElementById("schoolStatusMsg");
  const finalInput = document.getElementById("finalKodSekolah");
  const btnGallery = document.getElementById("btnViewGallery");

  if (school) {
    if (input) {
      input.value = `${school.kod_sekolah} - ${school.nama_sekolah || ""}`;
      input.classList.add("bg-green-50", "border-green-500", "text-green-700");
      input.disabled = true;
    }

    if (finalInput) {
      finalInput.value = school.kod_sekolah;
    }

    await checkImpakStatus(school.kod_sekolah);
    updateImpakUmurDropdown(school);

    if (statusMsg) {
      statusMsg.classList.remove("hidden", "text-red-500");
      statusMsg.classList.add("text-green-600");
      clearElement(statusMsg);
      statusMsg.appendChild(createIcon("fas fa-check-circle me-1"));
      statusMsg.appendChild(document.createTextNode(" Sekolah disahkan."));
    }

    enableForm();

    if (btnGallery) {
      btnGallery.classList.remove("hidden");
      btnGallery.href = `gallery.html?kod=${encodeURIComponent(school.kod_sekolah)}`;
    }
  } else {
    if (input) {
      input.value = safeKod;
    }
    if (statusMsg) {
      statusMsg.classList.remove("hidden", "text-green-600");
      statusMsg.classList.add("text-red-500");
      clearElement(statusMsg);
      statusMsg.appendChild(createIcon("fas fa-times-circle me-1"));
      statusMsg.appendChild(document.createTextNode(" Kod sekolah tidak ditemui."));
    }
    if (btnGallery) {
      btnGallery.classList.add("hidden");
    }
    setupManualSearch();
  }
}

function renderImpakCheckboxes() {
  const container = document.getElementById("impakQ11Container");
  if (!container || !DROPDOWN_DATA || !DROPDOWN_DATA.KOMPONEN_BBM) {
    return;
  }

  const komponen = DROPDOWN_DATA.KOMPONEN_BBM;
  clearElement(container);
  const fragment = document.createDocumentFragment();

  komponen.forEach((k) => {
    const isLain = k.val === "Lain-lain";

    const label = document.createElement("label");
    label.className =
      "min-h-[44px] flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition shadow-sm group";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "impakQ11";
    checkbox.value = k.val;
    checkbox.className = "accent-indigo-600 w-4 h-4";

    if (isLain) {
      checkbox.addEventListener("change", (e) => {
        window.toggleQ11Lain(e.target.checked);
      });
    }

    const span = document.createElement("span");
    span.className = "text-xs font-bold text-slate-700 group-hover:text-indigo-800";
    span.textContent = k.txt;

    label.appendChild(checkbox);
    label.appendChild(span);
    fragment.appendChild(label);
  });

  container.appendChild(fragment);
}

window.toggleQ11Lain = function (isChecked) {
  const inputLain = document.getElementById("impakQ11Lain");
  if (inputLain) {
    if (isChecked) {
      inputLain.classList.remove("hidden");
      inputLain.focus();
    } else {
      inputLain.classList.add("hidden");
      inputLain.value = "";
    }
  }
};

window.toggleQ14Subjek = function () {
  const containerSubjek = document.getElementById("containerSubjekSTEM");
  const radMain = document.querySelector('input[name="impakQ14Main"]:checked');
  const selSubjek = document.getElementById("impakQ14Sub");

  if (!containerSubjek) {
    return;
  }

  if (radMain && radMain.value === "SUBJEK STEM") {
    containerSubjek.classList.remove("hidden");
    if (selSubjek) {
      selSubjek.required = true;
    }
  } else {
    containerSubjek.classList.add("hidden");
    if (selSubjek) {
      selSubjek.required = false;
      selSubjek.value = "";
    }
  }
};

window.togglePubJenis = function () {
  const radSijil = document.getElementById("radPubSijil");
  const isSijil = radSijil ? radSijil.checked : false;

  const catEl = document.getElementById("pubKategori");
  const type = catEl ? catEl.value : "MURID";

  const divPenyedia = document.getElementById("divPubPenyedia");
  const colPeringkat = document.getElementById("divPubColPeringkat");
  const lblProgram = document.getElementById("lblPubProgram");
  const inpProgram = document.getElementById("pubProgram");
  const lblPencapaian = document.getElementById("lblPubPencapaian");
  const inpPencapaian = document.getElementById("pubPencapaian");

  const wrapperSijil = document.getElementById("wrapperPubSijil");
  const dropdownSijil = document.getElementById("pubSijilDropdown");
  const dropdownPenyedia = document.getElementById("pubPenyedia");
  const rekodInput = document.getElementById("pubJenisRekod");

  if (rekodInput) {
    rekodInput.value = isSijil ? "PENSIJILAN" : "PERTANDINGAN";
  }

  if (isSijil && type === "GURU") {
    if (divPenyedia) {
      divPenyedia.classList.remove("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.add("hidden");
    }
    if (lblProgram) {
      lblProgram.textContent = "NAMA SIJIL / PROGRAM";
    }

    if (wrapperSijil) {
      wrapperSijil.classList.remove("hidden");
    }
    if (dropdownSijil) {
      dropdownSijil.value = "";
    }
    if (dropdownPenyedia) {
      dropdownPenyedia.disabled = false;
      dropdownPenyedia.value = "LAIN-LAIN";
    }
    if (inpProgram) {
      inpProgram.placeholder = "NYATAKAN NAMA SIJIL (JIKA LAIN-LAIN)";
      inpProgram.classList.add("hidden");
      inpProgram.required = false;
    }

    if (lblPencapaian) {
      lblPencapaian.textContent = "TAHAP / SKOR / BAND";
    }
    if (inpPencapaian) {
      inpPencapaian.placeholder = "CONTOH: LULUS / BAND C2";
    }
  } else {
    if (divPenyedia) {
      divPenyedia.classList.add("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.remove("hidden");
    }
    if (lblProgram) {
      lblProgram.textContent = "NAMA PERTANDINGAN";
    }

    if (wrapperSijil) {
      wrapperSijil.classList.add("hidden");
    }
    if (dropdownPenyedia) {
      dropdownPenyedia.disabled = false;
    }
    if (inpProgram) {
      inpProgram.placeholder = "CONTOH: DIGITAL COMPETENCY 2025";
      inpProgram.classList.remove("hidden");
      inpProgram.required = true;
      inpProgram.value = "";
    }

    if (lblPencapaian) {
      lblPencapaian.textContent = "KEPUTUSAN / PENCAPAIAN";
    }
    if (inpPencapaian) {
      inpPencapaian.placeholder = "CONTOH: JOHAN / EMAS / PENYERTAAN";
    }
  }
};

window.handleSijilChange = function () {
  const dropdownSijil = document.getElementById("pubSijilDropdown");
  const manualInput = document.getElementById("pubProgram");
  const dropdownPenyedia = document.getElementById("pubPenyedia");

  if (!dropdownSijil || !manualInput || !dropdownPenyedia) {
    return;
  }

  const selectedVal = dropdownSijil.value;

  const penyediaMap = {
    "GOOGLE CERTIFIED EDUCATOR LEVEL 1": "GOOGLE",
    "GOOGLE CERTIFIED EDUCATOR LEVEL 2": "GOOGLE",
    "GEMINI CERTIFIED EDUCATOR": "GOOGLE",
    "GEMINI CERTIFIED STUDENT": "GOOGLE",
    "GEMINI CERTIFIED FACULTY": "GOOGLE",
    "GOOGLE CERTIFIED TRAINER": "GOOGLE",
    "GOOGLE CERTIFIED INNOVATOR": "GOOGLE",
    "GOOGLE CERTIFIED COACH": "GOOGLE",
    "APPLE TEACHER": "APPLE",
    "APPLE LEARNING COACH": "APPLE",
    "APPLE TEACHER SWIFT PLAYGROUNDS": "APPLE",
    "APPLE TEACHER PORTFOLIO": "APPLE",
    "APPLE PROFESSIONAL LEARNING SPECIALIST": "APPLE",
    "APPLE DISTINGUISHED EDUCATOR": "APPLE",
    "MICROSOFT INNOVATIVE EDUCATOR": "MICROSOFT",
    "MICROSOFT INNOVATIVE EDUCATOR EXPERT": "MICROSOFT",
    "MICROSOFT CERTIFIED EDUCATOR": "MICROSOFT"
  };

  if (selectedVal === "LAIN-LAIN") {
    manualInput.classList.remove("hidden");
    manualInput.value = "";
    manualInput.required = true;
    manualInput.focus();

    dropdownPenyedia.disabled = false;
    dropdownPenyedia.value = "LAIN-LAIN";
  } else if (selectedVal) {
    manualInput.classList.add("hidden");
    manualInput.value = selectedVal;
    manualInput.required = false;

    if (penyediaMap[selectedVal]) {
      dropdownPenyedia.value = penyediaMap[selectedVal];
      dropdownPenyedia.disabled = true;
    }
  }
};

window.setPublicType = function (type) {
  const catEl = document.getElementById("pubKategori");
  if (catEl) {
    catEl.value = type;
  }

  if (type === "IMPAK") {
    showAlert({
      title: "Perhatian!",
      html: "Borang ini <b>KHUSUS UNTUK DIISI OLEH MURID</b> sahaja.<br><br>Masa yang dicadangkan untuk mengisi adalah <b>selepas sesi PdPc (Pengajaran dan Pemudahcaraan)</b> selesai.",
      icon: "info",
      confirmButtonText: "Baik, Saya Faham",
      confirmButtonColor: "#4f46e5",
      customClass: { popup: "rounded-3xl" }
    });
  }

  const tabs = ["MURID", "GURU", "SEKOLAH", "IMPAK"];
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (!btn) {
      return;
    }

    if (t === type) {
      if (t === "IMPAK") {
        btn.className =
          "flex-1 min-h-[44px] min-w-[80px] py-2.5 rounded-xl text-[10px] md:text-xs font-black text-indigo-700 bg-indigo-100 shadow-md transition-all text-center border-indigo-300 transform scale-105";
      } else {
        btn.className =
          "flex-1 min-h-[44px] min-w-[70px] py-2.5 rounded-xl text-xs font-black text-white bg-brand-600 shadow-md transition-all text-center transform scale-105";
      }
    } else {
      if (t === "IMPAK") {
        btn.className =
          "flex-1 min-h-[44px] min-w-[80px] py-2.5 rounded-xl text-[10px] md:text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200 transition-all text-center bg-white shadow-sm";
      } else {
        btn.className =
          "flex-1 min-h-[44px] min-w-[70px] py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-all text-center";
      }
    }
  });

  const formMain = document.getElementById("formPublic");
  const formImpak = document.getElementById("formImpak");
  const impakClosedMsg = document.getElementById("impakClosedMsg");

  if (type === "IMPAK") {
    if (formMain) {
      formMain.classList.add("hidden");
    }
    updateImpakUI();
  } else {
    if (formMain) {
      formMain.classList.remove("hidden");
    }
    if (formImpak) {
      formImpak.classList.add("hidden");
    }
    if (impakClosedMsg) {
      impakClosedMsg.classList.add("hidden");
    }

    const lblNama = document.getElementById("lblPubNama");
    const inpNama = document.getElementById("pubNama");
    const wrapperJenis = document.getElementById("wrapperPubJenis");
    const divJawatan = document.getElementById("divPubJawatan");

    if (type === "GURU") {
      if (wrapperJenis) {
        wrapperJenis.classList.remove("hidden");
      }
      if (divJawatan) {
        divJawatan.classList.remove("hidden");
      }
      if (lblNama) {
        lblNama.textContent = "NAMA GURU";
      }
      if (inpNama) {
        inpNama.placeholder = "TAIP NAMA PENUH GURU...";
        inpNama.readOnly = false;
        inpNama.value = "";
      }

      const radPertandingan = document.getElementById("radPubPertandingan");
      if (radPertandingan) {
        radPertandingan.checked = true;
      }

      window.togglePubJenis();
    } else if (type === "MURID") {
      if (wrapperJenis) {
        wrapperJenis.classList.add("hidden");
      }
      if (divJawatan) {
        divJawatan.classList.add("hidden");
      }
      if (lblNama) {
        lblNama.textContent = "NAMA MURID / KUMPULAN";
      }
      if (inpNama) {
        inpNama.placeholder = "TAIP NAMA PENUH MURID...";
        inpNama.readOnly = false;
        inpNama.value = "";
      }

      const pubJenisEl = document.getElementById("pubJenisRekod");
      if (pubJenisEl) {
        pubJenisEl.value = "PERTANDINGAN";
      }
      window.togglePubJenis();
    } else if (type === "SEKOLAH") {
      if (wrapperJenis) {
        wrapperJenis.classList.add("hidden");
      }
      if (divJawatan) {
        divJawatan.classList.add("hidden");
      }
      if (lblNama) {
        lblNama.textContent = "NAMA SEKOLAH";
      }

      const searchInput = document.getElementById("inputCariSekolah");
      let schoolName = "";
      if (searchInput && searchInput.value.includes(" - ")) {
        schoolName = searchInput.value.split(" - ")[1] || "";
      } else if (searchInput) {
        schoolName = searchInput.value || "";
      }

      if (inpNama) {
        inpNama.value = schoolName.trim();
        inpNama.readOnly = true;
      }
      const pubJenisEl = document.getElementById("pubJenisRekod");
      if (pubJenisEl) {
        pubJenisEl.value = "PERTANDINGAN";
      }
      window.togglePubJenis();
    }
  }
};

window.resetBorang = function (fullReset = true) {
  const form = document.getElementById("formPublic");
  const formImpak = document.getElementById("formImpak");

  if (form) {
    const fieldsToClear = ["pubProgram", "pubPencapaian", "pubFile", "pubSijilDropdown"];
    fieldsToClear.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
      }
    });

    const pubPenyedia = document.getElementById("pubPenyedia");
    if (pubPenyedia) {
      pubPenyedia.disabled = false;
    }

    const pubProgram = document.getElementById("pubProgram");
    const jenisRekodEl = document.getElementById("pubJenisRekod");
    if (pubProgram && jenisRekodEl && jenisRekodEl.value === "PENSIJILAN") {
      pubProgram.classList.add("hidden");
    }

    const catEl = document.getElementById("pubKategori");
    const cat = catEl ? catEl.value : "";
    if (cat !== "SEKOLAH" && cat !== "IMPAK") {
      const pubNama = document.getElementById("pubNama");
      if (pubNama) {
        pubNama.value = "";
      }
    }
  }

  if (formImpak) {
    if (typeof formImpak.reset === "function") {
      formImpak.reset();
    }
    window.toggleQ11Lain(false);
    window.toggleQ14Subjek();
  }

  if (fullReset) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

window.hantarBorangAwam = async function () {
  if (isSubmitting) {
    return;
  }

  const kodEl = document.getElementById("finalKodSekolah");
  const kod = kodEl ? kodEl.value : "";
  const btn = document.querySelector('#formPublic button[type="submit"]');

  if (!kod) {
    await showAlert({
      icon: "warning",
      title: "Ralat Pengesahan",
      text: "Sila pilih dan sahkan sekolah anda terlebih dahulu.",
      confirmButtonColor: "#fbbf24"
    });
    return;
  }

  const catEl = document.getElementById("pubKategori");
  const kategori = catEl ? catEl.value : "";
  const jenisEl = document.getElementById("pubJenisRekod");
  const jenisRekod = jenisEl ? jenisEl.value : "";

  const namaEl = document.getElementById("pubNama");
  const nama = namaEl ? namaEl.value.trim().toUpperCase() : "";

  const programEl = document.getElementById("pubProgram");
  const program = programEl ? programEl.value.trim().toUpperCase() : "";

  const pencapaianEl = document.getElementById("pubPencapaian");
  const pencapaian = pencapaianEl ? pencapaianEl.value.trim().toUpperCase() : "";

  const fileInput = document.getElementById("pubFile");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  const tahunEl = document.getElementById("pubTahun");
  const tahun = tahunEl ? tahunEl.value : "";

  let peringkat = "KEBANGSAAN";
  let penyedia = "LAIN-LAIN";
  let jawatan = null;

  if (kategori === "GURU") {
    const jawatanEl = document.getElementById("pubJawatan");
    jawatan = jawatanEl ? jawatanEl.value : "";
    if (!jawatan) {
      await showAlert({
        icon: "warning",
        title: "Jawatan Diperlukan",
        text: "Sila pilih jawatan guru."
      });
      return;
    }
  }

  if (jenisRekod === "PENSIJILAN") {
    peringkat = "ANTARABANGSA";
    const penyediaEl = document.getElementById("pubPenyedia");
    penyedia = penyediaEl ? penyediaEl.value : "LAIN-LAIN";
  } else {
    const peringkatEl = document.getElementById("pubPeringkat");
    peringkat = peringkatEl ? peringkatEl.value : "KEBANGSAAN";
  }

  if (!nama || !program || !pencapaian || !file || !tahun) {
    await showAlert({
      icon: "warning",
      title: "Data Tidak Lengkap",
      text: "Sila pastikan semua ruangan bertanda (termasuk fail) telah diisi.",
      confirmButtonColor: "#fbbf24"
    });
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    await showAlert({
      icon: "warning",
      title: "Fail Terlalu Besar",
      text: "Maksimum saiz fail adalah 5MB. Sila mampatkan fail anda.",
      confirmButtonColor: "#fbbf24"
    });
    return;
  }

  isSubmitting = true;
  if (btn) {
    btn.disabled = true;
    clearElement(btn);
    btn.appendChild(createIcon("fas fa-circle-notch fa-spin me-2"));
    btn.appendChild(document.createTextNode("MEMUAT NAIK FAIL BUKTI..."));
    btn.classList.add("opacity-75", "cursor-not-allowed");
  }

  try {
    await envReady;
    await initDatabaseClient();

    const uploadedUrl = await uploadFileToDrive(file);
    const safeUrl = sanitizeExternalUrl(uploadedUrl);

    if (btn) {
      clearElement(btn);
      btn.appendChild(createIcon("fas fa-circle-notch fa-spin me-2"));
      btn.appendChild(document.createTextNode("MENYIMPAN REKOD PANGKALAN DATA..."));
    }

    const payload = {
      kod_sekolah: kod,
      kategori,
      nama_peserta: nama,
      nama_pertandingan: program,
      peringkat,
      tahun: parseInt(tahun, 10),
      pencapaian,
      pautan_bukti: safeUrl,
      jenis_rekod: jenisRekod,
      penyedia,
      jawatan
    };

    await AchievementService.create(payload);

    await showAlert({
      icon: "success",
      title: "Berjaya Disimpan!",
      text: "Rekod pencapaian dan bukti telah berjaya direkodkan.",
      confirmButtonText: "Terima Kasih",
      confirmButtonColor: "#16a34a"
    });
    window.resetBorang(false);
  } catch (err) {
    await showAlert({
      icon: "error",
      title: "Gagal Menghantar",
      text: err && err.message ? err.message : "Sistem mengalami gangguan. Sila cuba sebentar lagi.",
      confirmButtonColor: "#ef4444"
    });
  } finally {
    isSubmitting = false;
    if (btn) {
      btn.disabled = false;
      clearElement(btn);
      btn.appendChild(createIcon("fas fa-paper-plane me-2"));
      btn.appendChild(document.createTextNode("HANTAR MAKLUMAT"));
      btn.classList.remove("opacity-75", "cursor-not-allowed");
    }
  }
};

window.hantarImpakBBM = async function () {
  if (isSubmitting) {
    return;
  }

  const kodEl = document.getElementById("finalKodSekolah");
  const kod = kodEl ? kodEl.value : "";
  const btn = document.getElementById("btnSubmitImpak");

  if (!kod) {
    await showAlert({
      icon: "warning",
      title: "Ralat Pengesahan",
      text: "Sila pilih dan sahkan sekolah anda di atas terlebih dahulu."
    });
    return;
  }

  const q11Checkboxes = document.querySelectorAll('input[name="impakQ11"]:checked');
  let q11Values = Array.from(q11Checkboxes).map((cb) => cb.value);

  if (q11Values.includes("Lain-lain")) {
    const inputLain = document.getElementById("impakQ11Lain");
    const lainVal = inputLain ? inputLain.value.trim() : "";
    if (lainVal) {
      q11Values = q11Values.filter((val) => val !== "Lain-lain");
      q11Values.push(lainVal);
    }
  }

  if (q11Values.length === 0) {
    await showAlert({
      icon: "warning",
      title: "Data Tidak Lengkap",
      text: "Sila pilih sekurang-kurangnya SATU komponen BBM pada soalan Q11."
    });
    return;
  }

  const q12Radio = document.querySelector('input[name="impakQ12"]:checked');
  const q12Val = q12Radio ? q12Radio.value : null;

  const q13Checkboxes = document.querySelectorAll('input[name="impakQ13"]:checked');
  const q13Values = Array.from(q13Checkboxes).map((cb) => cb.value);

  const q14MainRadio = document.querySelector('input[name="impakQ14Main"]:checked');
  if (!q14MainRadio) {
    await showAlert({
      icon: "warning",
      title: "Data Tidak Lengkap",
      text: "Sila pilih Mata Pelajaran pada soalan Q14."
    });
    return;
  }

  let subjekAkhir = q14MainRadio.value;
  if (subjekAkhir === "SUBJEK STEM") {
    const selSubjek = document.getElementById("impakQ14Sub");
    const valSubjek = selSubjek ? selSubjek.value : "";
    if (!valSubjek) {
      await showAlert({
        icon: "warning",
        title: "Data Tidak Lengkap",
        text: "Anda telah memilih SUBJEK STEM. Sila nyatakan subjek tersebut secara spesifik pada ruangan yang disediakan."
      });
      return;
    }
    subjekAkhir = valSubjek;
  }

  isSubmitting = true;
  if (btn) {
    btn.disabled = true;
    clearElement(btn);
    btn.appendChild(createIcon("fas fa-circle-notch fa-spin me-2"));
    btn.appendChild(document.createTextNode("MEREKOD MAKLUM BALAS..."));
  }

  try {
    await envReady;
    await initDatabaseClient();

    const getRadioVal = (name) => {
      const r = document.querySelector(`input[name="${name}"]:checked`);
      return r ? r.value : null;
    };

    const impakJantina = document.getElementById("impakJantina");
    const impakUmur = document.getElementById("impakUmur");

    const payload = {
      kod_sekolah: kod,
      jantina: impakJantina ? impakJantina.value : "",
      kumpulan_umur: impakUmur ? impakUmur.value : "",
      q1_kefahaman: getRadioVal("impakQ1"),
      q2_penguasaan: getRadioVal("impakQ2"),
      q3_ingatan: getRadioVal("impakQ3"),
      q4_minat: getRadioVal("impakQ4"),
      q5_idea: getRadioVal("impakQ5"),
      q6_keyakinan: getRadioVal("impakQ6"),
      q7_persediaan_ujian: getRadioVal("impakQ7"),
      q8_keseluruhan: getRadioVal("impakQ8"),
      q9_penglibatan: getRadioVal("impakQ9"),
      q10_penerangan_guru: getRadioVal("impakQ10"),
      q11_komponen_bbm: q11Values,
      q12_perkara_dipelajari: q12Val,
      q13_cadangan: q13Values.length > 0 ? q13Values : null,
      q14_pengesahan_sesi: subjekAkhir
    };

    const result = await ImpactService.submitImpact(payload);

    if (result && result.status === "success") {
      await showAlert({
        icon: "success",
        title: "Terima Kasih!",
        text: "Maklum balas anda telah direkodkan. Penghargaan atas penyertaan anda.",
        confirmButtonColor: "#4f46e5"
      });
      const formImpak = document.getElementById("formImpak");
      if (formImpak && typeof formImpak.reset === "function") {
        formImpak.reset();
      }
      window.toggleQ11Lain(false);
      window.toggleQ14Subjek();
      await checkImpakStatus(kod);
    }
  } catch (err) {
    await showAlert({
      icon: "error",
      title: "Penolakan Sistem",
      text: err && err.message ? err.message : "Ralat teknikal. Gagal menghantar rekod.",
      confirmButtonColor: "#ef4444"
    });
    if (err && err.message && String(err.message).includes("sasaran")) {
      await checkImpakStatus(kod);
    }
  } finally {
    isSubmitting = false;
    if (btn) {
      btn.disabled = false;
      clearElement(btn);
      btn.appendChild(createIcon("fas fa-paper-plane me-2"));
      btn.appendChild(document.createTextNode("HANTAR MAKLUM BALAS"));
    }
  }
};

window.toggleKategoriPPD = function () {
  const radUnit = document.getElementById("radPpdUnit");
  const isUnit = radUnit ? radUnit.checked : false;
  const lbl = document.getElementById("lblPpdNama");
  const inp = document.getElementById("ppdNama");
  const hiddenCat = document.getElementById("ppdKategori");

  if (isUnit) {
    if (lbl) {
      lbl.textContent = "NAMA UNIT / SEKTOR";
    }
    if (inp) {
      inp.placeholder = "CONTOH: SEKTOR PEMBELAJARAN";
    }
    if (hiddenCat) {
      hiddenCat.value = "PPD";
    }
  } else {
    if (lbl) {
      lbl.textContent = "NAMA PEGAWAI";
    }
    if (inp) {
      inp.placeholder = "TAIP NAMA PENUH PEGAWAI...";
    }
    if (hiddenCat) {
      hiddenCat.value = "PEGAWAI";
    }
  }
};

window.toggleJenisPencapaianPPD = function () {
  const radSijil = document.getElementById("radPpdSijil");
  const isPensijilan = radSijil ? radSijil.checked : false;
  const divPenyedia = document.getElementById("divPpdPenyedia");
  const colPeringkat = document.getElementById("divPpdColPeringkat");

  const lblProg = document.getElementById("lblPpdProgram");
  const inpProg = document.getElementById("ppdProgram");
  const lblPenc = document.getElementById("lblPpdPencapaian");
  const inpPenc = document.getElementById("ppdPencapaian");
  const jenisRekodEl = document.getElementById("ppdJenisRekod");

  if (jenisRekodEl) {
    jenisRekodEl.value = isPensijilan ? "PENSIJILAN" : "PERTANDINGAN";
  }

  if (isPensijilan) {
    if (divPenyedia) {
      divPenyedia.classList.remove("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.add("hidden");
    }

    if (lblProg) {
      lblProg.textContent = "NAMA SIJIL / PROGRAM";
    }
    if (inpProg) {
      inpProg.placeholder = "CONTOH: GOOGLE CERTIFIED EDUCATOR L1";
    }
    if (lblPenc) {
      lblPenc.textContent = "TAHAP / SKOR / BAND";
    }
    if (inpPenc) {
      inpPenc.placeholder = "CONTOH: LULUS / BAND C2";
    }
  } else {
    if (divPenyedia) {
      divPenyedia.classList.add("hidden");
    }
    if (colPeringkat) {
      colPeringkat.classList.remove("hidden");
    }

    if (lblProg) {
      lblProg.textContent = "NAMA PERTANDINGAN";
    }
    if (inpProg) {
      inpProg.placeholder = "CONTOH: DIGITAL LEADERSHIP 2026";
    }
    if (lblPenc) {
      lblPenc.textContent = "PENCAPAIAN";
    }
    if (inpPenc) {
      inpPenc.placeholder = "CONTOH: JOHAN / EMAS / PENYERTAAN";
    }
  }
};

window.setupPPDMode = function (kodPPD) {
  const cardSekolah = document.getElementById("cardIdentitiSekolah");
  const formSekolah = document.getElementById("formSection");
  if (cardSekolah) {
    cardSekolah.classList.add("hidden");
  }
  if (formSekolah) {
    formSekolah.classList.add("hidden");
  }

  const cardPPD = document.getElementById("cardIdentitiPPD");
  const formPPD = document.getElementById("formSectionPPD");
  if (cardPPD) {
    cardPPD.classList.remove("hidden");
  }
  if (formPPD) {
    formPPD.classList.remove("hidden");
  }

  const ppdNameSubtitle = document.getElementById("ppdNameSubtitle");
  if (ppdNameSubtitle) {
    const namaPpd =
      APP_CONFIG.PPD_MAPPING && APP_CONFIG.PPD_MAPPING[kodPPD]
        ? APP_CONFIG.PPD_MAPPING[kodPPD]
        : "PEJABAT PENDIDIKAN DAERAH";
    ppdNameSubtitle.textContent = `Unit Sumber Teknologi Pendidikan (${kodPPD}) - ${namaPpd}`;
  }

  window.toggleKategoriPPD();
  window.toggleJenisPencapaianPPD();
};

window.resetBorangPPD = function () {
  const form = document.getElementById("formPPD");
  if (form) {
    const fields = ["ppdNama", "ppdProgram", "ppdPencapaian", "ppdFile"];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
      }
    });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.hantarBorangPPD = async function () {
  if (isSubmitting) {
    return;
  }

  const btn = document.querySelector('#formPPD button[type="submit"]');

  const catEl = document.getElementById("ppdKategori");
  const kategori = catEl ? catEl.value : "";
  const jenisEl = document.getElementById("ppdJenisRekod");
  const jenisRekod = jenisEl ? jenisEl.value : "";

  const namaEl = document.getElementById("ppdNama");
  const nama = namaEl ? namaEl.value.trim().toUpperCase() : "";

  const programEl = document.getElementById("ppdProgram");
  const program = programEl ? programEl.value.trim().toUpperCase() : "";

  const pencapaianEl = document.getElementById("ppdPencapaian");
  const pencapaian = pencapaianEl ? pencapaianEl.value.trim().toUpperCase() : "";

  const fileInput = document.getElementById("ppdFile");
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  const tahunEl = document.getElementById("ppdTahun");
  const tahun = tahunEl ? tahunEl.value : "";

  let peringkat = "KEBANGSAAN";
  let penyedia = "LAIN-LAIN";

  if (jenisRekod === "PENSIJILAN") {
    peringkat = "ANTARABANGSA";
    const penyediaEl = document.getElementById("ppdPenyedia");
    penyedia = penyediaEl ? penyediaEl.value : "LAIN-LAIN";
  } else {
    const peringkatEl = document.getElementById("ppdPeringkat");
    peringkat = peringkatEl ? peringkatEl.value : "KEBANGSAAN";
  }

  if (!nama || !program || !pencapaian || !file || !tahun) {
    await showAlert({
      icon: "warning",
      title: "Tidak Lengkap",
      text: "Sila isi semua maklumat bagi rekod PPD dan muat naik fail bukti.",
      confirmButtonColor: "#7e22ce"
    });
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    await showAlert({
      icon: "warning",
      title: "Fail Terlalu Besar",
      text: "Maksimum saiz fail adalah 5MB.",
      confirmButtonColor: "#7e22ce"
    });
    return;
  }

  isSubmitting = true;
  if (btn) {
    btn.disabled = true;
    clearElement(btn);
    btn.appendChild(createIcon("fas fa-circle-notch fa-spin me-2"));
    btn.appendChild(document.createTextNode("MEMUAT NAIK FAIL..."));
    btn.classList.add("opacity-75", "cursor-not-allowed");
  }

  try {
    await envReady;
    await initDatabaseClient();

    const uploadedUrl = await uploadFileToDrive(file);
    const safeUrl = sanitizeExternalUrl(uploadedUrl);

    if (btn) {
      clearElement(btn);
      btn.appendChild(createIcon("fas fa-circle-notch fa-spin me-2"));
      btn.appendChild(document.createTextNode("MENYIMPAN REKOD..."));
    }

    const payload = {
      kod_sekolah: currentPpdCode || "M030",
      kategori,
      nama_peserta: nama,
      nama_pertandingan: program,
      peringkat,
      tahun: parseInt(tahun, 10),
      pencapaian,
      pautan_bukti: safeUrl,
      jenis_rekod: jenisRekod,
      penyedia
    };

    await AchievementService.create(payload);

    await showAlert({
      icon: "success",
      title: "Rekod PPD Disimpan",
      text: "Data pegawai/unit beserta fail bukti telah berjaya direkodkan.",
      confirmButtonText: "OK",
      confirmButtonColor: "#7e22ce"
    });
    window.resetBorangPPD();
  } catch (err) {
    await showAlert({
      icon: "error",
      title: "Ralat Sistem",
      text: err && err.message ? err.message : "Gagal menghantar data PPD."
    });
  } finally {
    isSubmitting = false;
    if (btn) {
      btn.disabled = false;
      clearElement(btn);
      btn.appendChild(createIcon("fas fa-save me-2"));
      btn.appendChild(document.createTextNode("SIMPAN REKOD PPD"));
      btn.classList.remove("opacity-75", "cursor-not-allowed");
    }
  }
};

async function initPublicPortal() {
  toggleLoading(true);

  try {
    await envReady;
    await initDatabaseClient();

    const schools = await SchoolService.getAll();
    globalSchoolList = Array.isArray(schools) ? schools : [];

    const datalist = document.getElementById("listSekolah");
    if (datalist) {
      clearElement(datalist);
      const fragment = document.createDocumentFragment();
      globalSchoolList.forEach((s) => {
        if (!s || !s.kod_sekolah) {
          return;
        }
        const opt = document.createElement("option");
        opt.value = `${s.kod_sekolah} - ${s.nama_sekolah || ""}`;
        fragment.appendChild(opt);
      });
      datalist.appendChild(fragment);
    }

    const currentYear = String(new Date().getFullYear());
    populateDropdown("pubJawatan", "JAWATAN", "GURU AKADEMIK BIASA");
    populateDropdown("pubPeringkat", "PERINGKAT", "KEBANGSAAN");
    populateDropdown("pubPenyedia", "PENYEDIA", "LAIN-LAIN");
    populateDropdown("pubTahun", "TAHUN", currentYear);

    populateDropdown("ppdPeringkat", "PERINGKAT", "KEBANGSAAN");
    populateDropdown("ppdPenyedia", "PENYEDIA", "LAIN-LAIN");
    populateDropdown("ppdTahun", "TAHUN", currentYear);

    populateDropdown("impakUmur", "UMUR_MURID");
    renderImpakCheckboxes();

    const urlParams = new URLSearchParams(window.location.search);
    const rawKod = urlParams.get("kod");
    const kodURL = rawKod ? rawKod.trim().toUpperCase() : null;
    const senaraiKodPPD = APP_CONFIG.PPD_MAPPING
      ? Object.keys(APP_CONFIG.PPD_MAPPING)
      : ["M010", "M020", "M030"];

    if (kodURL && senaraiKodPPD.includes(kodURL)) {
      currentPpdCode = kodURL;
      window.setupPPDMode(kodURL);
    } else if (kodURL) {
      await validateAndLockSchool(kodURL);
    } else {
      setupManualSearch();
    }
  } catch {
    await showAlert({
      icon: "error",
      title: "Ralat Pemuatan",
      text: "Gagal memuatkan data sekolah. Sila cuba lagi.",
      confirmButtonColor: "#ef4444"
    });
  } finally {
    toggleLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPublicPortal();
});