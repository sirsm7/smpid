/**
 * MODUL SETTINGS (js/admin/settings.js)
 * Fungsi: Menguruskan Senarai Admin, Tambah Admin, dan Reset Password Sekolah
 */

// --- USER MANAGEMENT ---
async function loadAdminList() {
    const wrapper = document.getElementById('adminListWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('smpid_users')
            .select('*')
            .in('role', ['ADMIN', 'PPD_UNIT']) 
            .order('email', { ascending: true });

        if (error) throw error;
        if (data.length === 0) {
            wrapper.innerHTML = `<div class="alert alert-warning">Tiada data admin dijumpai.</div>`;
            return;
        }

        let html = `
        <table class="table table-hover table-bordered align-middle mb-0 bg-white">
            <thead class="bg-light">
                <tr>
                    <th class="small text-uppercase text-secondary">Emel</th>
                    <th class="small text-uppercase text-secondary">Peranan</th>
                    <th class="small text-uppercase text-secondary">Kata Laluan</th>
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
                <td class="font-monospace text-muted small">${user.password}</td>
                <td class="text-center">
                    <button onclick="updateAdminRole('${user.id}', '${user.role}')" class="btn btn-sm btn-outline-primary me-1" title="Tukar Peranan">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="padamAdmin('${user.id}', '${user.email}')" class="btn btn-sm btn-outline-danger" title="Padam Akaun">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;
        });

        html += `</tbody></table>`;
        wrapper.innerHTML = html;

    } catch (err) {
        console.error(err);
        wrapper.innerHTML = `<div class="alert alert-danger">Gagal memuatkan senarai admin.</div>`;
    }
}

async function tambahAdmin() {
    const emailInput = document.getElementById('inputNewAdminEmail');
    const roleInput = document.getElementById('inputNewAdminRole');
    const passInput = document.getElementById('inputNewAdminPass');
    
    if (!emailInput || !passInput || !roleInput) return;
    
    const email = emailInput.value.trim();
    const role = roleInput.value;
    const password = passInput.value.trim();

    if (!email || !password) {
        Swal.fire('Ralat', 'Sila isi emel dan kata laluan.', 'warning');
        return;
    }

    window.toggleLoading(true);

    try {
        const newId = crypto.randomUUID();
        const { error } = await window.supabaseClient
            .from('smpid_users')
            .insert([{ 
                id: newId, 
                kod_sekolah: 'M030', 
                email: email, 
                password: password, 
                role: role 
            }]);

        if (error) throw error;

        window.toggleLoading(false);
        Swal.fire('Berjaya', `Pengguna (${role}) telah ditambah.`, 'success').then(() => {
            emailInput.value = '';
            passInput.value = '';
            loadAdminList(); 
        });

    } catch (err) {
        window.toggleLoading(false);
        console.error(err);
        Swal.fire('Ralat', 'Gagal menambah admin. Pastikan emel unik.', 'error');
    }
}

async function updateAdminRole(id, currentRole) {
    const { value: newRole } = await Swal.fire({
        title: 'Kemaskini Peranan',
        input: 'radio',
        inputOptions: {
            'ADMIN': 'ADMIN (Akses Penuh)',
            'PPD_UNIT': 'UNIT PPD (Pencapaian Sahaja)'
        },
        inputValue: currentRole,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal'
    });

    if (newRole && newRole !== currentRole) {
        window.toggleLoading(true);
        try {
            const { error } = await window.supabaseClient
                .from('smpid_users')
                .update({ role: newRole })
                .eq('id', id);

            if (error) throw error;

            window.toggleLoading(false);
            Swal.fire('Berjaya', 'Peranan pengguna dikemaskini.', 'success').then(() => loadAdminList());
        } catch (err) {
            window.toggleLoading(false);
            Swal.fire('Ralat', 'Gagal mengemaskini peranan.', 'error');
        }
    }
}

async function padamAdmin(id, email) {
    Swal.fire({
        title: 'Padam Admin?',
        text: `Anda pasti mahu memadam akses untuk ${email}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Padam'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient
                    .from('smpid_users')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Berjaya', 'Akaun dipadam.', 'success').then(() => loadAdminList());
            } catch (err) {
                window.toggleLoading(false);
                Swal.fire('Ralat', 'Gagal memadam.', 'error');
            }
        }
    });
}

async function resetPasswordSekolah(kod) {
    Swal.fire({
        title: 'Reset Password?',
        text: `Anda pasti mahu menetapkan semula kata laluan untuk ${kod} kepada default?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Reset',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            window.toggleLoading(true);
            try {
                const { error } = await window.supabaseClient
                    .from('smpid_users')
                    .update({ password: 'ppdag@12345' })
                    .eq('kod_sekolah', kod);
                
                if (error) throw error;
                window.toggleLoading(false);
                Swal.fire('Berjaya', `Kata laluan ${kod} telah di-reset kepada: ppdag@12345`, 'success');
            } catch (err) {
                window.toggleLoading(false);
                console.error(err);
                Swal.fire('Ralat', 'Gagal reset password.', 'error');
            }
        }
    });
}

// --- FUNGSI UBAH PASSWORD SENDIRI (UNIT PPD) ---
async function ubahKataLaluanSendiri() {
    const userId = sessionStorage.getItem('smpid_user_id');
    
    if (!userId) {
        Swal.fire('Ralat Sesi', 'Sila log keluar dan log masuk semula.', 'error');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Tukar Kata Laluan',
        html:
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Lama</label>' +
            '<input id="swal-pass-old" type="password" class="swal2-input mb-3" placeholder="Masukan password semasa">' +
            '<label class="mb-1 text-start w-100 small fw-bold">Kata Laluan Baru</label>' +
            '<input id="swal-pass-new" type="password" class="swal2-input" placeholder="Minima 6 aksara">',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            return [
                document.getElementById('swal-pass-old').value,
                document.getElementById('swal-pass-new').value
            ]
        }
    });

    if (formValues) {
        const [oldPass, newPass] = formValues;

        if (!oldPass || !newPass) { 
            Swal.fire('Ralat', 'Sila isi kedua-dua ruang.', 'warning'); 
            return; 
        }
        if (newPass.length < 6) { 
            Swal.fire('Ralat', 'Kata laluan baru terlalu pendek (min 6).', 'warning'); 
            return; 
        }

        window.toggleLoading(true);

        try {
            const { data: userData, error: fetchError } = await window.supabaseClient
                .from('smpid_users')
                .select('password')
                .eq('id', userId)
                .single();

            if (fetchError || !userData) throw new Error("Gagal mengesahkan pengguna.");

            if (userData.password !== oldPass) {
                window.toggleLoading(false);
                Swal.fire('Gagal', 'Kata laluan lama tidak sah.', 'error');
                return;
            }

            const { error: updateError } = await window.supabaseClient
                .from('smpid_users')
                .update({ password: newPass })
                .eq('id', userId);

            if (updateError) throw updateError;

            window.toggleLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'Berjaya',
                text: 'Kata laluan telah ditukar. Sila log masuk semula.',
                confirmButtonText: 'OK'
            }).then(() => {
                window.keluarSistem();
            });

        } catch (err) {
            window.toggleLoading(false);
            console.error(err);
            Swal.fire('Ralat', 'Gagal menukar kata laluan.', 'error');
        }
    }
}

// EXPORTS
window.loadAdminList = loadAdminList;
window.tambahAdmin = tambahAdmin;
window.updateAdminRole = updateAdminRole;
window.padamAdmin = padamAdmin;
window.resetPasswordSekolah = resetPasswordSekolah;
window.ubahKataLaluanSendiri = ubahKataLaluanSendiri;