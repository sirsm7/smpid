/**
 * ADMIN MODULE: SETTINGS (DEV)
 * Menguruskan pengguna admin dan reset password sekolah.
 */

import { AuthService } from '../services/auth.service.js';
import { toggleLoading, keluarSistem } from '../core/helpers.js';

// --- USER MANAGEMENT ---
window.loadAdminList = async function() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;
    
    try {
        const data = await AuthService.getAllAdmins();
        if(data.length === 0) { 
            wrapper.innerHTML = `<div class="alert alert-warning">Tiada data admin dijumpai.</div>`; 
            return; 
        }
        
        let html = `
        <table class="table table-hover table-bordered align-middle mb-0 bg-white">
            <thead class="bg-light">
                <tr>
                    <th class="small text-uppercase text-secondary">Emel</th>
                    <th class="small text-uppercase text-secondary">Peranan</th>
                    <th class="small text-uppercase text-secondary text-center" style="width: 150px;">Tindakan</th>
                </tr>
            </thead>
            <tbody>`;
            
        data.forEach(user => {
            const roleBadge = user.role === 'ADMIN' 
                ? `<span class="badge bg-primary">ADMIN</span>` 
                : `<span class="badge bg-indigo" style="background-color: #4b0082;">UNIT PPD</span>`;

            html += `
            <tr>
                <td class="fw-bold text-dark small">${user.email}</td>
                <td class="small">${roleBadge}</td>
                <td class="text-center">
                    <button onclick="padamAdmin('${user.id}', '${user.email}')" class="btn btn-sm btn-outline-danger" title="Padam Akaun">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
        wrapper.innerHTML = html;
    } catch (e) { 
        wrapper.innerHTML = `<div class="alert alert-danger">Ralat memuatkan senarai admin.</div>`; 
    }
};

window.tambahAdmin = async function() {
    const email = document.getElementById('inputNewAdminEmail').value.trim();
    const role = document.getElementById('inputNewAdminRole').value;
    const pass = document.getElementById('inputNewAdminPass').value.trim();
    
    if(!email || !pass) return Swal.fire('Ralat', 'Sila isi emel dan kata laluan.', 'warning');
    
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
    Swal.fire({ 
        title: 'Padam Admin?', 
        text: `Padam akses untuk ${email}?`, 
        icon: 'warning', 
        showCancelButton: true, 
        confirmButtonColor: '#d33' 
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

// --- UNIT PPD SELF-SERVICE ---
window.ubahKataLaluanSendiri = async function() {
    // FIX: Gunakan kunci sesi yang betul dari config atau string langsung jika perlu
    const userId = sessionStorage.getItem('smpid_user_id'); 
    
    if (!userId) {
        Swal.fire('Ralat Sesi', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
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
            // Panggil keluarSistem yang diimport
            Swal.fire('Berjaya', 'Kata laluan ditukar. Sila log masuk semula.', 'success').then(() => keluarSistem());
        } catch (err) {
            toggleLoading(false);
            Swal.fire('Gagal', err.message, 'error');
        }
    }
};