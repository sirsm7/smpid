/**
 * ADMIN MODULE: SETTINGS (DEV)
 * Menguruskan pengguna admin dan reset password sekolah.
 * Kemaskini: Matriks Kuasa SUPER ADMIN vs ADMIN.
 */

import { AuthService } from '../services/auth.service.js';
import { toggleLoading, keluarSistem } from '../core/helpers.js';
import { APP_CONFIG } from '../config/app.config.js';

// --- USER MANAGEMENT ---
window.loadAdminList = async function() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
    
    // Dapatkan info sesi semasa
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    const currentUserId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID);
    
    // Kemaskini Dropdown Pilihan Role untuk Tambah Admin
    updateRoleDropdown(currentUserRole);

    try {
        let data = await AuthService.getAllAdmins();
        
        // --- LOGIK PENAPISAN DATA (VIEW) ---
        // Jika ADMIN biasa, sembunyikan baris SUPER_ADMIN dari pandangan (Security by obscurity)
        // atau tunjuk tapi disable action. Di sini kita pilih untuk tunjuk tapi kawal butang.
        
        if(data.length === 0) { 
            wrapper.innerHTML = `<div class="alert alert-warning">Tiada data admin dijumpai.</div>`; 
            return; 
        }
        
        let html = `
        <table class="table table-hover table-bordered align-middle mb-0 bg-white">
            <thead class="bg-light">
                <tr>
                    <th class="small text-uppercase text-secondary" style="width: 5%;">#</th>
                    <th class="small text-uppercase text-secondary">Emel Pengguna</th>
                    <th class="small text-uppercase text-secondary text-center" style="width: 15%;">Peranan</th>
                    <th class="small text-uppercase text-secondary text-center" style="width: 25%;">Tindakan</th>
                </tr>
            </thead>
            <tbody>`;
            
        data.forEach((user, index) => {
            const isSelf = (user.id === currentUserId);
            
            // 1. Badge Peranan
            let roleBadge = '';
            if (user.role === 'SUPER_ADMIN') roleBadge = `<span class="badge bg-danger">SUPER ADMIN</span>`;
            else if (user.role === 'ADMIN') roleBadge = `<span class="badge bg-primary">ADMIN</span>`;
            else roleBadge = `<span class="badge bg-indigo" style="background-color: #4b0082;">UNIT PPD</span>`;

            // 2. Logik Butang Tindakan (MATRIX KUASA)
            let actionButtons = '';

            // --- BUTANG PADAM (DELETE) ---
            // Hanya SUPER_ADMIN boleh padam pengguna lain.
            // Tidak boleh padam diri sendiri di sini.
            // Tidak boleh padam SUPER_ADMIN lain (jika ada).
            if (currentUserRole === 'SUPER_ADMIN' && user.role !== 'SUPER_ADMIN' && !isSelf) {
                actionButtons += `
                <button onclick="padamAdmin('${user.id}', '${user.email}')" class="btn btn-sm btn-outline-danger me-1" title="Padam Akaun">
                    <i class="fas fa-trash-alt"></i>
                </button>`;
            } 
            // ADMIN biasa TIDAK BOLEH padam sesiapa berdasarkan arahan.

            // --- BUTANG RESET PASSWORD (FORCE) ---
            let canReset = false;

            if (user.role === 'SUPER_ADMIN') {
                // Hanya boleh reset diri sendiri
                if (isSelf) canReset = true;
            } else {
                // Target: ADMIN atau UNIT PPD
                // Doer: SUPER_ADMIN atau ADMIN
                if (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'ADMIN') {
                    canReset = true;
                }
            }

            if (canReset) {
                // Jika diri sendiri, panggil fungsi ubah password biasa (lama + baru)
                // Jika orang lain, panggil fungsi force reset (baru sahaja)
                const resetFunc = isSelf ? `ubahKataLaluanSendiri()` : `resetUserPass('${user.id}', '${user.email}', '${user.role}')`;
                const btnColor = isSelf ? 'btn-warning' : 'btn-outline-dark';
                const btnIcon = isSelf ? 'fa-key' : 'fa-unlock-alt';
                const btnTitle = isSelf ? 'Tukar Password Anda' : 'Reset Password Pengguna Ini';
                
                actionButtons += `
                <button onclick="${resetFunc}" class="btn btn-sm ${btnColor}" title="${btnTitle}">
                    <i class="fas ${btnIcon}"></i>
                </button>`;
            }

            // Penanda 'ANDA'
            if (isSelf) {
                roleBadge += ` <span class="badge bg-light text-dark border ms-1">ANDA</span>`;
            }

            html += `
            <tr>
                <td class="text-center text-muted small">${index + 1}</td>
                <td class="fw-bold text-dark small">${user.email}</td>
                <td class="text-center">${roleBadge}</td>
                <td class="text-center">
                    ${actionButtons || '<span class="text-muted small fst-italic">- Tiada Akses -</span>'}
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
        wrapper.innerHTML = html;
    } catch (e) { 
        console.error(e);
        wrapper.innerHTML = `<div class="alert alert-danger">Ralat memuatkan senarai admin.</div>`; 
    }
};

// Fungsi Reset Password Paksa (Untuk Admin reset user lain)
window.resetUserPass = async function(targetId, targetEmail, targetRole) {
    const { value: newPass } = await Swal.fire({
        title: 'Reset Kata Laluan',
        html: `Masukkan kata laluan baharu untuk<br><b>${targetEmail}</b> (${targetRole})`,
        input: 'text',
        inputPlaceholder: 'Kata laluan baru...',
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        confirmButtonColor: '#198754',
        cancelButtonText: 'Batal'
    });

    if (newPass) {
        if (newPass.length < 6) return Swal.fire('Ralat', 'Kata laluan terlalu pendek (Min 6).', 'warning');

        toggleLoading(true);
        try {
            await AuthService.forceResetUserPassword(targetId, newPass);
            toggleLoading(false);
            Swal.fire('Berjaya', `Kata laluan untuk ${targetEmail} telah diubah.`, 'success');
        } catch (e) {
            toggleLoading(false);
            Swal.fire('Ralat', 'Gagal menetapkan kata laluan.', 'error');
        }
    }
};

// Fungsi bantuan untuk mengemaskini dropdown "Tambah Admin Baru"
function updateRoleDropdown(currentUserRole) {
    const select = document.getElementById('inputNewAdminRole');
    if (!select) return;

    // Reset pilihan
    select.innerHTML = '';

    // Pilihan Standard
    const opts = [
        { val: 'ADMIN', txt: 'ADMIN (Akses Penuh)' },
        { val: 'PPD_UNIT', txt: 'UNIT PPD (Pencapaian Sahaja)' }
    ];

    // Jika SUPER ADMIN, tambah pilihan SUPER ADMIN (Optional: Jika mahu create Super Admin lain)
    if (currentUserRole === 'SUPER_ADMIN') {
        opts.unshift({ val: 'SUPER_ADMIN', txt: 'SUPER ADMIN (Akses Mutlak)' });
    }

    opts.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.innerText = opt.txt;
        select.appendChild(option);
    });
}

window.tambahAdmin = async function() {
    const email = document.getElementById('inputNewAdminEmail').value.trim();
    const role = document.getElementById('inputNewAdminRole').value;
    const pass = document.getElementById('inputNewAdminPass').value.trim();
    
    if(!email || !pass) return Swal.fire('Ralat', 'Sila isi emel dan kata laluan.', 'warning');
    
    // Semakan Keselamatan: Hanya SUPER_ADMIN boleh cipta SUPER_ADMIN
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    if (role === 'SUPER_ADMIN' && currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire('Dilarang', 'Anda tidak mempunyai kuasa mencipta Super Admin.', 'error');
    }

    toggleLoading(true);
    try {
        await AuthService.createAdmin(email, pass, role);
        toggleLoading(false);
        Swal.fire('Berjaya', `Pengguna (${role}) telah ditambah.`, 'success').then(() => {
            document.getElementById('inputNewAdminEmail').value = '';
            document.getElementById('inputNewAdminPass').value = '';
            window.loadAdminList();
        });
    } catch(e) {
        toggleLoading(false);
        Swal.fire('Ralat', 'Gagal menambah admin. Pastikan emel unik.', 'error');
    }
};

window.padamAdmin = async function(id, email) {
    // Semakan Keselamatan Tambahan
    const currentUserRole = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ROLE);
    
    if (currentUserRole !== 'SUPER_ADMIN') {
        return Swal.fire('Dilarang', 'Hanya Super Admin boleh memadam pengguna.', 'error');
    }

    Swal.fire({ 
        title: 'Padam Pengguna?', 
        text: `Adakah anda pasti mahu memadam akses untuk ${email}?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam',
        cancelButtonText: 'Batal'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.deleteUser(id);
                toggleLoading(false);
                Swal.fire('Berjaya', 'Akaun dipadam.', 'success').then(() => window.loadAdminList());
            } catch (e) { 
                toggleLoading(false); 
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
};

// --- SEKOLAH PASSWORD MANAGEMENT ---
window.resetPasswordSekolah = async function(kod) {
    Swal.fire({ 
        title: 'Reset Password?', 
        text: `Tetapkan semula kata laluan ${kod} kepada default (ppdag@12345)?`, 
        icon: 'warning', 
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Reset'
    }).then(async (r) => {
        if(r.isConfirmed) {
            toggleLoading(true);
            try {
                await AuthService.resetSchoolPassword(kod);
                toggleLoading(false);
                Swal.fire('Berjaya', `Kata laluan ${kod} telah di-reset.`, 'success');
            } catch (e) { 
                toggleLoading(false); 
                Swal.fire('Ralat', 'Gagal reset password.', 'error'); 
            }
        }
    });
};

// --- SELF-SERVICE CHANGE PASSWORD ---
window.ubahKataLaluanSendiri = async function() {
    const userId = sessionStorage.getItem(APP_CONFIG.SESSION.USER_ID); 
    
    if (!userId) {
        Swal.fire('Ralat Sesi', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan Anda',
        html:
            '<input id="swal-pass-old" type="password" class="swal2-input" placeholder="Kata Laluan Lama">' +
            '<input id="swal-pass-new" type="password" class="swal2-input" placeholder="Kata Laluan Baru (Min 6)">',
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            return [
                document.getElementById('swal-pass-old').value,
                document.getElementById('swal-pass-new').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;
        if (!oldPass || !newPass || newPass.length < 6) return Swal.fire('Ralat', 'Input tidak sah.', 'warning');

        toggleLoading(true);
        try {
            await AuthService.changePassword(userId, oldPass, newPass);
            toggleLoading(false);
            Swal.fire('Berjaya', 'Kata laluan ditukar. Sila log masuk semula.', 'success').then(() => keluarSistem());
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};