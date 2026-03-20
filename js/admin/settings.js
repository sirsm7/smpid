/**
 * ADMIN MODULE: SETTINGS (STRICT RBAC & BATCH IMPORT EDITION)
 * Menguruskan pangkalan data pengguna pentadbir, kawalan akses sistem,
 * dan modul Import Data Pukal (Super Admin).
 * --- UPDATE V2.0 (BATCH IMPORT) ---
 * Logic: Menambah pemprosesan fail CSV di pihak klien menggunakan PapaParse,
 * diselaraskan dengan fungsi Supabase Upsert untuk sekolah dan pendaftaran pengguna baharu.
 */

import { AuthService } from '../services/auth.service.js';
import { toggleLoading, keluarSistem } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';
import { getDatabaseClient } from '../core/db.js'; // Disuntik untuk operasi Import Pukal

// --- 1. PENGURUSAN PENGGUNA (ADMIN LIST) ---

/**
 * Memuatkan senarai semua akaun pentadbir dengan kawalan akses yang ketat.
 */
window.loadAdminList = async function() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = `
        <div class="flex flex-col items-center py-12 text-slate-400">
            <i class="fas fa-circle-notch fa-spin fa-2x mb-3 text-indigo-500"></i>
            <p class="font-bold animate-pulse text-xs uppercase tracking-widest">Menyemak Kebenaran Akses...</p>
        </div>`;
    
    // 1. Dapatkan maklumat sesi dari localStorage
    const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const currentUserId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID);
    
    // 2. KAWALAN BORANG TAMBAH PENGGUNA (Hanya Super Admin)
    const addUserForm = document.getElementById('addUserFormContainer');
    if (addUserForm) {
        if (currentUserRole === 'SUPER_ADMIN') {
            addUserForm.classList.remove('hidden'); // Papar jika Super Admin
        } else {
            addUserForm.classList.add('hidden'); // Sembunyi jika Admin/Unit PPD
        }
    }

    // Kawalan Paparan Tab Import Data
    const importTabBtn = document.getElementById('import-data-tab');
    if (importTabBtn) {
        if (currentUserRole === 'SUPER_ADMIN') {
            importTabBtn.classList.remove('hidden');
        } else {
            importTabBtn.classList.add('hidden');
        }
    }

    // 3. Kemaskini Dropdown Pilihan Role (Hirarki Lantikan)
    updateRoleDropdown(currentUserRole);

    try {
        let data = await AuthService.getAllAdmins();
        
        if(data.length === 0) { 
            wrapper.innerHTML = `
                <div class="p-8 bg-amber-50 text-amber-700 rounded-2xl text-center border border-amber-100 font-bold">
                    <i class="fas fa-exclamation-triangle mb-2 text-xl"></i><br>
                    TIADA DATA ADMIN DIJUMPAI
                </div>`; 
            return; 
        }
        
        let html = `
        <div class="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
            <table class="w-full text-sm text-left border-collapse">
                <thead class="text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th class="px-6 py-4 font-black text-center w-16">#</th>
                        <th class="px-6 py-4 font-black">Emel Pengguna</th>
                        <th class="px-6 py-4 font-black text-center w-40">Peranan</th>
                        <th class="px-6 py-4 font-black text-center w-48">Aksi Kawalan</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">`;
            
        data.forEach((user, index) => {
            const isSelf = (user.id === currentUserId);
            
            // Badge Peranan
            let roleBadge = '';
            if (user.role === 'SUPER_ADMIN') {
                roleBadge = `<span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-red-100 text-red-700 border border-red-200 shadow-sm">SUPER ADMIN</span>`;
            } else if (user.role === 'ADMIN') {
                roleBadge = `<span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-blue-100 text-blue-700 border border-blue-200 shadow-sm">MOD ADMIN</span>`;
            } else {
                roleBadge = `<span class="inline-block px-2.5 py-1 rounded-lg text-[9px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm">UNIT PPD</span>`;
            }

            // Logik Butang Tindakan
            let actionButtons = '';

            // A. PADAM (Hanya SUPER_ADMIN boleh padam akaun lain)
            if (currentUserRole === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' && !isSelf) {
                actionButtons += `
                <button onclick="padamAdmin('${user.id}', '${user.email}')" 
                        class="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white transition shadow-sm group" 
                        title="Padam Akaun">
                    <i class="fas fa-trash-alt group-active:scale-90 transition"></i>
                </button>`;
            } 

            // B. RESET PASSWORD (Hirarki Kuasa)
            let canForceReset = false;
            if (user.role !== 'SUPER_ADMIN') {
                if (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') {
                    canForceReset = true;
                }
            }

            if (canForceReset && !isSelf) {
                actionButtons += `
                <button onclick="resetUserPass('${user.id}', '${user.email}', '${user.role}')" 
                        class="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white transition shadow-sm group" 
                        title="Force Reset Password">
                    <i class="fas fa-unlock-alt group-active:scale-90 transition"></i>
                </button>`;
            }

            // C. TUKAR PASSWORD SENDIRI
            if (isSelf) {
                actionButtons += `
                <button onclick="ubahKataLaluanSendiri()" 
                        class="px-4 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black shadow-lg shadow-amber-500/30 transition transform active:scale-95" 
                        title="Tukar Kata Laluan">
                    <i class="fas fa-key me-1"></i> TUKAR PASS
                </button>`;
                roleBadge += ` <span class="ml-1 text-[8px] font-black text-slate-300 uppercase tracking-tighter italic">Sesi Ini</span>`;
            }

            html += `
            <tr class="hover:bg-slate-50/80 transition-colors group">
                <td class="px-6 py-5 font-mono text-[10px] text-slate-400 font-bold text-center">${index + 1}</td>
                <td class="px-6 py-5">
                    <div class="font-bold text-slate-700 text-sm">${user.email}</div>
                    <div class="text-[9px] text-slate-400 font-mono mt-0.5">${user.id}</div>
                </td>
                <td class="px-6 py-5 text-center">${roleBadge}</td>
                <td class="px-6 py-5 text-center">
                    <div class="flex items-center justify-center gap-2">
                        ${actionButtons || '<span class="text-[10px] text-slate-300 font-bold italic uppercase tracking-widest">Tiada Kebenaran</span>'}
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table></div>`;
        wrapper.innerHTML = html;
    } catch (e) { 
        console.error("[Settings] Ralat Senarai Admin:", e);
        wrapper.innerHTML = `<div class="p-8 bg-red-50 text-red-600 rounded-2xl text-center font-bold border border-red-100">Gagal Memuatkan Senarai Pengguna</div>`; 
    }
};

/**
 * Menambah akaun pentadbir baharu (HAD: Hanya SUPER ADMIN).
 */
window.tambahAdmin = async function() {
    const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    
    // Sekatan Keselamatan: Hanya SUPER ADMIN dibenarkan
    if (currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire({
            icon: 'error',
            title: 'Akses Dihalang',
            text: 'Maaf, hanya Super Admin yang mempunyai kebenaran untuk menambah pengguna sistem baharu.',
            confirmButtonColor: '#ef4444'
        });
    }

    const email = document.getElementById('inputNewAdminEmail').value.trim();
    const role = document.getElementById('inputNewAdminRole').value;
    const pass = document.getElementById('inputNewAdminPass').value.trim();
    
    if(!email || !pass) return Swal.fire('Data Tidak Lengkap', 'Sila isi emel dan kata laluan.', 'warning');

    toggleLoading(true);
    try {
        await AuthService.createAdmin(email, pass, role);
        toggleLoading(false);
        Swal.fire({
            icon: 'success',
            title: 'Berjaya Ditambah',
            text: `Akaun ${role} telah diaktifkan secara sah.`,
            confirmButtonColor: '#1e293b'
        }).then(() => {
            document.getElementById('inputNewAdminEmail').value = '';
            document.getElementById('inputNewAdminPass').value = '';
            window.loadAdminList();
        });
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat Pendaftaran', 'Pastikan emel unik dan format kata laluan betul.', 'error');
    }
};

/**
 * Reset Kata Laluan Secara Paksa (Bypass Password Lama).
 */
window.resetUserPass = async function(targetId, targetEmail, targetRole) {
    const { value: newPass } = await Swal.fire({
        title: 'Force Reset Password',
        html: `
            <div class="text-left mb-4">
                <p class="text-xs text-slate-500 font-bold uppercase mb-1">Target Pengguna:</p>
                <div class="p-3 bg-slate-100 rounded-xl font-mono text-xs text-slate-700 border border-slate-200">
                    ${targetEmail} (${targetRole})
                </div>
            </div>
            <p class="text-xs text-red-500 font-medium mb-3 italic">* Kata laluan lama akan dimansuhkan serta-merta.</p>
        `,
        input: 'text',
        inputPlaceholder: 'Masukkan Kata Laluan Baharu...',
        showCancelButton: true,
        confirmButtonText: 'SAHKAN RESET',
        confirmButtonColor: '#4f46e5',
        cancelButtonText: 'BATAL',
        customClass: { popup: 'rounded-3xl', input: 'rounded-xl font-bold' }
    });

    if (newPass) {
        if (newPass.length < 6) return Swal.fire('Ralat', 'Kata laluan minima 6 aksara.', 'warning');

        toggleLoading(true);
        try {
            await AuthService.forceResetUserPassword(targetId, newPass);
            toggleLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Password Direset',
                text: `Sila maklumkan kepada ${targetEmail} mengenai perubahan ini.`,
                confirmButtonColor: '#10b981'
            });
            window.loadAdminList();
        } catch (e) {
            toggleLoading(false);
            Swal.fire('Gagal', 'Sistem tidak dapat mengemaskini maklumat.', 'error');
        }
    }
};

/**
 * Mengawal pilihan peranan mengikut hirarki penambah.
 */
function updateRoleDropdown(currentUserRole) {
    const select = document.getElementById('inputNewAdminRole');
    if (!select) return;

    select.innerHTML = '';
    const opts = [
        { val: 'ADMIN', txt: 'MOD ADMIN (Pengurusan Data)' },
        { val: 'PPD_UNIT', txt: 'UNIT PPD (Pencapaian Sahaja)' }
    ];

    // Hanya Super Admin boleh lantik Super Admin lain
    if (currentUserRole === 'SUPER_ADMIN') {
        opts.unshift({ val: 'SUPER_ADMIN', txt: 'SUPER ADMIN (Kuasa Mutlak)' });
    }

    opts.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.innerText = opt.txt;
        select.appendChild(option);
    });
}

/**
 * Memadam akaun admin secara kekal (Hanya SUPER ADMIN).
 */
window.padamAdmin = async function(id, email) {
    const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    
    if (currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire('Tiada Kuasa', 'Hanya akaun Super Admin boleh melaksanakan arahan padam.', 'error');
    }

    Swal.fire({ 
        title: 'Padam Akaun?', 
        html: `Anda akan memadam akses untuk <b>${email}</b> secara kekal. Tindakan ini tidak boleh dibatalkan.`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'YA, PADAM SEKARANG',
        cancelButtonText: 'BATAL',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.deleteUser(id);
                toggleLoading(false);
                Swal.fire({ title: 'Akaun Dipadam', icon: 'success', timer: 1500, showConfirmButton: false });
                window.loadAdminList();
            } catch (e) { 
                toggleLoading(false); 
                Swal.fire('Ralat Sistem', 'Gagal memproses arahan padam.', 'error');
            }
        }
    });
};

// --- 2. PENGURUSAN PASSWORD SEKOLAH ---

/**
 * Tetapkan semula password sekolah ke default (Admin / Super Admin).
 */
window.resetPasswordSekolah = async function(kod) {
    Swal.fire({ 
        title: 'Reset Password Sekolah?', 
        text: `Tetapkan semula kata laluan ${kod} kepada default (ppdag@12345)?`, 
        icon: 'question', 
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        confirmButtonText: 'Ya, Reset',
        customClass: { popup: 'rounded-3xl' }
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.resetSchoolPassword(kod);
                toggleLoading(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Selesai',
                    text: `Password ${kod} telah dikembalikan kepada asal.`,
                    confirmButtonColor: '#f59e0b'
                });
            } catch (e) { 
                toggleLoading(false); 
                Swal.fire('Ralat', 'Gagal menetapkan semula kata laluan.', 'error'); 
            }
        }
    });
};

// --- 3. SELF-SERVICE SECURITY ---

/**
 * Tukar Kata Laluan Sendiri (Berdasarkan password lama).
 */
window.ubahKataLaluanSendiri = async function() {
    const userId = localStorage.getItem(APP_CONFIG.SESSION.USER_ID); 
    
    if (!userId) {
        Swal.fire('Sesi Luput', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan Anda',
        html: `
            <div class="space-y-3">
                <input id="swal-pass-old" type="password" class="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Kata Laluan Semasa">
                <input id="swal-pass-new" type="password" class="w-full p-3 border border-slate-200 rounded-xl outline-none focus:border-brand-500" placeholder="Kata Laluan Baharu (Min 6)">
            </div>`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'SIMPAN PERUBAHAN',
        confirmButtonColor: '#16a34a',
        customClass: { popup: 'rounded-3xl' },
        preConfirm: () => {
            return [
                document.getElementById('swal-pass-old').value,
                document.getElementById('swal-pass-new').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;
        if (!oldPass || !newPass || newPass.length < 6) return Swal.fire('Input Tidak Sah', 'Sila pastikan kata laluan baharu minima 6 aksara.', 'warning');

        toggleLoading(true);
        try {
            await AuthService.changePassword(userId, oldPass, newPass);
            toggleLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Berjaya Ditukar',
                text: 'Sila log masuk semula untuk mengesahkan perubahan.',
                confirmButtonColor: '#16a34a'
            }).then(() => keluarSistem());
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};

// --- 4. BATCH IMPORT DATA (SUPER ADMIN) ---

/**
 * Menjana templat CSV kosong dengan format lajur yang tepat berpandukan pangkalan data.
 */
window.muatTurunTemplatCSV = function() {
    const headers = [
        "kod_sekolah", "nama_sekolah", "jenis_sekolah", "daerah", "parlimen", 
        "nama_pgb", "no_telefon_pgb", "emel_delima_pgb", 
        "nama_gpk", "no_telefon_gpk", "emel_delima_gpk", 
        "nama_gpict", "no_telefon_gpict", "emel_delima_gpict", 
        "nama_admin_delima", "no_telefon_admin_delima", "emel_delima_admin_delima"
    ];
    
    // Menambah BOM (Byte Order Mark) untuk menyokong karakter khas (UTF-8) di MS Excel
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Templat_Data_Sekolah_SMPID.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Membaca fail CSV dari input, mengesahkan struktur, dan melaksanakan operasi Upsert (Insert/Update)
 * berkelompok ke pangkalan data Supabase.
 */
window.mulaImportCSV = async function() {
    // 1. Semakan Keselamatan Tambahan
    const currentUserRole = localStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    if (currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire('Akses Dihalang', 'Operasi kritikal ini dikhaskan untuk Super Admin sahaja.', 'error');
    }

    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        return Swal.fire('Tiada Fail', 'Sila pilih fail CSV terlebih dahulu.', 'warning');
    }

    const btn = document.getElementById('btnMulaImport');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sedang Membaca Fail...';
    
    // 2. Sediakan Terminal Log UI
    const logContainer = document.getElementById('importLogContainer');
    const terminal = document.getElementById('importTerminalInner');
    const progressBar = document.getElementById('importProgressBar');
    const progressText = document.getElementById('importProgressText');
    
    logContainer.classList.remove('hidden');
    terminal.innerHTML = '';
    progressBar.style.width = '0%';
    progressText.innerText = '0 / 0 Baris';
    
    function logMsg(msg, type='info') {
        const time = new Date().toLocaleTimeString('ms-MY');
        let color = 'text-slate-300';
        if (type === 'success') color = 'text-emerald-400';
        if (type === 'error') color = 'text-red-400';
        if (type === 'warn') color = 'text-amber-400';
        
        terminal.innerHTML += `<div class="${color}">[${time}] ${msg}</div>`;
        const termContainer = document.getElementById('importTerminal');
        termContainer.scrollTop = termContainer.scrollHeight;
    }

    logMsg('Mula mengekstrak dan menganalisis struktur fail CSV...', 'info');

    // 3. Ekstrak Data Menggunakan PapaParse (Client-Side)
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            logMsg(`Berjaya membaca ${data.length} baris data mentah.`, 'success');
            
            if (data.length === 0) {
                logMsg('Kegagalan: Fail CSV ini kosong.', 'error');
                resetBtn();
                return;
            }

            if (!data[0].hasOwnProperty('kod_sekolah')) {
                logMsg('Ralat Integriti: Lajur mandatori "kod_sekolah" tidak wujud.', 'error');
                Swal.fire('Format Tidak Sah', 'Pengepala (Header) CSV tidak sepadan dengan struktur pangkalan data. Sila gunakan templat yang disediakan.', 'error');
                resetBtn();
                return;
            }

            // 4. Penapisan Baris Tidak Sah (Cth: Baris Kosong yang terlepas)
            const validData = data.filter(row => row.kod_sekolah && row.kod_sekolah.trim() !== '');
            const totalRows = validData.length;
            
            logMsg(`Menemui ${totalRows} rekod sekolah yang sah. Mula proses pangkalan data...`, 'info');
            
            const db = getDatabaseClient();
            let successCount = 0;
            let errorCount = 0;
            
            // 5. Keselamatan Pendaftaran: Semak akaun sedia ada supaya kata laluan tidak tertimpa.
            logMsg('Membuat pemetaan (mapping) silang jadual smpid_users...', 'info');
            const { data: existingUsers } = await db.from('smpid_users').select('kod_sekolah').eq('role', 'SEKOLAH');
            const existingKods = new Set(existingUsers?.map(u => u.kod_sekolah) || []);

            // 6. Pemprosesan Berkelompok (Chunking - 50 rekod per transaksi)
            const CHUNK_SIZE = 50;
            const chunks = [];
            for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
                chunks.push(validData.slice(i, i + CHUNK_SIZE));
            }

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                logMsg(`Mengeksport Transaksi Pukal ${i+1} daripada ${chunks.length} (${chunk.length} rekod)...`, 'info');
                
                // Pemetaan ke format smpid_sekolah_data
                const payloadSekolah = chunk.map(row => ({
                    kod_sekolah: row.kod_sekolah.trim().toUpperCase(),
                    nama_sekolah: row.nama_sekolah?.trim().toUpperCase() || null,
                    jenis_sekolah: row.jenis_sekolah?.trim().toUpperCase() || null,
                    daerah: row.daerah?.trim().toUpperCase() || 'ALOR GAJAH',
                    parlimen: row.parlimen?.trim().toUpperCase() || null,
                    nama_pgb: row.nama_pgb?.trim().toUpperCase() || null,
                    no_telefon_pgb: row.no_telefon_pgb?.trim() || null,
                    emel_delima_pgb: row.emel_delima_pgb?.trim() || null,
                    nama_gpk: row.nama_gpk?.trim().toUpperCase() || null,
                    no_telefon_gpk: row.no_telefon_gpk?.trim() || null,
                    emel_delima_gpk: row.emel_delima_gpk?.trim() || null,
                    nama_gpict: row.nama_gpict?.trim().toUpperCase() || null,
                    no_telefon_gpict: row.no_telefon_gpict?.trim() || null,
                    emel_delima_gpict: row.emel_delima_gpict?.trim() || null,
                    nama_admin_delima: row.nama_admin_delima?.trim().toUpperCase() || null,
                    no_telefon_admin_delima: row.no_telefon_admin_delima?.trim() || null,
                    emel_delima_admin_delima: row.emel_delima_admin_delima?.trim() || null
                }));

                // Penyediaan profil pendaftaran baharu untuk jadual smpid_users
                const newUsers = [];
                chunk.forEach(row => {
                    const kod = row.kod_sekolah.trim().toUpperCase();
                    // Jika akaun belum pernah wujud, kita daftarkannya.
                    if (!existingKods.has(kod)) {
                        newUsers.push({
                            id: crypto.randomUUID(),
                            email: `${kod.toLowerCase()}@moe.gov.my`,
                            password: APP_CONFIG.DEFAULTS.PASSWORD || 'ppdag@12345',
                            role: 'SEKOLAH',
                            kod_sekolah: kod
                        });
                        existingKods.add(kod); // Tambah ke memori tempatan untuk mengelakkan duplikasi jika ada kod sama dalam CSV
                    }
                });

                try {
                    // Operasi Upsert (Update jika wujud, Insert jika tiada) pada data sekolah
                    const { error: errSekolah } = await db.from('smpid_sekolah_data').upsert(payloadSekolah);
                    if (errSekolah) throw errSekolah;

                    // Operasi Insert pada akaun pengguna (hanya yang baharu)
                    if (newUsers.length > 0) {
                        const { error: errUsers } = await db.from('smpid_users').insert(newUsers);
                        if (errUsers) throw errUsers;
                        logMsg(`Pengaktifan akaun log masuk: ${newUsers.length} akaun direkodkan.`, 'success');
                    }

                    successCount += chunk.length;
                    logMsg(`Kumpulan ${i+1} diselaraskan tanpa ralat.`, 'success');

                } catch (err) {
                    errorCount += chunk.length;
                    logMsg(`Kegagalan kritikal pada Kumpulan ${i+1}: ${err.message}`, 'error');
                    console.error("[BatchImport Error]", err);
                }

                // Kemaskini Visual Progress Bar
                const processed = Math.min((i + 1) * CHUNK_SIZE, totalRows);
                const percent = Math.round((processed / totalRows) * 100);
                progressBar.style.width = `${percent}%`;
                progressText.innerText = `${processed} / ${totalRows} Baris`;
            }

            // 7. Pengakhiran Laporan
            logMsg(`<b>OPERASI TAMAT.</b> Berjaya: ${successCount} rekod | Gagal: ${errorCount} rekod`, successCount > 0 ? 'success' : 'error');
            resetBtn();

            Swal.fire({
                icon: errorCount === 0 ? 'success' : 'warning',
                title: 'Data Disegerakkan',
                text: `Sistem telah memproses ${totalRows} baris data.\nBerjaya: ${successCount} rekod.\nGagal: ${errorCount} rekod.`,
                confirmButtonColor: '#059669',
                customClass: { popup: 'rounded-3xl' }
            }).then(() => {
                // Muat semula jadual pemantauan utama di latar belakang jika tersedia
                if (window.fetchDashboardData) window.fetchDashboardData();
            });
        },
        error: function(err) {
            logMsg(`Ralat pembacaan luaran: ${err.message}`, 'error');
            Swal.fire('Ralat Fail', 'Format CSV tidak dapat dibaca. Pastikan tiada kerosakan pada struktur baris.', 'error');
            resetBtn();
        }
    });

    function resetBtn() {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Mulakan Proses Import';
    }
};