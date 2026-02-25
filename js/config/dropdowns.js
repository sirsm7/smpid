/**
 * js/config/dropdowns.js
 * PUSAT DATA DROPDOWN SMPID (PPD ALOR GAJAH)
 * Fungsi: Membekalkan senarai jawatan, peringkat, penyedia, tahun, dan tajuk bengkel
 * merentas semua modul (Public, User, Admin).
 * --- UPDATE V1.4 ---
 * Penambahan: Kategori BENGKEL (Disusun mengikut abjad A-Z).
 * Integriti: Memastikan ejaan standard bagi tajuk bimbingan.
 */

// Fungsi pembantu untuk menjana senarai tahun secara dinamik
const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const startYear = 2020;
    const years = [];
    for (let y = currentYear; y >= startYear; y--) {
        years.push({ val: y.toString(), txt: y.toString() });
    }
    return years;
};

export const DROPDOWN_DATA = {
    // Senarai Jawatan Guru Standard KPM/PPDAG
    JAWATAN: [
        { val: "GURU AKADEMIK BIASA", txt: "GURU AKADEMIK BIASA" },
        { val: "PENGARAH KV / PGB", txt: "PENGETUA / GURU BESAR" },
        { val: "GPK PENTADBIRAN", txt: "GPK PENTADBIRAN" },
        { val: "GPK HAL EHWAL MURID", txt: "GPK HAL EHWAL MURID" },
        { val: "GPK KO-KURIKULUM", txt: "GPK KO-KURIKULUM" },
        { val: "GPK PENDIDIKAN KHAS", txt: "GPK PENDIDIKAN KHAS" },
        { val: "GURU KANAN MATA PELAJARAN", txt: "GURU KANAN MATA PELAJARAN" },
        { val: "GURU DATA", txt: "GURU DATA" },
        { val: "GURU PENYELARAS ICT", txt: "GURU PENYELARAS ICT" },
        { val: "GURU ADMIN DELIMA", txt: "GURU ADMIN DELIMA" },
        { val: "GURU ICT & ADMIN DELIMA", txt: "GURU ICT & ADMIN DELIMA" },
        { val: "GURU PERPUSTAKAAN & MEDIA", txt: "GURU PERPUSTAKAAN & MEDIA" },
		{ val: "ANGGOTA KUMPULAN PELAKSANA", txt: "ANGGOTA KUMPULAN PELAKSANA" }
    ],

    // Peringkat Pengiktirafan
    PERINGKAT: [
        { val: "KEBANGSAAN", txt: "KEBANGSAAN" },
        { val: "ANTARABANGSA", txt: "ANTARABANGSA" }
    ],

    // Penyedia Pensijilan Digital (Standard Industri)
    PENYEDIA: [
        { val: "LAIN-LAIN", txt: "LAIN-LAIN / TIADA" },
        { val: "GOOGLE", txt: "GOOGLE FOR EDUCATION" },
        { val: "APPLE", txt: "APPLE EDUCATION" },
        { val: "MICROSOFT", txt: "MICROSOFT EDUCATION" }
    ],

    // Senarai Tahun (Dinamik)
    TAHUN: generateYears(),

    // --- BARU: TAJUK BENGKEL / BIMBINGAN (V1.4) ---
    // Disusun mengikut urutan abjad A-Z
    BENGKEL: [
        { val: "BENGKEL / BIMBINGAN DRONE LITEBEE", txt: "BENGKEL / BIMBINGAN DRONE LITEBEE" },
        { val: "BENGKEL / BIMBINGAN REKA CETAK 3D", txt: "BENGKEL / BIMBINGAN REKA CETAK 3D" },
        { val: "BENGKEL / BIMBINGAN ROBOTIK AIROBOTIK", txt: "BENGKEL / BIMBINGAN ROBOTIK AIROBOTIK" },
        { val: "BENGKEL / BIMBINGAN ROBOTIK MIKROBOTIK", txt: "BENGKEL / BIMBINGAN ROBOTIK MIKROBOTIK" },
        { val: "BENGKEL / BIMBINGAN ROBOTIK REKAEDUKIT", txt: "BENGKEL / BIMBINGAN ROBOTIK REKAEDUKIT" },
        { val: "BENGKEL / BIMBINGAN ROBOTIK RERO:MICRO", txt: "BENGKEL / BIMBINGAN ROBOTIK RERO:MICRO" },
        { val: "BENGKEL / BIMBINGAN APLIKASI AI TOOLS", txt: "BENGKEL / BIMBINGAN APLIKASI AI TOOLS" },
		{ val: "BIMBINGAN ADMIN DELIMA (BAHARU)", txt: "BIMBINGAN ADMIN DELIMA (BAHARU)" },
        { val: "BIMBINGAN PENYELARAS ICT (BAHARU)", txt: "BIMBINGAN PENYELARAS ICT (BAHARU)" },
		{ val: "BENGKEL PENSIJILAN APPLE TEACHER", txt: "BENGKEL PENSIJILAN APPLE TEACHER" },
		{ val: "BENGKEL PENSIJILAN GEMINI / GOOGLE", txt: "BENGKEL PENSIJILAN GEMINI / GOOGLE" }
    ]
};

/**
 * Mengisi elemen <select> secara dinamik berdasarkan kategori data.
 * @param {string} elementId - ID elemen select dalam DOM.
 * @param {string} category - Kunci data (JAWATAN, PERINGKAT, PENYEDIA, TAHUN, atau BENGKEL).
 * @param {string} defaultValue - (Opsional) Nilai yang perlu dipilih secara automatik.
 */
export function populateDropdown(elementId, category, defaultValue = null) {
    const select = document.getElementById(elementId);
    if (!select) {
        console.warn(`[Dropdowns] Elemen dengan ID '${elementId}' tidak ditemui.`);
        return;
    }

    const options = DROPDOWN_DATA[category];
    if (!options) {
        console.error(`[Dropdowns] Kategori data '${category}' tidak wujud.`);
        return;
    }

    // Bersihkan kandungan select sedia ada
    select.innerHTML = '';

    // Tambah pilihan placeholder jika perlu (kecuali untuk TAHUN)
    if (!defaultValue && category !== 'TAHUN') {
        const placeholder = document.createElement('option');
        placeholder.value = "";
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.innerText = `- PILIH ${category} -`;
        select.appendChild(placeholder);
    }

    // Bina senarai option
    options.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.val;
        opt.innerText = item.txt;
        
        // Logik pemilihan automatik
        if (defaultValue && String(item.val) === String(defaultValue)) {
            opt.selected = true;
        }
        
        select.appendChild(opt);
    });

    console.log(`✅ [Dropdowns] Dropdown '${elementId}' berjaya diisi (${category}).`);
}

// Expose ke global window untuk kemudahan debug atau integrasi legacy
window.populateDropdown = populateDropdown;